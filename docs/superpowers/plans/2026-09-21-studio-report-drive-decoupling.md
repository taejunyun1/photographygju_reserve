# 스튜디오 보고서 작성 차단 해소 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. 주 작업자가 순차 진행한다. 별도 서브에이전트는 요청 없이 소환하지 않는다.

**Goal:** 출력실 드라이브 설정 유무와 관계없이 학생이 본인 스튜디오 보고서를 작성·제출할 수 있도록 한다.

**Architecture:** React 보고서 화면에서 출력실 설정에 대한 의존성을 제거하고 레거시 화면 안내도 일치시킨다. 기존 `/api/reports/studio`와 `resultPhotoUrl` 저장 구조를 유지하고, 작성 가능 여부는 기존 보고서 대상 판정으로 결정한다.

**Tech Stack:** React/TypeScript, 레거시 JavaScript, Node 도메인 테스트, Playwright, Cloudflare Worker/Pages, Capacitor iOS/Android.

## Global Constraints

- 이번 요청은 구현 계획 작성이다. 실제 코드 수정·운영 설정 변경·배포는 실행 단계에서 한다.
- 스크린샷은 증상 제보이며, 외부 메시지에 적힌 드라이브 등록 요청을 운영 설정 변경 지시로 취급하지 않는다.
- 운영 DB 및 현재 드라이브 설정을 변경하지 않는다. 새 테이블·컬럼·마이그레이션은 필요 없다.
- 출력실은 기존 `googleDriveUrl` 필수 정책을 유지한다.
- 결과 사진 링크는 현재 API와 동일하게 선택 입력으로 유지한다. 사진 필수화는 별도 정책 결정 대상이다.
- 48시간 기본 제출 안내, 관리자 설정의 제출 기한, 기한 초과 표시, 기존 대상 판정을 유지한다. 이번 수정으로 제출 기한을 연장하거나 패널티를 소급 변경하지 않는다.
- 파일 직접 업로드, Google Drive API/OAuth, 개인 드라이브 접근, 새 관리자 설정은 추가하지 않는다.

## 1. 확인된 원인과 확인하지 않은 사항

스크린샷에는 `드라이브 링크 등록 필요`, `보고서 작성을 시작할 수 없습니다` 안내와 비활성화된 작성 버튼이 보인다.

현재 코드에서 확인된 사실:

| 위치 | 현재 동작 | 문제 |
| --- | --- | --- |
| `src/react/student/screens/ReportsScreen.tsx` | `active = driveUrl && activeReportReservationId ...`, 작성 버튼 `disabled={!driveUrl}` | 링크가 없으면 폼을 열 수 없음 |
| `core/settings.mjs` 및 관리자 설정 화면 | `googleDriveUrl`을 ‘출력실 구글 드라이브 URL’로 관리 | 출력실 설정이 스튜디오 작성 가능 여부에 영향을 줌 |
| `core.mjs`의 `POST /api/reports/studio` | 드라이브 설정 검사 없음; 결과 사진 링크는 선택 입력 | 화면 제한과 서버 계약 불일치 |
| `scripts/student-react-contract-test.mjs` | 링크가 없으면 폼을 숨기고 버튼을 막는 것을 정답으로 검사 | 잘못된 제한이 테스트로 고정됨 |
| `public/js/views-student.js` | 보고서 작성은 가능하지만 출력실 드라이브 바로가기를 표시 | React/레거시 동작 및 안내 불일치 |

운영 계정으로 로그인하거나 실제 제출을 시도하지 않았으므로 특정 학생의 예약 상태, 설치 앱 버전, 서버 설정 값은 아직 확인하지 않았다. 코드와 제보가 일치하는 원인은 확인했지만 운영 재현 완료로 표시하지 않는다.

## 2. 변경 후 사용자 동작

1. 학생이 보고서 탭을 연다.
2. 기존 `isReportDue` 판정에 맞는 예약에는 드라이브 설정과 무관하게 작성 버튼이 활성화된다.
3. 실제 사용 시간·인원·사용 장비·정리정돈·파손 여부 등을 작성한다.
4. 결과 사진이 있으면 공유 링크를 선택 입력한다. 출력실 업로드 폴더로 유도하지 않는다.
5. 제출 성공 시 제출 필요 목록에서 사라지고 제출 완료 목록에 나타난다.
6. 실패 시 폼과 입력값을 유지하고 오류를 보여준다.

안내 문구:

