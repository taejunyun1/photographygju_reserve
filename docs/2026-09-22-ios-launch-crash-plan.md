# iOS 1.5.4 (35) 실행 직후 크래시 분석 및 수정 계획

작성일: 2026-09-22. 범위: 제공된 크래시 로그 분석, 수정, 릴리스 검증 계획.

## 1. 확인된 원인

제공 로그 8개 모두 1.5.4 (35), iOS/iPadOS 27.0에서 메인 스레드의 `EXC_BREAKPOINT / SIGTRAP`으로 종료된다. 공통 최상위 프레임은 `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`이다. 실행 후 약 0.061~0.143초에 발생한다.

| 로그 접두사 | 기기 식별자 | OS 빌드 |
| --- | --- | --- |
| 133A7A87 | iPad15,3 | 24A435 |
| F1E8AE6A | iPad15,3 | 24A435 |
| D748989E | iPad15,3 | 24A435 |
| E3472908 | iPad15,3 | 24A435 |
| 85D38D2C | iPhone18,2 | 24A437 |
| 9C22811C | iPhone18,2 | 24A437 |
| 470F016E | iPhone18,2 | 24A437 |
| A26F9B56 | iPhone18,2 | 24A437 |

모든 로그의 앱 UUID `C8A47508-5917-3ABE-ADEE-8D72A3D94DA9`는 로컬 업로드 아카이브의 dSYM UUID와 일치한다. 해당 아카이브는 Xcode 27.0 / iPhoneOS 27.0 SDK로 빌드됐다.

현재 `ios/App/App/Info.plist`와 아카이브의 실제 Info.plist에 `UIApplicationSceneManifest`가 없고, `AppDelegate.swift`는 기존 앱 단위 window와 생명주기를 사용한다. SceneDelegate도 없다. 즉, 업로드한 바이너리의 UIScene 미전환이 이번 8건의 직접 원인이다. 실제 수정 빌드 실행 검증은 아직 수행하지 않았다.

Apple 공식 근거: https://developer.apple.com/documentation/uikit/transitioning-to-the-uikit-scene-based-life-cycle

## 2. 수정 범위와 순서

1. **Scene 구성 추가**
   - Info.plist에 UIApplicationSceneManifest, UIWindowSceneSessionRoleApplication 구성, SceneDelegate 클래스, Main storyboard 연결을 명시한다.
   - 단일 화면 구조를 유지하도록 다중 Scene 지원은 비활성화한다.
   - 기존 UIMainStoryboardFile 기반 생성과 Scene storyboard 기반 생성이 중복되지 않도록 정리한다. LaunchScreen은 유지한다.
2. **SceneDelegate와 Capacitor 연결**
   - `ios/App/App/SceneDelegate.swift`를 추가하고 Xcode Sources에 등록한다.
   - UIWindow 소유를 Scene으로 옮기고 기존 Main.storyboard의 CAPBridgeViewController가 한 번만 생성되도록 한다.
   - AppDelegate는 앱 공통 초기화 역할로 정리한다.
3. **외부 링크와 앱 상태 회귀 방지**
   - 실행 중 URL 열기와 Universal Link를 Scene 콜백에서 Capacitor ApplicationDelegateProxy로 전달한다.
   - 종료 상태에서 링크로 실행하는 경우 connectionOptions도 처리하며, 브리지 준비 시점과 getLaunchUrl/appUrlOpen의 누락·중복을 검증한다.
   - 현재 Capacitor App 플러그인은 UIApplication 알림을 구독한다. Scene 전환 이후 appStateChange/pause/resume 및 로컬 알림 동작을 실제 확인하고, 누락이 확인될 때만 호환 처리를 추가한다. 시스템 알림을 무조건 재발송하지 않는다.
