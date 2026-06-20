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
import {
  buildProjectContext,
  classifySandboxFailure,
  extractAddedLinesByFile,
  formatContextBundle,
  validateAiFindings,
} from './context';

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

function sanitizeSecret(value: string, secret?: string) {
  if (!secret) return value;
  return value.split(secret).join('[REDACTED]');
}

function runGit(args: string[], cwd?: string, token?: string) {
  try {
    execFileSync('git', args, { cwd });
  } catch (error: any) {
    const message = sanitizeSecret(error.message || 'Git command failed', token);
    const stderr = sanitizeSecret(error.stderr?.toString?.() || '', token);
    throw new Error([message, stderr].filter(Boolean).join('\n'));
  }
}

function pickRunner(strategy: unknown): string | undefined {
  if (!strategy || typeof strategy !== 'object') return undefined;
  const framework = String((strategy as { framework?: unknown }).framework || '').toLowerCase();
  if (framework.includes('vitest')) return 'vitest';
  if (framework.includes('mocha')) return 'mocha';
  if (framework.includes('node')) return 'node:test';
  if (framework.includes('jest')) return 'jest';
  if (framework.includes('pytest')) return 'pytest';
  if (framework.includes('go')) return 'go test';
  return undefined;
}

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
  findingsCount: number,
  auditStatus: 'success' | 'failure',
  detail: string,
) {
  try {
    await octokit.rest.checks.create({
      owner,
      repo,
      name: 'AI Code Audit',
      head_sha: commitHash,
      status: 'completed',
      conclusion: auditStatus,
      completed_at: new Date().toISOString(),
      output: {
        title: auditStatus === 'failure' ? 'AI Audit: Issues Detected or Verification Failed' : 'AI Audit: Passed',
        summary: `AI Code Audit found ${findingsCount} quality/security issues. ${detail}`,
      },
    });
    log.info('Successfully updated GitHub Check Run', { repo, commitHash, conclusion: auditStatus });
  } catch (err: any) {
    log.error('Failed to create/update GitHub Check Run', { error: err.message });
  }
}

