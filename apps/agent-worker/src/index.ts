import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { Octokit } from 'octokit';
import { db, AuditStatus } from '@src-audit/shared';
import { OpenAIAgent } from './agent';
import { Sandbox } from './sandbox';

// Load .env from root
dotenv.config({ path: path.join(process.cwd(), '.env') });

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const agent = new OpenAIAgent();
const sandbox = new Sandbox();

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://localhost:3001/api/internal/audit-event';

async function notifyStatus(auditId: string, status: string) {
  try {
    await fetch(API_INTERNAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditId, status }),
    });
  } catch (e) {
    console.warn(`Failed to notify status change (${status}) for audit ${auditId}`);
  }
}

console.log('Agent worker starting...');

const worker = new Worker(
  'agent-queue',
  async (job) => {
    const { auditId, repo, commitHash, prNumber } = job.data;
    console.log(`Processing Audit ${auditId} for ${repo} at ${commitHash}`);

    const [owner, repoName] = repo.split('/');
    const workspacePath = path.join(process.cwd(), 'temp_workspaces', auditId);

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
        const { data } = await octokit.rest.pulls.get({
          owner,
          repo: repoName,
          pull_number: prNumber,
          mediaType: { format: 'diff' },
        });
        diff = data as unknown as string;
      } else {
        const { data } = await octokit.rest.repos.getCommit({
          owner,
          repo: repoName,
          ref: commitHash,
          mediaType: { format: 'diff' },
        });
        diff = data as unknown as string;
      }

      // 3. Fetch Context (GEMINI.md) if it exists
      let context = '';
      try {
        const { data: geminiContent } = await octokit.rest.repos.getContent({
          owner,
          repo: repoName,
          path: 'GEMINI.md',
        });
        if ('content' in geminiContent) {
          context = Buffer.from(geminiContent.content, 'base64').toString();
        }
      } catch (e) {
        console.log('No GEMINI.md found.');
      }

      // 4. AI Analysis
      await agent.analyzeCode(auditId, repo, diff, context);

      // 5. Update status to GENERATING_TESTS
      await db.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.GENERATING_TESTS },
      });
      await notifyStatus(auditId, AuditStatus.GENERATING_TESTS);

      // 6. AI Test Generation
      const { testCode: initialTestCode, testResultId } = await agent.generateTestCode(auditId, repo, diff, context);

      // 7. Update status to EXECUTING_SANDBOX
      await db.audit.update({
        where: { id: auditId },
        data: { status: AuditStatus.EXECUTING_SANDBOX },
      });
      await notifyStatus(auditId, AuditStatus.EXECUTING_SANDBOX);

      // 8. Sandbox Execution & Self-Healing Loop
      if (!fs.existsSync(path.dirname(workspacePath))) {
        fs.mkdirSync(path.dirname(workspacePath), { recursive: true });
      }

      // Setup workspace (Clone shallow)
      const repoUrl = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${repo}.git`;
      console.log(`Cloning ${repo} to ${workspacePath}...`);
      execSync(`git clone --depth 1 ${repoUrl} ${workspacePath}`);

      let currentTestCode = initialTestCode;
      let iteration = 1;
      const maxIterations = 3;
      let finalResult;

      while (iteration <= maxIterations) {
        console.log(`Sandbox Iteration ${iteration}/${maxIterations}...`);
        
        const sandboxResult = await sandbox.runTest(workspacePath, currentTestCode);
        
        // Update DB for this iteration
        await db.testResult.update({
          where: { id: testResultId },
          data: {
            testCode: currentTestCode,
            exitCode: sandboxResult.exitCode,
            stdout: sandboxResult.stdout,
            stderr: sandboxResult.stderr,
            iterationCount: iteration,
            status: sandboxResult.exitCode === 0 ? 'PASSED' : (iteration === maxIterations ? 'FAILED' : 'RUNNING')
          }
        });

        if (sandboxResult.exitCode === 0) {
          console.log(`Test PASSED on iteration ${iteration}`);
          finalResult = 'PASSED';
          break;
        }

        if (iteration < maxIterations) {
          console.log(`Test FAILED. Attempting healing...`);
          currentTestCode = await agent.healTestCode(
            repo,
            diff,
            currentTestCode,
            sandboxResult.stdout + '\n' + sandboxResult.stderr,
            context
          );
        } else {
          console.log(`Test FAILED after ${maxIterations} iterations.`);
          finalResult = 'FAILED';
        }
        iteration++;
      }

      // 9. Update Audit Status
      const finalStatus = finalResult === 'PASSED' ? AuditStatus.COMPLETED : AuditStatus.FAILED;
      await db.audit.update({
        where: { id: auditId },
        data: { 
          status: finalStatus,
          completedAt: new Date() 
        },
      });
      await notifyStatus(auditId, finalStatus);

      return { status: 'completed', result: finalResult };
    } catch (error) {
      console.error(`Error processing Audit ${auditId}:`, error);
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
        } catch (e) {
          console.error(`Failed to cleanup workspace ${workspacePath}:`, e);
        }
      }
    }
  },
  { connection: connection as any }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} (Audit ${job.data.auditId}) completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} (Audit ${job?.data?.auditId}) failed with ${err?.message}`);
});
