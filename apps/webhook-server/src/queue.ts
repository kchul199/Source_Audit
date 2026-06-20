import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(process.cwd(), '.env') });

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export interface AuditTaskData {
  auditId: string;
  repo: string;
  commitHash: string;
  prNumber?: number;
  ref?: string;
}

export const agentQueue = new Queue('agent-queue', { connection: connection as any });

export async function enqueueAuditTask(data: AuditTaskData) {
  await agentQueue.add('analyze-code', data, {
    jobId: data.auditId,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  });
}
