# Changelog - Src-Audit Implementation

## [2026-06-03]

### Added
- `docs/PRD.md`: Initial product requirements.
- `docs/ARCHITECTURE.md`: High-level system architecture and data flow.
- `docs/IMPLEMENTATION_PLAN.md`: Master roadmap for the project.
- `apps/webhook-server`: Added CORS support and new API endpoints:
    - `GET /api/projects`
    - `GET /api/audits` (with `projectId` filter)
    - `GET /api/audits/:id`
    - `POST /api/audits/:id/retry`
- `apps/portal`: Full React + Vite + Tailwind implementation:
    - Main Layout with sidebar navigation.
    - Projects dashboard.
    - Audit history listing with status badges.
    - Detailed audit reports with AI findings (categorized) and test code visualization.
    - API client integration.

### Fixed
- Webhook server signature verification logging (warn instead of block for dev).
- `agent-worker`: Fixed sandbox execution bug by allowing network access for `npm install` and using read-write mounts for the workspace.
- `apps/portal`: Fixed runtime errors in `AuditDetailPage.tsx` by adding missing `StatusBadge` component and `Activity` icon.

### Changed
- Refactored `webhook-server` to align with the technical design specifications.
- Initialized `apps/portal` using Vite (React + TypeScript).
- `agent-worker`: Replaced mock diffs with real GitHub data fetching using Octokit.
- `agent-worker`: Added automatic context gathering (fetches `GEMINI.md` from target repositories).
- `agent-worker`: Implemented `Sandbox` execution using Docker (isolated, memory-limited, self-contained networking for npm).
- `agent-worker`: Implemented AI self-healing loop for test code (up to 3 iterations).
- `agent-worker`: Added language-agnostic support (Node.js, Python, Go) with automatic environment detection.
- `webhook-server`: Integrated Socket.io for real-time audit status broadcasting.
- `apps/portal`: Integrated Socket.io-client for real-time UI updates (no refresh needed for audit status).
- `OpenAIAgent`: Updated prompts to be framework-agnostic.
- `OpenAIAgent`: Added `healTestCode` capability.
- `apps/portal`: Enhanced UI/UX with dashboard stats, sticky headers, and improved findings visualization.
- `docker-compose.yml`: Added full system orchestration (Backend, Worker, Portal).
- `README.md`: Added comprehensive project overview and quick start guide.
