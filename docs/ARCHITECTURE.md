# Architecture Document - Src-Audit

## 1. System Overview
Src-Audit is designed as a distributed monorepo system. It leverages a task queue for asynchronous processing of AI-intensive tasks and provides a web interface for monitoring and results visualization.

## 2. Monorepo Structure
- `apps/webhook-server`: Receives GitHub webhooks, registers projects/audits, and enqueues tasks.
- `apps/agent-worker`: Consumes tasks from Redis, interacts with OpenAI API for analysis and test generation.
- `apps/portal`: React-based frontend for visualizing results.
- `packages/shared`: Shared database schema (Prisma), types, and utilities.

## 3. Data Flow
1. **Event Capture:** GitHub sends a webhook (Push/PR) to `webhook-server`.
2. **Registration:** `webhook-server` saves project/audit metadata to PostgreSQL.
3. **Queuing:** `webhook-server` adds a task to the BullMQ (Redis) queue.
4. **Processing:** `agent-worker` picks up the task:
    - Fetches diff/context (Current: Mock data, Planned: Real GitHub API).
    - Calls OpenAI GPT-4o for analysis.
    - Calls OpenAI GPT-4o for test generation.
5. **Storage:** Results are saved back to PostgreSQL via Prisma.
6. **Visualization:** `portal` fetches results from `webhook-server`'s API and displays them.

## 4. Technology Stack
- **Language:** TypeScript
- **Runtime:** Node.js
- **Frameworks:** Express (API), React + Vite + Tailwind CSS (Frontend)
- **Database:** PostgreSQL + Prisma ORM
- **Task Queue:** BullMQ + Redis
- **AI Engine:** OpenAI GPT-4o

## 5. Database Schema (Key Models)
- **Project:** Tracks repositories and installation IDs.
- **Audit:** Represents a specific audit event (linked to a commit/PR).
- **AnalysisResult:** Individual findings from AI analysis (Security, Performance, etc.).
- **TestResult:** Stores generated test code and its execution status.
