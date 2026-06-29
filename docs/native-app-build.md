# GJU-reserve Native App Build Guide

이 프로젝트는 Capacitor로 iOS/Android 네이티브 셸을 생성한다. 앱 화면은 `dist/`에 번들된 웹앱을 사용하고, API는 기본적으로 Cloudflare Worker를 호출한다.

## Requirements

- Node.js 22 이상
- iOS: macOS, Xcode
- Android: Android Studio, JDK 17 이상

## Commands

```bash
npm install
npm run native:sync
```

처음 생성 후 iOS를 열려면:

```bash
npm run native:ios
```

iOS App Store용 아카이브를 CLI로 검증하려면:

```bash
npm run native:ios:archive
```

Apple Distribution 인증서와 App Store Connect 프로비저닝 프로파일이 준비된 뒤 `.ipa` export까지 검증하려면:

```bash
npm run native:ios:export
```

Android를 열려면:

```bash
npm run native:android
```

Android debug APK를 만들려면:

```bash
npm run native:android:debug
```

Google Play 업로드용 Android App Bundle을 만들려면:

```bash
npm run native:android:bundle
```

처음 Android 제출용 upload key가 없다면 아래 명령으로 로컬 키스토어와 서명 properties를 만든다. 생성되는 파일은 git에서 무시된다.

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:key
```

생성 파일:

- `android/gju-upload-key.p12`
- `android/release-signing.properties`

이 두 파일은 Play 업데이트에 계속 필요하므로 별도 보관한다. Play Console에서 이미 다른 upload key를 등록했다면 새로 만들지 말고 기존 키 정보를 아래 환경변수 또는 `android/release-signing.properties`에 넣는다.

Play Console 업로드 키가 별도로 준비되어 있으면 아래 환경변수로 release bundle에 서명할 수도 있다.

```bash
export GJU_ANDROID_KEYSTORE_PATH=/absolute/path/gju-upload-key.jks
export GJU_ANDROID_KEYSTORE_PASSWORD='...'
export GJU_ANDROID_KEY_ALIAS=gju-upload
export GJU_ANDROID_KEY_PASSWORD='...'
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:bundle
```

`native:android:bundle`은 `android/app/build/outputs/bundle/release/app-release.aab`를 만든 뒤 `jarsigner`로 서명 여부를 검증한다. unsigned bundle이면 실패한다.

macOS에서 `java`가 잡히지 않지만 Android Studio가 설치되어 있으면:

```bash
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:debug
```

## API Base

네이티브 번들은 같은 도메인의 `/api`를 쓸 수 없으므로 `scripts/build-native.js`가 `dist/config.js`를 다시 작성한다.

기본 API:

```text
https://photographygju-reserve.taejunyun.workers.dev
```

다른 서버를 쓰려면:

```bash
GJU_NATIVE_API_BASE=https://example.com npm run native:sync
```

## Release Notes

- iOS Bundle Identifier: `kr.ac.gju.photomedia.reserve`
- Android Application ID: `kr.ac.gju.photomedia.reserve`
- 스토어/영문 앱 이름: `GJU Photography Reservation`
- 홈 화면 표시 이름: `사진영상미디어학과 예약`
- 네이티브 앱 Origin은 Worker CORS에서 `capacitor://localhost`, `ionic://localhost`, `https://localhost` 계열을 허용한다.
- 네이티브 번들의 CSP `connect-src`는 Worker API 도메인을 허용한다.

## Native Reservation Notifications

네이티브 앱에서는 `@capacitor/local-notifications`로 예약 리마인더를 제공한다.

- 학생이 마이 화면의 `네이티브 예약 알림` 카드에서 `알림 켜기`를 누르면 iOS/Android 권한 요청이 뜬다.
- 권한이 허용되면 예정 예약마다 `24시간 전`, `1시간 전`, `10분 전`, `시작 시점` 로컬 알림을 예약한다.
- 내 예약 로드, 예약 생성, 예약 취소, 특강 신청/취소 후에는 알림 목록을 다시 동기화한다.
- 로그아웃하면 이 기기에 예약된 알림을 취소하고 로컬 알림 설정을 끈다.
- Android 13 이상은 알림 권한이 필요하며, 플러그인 Manifest가 `POST_NOTIFICATIONS`를 포함한다.
- Android 정확 알람 권한(`SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`)은 현재 넣지 않았다. 학과 예약 리마인더는 일반 로컬 알림으로 충분하고, Google Play 심사에서 정확 알람 사용 목적을 추가 설명해야 하는 부담을 피하기 위해서다.

## Apple Watch

Apple Watch 범위는 심사용 리스크를 낮추기 위해 읽기 전용으로 제한한다.

