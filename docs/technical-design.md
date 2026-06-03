# Technical Design: Src-Audit (AI Agent-Based Code Audit System)

## 1. System Architecture
The following diagram illustrates the interaction between components. The system is designed to be asynchronous and scalable using a task queue.

```mermaid
graph TD
    subgraph GitHub
        PR[Pull Request / Push]
    end

    subgraph "Infrastructure"
        WS[Webhook Server - Node.js/Express]
        Redis[(Redis - BullMQ)]
        DB[(PostgreSQL - Prisma)]
    end

    subgraph "AI Agent Engine"
        Worker[AI Agent Worker]
        OpenAI (GPT-4o)[[OpenAI (GPT-4o) API]]
        Sandbox[Docker Sandbox]
    end

    subgraph "Management Portal"
        Portal[Web Portal - React]
        API[Management API]
    end

    PR -->|Webhook Event| WS
    WS -->|Create Audit Record| DB
    WS -->|Push Task| Redis
    Redis -->|Fetch Task| Worker
    Worker -->|Read Context| GitHub
    Worker -->|Reasoning & Code Gen| OpenAI (GPT-4o)
    Worker -->|Execute Tests| Sandbox
    Sandbox -->|Return Logs/Exit Code| Worker
    Worker -->|Update Results| DB
    API -->|Read Audit Data| DB
    Portal -->|Query/Monitor| API
```

---

## 2. Database Schema (Prisma Definitions)

### ERD Overview
- **Project**: Target repository configuration.
- **Audit**: Main execution record for a specific event (e.g., a PR).
- **AnalysisResult**: Detailed findings from the context-aware code review.
- **TestResult**: Records for each generated test, including self-healing iterations.

### Prisma Schema
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Project {
  id            String   @id @default(cuid())
  name          String
  repoUrl       String   @unique
  githubAppId   String?
  installationId String?
  audits        Audit[]
  createdAt     DateTime @default(now())
}

model Audit {
  id              String           @id @default(cuid())
  projectId       String
  project         Project          @relation(fields: [projectId], references: [id])
  event           String           // e.g., "pull_request", "push"
  ref             String           // e.g., PR number or branch name
  commitHash      String
  status          AuditStatus      @default(PENDING)
  analysisResults AnalysisResult[]
  testResults     TestResult[]
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime         @default(now())
}

enum AuditStatus {
  PENDING
  ANALYZING
  GENERATING_TESTS
  EXECUTING_SANDBOX
  COMPLETED
  FAILED
}

model AnalysisResult {
  id          String   @id @default(cuid())
  auditId     String
  audit       Audit    @relation(fields: [auditId], references: [id])
  category    String   // "SECURITY", "PERFORMANCE", "MAINTAINABILITY"
  severity    String   // "CRITICAL", "HIGH", "MEDIUM", "LOW"
  filePath    String
  lineRange   String?
  description String
  suggestion  String?  // Proposed code fix
  createdAt   DateTime @default(now())
}

model TestResult {
  id             String    @id @default(cuid())
  auditId        String
  audit          Audit     @relation(fields: [auditId], references: [id])
  testCode       String
  status         TestStatus @default(RUNNING)
  exitCode       Int?
  stdout         String?
  stderr         String?
  iterationCount Int       @default(1)
  errorAnalysis  String?   // AI's analysis of failure
  createdAt      DateTime  @default(now())
}

enum TestStatus {
  RUNNING
  PASSED
  FAILED
  HEALED
  TIMEOUT
}
```

---

## 3. AI Agent Workflow

The AI Agent operates as a state machine within the worker.

### Step-by-Step Logic
1.  **Context Gathering**:
    - Fetch the PR Diff.
    - Traverse the dependency tree of modified files.
    - Read `GEMINI.md`, `README.md`, and `package.json` to understand project standards and dependencies.
2.  **Prompt Sequence - Analysis**:
    - **Persona**: Senior Software Architect / Security Researcher.
    - **Input**: Diff + Full File Context + Project Rules.
    - **Output**: JSON array of `AnalysisResult` (Security, Performance, Maintainability).
3.  **Prompt Sequence - Test Generation**:
    - **Goal**: Create unit tests for modified business logic using identified edge cases.
    - **Constraints**: Use existing project test frameworks (e.g., Jest). Mock external services.
4.  **Sandbox Execution & Self-Healing Loop**:
    - **Start**: Launch a Docker container.
    - **Run**: Mount source code (read-only) and the new test file. Execute the test command.
    - **Evaluate**: If exit code != 0:
        - Send `stderr` + `Test Code` back to OpenAI (GPT-4o).
        - OpenAI (GPT-4o) identifies the root cause (e.g., missing mock, syntax error).
        - OpenAI (GPT-4o) generates a "Healed" test code.
        - **Repeat**: Up to 3 times.
5.  **Finalization**: Store the best version of the test code and final logs in the database.

---

## 4. API Specifications

### Webhook Receiver (Internal/GitHub)
- `POST /webhooks/github`
  - Validates GitHub HMAC signature.
  - Parses PR metadata.
  - Creates an `Audit` record and triggers the `agent-queue`.

### Management Portal API
- `GET /api/projects`: List registered projects.
- `GET /api/audits?projectId=...`: Paginated list of audits for a project.
- `GET /api/audits/:id`: Detailed audit report including:
    - Status and timestamps.
    - Analysis results grouped by category.
    - Test code, execution logs, and healing history.
- `POST /api/audits/:id/retry`: Manual trigger to re-run the audit worker.

---

## 5. Security & Sandbox Design

### Docker Sandbox Configuration
To prevent the AI-generated code from compromising the host, the sandbox uses a strict profile:
- **Isolation**:
  - `NetworkDisabled: true` (after initial dependency install if allowed, or use a pre-built image with dependencies).
  - `ReadonlyRootfs: true` (except for a temporary `/tmp` or specific test directory).
  - `Memory: 512mb`, `NanoCpus: 1000000000` (1 Core).
- **Mounts**:
  - `Source Code`: Mounted as `RO` (Read-Only).
  - `Generated Test`: Mounted as `RW` in a specific scratch directory.
- **Auto-Cleanup**: Containers are forcibly removed (`AutoRemove: true`) after a 60-second timeout.

### GitHub Integration Security
- **Token Scope**: The GitHub App uses a **Read-Only** installation token for Repository Contents and Pull Requests. 
- **No Write Access**: Explicitly configured to prevent `POST`, `PATCH`, or `PUT` operations on the target repository's code. Reports are sent only to the internal Src-Audit Database and optionally as a PR Comment (if write-comment permission is granted).
