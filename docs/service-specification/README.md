# GJU Photography Reservation 서비스 통합 명세

- 문서 기준일: 2026-07-26
- 구현 기준: `main` 브랜치, 커밋 `1e3aeb3`
- 대상 서비스: 광주대학교 사진영상미디어학과 예약·운영 서비스
- 문서 목적: 기존 서비스에 GJU Photography Reservation을 연결하거나 흡수하기 위한 구현 기준서

## 문서 구성

| 문서 | 주요 독자 | 내용 |
| --- | --- | --- |
| [01. 서비스 개요와 아키텍처](./01-service-overview.md) | 기획, 개발, 운영 | 목적, 사용자, 범위, 기술 구조, 시스템 경계 |
| [02. 전체 기능 및 업무 규칙 명세](./02-functional-specification.md) | 기획, 프론트엔드, 백엔드, QA | 학생·관리자 기능, 예약 규칙, 수요조사, 지표 산식 |
| [03. API 및 인증 연동 명세](./03-api-integration-specification.md) | 백엔드, 연동 개발 | 인증, 공통 규약, 전체 API 목록, 요청·응답 예시 |
| [04. 데이터베이스 및 데이터 모델 명세](./04-database-specification.md) | 백엔드, DBA | 운영 SQLite 구조, JSON 계약, 관계, 보관·삭제 규칙 |
| [05. 배포·운영·보안 명세](./05-deployment-operations-security.md) | DevOps, 운영, 보안 | Cloudflare·웹·네이티브 구성, 비밀값, 모니터링, QA |
| [06. 기존 서비스 통합 체크리스트](./06-integration-checklist.md) | PM, 아키텍트, 개발 리드 | 권장 연동 방식, 마이그레이션, 검수, 전환·롤백 |

공유용 단일 문서는 같은 폴더의 `GJU-Photography-Reservation-통합서비스명세서.docx`를 사용한다. Markdown 문서가 변경 이력과 개발 기준의 원본이며, DOCX는 검토·공유용 산출물이다.

## 문서에서 사용하는 구분

- **현재 구현**: 현재 코드와 운영 설정에서 실제 동작하는 내용이다.
- **연동 권장**: 기존 서비스와 결합할 때 권장하는 구조다. 현재 코드에 자동 적용되는 내용은 아니다.
- **제외 범위**: 이번 서비스의 책임이 아니거나, 화면에서는 제공하지 않는 기능이다.
- **레거시/보조 API**: 백엔드에는 남아 있지만 기존 서비스 통합의 기본 대상이 아닌 기능이다.

## 핵심 결론

1. 기존 서비스와의 1차 통합은 DB 직접 결합보다 `/api/*`를 통한 API 어댑터 방식이 안전하다.
2. 운영 저장소는 Cloudflare D1이 아니라 **단일 Durable Object의 SQLite 저장소**다.
3. 인증은 쿠키가 아니라 `Authorization: Bearer <token>` 방식이다.
4. 학생 핵심 기능은 4종 예약, 내 예약, 보고서, 특강, 공지, 즐겨찾기·재예약, 교과 수요조사다.
5. 관리자 핵심 기능은 승인, 예약·장비·보고서·특강·공지 관리, 수요조사 생성·집계, 운영 통계, 설정, 로그·세션, 백업·정리다.
6. 교과 기능의 운영 핵심은 **학년·학기별 후보 5~6개 설문 생성과 학생 1~5순위 투표**다. 학교 공식 편성안 작성은 통합 범위에서 제외한다.

## 현재 구현에서 반드시 인지할 제한

- 외래 키는 DB에 선언하지 않고 애플리케이션 코드가 관계 무결성을 관리한다.
- 수요조사·과목 마스터는 정규화 테이블이 아니라 `coursePlanning` 단일 JSON 문서 안에 저장된다.
- 네이티브 알림은 서버 푸시가 아니라 기기 로컬 알림이다.
- 결과 사진 파일을 서비스가 직접 저장하지 않고 Google Drive 공유 URL을 저장한다.
- Slack 전송 실패는 예약 처리 자체를 중단시키지 않는다.
- 로그인 시도 제한은 런타임 메모리 기반이므로 재시작 후 초기화될 수 있다.
- 관리자 역할은 현재 `admin` 단일 역할이며 세부 권한 분리는 구현되어 있지 않다.
- 관리자 교과 화면에는 공식 연간 편성안 작성 기능을 노출하지 않는다. 관련 백엔드 API는 레거시/보조 기능으로 취급한다.

## 기준 소스

- `core.mjs`, `core/*.mjs`
- `storage-sql.mjs`, `worker-storage.mjs`
- `worker.mjs`, `server.mjs`, `functions/api/[[path]].js`
- `src/react/admin/*`, `src/react/student/*`, `public/js/*`
- `wrangler.worker.jsonc`, `wrangler.jsonc`, `capacitor.config.json`
- `android/app/build.gradle`, `ios/App/App.xcodeproj/project.pbxproj`

