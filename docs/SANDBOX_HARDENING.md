# 샌드박스 하드닝 설계

## 목표
AI가 생성한 테스트 코드는 신뢰할 수 없는 코드로 간주한다. 샌드박스는 이 코드가 호스트, 네트워크, 다른 프로젝트 파일, 장기 실행 리소스에 영향을 주지 못하도록 제한해야 한다.

## 현재 적용된 보호 장치

### 실행 단계 분리
- 의존성 설치 단계와 테스트 실행 단계를 별도 컨테이너로 분리했다.
- 설치 단계는 네트워크 접근과 쓰기 가능한 workspace가 필요하므로 상대적으로 완화된 정책을 사용한다.
- 테스트 실행 단계는 네트워크를 차단하고 workspace를 읽기 전용으로 마운트한다.

### 테스트 실행 컨테이너 제한
- `NetworkMode: none`
- `ReadonlyRootfs: true`
- workspace read-only mount
- `/tmp` 전용 tmpfs 제공
- `PidsLimit: 256`
- `Memory: 512MiB`
- `NanoCpus: 1 core`
- `CapDrop: ["ALL"]`
- `SecurityOpt: ["no-new-privileges:true"]`
- non-root user `65534:65534`

### 런타임 이미지 관리
- sandbox 실행 전 필요한 runtime image를 inspect한다.
- image가 없으면 pull을 시도한 뒤 다시 inspect한다.
- 운영 환경에서는 CI/CD 또는 배포 단계에서 `node:20-alpine`, `python:3.11-slim`, `golang:1.21-alpine`을 미리 pull해두는 것을 권장한다.

### 프로젝트별 실행 환경
- Node: `npm install --ignore-scripts` 후 `npx jest`
- Python: `pytest`와 `requirements.txt` 의존성을 별도 target directory에 설치
- Go: module cache를 workspace 하위 전용 directory로 제한

## 이번에 수정한 보안/안정성 항목
- Dockerfile에 `git`을 설치해 worker container에서 실제 clone이 가능하도록 했다.
- git 오류 로그에서 GitHub token이 노출되지 않도록 메시지를 sanitize한다.
- clone 전 기존 workspace를 삭제해 이전 실패 작업의 잔여 파일과 충돌하지 않게 했다.
- BullMQ job id를 audit id로 고정해 같은 audit의 중복 대기 job 생성을 줄였다.
- worker concurrency를 1로 낮춰 동일 worker process 내 sandbox workspace 경합을 줄였다.
- sandbox 완료 후 timeout timer가 남아 false timeout 로그를 찍지 않도록 정리했다.

## 아직 필요한 추가 하드닝
- Docker socket 직접 mount 제거 또는 별도 sandbox runner로 분리
- seccomp/apparmor profile 명시
- 설치 단계에서도 package lifecycle script 실행을 더 강하게 제한하는 project policy 도입
- registry pull 실패 대비 pre-pulled image 검증 healthcheck 추가
- install/test phase별 stdout/stderr 보존 개선
- audit별 distributed lock 도입
- sandbox image digest pinning

## 운영 권장값
운영 배포 전에는 최소한 다음을 준비한다.

```bash
docker pull node:20-alpine
docker pull python:3.11-slim
docker pull golang:1.21-alpine
```

GitHub Check Run을 사용하려면 GitHub App 또는 checks write 권한이 있는 token을 사용한다. 일반 PAT는 공개 저장소나 권한 범위에 따라 `Resource not accessible by personal access token` 오류가 날 수 있다.
