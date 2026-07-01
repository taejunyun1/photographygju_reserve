# GJU-reserve 출시 전 체크리스트

이 문서는 웹 배포, iOS App Store, Android Google Play 제출 직전에 확인할 작업 목록이다. 2026-06-21 기준으로 Apple/Google 공식 문서와 현재 프로젝트 설정을 맞춰 정리했다. 제출 직전에는 스토어 정책 페이지를 다시 확인한다.

## 0. 자동 점검

릴리즈 후보를 만들 때마다 아래 명령을 먼저 통과시킨다.

```bash
npm run release:check
git diff --check
```

네이티브 번들까지 만들 때는 이어서 실행한다.

```bash
npm run native:sync
npm run native:ios:archive
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:bundle
```

iOS App Store export는 Apple Distribution 인증서와 App Store provisioning profile이 준비된 뒤 실행한다.

```bash
npm run native:ios:export
```

스토어 제출 문구는 `docs/store-submission-materials.md`, QA 기록은 `docs/release-qa-signoff.md`를 사용한다.

## 1. 출시 범위 고정

- 이번 버전에 포함할 기능을 고정한다.
- 새 기능 추가를 멈추고 버그 수정만 받는다.
- `git status --short`로 변경 파일을 확인한다.
- 배포 전 마지막 커밋 메시지에는 날짜와 주요 변경사항을 축약해서 남긴다.
- 운영 DB 백업, Dothome 업로드본, Cloudflare Worker 버전을 함께 기록한다.

## 2. 운영 데이터와 계정

- 운영 DB 백업을 만든다.
- 관리자 계정 1개와 조교 계정 1개를 실제 운영 권한으로 확인한다.
- App Store/Play 심사용 테스트 계정을 만든다.
- 테스트 계정은 `승인 완료` 상태여야 한다.
- 테스트 계정은 스튜디오/출력실/기자재 예약과 비교과 특강 신청이 사전 생성되어 있어야 한다.
- 테스트 계정 비밀번호는 문서 저장소나 코드에 넣지 말고 제출 메모에만 입력한다.
- 운영 API에 심사용 계정을 준비할 때는 `npm run review:prepare-account`를 사용한다.
- 학생 승인, 대여금지, 경고 메모, 예약 취소, 보고서 확인이 실제 DB에 기록되는지 확인한다.
- `마이 > 계정 삭제`에서 학생 본인이 현재 비밀번호와 확인 문구로 계정 삭제를 완료할 수 있는지 확인한다.

## 3. 개인정보와 보안

- App Store Connect 개인정보 답변은 `ios/App/App/PrivacyInfo.xcprivacy`와 맞춘다.
- App Store 계정 삭제 요구사항에 맞춰 앱 내부 계정 삭제 기능이 동작해야 한다.
- Play Console Data safety는 실제 수집 데이터 기준으로 입력한다.
- 수집 데이터: 이름, 이메일, 연락처, 학번/신분, 예약 내역, 특강 신청 내역, 보고서/사용자 제출 내용, 사용 로그.
- 추적 목적 수집은 현재 없음으로 유지한다.
- App Store Connect의 “앱에서 추적을 사용합니까?”는 `아니오`로 답한다.
- 전화번호, 이메일, 사용자 ID/학번, 예약/보고서 데이터는 `앱 기능` 목적이며 `추적 목적 아님`으로 답한다.
- Google Analytics, 광고 식별자, 타사 광고 네트워크, 데이터 브로커 제공은 사용하지 않는다.
- Slack Webhook, FTP 비밀번호, Android keystore, Apple 인증서, 테스트 계정 비밀번호가 코드/문서/스크린샷에 들어가지 않았는지 확인한다.
- `SESSION_SECRET`, `SLACK_WEBHOOK_URL`, `ADMIN_BOOTSTRAP_TOKEN`은 Cloudflare/Dothome 환경변수나 서버 비밀값으로만 관리한다.
- Android는 `allowBackup=false`, `usesCleartextTraffic=false` 상태로 배포한다.
- Android 정확 알람 권한(`SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`)은 사용하지 않는다.

