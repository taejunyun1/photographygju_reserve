# GJU Photography Reservation 스토어 제출 자료

이 문서는 App Store Connect와 Google Play Console에 붙여 넣을 기본 문구와 개인정보 답변 기준을 정리한다. 계정, 비밀번호, 인증서, 키스토어 비밀번호는 여기에 쓰지 않는다.

## 앱 기본 정보

- 앱 이름: `GJU Photography Reservation`
- 홈 화면 표시 이름: `사진영상미디어학과 예약`
- Bundle ID / Package name: `kr.ac.gju.photomedia.reserve`
- 카테고리 권장: Education 또는 Productivity
- 운영 주체: 광주대학교 사진영상미디어학과 내부 운영
- 대상 사용자: 광주대학교 사진영상미디어학과 학생, 조교, 교수/강사

## 한 줄 설명

광주대학교 사진영상미디어학과 기자재와 공간 예약을 관리하는 내부 예약 앱입니다.

## 짧은 설명

GJU-reserve는 광주대학교 사진영상미디어학과 학생과 운영자가 기자재, 스튜디오, 출력실, 암실, 비교과 특강 예약을 확인하고 신청할 수 있는 내부 예약 시스템입니다.

## 긴 설명

GJU-reserve는 광주대학교 사진영상미디어학과 전용 예약 관리 앱입니다. 학생은 승인된 계정으로 로그인해 기자재, 스튜디오, 출력실, 암실, 비교과 특강을 신청하고 내 예약 내역과 공지를 확인할 수 있습니다. 운영자는 학생 승인, 기자재 대여/반납 상태, 특강 신청 현황, 보고서, 공지사항을 관리할 수 있습니다.

예약 시작 전 리마인더를 위해 선택적으로 네이티브 알림 권한을 요청합니다. 이 앱은 학과 내부 운영 목적으로만 사용되며, 외부 판매나 공개 커뮤니티 기능을 제공하지 않습니다.

Apple Watch 앱은 iPhone 앱의 내 예약 목록을 읽기 전용으로 확인하는 용도입니다. 예약 신청, 취소, 관리자 기능은 iPhone 앱에서만 제공합니다.

## App Review Notes

```text
이 앱은 광주대학교 사진영상미디어학과 내부 예약 시스템입니다.

심사용 테스트 계정:
- ID:
- Password:
- 계정 상태: 승인 완료
- 사전 생성된 심사용 데이터: 스튜디오 예약 1건, 출력실 예약 1건, 기자재 예약 1건, 비교과 특강 신청 1건

확인 경로:
1. 로그인
2. 내 예약에서 사전 생성된 심사용 데이터 확인
3. 홈에서 기자재/스튜디오/출력실/암실/비교과 예약 화면 진입
4. 기자재 예약에서 카메라 바디 선택 후 렌즈 추천 하단 시트 확인
5. 비교과 특강에서 신청 완료 상태 확인
6. 마이 화면에서 네이티브 예약 알림 권한 요청 확인
7. 마이 화면에서 계정 삭제 기능 확인 가능

알림 권한 사용 목적:
예약 시작 전 24시간/1시간/10분/시작 시점 리마인더를 제공하기 위해 사용합니다. Apple Watch에서는 iPhone 알림 미러링을 통해 같은 예약 알림을 받을 수 있습니다.

Apple Watch:
Watch 앱은 내 예약 목록 확인만 제공합니다. 예약 신청, 취소, 관리자 기능은 iPhone 앱에서만 사용할 수 있습니다.

계정 삭제:
사용자는 마이 화면에서 현재 비밀번호와 확인 문구를 입력해 앱 안에서 계정 삭제를 시작하고 완료할 수 있습니다.

개인정보 처리방침 URL:
https://gjureserve.co.kr/privacy.html

계정/데이터 삭제 안내 URL:
https://gjureserve.co.kr/account-deletion.html

관리자 기능은 학과 조교/운영자 전용이며, 필요 시 별도 테스트 계정을 제공할 수 있습니다.
```

## Google Play 심사 메모

```text
GJU-reserve is an internal reservation app for Gwangju University Department of Photography & Visual Media.

Reviewer test account:
- ID:
- Password:
- Account status: approved
- Pre-populated review data: studio reservation, print room reservation, equipment reservation, and one lecture application

The app uses notification permission only for local reservation reminders before scheduled reservations. The app does not request exact alarm permissions.
```

## 개인정보 답변 기준

현재 앱 기능 기준으로 수집되는 데이터는 아래처럼 신고한다.

