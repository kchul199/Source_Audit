import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { db, AuditStatus, createLogger, syncConfig, exportConfigToFile, readConfigFile, maskToken } from '@src-audit/shared';
import { enqueueAuditTask } from './queue';

// Load .env from root (single entry point for this service)
dotenv.config({ path: path.join(process.cwd(), '.env') });

const log = createLogger('webhook-server');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Internal QA — acceptable for non-production use
  },
});

const port = process.env.PORT || 3001;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'dummy_secret';

app.use(cors());
app.use(express.json());

// Socket.io connection handling
io.on('connection', (socket) => {
  log.info('Client connected', { socketId: socket.id });
  socket.on('disconnect', () => log.debug('Client disconnected', { socketId: socket.id }));
});

// Helper to broadcast audit updates
const broadcastAuditUpdate = (auditId: string, status: string) => {
  io.emit('audit_update', { auditId, status, updatedAt: new Date().toISOString() });
};

// Internal endpoint for worker to notify status changes
app.post('/api/internal/audit-event', (req, res) => {
  const { auditId, status } = req.body;
  broadcastAuditUpdate(auditId, status);
  res.sendStatus(200);
});

// Webhook signature verification middleware supporting custom repo secrets
const verifySignature = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    return res.status(401).send('No signature provided');
  }

  const repoUrl = req.body?.repository?.html_url;
  let secret = WEBHOOK_SECRET;

  if (repoUrl) {
    try {
      const project = await db.project.findUnique({ where: { repoUrl } });
      if (project && project.webhookSecret) {
        secret = project.webhookSecret;
      }
    } catch (e: any) {
      log.error('Error looking up project for signature verification', { error: e.message });
    }
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature !== digest) {
    log.warn('Invalid webhook signature detected');
    // If project has a custom webhook secret, strictly reject mismatches
    if (repoUrl) {
      try {
        const project = await db.project.findUnique({ where: { repoUrl } });
        if (project && project.webhookSecret) {
          return res.status(401).send('Invalid signature');
        }
      } catch (err) {}
    }
  }

  next();
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'webhook-server', timestamp: new Date().toISOString() });
});

/**
 * Portal API Routes
 */

