# Src-Audit

Src-Audit는 GitHub Push/Pull Request 이벤트를 받아 변경 소스를 자동 분석하고, OpenAI 기반 코드 감사와 테스트 생성을 수행한 뒤, Docker 샌드박스에서 검증 결과를 실행/저장/시각화하는 AI 코드 감사 시스템입니다.

## 주요 기능

- **GitHub 연동**: Push와 Pull Request 이벤트를 webhook으로 수신해 자동 감사 작업을 생성합니다.
- **AI 코드 분석**: OpenAI 기반으로 보안, 성능, 유지보수성 관점의 finding을 생성합니다.
- **소스 근거 검증**: AI finding의 파일 경로, 라인 범위, source snippet이 실제 변경 내용과 맞는지 검증합니다.
- **테스트 생성**: 변경 코드와 분석 결과를 바탕으로 테스트 전략과 테스트 코드를 생성합니다.
- **Docker 샌드박스**: 의존성 설치와 테스트 실행을 분리하고, 테스트 실행 단계는 네트워크 차단/읽기 전용 환경에서 수행합니다.
- **관리 포탈**: 프로젝트 설정, webhook 이벤트, 감사 이력, 상세 결과, 통계를 확인합니다.

## 빠른 시작

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env`에 최소 다음 값을 설정합니다.

```env
OPENAI_API_KEY=...
GITHUB_TOKEN=...
GITHUB_WEBHOOK_SECRET=...
```

### 2. Docker Compose 실행

```bash
docker compose up -d --build
```

주요 서비스:

- `postgres`: 감사 데이터 저장소
- `redis`: BullMQ 작업 큐
- `webhook-server`: GitHub webhook 수신 및 포탈 API
- `agent-worker`: AI 분석/테스트 생성/sandbox 실행
- `portal`: 관리 포탈

### 3. 관리 포탈 접속

Docker Compose의 포탈은 기본적으로 다음 주소에서 확인합니다.

```text
http://localhost
```

로컬 Vite 개발 서버를 직접 실행하는 경우에는 다음 주소를 사용합니다.

```text
http://127.0.0.1:5173
```

주의: 다른 Vite 앱이 `localhost:5173`을 사용 중이면 잘못된 화면이 열릴 수 있으므로, 로컬 개발 확인 시 `127.0.0.1:5173` 사용을 권장합니다.

## 개발 실행

### Webhook 서버

```bash
npm run dev:webhook
```

### Agent Worker 실행기

```bash
npm run dev:worker
```

### 포탈

```bash
cd apps/portal
npm run dev
```

## GitHub Webhook 설정

GitHub repository에서 다음 경로로 이동합니다.

```text
Settings > Webhooks > Add webhook
```

입력값:

```text
Payload URL: https://<외부 터널 주소>/webhooks/github
Content type: application/json
Secret: Src-Audit 포탈에 등록한 Webhook Signature Secret과 동일한 값
Events: Pushes, Pull requests
```

로컬 서버는 GitHub에서 직접 접근할 수 없으므로 `cloudflared` 또는 `ngrok` 같은 터널이 필요합니다.

```bash
cloudflared tunnel --url http://127.0.0.1:3001
```

출력 URL이 `https://example.trycloudflare.com`이면 GitHub Payload URL은 다음과 같습니다.

```text
https://example.trycloudflare.com/webhooks/github
```

### kchul199 계정 전체 repository 감사

현재 `src-audit.config.json`에는 다음 owner-wide 설정이 포함되어 있습니다.

```json
{
  "name": "kchul199 전체 GitHub 계정",
  "repoUrl": "https://github.com/kchul199/*",
  "allowPRs": true,
  "allowPush": true,
  "adminUsers": ["kchul199"],
  "branchFilter": "*",
  "active": true
}
```

이 설정은 `https://github.com/kchul199/<repository>` 형태의 모든 repository webhook을 감사 대상으로 허용합니다. 처음 이벤트가 들어온 repository는 실제 repository URL 기준의 프로젝트로 자동 생성되고, 이후 audit 이력은 해당 repository 프로젝트에 저장됩니다.

주의: GitHub 개인 계정의 모든 repository 이벤트를 한 번에 받으려면 GitHub App을 모든 repository에 설치하거나, 각 repository에 동일한 Payload URL과 Secret으로 webhook을 등록해야 합니다. Src-Audit 서버는 계정 전체 매칭을 지원하지만, GitHub가 이벤트를 보내도록 하는 설정은 GitHub 쪽에 필요합니다.

## 동작 흐름

1. 개발자가 GitHub에 Push 또는 Pull Request를 생성합니다.
2. GitHub가 `POST /webhooks/github`로 webhook을 전송합니다.
3. `webhook-server`가 HMAC 서명을 검증하고 프로젝트 설정을 조회합니다.
4. audit record를 PostgreSQL에 저장하고 Redis/BullMQ queue에 job을 등록합니다.
5. `agent-worker`가 job을 가져와 GitHub diff와 변경 파일 컨텍스트를 수집합니다.
6. OpenAI를 호출해 코드 분석 결과와 테스트 코드를 생성합니다.
7. Docker sandbox에서 생성 테스트를 실행합니다.
8. 분석/테스트 결과를 PostgreSQL에 저장합니다.
9. 관리 포탈에서 감사 이력과 상세 결과를 확인합니다.

## 운영 확인 명령

서비스 상태:

```bash
docker compose ps
```

Webhook 서버 상태:

```bash
curl -fsS http://127.0.0.1:3001/health
```

최근 로그:

```bash
docker compose logs --no-color --tail=120 webhook-server
docker compose logs --no-color --tail=120 agent-worker
```

포탈 빌드 검증:

```bash
npm run lint --workspace=portal
npm run build --workspace=portal
```

## 문서

- [팀 공유 문서](./docs/TEAM_HANDOFF.md)
- [제품 요구사항 문서](./docs/PRD.md)
- [아키텍처 문서](./docs/ARCHITECTURE.md)
- [기술 설계 문서](./docs/technical-design.md)
- [구현 계획](./docs/IMPLEMENTATION_PLAN.md)
- [E2E 검증 기록](./docs/E2E_VALIDATION.md)
- [샌드박스 하드닝 설계](./docs/SANDBOX_HARDENING.md)
- [변경 이력](./docs/CHANGELOG.md)