| 항목 | 수집 여부 | 사용자 연결 | 목적 |
| --- | --- | --- | --- |
| 이름 | 예 | 예 | 계정 식별, 예약 관리 |
| 이메일 | 예 | 예 | 로그인/계정 식별 |
| 연락처 | 예 | 예 | 예약 운영 연락 |
| 학번/신분 | 예 | 예 | 학과 내부 사용자 확인 |
| 예약/신청 내역 | 예 | 예 | 예약 기능 제공 |
| 보고서/사용자 제출 내용 | 예 | 예 | 스튜디오 보고서 관리 |
| 알림 설정 | 예, 기기 로컬 | 예 | 예약 리마인더 |
| Apple Watch 예약 요약 | 예, 기기 간 로컬 동기화 | 예 | Watch에서 내 예약 확인 |
| 위치 정보 | 아니오 | 해당 없음 | 사용 안 함 |
| 결제 정보 | 아니오 | 해당 없음 | 사용 안 함 |
| 광고 식별자 | 아니오 | 해당 없음 | 사용 안 함 |

App Store Connect 개인정보 세부사항:

- 앱에서 추적을 사용합니까? 아니오
- 타사 광고 목적으로 수집하는 데이터: 없음
- 개발자의 광고 또는 마케팅 목적으로 수집하는 데이터: 없음
- 데이터 브로커와 공유하는 데이터: 없음
- 연락처 정보의 전화번호: 수집함, 사용자에게 연결됨, 앱 기능 목적, 추적 목적 아님
- 연락처 정보의 이메일 주소: 수집함, 사용자에게 연결됨, 앱 기능 목적, 추적 목적 아님
- 사용자 ID/학번: 수집함, 사용자에게 연결됨, 앱 기능 목적, 추적 목적 아님
- 사용자 콘텐츠/예약 및 보고서 입력: 수집함, 사용자에게 연결됨, 앱 기능 목적, 추적 목적 아님
- 제품 상호작용/감사 로그: 수집함, 사용자에게 연결됨, 앱 기능/보안 목적, 추적 목적 아님

사용자는 앱 내부 `마이 > 계정 삭제`에서 계정 삭제를 완료할 수 있다. 삭제 시 사용자 계정, 세션, 예약, 보고서, 특강 신청, 경고 기록이 함께 정리된다.

App Store Connect의 개인정보 처리방침 URL에는 `https://gjureserve.co.kr/privacy.html`을 사용한다.

Google Play Console의 계정 삭제 웹 리소스에는 `https://gjureserve.co.kr/account-deletion.html`을 사용한다.

추적 목적 수집은 `아니오`로 유지한다. 앱과 웹 배포본은 Google Analytics, 광고 식별자, 타사 광고 네트워크, 데이터 브로커 제공을 사용하지 않는다.

## 심사용 계정 준비

App Review 또는 Play 리뷰용 학생 계정은 `scripts/prepare-review-account.mjs`로 운영 API에 준비한다. 비밀번호는 코드, 문서, 터미널 출력에 남기지 않고 환경변수와 스토어 제출 메모에만 입력한다.

```bash
GJU_REVIEW_ADMIN_PASSWORD='운영 관리자 비밀번호' \
GJU_REVIEW_STUDENT_PASSWORD='심사용 학생 비밀번호' \
npm run review:prepare-account
```

기본 계정 ID는 `appreview-student@gju.local`, 기본 학번은 `APPREVIEW2026`이다. 다른 값을 쓰려면 `GJU_REVIEW_STUDENT_EMAIL`, `GJU_REVIEW_STUDENT_ID`, `GJU_REVIEW_STUDENT_NAME` 환경변수로 바꾼다.

## 스크린샷 준비 목록

iPhone/Android 공통으로 아래 5장을 우선 준비한다.

1. 홈: 주요 예약 진입 카드
2. 기자재 예약: 단계형 선택 화면
3. 내 예약: 카테고리별 예약 내역
4. 비교과 특강: 검색/연도 필터와 신청 상태
5. 마이: 계정 정보와 네이티브 예약 알림 설정
6. 계정 삭제: 마이 화면의 계정 삭제 카드
7. Apple Watch: 내 예약 목록 화면

관리자 화면은 일반 스토어 스크린샷에 넣지 않는 것을 권장한다. 내부 운영 기능과 개인정보가 포함될 수 있기 때문이다.

## 제출 전 문구 확인

- “학교 공식 전체 서비스”처럼 보이지 않도록 `사진영상미디어학과 내부 예약 시스템`이라고 명시한다.
- “실시간 푸시 알림”이 아니라 `기기 로컬 예약 리마인더`라고 설명한다.
- 사용 가능 대상이 학과 내부 구성원이라는 점을 명확히 적는다.