## 4. 웹 배포 체크

- `npm run build`로 웹 배포용 `dist/config.js`가 same-origin API 상태인지 확인한다.
- `public/index.html`과 `worker.mjs`의 CSP `connect-src`에 운영 Worker API가 포함되어야 한다.
- `public/index.html`, `public/app.js`의 캐시 버전이 일치해야 한다.
- Cloudflare Worker 배포 후 `/api/health` 또는 첫 화면 로드가 정상인지 확인한다.
- Cloudflare Worker 배포 후 `npm run deploy:check`로 운영 URL의 캐시 버전, 계정 삭제 UI/API, CORS, `/api/bootstrap`을 확인한다.
- Cloudflare Pages 배포 후 `https://gju-reserve.pages.dev`에서 새 버전이 보이는지 확인한다.
- custom domain 연결 후 `GJU_PRODUCTION_URL=https://gjureserve.co.kr npm run deploy:check`로 같은 출처 Pages 프록시와 정적 파일 버전을 확인한다.
- DNS/custom domain 전파 중에는 `GJU_PRODUCTION_URL=https://gju-reserve.pages.dev npm run deploy:check`로 같은 검증을 반복한다.
- 로그인, 내 예약, 특강, 공지, 보고서, 관리자 진입을 실제 도메인에서 점검한다.
- 외부 분석 스크립트가 다시 들어가지 않았는지 `npm run test:security`로 확인한다.

## Cloudflare Pages 전환 준비

- `npm run pages:check`로 Pages 프록시와 스크립트 구성을 확인한다.
- `npm run pages:preview`로 로컬 Pages 호환 프리뷰를 확인한다.
- 운영 전환 전에는 `pages:deploy`를 수동으로 실행하고 `/api/bootstrap`, Admin 로그인, 계정 삭제 페이지를 확인한다.
- Dothome 업로드 경로는 rollback 용도로만 유지한다.

## 5. iOS 제출 체크

- Bundle ID: `kr.ac.gju.photomedia.reserve`
- 스토어/영문 앱 이름: `GJU Photography Reservation`
- 홈 화면 표시 이름: `사진영상미디어학과 예약`
- 초기 iOS 출시는 iPhone 세로 방향 전용으로 제출한다. iPad와 가로 방향은 별도 QA 후 지원한다.
- Apple Developer Program 팀과 Signing을 Xcode에서 설정한다.
- App Store Connect Provider 연결, Apple Distribution 인증서, `kr.ac.gju.photomedia.reserve`용 App Store provisioning profile을 준비한다.
- Version/Build 번호를 이전 업로드보다 높인다.
- `ios/App/App/PrivacyInfo.xcprivacy`가 Xcode Resources에 포함되어 있는지 확인한다.
- 실제 iPhone에서 로그인, 예약, 내 예약, 특강 신청/취소, 네이티브 알림 권한, 알림 탭 이동을 확인한다.
- 실제 iPhone에서 계정 삭제 플로우를 테스트 계정으로 확인한다.
- TestFlight 내부 테스트를 먼저 통과시킨다.
- 스크린샷은 iPhone 기준 핵심 화면을 준비한다: 홈, 예약, 내 예약, 특강, 마이.
- App Review Notes에는 내부 학과 예약 시스템임을 적고, 테스트 계정과 확인 가능한 플로우를 제공한다.
- App Review Information의 로그인 정보에는 승인 완료 학생 계정과 사전 생성된 심사용 데이터 설명을 함께 넣는다.
- 알림 권한 설명은 “예약 시작 전 리마인더 제공”으로 한정한다.
- 서명 준비 후 `npm run native:ios:export`로 App Store 제출용 `.ipa` export를 확인한다.

## 6. Android 제출 체크

- Package name: `kr.ac.gju.photomedia.reserve`
- Current Play upload version: `versionName 1.0.2`, `versionCode 20`
- Google Play target API requirement는 Android 15/API 35 이상이 기준이며, 현재 `targetSdkVersion = 36`이다.
- Play App Signing을 활성화한다.
- 업로드 키를 만들고 아래 환경변수를 설정한다.

