import 'dotenv/config';
import { AuditStatus, TestStatus } from '@prisma/client';
import { db as prisma } from '../src/db';

/**
 * Comprehensive Seed Script
 * ─────────────────────────
 * 포탈의 모든 기능을 다양한 케이스로 시연하기 위한 풍부한 목 데이터 생성
 * 모든 분석 결과에 실제 소스코드 스니펫 포함
 */

const NOW = Date.now();
const HOUR = 3600_000;
const DAY = 86_400_000;

function ago(ms: number): Date {
  return new Date(NOW - ms);
}

function randomHash(): string {
  const chars = '0123456789abcdef';
  return Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

async function main() {
  console.log('🚀 Starting comprehensive seed...\n');

  // ═══════════════════════════════════════════════════════════════════
  //  1. 기존 데이터 정리
  // ═══════════════════════════════════════════════════════════════════
  console.log('🧹 Cleaning existing data...');
  await prisma.healingIteration.deleteMany({});
  await prisma.testResult.deleteMany({});
  await prisma.analysisResult.deleteMany({});
  await prisma.audit.deleteMany({});
  await prisma.webhookEvent.deleteMany({});
  await prisma.project.deleteMany({});
  console.log('   ✓ All tables cleaned\n');

  // ═══════════════════════════════════════════════════════════════════
  //  2. 프로젝트 5개 생성
  // ═══════════════════════════════════════════════════════════════════
  console.log('📦 Creating projects...');

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        name: 'platform-api-service',
        repoUrl: 'https://github.com/acme-corp/platform-api-service',
        githubToken: 'ghp_prod_token_abc123def456ghi789jkl012mno345',
        webhookSecret: 'whsec_platform_prod_secret_2026',
        allowPRs: true, allowPush: true,
        adminUsers: 'kchul199,senior-dev,team-lead',
        branchFilter: 'main,develop,release/*',
        active: true, llmModel: 'gpt-4o', enablePRComments: true,
        customPromptRules: '보안 취약점은 반드시 CRITICAL로 보고하세요. ES6+ 표준을 엄격히 적용하세요.',
        createdAt: ago(30 * DAY),
      },
    }),
    prisma.project.create({
      data: {
        name: 'web-dashboard-app',
        repoUrl: 'https://github.com/acme-corp/web-dashboard-app',
        githubToken: 'ghp_frontend_token_xyz789abc012def345ghi678',
        webhookSecret: 'whsec_dashboard_secret_2026',
        allowPRs: true, allowPush: false,
        adminUsers: 'kchul199,frontend-lead',
        branchFilter: 'main',
        active: true, llmModel: 'gpt-4o-mini', enablePRComments: false,
        customPromptRules: 'React 컴포넌트의 접근성(a11y)과 성능 최적화에 중점을 두세요.',
        createdAt: ago(20 * DAY),
      },
    }),
    prisma.project.create({
      data: {
        name: 'payment-gateway-ms',
        repoUrl: 'https://github.com/acme-corp/payment-gateway-ms',
        githubToken: 'ghp_payment_token_mno345pqr678stu901vwx234',
        webhookSecret: 'whsec_payment_secure_2026',
        allowPRs: false, allowPush: true,
        adminUsers: 'kchul199,security-officer',
        branchFilter: 'main',
        active: true, llmModel: 'o1-pro', enablePRComments: true,
        customPromptRules: 'PCI-DSS 규정 준수 여부를 반드시 확인하세요.',
        createdAt: ago(15 * DAY),
      },
    }),
    prisma.project.create({
      data: {
        name: 'mobile-bff-service',
        repoUrl: 'https://github.com/acme-corp/mobile-bff-service',
        githubToken: 'ghp_mobile_token_abc111def222ghi333jkl444',
        webhookSecret: 'whsec_mobile_secret_2026',
        allowPRs: true, allowPush: true,
        adminUsers: 'kchul199',
        branchFilter: '*',
        active: false, llmModel: 'gpt-4o', enablePRComments: false,
        customPromptRules: null,
        createdAt: ago(10 * DAY),
      },
    }),
    prisma.project.create({
      data: {
        name: 'data-pipeline-etl',
        repoUrl: 'https://github.com/acme-corp/data-pipeline-etl',
        githubToken: 'ghp_data_token_zzz999yyy888xxx777www666',
        webhookSecret: 'whsec_pipeline_secret_2026',
        allowPRs: true, allowPush: true,
        adminUsers: '',
        branchFilter: '*',
        active: true, llmModel: 'claude-sonnet-4', enablePRComments: true,
        customPromptRules: 'Python PEP8 준수 여부, 메모리 누수, 대용량 데이터 처리 효율성에 중점.',
        createdAt: ago(5 * DAY),
      },
    }),
  ]);

  const [platformApi, webDashboard, paymentGw, mobileBff, dataPipeline] = projects;
  console.log(`   ✓ ${projects.length} projects created\n`);

  // ═══════════════════════════════════════════════════════════════════
  //  3. 감사(Audit) 생성
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔍 Creating audits...');

  const platformAudits = await Promise.all([
    prisma.audit.create({ data: { projectId: platformApi.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(28 * DAY), completedAt: ago(28 * DAY - 180_000), createdAt: ago(28 * DAY) } }),
    prisma.audit.create({ data: { projectId: platformApi.id, event: 'pull_request', ref: '12', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(21 * DAY), completedAt: ago(21 * DAY - 200_000), createdAt: ago(21 * DAY) } }),
    prisma.audit.create({ data: { projectId: platformApi.id, event: 'push', ref: 'develop', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(14 * DAY), completedAt: ago(14 * DAY - 150_000), createdAt: ago(14 * DAY) } }),
    prisma.audit.create({ data: { projectId: platformApi.id, event: 'pull_request', ref: '25', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(7 * DAY), completedAt: ago(7 * DAY - 120_000), createdAt: ago(7 * DAY) } }),
    prisma.audit.create({ data: { projectId: platformApi.id, event: 'pull_request', ref: '30', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(3 * DAY), completedAt: ago(3 * DAY - 90_000), createdAt: ago(3 * DAY) } }),
    prisma.audit.create({ data: { projectId: platformApi.id, event: 'pull_request', ref: '35', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(1 * DAY), completedAt: ago(1 * DAY - 100_000), createdAt: ago(1 * DAY) } }),
    prisma.audit.create({ data: { projectId: platformApi.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.ANALYZING, startedAt: ago(2 * HOUR), createdAt: ago(2 * HOUR) } }),
    prisma.audit.create({ data: { projectId: platformApi.id, event: 'pull_request', ref: '38', commitHash: randomHash(), status: AuditStatus.PENDING, createdAt: ago(30 * 60_000) } }),
  ]);

  const dashboardAudits = await Promise.all([
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '8', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(18 * DAY), completedAt: ago(18 * DAY - 100_000), createdAt: ago(18 * DAY) } }),
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '15', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(10 * DAY), completedAt: ago(10 * DAY - 130_000), createdAt: ago(10 * DAY) } }),
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '22', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(4 * DAY), completedAt: ago(4 * DAY - 80_000), createdAt: ago(4 * DAY) } }),
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '28', commitHash: randomHash(), status: AuditStatus.FAILED, startedAt: ago(2 * DAY), createdAt: ago(2 * DAY) } }),
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '31', commitHash: randomHash(), status: AuditStatus.GENERATING_TESTS, startedAt: ago(4 * HOUR), createdAt: ago(4 * HOUR) } }),
  ]);

  const paymentAudits = await Promise.all([
    prisma.audit.create({ data: { projectId: paymentGw.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(12 * DAY), completedAt: ago(12 * DAY - 250_000), createdAt: ago(12 * DAY) } }),
    prisma.audit.create({ data: { projectId: paymentGw.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(6 * DAY), completedAt: ago(6 * DAY - 300_000), createdAt: ago(6 * DAY) } }),
    prisma.audit.create({ data: { projectId: paymentGw.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(1 * DAY), completedAt: ago(1 * DAY - 200_000), createdAt: ago(1 * DAY) } }),
    prisma.audit.create({ data: { projectId: paymentGw.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.EXECUTING_SANDBOX, startedAt: ago(1 * HOUR), createdAt: ago(1 * HOUR) } }),
  ]);

  const pipelineAudits = await Promise.all([
    prisma.audit.create({ data: { projectId: dataPipeline.id, event: 'pull_request', ref: '5', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(4 * DAY), completedAt: ago(4 * DAY - 200_000), createdAt: ago(4 * DAY) } }),
    prisma.audit.create({ data: { projectId: dataPipeline.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(2 * DAY), completedAt: ago(2 * DAY - 180_000), createdAt: ago(2 * DAY) } }),
    prisma.audit.create({ data: { projectId: dataPipeline.id, event: 'pull_request', ref: '9', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(12 * HOUR), completedAt: ago(12 * HOUR - 160_000), createdAt: ago(12 * HOUR) } }),
  ]);

  const allAudits = [...platformAudits, ...dashboardAudits, ...paymentAudits, ...pipelineAudits];
  console.log(`   ✓ ${allAudits.length} audits created\n`);

  // ═══════════════════════════════════════════════════════════════════
  //  4. 분석 결과 — 모든 항목에 sourceSnippet 포함
  // ═══════════════════════════════════════════════════════════════════
  console.log('📊 Creating analysis results with source snippets...');

  const findings: Array<{
    auditId: string;
    category: string;
    severity: string;
    filePath: string;
    lineRange: string;
    description: string;
    suggestion: string;
    sourceSnippet: string;
  }> = [];

  // ── Platform API 감사 #1 (28일 전) — 초기 코드, 문제 많음 ──
  const pa1 = platformAudits[0].id;
  findings.push(
    {
      auditId: pa1, category: 'SECURITY', severity: 'CRITICAL',
      filePath: 'src/auth/jwt.ts', lineRange: '15-22',
      description: '하드코딩된 JWT 비밀키가 프로덕션 코드에 존재합니다.',
      suggestion: 'process.env.JWT_SECRET를 사용하여 환경 변수에서 로드하세요.',
      sourceSnippet: `// src/auth/jwt.ts:15-22
const JWT_SECRET = 'my-super-secret-key-do-not-share';  // ⚠️ 하드코딩

export function signToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h',
    algorithm: 'HS256',
  });
}`,
    },
    {
      auditId: pa1, category: 'SECURITY', severity: 'HIGH',
      filePath: 'src/middleware/cors.ts', lineRange: '8',
      description: 'CORS origin이 와일드카드(*)로 설정되어 모든 도메인의 요청을 허용합니다.',
      suggestion: '허용 도메인 화이트리스트를 설정하세요.',
      sourceSnippet: `// src/middleware/cors.ts:5-12
import cors from 'cors';

const corsOptions = {
  origin: '*',  // ⚠️ 모든 도메인 허용
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
};

app.use(cors(corsOptions));`,
    },
    {
      auditId: pa1, category: 'PERFORMANCE', severity: 'HIGH',
      filePath: 'src/db/connection.ts', lineRange: '45',
      description: '루프 내에서 데이터베이스 커넥션이 반복 생성되어 커넥션 풀이 고갈됩니다.',
      suggestion: '전역 커넥션 인스턴스를 생성하고 재사용하세요.',
      sourceSnippet: `// src/db/connection.ts:40-52
async function processUsers(userIds: string[]) {
  const results = [];
  for (const userId of userIds) {
    // ⚠️ 루프마다 새 커넥션 생성
    const db = new PrismaClient();
    const user = await db.user.findUnique({
      where: { id: userId },
    });
    results.push(user);
    await db.$disconnect();
  }
  return results;
}`,
    },
    {
      auditId: pa1, category: 'PERFORMANCE', severity: 'MEDIUM',
      filePath: 'src/services/user.ts', lineRange: '78-95',
      description: 'N+1 쿼리 패턴이 감지되었습니다. 사용자 목록 조회 시 개별 관계 로딩.',
      suggestion: 'Prisma의 include 옵션이나 JOIN 쿼리를 사용하세요.',
      sourceSnippet: `// src/services/user.ts:78-95
async function getUsersWithPosts() {
  const users = await prisma.user.findMany();

  // ⚠️ N+1 쿼리: 사용자 수만큼 추가 쿼리 발생
  for (const user of users) {
    user.posts = await prisma.post.findMany({
      where: { authorId: user.id },
    });
    user.profile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });
  }

  return users;
}`,
    },
    {
      auditId: pa1, category: 'MAINTAINABILITY', severity: 'MEDIUM',
      filePath: 'src/controllers/user.ts', lineRange: '100-210',
      description: '단일 메서드에서 인증, 검증, DB 쿼리를 모두 처리합니다 (110줄).',
      suggestion: 'validateUser(), queryUser(), generateAuthToken()으로 분리하세요.',
      sourceSnippet: `// src/controllers/user.ts:100-120 (전체 110줄 중 일부)
export async function handleUserLogin(req: Request, res: Response) {
  // 1. 입력 검증 (15줄)
  const { email, password } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password too short' });
  }
  // ... 추가 검증 로직 20줄 ...

  // 2. DB 쿼리 (20줄)
  const user = await prisma.user.findUnique({ where: { email } });
  // ... 비밀번호 해싱, 비교, 세션 생성 등 40줄 ...

  // 3. 토큰 생성 (15줄)
  const token = jwt.sign({ userId: user.id }, SECRET);
  // ... 쿠키 설정, 응답 포맷팅 등 20줄 ...
}`,
    },
    {
      auditId: pa1, category: 'STABILITY', severity: 'HIGH',
      filePath: 'src/utils/file.ts', lineRange: '12-18',
      description: 'fs.readFileSync 예외가 처리되지 않아 애플리케이션이 크래시될 수 있습니다.',
      suggestion: 'try-catch 블록으로 감싸고 적절한 에러 핸들링을 추가하세요.',
      sourceSnippet: `// src/utils/file.ts:12-18
export function loadConfig(filePath: string): AppConfig {
  // ⚠️ 파일이 없으면 ENOENT 에러로 프로세스 크래시
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return parsed as AppConfig;
}`,
    },
    {
      auditId: pa1, category: 'FLEXIBILITY', severity: 'MEDIUM',
      filePath: 'src/config/constants.ts', lineRange: '1-50',
      description: '데이터베이스 URL, API 키, 포트 번호 등이 하드코딩되어 있습니다.',
      suggestion: '환경 변수와 설정 파일을 통한 외부화를 적용하세요.',
      sourceSnippet: `// src/config/constants.ts:1-15
export const DB_HOST = 'postgres-prod.internal.acme.io';
export const DB_PORT = 5432;
export const DB_NAME = 'acme_production';
export const DB_USER = 'admin';
export const DB_PASS = 'Pr0d_P@ssw0rd!';  // ⚠️ 하드코딩

export const REDIS_URL = 'redis://cache-prod:6379';
export const API_RATE_LIMIT = 1000;
export const SERVER_PORT = 3000;
export const LOG_LEVEL = 'info';

export const EXTERNAL_API_KEY = 'mock_sk_live_abc123xyz789';  // ⚠️ API 키 하드코딩`,
    },
    {
      auditId: pa1, category: 'EXTENSIBILITY', severity: 'LOW',
      filePath: 'src/routes/index.ts', lineRange: '20-80',
      description: '모든 라우트가 단일 파일에 집중되어 있어 새 기능 추가 시 충돌 위험.',
      suggestion: '도메인별 라우터 모듈로 분리하세요 (예: userRoutes, authRoutes).',
      sourceSnippet: `// src/routes/index.ts:20-45 (전체 80줄 중 일부)
const router = express.Router();

// ⚠️ 모든 라우트가 한 파일에 집중
router.get('/users', userController.getAll);
router.get('/users/:id', userController.getById);
router.post('/users', userController.create);
router.put('/users/:id', userController.update);
router.delete('/users/:id', userController.delete);

router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);
router.post('/auth/refresh', authController.refresh);

router.get('/products', productController.getAll);
router.post('/products', productController.create);
// ... 30줄 더 ...`,
    },
    {
      auditId: pa1, category: 'ERROR_PRONE', severity: 'HIGH',
      filePath: 'src/services/payment.ts', lineRange: '33',
      description: 'nullable 객체에 대한 체이닝 접근이 TypeError를 유발할 수 있습니다.',
      suggestion: 'Optional chaining(?.)과 nullish coalescing(??)을 사용하세요.',
      sourceSnippet: `// src/services/payment.ts:28-38
async function getPaymentDetails(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  // ⚠️ order가 null일 때 TypeError 발생
  const amount = order.payment.amount;
  const currency = order.payment.currency;
  const customerName = order.customer.name;

  return { amount, currency, customerName };
}`,
    },
  );

  // ── Platform API 감사 #2 (21일 전) — 일부 수정됨 ──
  const pa2 = platformAudits[1].id;
  findings.push(
    {
      auditId: pa2, category: 'SECURITY', severity: 'HIGH',
      filePath: 'src/middleware/cors.ts', lineRange: '8',
      description: 'CORS origin이 와일드카드(*)로 설정되어 모든 도메인의 요청을 허용합니다.',
      suggestion: '허용 도메인 화이트리스트를 설정하세요.',
      sourceSnippet: `// src/middleware/cors.ts:5-12
const corsOptions = {
  origin: '*',  // ⚠️ 여전히 와일드카드
  credentials: true,
};`,
    },
    {
      auditId: pa2, category: 'PERFORMANCE', severity: 'MEDIUM',
      filePath: 'src/services/user.ts', lineRange: '78-95',
      description: 'N+1 쿼리 패턴이 감지되었습니다.',
      suggestion: 'Prisma의 include 옵션을 사용하세요.',
      sourceSnippet: `// src/services/user.ts:78-88
const users = await prisma.user.findMany();
// ⚠️ 여전히 N+1 패턴
for (const user of users) {
  user.posts = await prisma.post.findMany({
    where: { authorId: user.id },
  });
}`,
    },
    {
      auditId: pa2, category: 'MAINTAINABILITY', severity: 'MEDIUM',
      filePath: 'src/controllers/user.ts', lineRange: '100-210',
      description: '단일 메서드가 여전히 110줄로 과대합니다.',
      suggestion: '메서드를 분리하세요.',
      sourceSnippet: `// src/controllers/user.ts:100 (함수 시그니처)
// ⚠️ 여전히 110줄의 단일 함수
export async function handleUserLogin(req: Request, res: Response) {
  // 입력 검증 → DB 조회 → 토큰 생성 → 응답 전부 한 함수에
  // ... 110 lines of code ...
}`,
    },
    {
      auditId: pa2, category: 'STABILITY', severity: 'MEDIUM',
      filePath: 'src/utils/file.ts', lineRange: '12-18',
      description: 'try-catch가 추가되었으나 에러 로깅이 누락되어 디버깅이 어렵습니다.',
      suggestion: 'catch 블록에 structured logging을 추가하세요.',
      sourceSnippet: `// src/utils/file.ts:12-22
export function loadConfig(filePath: string): AppConfig {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as AppConfig;
  } catch (err) {
    // ⚠️ 에러를 삼키고 기본값 반환 — 디버깅 불가
    return {} as AppConfig;
  }
}`,
    },
    {
      auditId: pa2, category: 'FLEXIBILITY', severity: 'MEDIUM',
      filePath: 'src/config/constants.ts', lineRange: '1-50',
      description: '하드코딩된 설정값이 일부 남아있습니다.',
      suggestion: '환경 변수로 완전 이전하세요.',
      sourceSnippet: `// src/config/constants.ts:1-8
export const DB_HOST = process.env.DB_HOST || 'localhost';
export const DB_PORT = 5432;  // ⚠️ 여전히 하드코딩
export const REDIS_URL = 'redis://cache-prod:6379';  // ⚠️ 하드코딩
export const API_RATE_LIMIT = 1000;  // ⚠️ 하드코딩`,
    },
    {
      auditId: pa2, category: 'ERROR_PRONE', severity: 'MEDIUM',
      filePath: 'src/services/payment.ts', lineRange: '33-45',
      description: '비동기 에러가 상위로 전파되지 않습니다.',
      suggestion: 'async/await에 try-catch를 적용하세요.',
      sourceSnippet: `// src/services/payment.ts:33-45
async function processRefund(paymentId: string) {
  // ⚠️ Promise rejection이 처리되지 않음
  const payment = await fetchPayment(paymentId);
  const result = await gateway.refund(payment.transactionId);
  await updatePaymentStatus(paymentId, 'REFUNDED');
  // gateway.refund()가 실패하면 상태는 업데이트되지 않지만
  // 에러가 캐치되지 않아 500 응답으로 전파됨
}`,
    },
  );

  // ── Platform API 감사 #3 (14일 전) — 상당 부분 개선 ──
  const pa3 = platformAudits[2].id;
  findings.push(
    {
      auditId: pa3, category: 'PERFORMANCE', severity: 'LOW',
      filePath: 'src/services/user.ts', lineRange: '78-90',
      description: '일부 쿼리에서 불필요한 SELECT *가 사용되고 있습니다.',
      suggestion: '필요한 컬럼만 명시적으로 선택하세요.',
      sourceSnippet: `// src/services/user.ts:78-85
const users = await prisma.user.findMany({
  include: {
    posts: true,
    profile: true,
    // ⚠️ 전체 관계를 로드 — 불필요한 필드 포함
    settings: true,
    activityLog: true,
  },
});`,
    },
    {
      auditId: pa3, category: 'MAINTAINABILITY', severity: 'LOW',
      filePath: 'src/controllers/user.ts', lineRange: '100-150',
      description: '메서드 분리 후에도 주석이 부족합니다.',
      suggestion: 'JSDoc 주석을 추가하세요.',
      sourceSnippet: `// src/controllers/user.ts:100-115
// ⚠️ 함수 목적, 매개변수, 반환값에 대한 문서가 없음
export async function validateUserInput(req: Request) {
  const { email, password, name } = req.body;
  const errors: string[] = [];
  if (!email) errors.push('Email required');
  if (!password) errors.push('Password required');
  if (password && password.length < 8) errors.push('Password too short');
  return { isValid: errors.length === 0, errors };
}`,
    },
    {
      auditId: pa3, category: 'EXTENSIBILITY', severity: 'MEDIUM',
      filePath: 'src/services/notification.ts', lineRange: '10-30',
      description: '알림 서비스가 이메일에만 한정되어 Slack/SMS 확장이 어렵습니다.',
      suggestion: 'Strategy 패턴을 적용하여 알림 채널을 추상화하세요.',
      sourceSnippet: `// src/services/notification.ts:10-30
export async function sendNotification(userId: string, message: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // ⚠️ 이메일만 지원 — Slack, SMS 추가 시 if/else 지옥
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: 'noreply@acme.io',
    to: user.email,
    subject: 'Notification',
    text: message,
  });
}`,
    },
    {
      auditId: pa3, category: 'SECURITY', severity: 'MEDIUM',
      filePath: 'src/routes/api.ts', lineRange: '88',
      description: 'DELETE /api/users 엔드포인트에 관리자 인증 가드가 누락되었습니다.',
      suggestion: 'requireAdmin 미들웨어를 추가하세요.',
      sourceSnippet: `// src/routes/api.ts:85-92
router.get('/api/users', requireAuth, getUsers);
router.post('/api/users', requireAuth, createUser);
router.put('/api/users/:id', requireAuth, updateUser);

// ⚠️ DELETE에 requireAdmin 가드 누락
router.delete('/api/users/:id', requireAuth, deleteUser);
// 일반 인증 사용자도 다른 사용자를 삭제할 수 있음`,
    },
  );

  // ── Platform API 감사 #4 (7일 전) ──
  const pa4 = platformAudits[3].id;
  findings.push(
    {
      auditId: pa4, category: 'MAINTAINABILITY', severity: 'LOW',
      filePath: 'src/utils/date.ts', lineRange: '5-12',
      description: '날짜 포맷 유틸리티에 타임존 처리가 불완전합니다.',
      suggestion: 'dayjs 또는 date-fns의 tz 플러그인을 사용하세요.',
      sourceSnippet: `// src/utils/date.ts:5-12
export function formatDate(date: Date | string): string {
  const d = new Date(date);
  // ⚠️ 타임존 미처리 — 서버/클라이언트 시간대 불일치 가능
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return \`\${year}-\${month}-\${day}\`;
}`,
    },
    {
      auditId: pa4, category: 'EXTENSIBILITY', severity: 'MEDIUM',
      filePath: 'src/services/notification.ts', lineRange: '10-30',
      description: '알림 서비스 Strategy 패턴 적용이 필요합니다.',
      suggestion: 'NotificationProvider 인터페이스를 정의하세요.',
      sourceSnippet: `// src/services/notification.ts:10-25
// ⚠️ 하드코딩된 이메일 전송만 지원
export async function sendNotification(
  userId: string,
  message: string,
  // channel 파라미터가 없어 확장 불가
) {
  const transporter = nodemailer.createTransport({ ... });
  await transporter.sendMail({ to: user.email, text: message });
  // Slack, SMS, Push 등 다른 채널 지원 불가
}`,
    },
  );

  // ── Platform API 감사 #5 (3일 전) ──
  const pa5 = platformAudits[4].id;
  findings.push(
    {
      auditId: pa5, category: 'PERFORMANCE', severity: 'LOW',
      filePath: 'src/middleware/cache.ts', lineRange: '20-35',
      description: '캐시 TTL이 과도하게 길어(24h) 데이터 일관성 문제가 발생할 수 있습니다.',
      suggestion: 'TTL을 5분으로 단축하거나 캐시 무효화 메커니즘을 도입하세요.',
      sourceSnippet: `// src/middleware/cache.ts:20-35
const cacheMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const key = \`cache:\${req.originalUrl}\`;
  const cached = redis.get(key);

  if (cached) {
    return res.json(JSON.parse(cached));
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    // ⚠️ TTL 24시간 — 데이터 변경이 하루 동안 반영 안됨
    redis.setex(key, 86400, JSON.stringify(body));
    return originalJson(body);
  };
  next();
};`,
    },
    {
      auditId: pa5, category: 'SECURITY', severity: 'LOW',
      filePath: 'src/middleware/rateLimit.ts', lineRange: '5',
      description: 'Rate limiting이 분당 1000회로 과도합니다.',
      suggestion: '분당 100회로 조정하고 IP별 제한을 추가하세요.',
      sourceSnippet: `// src/middleware/rateLimit.ts:3-10
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000,      // 1분
  max: 1000,                 // ⚠️ 분당 1000회 — DDoS 방어에 부족
  standardHeaders: true,
  legacyHeaders: false,
});`,
    },
    {
      auditId: pa5, category: 'ERROR_PRONE', severity: 'LOW',
      filePath: 'src/utils/validator.ts', lineRange: '15',
      description: '이메일 검증 정규식이 일부 유효한 이메일을 거부합니다.',
      suggestion: 'RFC 5322 준수 정규식으로 업데이트하거나 validator.js를 사용하세요.',
      sourceSnippet: `// src/utils/validator.ts:12-20
export function isValidEmail(email: string): boolean {
  // ⚠️ 단순 정규식 — "user+tag@domain.co.kr" 등을 거부
  const regex = /^[a-zA-Z0-9]+@[a-zA-Z0-9]+\\.[a-zA-Z]{2,3}$/;
  return regex.test(email);
}

// 거부되는 유효한 이메일 예시:
// - user+tag@gmail.com (+ 기호)
// - user@sub.domain.co.kr (서브도메인, 4자 TLD)`,
    },
  );

  // ── Platform API 감사 #6 (1일 전) ──
  const pa6 = platformAudits[5].id;
  findings.push(
    {
      auditId: pa6, category: 'STABILITY', severity: 'MEDIUM',
      filePath: 'src/workers/queue.ts', lineRange: '45-60',
      description: 'BullMQ 워커에서 graceful shutdown이 구현되지 않았습니다.',
      suggestion: 'SIGTERM 핸들러를 추가하고 현재 작업 완료를 대기하세요.',
      sourceSnippet: `// src/workers/queue.ts:45-60
const worker = new Worker('audit-queue', async (job) => {
  await processAuditJob(job.data);
}, { connection: redisConfig });

worker.on('completed', (job) => {
  console.log(\`Job \${job.id} completed\`);
});

worker.on('failed', (job, err) => {
  console.error(\`Job \${job?.id} failed:\`, err);
});

// ⚠️ SIGTERM/SIGINT 핸들러 없음
// 프로세스 종료 시 진행 중인 작업이 갑자기 중단됨`,
    },
    {
      auditId: pa6, category: 'FLEXIBILITY', severity: 'LOW',
      filePath: 'src/config/features.ts', lineRange: '1-15',
      description: '기능 플래그가 코드에 하드코딩되어 런타임 변경이 불가능합니다.',
      suggestion: 'Feature flag 서비스를 도입하거나 DB 기반 플래그를 사용하세요.',
      sourceSnippet: `// src/config/features.ts:1-15
// ⚠️ 기능 플래그 하드코딩 — 변경 시 재배포 필요
export const FEATURES = {
  enableBetaFeatures: false,
  enableNewDashboard: true,
  enableAIAnalysis: true,
  maxConcurrentAudits: 5,
  enableSlackNotifications: false,  // 활성화하려면 코드 변경 + 배포 필요
  enableWebhookRetry: true,
} as const;`,
    },
  );

  // ── Web Dashboard 감사들 ──
  const da1 = dashboardAudits[0].id;
  findings.push(
    {
      auditId: da1, category: 'PERFORMANCE', severity: 'HIGH',
      filePath: 'src/components/DataTable.tsx', lineRange: '25-80',
      description: '10,000행의 테이블이 가상화 없이 DOM에 전체 렌더링됩니다.',
      suggestion: 'react-virtualized 또는 @tanstack/react-virtual을 적용하세요.',
      sourceSnippet: `// src/components/DataTable.tsx:25-45
export function DataTable({ rows }: { rows: DataRow[] }) {
  return (
    <table className="data-table">
      <tbody>
        {/* ⚠️ 10,000행 전체 렌더링 — DOM 노드 폭발 */}
        {rows.map((row, idx) => (
          <tr key={idx}>
            <td>{row.id}</td>
            <td>{row.name}</td>
            <td>{row.email}</td>
            <td>{row.status}</td>
            <td>{row.createdAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}`,
    },
    {
      auditId: da1, category: 'SECURITY', severity: 'MEDIUM',
      filePath: 'src/utils/sanitize.ts', lineRange: '10',
      description: 'dangerouslySetInnerHTML에 XSS 방어가 없습니다.',
      suggestion: 'DOMPurify를 적용하여 입력을 sanitize하세요.',
      sourceSnippet: `// src/utils/sanitize.ts:8-15
export function RichTextRenderer({ html }: { html: string }) {
  // ⚠️ 사용자 입력을 sanitize 없이 직접 렌더링
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
  // <script>alert('XSS')</script> 가 실행될 수 있음
}`,
    },
    {
      auditId: da1, category: 'MAINTAINABILITY', severity: 'HIGH',
      filePath: 'src/pages/Dashboard.tsx', lineRange: '1-350',
      description: '대시보드 컴포넌트가 350줄로 과대합니다.',
      suggestion: 'StatCard, ChartPanel 등 서브 컴포넌트로 분리하세요.',
      sourceSnippet: `// src/pages/Dashboard.tsx:1-25 (전체 350줄)
export function Dashboard() {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  // ... 15개 이상의 state 선언 ...

  useEffect(() => { /* 50줄의 데이터 페칭 */ }, []);
  useEffect(() => { /* 30줄의 차트 업데이트 */ }, [stats]);
  useEffect(() => { /* 20줄의 실시간 구독 */ }, []);

  // ⚠️ 350줄의 단일 컴포넌트 — 분리 필요
  return (
    <div>
      {/* 통계 카드 80줄 */}
      {/* 차트 영역 100줄 */}
      {/* 사용자 테이블 70줄 */}
      {/* 알림 패널 50줄 */}
    </div>
  );
}`,
    },
    {
      auditId: da1, category: 'ERROR_PRONE', severity: 'MEDIUM',
      filePath: 'src/hooks/useAuth.ts', lineRange: '15-20',
      description: '토큰 만료 시 자동 갱신 로직이 없어 사용자가 갑자기 로그아웃됩니다.',
      suggestion: 'Refresh token 로직과 interceptor를 추가하세요.',
      sourceSnippet: `// src/hooks/useAuth.ts:15-28
export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const fetchWithAuth = async (url: string) => {
    // ⚠️ 토큰 만료 체크 없이 바로 요청
    const res = await fetch(url, {
      headers: { Authorization: \`Bearer \${token}\` },
    });
    if (res.status === 401) {
      // 토큰 갱신 없이 즉시 로그아웃
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return res;
  };
}`,
    },
  );

  const da2 = dashboardAudits[1].id;
  findings.push(
    {
      auditId: da2, category: 'PERFORMANCE', severity: 'MEDIUM',
      filePath: 'src/components/DataTable.tsx', lineRange: '25-40',
      description: '가상화가 적용되었으나 행 높이가 고정되지 않아 스크롤 점프가 발생합니다.',
      suggestion: '동적 행 높이 측정을 적용하거나 고정 높이를 사용하세요.',
      sourceSnippet: `// src/components/DataTable.tsx:25-40
const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  // ⚠️ estimateSize가 고정값이나 실제 행 높이는 가변
  estimateSize: () => 50,
  // overscan을 0으로 설정하면 빠른 스크롤 시 빈 영역 노출
  overscan: 0,
});`,
    },
    {
      auditId: da2, category: 'MAINTAINABILITY', severity: 'MEDIUM',
      filePath: 'src/pages/Dashboard.tsx', lineRange: '1-200',
      description: '컴포넌트 분리 후에도 상태 관리가 복잡합니다.',
      suggestion: 'Zustand 또는 Jotai를 사용한 상태 관리를 고려하세요.',
      sourceSnippet: `// src/pages/Dashboard.tsx:1-20
export function Dashboard() {
  // ⚠️ 12개의 useState — prop drilling 심화
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('7d');
  const [chartType, setChartType] = useState('bar');
  const [filterCategory, setFilterCategory] = useState('all');
  // ... 6개 더 ...
}`,
    },
    {
      auditId: da2, category: 'FLEXIBILITY', severity: 'HIGH',
      filePath: 'src/theme/colors.ts', lineRange: '1-30',
      description: '색상 값이 컴포넌트 내에 직접 지정되어 테마 전환이 불가능합니다.',
      suggestion: 'CSS 변수 또는 theme provider를 사용하세요.',
      sourceSnippet: `// src/theme/colors.ts:1-15
// ⚠️ 하드코딩 색상 — 다크모드 전환 불가
export const COLORS = {
  primary: '#3b82f6',
  secondary: '#64748b',
  background: '#ffffff',
  text: '#1e293b',
  error: '#ef4444',
  success: '#22c55e',
};

// 컴포넌트에서 직접 사용:
// <div style={{ color: COLORS.text, background: COLORS.background }}>`,
    },
    {
      auditId: da2, category: 'EXTENSIBILITY', severity: 'MEDIUM',
      filePath: 'src/components/Chart.tsx', lineRange: '50',
      description: '차트 컴포넌트가 bar 차트만 지원합니다.',
      suggestion: '차트 타입을 prop으로 받아 line, pie 등을 지원하도록 확장하세요.',
      sourceSnippet: `// src/components/Chart.tsx:40-55
export function Chart({ data, labels }: ChartProps) {
  // ⚠️ bar 차트만 지원 — line, pie, radar 등 확장 불가
  return (
    <canvas ref={canvasRef}>
      {/* Hardcoded to 'bar' type */}
    </canvas>
  );
}

// 사용처에서 차트 타입 변경이 불가능:
// <Chart data={data} labels={labels} />  // 항상 bar 차트`,
    },
    {
      auditId: da2, category: 'STABILITY', severity: 'LOW',
      filePath: 'src/hooks/useFetch.ts', lineRange: '8',
      description: '컴포넌트 언마운트 후 setState 호출이 감지되었습니다.',
      suggestion: 'AbortController를 사용하여 언마운트 시 요청을 취소하세요.',
      sourceSnippet: `// src/hooks/useFetch.ts:5-18
export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ⚠️ AbortController 없음 — 언마운트 후 setState 호출
    fetch(url)
      .then(res => res.json())
      .then(json => {
        setData(json);    // 컴포넌트 언마운트 후 호출될 수 있음
        setLoading(false); // React Warning 발생
      });
  }, [url]);
}`,
    },
  );

  const da3 = dashboardAudits[2].id;
  findings.push(
    {
      auditId: da3, category: 'SECURITY', severity: 'HIGH',
      filePath: 'src/api/client.ts', lineRange: '5',
      description: 'API 키가 클라이언트 번들에 노출되어 있습니다.',
      suggestion: '서버 사이드 프록시를 통해 API 키를 숨기세요.',
      sourceSnippet: `// src/api/client.ts:3-10
// ⚠️ 클라이언트 번들에 포함되는 API 키
const API_KEY = 'mock_sk_live_4eC39HqLyjWDarjtT1zdp7dc';

export async function fetchData(endpoint: string) {
  const res = await fetch(\`https://api.service.com/\${endpoint}\`, {
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,  // 브라우저 DevTools에서 노출
    },
  });
  return res.json();
}`,
    },
    {
      auditId: da3, category: 'PERFORMANCE', severity: 'LOW',
      filePath: 'src/components/ImageGallery.tsx', lineRange: '12-30',
      description: '이미지 lazy loading이 적용되지 않아 초기 로드가 느립니다.',
      suggestion: 'Intersection Observer 또는 loading="lazy" 속성을 사용하세요.',
      sourceSnippet: `// src/components/ImageGallery.tsx:12-25
export function ImageGallery({ images }: { images: ImageItem[] }) {
  return (
    <div className="gallery-grid">
      {images.map((img) => (
        // ⚠️ loading="lazy" 없음 — 모든 이미지 즉시 로드
        <img
          key={img.id}
          src={img.url}
          alt={img.title}
          className="gallery-item"
        />
      ))}
    </div>
  );
}`,
    },
  );

  // ── Payment Gateway 감사들 ──
  const pga1 = paymentAudits[0].id;
  findings.push(
    {
      auditId: pga1, category: 'SECURITY', severity: 'CRITICAL',
      filePath: 'src/payment/processor.ts', lineRange: '50-65',
      description: '카드 번호가 평문으로 로그에 기록됩니다. PCI-DSS 위반.',
      suggestion: '카드 번호를 마스킹(****-****-****-1234)하여 로깅하세요.',
      sourceSnippet: `// src/payment/processor.ts:50-65
async function processPayment(paymentData: PaymentRequest) {
  const { cardNumber, expiry, cvv, amount } = paymentData;

  // ⚠️ PCI-DSS 위반: 카드 번호 평문 로깅
  logger.info('Processing payment', {
    cardNumber: cardNumber,    // 4111-1111-1111-1111 그대로 로그
    amount: amount,
    expiry: expiry,
  });

  const result = await gateway.charge({
    card: cardNumber,
    expiry,
    cvv,  // ⚠️ CVV도 메모리에 불필요하게 보관
    amount,
  });
  return result;
}`,
    },
    {
      auditId: pga1, category: 'SECURITY', severity: 'CRITICAL',
      filePath: 'src/payment/tokenizer.ts', lineRange: '20-30',
      description: '결제 토큰이 AES-128로 암호화되어 있으나 키가 소스코드에 포함됩니다.',
      suggestion: 'AWS KMS 또는 Vault를 사용하여 키를 관리하세요.',
      sourceSnippet: `// src/payment/tokenizer.ts:20-30
import crypto from 'crypto';

// ⚠️ 암호화 키가 소스코드에 하드코딩
const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
const IV = 'unique-iv-vector';

export function tokenize(cardNumber: string): string {
  const cipher = crypto.createCipheriv('aes-128-cbc', ENCRYPTION_KEY, IV);
  let encrypted = cipher.update(cardNumber, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}`,
    },
    {
      auditId: pga1, category: 'STABILITY', severity: 'CRITICAL',
      filePath: 'src/payment/gateway.ts', lineRange: '88-100',
      description: '결제 게이트웨이 타임아웃 시 재시도 로직이 없어 결제가 유실될 수 있습니다.',
      suggestion: '지수 백오프와 함께 멱등성 키를 사용한 재시도를 구현하세요.',
      sourceSnippet: `// src/payment/gateway.ts:88-100
export async function chargeCard(params: ChargeParams): Promise<ChargeResult> {
  // ⚠️ 재시도 없음 — 네트워크 오류 시 결제 유실
  const response = await fetch(GATEWAY_URL + '/charge', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${API_KEY}\` },
    body: JSON.stringify(params),
    // ⚠️ 타임아웃 설정도 없음
  });

  if (!response.ok) {
    throw new Error(\`Payment failed: \${response.status}\`);
    // 일시적 네트워크 오류도 재시도 없이 실패 처리
  }
  return response.json();
}`,
    },
    {
      auditId: pga1, category: 'ERROR_PRONE', severity: 'HIGH',
      filePath: 'src/payment/refund.ts', lineRange: '35-42',
      description: '환불 금액 검증이 없어 원래 결제 금액을 초과하는 환불이 가능합니다.',
      suggestion: '환불 금액 <= 원래 결제 금액 검증을 추가하세요.',
      sourceSnippet: `// src/payment/refund.ts:35-42
export async function processRefund(paymentId: string, refundAmount: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  // ⚠️ 환불 금액 검증 없음
  // refundAmount가 payment.amount보다 커도 그대로 처리
  const result = await gateway.refund({
    transactionId: payment.transactionId,
    amount: refundAmount,  // 10,000원 결제에 15,000원 환불 가능
  });

  return result;
}`,
    },
    {
      auditId: pga1, category: 'PERFORMANCE', severity: 'MEDIUM',
      filePath: 'src/db/transactions.ts', lineRange: '15-30',
      description: '대량 트랜잭션 조회 시 인덱스가 없어 전체 테이블 스캔이 발생합니다.',
      suggestion: 'created_at, status 컬럼에 복합 인덱스를 추가하세요.',
      sourceSnippet: `// src/db/transactions.ts:15-30
export async function getTransactionHistory(
  startDate: Date,
  endDate: Date,
  status?: string,
) {
  // ⚠️ created_at, status에 인덱스 없음 — 100만건 풀스캔
  return prisma.transaction.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      ...(status && { status }),
    },
    orderBy: { createdAt: 'desc' },
    // EXPLAIN: Seq Scan on transactions (cost=0.00..35847.00)
  });
}`,
    },
    {
      auditId: pga1, category: 'MAINTAINABILITY', severity: 'MEDIUM',
      filePath: 'src/payment/processor.ts', lineRange: '1-150',
      description: '결제 처리기가 150줄의 단일 함수로 구현되어 있습니다.',
      suggestion: '결제 흐름을 단계별 함수로 분리하세요 (validate → authorize → capture).',
      sourceSnippet: `// src/payment/processor.ts:1-20 (전체 150줄)
export async function processPayment(req: PaymentRequest): Promise<PaymentResult> {
  // ⚠️ 150줄의 단일 함수
  // Step 1: 입력 검증 (30줄)
  if (!req.cardNumber) throw new Error('Card required');
  if (!luhnCheck(req.cardNumber)) throw new Error('Invalid card');
  // ... 20줄 더 ...

  // Step 2: 사기 탐지 (25줄)
  const fraudScore = await checkFraud(req);
  // ...

  // Step 3: 결제 승인 (40줄)
  // Step 4: 결제 캡처 (30줄)
  // Step 5: 알림 전송 (25줄)
}`,
    },
  );

  const pga2 = paymentAudits[1].id;
  findings.push(
    {
      auditId: pga2, category: 'SECURITY', severity: 'HIGH',
      filePath: 'src/payment/tokenizer.ts', lineRange: '20-30',
      description: '암호화 키가 Vault로 이전되었으나 로컬 개발환경 폴백이 평문입니다.',
      suggestion: '개발환경에서도 로컬 Vault 인스턴스를 사용하세요.',
      sourceSnippet: `// src/payment/tokenizer.ts:20-30
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  // ⚠️ 폴백 키가 하드코딩되어 개발/테스트 환경에서 노출 위험
  || 'dev-fallback-key-not-for-production-use';

export function tokenize(cardNumber: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  // ...
}`,
    },
    {
      auditId: pga2, category: 'STABILITY', severity: 'HIGH',
      filePath: 'src/payment/gateway.ts', lineRange: '88-120',
      description: '재시도 로직이 추가되었으나 서킷 브레이커가 없습니다.',
      suggestion: 'opossum 등의 서킷 브레이커 라이브러리를 도입하세요.',
      sourceSnippet: `// src/payment/gateway.ts:88-110
async function chargeWithRetry(params: ChargeParams, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await chargeCard(params);
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1000 * Math.pow(2, i));
    }
  }
  // ⚠️ 서킷 브레이커 없음 — 게이트웨이 장애 시
  // 모든 요청이 재시도를 반복하며 부하 가중
}`,
    },
    {
      auditId: pga2, category: 'EXTENSIBILITY', severity: 'HIGH',
      filePath: 'src/payment/processor.ts', lineRange: '1-80',
      description: 'Stripe만 지원하며 다른 PG사 연동이 구조적으로 어렵습니다.',
      suggestion: 'PaymentProvider 인터페이스를 정의하고 팩토리 패턴을 적용하세요.',
      sourceSnippet: `// src/payment/processor.ts:1-20
import Stripe from 'stripe';

// ⚠️ Stripe에 직접 의존 — 다른 PG사 추가 불가
const stripe = new Stripe(process.env.STRIPE_KEY!);

export async function chargeCard(amount: number, cardToken: string) {
  // Stripe API에 직접 결합
  return stripe.charges.create({
    amount,
    currency: 'krw',
    source: cardToken,
  });
  // Toss Payments, PayPal 등 추가하려면 전체 리팩토링 필요
}`,
    },
    {
      auditId: pga2, category: 'ERROR_PRONE', severity: 'MEDIUM',
      filePath: 'src/payment/webhook.ts', lineRange: '22',
      description: '결제 웹훅 이벤트 중복 처리 방어가 없습니다.',
      suggestion: '이벤트 ID 기반 멱등성 체크를 추가하세요.',
      sourceSnippet: `// src/payment/webhook.ts:18-28
app.post('/webhook/stripe', async (req, res) => {
  const event = req.body;

  // ⚠️ 이벤트 중복 체크 없음
  // 동일 이벤트가 재전송되면 결제가 이중 처리될 수 있음
  if (event.type === 'payment_intent.succeeded') {
    await fulfillOrder(event.data.object);
  }

  res.json({ received: true });
});`,
    },
  );

  const pga3 = paymentAudits[2].id;
  findings.push(
    {
      auditId: pga3, category: 'SECURITY', severity: 'MEDIUM',
      filePath: 'src/api/auth.ts', lineRange: '15',
      description: 'API 인증 토큰의 만료 시간이 24시간으로 과도합니다.',
      suggestion: 'Access token은 15분, Refresh token은 7일로 설정하세요.',
      sourceSnippet: `// src/api/auth.ts:12-20
export function generateTokens(userId: string) {
  const accessToken = jwt.sign(
    { userId, type: 'access' },
    SECRET,
    { expiresIn: '24h' }  // ⚠️ 24시간 — 토큰 탈취 시 위험 기간이 너무 긴 상태
  );
  // Refresh token 없음
  return { accessToken };
}`,
    },
    {
      auditId: pga3, category: 'STABILITY', severity: 'LOW',
      filePath: 'src/monitoring/health.ts', lineRange: '5-15',
      description: '헬스체크 엔드포인트가 DB 연결 상태만 확인합니다.',
      suggestion: 'Redis, 외부 API 등 모든 의존성의 상태를 확인하세요.',
      sourceSnippet: `// src/monitoring/health.ts:5-15
app.get('/health', async (req, res) => {
  try {
    // ⚠️ DB만 체크 — Redis, PG사 API 등 미확인
    await prisma.$queryRaw\`SELECT 1\`;
    res.json({ status: 'healthy' });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy' });
  }
  // Redis 장애, PG사 API 장애를 감지하지 못함
});`,
    },
    {
      auditId: pga3, category: 'MAINTAINABILITY', severity: 'LOW',
      filePath: 'src/types/payment.ts', lineRange: '1-80',
      description: '결제 관련 타입 정의에 중복이 있습니다.',
      suggestion: 'Omit, Pick 등 유틸리티 타입을 활용하여 중복을 제거하세요.',
      sourceSnippet: `// src/types/payment.ts:1-25
// ⚠️ 중복된 타입 정의
interface PaymentRequest {
  amount: number;
  currency: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  customerName: string;
  customerEmail: string;
}

interface RefundRequest {
  amount: number;       // ⚠️ PaymentRequest와 중복
  currency: string;     // ⚠️ 중복
  customerName: string; // ⚠️ 중복
  customerEmail: string;// ⚠️ 중복
  reason: string;
}`,
    },
  );

  // ── Data Pipeline 감사들 ──
  const dp1 = pipelineAudits[0].id;
  findings.push(
    {
      auditId: dp1, category: 'PERFORMANCE', severity: 'CRITICAL',
      filePath: 'src/etl/transform.py', lineRange: '120-180',
      description: '100만 행 데이터가 메모리에 전체 로딩됩니다.',
      suggestion: 'pandas chunked reading 또는 Dask를 사용하세요.',
      sourceSnippet: `# src/etl/transform.py:120-135
def transform_data(input_path: str) -> pd.DataFrame:
    # ⚠️ 100만행 전체 메모리 로드 — OOM 위험
    df = pd.read_csv(input_path)  # ~2GB 파일

    # 전체 데이터프레임에 대해 연산 수행
    df['normalized'] = df['value'].apply(lambda x: x / df['value'].max())
    df['category'] = df['raw_category'].map(CATEGORY_MAP)
    df['timestamp'] = pd.to_datetime(df['raw_ts'])

    # 메모리 사용량: ~8GB (원본의 4배)
    return df`,
    },
    {
      auditId: dp1, category: 'STABILITY', severity: 'HIGH',
      filePath: 'src/etl/loader.py', lineRange: '55-70',
      description: '데이터 로드 실패 시 전체 파이프라인이 중단됩니다.',
      suggestion: 'Dead letter queue와 부분 재시도를 구현하세요.',
      sourceSnippet: `# src/etl/loader.py:55-70
def load_to_warehouse(df: pd.DataFrame, table_name: str):
    # ⚠️ 단일 실패로 전체 파이프라인 중단
    try:
        df.to_sql(table_name, engine, if_exists='append', index=False)
    except Exception as e:
        # 1000만 행 중 1행 오류로도 전체 실패
        raise RuntimeError(f"Failed to load data: {e}")
        # 성공한 데이터도 모두 롤백됨
        # Dead letter queue 없음`,
    },
    {
      auditId: dp1, category: 'ERROR_PRONE', severity: 'HIGH',
      filePath: 'src/etl/validator.py', lineRange: '30-45',
      description: '날짜 형식 파싱에서 timezone 미처리로 데이터 불일치가 발생합니다.',
      suggestion: 'UTC 표준화 후 처리하고 timezone-aware datetime을 사용하세요.',
      sourceSnippet: `# src/etl/validator.py:30-45
def parse_timestamp(raw_ts: str) -> datetime:
    # ⚠️ timezone 미처리 — 데이터 소스별 시간대 불일치
    formats = ['%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M']
    for fmt in formats:
        try:
            return datetime.strptime(raw_ts, fmt)
            # naive datetime 반환 — KST/UTC/EST 구분 불가
        except ValueError:
            continue
    raise ValueError(f"Cannot parse: {raw_ts}")`,
    },
    {
      auditId: dp1, category: 'MAINTAINABILITY', severity: 'MEDIUM',
      filePath: 'src/config/pipeline.yaml', lineRange: '1-50',
      description: '파이프라인 설정이 YAML 내 하드코딩되어 환경별 분리가 안됩니다.',
      suggestion: '환경별 YAML 파일을 분리하고 오버라이드 메커니즘을 추가하세요.',
      sourceSnippet: `# src/config/pipeline.yaml:1-20
# ⚠️ 모든 환경의 설정이 한 파일에
pipeline:
  source:
    type: s3
    bucket: acme-production-data  # 프로덕션 버킷 하드코딩
    region: ap-northeast-2
  transform:
    chunk_size: 100000
    max_workers: 8
  destination:
    host: warehouse-prod.internal  # ⚠️ 프로덕션 호스트 하드코딩
    database: analytics_prod
    schema: public`,
    },
    {
      auditId: dp1, category: 'SECURITY', severity: 'MEDIUM',
      filePath: 'src/connectors/s3.py', lineRange: '10',
      description: 'AWS 자격증명이 코드에 평문으로 포함되어 있습니다.',
      suggestion: 'IAM Role 또는 AWS Secrets Manager를 사용하세요.',
      sourceSnippet: `# src/connectors/s3.py:5-15
import boto3

# ⚠️ AWS 자격증명 하드코딩
s3_client = boto3.client(
    's3',
    aws_access_key_id='AKIAIOSFODNN7EXAMPLE',
    aws_secret_access_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    region_name='ap-northeast-2',
)`,
    },
  );

  const dp2 = pipelineAudits[1].id;
  findings.push(
    {
      auditId: dp2, category: 'PERFORMANCE', severity: 'HIGH',
      filePath: 'src/etl/transform.py', lineRange: '120-150',
      description: 'Chunked reading이 적용되었으나 chunk 크기가 10만행으로 과대합니다.',
      suggestion: 'chunk 크기를 1만행으로 줄이고 메모리 사용량을 모니터링하세요.',
      sourceSnippet: `# src/etl/transform.py:120-135
def transform_data(input_path: str):
    # ⚠️ chunk_size=100000 → 여전히 메모리 과다 사용
    for chunk in pd.read_csv(input_path, chunksize=100000):
        processed = process_chunk(chunk)
        yield processed
    # chunk당 ~800MB, 동시에 2-3개 chunk 처리 시 OOM 위험`,
    },
    {
      auditId: dp2, category: 'FLEXIBILITY', severity: 'MEDIUM',
      filePath: 'src/etl/extractor.py', lineRange: '1-40',
      description: 'CSV 형식만 지원합니다.',
      suggestion: 'Parquet, JSON, Avro 등 다양한 형식을 지원하세요.',
      sourceSnippet: `# src/etl/extractor.py:10-25
def extract_data(source_path: str) -> pd.DataFrame:
    # ⚠️ CSV만 지원 — Parquet, JSON, Avro 등 미지원
    if not source_path.endswith('.csv'):
        raise ValueError("Only CSV files are supported")

    return pd.read_csv(source_path)
    # Parquet은 CSV 대비 10x 빠른 로드, 3x 작은 파일 크기`,
    },
    {
      auditId: dp2, category: 'EXTENSIBILITY', severity: 'MEDIUM',
      filePath: 'src/etl/pipeline.py', lineRange: '1-60',
      description: '파이프라인 단계가 하드코딩되어 커스텀 단계 추가가 어렵습니다.',
      suggestion: 'Plugin 기반 파이프라인 아키텍처를 설계하세요.',
      sourceSnippet: `# src/etl/pipeline.py:10-30
class DataPipeline:
    def run(self, config: dict):
        # ⚠️ 단계가 하드코딩 — 커스텀 단계 추가 불가
        data = self.extract(config['source'])
        data = self.validate(data)
        data = self.transform(data)
        data = self.deduplicate(data)
        self.load(data, config['destination'])
        # 새 단계(예: 암호화, 샘플링)를 추가하려면
        # 이 메서드를 직접 수정해야 함`,
    },
  );

  const dp3 = pipelineAudits[2].id;
  findings.push(
    {
      auditId: dp3, category: 'PERFORMANCE', severity: 'MEDIUM',
      filePath: 'src/etl/transform.py', lineRange: '100-120',
      description: '문자열 컬럼의 반복적 정규식 매칭이 비효율적입니다.',
      suggestion: '정규식을 미리 컴파일하고 벡터화된 연산을 사용하세요.',
      sourceSnippet: `# src/etl/transform.py:100-115
def clean_phone_numbers(df: pd.DataFrame) -> pd.DataFrame:
    import re
    cleaned = []
    for _, row in df.iterrows():
        # ⚠️ 행마다 정규식 컴파일 + iterrows() 사용
        phone = re.sub(r'[^0-9]', '', row['phone'])
        cleaned.append(phone)
    df['phone_clean'] = cleaned
    return df
    # 벡터화: df['phone'].str.replace(r'[^0-9]', '', regex=True)`,
    },
    {
      auditId: dp3, category: 'STABILITY', severity: 'MEDIUM',
      filePath: 'src/scheduler/cron.py', lineRange: '20-35',
      description: '스케줄러 실패 시 알림이 없어 장애를 인지하지 못합니다.',
      suggestion: 'Slack/PagerDuty 알림을 연동하세요.',
      sourceSnippet: `# src/scheduler/cron.py:20-35
def run_scheduled_pipeline():
    try:
        pipeline = DataPipeline()
        pipeline.run(load_config())
    except Exception as e:
        # ⚠️ 로그만 남기고 알림 없음
        logger.error(f"Pipeline failed: {e}")
        # 새벽 3시에 실패하면 다음 출근까지 모름
        # Slack/PagerDuty 알림 연동 필요`,
    },
    {
      auditId: dp3, category: 'ERROR_PRONE', severity: 'LOW',
      filePath: 'src/utils/retry.py', lineRange: '10-20',
      description: '재시도 횟수가 무한대로 설정 가능합니다.',
      suggestion: '최대 재시도 횟수를 3-5회로 제한하세요.',
      sourceSnippet: `# src/utils/retry.py:10-20
def retry(func, max_retries=None, delay=1):
    attempt = 0
    while True:
        try:
            return func()
        except Exception as e:
            attempt += 1
            # ⚠️ max_retries=None이면 무한 재시도
            if max_retries and attempt >= max_retries:
                raise
            time.sleep(delay * attempt)`,
    },
  );

  await prisma.analysisResult.createMany({ data: findings });
  console.log(`   ✓ ${findings.length} analysis findings created\n`);

  // ═══════════════════════════════════════════════════════════════════
  //  5. 테스트 결과 + Healing Iterations
  // ═══════════════════════════════════════════════════════════════════
  console.log('🧪 Creating test results & healing iterations...');

  let testCount = 0;
  let healingCount = 0;

  async function createTest(opts: {
    auditId: string; status: TestStatus; testCode: string;
    exitCode: number | null; stdout: string; stderr: string;
    iterationCount: number; errorAnalysis: string | null;
    healings?: Array<{ exitCode: number; stdout: string; stderr: string; errorAnalysis: string }>;
  }) {
    const test = await prisma.testResult.create({
      data: {
        auditId: opts.auditId, testCode: opts.testCode,
        status: opts.status, exitCode: opts.exitCode,
        stdout: opts.stdout, stderr: opts.stderr,
        iterationCount: opts.iterationCount, errorAnalysis: opts.errorAnalysis,
      },
    });
    testCount++;
    if (opts.healings) {
      for (let i = 0; i < opts.healings.length; i++) {
        await prisma.healingIteration.create({
          data: {
            testResultId: test.id, iteration: i + 1,
            testCode: opts.testCode.replace('// original', `// healing iteration ${i + 1}`),
            exitCode: opts.healings[i].exitCode,
            stdout: opts.healings[i].stdout, stderr: opts.healings[i].stderr,
            errorAnalysis: opts.healings[i].errorAnalysis,
          },
        });
        healingCount++;
      }
    }
    return test;
  }

  // Tests (reuse same test code from before)
  await createTest({ auditId: pa1, status: TestStatus.PASSED, testCode: `describe('JWT Security', () => {\n  it('should not expose hardcoded secrets', () => {\n    const config = loadConfig();\n    expect(config.jwtSecret).not.toBe('hardcoded-secret');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (42ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pa1, status: TestStatus.FAILED, testCode: `describe('DB Connection Pool', () => {\n  it('should reuse connections', () => {\n    const pool = getPool();\n    expect(pool.totalCount).toBeLessThanOrEqual(10);\n  });\n});`, exitCode: 1, stdout: '', stderr: 'Expected pool.totalCount <= 10, received 50', iterationCount: 1, errorAnalysis: 'Connection pool이 loop 내에서 생성되어 50개까지 증가.' });
  await createTest({
    auditId: pa1, status: TestStatus.HEALED, testCode: `describe('CORS Config', () => {\n  it('should not allow wildcard origin', () => {\n    // original\n    const cors = getCorsConfig();\n    expect(cors.origin).not.toBe('*');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (28ms)', stderr: '', iterationCount: 3, errorAnalysis: null,
    healings: [
      { exitCode: 1, stdout: '', stderr: 'TypeError: getCorsConfig is not a function', errorAnalysis: '함수명이 변경되었습니다. loadCorsSettings()로 업데이트 필요.' },
      { exitCode: 1, stdout: '', stderr: "Expected 'http://localhost:3000' not to be '*' - passed but other assertion failed", errorAnalysis: '첫 번째 단언은 통과했으나 두 번째 체크에서 실패.' },
    ],
  });

  await createTest({ auditId: pa4, status: TestStatus.PASSED, testCode: `describe('Date Utils', () => {\n  it('should format timezone correctly', () => {\n    const result = formatDate('2026-01-01T00:00:00Z', 'Asia/Seoul');\n    expect(result).toBe('2026-01-01 09:00:00 KST');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (15ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pa4, status: TestStatus.PASSED, testCode: `describe('Notification Service', () => {\n  it('should send email notification', async () => {\n    const result = await notify({ type: 'email', to: 'user@test.com', message: 'Test' });\n    expect(result.status).toBe('sent');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (120ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pa5, status: TestStatus.PASSED, testCode: `describe('Cache TTL', () => {\n  it('should have reasonable TTL', () => {\n    const config = getCacheConfig();\n    expect(config.ttl).toBeLessThanOrEqual(300);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (12ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pa5, status: TestStatus.TIMEOUT, testCode: `describe('Rate Limiter', () => {\n  it('should block after limit exceeded', async () => {\n    for (let i = 0; i < 101; i++) {\n      await makeRequest();\n    }\n    const response = await makeRequest();\n    expect(response.status).toBe(429);\n  });\n});`, exitCode: null, stdout: 'Running... 60 requests completed', stderr: '', iterationCount: 1, errorAnalysis: 'Sandbox 제한 시간(60초) 초과. 실제 HTTP 요청을 mock으로 대체해야 합니다.' });
  await createTest({ auditId: pa6, status: TestStatus.PASSED, testCode: `describe('Queue Worker Shutdown', () => {\n  it('should handle SIGTERM gracefully', async () => {\n    const worker = createWorker();\n    process.emit('SIGTERM');\n    await new Promise(r => setTimeout(r, 1000));\n    expect(worker.isShuttingDown).toBe(true);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (1050ms)', stderr: '', iterationCount: 1, errorAnalysis: null });

  await createTest({ auditId: da1, status: TestStatus.PASSED, testCode: `describe('DataTable Virtualization', () => {\n  it('should render only visible rows', () => {\n    render(<DataTable rows={generateRows(10000)} />);\n    const renderedRows = screen.getAllByRole('row');\n    expect(renderedRows.length).toBeLessThan(50);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (180ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: da1, status: TestStatus.FAILED, testCode: `describe('XSS Prevention', () => {\n  it('should sanitize HTML input', () => {\n    const dirty = '<script>alert("xss")</script><b>Hello</b>';\n    const clean = sanitize(dirty);\n    expect(clean).toBe('<b>Hello</b>');\n  });\n});`, exitCode: 1, stdout: '', stderr: 'Expected "<script>alert(\\"xss\\")</script><b>Hello</b>" to be "<b>Hello</b>"', iterationCount: 1, errorAnalysis: 'sanitize 함수가 DOMPurify를 사용하지 않고 단순 escape만 수행합니다.' });
  await createTest({
    auditId: da3, status: TestStatus.HEALED, testCode: `describe('API Key Security', () => {\n  // original\n  it('should not expose API key in client bundle', () => {\n    const bundleContent = readBundleOutput();\n    expect(bundleContent).not.toContain('sk_live_');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (250ms)', stderr: '', iterationCount: 4, errorAnalysis: null,
    healings: [
      { exitCode: 1, stdout: '', stderr: "ENOENT: no such file or directory 'dist/bundle.js'", errorAnalysis: '빌드 출력 경로가 변경되었습니다.' },
      { exitCode: 1, stdout: '', stderr: "Multiple bundle files found", errorAnalysis: '여러 chunk 파일이 존재합니다.' },
      { exitCode: 1, stdout: '', stderr: "Expected string not to contain 'sk_live_' but found in chunk-vendor.js", errorAnalysis: 'vendor chunk에 API 키가 포함되어 있습니다.' },
    ],
  });

  await createTest({ auditId: pga1, status: TestStatus.FAILED, testCode: `describe('Card Number Masking', () => {\n  it('should mask card numbers in logs', () => {\n    processPayment({ cardNumber: '4111111111111111' });\n    const logs = getRecentLogs();\n    expect(logs).not.toContain('4111111111111111');\n  });\n});`, exitCode: 1, stdout: '', stderr: "Expected logs not to contain '4111111111111111' but found at line 3", iterationCount: 1, errorAnalysis: '결제 프로세서의 debug 로그에서 카드 번호가 평문으로 출력됩니다.' });
  await createTest({ auditId: pga1, status: TestStatus.FAILED, testCode: `describe('Refund Validation', () => {\n  it('should reject refund exceeding original amount', async () => {\n    const payment = await createPayment({ amount: 10000 });\n    await expect(refund(payment.id, 15000)).rejects.toThrow('Refund exceeds original amount');\n  });\n});`, exitCode: 1, stdout: '', stderr: "Expected promise to reject but it resolved with { status: 'refunded', amount: 15000 }", iterationCount: 1, errorAnalysis: '환불 금액 검증이 전혀 없어 원래 금액보다 큰 환불이 정상 처리됩니다.' });
  await createTest({
    auditId: pga2, status: TestStatus.HEALED, testCode: `describe('Circuit Breaker', () => {\n  // original\n  it('should open circuit after 5 failures', async () => {\n    const breaker = createCircuitBreaker();\n    for (let i = 0; i < 5; i++) {\n      try { await breaker.fire(() => Promise.reject('error')); } catch {}\n    }\n    expect(breaker.opened).toBe(true);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (85ms)', stderr: '', iterationCount: 3, errorAnalysis: null,
    healings: [
      { exitCode: 1, stdout: '', stderr: "TypeError: createCircuitBreaker is not a function", errorAnalysis: 'opossum 라이브러리가 아직 설치되지 않았습니다.' },
      { exitCode: 1, stdout: '', stderr: "Expected breaker.opened to be true, received false", errorAnalysis: '실패 임계값이 기본 10으로 설정되어 있어 5회 실패로는 서킷이 열리지 않습니다.' },
    ],
  });
  await createTest({ auditId: pga3, status: TestStatus.PASSED, testCode: `describe('Token Expiry', () => {\n  it('should have access token TTL of 15 minutes', () => {\n    const config = getAuthConfig();\n    expect(config.accessTokenTTL).toBe(900);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (3ms)', stderr: '', iterationCount: 1, errorAnalysis: null });

  await createTest({ auditId: dp1, status: TestStatus.FAILED, testCode: `import pandas as pd\n\ndef test_memory_efficient_loading():\n    """100만 행 CSV 로드 시 메모리 사용량이 500MB를 초과하지 않아야 합니다."""\n    import tracemalloc\n    tracemalloc.start()\n    df = transform_data('test_1m_rows.csv')\n    current, peak = tracemalloc.get_traced_memory()\n    assert peak < 500 * 1024 * 1024, f"Peak memory: {peak / 1024 / 1024:.0f}MB"`, exitCode: 1, stdout: '', stderr: 'AssertionError: Peak memory: 2048MB > 500MB', iterationCount: 1, errorAnalysis: '전체 데이터프레임 메모리 로드로 인해 2GB 사용.' });
  await createTest({ auditId: dp2, status: TestStatus.PASSED, testCode: `def test_chunked_processing():\n    """청크 처리 시 메모리 사용량이 1GB 미만이어야 합니다."""\n    import tracemalloc\n    tracemalloc.start()\n    for chunk in transform_data('test_1m_rows.csv'):\n        process(chunk)\n    current, peak = tracemalloc.get_traced_memory()\n    assert peak < 1024 * 1024 * 1024`, exitCode: 0, stdout: '✓ 1 test passed (45s)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: dp3, status: TestStatus.PASSED, testCode: `def test_regex_precompile():\n    """정규식 사전 컴파일 후 성능이 50% 이상 향상되어야 합니다."""\n    import time\n    data = generate_sample_data(100000)\n\n    start = time.time()\n    result_old = transform_old(data)\n    old_time = time.time() - start\n\n    start = time.time()\n    result_new = transform_new(data)\n    new_time = time.time() - start\n\n    improvement = (old_time - new_time) / old_time\n    assert improvement > 0.5, f'Improvement: {improvement:.1%}'`, exitCode: 0, stdout: 'Old: 4.2s, New: 1.1s, Improvement: 73.8% - PASSED', stderr: '', iterationCount: 1, errorAnalysis: null });

  console.log(`   ✓ ${testCount} test results created`);
  console.log(`   ✓ ${healingCount} healing iterations created\n`);

  // ═══════════════════════════════════════════════════════════════════
  //  6. Webhook Events
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔔 Creating webhook events...');

  const webhookEvents = [
    { projectId: platformApi.id, event: 'push', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'team-lead', action: 'push', outcome: 'ACCEPTED', auditId: platformAudits[0].id, receivedAt: ago(28 * DAY) },
    { projectId: platformApi.id, event: 'pull_request', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'senior-dev', action: 'opened', outcome: 'ACCEPTED', auditId: platformAudits[1].id, receivedAt: ago(21 * DAY) },
    { projectId: platformApi.id, event: 'push', repo: 'acme-corp/platform-api-service', branch: 'feature/experimental', sender: 'junior-dev', action: 'push', outcome: 'FILTERED', rejectReason: 'Branch not watched: feature/experimental', receivedAt: ago(18 * DAY) },
    { projectId: platformApi.id, event: 'push', repo: 'acme-corp/platform-api-service', branch: 'develop', sender: 'kchul199', action: 'push', outcome: 'ACCEPTED', auditId: platformAudits[2].id, receivedAt: ago(14 * DAY) },
    { event: 'push', repo: 'unknown-org/unknown-repo', branch: 'main', sender: 'hacker', action: 'push', outcome: 'REJECTED', rejectReason: 'Invalid signature', receivedAt: ago(13 * DAY) },
    { projectId: platformApi.id, event: 'pull_request', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'kchul199', action: 'opened', outcome: 'ACCEPTED', auditId: platformAudits[3].id, receivedAt: ago(7 * DAY) },
    { projectId: platformApi.id, event: 'push', repo: 'acme-corp/platform-api-service', branch: 'hotfix/urgent', sender: 'kchul199', action: 'push', outcome: 'FILTERED', rejectReason: 'Branch not watched: hotfix/urgent', receivedAt: ago(5 * DAY) },
    { projectId: platformApi.id, event: 'pull_request', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'external-contributor', action: 'opened', outcome: 'REJECTED', rejectReason: 'User not allowed: external-contributor', receivedAt: ago(4 * DAY) },
    { projectId: platformApi.id, event: 'pull_request', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'team-lead', action: 'opened', outcome: 'ACCEPTED', auditId: platformAudits[4].id, receivedAt: ago(3 * DAY) },
    { projectId: platformApi.id, event: 'pull_request', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'kchul199', action: 'synchronize', outcome: 'ACCEPTED', auditId: platformAudits[5].id, receivedAt: ago(1 * DAY) },
    { projectId: webDashboard.id, event: 'pull_request', repo: 'acme-corp/web-dashboard-app', branch: 'main', sender: 'frontend-lead', action: 'opened', outcome: 'ACCEPTED', auditId: dashboardAudits[0].id, receivedAt: ago(18 * DAY) },
    { projectId: webDashboard.id, event: 'pull_request', repo: 'acme-corp/web-dashboard-app', branch: 'main', sender: 'kchul199', action: 'opened', outcome: 'ACCEPTED', auditId: dashboardAudits[1].id, receivedAt: ago(10 * DAY) },
    { projectId: webDashboard.id, event: 'push', repo: 'acme-corp/web-dashboard-app', branch: 'main', sender: 'kchul199', action: 'push', outcome: 'REJECTED', rejectReason: 'Push audits disabled', receivedAt: ago(8 * DAY) },
    { projectId: webDashboard.id, event: 'pull_request', repo: 'acme-corp/web-dashboard-app', branch: 'main', sender: 'frontend-lead', action: 'opened', outcome: 'ACCEPTED', auditId: dashboardAudits[2].id, receivedAt: ago(4 * DAY) },
    { projectId: paymentGw.id, event: 'push', repo: 'acme-corp/payment-gateway-ms', branch: 'main', sender: 'security-officer', action: 'push', outcome: 'ACCEPTED', auditId: paymentAudits[0].id, receivedAt: ago(12 * DAY) },
    { projectId: paymentGw.id, event: 'pull_request', repo: 'acme-corp/payment-gateway-ms', branch: 'main', sender: 'kchul199', action: 'opened', outcome: 'REJECTED', rejectReason: 'PR audits disabled', receivedAt: ago(9 * DAY) },
    { projectId: paymentGw.id, event: 'push', repo: 'acme-corp/payment-gateway-ms', branch: 'main', sender: 'kchul199', action: 'push', outcome: 'ACCEPTED', auditId: paymentAudits[1].id, receivedAt: ago(6 * DAY) },
    { projectId: paymentGw.id, event: 'push', repo: 'acme-corp/payment-gateway-ms', branch: 'main', sender: 'security-officer', action: 'push', outcome: 'ACCEPTED', auditId: paymentAudits[2].id, receivedAt: ago(1 * DAY) },
    { projectId: mobileBff.id, event: 'push', repo: 'acme-corp/mobile-bff-service', branch: 'main', sender: 'kchul199', action: 'push', outcome: 'REJECTED', rejectReason: 'Project inactive', receivedAt: ago(3 * DAY) },
    { projectId: mobileBff.id, event: 'pull_request', repo: 'acme-corp/mobile-bff-service', branch: 'develop', sender: 'mobile-dev', action: 'opened', outcome: 'REJECTED', rejectReason: 'Project inactive', receivedAt: ago(2 * DAY) },
    { projectId: dataPipeline.id, event: 'pull_request', repo: 'acme-corp/data-pipeline-etl', branch: 'main', sender: 'kchul199', action: 'opened', outcome: 'ACCEPTED', auditId: pipelineAudits[0].id, receivedAt: ago(4 * DAY) },
    { projectId: dataPipeline.id, event: 'push', repo: 'acme-corp/data-pipeline-etl', branch: 'main', sender: 'kchul199', action: 'push', outcome: 'ACCEPTED', auditId: pipelineAudits[1].id, receivedAt: ago(2 * DAY) },
    { projectId: dataPipeline.id, event: 'pull_request', repo: 'acme-corp/data-pipeline-etl', branch: 'feature/parquet', sender: 'data-engineer', action: 'opened', outcome: 'ACCEPTED', auditId: pipelineAudits[2].id, receivedAt: ago(12 * HOUR) },
    { event: 'ping', repo: 'acme-corp/new-service', sender: 'github-bot', action: 'ping', outcome: 'ACCEPTED', receivedAt: ago(1 * HOUR) },
    { projectId: dataPipeline.id, event: 'push', repo: 'acme-corp/data-pipeline-etl', branch: 'experiment/ml-feature', sender: 'ml-engineer', action: 'push', outcome: 'ACCEPTED', receivedAt: ago(30 * 60_000) },
    { event: 'pull_request', repo: 'unknown-org/suspicious-repo', branch: 'main', sender: 'unknown-user', action: 'opened', outcome: 'REJECTED', rejectReason: 'Invalid signature', receivedAt: ago(15 * 60_000) },
  ];

  await prisma.webhookEvent.createMany({ data: webhookEvents });
  console.log(`   ✓ ${webhookEvents.length} webhook events created\n`);

  // ═══════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════');
  console.log('✅ Comprehensive seed completed successfully!');
  console.log('═══════════════════════════════════════════════');
  console.log(`   📦 Projects:            ${projects.length}`);
  console.log(`   🔍 Audits:              ${allAudits.length}`);
  console.log(`   📊 Analysis Findings:   ${findings.length}`);
  console.log(`   🧪 Test Results:        ${testCount}`);
  console.log(`   🔄 Healing Iterations:  ${healingCount}`);
  console.log(`   🔔 Webhook Events:      ${webhookEvents.length}`);
  console.log('═══════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
