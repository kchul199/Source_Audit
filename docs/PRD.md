# 제품 요구사항 문서 - Src-Audit

## 1. 프로젝트 개요

Src-Audit는 GitHub webhook과 AI 분석을 결합한 자동 코드 감사 및 테스트 생성 시스템입니다. Push 또는 Pull Request 이벤트가 발생하면 변경 diff를 수집하고, 보안 취약점, 성능 병목, 유지보수성 문제를 분석한 뒤, 변경 내용에 맞는 테스트를 생성하고 샌드박스에서 실행합니다.

이 시스템은 사람의 코드 리뷰를 대체하기 위한 도구가 아니라, 리뷰어가 더 빠르고 일관된 기준으로 위험 지점을 파악할 수 있도록 돕는 보조 도구입니다.

## 2. 대상 사용자

- **개발자**: Push/PR 직후 변경 코드에 대한 빠른 피드백을 받고 싶은 사용자
- **리뷰어/리드 개발자**: 리뷰 전에 보안/성능/유지보수성 리스크를 먼저 확인하고 싶은 사용자
- **QA 담당자**: 변경 코드에 대한 테스트 관점과 생성 테스트를 참고하고 싶은 사용자
- **보안 담당자**: 반복적인 취약점 패턴을 자동으로 점검하고 싶은 사용자
- **관리자**: repository별 감사 이력과 품질 추이를 확인하고 싶은 사용자

## 3. 핵심 기능

### 3.1 GitHub Webhook 연동

- `push` 이벤트 지원
- `pull_request` 이벤트 중 `opened`, `synchronize` action 지원
- GitHub webhook HMAC 서명 검증
- repository URL 기반 프로젝트 설정 조회
- `https://github.com/<owner>/*` 형식의 계정/owner 전체 repository 설정 지원
- owner-wide 설정으로 들어온 repository를 실제 프로젝트로 자동 생성
- branch filter, Push/PR 허용 여부, active 상태에 따른 이벤트 필터링

### 3.2 AI 코드 분석

- GitHub diff와 변경 파일 컨텍스트 기반 분석
- OpenAI 기반 보안, 성능, 유지보수성 finding 생성
- severity 분류: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- finding별 파일 경로, 라인 범위, source snippet 기록
- AI finding의 실제 소스 근거 검증

### 3.3 AI 기반 테스트 생성

- 변경 코드와 분석 결과를 바탕으로 테스트 전략 생성
- 프로젝트 언어와 테스트 프레임워크를 고려한 테스트 코드 생성
- Node.js, Python, Go 프로젝트 흐름 지원
- Jest, Vitest, Mocha, node:test, pytest, go test 등 실행 경로 선택

### 3.4 샌드박스 실행

- Docker 기반 격리 실행
- 의존성 설치 단계와 테스트 실행 단계 분리
- 테스트 실행 단계 네트워크 차단
- 읽기 전용 rootfs, capability drop, no-new-privileges 등 하드닝 적용
- 실행 로그, exit code, timeout 결과 저장

### 3.5 관리 포탈

- 프로젝트 등록/수정/삭제
- webhook secret, GitHub token, Push/PR 감사 여부 설정
- webhook 이벤트 이력 조회
- audit 목록 및 상세 결과 조회
- finding, 생성 테스트, 실행 로그 확인
- 프로젝트별 통계 확인

## 4. 사용자 시나리오

- 개발자는 PR을 생성한 직후 보안/성능/유지보수성 이슈 요약을 확인한다.
- 리뷰어는 Audit Detail 화면에서 AI finding의 파일/라인/snippet 근거를 확인하고 리뷰에 반영한다.
- QA 담당자는 생성된 테스트 코드와 실행 로그를 참고해 수동 테스트 범위를 보완한다.
- 관리자는 Statistics 화면에서 repository별 감사 추세와 실패 현황을 확인한다.

## 5. 성공 기준

- GitHub Push/PR 이벤트가 들어오면 audit이 자동 생성된다.
- webhook signature 검증이 정상 동작한다.
- agent-worker가 실제 GitHub diff와 변경 파일 컨텍스트를 기반으로 분석한다.
- OpenAI 분석 결과와 테스트 생성 결과가 DB에 저장된다.
- Docker sandbox 실행 결과가 audit에 연결된다.
- 관리 포탈에서 프로젝트, 이벤트, audit, 상세 결과, 통계를 확인할 수 있다.

## 6. MVP 범위

- 로컬 Docker Compose 기반 실행
- GitHub webhook 수신 및 queue 등록
- OpenAI 기반 분석/테스트 생성
- Docker sandbox 테스트 실행
- 포탈 기반 설정 및 결과 조회
- E2E 흐름 검증 기록 작성

## 7. MVP 이후 과제

- GitHub App 기반 권한 모델 정리
- Check Run/PR comment 권한과 실패 처리 고도화
- 포탈 인증/권한 관리
- 고정 도메인 기반 webhook endpoint 운영
- 샌드박스 실행기 분리 및 Docker socket 의존성 축소
- finding 정확도 평가용 benchmark repository 구성
