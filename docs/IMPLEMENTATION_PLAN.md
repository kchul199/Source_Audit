# 구현 계획 - Src-Audit

## 1. 1단계: 인프라 및 문서화 완료

- [x] PRD 문서 작성
- [x] 아키텍처 문서 작성
- [x] 기술 설계 문서 정리
- [x] Webhook Server API에 CORS 및 포탈용 endpoint 추가
- [x] Vite + React + TypeScript 기반 포탈 scaffold 구성

## 2. 2단계: 포탈 프론트엔드 개발 완료

- [x] Tailwind CSS 및 Lucide icon 설정
- [x] React Router와 Main Layout 구성
- [x] Projects/Dashboard 화면 구현
- [x] Audit History 화면 구현
- [x] Audit Detail 화면 구현
  - [x] 보안, 성능, 유지보수성 finding 요약
  - [x] 테스트 코드와 실행 로그 표시
  - [x] 수동 `Retry Audit` 기능
- [x] Node.js, Python, Go 프로젝트 자동 감지 흐름 반영
- [x] Socket.io 기반 audit 상태 실시간 업데이트 연동

## 3. 3단계: 실제 데이터 연동 완료

- [x] `agent-worker`의 mock diff를 실제 GitHub API 호출로 교체
- [x] GitHub commit/PR diff 조회 구현
- [x] repository clone/checkout 기반 소스 컨텍스트 수집 구현
- [x] 프로젝트별 지침 파일(`GEMINI.md`, `README.md`, `package.json` 등) 수집 흐름 구현
- [x] AI finding의 path, line range, source snippet 근거 검증 추가

## 4. 4단계: 샌드박스 실행 완료

- [x] Docker 기반 sandbox 환경 구성
- [x] 생성 테스트 self-healing loop 구현
- [x] 의존성 설치 단계와 테스트 실행 단계를 별도 컨테이너로 분리
- [x] 테스트 실행 단계 네트워크 차단
- [x] 읽기 전용 rootfs, non-root 실행, capability drop, no-new-privileges 적용
- [x] sandbox runtime image 자동 확인/pull 로직 추가
- [x] Go 테스트를 변경 파일이 있는 패키지 디렉터리 기준으로 실행

## 5. 5단계: 검증 및 배포 준비 진행

- [x] 포탈 UI/UX polish
- [x] API 연결 실패 및 저장 실패 오류 메시지 개선
- [x] Docker Compose 기반 전체 실행 구성
- [x] 실제 GitHub webhook payload 수신 검증
- [x] GitHub diff 조회 검증
- [x] OpenAI 분석/테스트 생성 호출 경로 검증
- [x] Docker sandbox 실행 경로 검증
- [x] E2E 검증 기록 작성
- [x] sandbox 하드닝 문서 작성
- [x] 팀 공유 문서 작성
- [ ] backend/worker 자동화 테스트 추가
- [ ] GitHub Check Run 권한 구성을 GitHub App 기반으로 정리
- [ ] 포탈 인증/권한 관리 추가
- [ ] 운영용 고정 webhook endpoint 구성

## 6. 남은 우선 과제

1. GitHub App 기반 권한 모델 정리
2. Check Run/PR comment 성공/실패 처리 고도화
3. sandbox runner 분리 또는 Docker socket 의존성 축소
4. finding 정확도 평가 benchmark repository 구성
5. OpenAI 호출 비용, timeout, retry 정책 정교화
6. 포탈 인증/권한 관리
7. 운영 모니터링과 알림 정책 추가
