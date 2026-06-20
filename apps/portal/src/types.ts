/**
 * Portal Type Definitions
 * Mirrors Prisma types for frontend type safety without direct Prisma dependency.
 */

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  githubAppId: string | null;
  installationId: string | null;
  createdAt: string;
  _count?: {
    audits: number;
  };
  githubToken?: string | null;
  webhookSecret?: string | null;
  allowPRs?: boolean;
  allowPush?: boolean;
  adminUsers?: string;
  branchFilter?: string;
  active?: boolean;
  customPromptRules?: string | null;
  llmModel?: string;
  enablePRComments?: boolean;
}

export interface RepoConfig {
  name: string;
  repoUrl: string;
  githubToken?: string;
  webhookSecret?: string;
  allowPRs?: boolean;
  allowPush?: boolean;
  adminUsers?: string[];
  branchFilter?: string;
  active?: boolean;
}

export interface AppConfig {
  repositories: RepoConfig[];
}

export type AuditStatus =
  | 'PENDING'
  | 'ANALYZING'
  | 'GENERATING_TESTS'
  | 'EXECUTING_SANDBOX'
  | 'COMPLETED'
  | 'FAILED';

export type TestStatus = 'RUNNING' | 'PASSED' | 'FAILED' | 'HEALED' | 'TIMEOUT';

export interface AnalysisResult {
  id: string;
  auditId: string;
  category: string;
  severity: string;
  filePath: string;
  lineRange: string | null;
  description: string;
  suggestion: string | null;
  sourceSnippet: string | null;
  createdAt: string;
}

export interface HealingIteration {
  id: string;
  testResultId: string;
  iteration: number;
  testCode: string;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  errorAnalysis: string | null;
  createdAt: string;
}

export interface TestResult {
  id: string;
  auditId: string;
  testCode: string;
  status: TestStatus;
  exitCode: number | null;
  stdout: string | null;
  stderr: string | null;
  iterationCount: number;
  errorAnalysis: string | null;
  healingIterations: HealingIteration[];
  createdAt: string;
}

export interface Audit {
  id: string;
  projectId: string;
  project: Project;
  event: string;
  ref: string;
  commitHash: string;
  status: AuditStatus;
  analysisResults: AnalysisResult[];
  testResults: TestResult[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ProjectStats {
  id: string;
  name: string;
  repoUrl: string;
  totalAudits: number;
  auditStatusCounts: Record<string, number>;
  findingCategoryCounts: Record<string, number>;
  findingSeverityCounts: Record<string, number>;
  testStatusCounts: Record<string, number>;
  avgHealingIterations: number;
}

export interface GlobalStats {
  totalProjects: number;
  totalAudits: number;
  auditStatusCounts: Record<string, number>;
  findingCategoryCounts: Record<string, number>;
  findingSeverityCounts: Record<string, number>;
  testStatusCounts: Record<string, number>;
  avgHealingIterations: number;
}

export interface DashboardStats {
  global: GlobalStats;
  projects: ProjectStats[];
}

export interface WebhookEvent {
  id: string;
  projectId: string | null;
  event: string;
  repo: string;
  branch: string | null;
  sender: string;
  action: string;
  outcome: 'ACCEPTED' | 'REJECTED' | 'FILTERED';
  rejectReason: string | null;
  auditId: string | null;
  receivedAt: string;
}

export interface TrendData {
  date: string;
  Security: number;
  Performance: number;
  Maintainability: number;
  Stability: number;
  Flexibility: number;
  Extensibility: number;
  ErrorProne: number;
  testSuccessRate: number;
  avgHealingIterations: number;
  totalAudits: number;
}

export interface AuditCompareResult {
  left: {
    id: string;
    ref: string;
    event: string;
    commitHash: string;
    createdAt: string;
  };
  right: {
    id: string;
    ref: string;
    event: string;
    commitHash: string;
    createdAt: string;
  };
  comparison: {
    resolved: AnalysisResult[];
    added: AnalysisResult[];
    unchanged: AnalysisResult[];
    summary: {
      newCount: number;
      resolvedCount: number;
      unchangedCount: number;
    };
  };
}