4. **릴리스 검사 보강**
   - `scripts/check-native-release.mjs` 등에 Scene manifest 구조, delegate 소스 등록, storyboard 연결 검사를 추가한다.
   - 소스뿐 아니라 최종 아카이브의 Info.plist를 파싱해 적용 여부를 검사한다.
   - 기존 검사는 Android/iOS 버전 동등성을 강제한다. 현재 iOS 1.5.4 (35), Android 1.5.3 (34) 차이로 실패할 수 있으므로 플랫폼별 검사로 분리하는 방안을 반영한다. 이는 크래시 원인과 별개의 릴리스 검사 문제다.

## 3. 검증과 통과 기준

- 기존 실패 빌드의 Scene 누락을 검출하는 회귀 검사가 수정 후 통과해야 한다.
- Xcode의 CoreDevice/CoreSimulator 버전 불일치 경고가 이전 빌드에 존재했다. 검증 전 Xcode 추가 구성 요소와 런타임 상태를 확인하고 실행 가능한 환경을 준비한다.
- iOS 27 iPhone, iPadOS 27 iPad에서 각각 종료 후 재실행 10회: 실행 직후 종료 0회, 로그인/대시보드 표시 성공. 현재 iPhone 전용 타깃이므로 iPad는 호환 실행 모드도 검증한다.
- 실제 지원하는 이전 OS 환경에서도 실행·복귀를 확인한다. 확보하지 못한 OS는 미검증으로 기록한다.
- 백그라운드 복귀, 로그인 유지, 예약 조회, 보고서 작성·사진 선택·임시저장·제출, 알림 탭 이동, 링크 실행을 확인한다.
- 새 설치와 기존 1.5.4 업데이트 설치를 각각 확인한다. 실기기 또는 TestFlight에서 동일 수정 빌드의 실행 증거와 크래시 여부를 기록한다.
- 빌드/아카이브/업로드 성공은 실행 QA 통과와 구분한다. 실기기 확인이 불가능하면 배포 준비 완료로 표시하지 않는다.

## 4. 배포 계획

App Store Connect의 현재 심사/버전 상태와 최신 빌드 번호를 확인한 후, 1.5.4 트레인이 열려 있으면 빌드 36 이상으로 교체한다. 닫혀 있으면 1.5.5 이상으로 올린다. 확정 번호는 업로드 직전에 확인한다.

수정 → 정적/아카이브 검사 → 실제 실행 QA → 커밋/푸시 → App Store Connect 업로드 → 처리 완료 확인 → 해당 빌드로 심사 갱신 순서로 진행한다. 이미 배포된 웹 변경만으로는 네이티브 시작 크래시를 해결할 수 없으므로 iOS 바이너리 업데이트가 필요하다.

## 5. 구현 및 현재 검증 상태

다음 변경을 적용했다.

- `SceneDelegate.swift` 추가 및 Xcode Sources 등록
- `UIApplicationSceneManifest`에 단일 Window Scene, `App.SceneDelegate`, `Main` storyboard 연결
- Scene 시작 시 URL·Universal Link 전달 처리
- iOS/Android 네이티브 버전을 1.5.4로 정렬하고 빌드 번호를 36으로 갱신
- 네이티브 릴리스 검사에 Scene manifest와 delegate 등록 검사를 추가

수정 빌드는 Xcode 27.0으로 Release 아카이브에 성공했고, 최종 아카이브에서 `App.SceneDelegate`와 `Main` storyboard가 확인됐다. App Store Connect에는 1.5.4 (36) 업로드가 성공했으며 현재 Apple 처리 중이다.

현재 로컬 CoreSimulator는 설치된 런타임과 Xcode 27의 CoreDevice/CoreSimulator 버전이 맞지 않아 시뮬레이터 서비스가 시작되지 않는다. 따라서 실제 iPhone/iPad에서 실행·복귀·기능 회귀를 확인하기 전까지 크래시 해결을 최종 확정하지 않는다.

## 6. 이전 검증의 한계

직전 작업에서 확인된 것은 아카이브 및 App Store Connect 업로드 성공이었다. iOS 27 기기에서의 실행 검증이 빠져 UIScene 요구사항 위반을 발견하지 못했다. 이번 수정에서는 실제 시작·복귀 검증을 배포 통과 조건으로 추가한다.