async function postPRComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  findings: any[],
  diff: string,
) {
  if (findings.length === 0) return;

  try {
    const addedLines = extractAddedLinesByFile(diff);
    const comments = findings
      .filter((f) => f.filePath && f.filePath !== 'N/A')
      .map((f) => {
        let line = 1;
        if (f.lineRange) {
          const match = f.lineRange.match(/\d+/);
          if (match) line = parseInt(match[0], 10);
        }
        if (!addedLines.get(f.filePath)?.has(line)) {
          return null;
        }
        return {
          path: f.filePath,
          line: line,
          side: 'RIGHT' as const,
          body: `### 🤖 AI Code Audit: ${f.category} (${f.severity})\n\n${f.description}\n\n${
            f.suggestion ? `**Suggestion:**\n\`\`\`\n${f.suggestion}\n\`\`\`` : ''
          }`,
        };
      })
      .filter(Boolean) as Array<{ path: string; line: number; side: 'RIGHT'; body: string }>;

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
    } else {
      const body = `🤖 **Src-Audit AI Analysis Completed.** Found ${findings.length} issues, but none could be safely attached to changed RIGHT-side diff lines:\n\n` +
        findings.map((f) => `- **[${f.severity}] ${f.category}** in \`${f.filePath}\`: ${f.description}`).join('\n');
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      });
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
    if (!token) {
      throw new Error('GitHub token is required to fetch diffs, clone repositories, and publish audit checks');
    }
    const jobOctokit = new Octokit({ auth: token });

    try {
      if (job.attemptsMade > 0) {
        log.warn('Cleaning partial audit results before queue retry', {
          auditId,
          attemptsMade: job.attemptsMade,
        });
        await db.$transaction([
          db.analysisResult.deleteMany({ where: { auditId } }),
          db.testResult.deleteMany({ where: { auditId } }),
        ]);
      }

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

      // 3. Keep the full diff for parsing/validation; limit only the LLM prompt input.
      const fullDiff = diff;
      const llmDiff = diff.length > MAX_DIFF_SIZE
        ? diff.substring(0, MAX_DIFF_SIZE) + '\n\n... [truncated — diff exceeded 100KB]'
        : diff;
      if (diff.length > MAX_DIFF_SIZE) {
        log.warn('Diff too large for a single prompt, truncating LLM input only', {
          auditId,
          originalSize: diff.length,
        });
      }

      // 4. Setup workspace before analysis so the AI receives real file context.
      if (!fs.existsSync(path.dirname(workspacePath))) {
        fs.mkdirSync(path.dirname(workspacePath), { recursive: true });
      }
      if (fs.existsSync(workspacePath)) {
        fs.rmSync(workspacePath, { recursive: true, force: true });
      }

      const repoUrl = `https://x-access-token:${token}@github.com/${repo}.git`;
      log.info('Cloning repository', { repo, workspacePath });
      runGit(['clone', '--depth', '1', '--no-checkout', repoUrl, workspacePath], undefined, token);
      runGit(['fetch', '--depth', '1', 'origin', commitHash], workspacePath, token);
      runGit(['checkout', '--detach', commitHash], workspacePath, token);

      // 5. Gather full context and static evidence from the checked-out commit.
      const contextBundle = buildProjectContext(workspacePath, fullDiff);
      const formattedContext = formatContextBundle(contextBundle);
      const mergedContext = [formattedContext, project.customPromptRules].filter(Boolean).join('\n\n');
      const model = project.llmModel || 'gpt-4o';

      // 6. AI Analysis with evidence validation
      const aiFindings = await agent.analyzeCode(
        auditId,
        repo,
        llmDiff,
        mergedContext,
        model,
        contextBundle.staticFindings,
      );
      const findings = validateAiFindings(
        [...contextBundle.staticFindings, ...aiFindings],
        workspacePath,
        fullDiff,
      );

      if (findings.length > 0) {
        await db.analysisResult.createMany({
          data: findings.map((finding) => ({
            auditId,
            category: finding.category || 'UNKNOWN',
            severity: finding.severity || 'LOW',
            filePath: finding.filePath || 'unknown',
            lineRange: finding.lineRange ?? null,
            description: finding.description || '',
            suggestion: finding.suggestion ?? null,
            sourceSnippet: finding.sourceSnippet ?? null,
          })),
        });
      }

      // Post Review Comments to PR if enabled and it's a PR event
      if (project.enablePRComments && prNumber) {
        await postPRComments(jobOctokit, owner, repoName, prNumber, findings, fullDiff);
      }

      // 7. Update status to GENERATING_TESTS
      await db.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.GENERATING_TESTS },
      });
      await notifyStatus(auditId, AuditStatus.GENERATING_TESTS);

      // 8. Generate a test strategy first, then generate code from that strategy.
      const testStrategy = await agent.generateTestStrategy(repo, llmDiff, mergedContext, model);
      const { testCode: initialTestCode, testResultId } = await agent.generateTestCode(
        auditId, repo, llmDiff, mergedContext, model, testStrategy,
      );

      await db.testResult.update({
        where: { id: testResultId },
        data: {
          errorAnalysis: `Test strategy: ${JSON.stringify(testStrategy).slice(0, 4000)}`,
        },
      });

      // 9. Update status to EXECUTING_SANDBOX
      await db.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.EXECUTING_SANDBOX },
      });
      await notifyStatus(auditId, AuditStatus.EXECUTING_SANDBOX);

      // 10. Sandbox Execution & Self-Healing Loop with iteration tracking
      let currentTestCode = initialTestCode;
      let iteration = 1;
      let finalResult: string | undefined;

      while (iteration <= MAX_HEALING_ITERATIONS) {
        log.info('Sandbox iteration', { auditId, iteration, maxIterations: MAX_HEALING_ITERATIONS });

        const sandboxResult = await sandbox.runTest(
          workspacePath,
          currentTestCode,
          contextBundle.validationCommands.map((command) => command.command),
          pickRunner(testStrategy),
          contextBundle.changedFiles.map((file) => file.filePath),
        );
        const isPassed = sandboxResult.exitCode === 0;
        const isFinalIteration = iteration === MAX_HEALING_ITERATIONS;
        const failureClass = classifySandboxFailure(sandboxResult);
        const validationClass = sandboxResult.validation
          ? classifySandboxFailure(sandboxResult.validation)
          : undefined;
        const validationFailed = Boolean(
          sandboxResult.validation && sandboxResult.validation.exitCode !== 0,
        );

        // Record healing iteration for full history tracking
        await db.healingIteration.create({
          data: {
            testResultId,
            iteration,
            testCode: currentTestCode,
            exitCode: sandboxResult.exitCode,
            stdout: sandboxResult.stdout?.substring(0, 50_000) || null,
            stderr: sandboxResult.stderr?.substring(0, 50_000) || null,
            errorAnalysis: [
              isPassed ? null : failureClass,
              validationClass && validationClass !== 'PASSED' ? `PROJECT_VALIDATION:${validationClass}` : null,
            ].filter(Boolean).join('\n') || null,
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
            errorAnalysis: [
              isPassed ? undefined : failureClass,
              validationClass && validationClass !== 'PASSED' ? `PROJECT_VALIDATION:${validationClass}` : undefined,
            ].filter(Boolean).join('\n') || undefined,
            status: isPassed
              ? 'PASSED'
              : isFinalIteration
                ? 'FAILED'
                : 'RUNNING',
          },
        });

        if (isPassed) {
          log.info('Test PASSED', { auditId, iteration });
          finalResult = validationFailed ? 'VALIDATION_FAILED' : 'PASSED';

          // If healed after first attempt, mark as HEALED
          if (iteration > 1 && !validationFailed) {
            await db.testResult.update({
              where: { id: testResultId },
              data: { status: 'HEALED' },
            });
            finalResult = 'HEALED';
          }
          if (validationFailed) {
            await db.testResult.update({
              where: { id: testResultId },
              data: {
                status: 'FAILED',
                errorAnalysis: `PROJECT_VALIDATION:${validationClass}`,
              },
            });
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
            repo, llmDiff, currentTestCode, errorOutput, mergedContext, model,
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
      const finalStatus = finalResult === 'FAILED' || finalResult === 'VALIDATION_FAILED'
        ? AuditStatus.FAILED
        : AuditStatus.COMPLETED;
      const finalCheckStatus = finalStatus === AuditStatus.COMPLETED && findings.length === 0
        ? 'success'
        : 'failure';
      await createGitHubCheck(
        jobOctokit,
        owner,
        repoName,
        commitHash,
        findings.length,
        finalCheckStatus,
        `Final audit status: ${finalStatus}. Test result: ${finalResult || 'UNKNOWN'}.`,
      );
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
      await db.testResult.updateMany({
        where: { auditId, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          stderr: `Audit failed before sandbox completion: ${error.message || 'Unknown error'}`,
        },
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
    concurrency: 1, // Keep sandbox workspaces isolated and prevent duplicate audit races
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
