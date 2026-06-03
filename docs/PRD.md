# Product Requirements Document (PRD) - Src-Audit

## 1. Project Overview
Src-Audit is an automated AI-driven code audit and test generation system. It integrates with GitHub via webhooks to automatically analyze code changes (Push, Pull Requests), identify security vulnerabilities, performance bottlenecks, and maintainability issues, and generate corresponding unit tests to verify the changes.

## 2. Target Audience
- Developers who want instant feedback on their code changes.
- Security engineers looking for automated vulnerability detection.
- Teams aiming to improve test coverage through AI assistance.

## 3. Core Features

### 3.1 GitHub Webhook Integration
- Support for `push` and `pull_request` (opened, synchronize) events.
- Automatic project registration/upserting based on repository metadata.

### 3.2 AI Code Analysis
- Static analysis of code diffs using OpenAI GPT-4o.
- Classification of findings into SECURITY, PERFORMANCE, and MAINTAINABILITY.
- Severity levels: CRITICAL, HIGH, MEDIUM, LOW.

### 3.3 AI-Powered Test Generation
- Automatic generation of Jest unit tests based on the code changes.
- Mocking of external dependencies and database calls.

### 3.4 Sandbox Execution (Milestone 4 - Planned)
- Execution of generated tests in a secure, isolated environment (e.g., Docker/Wasm).
- Verification of test results and reporting back to the system.

### 3.5 Web Portal Dashboard (Milestone 5 - Current)
- A centralized dashboard to visualize projects, audit history, and detailed AI findings.

## 4. User Stories
- "As a developer, I want to receive a summary of security issues immediately after opening a PR."
- "As a QA lead, I want to see the AI-generated tests to jumpstart our testing phase."
- "As a manager, I want a dashboard to track the health and audit history of all our repositories."

## 5. Success Metrics
- Reduction in manual code review time for common issues.
- Increase in test coverage for new features.
- Successful identification of critical security vulnerabilities before merging.
