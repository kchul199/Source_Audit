import 'dotenv/config';
import { AuditStatus } from '@prisma/client';
import { db as prisma } from '../src/db';

async function main() {
  console.log('Starting seed script for redesign validation...');

  // 1. Get or create project
  let project = await prisma.project.findFirst();
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: 'platform-api-service',
        repoUrl: 'https://github.com/kchul199/platform-api-service',
        active: true,
        allowPRs: true,
        allowPush: true,
        branchFilter: '*',
        adminUsers: 'kchul199',
        llmModel: 'gpt-4o',
        enablePRComments: true,
        customPromptRules: 'Please strictly enforce ES6 standards and verify API authentication scopes.',
      },
    });
  } else {
    // Update existing project to have the new fields filled
    project = await prisma.project.update({
      where: { id: project.id },
      data: {
        customPromptRules: 'Please strictly enforce ES6 standards and verify API authentication scopes.',
        llmModel: 'gpt-4o',
        enablePRComments: true,
      }
    });
  }

  console.log(`Using Project: ${project.name} (${project.id})`);

  // Clean old seeding items to keep it clean
  await prisma.webhookEvent.deleteMany({});
  
  // 2. Create Webhook Events
  console.log('Inserting Webhook Events...');
  await prisma.webhookEvent.createMany({
    data: [
      {
        projectId: project.id,
        event: 'pull_request',
        repo: 'kchul199/platform-api-service',
        branch: 'main',
        sender: 'kchul199',
        action: 'opened',
        outcome: 'ACCEPTED',
        receivedAt: new Date(Date.now() - 60000 * 5), // 5 mins ago
      },
      {
        projectId: project.id,
        event: 'push',
        repo: 'kchul199/platform-api-service',
        branch: 'feature/experimental',
        sender: 'kchul199',
        action: 'push',
        outcome: 'FILTERED',
        rejectReason: 'Branch not watched',
        receivedAt: new Date(Date.now() - 60000 * 20), // 20 mins ago
      },
      {
        projectId: project.id,
        event: 'pull_request',
        repo: 'kchul199/platform-api-service',
        branch: 'main',
        sender: 'unauthorized-bot',
        action: 'opened',
        outcome: 'REJECTED',
        rejectReason: 'User not allowed',
        receivedAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        projectId: project.id,
        event: 'pull_request',
        repo: 'kchul199/platform-api-service',
        branch: 'main',
        sender: 'kchul199',
        action: 'synchronize',
        outcome: 'ACCEPTED',
        receivedAt: new Date(Date.now() - 7200000), // 2 hours ago
      }
    ]
  });

  // 3. Create Audits
  console.log('Inserting Audits & Findings...');
  
  // Audit #1 (Old Audit)
  const audit1 = await prisma.audit.create({
    data: {
      projectId: project.id,
      event: 'pull_request',
      ref: '41',
      commitHash: 'a7b8c9d0e1f2a7b8c9d0e1f2a7b8c9d0e1f2a7b8',
      status: AuditStatus.COMPLETED,
      createdAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
      completedAt: new Date(Date.now() - 86400000 * 2 + 120000),
    }
  });

  await prisma.analysisResult.createMany({
    data: [
      {
        auditId: audit1.id,
        category: 'SECURITY',
        severity: 'CRITICAL',
        filePath: 'src/auth/jwt.ts',
        lineRange: '15-22',
        description: 'Hardcoded JWT encryption key detected in production code path.',
        suggestion: 'Load JWT secret key using process.env.JWT_SECRET instead.',
      },
      {
        auditId: audit1.id,
        category: 'PERFORMANCE',
        severity: 'HIGH',
        filePath: 'src/db/connection.ts',
        lineRange: '45',
        description: 'Database connection created inside loop, causing connection pool exhaustion.',
        suggestion: 'Create database connection instance globally and reuse it.',
      },
      {
        auditId: audit1.id,
        category: 'MAINTAINABILITY',
        severity: 'MEDIUM',
        filePath: 'src/controllers/user.ts',
        lineRange: '100-140',
        description: 'Large monolithic method handles auth, validation, and db query in one place.',
        suggestion: 'Decompose method into validateUser(), queryUser(), and generateAuthToken().',
      }
    ]
  });

  // Audit #2 (New Audit)
  const audit2 = await prisma.audit.create({
    data: {
      projectId: project.id,
      event: 'pull_request',
      ref: '42',
      commitHash: 'c3f4a1b2c3f4a1b2c3f4a1b2c3f4a1b2c3f4a1b2',
      status: AuditStatus.COMPLETED,
      createdAt: new Date(),
      completedAt: new Date(Date.now() + 150000),
    }
  });

  await prisma.analysisResult.createMany({
    data: [
      // JWT is solved (resolved)
      // Database connection inside loop is solved (resolved)
      // Monarch controller is still here (unchanged)
      {
        auditId: audit2.id,
        category: 'MAINTAINABILITY',
        severity: 'MEDIUM',
        filePath: 'src/controllers/user.ts',
        lineRange: '100-140',
        description: 'Large monolithic method handles auth, validation, and db query in one place.',
        suggestion: 'Decompose method into validateUser(), queryUser(), and generateAuthToken().',
      },
      // New issues introduced
      {
        auditId: audit2.id,
        category: 'SECURITY',
        severity: 'HIGH',
        filePath: 'src/routes/api.ts',
        lineRange: '88',
        description: 'Missing route authorization guard on DELETE /api/users admin endpoint.',
        suggestion: 'Add requireAdmin auth middleware before controller handler.',
      },
      {
        auditId: audit2.id,
        category: 'STABILITY',
        severity: 'HIGH',
        filePath: 'src/utils/file.ts',
        lineRange: '12',
        description: 'Uncaught fs.readFileSync exception could crash the application.',
        suggestion: 'Wrap readFileSync in a try-catch block and handle error gracefully.',
      },
      {
        auditId: audit2.id,
        category: 'ERROR_PRONE',
        severity: 'LOW',
        filePath: 'src/components/UserProfile.js',
        lineRange: '45',
        description: 'Variable referenced before initialization, leading to potential ReferenceError.',
        suggestion: 'Initialize userProfile state variable before utilizing it in rendering.',
      }
    ]
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