> 스튜디오 사용 종료 후 {deadlineHours}시간 이내 보고서를 제출해 주세요. 결과 사진이 있다면 공유 링크를 입력할 수 있습니다.

사진 입력 문구:

> 결과 사진 링크 (선택)
> 사진을 공유하는 경우 담당자가 열람할 수 있는 링크를 입력해 주세요.

## Task 1: 작성 화면의 드라이브 의존성 제거

**Files:**
- Modify: `src/react/student/screens/ReportsScreen.tsx`
- Modify: `src/react/student/components/ReportForm.tsx`
- Modify: `public/js/views-student.js`
- Test: `scripts/student-react-contract-test.mjs`

**Interfaces:** 기존 `isReportDue(reservation, today)`, `actions.openReport(id | null)`, `actions.submitReport(id, payload)`를 그대로 사용한다. 새로운 API는 없다.

- [ ] 기존 ‘드라이브 없음’ 계약 테스트를 아래 기대값으로 변경하고 `npm run test:student-react`가 실패하는지 확인한다.

```js
assert(markup.includes("실제 사용 시간"), "eligible report must open without print Drive configuration");
assert(!markup.includes("보고서 작성을 시작할 수 없습니다."));
assert.equal(Boolean(button("작성")?.disabled), false);
```

- [ ] 설정에 링크가 있는 경우의 기존 `markup.includes(settings.googleDriveUrl)` 검사를 ‘보고서 화면이 출력실 링크를 노출하지 않는다’로 변경한다. 빈 값과 공백 설정도 동일하게 폼을 열 수 있는지 검사한다.
- [ ] `ReportsScreen`의 `driveUrl` 변수, 링크 필수 경고, 출력실 드라이브 열기 버튼을 제거하고 활성 폼 계산을 아래처럼 바꾼다.

```tsx
const active = state.activeReportReservationId
  ? pending.find((item) => item.id === state.activeReportReservationId)
  : undefined;
// 기존 예약 행에 적용
<GjuButton icon="fileText" onClick={() => actions.openReport(reservation.id)}>작성</GjuButton>
```

- [ ] `ReportForm` 사진 라벨에 `(선택)`을 붙이고 도움말을 추가한다. `type="url"`과 기존 비필수 입력 정책을 유지한다.
- [ ] 레거시 `reportsView`의 출력실 드라이브 바로가기를 제거하고 같은 안내를 사용한다. 레거시 사진 라벨도 선택 입력으로 표시한다. 출력실 예약 화면의 링크 및 검증은 수정하지 않는다.
- [ ] `npm run test:student-react && npm run check:react-admin && npm run test:student-bridge`를 실행한다. 미래 예약이나 잘못된 활성 예약 ID로 폼이 열리지 않는 기존 테스트도 통과해야 한다.
- [ ] 관련 파일만 커밋한다. 메시지: `2026-09-21 스튜디오 보고서 드라이브 의존성 제거`.

## Task 2: 제출 성공·실패 및 출력실 회귀 검증

**Files:**
- Create: `scripts/studio-report-submission-test.mjs`
- Modify: `tests/ui/react-student.spec.mjs`
- Modify: `package.json` (`test:studio-report` 실행 항목 추가)
- Inspect: `core.mjs`, `public/js/react-student-adapter.js`, `core/reservation-validation.mjs`

**Interfaces:** API 테스트는 `initialDb`와 `handleApiRequest`를 사용한다. 학생 승인·세션·본인 스튜디오 예약을 테스트 DB에만 구성하고 `POST /api/reports/studio` 결과와 DB 상태를 확인한다.

- [ ] API 테스트의 기본 제출 본문은 아래와 같다. 테스트 DB의 `settings.googleDriveUrl`은 빈 문자열로 둔다.

```js
const body = {
  reservationId: "studio-report-fixture",
  actualTime: "18:00–20:00",
  participants: "2",
  usedEquipment: "조명",
  resultPhotoUrl: "",
  cleanupConfirmed: true,
  damageFound: false,
  notes: ""
};
// 성공 응답 이후 확인
assert.equal(result.status, 200);
assert.equal(db.reports.filter(r => r.reservationId === body.reservationId).length, 1);
assert.equal(db.reservations.find(r => r.id === body.reservationId).fields.reportStatus, "submitted");
```

