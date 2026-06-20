# 아키텍처 문서 - Src-Audit

## 1. 시스템 개요

Src-Audit는 GitHub 이벤트를 비동기 작업으로 처리하는 모노레포 기반 분산 시스템입니다. GitHub webhook 수신, audit job queue 등록, AI 분석, 테스트 생성, 샌드박스 실행, 결과 저장, 포탈 조회가 분리된 컴포넌트로 동작합니다.

## 2. 모노레포 구조

- `apps/webhook-server`: GitHub webhook 수신, 서명 검증, 프로젝트/audit 저장, BullMQ job 등록, 포탈 API 제공
- `apps/agent-worker`: Redis queue job 소비, GitHub diff 조회, OpenAI 분석/테스트 생성, Docker sandbox 실행
- `apps/portal`: React + Vite 기반 관리 포탈
- `packages/shared`: Prisma schema, DB client, 공통 타입, 설정 동기화 유틸리티

## 3. 주요 구성 요소

| 구성 요소 | 역할 |
| --- | --- |
| GitHub | Push/PR 이벤트 발생, webhook 전송, diff/context 제공 |
| webhook-server | 이벤트 수신, HMAC 검증, audit 생성, queue 등록, 관리 API 제공 |
| Redis/BullMQ | audit job queue |
| agent-worker | 비동기 audit 처리, AI 호출, sandbox 실행 |
| OpenAI API | 코드 분석, 테스트 전략/테스트 코드 생성 |
| Docker Sandbox | 생성 테스트를 격리 환경에서 실행 |
| PostgreSQL | 프로젝트, audit, finding, 테스트 결과, webhook 이벤트 저장 |
| Portal | 설정 관리, 감사 이력/결과/통계 시각화 |

## 4. 데이터 흐름

1. GitHub가 Push/PR 이벤트를 `webhook-server`로 전송합니다.
2. `webhook-server`가 raw body와 signature header로 요청을 검증합니다.
3. repository 정확 매칭 또는 `https://github.com/<owner>/*` owner-wide 설정을 조회합니다.
4. owner-wide 설정으로 매칭된 경우 실제 repository 프로젝트를 자동 생성하거나 갱신합니다.
5. 이벤트 허용 여부를 판단합니다.
6. `webhookEvent`와 `audit` record를 PostgreSQL에 저장합니다.
7. audit id를 job id로 사용해 Redis/BullMQ queue에 등록합니다.
8. `agent-worker`가 job을 가져와 GitHub diff와 소스 컨텍스트를 수집합니다.
9. OpenAI API를 호출해 finding과 테스트 코드를 생성합니다.
10. Docker sandbox에서 생성 테스트를 실행합니다.
11. 분석 결과와 테스트 결과를 PostgreSQL에 저장합니다.
12. `webhook-server` API와 Socket.io를 통해 포탈에 상태와 결과를 제공합니다.

## 5. 기술 스택

- **언어**: TypeScript
- **런타임**: Node.js
- **Backend/API**: Express
- **Frontend**: React, Vite, Tailwind CSS
- **Database**: PostgreSQL, Prisma ORM
- **Queue**: Redis, BullMQ
- **AI Engine**: OpenAI API
- **Sandbox**: Docker
- **Realtime**: Socket.io

## 6. 주요 데이터 모델

- **Project**: 감사 대상 repository 설정, token, webhook secret, Push/PR 허용 여부
- **Audit**: 특정 Push/PR 이벤트에 대한 감사 실행 단위
- **WebhookEvent**: GitHub에서 수신한 webhook 이벤트 기록
- **AnalysisResult**: AI 분석 finding
- **TestResult**: 생성 테스트 코드와 실행 결과
- **HealingIteration**: self-healing 반복 과정과 실패 분석 기록

## 7. 보안 관점

- GitHub webhook은 HMAC signature로 검증합니다.
- repository별 webhook secret을 전역 secret보다 우선 적용합니다.
- 테스트 실행 단계는 네트워크를 차단합니다.
- sandbox 컨테이너에는 read-only rootfs, capability drop, no-new-privileges를 적용합니다.
- GitHub token이 로그에 노출되지 않도록 오류 메시지를 sanitize합니다.

## 8. 운영상 주의 사항

- 로컬 환경에서 GitHub webhook을 받으려면 외부 터널이 필요합니다.
- agent-worker는 OpenAI API와 GitHub API에 의존하므로 token 상태가 중요합니다.
- Docker socket mount 구조는 운영 환경에서 추가 격리가 필요합니다.
- GitHub Check Run은 GitHub App 또는 적절한 checks 권한이 필요합니다.
