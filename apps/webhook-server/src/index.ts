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
  const {
    name, repoUrl, githubToken, webhookSecret, allowPRs, allowPush,
    adminUsers, branchFilter, active, customPromptRules, llmModel, enablePRComments
  } = req.body;
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
        customPromptRules: customPromptRules || null,
        llmModel: llmModel || 'gpt-4o',
        enablePRComments: enablePRComments !== undefined ? enablePRComments : false,
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
  const {
    name, repoUrl, githubToken, webhookSecret, allowPRs, allowPush,
    adminUsers, branchFilter, active, customPromptRules, llmModel, enablePRComments
  } = req.body;
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
        customPromptRules: customPromptRules !== undefined ? customPromptRules : undefined,
        llmModel: llmModel !== undefined ? llmModel : undefined,
        enablePRComments: enablePRComments !== undefined ? enablePRComments : undefined,
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

// GET /api/audits/compare - Compare two audits
app.get('/api/audits/compare', async (req, res) => {
  const { left, right } = req.query;
  if (!left || !right) {
    return res.status(400).json({ error: 'Both left and right audit IDs are required' });
  }
  try {
    const [auditLeft, auditRight] = await Promise.all([
      db.audit.findUnique({
        where: { id: String(left) },
        include: { analysisResults: true, project: true },
      }),
      db.audit.findUnique({
        where: { id: String(right) },
        include: { analysisResults: true, project: true },
      }),
    ]);

    if (!auditLeft || !auditRight) {
      return res.status(404).json({ error: 'One or both audits not found' });
    }

    const findingsLeft = auditLeft.analysisResults;
    const findingsRight = auditRight.analysisResults;

    const makeKey = (f: any) => `${f.category}:${f.filePath}:${f.description}`;

    const leftKeys = new Set(findingsLeft.map(makeKey));
    const rightKeys = new Set(findingsRight.map(makeKey));

    const resolved = findingsLeft.filter(f => !rightKeys.has(makeKey(f)));
    const added = findingsRight.filter(f => !leftKeys.has(makeKey(f)));
    const unchanged = findingsRight.filter(f => leftKeys.has(makeKey(f)));

    res.json({
      left: {
        id: auditLeft.id,
        ref: auditLeft.ref,
        event: auditLeft.event,
        commitHash: auditLeft.commitHash,
        createdAt: auditLeft.createdAt,
      },
      right: {
        id: auditRight.id,
        ref: auditRight.ref,
        event: auditRight.event,
        commitHash: auditRight.commitHash,
        createdAt: auditRight.createdAt,
      },
      comparison: {
        resolved,
        added,
        unchanged,
        summary: {
          newCount: added.length,
          resolvedCount: resolved.length,
          unchangedCount: unchanged.length,
        },
      },
    });
  } catch (error: any) {
    log.error('Error comparing audits', { error: error.message });
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

// GET /api/webhook-events - List webhook events with pagination
app.get('/api/webhook-events', async (req, res) => {
  const { page = '1', limit = '30' } = req.query;
  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.min(100, Math.max(1, Number(limit)));
  const skip = (pageNum - 1) * limitNum;
  try {
    const [events, total] = await Promise.all([
      db.webhookEvent.findMany({
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limitNum,
      }),
      db.webhookEvent.count(),
    ]);
    res.json({
      data: events,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    log.error('Error fetching webhook events', { error: error.message });
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/stats/trend - Get time-series quality trend data
app.get('/api/stats/trend', async (req, res) => {
  const { projectId, range = '30d' } = req.query;
  try {
    const days = range === '90d' ? 90 : range === '7d' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause: any = {
      createdAt: { gte: startDate },
    };
    if (projectId) {
      whereClause.projectId = String(projectId);
    }

    const audits = await db.audit.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      include: {
        analysisResults: true,
        testResults: true,
      },
    });

    const dailyMap = new Map<string, any>();

    // Initialize dailyMap for all days in the range
    for (let i = 0; i <= days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - i));
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, {
        date: dateStr,
        Security: 0,
        Performance: 0,
        Maintainability: 0,
        Stability: 0,
        Flexibility: 0,
        Extensibility: 0,
        ErrorProne: 0,
        testSuccessRate: 0,
        avgHealingIterations: 0,
        totalAudits: 0,
        totalTests: 0,
        totalPassed: 0,
        totalHealingIterations: 0,
      });
    }

    audits.forEach((audit) => {
      const dateStr = audit.createdAt.toISOString().split('T')[0];
      const entry = dailyMap.get(dateStr);
      if (entry) {
        entry.totalAudits += 1;
        audit.analysisResults.forEach((ar) => {
          // Normalize category keys to match trend chart categories
          const catMap: Record<string, string> = {
            'SECURITY': 'Security',
            'PERFORMANCE': 'Performance',
            'MAINTAINABILITY': 'Maintainability',
            'STABILITY': 'Stability',
            'FLEXIBILITY': 'Flexibility',
            'EXTENSIBILITY': 'Extensibility',
            'ERROR_PRONE': 'ErrorProne',
          };
          const key = catMap[ar.category] || ar.category;
          if (key in entry) {
            entry[key] += 1;
          }
        });

        audit.testResults.forEach((tr) => {
          entry.totalTests += 1;
          if (tr.status === 'PASSED' || tr.status === 'HEALED') {
            entry.totalPassed += 1;
          }
          entry.totalHealingIterations += tr.iterationCount || 0;
        });
      }
    });

    // Compute final rates
    dailyMap.forEach((entry) => {
      if (entry.totalTests > 0) {
        entry.testSuccessRate = Number(((entry.totalPassed / entry.totalTests) * 100).toFixed(1));
        entry.avgHealingIterations = Number((entry.totalHealingIterations / entry.totalTests).toFixed(2));
      } else {
        entry.testSuccessRate = 100.0; // Default when no tests ran
        entry.avgHealingIterations = 0;
      }
      // Remove raw accumulators before sending response
      delete entry.totalTests;
      delete entry.totalPassed;
      delete entry.totalHealingIterations;
    });

    const trendData = Array.from(dailyMap.values());
    res.json(trendData);
  } catch (error: any) {
    log.error('Error fetching trend stats', { error: error.message });
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
const logWebhookEvent = async (params: {
  projectId?: string;
  event: string;
  repo: string;
  branch?: string;
  sender: string;
  action: string;
  outcome: string;
  rejectReason?: string;
  auditId?: string;
}) => {
  try {
    await db.webhookEvent.create({ data: params });
  } catch (err: any) {
    log.error('Failed to log webhook event to DB', { error: err.message });
  }
};

/**
 * GitHub Webhook Handler
 */
app.post('/webhooks/github', verifySignature, async (req, res) => {
  const event = req.headers['x-github-event'] as string;
  const payload = req.body;
  const sender = payload.sender?.login || 'unknown';
  const repo = payload.repository?.full_name || 'unknown';
  const action = payload.action || 'push';

  try {
    if (event === 'ping') {
      await logWebhookEvent({
        event,
        repo,
        sender,
        action,
        outcome: 'ACCEPTED',
      });
      return res.status(200).send('pong');
    }

    if (event === 'pull_request' && (payload.action === 'opened' || payload.action === 'synchronize')) {
      const branch = payload.pull_request?.base?.ref || 'unknown';
      const project = await db.project.findUnique({
        where: { repoUrl: payload.repository.html_url }
      });

      if (project) {
        if (!project.active) {
          log.info('Ignoring PR webhook: Project is inactive', { repoUrl: project.repoUrl });
          await logWebhookEvent({
            projectId: project.id,
            event,
            repo,
            branch,
            sender,
            action,
            outcome: 'REJECTED',
            rejectReason: 'Project inactive',
          });
          return res.status(200).send('Project inactive');
        }
        if (!project.allowPRs) {
          log.info('Ignoring PR webhook: PR audits are disabled for this project', { repoUrl: project.repoUrl });
          await logWebhookEvent({
            projectId: project.id,
            event,
            repo,
            branch,
            sender,
            action,
            outcome: 'REJECTED',
            rejectReason: 'PR audits disabled',
          });
          return res.status(200).send('PR audits disabled');
        }
        if (project.adminUsers) {
          const allowedUsers = project.adminUsers.split(',').map(u => u.trim()).filter(Boolean);
          if (allowedUsers.length > 0 && !allowedUsers.includes(sender)) {
            log.warn('Ignoring PR webhook: Triggering user not in allowed list', { sender, allowedUsers });
            await logWebhookEvent({
              projectId: project.id,
              event,
              repo,
              branch,
              sender,
              action,
              outcome: 'REJECTED',
              rejectReason: 'User not allowed',
            });
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

      await logWebhookEvent({
        projectId: savedProject.id,
        event,
        repo,
        branch,
        sender,
        action,
        outcome: 'ACCEPTED',
        auditId: audit.id,
      });

      log.info('Enqueued PR audit', { prNumber: payload.pull_request.number, auditId: audit.id });
      return res.status(202).send('Accepted');
    } else if (event === 'push') {
      const ref = payload.ref || '';
      const branch = ref.replace('refs/heads/', '');
      const project = await db.project.findUnique({
        where: { repoUrl: payload.repository.html_url }
      });

      if (project) {
        if (!project.active) {
          log.info('Ignoring push webhook: Project is inactive', { repoUrl: project.repoUrl });
          await logWebhookEvent({
            projectId: project.id,
            event,
            repo,
            branch,
            sender,
            action,
            outcome: 'REJECTED',
            rejectReason: 'Project inactive',
          });
          return res.status(200).send('Project inactive');
        }
        if (!project.allowPush) {
          log.info('Ignoring push webhook: Push audits are disabled for this project', { repoUrl: project.repoUrl });
          await logWebhookEvent({
            projectId: project.id,
            event,
            repo,
            branch,
            sender,
            action,
            outcome: 'REJECTED',
            rejectReason: 'Push audits disabled',
          });
          return res.status(200).send('Push audits disabled');
        }
        if (project.branchFilter && project.branchFilter !== '*') {
          const allowedBranches = project.branchFilter.split(',').map(b => b.trim()).filter(Boolean);
          if (!allowedBranches.includes(branch)) {
            log.info('Ignoring push webhook: Branch not matched in filter list', { branch, allowedBranches });
            await logWebhookEvent({
              projectId: project.id,
              event,
              repo,
              branch,
              sender,
              action,
              outcome: 'FILTERED',
              rejectReason: 'Branch not watched',
            });
            return res.status(200).send('Branch not watched');
          }
        }
        if (project.adminUsers) {
          const allowedUsers = project.adminUsers.split(',').map(u => u.trim()).filter(Boolean);
          if (allowedUsers.length > 0 && !allowedUsers.includes(sender)) {
            log.warn('Ignoring push webhook: Triggering user not in allowed list', { sender, allowedUsers });
            await logWebhookEvent({
              projectId: project.id,
              event,
              repo,
              branch,
              sender,
              action,
              outcome: 'REJECTED',
              rejectReason: 'User not allowed',
            });
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

      await logWebhookEvent({
        projectId: savedProject.id,
        event,
        repo,
        branch,
        sender,
        action,
        outcome: 'ACCEPTED',
        auditId: audit.id,
      });

      log.info('Enqueued push audit', { commitHash: payload.after, auditId: audit.id });
      return res.status(202).send('Accepted');
    }

    // Unhandled event types
    await logWebhookEvent({
      event,
      repo,
      sender,
      action,
      outcome: 'FILTERED',
      rejectReason: 'Unhandled event type',
    });
    res.status(202).send('Ignored');
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
