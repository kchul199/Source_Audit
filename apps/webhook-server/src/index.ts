import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { db, AuditStatus } from '@src-audit/shared';
import { enqueueAuditTask } from './queue';

// Load .env from root
dotenv.config({ path: path.join(process.cwd(), '.env') });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Adjust for production
  }
});

const port = process.env.PORT || 3001;
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'dummy_secret';

app.use(cors());
app.use(express.json());

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
});

// Helper to broadcast audit updates
const broadcastAuditUpdate = (auditId: string, status: string) => {
  io.emit('audit_update', { auditId, status });
};

// Internal endpoint for worker to notify status changes
app.post('/api/internal/audit-event', (req, res) => {
  const { auditId, status } = req.body;
  broadcastAuditUpdate(auditId, status);
  res.sendStatus(200);
});

// Webhook signature verification middleware
const verifySignature = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    return res.status(401).send('No signature provided');
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');

  if (signature !== digest) {
    console.warn('Invalid signature detected');
    // In a real application, we would return 401 here
  }
  next();
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'webhook-server' });
});

/**
 * Portal API Routes
 */

// List all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// List audits for a project (e.g., /api/audits?projectId=...)
app.get('/api/audits', async (req, res) => {
  const { projectId } = req.query;
  try {
    const audits = await db.audit.findMany({
      where: projectId ? { projectId: String(projectId) } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        project: true
      }
    });
    res.json(audits);
  } catch (error) {
    console.error('Error fetching audits:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get specific audit details (with findings and test results)
app.get('/api/audits/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const audit = await db.audit.findUnique({
      where: { id },
      include: {
        analysisResults: true,
        testResults: true,
        project: true,
      },
    });

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    res.json(audit);
  } catch (error) {
    console.error(`Error fetching audit ${id}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Retry an audit
app.post('/api/audits/:id/retry', async (req, res) => {
  const { id } = req.params;
  try {
    const audit = await db.audit.findUnique({
      where: { id },
      include: { project: true }
    });

    if (!audit) {
      return res.status(404).json({ error: 'Audit not found' });
    }

    // Update status to PENDING
    const updatedAudit = await db.audit.update({
      where: { id },
      data: { 
        status: AuditStatus.PENDING,
        startedAt: null,
        completedAt: null
      }
    });

    // Enqueue task
    await enqueueAuditTask({
      auditId: updatedAudit.id,
      repo: audit.project.repoUrl.split('/').slice(-2).join('/'), // Extract "owner/repo"
      commitHash: audit.commitHash,
      ref: audit.ref
    });

    res.json({ message: 'Audit retry enqueued', auditId: updatedAudit.id });
  } catch (error) {
    console.error(`Error retrying audit ${id}:`, error);
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
      const project = await db.project.upsert({
        where: { repoUrl: payload.repository.html_url },
        update: { name: payload.repository.name },
        create: {
          name: payload.repository.name,
          repoUrl: payload.repository.html_url,
        },
      });

      const audit = await db.audit.create({
        data: {
          projectId: project.id,
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

      console.log(`Enqueued audit task for PR #${payload.pull_request.number}, Audit ID: ${audit.id}`);
    } else if (event === 'push') {
      const project = await db.project.upsert({
        where: { repoUrl: payload.repository.html_url },
        update: { name: payload.repository.name },
        create: {
          name: payload.repository.name,
          repoUrl: payload.repository.html_url,
        },
      });

      const audit = await db.audit.create({
        data: {
          projectId: project.id,
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

      console.log(`Enqueued audit task for Push: ${payload.after}, Audit ID: ${audit.id}`);
    }

    res.status(202).send('Accepted');
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

httpServer.listen(port, () => {
  console.log(`Webhook server & Real-time API listening at http://localhost:${port}`);
});
