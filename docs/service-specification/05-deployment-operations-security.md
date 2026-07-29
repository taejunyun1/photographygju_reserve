# 05. 배포·운영·보안 명세

## 1. 배포 구성

### 1.1 Cloudflare Worker

설정 파일: `wrangler.worker.jsonc`

| 항목 | 값 |
| --- | --- |
| Worker name | `photographygju-reserve` |
| Entry | `worker.mjs` |
| Compatibility date | `2026-06-12` |
| Observability | enabled |
| Assets | `public/` |
| Assets binding | `ASSETS` |
| API routing | Worker first |
| Durable Object binding | `GJU_RESERVE_DB` |
| Durable Object class | `GjuReserveDb` |
| SQLite migration tag | `v1` |
| Cron | `0 18 */3 * *` |

배포:

```bash
npm run deploy
```

미리보기:

```bash
npm run preview
```

### 1.2 Cloudflare Pages

설정 파일: `wrangler.jsonc`

| 항목 | 값 |
| --- | --- |
| Pages project | `gju-reserve` |
| Build output | `dist/` |
| Worker API base | `https://photographygju-reserve.taejunyun.workers.dev` |

빌드·배포:

```bash
npm run build
npm run pages:deploy
```

Pages Function `functions/api/[[path]].js`는 들어온 `/api/*` 요청의 메서드, 헤더, 쿼리, 본문을 Worker로 전달한다.

### 1.3 도메인

- 기본: `https://gjureserve.co.kr`
- 별칭: `https://www.gjureserve.co.kr`
- Pages fallback: `https://gju-reserve.pages.dev`
- Worker 직접: `https://photographygju-reserve.taejunyun.workers.dev`
- Dothome: 장애 시 정적 프론트 롤백용

### 1.4 로컬 개발

```bash
npm run dev
```

기본 주소:

```text
http://127.0.0.1:5173
```

환경 변수:

```text
PORT
GJU_HOST
GJU_DATA_DIR
ADMIN_PASSWORD
SLACK_WEBHOOK_URL
```

로컬에서만 관리자 비밀번호 기본값 `admin`이 허용된다. 운영 Durable Object 최초 초기화에는 `ADMIN_PASSWORD`가 반드시 있어야 한다.

## 2. 웹 빌드

`npm run build` 동작:

1. `public/`을 `dist/`로 복사한다.
2. React 학생·관리자 번들을 생성한다.
3. 웹 설정은 `window.GJU_API_BASE = ""`로 유지한다.
4. 브라우저는 같은 출처 `/api/*`를 사용한다.

캐시 버전은 `public/index.html`, `public/app.js`와 주요 번들 쿼리 문자열에서 동일해야 한다. 출시 점검 스크립트가 이를 검증한다.

## 3. 네이티브 앱

### 3.1 공통

- Capacitor app ID: `kr.ac.gju.photomedia.reserve`
- 앱 이름: `GJU Photography Reservation`
- 홈 화면 표시 이름: `사진영상미디어학과 예약`
- 웹 자산: `dist/`
- 현재 스토어 버전: 1.5.1
- 현재 빌드/버전 코드: 32

네이티브 동기화:

```bash
npm run native:sync
```

네이티브 빌드는 `dist/config.js`를 직접 Worker API 주소로 바꾼다.

```bash
GJU_NATIVE_API_BASE=https://example.com npm run native:sync
```

### 3.2 iOS

- 최소 버전: iOS 15.0
- 대상 기기: iPhone
- 방향: 세로
- Bundle ID: `kr.ac.gju.photomedia.reserve`
- Privacy Manifest 포함
- 추적 없음

명령:

```bash
npm run native:ios
npm run native:ios:archive
npm run native:ios:export
npm run native:ios:upload
```

App Store 업로드에는 Apple Distribution 인증서, App Store provisioning profile, 올바른 Provider·Team 권한이 필요하다.

### 3.3 Android

- Min SDK: 24
- Target SDK: 36
- Compile SDK: 36
- Application ID: `kr.ac.gju.photomedia.reserve`
- `allowBackup=false`
- `usesCleartextTraffic=false`

