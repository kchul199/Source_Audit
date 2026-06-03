import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { Octokit } from 'octokit';
import { db, AuditStatus, createLogger } from '@src-audit/shared';
import { OpenAIAgent } from './agent';
import { Sandbox } from './sandbox';

// Load .env from root (single entry point)
dotenv.config({ path: path.join(process.cwd(), '.env') });

const log = createLogger('agent-worker');

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Octokit instance will be created dynamically per job using project credentials
const agent = new OpenAIAgent();
const sandbox = new Sandbox();

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001/api/internal/audit-event';
const MAX_DIFF_SIZE = 100_000; // ~100KB limit to prevent token overflow
const MAX_HEALING_ITERATIONS = 3;

async function notifyStatus(auditId: string, status: string) {
  try {
    await fetch(API_INTERNAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId, status }),
    });
  } catch (e) {
    log.warn('Failed to notify status change', { auditId, status });
  }
}

async function createGitHubCheck(
  octokit: Octokit,
  owner: string,
  repo: string,
  commitHash: string,
  findingsCount: number
) {
  try {
    const conclusion = findingsCount > 0 ? 'failure' : 'success';
    await octokit.rest.checks.create({
      owner,
      repo,
      name: 'AI Code Audit',
      head_sha: commitHash,
      status: 'completed',
      conclusion: conclusion,
      completed_at: new Date().toISOString(),
      output: {
        title: findingsCount > 0 ? 'AI Audit: Issues Detected' : 'AI Audit: Passed',
        summary: `AI Code Audit scanned the changes and found ${findingsCount} quality/security issues.`,
      },
    });
    log.info('Successfully updated GitHub Check Run', { repo, commitHash, conclusion });
  } catch (err: any) {
    log.error('Failed to create/update GitHub Check Run', { error: err.message });
  }
}

async function postPRComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  findings: any[]
) {
  if (findings.length === 0) return;

  try {
    const comments = findings
      .filter((f) => f.filePath && f.filePath !== 'N/A')
      .map((f) => {
        let line = 1;
        if (f.lineRange) {
          const match = f.lineRange.match(/\d+/);
          if (match) line = parseInt(match[0], 10);
        }
        return {
          path: f.filePath,
          line: line,
          side: 'RIGHT' as const,
          body: `### 🤖 AI Code Audit: ${f.category} (${f.severity})\n\n${f.description}\n\n${
            f.suggestion ? `**Suggestion:**\n\`\`\`\n${f.suggestion}\n\`\`\`` : ''
          }`,
        };
      });

    if (comments.length > 0) {
      await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        event: 'COMMENT',
        comments: comments,
        body: `🤖 **Src-Audit AI Analysis Completed.** Found ${findings.length} issues. Please review the inline comments.`,
      });
      log.info('Successfully posted PR review comments', { repo, prNumber, count: comments.length });
    }
  } catch (err: any) {
    log.error('Failed to post PR review comments, falling back to a global PR comment', {
      error: err.message,
    });
    try {
      const body = `🤖 **Src-Audit AI Analysis Completed.** Found ${findings.length} issues:\n\n` +
        findings.map((f) => `- **[${f.severity}] ${f.category}** in \`${f.filePath}\`: ${f.description}`).join('\n');
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
    } catch (e: any) {
      log.error('Failed to post fallback PR comment', { error: e.message });
    }
  }
}

log.info('Agent worker starting...');

