# Src-Audit

AI-Powered Automated Code Audit & Test Generation System.

## Features
- **GitHub Integration**: Automatically analyze Pull Requests and Pushes.
- **AI Analysis**: Security, Performance, and Maintainability checks using GPT-4o.
- **Automated Testing**: Generates Jest unit tests for code changes.
- **Docker Sandbox**: Securely executes tests in an isolated environment.
- **Self-Healing**: AI automatically fixes failing tests based on error logs.
- **Management Portal**: Visual dashboard for monitoring audits and results.

## Quick Start (with Docker)

1. **Clone the repository**
2. **Setup environment variables**:
   ```bash
   cp .env.example .env
   # Fill in OPENAI_API_KEY and GITHUB_TOKEN
   ```
3. **Run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```
4. **Access the Portal**: Open `http://localhost:5173`

## Development

### Webhook Server
```bash
npm run dev:webhook
```

### Agent Worker
```bash
npm run dev:worker
```

### Portal
```bash
cd apps/portal
npm run dev
```

## Documentation
- [PRD](./docs/PRD.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Technical Design](./docs/technical-design.md)
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)