- Watch 앱은 `내 예약` 목록만 표시한다. 예약 생성, 취소, 관리자 기능은 iPhone 앱에서만 제공한다.
- iPhone 앱이 `/api/reservations/my`를 로드하면 `GJUWatchReservations` Capacitor 플러그인이 최대 10개의 활성 예약 요약을 WatchConnectivity application context로 동기화한다.
- Watch에 전달하는 값은 예약 ID, 유형, 상태, 제목, 날짜, 간단한 설명으로 제한한다.
- 예약 알림은 iPhone의 로컬 알림을 사용한다. 사용자가 iOS Watch 앱에서 알림 미러링을 켜면 Apple Watch에서도 같은 예약 리마인더를 받을 수 있다.
- Watch 소스는 `ios/App/GJUWatchApp/`에 있으며, Xcode에서 watchOS App 타깃을 추가할 때 이 파일들을 연결한다.

관련 파일:

- `public/js/native-notifications.js`
- `public/js/views-student.js`
- `capacitor.config.json`
- `android/app/src/main/res/drawable/ic_stat_notify.xml`
- `ios/App/App/GJUWatchReservationsPlugin.swift`
- `ios/App/GJUWatchApp/GJUWatchApp.swift`
- `ios/App/GJUWatchApp/ReservationListView.swift`

## Store Release Checklist

아래는 2026-06-21 기준 공식 배포 문서를 확인해 정리한 제출 준비 항목이다. 실제 제출 직전에는 Apple/Google 문서를 다시 확인한다.

### 공통

- 운영 API: `GJU_NATIVE_API_BASE=https://photographygju-reserve.taejunyun.workers.dev`
- 스토어/영문 앱 이름: `GJU Photography Reservation`
- 홈 화면 표시 이름: `사진영상미디어학과 예약`
- ID: `kr.ac.gju.photomedia.reserve`
- 개인정보 항목: 이름, 이메일, 연락처, 학번/신분, 예약 내역, 특강 신청 내역, 보고서 링크, 사용 로그/세션.
- iOS 개인정보 매니페스트: `ios/App/App/PrivacyInfo.xcprivacy`에 추적 없음, 앱 기능 목적의 이름/이메일/연락처/사용자 ID/사용자 콘텐츠/예약 활동 수집을 선언했다. App Store Connect 개인정보 답변도 이 내용과 일치시킨다.
- App Store Connect의 “앱에서 추적을 사용합니까?”는 `아니오`로 답한다. 전화번호, 이메일, 사용자 ID/학번, 예약/보고서 데이터는 앱 기능 목적이며 추적 목적이 아니다.
- 앱과 웹 배포본은 Google Analytics, 광고 식별자, 타사 광고 네트워크, 데이터 브로커 제공을 사용하지 않는다.
- 계정 삭제: 학생은 앱 내부 `마이 > 계정 삭제`에서 현재 비밀번호와 확인 문구로 계정 삭제를 완료할 수 있다.
- 앱 설명에는 “광주대학교 사진영상미디어학과 내부 예약 시스템”임을 명확히 쓴다.
- 알림 권한 설명: “예약 시작 전 리마인더 제공”으로 제한한다.
- 계정 심사 정보: 테스트 계정, 승인된 학생 상태, 사전 생성된 심사용 데이터, 관리자 문의 절차를 App Review/Play Console 메모에 제공한다.
- 심사용 계정은 `npm run review:prepare-account`로 준비한다. 실행 시 운영 관리자 비밀번호와 심사용 학생 비밀번호는 환경변수로만 넣고 문서에는 저장하지 않는다.

### iOS / App Store Connect

1. Apple Developer Program 팀 계정에서 App ID `kr.ac.gju.photomedia.reserve`를 생성한다.
2. Xcode에서 `ios/App/App.xcodeproj`를 열고 Team, Signing, Version, Build를 설정한다.
3. 초기 출시는 iPhone 세로 방향 전용으로 제출한다. iPad와 가로 방향은 별도 QA 이후 열어둔다.
4. 실제 기기에서 로그인, 예약, 내 예약, 네이티브 알림 권한, 알림 탭 이동, 계정 삭제를 테스트한다.
5. Xcode `Product > Archive` 후 Organizer에서 TestFlight/App Store Connect로 업로드한다.
6. App Store Connect에 앱 개인정보 세부사항을 작성한다. Apple은 앱과 통합된 타사 코드가 수집하는 데이터까지 포함해 개인정보 관행을 제출해야 한다고 안내한다. 현재 빌드는 타사 분석/광고 SDK를 포함하지 않는다.
7. 스크린샷은 iPhone 기준으로 준비한다.
8. 심사 메모에 내부 학과 시스템, 승인 완료 테스트 계정, 사전 생성된 예약/특강 데이터, 알림 권한 목적, 로그인 후 주요 플로우, 계정 삭제 경로를 적는다.
9. Apple Watch를 함께 제출할 경우 Watch 앱 설명은 “내 예약 확인 및 iPhone 예약 알림 수신”으로 제한한다.

