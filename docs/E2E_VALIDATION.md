# E2E 검증 기록

## 검증 일시
- 2026년 6월 5일

## 검증 목표
- Docker Compose 환경에서 `webhook-server`, `agent-worker`, PostgreSQL, Redis, Portal이 함께 기동되는지 확인한다.
- GitHub 형식의 서명된 webhook이 실제 API로 들어와 audit job을 생성하는지 확인한다.
- worker가 실제 GitHub API로 diff를 가져오고 OpenAI API로 분석/테스트 생성을 수행하는지 확인한다.
- 생성된 테스트가 Docker sandbox 실행 단계까지 도달하고, 실패 시 self-healing 반복과 DB 기록이 남는지 확인한다.

## 수행한 검증

### 1. Docker Compose 기동
```bash
docker compose up -d --build
curl -fsS http://localhost:3001/health
docker compose ps
```

결과:
- PostgreSQL, Redis, webhook-server, agent-worker, portal 컨테이너가 기동됨.
- `GET /health`가 `{"status":"ok","service":"webhook-server"}` 응답을 반환함.

### 2. Webhook 서명 검증
잘못된 secret으로 생성한 `X-Hub-Signature-256` 요청을 보냈다.

결과:
- `401 Invalid signature` 반환.
- raw body 기반 HMAC 검증이 정상 동작함.

### 3. 실제 GitHub + OpenAI 경로
서명된 `push` webhook을 공개 저장소 commit에 대해 전송했다.

검증에 사용한 저장소:
- `sindresorhus/is`
- `lodash/lodash`

확인된 경로:
- webhook `202 Accepted`
- audit record 생성
- BullMQ worker job 소비
- GitHub commit diff 조회
- OpenAI 분석 호출
- 분석 결과 DB 저장
- OpenAI 테스트 생성 호출
- repository clone 및 지정 commit checkout
- Docker sandbox container 시작
- sandbox 실패 결과와 healing iteration 기록
- 최종 audit 상태 저장

대표 audit:
- `cmq0qng7300040vpivyqoiaqd`
- 저장소: `https://github.com/lodash/lodash`
- commit: `a02353279093cca0fea1c8cc468ffbf03bb3485b`
- 최종 상태: `FAILED`
- 분석 결과: 6건
- 테스트 결과: 1건
- healing iteration: 3건

최종 상태가 `FAILED`인 이유:
- E2E 파이프라인은 끝까지 수행되었으나, 대상 저장소의 sandbox 의존성 설치가 exit code `254`로 실패했다.
- 실패가 DB에 기록되고 self-healing 루프가 3회까지 수행되는 것은 확인했다.

## 검증 중 발견해 수정한 문제
- backend Docker 이미지에 `git`이 없어 clone 단계에서 실패하던 문제를 수정했다.
- worker 컨테이너의 내부 status callback URL이 `localhost`를 향하던 문제를 Docker Compose 서비스 이름 기반 URL로 수정했다.
- sandbox runtime image가 host Docker cache에 없을 때 자동 pull을 시도하도록 수정했다.
- Dockerode 로그 반환값이 stream이 아닌 Buffer/string일 수 있는 경우를 처리하도록 수정했다.
- 같은 audit의 BullMQ retry와 수동 retry가 동시에 실행되어 workspace와 DB record가 충돌하던 문제를 줄이기 위해 audit id 기반 job id와 worker concurrency 제한을 적용했다.
- git clone 실패 로그에 GitHub token이 포함될 수 있는 문제를 완화하기 위해 git 오류 메시지를 sanitize하도록 수정했다.

## 남은 운영 리스크
- GitHub Check Run 생성은 현재 PAT 권한으로는 실패한다. GitHub App 또는 checks write 권한이 있는 token이 필요하다.
- sandbox 의존성 설치 실패 원인을 사용자에게 더 명확히 보여주려면 install phase stdout/stderr 보존 품질을 더 개선해야 한다.
- Node 프로젝트마다 `npm install --ignore-scripts`가 테스트 실행에 충분하지 않을 수 있다. 운영에서는 프로젝트별 install policy 설정이 필요하다.
- Docker socket을 worker에 mount하는 구조는 강력한 권한을 부여한다. 운영 환경에서는 별도 sandbox runner 또는 원격 격리 실행기를 권장한다.

## 재현 명령 요약
```bash
docker compose up -d --build
curl -fsS http://localhost:3001/health
curl -fsS "http://localhost:3001/api/audits?limit=1"
docker compose logs --no-color --tail=200 agent-worker webhook-server
```