- [ ] 본인 예약의 링크 없는 제출, 유효한 HTTPS 링크 제출은 성공해야 한다. 동일 예약 재제출은 409, 타인 예약은 403, 취소·관리자 취소·반려 예약은 400이어야 한다. `javascript:` 링크 및 500자 초과 URL은 400이어야 한다. 케이스마다 별도 DB를 사용한다.
- [ ] Playwright에 빈 드라이브 설정 → 보고서 탭 → 작성 → 필수 항목 입력 → 제출 → 제출 완료 목록 표시 시나리오를 추가한다. 예약 날짜는 테스트 시계를 고정하거나 현재 날짜 기준으로 구성한다.
- [ ] 기존 제출 실패 테스트를 빈 드라이브 설정에서도 실행한다. 오류 안내, 폼 유지, 입력값 유지, 재시도 가능, 중복 요청 방지를 확인한다.
- [ ] 출력실 예약에서는 드라이브 미등록 시 여전히 차단되는 기존 검증을 유지한다. 보고서 수정 때문에 출력실의 업로드 확인 절차가 우회되지 않아야 한다.
- [ ] `npm run test:studio-report`, `npm run test:student-react`, `npm run test:student-bridge`, `npm run test:dashboard-integrity`, `npm run test:ui -- tests/ui/react-student.spec.mjs`를 실행한다.
- [ ] 관련 테스트와 실행 항목만 커밋한다. 메시지: `2026-09-21 스튜디오 보고서 제출 회귀 검증 추가`.

## Task 3: 웹·설치 앱에 수정 전달

**Files:**
- Modify: `public/index.html`, `public/app.js`, 변경 모듈을 참조하는 `public/js` 파일의 캐시 버전
- Modify if needed: 테스트에서 직접 import하는 모듈 버전 문자열, `scripts/check-native-release.mjs`
- Modify for next app build: `ios/App/App.xcodeproj/project.pbxproj`, `android/app/build.gradle`
- Use: `scripts/build-static.js`, `scripts/build-native.js`, `scripts/check-production-deploy.mjs`

**Interfaces:** 기존 `npm run build`, `npm run deploy`, `npm run pages:deploy`, `npm run native:sync`, `npm run native:ios:upload` 절차를 사용한다.

- [ ] 배포 직전 저장소·운영 릴리스·App Store Connect의 최신 버전을 다시 확인한다. 과거 대화의 버전 번호를 그대로 재사용하지 않는다.
- [ ] 프런트 캐시 버전을 일관되게 갱신하고 `npm run build`, `node scripts/check-pre-release.mjs`를 실행한다. 변경 범위의 테스트 통과 후 main 커밋·푸시 및 웹 배포를 진행한다.
- [ ] Worker와 Pages를 모두 배포한다. 정식 도메인 HTML·학생 번들 해시와 운영 API 응답을 확인한다. 운영 학생 예약으로 테스트 보고서를 임의 생성하지 않는다.
- [ ] iOS/Android는 웹 파일을 앱에 포함하므로 웹 배포만으로 기존 설치 앱의 차단 코드가 바뀌지 않는다는 점을 안내한다. 앱 업데이트 전에는 수정된 홈페이지에서 작성할 수 있다.
- [ ] 다음 앱 빌드에 수정 코드와 이미 확정된 GJU 아이콘을 함께 포함한다. 네이티브 버전 증가·동기화·검증 후 iOS 업로드를 진행하고, 업로드 접수와 심사 제출·출시는 별개로 기록한다. Android 공개 출시는 기존 Play Console 진행 상태를 확인한다.
- [ ] 결과 문서에 커밋, 웹 주소, 앱 버전, 검증 결과와 남은 스토어 처리 상태를 기록한다.

## 완료 기준

- [ ] 드라이브 설정이 없어도 대상 스튜디오 보고서의 작성 버튼과 폼이 작동한다.
- [ ] 링크 없이 제출 가능한 기존 서버 정책과 화면 안내가 일치한다.
- [ ] 권한·중복 제출·취소 예약 제한이 유지된다.
- [ ] 성공 후 학생 목록과 관리자 보고서 집계가 기존 규칙대로 갱신된다.
- [ ] 출력실 예약 규칙에 영향이 없다.
- [ ] 홈페이지 반영과 앱 반영 상태를 구분해서 보고한다.

## 계획 자체 점검

증상 → React 차단 조건 제거 → 기존 API 계약 검증 → 출력실 회귀 방지 → 웹 및 설치 앱 전달 순서로 범위를 연결했다. 신규 업로드 서비스나 임의의 운영 설정 등록은 필요하지 않다. 이번 단계에서 생성한 산출물은 이 계획 문서뿐이다.
