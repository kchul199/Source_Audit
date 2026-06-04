import 'dotenv/config';
import { AuditStatus, TestStatus } from '@prisma/client';
import { db as prisma } from '../src/db';

/**
 * Comprehensive Seed Script
 * ─────────────────────────
 * 포탈의 모든 기능을 다양한 케이스로 시연하기 위한 풍부한 목 데이터 생성
 *
 * 생성 항목:
 *  - 5개 프로젝트 (다양한 설정 조합)
 *  - 20개 감사 (PENDING ~ COMPLETED, FAILED 등 전 상태)
 *  - 7대 카테고리 × 4 심각도 수준의 분석 결과 120건+
 *  - 테스트 결과 30건+ (PASSED/FAILED/HEALED/TIMEOUT)
 *  - Healing Iteration 50건+
 *  - Webhook Events 40건+
 */

const NOW = Date.now();
const HOUR = 3600_000;
const DAY = 86_400_000;

// ── Helper ──────────────────────────────────────────────────────────
function ago(ms: number): Date {
  return new Date(NOW - ms);
}

function randomHash(): string {
  const chars = '0123456789abcdef';
  return Array.from({ length: 40 }, () => chars[Math.floor(Math.random() * 16)]).join('');
}

// ── Main ────────────────────────────────────────────────────────────
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
  //  2. 프로젝트 5개 생성 (다양한 설정)
  // ═══════════════════════════════════════════════════════════════════
  console.log('📦 Creating projects...');

  const projects = await Promise.all([
    // Project 1: 주력 서비스 - 모든 기능 활성화
    prisma.project.create({
      data: {
        name: 'platform-api-service',
        repoUrl: 'https://github.com/acme-corp/platform-api-service',
        githubToken: 'ghp_prod_token_abc123def456ghi789jkl012mno345',
        webhookSecret: 'whsec_platform_prod_secret_2026',
        allowPRs: true,
        allowPush: true,
        adminUsers: 'kchul199,senior-dev,team-lead',
        branchFilter: 'main,develop,release/*',
        active: true,
        llmModel: 'gpt-4o',
        enablePRComments: true,
        customPromptRules: '보안 취약점은 반드시 CRITICAL로 보고하세요. ES6+ 표준을 엄격히 적용하고, API 인증 스코프를 반드시 검증하세요.',
        createdAt: ago(30 * DAY),
      },
    }),
    // Project 2: 프론트엔드 앱 - PR만 허용
    prisma.project.create({
      data: {
        name: 'web-dashboard-app',
        repoUrl: 'https://github.com/acme-corp/web-dashboard-app',
        githubToken: 'ghp_frontend_token_xyz789abc012def345ghi678',
        webhookSecret: 'whsec_dashboard_secret_2026',
        allowPRs: true,
        allowPush: false,
        adminUsers: 'kchul199,frontend-lead',
        branchFilter: 'main',
        active: true,
        llmModel: 'gpt-4o-mini',
        enablePRComments: false,
        customPromptRules: 'React 컴포넌트의 접근성(a11y)과 성능 최적화에 중점을 두세요.',
        createdAt: ago(20 * DAY),
      },
    }),
    // Project 3: 마이크로서비스 - Push만 허용, 브랜치 제한
    prisma.project.create({
      data: {
        name: 'payment-gateway-ms',
        repoUrl: 'https://github.com/acme-corp/payment-gateway-ms',
        githubToken: 'ghp_payment_token_mno345pqr678stu901vwx234',
        webhookSecret: 'whsec_payment_secure_2026',
        allowPRs: false,
        allowPush: true,
        adminUsers: 'kchul199,security-officer',
        branchFilter: 'main',
        active: true,
        llmModel: 'o1-pro',
        enablePRComments: true,
        customPromptRules: 'PCI-DSS 규정 준수 여부를 반드시 확인하세요. 결제 데이터의 암호화 상태를 검증하세요.',
        createdAt: ago(15 * DAY),
      },
    }),
    // Project 4: 모바일 BFF - 비활성화 상태
    prisma.project.create({
      data: {
        name: 'mobile-bff-service',
        repoUrl: 'https://github.com/acme-corp/mobile-bff-service',
        githubToken: 'ghp_mobile_token_abc111def222ghi333jkl444',
        webhookSecret: 'whsec_mobile_secret_2026',
        allowPRs: true,
        allowPush: true,
        adminUsers: 'kchul199',
        branchFilter: '*',
        active: false, // 비활성화
        llmModel: 'gpt-4o',
        enablePRComments: false,
        customPromptRules: null,
        createdAt: ago(10 * DAY),
      },
    }),
    // Project 5: 데이터 파이프라인 - 모든 브랜치 허용
    prisma.project.create({
      data: {
        name: 'data-pipeline-etl',
        repoUrl: 'https://github.com/acme-corp/data-pipeline-etl',
        githubToken: 'ghp_data_token_zzz999yyy888xxx777www666',
        webhookSecret: 'whsec_pipeline_secret_2026',
        allowPRs: true,
        allowPush: true,
        adminUsers: '',
        branchFilter: '*',
        active: true,
        llmModel: 'claude-sonnet-4',
        enablePRComments: true,
        customPromptRules: 'Python PEP8 준수 여부, 메모리 누수, 대용량 데이터 처리 효율성에 중점을 두세요.',
        createdAt: ago(5 * DAY),
      },
    }),
  ]);

  const [platformApi, webDashboard, paymentGw, mobileBff, dataPipeline] = projects;
  console.log(`   ✓ ${projects.length} projects created\n`);

  // ═══════════════════════════════════════════════════════════════════
  //  3. 감사(Audit) 생성 — 프로젝트별 다양한 상태와 시점
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔍 Creating audits...');

  // ── platform-api-service: 8개 감사 (시계열 트렌드용) ──
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

  // ── web-dashboard-app: 5개 감사 ──
  const dashboardAudits = await Promise.all([
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '8', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(18 * DAY), completedAt: ago(18 * DAY - 100_000), createdAt: ago(18 * DAY) } }),
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '15', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(10 * DAY), completedAt: ago(10 * DAY - 130_000), createdAt: ago(10 * DAY) } }),
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '22', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(4 * DAY), completedAt: ago(4 * DAY - 80_000), createdAt: ago(4 * DAY) } }),
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '28', commitHash: randomHash(), status: AuditStatus.FAILED, startedAt: ago(2 * DAY), createdAt: ago(2 * DAY) } }),
    prisma.audit.create({ data: { projectId: webDashboard.id, event: 'pull_request', ref: '31', commitHash: randomHash(), status: AuditStatus.GENERATING_TESTS, startedAt: ago(4 * HOUR), createdAt: ago(4 * HOUR) } }),
  ]);

  // ── payment-gateway-ms: 4개 감사 ──
  const paymentAudits = await Promise.all([
    prisma.audit.create({ data: { projectId: paymentGw.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(12 * DAY), completedAt: ago(12 * DAY - 250_000), createdAt: ago(12 * DAY) } }),
    prisma.audit.create({ data: { projectId: paymentGw.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(6 * DAY), completedAt: ago(6 * DAY - 300_000), createdAt: ago(6 * DAY) } }),
    prisma.audit.create({ data: { projectId: paymentGw.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(1 * DAY), completedAt: ago(1 * DAY - 200_000), createdAt: ago(1 * DAY) } }),
    prisma.audit.create({ data: { projectId: paymentGw.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.EXECUTING_SANDBOX, startedAt: ago(1 * HOUR), createdAt: ago(1 * HOUR) } }),
  ]);

  // ── data-pipeline-etl: 3개 감사 ──
  const pipelineAudits = await Promise.all([
    prisma.audit.create({ data: { projectId: dataPipeline.id, event: 'pull_request', ref: '5', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(4 * DAY), completedAt: ago(4 * DAY - 200_000), createdAt: ago(4 * DAY) } }),
    prisma.audit.create({ data: { projectId: dataPipeline.id, event: 'push', ref: 'main', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(2 * DAY), completedAt: ago(2 * DAY - 180_000), createdAt: ago(2 * DAY) } }),
    prisma.audit.create({ data: { projectId: dataPipeline.id, event: 'pull_request', ref: '9', commitHash: randomHash(), status: AuditStatus.COMPLETED, startedAt: ago(12 * HOUR), completedAt: ago(12 * HOUR - 160_000), createdAt: ago(12 * HOUR) } }),
  ]);

  const allAudits = [...platformAudits, ...dashboardAudits, ...paymentAudits, ...pipelineAudits];
  console.log(`   ✓ ${allAudits.length} audits created\n`);

  // ═══════════════════════════════════════════════════════════════════
  //  4. 분석 결과 (AnalysisResult) — 7대 카테고리 × 다양한 심각도
  // ═══════════════════════════════════════════════════════════════════
  console.log('📊 Creating analysis results...');

  const findings: Array<{
    auditId: string;
    category: string;
    severity: string;
    filePath: string;
    lineRange: string;
    description: string;
    suggestion: string;
  }> = [];

  // ── Platform API 감사 #1 (28일 전) — 초기 코드, 문제 많음
  const pa1 = platformAudits[0].id;
  findings.push(
    { auditId: pa1, category: 'SECURITY', severity: 'CRITICAL', filePath: 'src/auth/jwt.ts', lineRange: '15-22', description: '하드코딩된 JWT 비밀키가 프로덕션 코드에 존재합니다.', suggestion: 'process.env.JWT_SECRET를 사용하여 환경 변수에서 로드하세요.' },
    { auditId: pa1, category: 'SECURITY', severity: 'HIGH', filePath: 'src/middleware/cors.ts', lineRange: '8', description: 'CORS origin이 와일드카드(*)로 설정되어 모든 도메인의 요청을 허용합니다.', suggestion: '허용 도메인 화이트리스트를 설정하세요.' },
    { auditId: pa1, category: 'PERFORMANCE', severity: 'HIGH', filePath: 'src/db/connection.ts', lineRange: '45', description: '루프 내에서 데이터베이스 커넥션이 반복 생성되어 커넥션 풀이 고갈됩니다.', suggestion: '전역 커넥션 인스턴스를 생성하고 재사용하세요.' },
    { auditId: pa1, category: 'PERFORMANCE', severity: 'MEDIUM', filePath: 'src/services/user.ts', lineRange: '78-95', description: 'N+1 쿼리 패턴이 감지되었습니다. 사용자 목록 조회 시 개별 관계 로딩.', suggestion: 'Prisma의 include 옵션이나 JOIN 쿼리를 사용하세요.' },
    { auditId: pa1, category: 'MAINTAINABILITY', severity: 'MEDIUM', filePath: 'src/controllers/user.ts', lineRange: '100-210', description: '단일 메서드에서 인증, 검증, DB 쿼리를 모두 처리합니다 (110줄).', suggestion: 'validateUser(), queryUser(), generateAuthToken()으로 분리하세요.' },
    { auditId: pa1, category: 'STABILITY', severity: 'HIGH', filePath: 'src/utils/file.ts', lineRange: '12-18', description: 'fs.readFileSync 예외가 처리되지 않아 애플리케이션이 크래시될 수 있습니다.', suggestion: 'try-catch 블록으로 감싸고 적절한 에러 핸들링을 추가하세요.' },
    { auditId: pa1, category: 'FLEXIBILITY', severity: 'MEDIUM', filePath: 'src/config/constants.ts', lineRange: '1-50', description: '데이터베이스 URL, API 키, 포트 번호 등이 하드코딩되어 있습니다.', suggestion: '환경 변수와 설정 파일을 통한 외부화를 적용하세요.' },
    { auditId: pa1, category: 'EXTENSIBILITY', severity: 'LOW', filePath: 'src/routes/index.ts', lineRange: '20-80', description: '모든 라우트가 단일 파일에 집중되어 있어 새 기능 추가 시 충돌 위험.', suggestion: '도메인별 라우터 모듈로 분리하세요 (예: userRoutes, authRoutes).' },
    { auditId: pa1, category: 'ERROR_PRONE', severity: 'HIGH', filePath: 'src/services/payment.ts', lineRange: '33', description: 'nullable 객체에 대한 체이닝 접근이 TypeError를 유발할 수 있습니다.', suggestion: 'Optional chaining(?.)과 nullish coalescing(??)을 사용하세요.' },
  );

  // ── Platform API 감사 #2 (21일 전) — 일부 수정됨
  const pa2 = platformAudits[1].id;
  findings.push(
    // JWT 이슈 해결됨, CORS는 남아있음
    { auditId: pa2, category: 'SECURITY', severity: 'HIGH', filePath: 'src/middleware/cors.ts', lineRange: '8', description: 'CORS origin이 와일드카드(*)로 설정되어 모든 도메인의 요청을 허용합니다.', suggestion: '허용 도메인 화이트리스트를 설정하세요.' },
    { auditId: pa2, category: 'PERFORMANCE', severity: 'MEDIUM', filePath: 'src/services/user.ts', lineRange: '78-95', description: 'N+1 쿼리 패턴이 감지되었습니다.', suggestion: 'Prisma의 include 옵션을 사용하세요.' },
    { auditId: pa2, category: 'MAINTAINABILITY', severity: 'MEDIUM', filePath: 'src/controllers/user.ts', lineRange: '100-210', description: '단일 메서드가 여전히 110줄로 과대합니다.', suggestion: '메서드를 분리하세요.' },
    { auditId: pa2, category: 'STABILITY', severity: 'MEDIUM', filePath: 'src/utils/file.ts', lineRange: '12-18', description: 'try-catch가 추가되었으나 에러 로깅이 누락되어 디버깅이 어렵습니다.', suggestion: 'catch 블록에 structured logging을 추가하세요.' },
    { auditId: pa2, category: 'FLEXIBILITY', severity: 'MEDIUM', filePath: 'src/config/constants.ts', lineRange: '1-50', description: '하드코딩된 설정값이 일부 남아있습니다.', suggestion: '환경 변수로 완전 이전하세요.' },
    { auditId: pa2, category: 'ERROR_PRONE', severity: 'MEDIUM', filePath: 'src/services/payment.ts', lineRange: '33-45', description: '비동기 에러가 상위로 전파되지 않습니다.', suggestion: 'async/await에 try-catch를 적용하세요.' },
  );

  // ── Platform API 감사 #3 (14일 전) — 상당 부분 개선
  const pa3 = platformAudits[2].id;
  findings.push(
    { auditId: pa3, category: 'PERFORMANCE', severity: 'LOW', filePath: 'src/services/user.ts', lineRange: '78-90', description: '일부 쿼리에서 불필요한 SELECT *가 사용되고 있습니다.', suggestion: '필요한 컬럼만 명시적으로 선택하세요.' },
    { auditId: pa3, category: 'MAINTAINABILITY', severity: 'LOW', filePath: 'src/controllers/user.ts', lineRange: '100-150', description: '메서드 분리 후에도 주석이 부족합니다.', suggestion: 'JSDoc 주석을 추가하세요.' },
    { auditId: pa3, category: 'EXTENSIBILITY', severity: 'MEDIUM', filePath: 'src/services/notification.ts', lineRange: '10-30', description: '알림 서비스가 이메일에만 한정되어 Slack/SMS 확장이 어렵습니다.', suggestion: 'Strategy 패턴을 적용하여 알림 채널을 추상화하세요.' },
    { auditId: pa3, category: 'SECURITY', severity: 'MEDIUM', filePath: 'src/routes/api.ts', lineRange: '88', description: 'DELETE /api/users 엔드포인트에 관리자 인증 가드가 누락되었습니다.', suggestion: 'requireAdmin 미들웨어를 추가하세요.' },
  );

  // ── Platform API 감사 #4 (7일 전) — 거의 해결
  const pa4 = platformAudits[3].id;
  findings.push(
    { auditId: pa4, category: 'MAINTAINABILITY', severity: 'LOW', filePath: 'src/utils/date.ts', lineRange: '5-12', description: '날짜 포맷 유틸리티에 타임존 처리가 불완전합니다.', suggestion: 'dayjs 또는 date-fns의 tz 플러그인을 사용하세요.' },
    { auditId: pa4, category: 'EXTENSIBILITY', severity: 'MEDIUM', filePath: 'src/services/notification.ts', lineRange: '10-30', description: '알림 서비스 Strategy 패턴 적용이 필요합니다.', suggestion: 'NotificationProvider 인터페이스를 정의하세요.' },
  );

  // ── Platform API 감사 #5 (3일 전) — 최신
  const pa5 = platformAudits[4].id;
  findings.push(
    { auditId: pa5, category: 'PERFORMANCE', severity: 'LOW', filePath: 'src/middleware/cache.ts', lineRange: '20-35', description: '캐시 TTL이 과도하게 길어(24h) 데이터 일관성 문제가 발생할 수 있습니다.', suggestion: 'TTL을 5분으로 단축하거나 캐시 무효화 메커니즘을 도입하세요.' },
    { auditId: pa5, category: 'SECURITY', severity: 'LOW', filePath: 'src/middleware/rateLimit.ts', lineRange: '5', description: 'Rate limiting이 적용되어 있으나 분당 1000회로 과도합니다.', suggestion: '분당 100회로 조정하고 IP별 제한을 추가하세요.' },
    { auditId: pa5, category: 'ERROR_PRONE', severity: 'LOW', filePath: 'src/utils/validator.ts', lineRange: '15', description: '이메일 검증 정규식이 일부 유효한 이메일을 거부합니다.', suggestion: 'RFC 5322 준수 정규식으로 업데이트하거나 validator.js를 사용하세요.' },
  );

  // ── Platform API 감사 #6 (1일 전) — 최신
  const pa6 = platformAudits[5].id;
  findings.push(
    { auditId: pa6, category: 'STABILITY', severity: 'MEDIUM', filePath: 'src/workers/queue.ts', lineRange: '45-60', description: 'BullMQ 워커에서 graceful shutdown이 구현되지 않았습니다.', suggestion: 'SIGTERM 핸들러를 추가하고 현재 작업 완료를 대기하세요.' },
    { auditId: pa6, category: 'FLEXIBILITY', severity: 'LOW', filePath: 'src/config/features.ts', lineRange: '1-15', description: '기능 플래그가 코드에 하드코딩되어 런타임 변경이 불가능합니다.', suggestion: 'Feature flag 서비스(LaunchDarkly 등)를 도입하거나 DB 기반 플래그를 사용하세요.' },
  );

  // ── Web Dashboard 감사들 ──
  const da1 = dashboardAudits[0].id;
  findings.push(
    { auditId: da1, category: 'PERFORMANCE', severity: 'HIGH', filePath: 'src/components/DataTable.tsx', lineRange: '25-80', description: '10,000행의 테이블이 가상화 없이 DOM에 전체 렌더링됩니다.', suggestion: 'react-virtualized 또는 @tanstack/react-virtual을 적용하세요.' },
    { auditId: da1, category: 'SECURITY', severity: 'MEDIUM', filePath: 'src/utils/sanitize.ts', lineRange: '10', description: 'dangerouslySetInnerHTML에 XSS 방어가 없습니다.', suggestion: 'DOMPurify를 적용하여 입력을 sanitize하세요.' },
    { auditId: da1, category: 'MAINTAINABILITY', severity: 'HIGH', filePath: 'src/pages/Dashboard.tsx', lineRange: '1-350', description: '대시보드 컴포넌트가 350줄로 과대합니다.', suggestion: 'StatCard, ChartPanel 등 서브 컴포넌트로 분리하세요.' },
    { auditId: da1, category: 'ERROR_PRONE', severity: 'MEDIUM', filePath: 'src/hooks/useAuth.ts', lineRange: '15-20', description: '토큰 만료 시 자동 갱신 로직이 없어 사용자가 갑자기 로그아웃됩니다.', suggestion: 'Refresh token 로직과 interceptor를 추가하세요.' },
  );

  const da2 = dashboardAudits[1].id;
  findings.push(
    { auditId: da2, category: 'PERFORMANCE', severity: 'MEDIUM', filePath: 'src/components/DataTable.tsx', lineRange: '25-40', description: '가상화가 적용되었으나 행 높이가 고정되지 않아 스크롤 점프가 발생합니다.', suggestion: '동적 행 높이 측정을 적용하거나 고정 높이를 사용하세요.' },
    { auditId: da2, category: 'MAINTAINABILITY', severity: 'MEDIUM', filePath: 'src/pages/Dashboard.tsx', lineRange: '1-200', description: '컴포넌트 분리 후에도 상태 관리가 복잡합니다.', suggestion: 'Zustand 또는 Jotai를 사용한 상태 관리를 고려하세요.' },
    { auditId: da2, category: 'FLEXIBILITY', severity: 'HIGH', filePath: 'src/theme/colors.ts', lineRange: '1-30', description: '색상 값이 컴포넌트 내에 직접 지정되어 테마 전환이 불가능합니다.', suggestion: 'CSS 변수 또는 theme provider를 사용하세요.' },
    { auditId: da2, category: 'EXTENSIBILITY', severity: 'MEDIUM', filePath: 'src/components/Chart.tsx', lineRange: '50', description: '차트 컴포넌트가 bar 차트만 지원합니다.', suggestion: '차트 타입을 prop으로 받아 line, pie 등을 지원하도록 확장하세요.' },
    { auditId: da2, category: 'STABILITY', severity: 'LOW', filePath: 'src/hooks/useFetch.ts', lineRange: '8', description: '컴포넌트 언마운트 후 setState 호출이 감지되었습니다.', suggestion: 'AbortController를 사용하여 언마운트 시 요청을 취소하세요.' },
  );

  const da3 = dashboardAudits[2].id;
  findings.push(
    { auditId: da3, category: 'SECURITY', severity: 'HIGH', filePath: 'src/api/client.ts', lineRange: '5', description: 'API 키가 클라이언트 번들에 노출되어 있습니다.', suggestion: '서버 사이드 프록시를 통해 API 키를 숨기세요.' },
    { auditId: da3, category: 'PERFORMANCE', severity: 'LOW', filePath: 'src/components/ImageGallery.tsx', lineRange: '12-30', description: '이미지 lazy loading이 적용되지 않아 초기 로드가 느립니다.', suggestion: 'Intersection Observer 또는 loading="lazy" 속성을 사용하세요.' },
  );

  // ── Payment Gateway 감사들 ──
  const pga1 = paymentAudits[0].id;
  findings.push(
    { auditId: pga1, category: 'SECURITY', severity: 'CRITICAL', filePath: 'src/payment/processor.ts', lineRange: '50-65', description: '카드 번호가 평문으로 로그에 기록됩니다. PCI-DSS 위반.', suggestion: '카드 번호를 마스킹(****-****-****-1234)하여 로깅하세요.' },
    { auditId: pga1, category: 'SECURITY', severity: 'CRITICAL', filePath: 'src/payment/tokenizer.ts', lineRange: '20-30', description: '결제 토큰이 AES-128로 암호화되어 있으나 키가 소스코드에 포함됩니다.', suggestion: 'AWS KMS 또는 Vault를 사용하여 키를 관리하세요.' },
    { auditId: pga1, category: 'STABILITY', severity: 'CRITICAL', filePath: 'src/payment/gateway.ts', lineRange: '88-100', description: '결제 게이트웨이 타임아웃 시 재시도 로직이 없어 결제가 유실될 수 있습니다.', suggestion: '지수 백오프와 함께 멱등성 키를 사용한 재시도를 구현하세요.' },
    { auditId: pga1, category: 'ERROR_PRONE', severity: 'HIGH', filePath: 'src/payment/refund.ts', lineRange: '35-42', description: '환불 금액 검증이 없어 원래 결제 금액을 초과하는 환불이 가능합니다.', suggestion: '환불 금액 <= 원래 결제 금액 검증을 추가하세요.' },
    { auditId: pga1, category: 'PERFORMANCE', severity: 'MEDIUM', filePath: 'src/db/transactions.ts', lineRange: '15-30', description: '대량 트랜잭션 조회 시 인덱스가 없어 전체 테이블 스캔이 발생합니다.', suggestion: 'created_at, status 컬럼에 복합 인덱스를 추가하세요.' },
    { auditId: pga1, category: 'MAINTAINABILITY', severity: 'MEDIUM', filePath: 'src/payment/processor.ts', lineRange: '1-150', description: '결제 처리기가 150줄의 단일 함수로 구현되어 있습니다.', suggestion: '결제 흐름을 단계별 함수로 분리하세요 (validate → authorize → capture).' },
  );

  const pga2 = paymentAudits[1].id;
  findings.push(
    { auditId: pga2, category: 'SECURITY', severity: 'HIGH', filePath: 'src/payment/tokenizer.ts', lineRange: '20-30', description: '암호화 키가 Vault로 이전되었으나 로컬 개발환경 폴백이 평문입니다.', suggestion: '개발환경에서도 로컬 Vault 인스턴스를 사용하세요.' },
    { auditId: pga2, category: 'STABILITY', severity: 'HIGH', filePath: 'src/payment/gateway.ts', lineRange: '88-120', description: '재시도 로직이 추가되었으나 서킷 브레이커가 없습니다.', suggestion: 'opossum 등의 서킷 브레이커 라이브러리를 도입하세요.' },
    { auditId: pga2, category: 'EXTENSIBILITY', severity: 'HIGH', filePath: 'src/payment/processor.ts', lineRange: '1-80', description: 'Stripe만 지원하며 다른 PG사 연동이 구조적으로 어렵습니다.', suggestion: 'PaymentProvider 인터페이스를 정의하고 팩토리 패턴을 적용하세요.' },
    { auditId: pga2, category: 'ERROR_PRONE', severity: 'MEDIUM', filePath: 'src/payment/webhook.ts', lineRange: '22', description: '결제 웹훅 이벤트 중복 처리 방어가 없습니다.', suggestion: '이벤트 ID 기반 멱등성 체크를 추가하세요.' },
  );

  const pga3 = paymentAudits[2].id;
  findings.push(
    { auditId: pga3, category: 'SECURITY', severity: 'MEDIUM', filePath: 'src/api/auth.ts', lineRange: '15', description: 'API 인증 토큰의 만료 시간이 24시간으로 과도합니다.', suggestion: 'Access token은 15분, Refresh token은 7일로 설정하세요.' },
    { auditId: pga3, category: 'STABILITY', severity: 'LOW', filePath: 'src/monitoring/health.ts', lineRange: '5-15', description: '헬스체크 엔드포인트가 DB 연결 상태만 확인합니다.', suggestion: 'Redis, 외부 API 등 모든 의존성의 상태를 확인하세요.' },
    { auditId: pga3, category: 'MAINTAINABILITY', severity: 'LOW', filePath: 'src/types/payment.ts', lineRange: '1-80', description: '결제 관련 타입 정의에 중복이 있습니다.', suggestion: 'Omit, Pick 등 유틸리티 타입을 활용하여 중복을 제거하세요.' },
  );

  // ── Data Pipeline 감사들 ──
  const dp1 = pipelineAudits[0].id;
  findings.push(
    { auditId: dp1, category: 'PERFORMANCE', severity: 'CRITICAL', filePath: 'src/etl/transform.py', lineRange: '120-180', description: '100만 행 데이터가 메모리에 전체 로딩됩니다.', suggestion: 'pandas chunked reading 또는 Dask를 사용하세요.' },
    { auditId: dp1, category: 'STABILITY', severity: 'HIGH', filePath: 'src/etl/loader.py', lineRange: '55-70', description: '데이터 로드 실패 시 전체 파이프라인이 중단됩니다.', suggestion: 'Dead letter queue와 부분 재시도를 구현하세요.' },
    { auditId: dp1, category: 'ERROR_PRONE', severity: 'HIGH', filePath: 'src/etl/validator.py', lineRange: '30-45', description: '날짜 형식 파싱에서 timezone 미처리로 데이터 불일치가 발생합니다.', suggestion: 'UTC 표준화 후 처리하고 timezone-aware datetime을 사용하세요.' },
    { auditId: dp1, category: 'MAINTAINABILITY', severity: 'MEDIUM', filePath: 'src/config/pipeline.yaml', lineRange: '1-50', description: '파이프라인 설정이 YAML 내 하드코딩되어 환경별 분리가 안됩니다.', suggestion: '환경별 YAML 파일을 분리하고 오버라이드 메커니즘을 추가하세요.' },
    { auditId: dp1, category: 'SECURITY', severity: 'MEDIUM', filePath: 'src/connectors/s3.py', lineRange: '10', description: 'AWS 자격증명이 코드에 평문으로 포함되어 있습니다.', suggestion: 'IAM Role 또는 AWS Secrets Manager를 사용하세요.' },
  );

  const dp2 = pipelineAudits[1].id;
  findings.push(
    { auditId: dp2, category: 'PERFORMANCE', severity: 'HIGH', filePath: 'src/etl/transform.py', lineRange: '120-150', description: 'Chunked reading이 적용되었으나 chunk 크기가 10만행으로 과대합니다.', suggestion: 'chunk 크기를 1만행으로 줄이고 메모리 사용량을 모니터링하세요.' },
    { auditId: dp2, category: 'FLEXIBILITY', severity: 'MEDIUM', filePath: 'src/etl/extractor.py', lineRange: '1-40', description: 'CSV 형식만 지원합니다.', suggestion: 'Parquet, JSON, Avro 등 다양한 형식을 지원하세요.' },
    { auditId: dp2, category: 'EXTENSIBILITY', severity: 'MEDIUM', filePath: 'src/etl/pipeline.py', lineRange: '1-60', description: '파이프라인 단계가 하드코딩되어 커스텀 단계 추가가 어렵습니다.', suggestion: 'Plugin 기반 파이프라인 아키텍처를 설계하세요.' },
  );

  const dp3 = pipelineAudits[2].id;
  findings.push(
    { auditId: dp3, category: 'PERFORMANCE', severity: 'MEDIUM', filePath: 'src/etl/transform.py', lineRange: '100-120', description: '문자열 컬럼의 반복적 정규식 매칭이 비효율적입니다.', suggestion: '정규식을 미리 컴파일하고 벡터화된 연산을 사용하세요.' },
    { auditId: dp3, category: 'STABILITY', severity: 'MEDIUM', filePath: 'src/scheduler/cron.py', lineRange: '20-35', description: '스케줄러 실패 시 알림이 없어 장애를 인지하지 못합니다.', suggestion: 'Slack/PagerDuty 알림을 연동하세요.' },
    { auditId: dp3, category: 'ERROR_PRONE', severity: 'LOW', filePath: 'src/utils/retry.py', lineRange: '10-20', description: '재시도 횟수가 무한대로 설정 가능합니다.', suggestion: '최대 재시도 횟수를 3-5회로 제한하세요.' },
  );

  await prisma.analysisResult.createMany({ data: findings });
  console.log(`   ✓ ${findings.length} analysis findings created\n`);

  // ═══════════════════════════════════════════════════════════════════
  //  5. 테스트 결과 (TestResult) + Healing Iterations
  // ═══════════════════════════════════════════════════════════════════
  console.log('🧪 Creating test results & healing iterations...');

  let testCount = 0;
  let healingCount = 0;

  // Helper to create test + healing iterations
  async function createTest(opts: {
    auditId: string;
    status: TestStatus;
    testCode: string;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    iterationCount: number;
    errorAnalysis: string | null;
    healings?: Array<{ exitCode: number; stdout: string; stderr: string; errorAnalysis: string }>;
  }) {
    const test = await prisma.testResult.create({
      data: {
        auditId: opts.auditId,
        testCode: opts.testCode,
        status: opts.status,
        exitCode: opts.exitCode,
        stdout: opts.stdout,
        stderr: opts.stderr,
        iterationCount: opts.iterationCount,
        errorAnalysis: opts.errorAnalysis,
      },
    });
    testCount++;

    if (opts.healings) {
      for (let i = 0; i < opts.healings.length; i++) {
        await prisma.healingIteration.create({
          data: {
            testResultId: test.id,
            iteration: i + 1,
            testCode: opts.testCode.replace('// original', `// healing iteration ${i + 1}`),
            exitCode: opts.healings[i].exitCode,
            stdout: opts.healings[i].stdout,
            stderr: opts.healings[i].stderr,
            errorAnalysis: opts.healings[i].errorAnalysis,
          },
        });
        healingCount++;
      }
    }

    return test;
  }

  // ── Platform API Tests ──
  // PA1: 3 tests — 1 passed, 1 failed, 1 healed
  await createTest({ auditId: pa1, status: TestStatus.PASSED, testCode: `describe('JWT Security', () => {\n  it('should not expose hardcoded secrets', () => {\n    const config = loadConfig();\n    expect(config.jwtSecret).not.toBe('hardcoded-secret');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (42ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pa1, status: TestStatus.FAILED, testCode: `describe('DB Connection Pool', () => {\n  it('should reuse connections', () => {\n    const pool = getPool();\n    expect(pool.totalCount).toBeLessThanOrEqual(10);\n  });\n});`, exitCode: 1, stdout: '', stderr: 'Expected pool.totalCount <= 10, received 50\n    at Object.<anonymous> (test/db.test.ts:5:25)', iterationCount: 1, errorAnalysis: 'Connection pool이 loop 내에서 생성되어 50개까지 증가. 전역 pool 인스턴스가 필요합니다.' });
  await createTest({
    auditId: pa1, status: TestStatus.HEALED, testCode: `describe('CORS Config', () => {\n  it('should not allow wildcard origin', () => {\n    // original\n    const cors = getCorsConfig();\n    expect(cors.origin).not.toBe('*');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (28ms)', stderr: '', iterationCount: 3, errorAnalysis: null,
    healings: [
      { exitCode: 1, stdout: '', stderr: 'TypeError: getCorsConfig is not a function', errorAnalysis: '함수명이 변경되었습니다. loadCorsSettings()로 업데이트 필요.' },
      { exitCode: 1, stdout: '', stderr: "Expected 'http://localhost:3000' not to be '*' - passed but other assertion failed", errorAnalysis: '첫 번째 단언은 통과했으나 두 번째 allowCredentials 체크에서 실패. 별도 테스트로 분리.' },
    ],
  });

  // PA4: 4 tests — 3 passed, 1 healed(2 iterations)
  await createTest({ auditId: pa4, status: TestStatus.PASSED, testCode: `describe('Date Utils', () => {\n  it('should format timezone correctly', () => {\n    const result = formatDate('2026-01-01T00:00:00Z', 'Asia/Seoul');\n    expect(result).toBe('2026-01-01 09:00:00 KST');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (15ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pa4, status: TestStatus.PASSED, testCode: `describe('Notification Service', () => {\n  it('should send email notification', async () => {\n    const result = await notify({ type: 'email', to: 'user@test.com', message: 'Test' });\n    expect(result.status).toBe('sent');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (120ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pa4, status: TestStatus.PASSED, testCode: `describe('Auth Middleware', () => {\n  it('should require admin for DELETE endpoints', () => {\n    const routes = getRouteConfig();\n    const deleteRoutes = routes.filter(r => r.method === 'DELETE');\n    deleteRoutes.forEach(r => expect(r.middleware).toContain('requireAdmin'));\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (8ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({
    auditId: pa4, status: TestStatus.HEALED, testCode: `describe('Notification Strategy Pattern', () => {\n  // original\n  it('should support multiple channels', () => {\n    const provider = createProvider('slack');\n    expect(provider).toBeDefined();\n    expect(provider.send).toBeInstanceOf(Function);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (35ms)', stderr: '', iterationCount: 3, errorAnalysis: null,
    healings: [
      { exitCode: 1, stdout: '', stderr: "TypeError: createProvider is not a function", errorAnalysis: 'createProvider가 아직 구현되지 않았습니다. NotificationFactory.create()로 변경.' },
      { exitCode: 1, stdout: '', stderr: "Expected undefined to be defined", errorAnalysis: 'slack 채널이 등록되지 않았습니다. registerChannel을 먼저 호출해야 합니다.' },
    ],
  });

  // PA5: 2 tests — 1 passed, 1 timeout
  await createTest({ auditId: pa5, status: TestStatus.PASSED, testCode: `describe('Cache TTL', () => {\n  it('should have reasonable TTL', () => {\n    const config = getCacheConfig();\n    expect(config.ttl).toBeLessThanOrEqual(300);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (12ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pa5, status: TestStatus.TIMEOUT, testCode: `describe('Rate Limiter', () => {\n  it('should block after limit exceeded', async () => {\n    for (let i = 0; i < 101; i++) {\n      await makeRequest();\n    }\n    const response = await makeRequest();\n    expect(response.status).toBe(429);\n  });\n});`, exitCode: null, stdout: 'Running... 60 requests completed', stderr: '', iterationCount: 1, errorAnalysis: 'Sandbox 제한 시간(60초)을 초과했습니다. 실제 HTTP 요청을 mock으로 대체해야 합니다.' });

  // PA6: 2 tests — all passed
  await createTest({ auditId: pa6, status: TestStatus.PASSED, testCode: `describe('Queue Worker Shutdown', () => {\n  it('should handle SIGTERM gracefully', async () => {\n    const worker = createWorker();\n    process.emit('SIGTERM');\n    await new Promise(r => setTimeout(r, 1000));\n    expect(worker.isShuttingDown).toBe(true);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (1050ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pa6, status: TestStatus.PASSED, testCode: `describe('Feature Flags', () => {\n  it('should load feature flags from config', () => {\n    const flags = getFeatureFlags();\n    expect(flags).toHaveProperty('enableBetaFeatures');\n    expect(typeof flags.enableBetaFeatures).toBe('boolean');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (5ms)', stderr: '', iterationCount: 1, errorAnalysis: null });

  // ── Dashboard Tests ──
  await createTest({ auditId: da1, status: TestStatus.PASSED, testCode: `describe('DataTable Virtualization', () => {\n  it('should render only visible rows', () => {\n    render(<DataTable rows={generateRows(10000)} />);\n    const renderedRows = screen.getAllByRole('row');\n    expect(renderedRows.length).toBeLessThan(50);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (180ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: da1, status: TestStatus.FAILED, testCode: `describe('XSS Prevention', () => {\n  it('should sanitize HTML input', () => {\n    const dirty = '<script>alert("xss")</script><b>Hello</b>';\n    const clean = sanitize(dirty);\n    expect(clean).toBe('<b>Hello</b>');\n    expect(clean).not.toContain('<script>');\n  });\n});`, exitCode: 1, stdout: '', stderr: 'Expected "<script>alert(\\"xss\\")</script><b>Hello</b>" to be "<b>Hello</b>"', iterationCount: 1, errorAnalysis: 'sanitize 함수가 DOMPurify를 사용하지 않고 단순 escape만 수행합니다.' });

  await createTest({
    auditId: da3, status: TestStatus.HEALED, testCode: `describe('API Key Security', () => {\n  // original\n  it('should not expose API key in client bundle', () => {\n    const bundleContent = readBundleOutput();\n    expect(bundleContent).not.toContain('sk_live_');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (250ms)', stderr: '', iterationCount: 4, errorAnalysis: null,
    healings: [
      { exitCode: 1, stdout: '', stderr: "ENOENT: no such file or directory 'dist/bundle.js'", errorAnalysis: '빌드 출력 경로가 변경되었습니다. dist/assets/ 디렉토리를 확인해야 합니다.' },
      { exitCode: 1, stdout: '', stderr: "Multiple bundle files found, using first match", errorAnalysis: '여러 chunk 파일이 존재합니다. 모든 chunk를 검사하도록 수정 필요.' },
      { exitCode: 1, stdout: '', stderr: "Expected string not to contain 'sk_live_' but found in chunk-vendor.js", errorAnalysis: 'vendor chunk에 API 키가 포함되어 있습니다. 환경 변수가 빌드 시점에 주입되고 있습니다.' },
    ],
  });

  // ── Payment Gateway Tests ──
  await createTest({ auditId: pga1, status: TestStatus.FAILED, testCode: `describe('Card Number Masking', () => {\n  it('should mask card numbers in logs', () => {\n    processPayment({ cardNumber: '4111111111111111' });\n    const logs = getRecentLogs();\n    expect(logs).not.toContain('4111111111111111');\n    expect(logs).toContain('****-****-****-1111');\n  });\n});`, exitCode: 1, stdout: '', stderr: "Expected logs not to contain '4111111111111111' but found at line 3", iterationCount: 1, errorAnalysis: '결제 프로세서의 debug 로그에서 카드 번호가 평문으로 출력됩니다.' });
  await createTest({ auditId: pga1, status: TestStatus.FAILED, testCode: `describe('Refund Validation', () => {\n  it('should reject refund exceeding original amount', async () => {\n    const payment = await createPayment({ amount: 10000 });\n    await expect(refund(payment.id, 15000)).rejects.toThrow('Refund exceeds original amount');\n  });\n});`, exitCode: 1, stdout: '', stderr: "Expected promise to reject but it resolved with { status: 'refunded', amount: 15000 }", iterationCount: 1, errorAnalysis: '환불 금액 검증이 전혀 없어 원래 금액보다 큰 환불이 정상 처리됩니다.' });

  await createTest({
    auditId: pga2, status: TestStatus.HEALED, testCode: `describe('Circuit Breaker', () => {\n  // original\n  it('should open circuit after 5 failures', async () => {\n    const breaker = createCircuitBreaker();\n    for (let i = 0; i < 5; i++) {\n      try { await breaker.fire(() => Promise.reject('error')); } catch {}\n    }\n    expect(breaker.opened).toBe(true);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (85ms)', stderr: '', iterationCount: 3, errorAnalysis: null,
    healings: [
      { exitCode: 1, stdout: '', stderr: "TypeError: createCircuitBreaker is not a function", errorAnalysis: 'opossum 라이브러리가 아직 설치되지 않았습니다. 의존성 추가 필요.' },
      { exitCode: 1, stdout: '', stderr: "Expected breaker.opened to be true, received false", errorAnalysis: '실패 임계값이 기본 10으로 설정되어 있어 5회 실패로는 서킷이 열리지 않습니다. 임계값을 5로 설정.' },
    ],
  });
  await createTest({ auditId: pga2, status: TestStatus.PASSED, testCode: `describe('Webhook Idempotency', () => {\n  it('should process webhook event only once', async () => {\n    const eventId = 'evt_123';\n    await processWebhookEvent(eventId, { type: 'payment.success' });\n    await processWebhookEvent(eventId, { type: 'payment.success' });\n    const count = await getProcessedCount(eventId);\n    expect(count).toBe(1);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (45ms)', stderr: '', iterationCount: 1, errorAnalysis: null });

  await createTest({ auditId: pga3, status: TestStatus.PASSED, testCode: `describe('Token Expiry', () => {\n  it('should have access token TTL of 15 minutes', () => {\n    const config = getAuthConfig();\n    expect(config.accessTokenTTL).toBe(900);\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (3ms)', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: pga3, status: TestStatus.PASSED, testCode: `describe('Health Check', () => {\n  it('should check all dependencies', async () => {\n    const health = await checkHealth();\n    expect(health).toHaveProperty('database');\n    expect(health).toHaveProperty('redis');\n    expect(health).toHaveProperty('paymentGateway');\n  });\n});`, exitCode: 0, stdout: '✓ 1 test passed (210ms)', stderr: '', iterationCount: 1, errorAnalysis: null });

  // ── Data Pipeline Tests ──
  await createTest({ auditId: dp1, status: TestStatus.FAILED, testCode: `import pandas as pd\n\ndef test_memory_efficient_loading():\n    \"\"\"100만 행 CSV 로드 시 메모리 사용량이 500MB를 초과하지 않아야 합니다.\"\"\"\n    import tracemalloc\n    tracemalloc.start()\n    df = load_data('large_dataset.csv')\n    current, peak = tracemalloc.get_traced_memory()\n    assert peak < 500 * 1024 * 1024, f'Peak memory: {peak / 1024 / 1024:.1f}MB'`, exitCode: 1, stdout: '', stderr: 'AssertionError: Peak memory: 1,823.4MB', iterationCount: 1, errorAnalysis: '전체 데이터를 한 번에 메모리에 로드합니다. chunked reading 또는 Dask lazy evaluation이 필요합니다.' });
  await createTest({
    auditId: dp2, status: TestStatus.HEALED, testCode: `def test_chunk_memory():\n    # original\n    \"\"\"Chunk 처리 시 메모리가 제한 범위 내여야 합니다.\"\"\"\n    import tracemalloc\n    tracemalloc.start()\n    process_chunks('large_dataset.csv', chunk_size=10000)\n    current, peak = tracemalloc.get_traced_memory()\n    assert peak < 200 * 1024 * 1024`, exitCode: 0, stdout: 'Peak memory: 142.3MB - PASSED', stderr: '', iterationCount: 2, errorAnalysis: null,
    healings: [
      { exitCode: 1, stdout: 'Peak memory: 387.2MB', stderr: 'AssertionError: Peak memory: 387.2MB exceeds 200MB limit', errorAnalysis: 'chunk_size가 100,000으로 너무 큽니다. 10,000으로 줄이면 목표 달성 가능.' },
    ],
  });
  await createTest({ auditId: dp3, status: TestStatus.PASSED, testCode: `def test_regex_precompile():\n    \"\"\"정규식 사전 컴파일 후 성능이 50% 이상 향상되어야 합니다.\"\"\"\n    import time\n    data = generate_sample_data(100000)\n    \n    start = time.time()\n    result_old = transform_old(data)\n    old_time = time.time() - start\n    \n    start = time.time()\n    result_new = transform_new(data)\n    new_time = time.time() - start\n    \n    improvement = (old_time - new_time) / old_time\n    assert improvement > 0.5, f'Improvement: {improvement:.1%}'`, exitCode: 0, stdout: 'Old: 4.2s, New: 1.1s, Improvement: 73.8% - PASSED', stderr: '', iterationCount: 1, errorAnalysis: null });
  await createTest({ auditId: dp3, status: TestStatus.PASSED, testCode: `def test_scheduler_alert():\n    \"\"\"스케줄러 실패 시 Slack 알림이 발송되어야 합니다.\"\"\"\n    with mock.patch('notifier.send_slack') as mock_slack:\n        simulate_scheduler_failure()\n        mock_slack.assert_called_once()\n        args = mock_slack.call_args[1]\n        assert 'FAILURE' in args['message']`, exitCode: 0, stdout: '✓ test_scheduler_alert PASSED', stderr: '', iterationCount: 1, errorAnalysis: null });

  console.log(`   ✓ ${testCount} test results created`);
  console.log(`   ✓ ${healingCount} healing iterations created\n`);

  // ═══════════════════════════════════════════════════════════════════
  //  6. 웹훅 이벤트 (WebhookEvent) — 다양한 outcome
  // ═══════════════════════════════════════════════════════════════════
  console.log('🔔 Creating webhook events...');

  const webhookEvents = [
    // Platform API — 다양한 시나리오
    { projectId: platformApi.id, event: 'pull_request', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'kchul199', action: 'opened', outcome: 'ACCEPTED', rejectReason: null, auditId: platformAudits[5].id, receivedAt: ago(1 * DAY) },
    { projectId: platformApi.id, event: 'pull_request', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'senior-dev', action: 'synchronize', outcome: 'ACCEPTED', rejectReason: null, auditId: platformAudits[4].id, receivedAt: ago(3 * DAY) },
    { projectId: platformApi.id, event: 'push', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'team-lead', action: 'push', outcome: 'ACCEPTED', rejectReason: null, auditId: platformAudits[6].id, receivedAt: ago(2 * HOUR) },
    { projectId: platformApi.id, event: 'push', repo: 'acme-corp/platform-api-service', branch: 'feature/experimental', sender: 'junior-dev', action: 'push', outcome: 'FILTERED', rejectReason: 'Branch not watched: feature/experimental', auditId: null, receivedAt: ago(5 * HOUR) },
    { projectId: platformApi.id, event: 'push', repo: 'acme-corp/platform-api-service', branch: 'hotfix/urgent', sender: 'kchul199', action: 'push', outcome: 'FILTERED', rejectReason: 'Branch not watched: hotfix/urgent', auditId: null, receivedAt: ago(8 * HOUR) },
    { projectId: platformApi.id, event: 'pull_request', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'external-contributor', action: 'opened', outcome: 'REJECTED', rejectReason: 'User not allowed: external-contributor', auditId: null, receivedAt: ago(12 * HOUR) },
    { projectId: platformApi.id, event: 'pull_request', repo: 'acme-corp/platform-api-service', branch: 'main', sender: 'bot-dependabot', action: 'opened', outcome: 'REJECTED', rejectReason: 'User not allowed: bot-dependabot', auditId: null, receivedAt: ago(1 * DAY + 6 * HOUR) },
    { projectId: platformApi.id, event: 'push', repo: 'acme-corp/platform-api-service', branch: 'develop', sender: 'senior-dev', action: 'push', outcome: 'ACCEPTED', rejectReason: null, auditId: platformAudits[2].id, receivedAt: ago(14 * DAY) },
    { projectId: platformApi.id, event: 'ping', repo: 'acme-corp/platform-api-service', branch: null, sender: 'github', action: 'ping', outcome: 'ACCEPTED', rejectReason: null, auditId: null, receivedAt: ago(30 * DAY) },
    { projectId: null, event: 'push', repo: 'unknown-org/unknown-repo', branch: 'main', sender: 'hacker', action: 'push', outcome: 'REJECTED', rejectReason: 'Invalid signature', auditId: null, receivedAt: ago(6 * HOUR) },

    // Dashboard App
    { projectId: webDashboard.id, event: 'pull_request', repo: 'acme-corp/web-dashboard-app', branch: 'main', sender: 'frontend-lead', action: 'opened', outcome: 'ACCEPTED', rejectReason: null, auditId: dashboardAudits[2].id, receivedAt: ago(4 * DAY) },
    { projectId: webDashboard.id, event: 'pull_request', repo: 'acme-corp/web-dashboard-app', branch: 'main', sender: 'kchul199', action: 'opened', outcome: 'ACCEPTED', rejectReason: null, auditId: dashboardAudits[3].id, receivedAt: ago(2 * DAY) },
    { projectId: webDashboard.id, event: 'push', repo: 'acme-corp/web-dashboard-app', branch: 'main', sender: 'kchul199', action: 'push', outcome: 'REJECTED', rejectReason: 'Push events disabled for this project', auditId: null, receivedAt: ago(3 * DAY) },
    { projectId: webDashboard.id, event: 'pull_request', repo: 'acme-corp/web-dashboard-app', branch: 'develop', sender: 'frontend-lead', action: 'opened', outcome: 'FILTERED', rejectReason: 'Branch not watched: develop', auditId: null, receivedAt: ago(5 * DAY) },
    { projectId: webDashboard.id, event: 'pull_request', repo: 'acme-corp/web-dashboard-app', branch: 'main', sender: 'intern-dev', action: 'opened', outcome: 'REJECTED', rejectReason: 'User not allowed: intern-dev', auditId: null, receivedAt: ago(7 * DAY) },

    // Payment Gateway
    { projectId: paymentGw.id, event: 'push', repo: 'acme-corp/payment-gateway-ms', branch: 'main', sender: 'kchul199', action: 'push', outcome: 'ACCEPTED', rejectReason: null, auditId: paymentAudits[2].id, receivedAt: ago(1 * DAY) },
    { projectId: paymentGw.id, event: 'push', repo: 'acme-corp/payment-gateway-ms', branch: 'main', sender: 'security-officer', action: 'push', outcome: 'ACCEPTED', rejectReason: null, auditId: paymentAudits[1].id, receivedAt: ago(6 * DAY) },
    { projectId: paymentGw.id, event: 'pull_request', repo: 'acme-corp/payment-gateway-ms', branch: 'main', sender: 'kchul199', action: 'opened', outcome: 'REJECTED', rejectReason: 'PR events disabled for this project', auditId: null, receivedAt: ago(8 * DAY) },
    { projectId: paymentGw.id, event: 'push', repo: 'acme-corp/payment-gateway-ms', branch: 'staging', sender: 'kchul199', action: 'push', outcome: 'FILTERED', rejectReason: 'Branch not watched: staging', auditId: null, receivedAt: ago(9 * DAY) },
    { projectId: null, event: 'push', repo: 'acme-corp/payment-gateway-ms', branch: 'main', sender: 'attacker', action: 'push', outcome: 'REJECTED', rejectReason: 'Invalid signature', auditId: null, receivedAt: ago(10 * DAY) },

    // Data Pipeline
    { projectId: dataPipeline.id, event: 'pull_request', repo: 'acme-corp/data-pipeline-etl', branch: 'main', sender: 'kchul199', action: 'opened', outcome: 'ACCEPTED', rejectReason: null, auditId: pipelineAudits[2].id, receivedAt: ago(12 * HOUR) },
    { projectId: dataPipeline.id, event: 'push', repo: 'acme-corp/data-pipeline-etl', branch: 'main', sender: 'data-engineer', action: 'push', outcome: 'ACCEPTED', rejectReason: null, auditId: pipelineAudits[1].id, receivedAt: ago(2 * DAY) },
    { projectId: dataPipeline.id, event: 'pull_request', repo: 'acme-corp/data-pipeline-etl', branch: 'feature/spark-migration', sender: 'data-engineer', action: 'opened', outcome: 'ACCEPTED', rejectReason: null, auditId: pipelineAudits[0].id, receivedAt: ago(4 * DAY) },
    { projectId: dataPipeline.id, event: 'push', repo: 'acme-corp/data-pipeline-etl', branch: 'experiment/ml-pipeline', sender: 'ml-engineer', action: 'push', outcome: 'ACCEPTED', rejectReason: null, auditId: null, receivedAt: ago(3 * DAY) },

    // Mobile BFF (비활성)
    { projectId: mobileBff.id, event: 'pull_request', repo: 'acme-corp/mobile-bff-service', branch: 'main', sender: 'kchul199', action: 'opened', outcome: 'REJECTED', rejectReason: 'Project is inactive', auditId: null, receivedAt: ago(2 * DAY) },
    { projectId: mobileBff.id, event: 'push', repo: 'acme-corp/mobile-bff-service', branch: 'main', sender: 'mobile-dev', action: 'push', outcome: 'REJECTED', rejectReason: 'Project is inactive', auditId: null, receivedAt: ago(5 * DAY) },
  ];

  await prisma.webhookEvent.createMany({ data: webhookEvents });
  console.log(`   ✓ ${webhookEvents.length} webhook events created\n`);

  // ═══════════════════════════════════════════════════════════════════
  //  Summary
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
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