```bash
export GJU_ANDROID_KEYSTORE_PATH=/absolute/path/gju-upload-key.jks
export GJU_ANDROID_KEYSTORE_PASSWORD='...'
export GJU_ANDROID_KEY_ALIAS=gju-upload
export GJU_ANDROID_KEY_PASSWORD='...'
```

- `npm run native:android:bundle`로 `.aab`를 만든다.
- Play Console Data safety에 실제 수집/공유/암호화/삭제 요청 가능 여부를 입력한다.
- Android 13 이상에서 알림 권한 프롬프트와 예약 알림 예약을 확인한다.
- 내부 테스트 트랙에 먼저 업로드해 설치, 로그인 유지, WebView 화면 안전 영역, 하단 메뉴를 확인한다.

## 7. 실기기 QA와 기능 QA 매트릭스

학생 화면:

- 회원가입, 로그인, 로그아웃.
- 계정 삭제: 마이 화면에서 현재 비밀번호와 `계정 삭제` 확인 문구 입력 후 계정/예약/보고서/특강 신청/알림 정리.
- 승인 대기 사용자는 예약 불가.
- 학생 상단 프로필 클릭 시 마이 화면 이동.
- 홈에서 기자재, 스튜디오, 출력실, 암실, 비교과 진입.
- 기자재 예약: 날짜 선택, 당일 예약 차단, 기간/시간 선택, 카메라 바디 선택, 같은 브랜드 렌즈 추천, 선택 장비 하단 시트 접기/펼치기, 카메라 가방 체크, 승인 요청.
- 스튜디오 예약: 날짜 선택, 공간 선택, 시간 복수 선택, 최대 타임 제한, 예약 확정.
- 출력실 예약: 구글 드라이브 링크 상시 표시와 이동.
- 특강: 검색, 연도 필터, 신청, 신청완료 상태 표시, 시작 6시간 전 신청 취소 제한.
- 내 예약: 기자재, 스튜디오, 출력실, 암실, 비교과 카테고리 구분.
- 보고서: 예약 데이터 자동 연동, 사진/결과 입력, 제출.
- 네이티브 알림: 24시간 전/1시간 전 예약, 취소 시 알림 제거, 로그아웃 시 알림 제거.

관리자 화면:

- 학생 승인/반려 버튼 상태별 노출.
- 대여금지 설정/해제 드롭다운 DB 반영.
- 경고 메모 기록/초기화.
- 기자재 상태: 대여완료, 반납완료 기준 필터.
- 스튜디오 보고서 검색/정렬.
- 특강 등록/수정/삭제, 대상 학년 드롭다운, 신청자 CSV.
- 출력실 구글 드라이브 URL 등록.
- 공지 등록/수정/삭제.
- 로그/세션 검색과 정렬.

반응형/네이티브 UI:

- iPhone 390px, iPhone Max 430px, Android 360px, tablet 768px에서 버튼 넘침이 없어야 한다.
- 상단 메뉴는 상태바/다이나믹 아일랜드와 겹치지 않아야 한다.
- 스크롤 시 상단 메뉴 blur 처리와 하단 탭 safe-area inset이 유지되어야 한다.
- 카드 내부 텍스트가 버튼이나 다음 섹션과 겹치지 않아야 한다.

## 8. 출시일 롤백

- Cloudflare 배포 버전과 Dothome 업로드 시점을 기록한다.
- 문제가 생기면 직전 Worker 배포본으로 롤백하고, Dothome은 직전 `dist/` 백업으로 되돌린다.
- DB 마이그레이션을 실행했다면 롤백 SQL 또는 백업 복원 절차를 함께 준비한다.
- Slack/전화로 조교에게 공지할 장애 문구를 미리 준비한다.

## 9. 공식 문서

- Apple App Store Connect Upload Builds: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- Apple App Store provisioning profile: https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/
- Apple certificates overview: https://developer.apple.com/help/account/certificates/certificates-overview/
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Google Play target API requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Android Play App Signing: https://developer.android.com/studio/publish/app-signing
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