const worker = new Worker(
  'agent-queue',
  async (job) => {
    const { auditId, repo, commitHash, prNumber } = job.data;
    log.info('Processing audit job', { auditId, repo, commitHash, prNumber });

    const [owner, repoName] = repo.split('/');
    const workspacePath = path.join(process.cwd(), 'temp_workspaces', auditId);

    const auditRecord = await db.audit.findUnique({
      where: { id: auditId },
      include: { project: true },
    });
    if (!auditRecord) {
      throw new Error(`Audit record not found: ${auditId}`);
    }
    const project = auditRecord.project;
    const token = project.githubToken || process.env.GITHUB_TOKEN;
    const jobOctokit = new Octokit({ auth: token });

    try {
      // 1. Update status to ANALYZING
      await db.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.ANALYZING, startedAt: new Date() },
      });
      await notifyStatus(auditId, AuditStatus.ANALYZING);

      // 2. Fetch Diff from GitHub
      let diff = '';
      if (prNumber) {
        const { data } = await jobOctokit.rest.pulls.get({
          owner,
          repo: repoName,
          pull_number: prNumber,
          mediaType: { format: 'diff' },
        });
        diff = data as unknown as string;
      } else {
        const { data } = await jobOctokit.rest.repos.getCommit({
          owner,
          repo: repoName,
          ref: commitHash,
          mediaType: { format: 'diff' },
        });
        diff = data as unknown as string;
      }

      // 3. Enforce diff size limit to prevent token overflow
      if (diff.length > MAX_DIFF_SIZE) {
        log.warn('Diff too large, truncating', { auditId, originalSize: diff.length });
        diff = diff.substring(0, MAX_DIFF_SIZE) + '\n\n... [truncated — diff exceeded 100KB]';
      }

      // 4. Fetch Context (GEMINI.md) if it exists
      let context = '';
      try {
        const { data: geminiContent } = await jobOctokit.rest.repos.getContent({
          owner,
          repo: repoName,
          path: 'GEMINI.md',
        });
        if ('content' in geminiContent) {
          context = Buffer.from(geminiContent.content, 'base64').toString();
        }
      } catch (e) {
        log.debug('No GEMINI.md found', { repo });
      }

      // Combine GEMINI.md context with project customPromptRules
      const mergedContext = [context, project.customPromptRules].filter(Boolean).join('\n\n');
      const model = project.llmModel || 'gpt-4o';

      // 5. AI Analysis
      const findings = await agent.analyzeCode(auditId, repo, diff, mergedContext, model);

      // Create Check Run / Commit Status on GitHub
      await createGitHubCheck(jobOctokit, owner, repoName, commitHash, findings.length);

      // Post Review Comments to PR if enabled and it's a PR event
      if (project.enablePRComments && prNumber) {
        await postPRComments(jobOctokit, owner, repoName, prNumber, findings);
      }

      // 6. Update status to GENERATING_TESTS
      await db.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.GENERATING_TESTS },
      });
      await notifyStatus(auditId, AuditStatus.GENERATING_TESTS);

      // 7. AI Test Generation
      const { testCode: initialTestCode, testResultId } = await agent.generateTestCode(
        auditId, repo, diff, mergedContext, model,
      );

      // 8. Update status to EXECUTING_SANDBOX
      await db.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.EXECUTING_SANDBOX },
      });
      await notifyStatus(auditId, AuditStatus.EXECUTING_SANDBOX);

      // 9. Setup workspace (Clone shallow) using execFileSync for safety
      if (!fs.existsSync(path.dirname(workspacePath))) {
        fs.mkdirSync(path.dirname(workspacePath), { recursive: true });
      }

      const repoUrl = `https://x-access-token:${token}@github.com/${repo}.git`;
      log.info('Cloning repository', { repo, workspacePath });
      execFileSync('git', ['clone', '--depth', '1', repoUrl, workspacePath]);

      // 10. Sandbox Execution & Self-Healing Loop with iteration tracking
      let currentTestCode = initialTestCode;
      let iteration = 1;
      let finalResult: string | undefined;

      while (iteration <= MAX_HEALING_ITERATIONS) {
        log.info('Sandbox iteration', { auditId, iteration, maxIterations: MAX_HEALING_ITERATIONS });

        const sandboxResult = await sandbox.runTest(workspacePath, currentTestCode);
        const isPassed = sandboxResult.exitCode === 0;
        const isFinalIteration = iteration === MAX_HEALING_ITERATIONS;

        // Record healing iteration for full history tracking
        await db.healingIteration.create({
          data: {
            testResultId,
            iteration,
            testCode: currentTestCode,
            exitCode: sandboxResult.exitCode,
            stdout: sandboxResult.stdout?.substring(0, 50_000) || null,
            stderr: sandboxResult.stderr?.substring(0, 50_000) || null,
          },
        });

        // Update the main TestResult record with latest state
        await db.testResult.update({
          where: { id: testResultId },
          data: {
            testCode: currentTestCode,
            exitCode: sandboxResult.exitCode,
            stdout: sandboxResult.stdout?.substring(0, 50_000) || null,
            stderr: sandboxResult.stderr?.substring(0, 50_000) || null,
            iterationCount: iteration,
            status: isPassed
              ? 'PASSED'
              : isFinalIteration
                ? 'FAILED'
                : 'RUNNING',
          },
        });

        if (isPassed) {
          log.info('Test PASSED', { auditId, iteration });
          finalResult = 'PASSED';

          // If healed after first attempt, mark as HEALED
          if (iteration > 1) {
            await db.testResult.update({
              where: { id: testResultId },
              data: { status: 'HEALED' },
            });
            finalResult = 'HEALED';
          }
          break;
        }

        if (!isFinalIteration) {
          log.info('Test FAILED — attempting healing', { auditId, iteration });
          const errorOutput = [sandboxResult.stdout, sandboxResult.stderr]
            .filter(Boolean)
            .join('\n')
            .substring(0, 10_000); // Limit error context sent to AI

          const { healedCode, errorAnalysis } = await agent.healTestCode(
            repo, diff, currentTestCode, errorOutput, mergedContext, model,
          );

          // Store errorAnalysis in the healing iteration
          await db.healingIteration.update({
            where: { id: (await db.healingIteration.findFirst({
              where: { testResultId, iteration },
              select: { id: true },
            }))!.id },
            data: { errorAnalysis },
          });

          // Also update main TestResult errorAnalysis
          await db.testResult.update({
            where: { id: testResultId },
            data: { errorAnalysis },
          });

          currentTestCode = healedCode;
        } else {
          log.warn('Test FAILED after max iterations', { auditId, iterations: MAX_HEALING_ITERATIONS });
          finalResult = 'FAILED';
        }
        iteration++;
      }

      // 11. Update final Audit Status
      const finalStatus = finalResult === 'FAILED' ? AuditStatus.FAILED : AuditStatus.COMPLETED;
      await db.audit.update({
        where: { id: auditId },
        data: {
          status: finalStatus,
          completedAt: new Date(),
        },
      });
      await notifyStatus(auditId, finalStatus);

      return { status: 'completed', result: finalResult };
    } catch (error: any) {
      log.error('Error processing audit', { auditId, error: error.message, stack: error.stack });
      await db.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.FAILED },
      });
      await notifyStatus(auditId, AuditStatus.FAILED);
      throw error;
    } finally {
      // Cleanup workspace
      if (fs.existsSync(workspacePath)) {
        try {
          fs.rmSync(workspacePath, { recursive: true, force: true });
        } catch (e: any) {
          log.error('Failed to cleanup workspace', { workspacePath, error: e.message });
        }
      }
    }
  },
  {
    connection: connection as any,
    concurrency: 2, // Limit concurrent jobs to prevent resource exhaustion
    limiter: {
      max: 10,
      duration: 60_000, // Max 10 jobs per minute
    },
  },
);

worker.on('completed', (job) => {
  log.info('Job completed', { jobId: job.id, auditId: job.data.auditId });
});

worker.on('failed', (job, err) => {
  log.error('Job failed', { jobId: job?.id, auditId: job?.data?.auditId, error: err?.message });
});

// Graceful shutdown
async function shutdown(signal: string) {
  log.info('Received shutdown signal, draining worker...', { signal });
  try {
    await worker.close();     // Wait for in-progress jobs to complete
    await connection.quit();  // Close Redis connection
    await db.$disconnect();   // Close Prisma connection
    log.info('Shutdown complete');
    process.exit(0);
  } catch (e: any) {
    log.error('Error during shutdown', { error: e.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