// List all projects (with masked githubToken)
app.get('/api/projects', async (_req, res) => {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { audits: true },
        },
      },
    });
    const masked = projects.map((p) => ({
      ...p,
      githubToken: p.githubToken ? maskToken(p.githubToken) : null,
    }));
    res.json(masked);
  } catch (error: any) {
    log.error('Error fetching projects', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/config/file - Get current raw JSON config file contents
app.get('/api/config/file', (_req, res) => {
  try {
    const config = readConfigFile();
    res.json(config);
  } catch (error: any) {
    log.error('Error fetching config file', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/config/sync - Trigger sync of config file to database
app.post('/api/config/sync', async (_req, res) => {
  try {
    await syncConfig();
    res.json({ message: 'Synchronized config file with database successfully' });
  } catch (error: any) {
    log.error('Error syncing config', { error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST /api/config/export - Export DB configuration to file
app.post('/api/config/export', async (_req, res) => {
  try {
    await exportConfigToFile();
    res.json({ message: 'Exported config from database to file successfully' });
  } catch (error: any) {
    log.error('Error exporting config', { error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// POST /api/projects - Create a new project manually
app.post('/api/projects', async (req, res) => {
  const { name, repoUrl, githubToken, webhookSecret, allowPRs, allowPush, adminUsers, branchFilter, active } = req.body;
  if (!name || !repoUrl) {
    return res.status(400).json({ error: 'Name and Repo URL are required' });
  }
  try {
    const project = await db.project.create({
      data: {
        name,
        repoUrl,
        githubToken: githubToken || null,
        webhookSecret: webhookSecret || null,
        allowPRs: allowPRs !== undefined ? allowPRs : true,
        allowPush: allowPush !== undefined ? allowPush : true,
        adminUsers: adminUsers || '',
        branchFilter: branchFilter || '*',
        active: active !== undefined ? active : true,
      },
    });
    // Auto export to config file on change so the file stays in sync
    await exportConfigToFile();
    res.json(project);
  } catch (error: any) {
    log.error('Error creating project', { error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// PUT /api/projects/:id - Update an existing project config
app.put('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { name, repoUrl, githubToken, webhookSecret, allowPRs, allowPush, adminUsers, branchFilter, active } = req.body;
  try {
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let updatedToken = githubToken;
    if (githubToken && githubToken.includes('***')) {
      updatedToken = existing.githubToken;
    }

    const project = await db.project.update({
      where: { id },
      data: {
        name: name !== undefined ? name : undefined,
        repoUrl: repoUrl !== undefined ? repoUrl : undefined,
        githubToken: updatedToken !== undefined ? updatedToken : undefined,
        webhookSecret: webhookSecret !== undefined ? webhookSecret : undefined,
        allowPRs: allowPRs !== undefined ? allowPRs : undefined,
        allowPush: allowPush !== undefined ? allowPush : undefined,
        adminUsers: adminUsers !== undefined ? adminUsers : undefined,
        branchFilter: branchFilter !== undefined ? branchFilter : undefined,
        active: active !== undefined ? active : undefined,
      },
    });

    // Auto export to config file on change so the file stays in sync
    await exportConfigToFile();
    res.json(project);
  } catch (error: any) {
    log.error('Error updating project', { error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// DELETE /api/projects/:id - Delete a project
app.delete('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }
    await db.audit.deleteMany({ where: { projectId: id } });
    await db.project.delete({ where: { id } });

    // Auto export to config file on change so the file stays in sync
    await exportConfigToFile();
    res.json({ message: 'Project and associated audits deleted successfully' });
  } catch (error: any) {
    log.error('Error deleting project', { error: error.message });
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// Get comprehensive dashboard and project-wise statistics
app.get('/api/stats', async (_req, res) => {
  try {
    const projectsList = await db.project.findMany({
      include: {
        audits: {
          include: {
            analysisResults: true,
            testResults: {
              include: {
                healingIterations: true,
              },
            },
          },
        },
      },
    });

    const totalProjects = projectsList.length;
    let totalAudits = 0;

    const globalStatusCounts: Record<string, number> = {};
    const globalCategoryCounts: Record<string, number> = {};
    const globalSeverityCounts: Record<string, number> = {};
    const globalTestStatusCounts: Record<string, number> = {};
    let globalTotalHealingIterations = 0;
    let globalTestCountWithIterations = 0;

    const projectsStats = projectsList.map((project) => {
      totalAudits += project.audits.length;

      const projStatusCounts: Record<string, number> = {};
      const projCategoryCounts: Record<string, number> = {};
      const projSeverityCounts: Record<string, number> = {};
      const projTestStatusCounts: Record<string, number> = {};
      let projTotalHealingIterations = 0;
      let projTestCountWithIterations = 0;

      project.audits.forEach((audit) => {
        // Audit Status
        projStatusCounts[audit.status] = (projStatusCounts[audit.status] || 0) + 1;
        globalStatusCounts[audit.status] = (globalStatusCounts[audit.status] || 0) + 1;

        // Findings
        audit.analysisResults.forEach((finding) => {
          projCategoryCounts[finding.category] = (projCategoryCounts[finding.category] || 0) + 1;
          globalCategoryCounts[finding.category] = (globalCategoryCounts[finding.category] || 0) + 1;

          projSeverityCounts[finding.severity] = (projSeverityCounts[finding.severity] || 0) + 1;
          globalSeverityCounts[finding.severity] = (globalSeverityCounts[finding.severity] || 0) + 1;
        });

        // Test Results
        audit.testResults.forEach((tr) => {
          projTestStatusCounts[tr.status] = (projTestStatusCounts[tr.status] || 0) + 1;
          globalTestStatusCounts[tr.status] = (globalTestStatusCounts[tr.status] || 0) + 1;

          if (tr.healingIterations.length > 0) {
            const maxIter = tr.healingIterations.reduce((max, cur) => Math.max(max, cur.iteration), 0);
            projTotalHealingIterations += maxIter;
            globalTotalHealingIterations += maxIter;
            projTestCountWithIterations++;
            globalTestCountWithIterations++;
          }
        });
      });

      return {
        id: project.id,
        name: project.name,
        repoUrl: project.repoUrl,
        totalAudits: project.audits.length,
        auditStatusCounts: projStatusCounts,
        findingCategoryCounts: projCategoryCounts,
        findingSeverityCounts: projSeverityCounts,
        testStatusCounts: projTestStatusCounts,
        avgHealingIterations: projTestCountWithIterations > 0
          ? Number((projTotalHealingIterations / projTestCountWithIterations).toFixed(2))
          : 0,
      };
    });

    res.json({
      global: {
        totalProjects,
        totalAudits,
        auditStatusCounts: globalStatusCounts,
        findingCategoryCounts: globalCategoryCounts,
        findingSeverityCounts: globalSeverityCounts,
        testStatusCounts: globalTestStatusCounts,
        avgHealingIterations: globalTestCountWithIterations > 0
          ? Number((globalTotalHealingIterations / globalTestCountWithIterations).toFixed(2))
          : 0,
      },
      projects: projectsStats,
    });
  } catch (error: any) {
    log.error('Error computing stats', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// List audits with pagination
app.get('/api/audits', async (req, res) => {
  const { projectId, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  try {
    const where = projectId ? { projectId: String(projectId) } : {};

    const [audits, total] = await Promise.all([
      db.audit.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { project: true },
        skip,
        take: limitNum,
      }),
      db.audit.count({ where }),
    ]);

    res.json({
      data: audits,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    log.error('Error fetching audits', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get specific audit details (with findings, test results, and healing iterations)
app.get('/api/audits/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const audit = await db.audit.findUnique({
      where: { id },
      include: {
        analysisResults: {
          orderBy: { createdAt: 'asc' },
        },
        testResults: {
          include: {
            healingIterations: {
              orderBy: { iteration: 'asc' },
            },
          },
        },
        project: true,
      },
    });

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    res.json(audit);
  } catch (error: any) {
    log.error('Error fetching audit detail', { id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Retry an audit — cleans up existing results first
app.post('/api/audits/:id/retry', async (req, res) => {
  const { id } = req.params;
  try {
    const audit = await db.audit.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    // Clean up existing results and reset status in a transaction
    await db.$transaction([
      db.analysisResult.deleteMany({ where: { auditId: id } }),
      db.testResult.deleteMany({ where: { auditId: id } }),
      db.audit.update({
        where: { id },
        data: {
          status: AuditStatus.PENDING,
          startedAt: null,
          completedAt: null,
        },
      }),
    ]);

    // Extract "owner/repo" from repoUrl
    const repoUrlParts = audit.project.repoUrl.replace(/\/$/, '').split('/');
    const repo = repoUrlParts.slice(-2).join('/');

    // Enqueue task
    await enqueueAuditTask({
      auditId: id,
      repo,
      commitHash: audit.commitHash,
      ref: audit.ref,
    });

    log.info('Audit retry enqueued', { auditId: id, repo });
    res.json({ message: 'Audit retry enqueued', auditId: id });
  } catch (error: any) {
    log.error('Error retrying audit', { id, error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GitHub Webhook Handler
 */
app.post('/webhooks/github', verifySignature, async (req, res) => {
  const event = req.headers['x-github-event'] as string;
  const payload = req.body;

  try {
    if (event === 'pull_request' && (payload.action === 'opened' || payload.action === 'synchronize')) {
      const project = await db.project.findUnique({
        where: { repoUrl: payload.repository.html_url }
      });

      if (project) {
        if (!project.active) {
          log.info('Ignoring PR webhook: Project is inactive', { repoUrl: project.repoUrl });
          return res.status(200).send('Project inactive');
        }
        if (!project.allowPRs) {
          log.info('Ignoring PR webhook: PR audits are disabled for this project', { repoUrl: project.repoUrl });
          return res.status(200).send('PR audits disabled');
        }
        if (project.adminUsers) {
          const allowedUsers = project.adminUsers.split(',').map(u => u.trim()).filter(Boolean);
          const sender = payload.sender?.login;
          if (allowedUsers.length > 0 && !allowedUsers.includes(sender)) {
            log.warn('Ignoring PR webhook: Triggering user not in allowed list', { sender, allowedUsers });
            return res.status(200).send('User not allowed');
          }
        }
      }

      const savedProject = await db.project.upsert({
        where: { repoUrl: payload.repository.html_url },
        update: { name: payload.repository.name },
        create: {
          name: payload.repository.name,
          repoUrl: payload.repository.html_url,
        },
      });

      const audit = await db.audit.create({
        data: {
          projectId: savedProject.id,
          event,
          ref: payload.pull_request.number.toString(),
          commitHash: payload.pull_request.head.sha,
          status: AuditStatus.PENDING,
        },
      });

      await enqueueAuditTask({
        auditId: audit.id,
        repo: payload.repository.full_name,
        prNumber: payload.pull_request.number,
        commitHash: payload.pull_request.head.sha,
      });

      log.info('Enqueued PR audit', { prNumber: payload.pull_request.number, auditId: audit.id });
    } else if (event === 'push') {
      const project = await db.project.findUnique({
        where: { repoUrl: payload.repository.html_url }
      });

      if (project) {
        if (!project.active) {
          log.info('Ignoring push webhook: Project is inactive', { repoUrl: project.repoUrl });
          return res.status(200).send('Project inactive');
        }
        if (!project.allowPush) {
          log.info('Ignoring push webhook: Push audits are disabled for this project', { repoUrl: project.repoUrl });
          return res.status(200).send('Push audits disabled');
        }
        const ref = payload.ref || '';
        const branch = ref.replace('refs/heads/', '');
        if (project.branchFilter && project.branchFilter !== '*') {
          const allowedBranches = project.branchFilter.split(',').map(b => b.trim()).filter(Boolean);
          if (!allowedBranches.includes(branch)) {
            log.info('Ignoring push webhook: Branch not matched in filter list', { branch, allowedBranches });
            return res.status(200).send('Branch not watched');
          }
        }
        if (project.adminUsers) {
          const allowedUsers = project.adminUsers.split(',').map(u => u.trim()).filter(Boolean);
          const sender = payload.sender?.login;
          if (allowedUsers.length > 0 && !allowedUsers.includes(sender)) {
            log.warn('Ignoring push webhook: Triggering user not in allowed list', { sender, allowedUsers });
            return res.status(200).send('User not allowed');
          }
        }
      }

      const savedProject = await db.project.upsert({
        where: { repoUrl: payload.repository.html_url },
        update: { name: payload.repository.name },
        create: {
          name: payload.repository.name,
          repoUrl: payload.repository.html_url,
        },
      });

      const audit = await db.audit.create({
        data: {
          projectId: savedProject.id,
          event,
          ref: payload.ref,
          commitHash: payload.after,
          status: AuditStatus.PENDING,
        },
      });

      await enqueueAuditTask({
        auditId: audit.id,
        repo: payload.repository.full_name,
        commitHash: payload.after,
      });

      log.info('Enqueued push audit', { commitHash: payload.after, auditId: audit.id });
    }

    res.status(202).send('Accepted');
  } catch (error: any) {
    log.error('Error handling webhook', { event, error: error.message });
    res.status(500).send('Internal Server Error');
  }
});

// Graceful shutdown
async function shutdown(signal: string) {
  log.info('Received shutdown signal', { signal });
  httpServer.close(async () => {
    await db.$disconnect();
    log.info('HTTP server closed, DB disconnected');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown fails
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

httpServer.listen(port, async () => {
  log.info('Webhook server & Real-time API started', { port });
  try {
    await syncConfig();
    log.info('Configuration synced successfully on startup');
  } catch (err: any) {
    log.error('Failed to sync config on startup', { error: err.message });
  }
});
