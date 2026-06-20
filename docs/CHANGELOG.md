# 변경 이력 - Src-Audit

## 2026-06-20

### 추가

- 팀 공유용 발표/시연 문서 `docs/TEAM_HANDOFF.md` 작성
- README 문서 목록에 팀 공유 문서, E2E 검증 기록, 샌드박스 하드닝 설계, 변경 이력 링크 추가

### 변경

- README와 주요 프로젝트 문서를 한국어 기준으로 정리
- 팀 공유 문서를 기획 의도, 기획서 요약, 전체 흐름도, 시연 시나리오 중심으로 재작성

## 2026-06-05

### 추가

- Docker Compose 기반 E2E 검증 기록 추가
- 샌드박스 하드닝 설계 문서 추가
- 실제 GitHub webhook payload, GitHub diff 조회, OpenAI 호출, sandbox 실행 경로 검증 기록 추가

### 수정

- backend Docker 이미지에 `git`이 없어 clone 단계에서 실패하던 문제 수정
- worker 컨테이너의 내부 status callback URL이 `localhost`를 향하던 문제 수정
- sandbox runtime image가 host Docker cache에 없을 때 자동 pull을 시도하도록 개선
- Dockerode 로그 반환값이 stream이 아닌 Buffer/string일 수 있는 경우 처리
- 같은 audit의 중복 실행 충돌을 줄이기 위해 audit id 기반 job id와 worker concurrency 제한 적용
- git clone 실패 로그에서 GitHub token이 노출될 수 있는 문제를 완화하기 위해 오류 메시지 sanitize 적용

## 2026-06-03

### 추가

- `docs/PRD.md`: 초기 제품 요구사항 문서 작성
- `docs/ARCHITECTURE.md`: 시스템 아키텍처와 데이터 흐름 문서 작성
- `docs/IMPLEMENTATION_PLAN.md`: 프로젝트 구현 계획 작성
- `apps/webhook-server`: CORS 및 포탈용 API endpoint 추가
  - `GET /api/projects`
  - `GET /api/audits`
  - `GET /api/audits/:id`
  - `POST /api/audits/:id/retry`
- `apps/portal`: React + Vite + Tailwind 기반 관리 포탈 구현
  - 사이드바 기반 Main Layout
  - Projects/Dashboard 화면
  - Audit History 목록
  - Audit Detail 상세 리포트
  - AI finding 분류 표시
  - 생성 테스트 코드 및 실행 로그 표시
  - API client 연동

### 수정

- webhook server signature 검증 로그 처리 개선
- `agent-worker`: `npm install` 단계와 workspace mount 처리 문제 수정
- `apps/portal`: `AuditDetailPage.tsx` 런타임 오류 수정

### 변경

- `webhook-server`를 기술 설계에 맞게 재구성
- `apps/portal`을 Vite, React, TypeScript 기반으로 초기화
- `agent-worker`의 mock diff를 Octokit 기반 실제 GitHub diff 조회로 교체
- `agent-worker`에 프로젝트 컨텍스트 자동 수집 기능 추가
- `agent-worker`에 Docker 기반 sandbox 실행 구현
- `agent-worker`에 테스트 코드 self-healing loop 구현
- Node.js, Python, Go 프로젝트 자동 감지 지원 추가
- `webhook-server`에 Socket.io 기반 audit 상태 broadcast 추가
- `apps/portal`에 Socket.io client 기반 실시간 상태 업데이트 추가
- `OpenAIAgent` prompt를 프레임워크 비의존적으로 개선
- `OpenAIAgent`에 `healTestCode` 기능 추가
- 포탈 dashboard 통계, sticky header, finding 시각화 개선
- `docker-compose.yml`에 backend, worker, portal 전체 orchestration 구성 추가
