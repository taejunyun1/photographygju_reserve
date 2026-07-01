# GJU-reserve 릴리즈 QA 사인오프

## 빌드 정보

| 항목 | 값 |
| --- | --- |
| QA 날짜 | 2026-06-22 09:52 KST |
| 담당자 | Codex 자동 점검 + 사용자 실기기 QA 일부 |
| Git 커밋 | `5b41549` 기준 작업 트리 |
| Web 배포 URL | https://gjupreserve.com |
| Cloudflare Pages | gju-reserve / custom domain 연결 대상 |
| Cloudflare Worker API | https://photographygju-reserve.taejunyun.workers.dev |
| Cloudflare Worker 버전 | `23876a11-fb8d-4a33-9f4b-e1cad7386c03` |
| Dothome 업로드 | rollback 경로로 유지 |
| 캐시 버전 | `20260626-watch-release` |
| iOS 빌드 | `1.0.1 (18)` |
| Android 빌드 | `versionName 1.0.1`, `versionCode 18` |

## 자동 점검

| 점검 | 결과 | 메모 |
| --- | --- | --- |
| `npm run release:check` | 통과 | 문법, 웹/네이티브 릴리즈 설정, 개인정보 매니페스트, 계정 삭제 기능 확인 |
| `git diff --check` | 통과 | 공백 오류 없음 |
| `npm run deploy:check` | 통과 | Worker API 기준 운영 자산/API 확인 |
| `GJU_PRODUCTION_URL=https://gju-reserve.pages.dev npm run deploy:check` | 통과 | Cloudflare Pages 정적 파일, Pages Function 프록시, 계정 삭제 UI/API 확인 |
| `npm run native:sync` | 통과 | iOS/Android Capacitor 동기화 완료 |
| `npm run native:ios:archive` | 통과 | Release archive 생성 가능 |
| `npm run native:ios:export` | 보류 | Apple Distribution 인증서와 App Store provisioning profile 필요 |
| `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:debug` | 통과 | Android debug APK 빌드 성공 |
| `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" npm run native:android:bundle` | 통과 | `android/app/build/outputs/bundle/release/app-release.aab` 생성 및 서명 검증 |

## 제출 전 필수 보류 항목

| 플랫폼 | 상태 | 필요한 조치 |
| --- | --- | --- |
| iOS App Store | 외부 준비 필요 | App Store Connect Provider 연결, Apple Distribution 인증서, `kr.ac.gju.photomedia.reserve` App Store provisioning profile 준비 |
| Android Google Play | 외부 준비 필요 | Play App Signing 활성화, upload keystore 생성, `GJU_ANDROID_KEYSTORE_*` 환경변수 설정 |
| 스토어 메타데이터 | 수동 입력 필요 | 테스트 계정, 개인정보 답변, 스크린샷, 심사 메모 입력 |
| 최종 수동 QA | 사용자 확인 필요 | 실제 iPhone/Android에서 로그인, 예약, 알림, 계정 삭제, 관리자 핵심 플로우 확인 |

## 기능 QA 매트릭스

| 기능 | 자동 검증 | 실기기/수동 확인 | 메모 |
| --- | --- | --- | --- |
| 회원가입/로그인/로그아웃 | 통과 | 사용자 QA 일부 완료 | `scripts/security-smoke-test.mjs` |
| 계정 삭제 | 통과 | 스토어 제출 전 테스트 계정으로 재확인 필요 | 앱 내부 `마이 > 계정 삭제`, 운영 배포 확인 완료 |
| 승인 대기/대여금지 차단 | 통과 | 운영 계정으로 재확인 필요 | 보안 스모크 테스트 포함 |
| 기자재 예약/당일 예약 차단 | 통과 | 실기기 UI 확인 필요 | 백엔드 검증 포함 |
| 기자재 브랜드 렌즈 추천 | 코드 반영 | 실기기 UI 확인 필요 | 모바일 하단 시트 포함 |
| 스튜디오 예약 | 코드 반영 | 실기기 UI 확인 필요 | 모바일 단계형 플로우 |
| 출력실 예약/구글 드라이브 링크 | 코드 반영 | 운영 설정값 확인 필요 | 관리자 설정 필요 |
| 비교과 검색/연도 필터/신청 취소 | 통과 | 실기기 UI 확인 필요 | 6시간 취소 제한 포함 |
| 내 예약 카테고리 분리 | 코드 반영 | 실기기 UI 확인 필요 | 기자재/스튜디오/출력실/암실/비교과 |
| 보고서 제출 | 코드 반영 | 운영 계정으로 확인 필요 | 자체 보고서 유지 |
| 네이티브 예약 알림 | 코드 반영 | iOS/Android 권한 프롬프트 확인 필요 | 로컬 알림 플러그인 포함 |
| 관리자 학생 관리 | 코드 반영 | 운영 관리자 계정 확인 필요 | 승인/반려/대여금지/경고 메모 |
| 관리자 보고서 검색/정렬 | 코드 반영 | 운영 관리자 계정 확인 필요 | 스튜디오 보고서 포함 |
| 특강 관리 | 코드 반영 | 운영 관리자 계정 확인 필요 | 등록/수정/삭제/CSV |

## UI 회귀

| 화면 | 상태 | 메모 |
| --- | --- | --- |
| 모바일 상단/하단 safe area | 사용자 QA 일부 완료 | iPhone 실기기에서 추가 확인 진행됨 |
| 기자재 예약 | 코드 반영 | 선택 기자재/추천 렌즈 하단 시트 반영 |
| 스튜디오/출력실/암실 예약 | 코드 반영 | 날짜 선택 후 순차 이동 반영 |
| 비교과 | 코드 반영 | 정적 정보 축소, 검색/연도 필터 반영 |
| 마이 | 코드 반영 | 계정 삭제 카드 추가 |

## 출시 승인

| 역할 | 이름 | 승인 여부 | 메모 |
| --- | --- | --- | --- |
| 개발 | Codex | 조건부 완료 | 코드, 배포, 자동 점검 완료. 스토어 서명 자산은 외부 준비 필요 |
| 조교 운영 |  | 보류 | 운영 계정/테스트 계정으로 최종 수동 QA 필요 |
| 학과 담당자 |  | 보류 | 스토어 제출 메타데이터와 개인정보 답변 확인 필요 |