#### 2026-06-22 iOS 제출 가능성 점검 결과

- `npm run release:check`: 통과.
- `npm run native:sync`: 통과.
- `xcodebuild archive`: 통과. 로컬 코드와 네이티브 번들은 Release 아카이브 생성 가능.
- `xcodebuild -exportArchive`: 실패. 현재 원인은 코드가 아니라 Apple 계정/서명 설정이다.
- 확인된 Apple 측 블로커:
  - App Store Connect 사용자에 Provider가 연결되어 있지 않음.
  - 팀에 `iOS App Store` provisioning profile 생성 권한이 없음.
  - `kr.ac.gju.photomedia.reserve`용 App Store provisioning profile 없음.
  - `iOS Distribution`/`Apple Distribution` 인증서 없음.

해결 순서:

1. Apple Developer Account Holder 또는 Admin 권한으로 로그인한다.
2. App Store Connect에서 앱 레코드와 Bundle ID `kr.ac.gju.photomedia.reserve`가 같은 팀에 연결되어 있는지 확인한다.
3. Apple Distribution 인증서를 만든다.
4. App Store Connect provisioning profile을 만든다. 자동 서명을 쓸 경우 Xcode가 만들 수 있도록 권한을 부여한다.
5. 아래 명령으로 다시 확인한다.

```bash
npm run native:ios:export
```

참고 공식 문서:

- Apple App Store Connect Upload Builds: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- Apple App Store provisioning profile: https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/
- Apple certificates overview: https://developer.apple.com/help/account/certificates/certificates-overview/
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/

### Android / Google Play

1. Play Console에서 앱을 만들고 패키지명 `kr.ac.gju.photomedia.reserve`를 등록한다.
2. Google Play는 새 앱/업데이트에 Android 15(API 35) 이상 target을 요구한다. 현재 프로젝트는 `targetSdkVersion = 36`이라 기준을 충족한다.
3. Play App Signing을 활성화하고 업로드 키/keystore를 준비한다.
4. `GJU_ANDROID_KEYSTORE_PATH`, `GJU_ANDROID_KEYSTORE_PASSWORD`, `GJU_ANDROID_KEY_ALIAS`, `GJU_ANDROID_KEY_PASSWORD`를 설정한 뒤 Gradle로 release App Bundle을 만든다.
5. Play Console Data safety에 이름, 이메일, 전화번호, 사용자 ID/학번, 앱 활동/예약 내역, 진단/로그 여부를 실제 수집 기준에 맞춰 신고한다.
6. 알림 권한은 `POST_NOTIFICATIONS`만 사용한다. 정확 알람 권한은 현재 사용하지 않으므로 정책 신고 대상에서 제외한다.
7. Wear OS 앱은 현재 제출 범위가 아니다. Android는 휴대폰 앱과 로컬 예약 리마인더만 검증한다.
8. 내부 테스트 트랙에 먼저 올려 Android 13+ 권한 프롬프트, 알림 예약, 알림 탭 이동, WebView 로그인 유지 상태를 확인한다.

#### 2026-06-22 Android 제출 가능성 점검 결과

- `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:debug`: 통과.
- Android Studio 내장 JBR로 debug APK 빌드는 가능하다.
- 시스템 기본 `java`는 잡히지 않으므로 터미널 빌드 시 `JAVA_HOME`을 명시한다.
- Google Play 제출용 `.aab`는 업로드 키 환경변수 4개 또는 `android/release-signing.properties`가 준비된 뒤 `npm run native:android:bundle`로 만든다.

#### 2026-06-28 Android 제출 가능성 점검 결과

- `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:key`: 로컬 upload key 생성 가능.
- `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:bundle`: release AAB 생성 및 서명 검증 가능.
- 출력 파일: `android/app/build/outputs/bundle/release/app-release.aab`

참고 공식 문서:

- Google Play target API requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Android Play App Signing: https://developer.android.com/studio/publish/app-signing
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469

## Release Gates

출시 후보를 만들 때마다 다음을 통과해야 한다.

```bash
npm run release:check
git diff --check
npm run native:sync
npm run native:ios:archive
npm run native:android:debug
```

운영 Worker에 배포한 뒤에는 아래 명령으로 네이티브 앱이 호출할 실제 API/정적 자산을 확인한다.

```bash
npm run deploy:check
```

iOS App Store export는 Apple Distribution 인증서와 App Store provisioning profile이 준비된 뒤 `npm run native:ios:export`로 확인한다. Android release bundle은 keystore가 준비된 뒤 `npm run native:android:bundle`로 만든다.

세부 제출 체크리스트와 QA 매트릭스는 `docs/pre-release-checklist.md`를 기준으로 한다.