명령:

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:debug
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:bundle
```

릴리스 서명 환경 변수:

```text
GJU_ANDROID_KEYSTORE_PATH
GJU_ANDROID_KEYSTORE_PASSWORD
GJU_ANDROID_KEY_ALIAS
GJU_ANDROID_KEY_PASSWORD
```

업로드 키 파일과 비밀번호는 저장소에 커밋하지 않는다.

## 4. 비밀값과 환경변수

### 운영 필수

| 이름 | 용도 | 저장 위치 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | 최초 운영 관리자 해시 생성 | Worker secret |
| `INTERNAL_CRON_SECRET` | 내부 보관정책 Cron 인증 | Worker secret |
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook | Worker secret |

설정:

```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put INTERNAL_CRON_SECRET
npx wrangler secret put SLACK_WEBHOOK_URL
```

### 금지

- `.env` 커밋
- Slack Webhook URL 커밋
- FTP 비밀번호 커밋
- Android keystore·비밀번호 커밋
- Apple 인증서·프로비저닝 파일 커밋
- 심사용 계정 비밀번호 문서화
- 운영 DB 원본을 공개 저장소에 업로드

## 5. 보안 통제

### 5.1 애플리케이션

- Bearer 세션 인증
- PBKDF2 비밀번호 해시
- 관리자 API 역할 검사
- 승인 완료 사용자 검사
- 소유자 기반 예약 접근제어
- 로그인 실패 제한
- URL 스킴 검증
- 날짜·시간·상태·용량·충돌 검증
- 관리자 상태 전이 화이트리스트
- 위험 삭제 확인 문구
- 관리자 행위 감사 로그

### 5.2 HTTP

Worker 응답:

- Content-Security-Policy
- Permissions-Policy
- Referrer-Policy: `no-referrer`
- X-Content-Type-Options: `nosniff`
- X-Frame-Options: `DENY`
- Cache-Control: `no-store`
- 허용 출처 기반 CORS

CSP:

```text
default-src 'self'
script-src 'self'
style-src 'self'
img-src 'self' data:
font-src 'self'
connect-src 'self' <production-worker>
base-uri 'none'
object-src 'none'
frame-ancestors 'none'
form-action 'self'
upgrade-insecure-requests
```

### 5.3 개인정보

- 전화번호는 Slack에서 가운데 자리를 마스킹한다.
- 관리자 API 공개 사용자에서 비밀번호 해시를 제거한다.
- 스토어 개인정보 매니페스트에 이름, 이메일, 연락처, 사용자 ID, 사용자 콘텐츠·예약 활동을 앱 기능 목적으로 선언한다.
- 타사 분석·광고·추적 SDK를 사용하지 않는다.
- 개인정보 처리방침과 계정 삭제 안내를 웹에서 제공한다.

## 6. 알려진 보안·운영 한계

| 항목 | 현재 상태 | 연동 권장 |
| --- | --- | --- |
| 브라우저 토큰 | local/sessionStorage | 기존 서비스 BFF의 HttpOnly 쿠키 교환 검토 |
| 로그인 제한 | 메모리 기반 | 영속·분산 Rate Limit |
| API 버전 | 없음 | `/api/v1` 게이트웨이 |
| 관리자 권한 | admin 단일 역할 | 조교·교수·최고관리자 분리 |
| DB 외래 키 | 없음 | 정규화 시 FK·UNIQUE·CHECK |
| 감사 로그 | 최대 1,000건 | 장기 감사 저장소 |
| Slack 로그 | 최대 500건 | 실패 재처리 큐 |
| 파일 | Drive URL만 저장 | 민감 파일이면 권한 있는 객체 저장소 |
| 알림 | 기기 로컬 | 서버 푸시가 필요하면 APNs/FCM |
| 백업 | 수동 JSON | 정기 암호화 백업·복구 훈련 |
| 수요 응답 백업 | 관리자 export에서 제외 | 별도 보호된 응답 export |

## 7. Slack 운영

현재 이벤트:

- 학생 가입
- 예약 생성
- 예약 수정
- 예약 취소
- 예약 상태 변경
- 스튜디오 보고서 제출
- 특강 신청

규칙:

- Webhook이 없으면 `skipped` 로그를 남긴다.
- 성공하면 `sent`, 오류면 `failed`다.
- Slack 실패가 예약·가입·보고서 저장을 막지 않는다.
- 전송 메시지는 이름, 마스킹 연락처, 신분, 예약 정보, 관리자 상세 링크를 포함할 수 있다.

운영 개선 시 실패 로그 재전송 UI와 지수 백오프 큐를 추가한다.

## 8. 로컬 알림 운영

### 학생

- 예약 시작 24시간 전·1시간 전
- 기자재 반납 1시간 전
- 스튜디오 보고서 사용 종료 1시간 후·마감 3시간 전
- 최대 64개

### 관리자

- 처리 건 요약을 다음 09:00 또는 15:00에 예약

권한 거부 시 기기 설정 안내만 제공한다. 정확 알람 권한은 사용하지 않는다.

## 9. 데이터 운영 절차

### 9.1 정기 점검

매일:

- 승인 대기·대여 중·반납 큐
- 미반납 위험
- Slack 실패
- 보고서 미제출

매주:

- 장비 수리·파손 상태
- 최근 28일 가동률·취소율
- 관리자 세션과 의심 로그인
- 백업 다운로드와 보관 확인

학기 말:

- 수요조사 생성·응답률 확인
- 운영 데이터 JSON 백업
- 수요 응답 별도 보호 백업
- 학기 종료 정리 승인
- 다음 학기 차단 일정·출력 기간·보고서 기한 설정

### 9.2 보관정책 Cron

- 일정: 3일마다 UTC 18:00
- `INTERNAL_CRON_SECRET`이 없으면 실행하지 않는다.
- 종료 예약 90일 개인정보 익명화
- 보고서 HTML 183일 삭제
- 만료 세션 삭제

### 9.3 학기 종료

1. 관리자 JSON 백업을 받는다.
2. 수요조사 응답을 별도로 보존한다.
3. 예약·보고서 건수를 기록한다.
4. 사용자에게 유지보수 시간을 공지한다.
5. 확인 문구 `학기 종료`로 실행한다.
6. 세션 삭제로 로그아웃되는지 확인한다.
7. 예약·연결 보고서가 비었는지 확인한다.
8. 사용자·장비·공지·교과 데이터가 유지되는지 확인한다.

## 10. 관측과 장애 대응

### 관측

- Cloudflare Worker observability 활성화
- 감사 로그 최대 1,000건
- Slack 로그 최대 500건
- 운영 배포 확인 스크립트
- `/api/bootstrap` 상태 확인

### 장애 유형

| 장애 | 확인 | 대응 |
| --- | --- | --- |
| 정적 자산 구버전 | 캐시 버전 비교 | Pages/Worker 재배포 |
| API 5xx | Worker 로그, 비밀값 | 설정 복구, 직전 배포 롤백 |
| DB 초기화 실패 | `ADMIN_PASSWORD` | secret 설정 후 재시도 |
| Slack 실패 | `slack_logs` | Webhook 회전·재전송 |
| 예약 충돌 오판 | 예약 필드·차단 일정 | 설정 수정, 도메인 테스트 |
| 네이티브 API 실패 | `dist/config.js`, CORS | API base·CSP·허용 출처 수정 |
| 앱스토어 업로드 실패 | 서명·프로파일·버전 | 계정 권한과 서명 재설정 |

### 롤백

- Worker는 직전 배포 버전으로 롤백한다.
- Pages는 직전 배포 또는 저장된 `dist/`로 되돌린다.
- Dothome은 정적 프론트 대체 경로로만 사용한다.
- 데이터 마이그레이션은 원본 DO와 사전 백업을 유지한다.
- 운영 DB를 초기화하는 엔드포인트는 존재하지 않는다.

## 11. QA와 릴리스 게이트

### 기본 코드 점검

```bash
npm run check
npm run check:js
npm run check:react-admin
git diff --check
```

### 도메인·계약 테스트

```bash
npm run test:react-admin
npm run test:student-react
npm run test:student-bridge
npm run test:equipment-ui
npm run test:admin-ui
npm run test:notifications
npm run test:backend-domains
npm run test:dashboard-integrity
npm run test:storage
npm run test:security
npm run test:smart-reservation
npm run test:course-demand
```

### 브라우저 QA

```bash
npm run test:ui
```

Playwright 프로젝트:

- mobile 390×844
- mobile 430×932
- tablet 768×1024
- desktop 1440×900

### 전체 릴리스 점검

```bash
npm run release:check
npm run native:sync
npm run native:ios:archive
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:bundle
```

### 운영 배포 확인

```bash
npm run deploy:check
GJU_PRODUCTION_URL=https://gjureserve.co.kr npm run deploy:check
```

검증 항목:

- 정적 캐시 버전
- 계정 삭제 UI·API
- 개인정보 방침
- CORS
- `/api/bootstrap`
- 운영 CSP와 Worker 주소

## 12. 배포 순서

권장 순서:

1. 코드·문서 동결
2. 전체 테스트
3. 운영 DB 백업
4. Worker 배포
5. Worker 직접 주소의 API 검증
6. Pages 빌드·배포
7. custom domain same-origin API 검증
8. iOS·Android 네이티브 자산 동기화
9. 실기기 핵심 플로우 검증
10. 스토어 빌드·제출
11. 배포 버전과 롤백 지점 기록

