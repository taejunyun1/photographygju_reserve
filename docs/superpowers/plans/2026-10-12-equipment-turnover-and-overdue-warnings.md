# 기자재 반납 예정 시간 기준 선예약·미반납 자동 경고 구현계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 2026-10-12 사용자가 구현·웹 배포·App Store Connect 업로드를 요청했다.

**Goal:** 이전 이용자가 반납하기 전에도 다음 이용자가 반납 예정 시간 이후의 대여를 전날 예약할 수 있게 하고, 미반납에는 예약별 경고 1회를 자동 부여하여 관리자가 실제 반납 시각에 따라 유지·해제한다.

**Architecture:** 예약의 시간 점유와 장비의 실제 인계를 분리한다. 공통 시간 계산으로 서버·React·기존 화면의 충돌 판단을 통일하고, 기존 반납 점검과 warnings 저장소에 실제 반납 시각·예약별 경고 심사를 추가한다. 별도 1분 주기 점검으로 경고를 생성하되, 모든 예약·반납·경고 변경은 동일한 직렬화 경로와 SQL 트랜잭션으로 저장한다.

**Tech Stack:** React/TypeScript, 브라우저 ES modules, Node.js, Cloudflare Worker + Durable Object SQLite, Capacitor iOS/Android, 기존 Node assert 및 Playwright 테스트.

## Global Constraints

- 기자재 예약 마감은 사용일 전날 23:59, Asia/Seoul 기준으로 유지한다.
- 현재 대여·반납 시간 선택지, 평일 2박3일 허용, 주말사용 금요일 제한을 유지한다.
- 사용자 확정: 제때 반납했는데 관리자 처리만 늦은 경우 경고 해제. 실제 지각은 경고 유지.
- 경고는 대여 예약 1건당 1회. 장비 개수나 지연 일수, 배치 실행 횟수에 따라 추가하지 않는다.
- 자동 대여금지·예약 취소·기존 경고 전체 삭제는 이번 기능에 포함하지 않는다.
- 관리자에게 보이는 실제 인계 가능 여부는 서버가 최종 판단한다.
- 사용자 승인에 따라 기능 구현과 검증, 웹·서버 배포 및 iOS 업로드를 진행한다.

---

## 1. 현재 코드에서 확인한 문제

| 현재 위치 | 확인 내용 | 필요한 변경 |
|---|---|---|
| `core/reservation-validation.mjs` | `dateRangesOverlap()`가 시작일·종료일을 포함 비교하여 반납일 전체를 점유한다. | 기자재만 시각 단위로 비교한다. |
| `core/reservation-timing.mjs` | `reservationTiming()`에 KST 대여·반납 시각 계산이 이미 있다. | 기자재 시간 계산을 공통 함수로 재사용한다. |
| `src/react/student/availability.ts` | 장비 선택에서도 날짜 범위만 비교한다. | 대여 시각·반납 시각을 인자로 전달한다. |
| `public/js/utils.js`, `public/js/views-student.js` | 기존 화면과 렌즈 추천, 선택 목록 정리에도 같은 날짜 비교가 있다. | 신규 화면과 같은 시간 규칙으로 맞춘다. |
| `core.mjs` 예약 상태 API | 상태 전이만 확인하고 다른 이용자의 실제 미반납 여부는 확인하지 않는다. | 승인 시 예정 충돌, 인계 시 실제 점유·장비 상태를 재검사한다. |
| `core.mjs` 반납 점검 API | 장비 상태를 점검하고 `returned`로 바꾸지만 실제 반납 시각은 별도로 저장하지 않는다. | 실제 반납 시각과 관리자 처리 시각을 구분한다. |
| `core.mjs`, `core/auth-session.mjs` | 수동 경고와 학생별 전체 초기화만 있다. 목록은 최근 3건만 반환한다. | 예약에 연결된 개별 경고, 심사 상태, 전체 조회를 추가한다. |
| `core/operations-insights.mjs` | 미반납 주의 표시가 있지만 경고 기록을 생성하지 않는다. | 자동 경고와 연결하고 후속 예약의 인계 지연을 표시한다. |
| `worker.mjs`, `wrangler.worker.jsonc` | 현재 정기 작업은 데이터 정리용이다. | 데이터 정리와 별개로 미반납 점검을 실행한다. |

확인 예시: A의 10월 13일 17:10 반납과 B의 같은 날 17:30 대여는 현재 날짜 비교에서 충돌한다. 기존 `reservationTiming()`으로 계산한 두 시각 구간은 겹치지 않는다.

## 2. 적용할 운영 흐름

### 2.1 선예약

예시 장비는 동일한 장비 코드 1대다. 동일 모델의 다른 장비 코드는 독립적으로 예약한다.

| 시점 | 상황 | 처리 |
|---|---|---|
| 10월 12일 | A가 사용 중이며 10월 13일 17:10 반납 예정 | 장비의 다음 예약 가능 시각을 계산한다. |
| 10월 12일 23:59 이전 | B가 10월 13일 17:30부터 대여 신청 | A의 실제 반납 전이어도 신청 가능. 기존 관리자 승인 절차 유지. |
| 같은 시점 | C도 B와 겹치는 시간에 같은 장비 신청 | 이미 접수된 B의 신청이 점유하므로 거절한다. 대기열을 새로 만들지 않는다. |
| 10월 13일 17:10 이전 | A 반납 확인 및 장비 정상 점검 | B의 인계 준비 완료. |
| 10월 13일 17:10 경과 | 시스템상 A가 여전히 대여 중 | A에게 자동 경고 1회, 관리자 확인 대기. |
| 10월 13일 17:30 | A 미반납 상태에서 B 인계 시도 | 인계 차단. B의 예약은 유지하고 관리자에게 원인을 표시. B에게 경고를 주지 않는다. |

시간 구간은 `[시작, 종료)`로 정의한다. 두 예약은 `A.start < B.end && B.start < A.end`일 때만 충돌한다. 기존 시간표의 17:10→17:30 간격을 그대로 사용한다. 다른 시간대에 일괄적으로 20분의 추가 버퍼를 강제하는 정책은 넣지 않는다.

승인 대기·승인 완료·대여 중 예약이 예정 시간 구간을 점유한다. 취소·반려·반납 완료 예약은 점유하지 않는다. 단, 현재 이미 연체 중인 장비는 관리자 반납 확인 전까지 **새로운** 선예약을 보류한다. 연체 전에 접수된 후속 예약은 보존한다.

### 2.2 실제 인계

예약 가능과 실제 대여 처리는 별도 검증이다.

- B의 예약이 승인되어 있고 현재가 B의 대여 시작 시각 이상인지 확인한다.
- 같은 장비를 포함한 다른 `checked_out` 예약이 있으면 대여 처리를 거절한다. A의 예정 종료 시각이 지났다는 이유만으로 통과시키지 않는다.
- 반납 점검 결과가 점검 필요·수리 필요이거나 장비가 비활성·예약 불가이면 인계하지 않는다.
- 여러 장비를 빌리는 경우 모두 통과해야 한 번에 인계 처리한다. 일부만 인계·반납하는 기능은 이번 범위에서 제외한다.
- 대여 중인 예약의 취소·삭제로 실제 점유 기록을 지우지 못하게 한다. 반납 확인을 먼저 처리해야 한다.
- 동일 장비에 B와 C가 동시에 신청·인계 요청을 보내도 한 요청만 성공한다.

### 2.3 자동 경고와 관리자 심사

- 기준은 각 예약의 반납 예정 시각이다. 17:10만 하드코딩하지 않고 10:15·12:00 등 설정된 모든 반납 시각에 동일하게 적용한다.
- 반납 예정 시각이 지난 대여 중 예약을 정기 확인하여 `미반납 · 확인 대기` 경고를 1회 생성한다.
- 생성 즉시 유효 경고 횟수에 1회 반영한다. 확인 대기 경고라는 표시를 함께 제공한다.
- 정기 작업이 실행되기 전에 늦게 반납 처리되는 경우에도 실제 반납 시각으로 지각을 판단하여 1회 경고를 생성한다.
- `정상/점검 필요/수리 필요`는 장비 상태이고 `정시/지각`은 반납 시간이다. 장비가 정상이라는 이유로 지각 경고를 지우지 않는다.

| 관리자 확인 결과 | 경고 처리 | 장비·예약 처리 |
|---|---|---|
| 실제 반납 17:05, 관리자 처리 17:25 | 해당 자동 경고만 해제 | 점검 완료 후 반납 처리, 정상 장비 인계 가능 |
| 실제 반납 17:20 | 지각 경고 확정·유지 | 점검 완료 후 반납 처리, 정상 장비 인계 가능 |
| 아직 미반납 | 확인 대기 경고 유지 | 후속 예약의 실제 인계 차단 |
| 반납했지만 장비 수리 필요 | 반납 시각으로 경고 판단 | 수리 필요 장비는 후속 인계 차단 |

경고 해제에는 실제 반납 시각과 확인 사유를 필수로 남긴다. 기록은 삭제하지 않고 `해제`로 보존한다. 실제 지각 경고는 이 자동 경고 심사 API로 임의 해제할 수 없으며, 반납 시각 입력 오류의 정정은 관리자 사유와 변경 이력을 남기는 별도 정정 동작으로 처리한다.

## 3. 구현 방식 비교

| 방식 | 장점 | 문제 | 선택 |
|---|---|---|---|
| 시간 기반 선예약 + 실제 인계 검사 + 자동 경고 | 요청한 운영 흐름을 직접 지원, 기존 승인·반납 구조 재사용 | 시간 비교와 실제 반납 기록을 함께 수정해야 함 | 채택 |
| 반납되면 대기 신청을 예약으로 전환 | 실제 재고 확인 후 확정 | 전날 확정 예약이 어려움, 대기 순번·승격·통지까지 범위 증가 | 제외 |
| 관리자가 선예약을 수동 등록 | 수정 범위 작음 | 학생의 직접 선예약 불가, 운영 업무 증가 | 제외 |

## 4. 데이터·API 계약

### 4.1 시간 및 실제 반납

`reservation.fields`의 기존 예약 정보를 보존하고 다음 값을 예약 최상위에 추가한다.

```ts
type EquipmentCustody = {
  actualCheckedOutAt?: string; // UTC ISO, 서버가 대여 처리 때 기록
  actualReturnedAt?: string; // 관리자가 확인한 실제 반납 시각, UTC ISO
  returnProcessedAt?: string; // 서버가 기록한 관리자 처리 시각
  returnProcessedBy?: string;
  returnTimeNote?: string; // 처리 시각보다 앞선 반납 시각을 입력·정정할 때 필수
};
```

실제 반납 시각은 실제 대여 시각 이상·현재 시각 이하이어야 한다. 관리자가 실제 반납 시각을 선택하도록 하고, 늦은 시간에 처리하는 경우 단순히 처리 시각으로 지각을 확정하지 않도록 확인 화면에 두 시각을 나란히 표시한다. 기존 대여 중 예약의 실제 대여 시각은 상태 변경 이력을 먼저 참조하고, 이력이 없으면 관리자가 확인하기 전 임의로 소급 채우지 않는다.

### 4.2 경고 기록

```ts
type EquipmentOverdueWarning = {
  id: string; // `equipment_overdue:${reservationId}` — 예약별 결정적 ID
  userId: string;
  reservationId: string;
  source: 'equipment_overdue';
  status: 'pending_review' | 'confirmed' | 'cleared';
  reason: string;
  dueAt: string;
  detectedAt: string;
  createdAt: string;
  equipmentIds: string[];
  actualReturnedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
};
```

기존 `warnings.data` JSON에 추가 필드를 저장한다. 기존 `warnings.id` 기본 키와 결정적 ID로 중복 저장을 방지한다. 해제된 기록도 남겨 동일 예약에 경고가 재생성되지 않도록 한다. `pending_review`, `confirmed`, 상태 필드가 없는 기존 수동 경고만 유효 횟수에 포함하며, 기존 `count` 누계값을 합산하지 않는다. 기존 숫자와 경고 기록의 개수가 다른 계정은 배포 전 목록으로 확인하고 자동으로 경고를 줄이지 않는다.

### 4.3 변경·추가 API

| 경로 | 계약 |
|---|---|
| 기존 `POST /api/reservations` | 예정 시간 충돌 검사. 이미 연체 중인 선택 장비는 409. 전날 예약 규칙 유지. |
| 기존 `PATCH /api/admin/reservations/:id/status` | 승인 시 예정 충돌 재검증. `checked_out` 시 실제 점유·정상 장비·대여 시각 확인. `returned` 직접 전이는 공통 반납 처리로 통합해 점검 우회를 차단. |
| 기존 `POST /api/admin/reservations/:id/return-inspection` | 기존 `inspections`에 `actualReturnedAt`, `returnTimeNote` 추가. 반납·장비 상태·경고 심사·감사 로그를 한 트랜잭션에 저장. |
| 신규 `GET /api/admin/warnings` | `status`, `source`, `userId`, `reservationId`, `page`로 전체 경고 조회. 최근 3건 요약은 유지. |
| 신규 `PATCH /api/admin/warnings/:id/review` | 관리자 전용. `{ actualReturnedAt, reason }`를 받고 서버가 `cleared/confirmed` 결정. 미반납 예약은 기존 반납 점검으로 유도. 임의 상태 문자열은 받지 않음. |
| 신규 `PATCH /api/admin/reservations/:id/return-time` | 반납 완료 예약의 실제 반납 시각 오입력을 관리자 사유와 함께 정정. 해당 자동 경고의 판정을 다시 계산하고 전후 값을 감사 로그로 기록. |
| 신규 내부 `POST /api/internal/equipment-overdue` | 기존 내부 인증 규칙 사용. 정상 브라우저·학생이 실행할 수 없음. 미반납 경고 점검 요약 반환. |

경고 해제와 반납 상태는 서로 대체하지 않는다. 미반납 예약에서 경고만 해제하여 인계 가능해지는 경로를 만들지 않는다. 기존 사용자별 경고 초기화는 수동 경고에 한해서만 작동하게 하고 자동 경고는 개별 심사로 처리한다.

## 5. 단계별 구현

### Task 1: 기자재 시간 구간 계산 통일

**Files:** Create `public/js/equipment-schedule.mjs`, `public/js/equipment-schedule.d.mts`, `scripts/equipment-turnover-domain-test.mjs`; Modify `core/reservation-timing.mjs`, `server.mjs`, `package.json`.

**Interfaces:** `equipmentScheduledWindow(fields): { startAt: string; endAt: string } | null`, `equipmentWindowsOverlap(left, right): boolean`. 입력은 기존 `reservedDate/period/rentalTime/returnTime`. DOM·state·저장소에 의존하지 않는 순수 함수로 작성하고 서버·React·기존 화면에서 같은 모듈을 import한다. `.mjs` MIME을 로컬 서버에 추가한다.

- [ ] 먼저 다음 경계 테스트를 작성하고 현재 날짜 기반 방식에서 실패함을 확인한다.

```js
const a = { startAt: '2026-10-13T01:15:00.000Z', endAt: '2026-10-13T08:10:00.000Z' };
const b = { startAt: '2026-10-13T08:30:00.000Z', endAt: '2026-10-14T08:10:00.000Z' };
assert.equal(equipmentWindowsOverlap(a, b), false);
assert.equal(equipmentWindowsOverlap(a, { ...b, startAt: '2026-10-13T08:00:00.000Z' }), true);
assert.equal(equipmentWindowsOverlap(a, { ...b, startAt: a.endAt }), false);
```

- [ ] `reservation-timing.mjs`의 기자재 날짜·시간 계산을 순수 모듈로 옮기고, 다른 시설의 시간 계산은 유지한다. 유효하지 않은 날짜·누락 시각·종료≤시작은 유효 구간으로 취급하지 않는다.
- [ ] 신규 요청에 잘못된 시각이 있으면 400. 기존 예약에 잘못된 시각이 있으면 관련 날짜의 장비 예약을 보수적으로 보류하고 관리자 확인 대상으로 표시한다.
- [ ] `node scripts/equipment-turnover-domain-test.mjs && npm run test:backend-domains` 실행. 기존 1박2일·2박3일·금요일 주말사용 반납일 계산도 통과해야 한다.
- [ ] 검증된 시간 계산 변경을 독립 커밋으로 기록한다.

### Task 2: 서버 선예약·승인·인계 보호

**Files:** Create `core/mutation-queue.mjs`; Modify `core/reservation-validation.mjs`, `core.mjs`, `core/admin-bulk-delete.mjs`, `core/reservation-views.mjs`, `worker.mjs`, `server.mjs`, `scripts/equipment-operations-api-test.mjs`, `scripts/reservation-equipment-requests-test.mjs`; Extend `scripts/equipment-turnover-domain-test.mjs`.

**Interfaces:** 예약 검증은 Task 1의 예정 시간 구간을 소비한다. `getEquipmentHandoffBlockers(db, reservation, now)`는 `{ equipmentId, reason: 'not_returned' | 'unavailable' | 'not_started' }[]`를 반환한다. 학생용 결과에는 다른 학생의 신상이나 경고 내역을 포함하지 않는다.

`createMutationQueue().run(operation)`은 이전 작업의 성공·실패와 무관하게 다음 작업을 순서대로 실행한다. Worker의 동일 Durable Object 및 로컬 서버에서 DB 읽기·검증·변경·저장을 같은 큐에 넣는다. 공유 메모리의 저장 전 변경을 읽는 경로도 검토하여 부분 상태가 노출되지 않게 한다. 이후 반납·경고·정기 점검도 이 경로를 재사용한다.

- [ ] 테스트 DB에서 A 대여 중 → B 다음 대여 신청 성공 → C 동일 시간 신청 409 사례를 작성한다. B가 A 반납 예정 시각 이전에 시작하면 409, 당일 신규 신청은 400이어야 한다.
- [ ] 공통 변경 큐를 먼저 적용한다. 충돌 검사부터 저장까지 외부 알림 호출로 분리되지 않게 하고, 알림은 저장 성공 후 보낸다. 저장 실패 시 공유 메모리도 복구하여 다음 요청이 실패한 변경을 보지 않게 한다.
- [ ] 기자재 충돌 비교만 시각 구간으로 바꾼다. 날짜 전체 운영 차단 검사와 타 시설 검증은 유지한다. 신규 예약과 수정·재예약·추천 후보 검증이 모두 동일 규칙을 사용하게 한다.
- [ ] `approved → checked_out` 요청에 실제 미반납·장비 상태·시각 검사를 넣고 성공 시 `actualCheckedOutAt`을 서버 시각으로 저장한다.
- [ ] `checked_out` 예약의 취소·개별 삭제·일괄 삭제를 거절하여 실제 점유가 사라지지 않게 한다. 후속 예약과 겹치는 기존 예약 연장·변경도 거절한다.
- [ ] 두 요청 동시 접수와 같은 장비 두 건 동시 인계를 시험한다. 충돌 검사부터 저장까지 직렬화하여 각각 정확히 한 요청만 성공해야 한다.
- [ ] `node scripts/equipment-turnover-domain-test.mjs && npm run test:equipment-operations && npm run test:equipment-requests && npm run test:smart-reservation` 통과 후 커밋한다.

### Task 3: 학생의 장비 선택·최종 제출 반영

**Files:** Modify `src/react/student/availability.ts`, `src/react/student/reservationDraft.ts`, `src/react/student/components/ReservationControls.tsx`, `src/react/student/types.ts`, `public/js/utils.js`, `public/js/views-student.js`, 관련 `public/js/events/` 호출부; Extend `scripts/student-react-contract-test.mjs`, `scripts/equipment-reservation-ui-test.mjs`, `tests/ui/react-student.spec.mjs`.

**Interfaces:** `equipmentItemAvailability(bootstrap, item, fields, now)`의 `fields`는 네 가지 일정 값을 모두 포함한다. 기존 두 화면의 장비 목록·렌즈 추천·선택 제거·다음 버튼·최종 제출에서 모두 같은 입력을 전달한다.

```ts
type EquipmentScheduleFields = {
  reservedDate: string;
  period: string;
  rentalTime: string;
  returnTime: string;
};
```

- [ ] A의 반납 처리 전에도 B의 17:30 예약에서 같은 장비가 표시·선택·제출되는 화면 테스트를 먼저 작성한다.
- [ ] 장비별로 `17:10 반납 예정 · 17:30 대여 예약 가능`을 간결하게 표시한다. 이미 연체 중이면 `반납 지연 · 관리자 확인 중`과 선택 불가 상태를 표시한다.
- [ ] 시간을 바꾸면 목록·추천·선택 상태를 다시 계산한다. 최종 신청에서 서버 409를 받으면 최신 가용성을 갱신하고 입력 내용은 보존한다.
- [ ] 기존 후속 예약은 `인계 확인 필요` 표시만 추가하고 자동 취소하지 않는다. B에게 A의 경고 횟수나 개인정보를 전달하지 않는다.
- [ ] `npm run test:student-react && npm run test:student-bridge && npm run test:equipment-ui` 및 모바일·데스크톱 Playwright 예약 흐름을 통과시킨 후 커밋한다.

### Task 4: 실제 반납·예약별 경고 도메인

**Files:** Create `core/equipment-overdue.mjs`, `scripts/equipment-overdue-test.mjs`; Modify `core.mjs`, `core/auth-session.mjs`, `core/reservation-views.mjs`, `storage-sql.mjs` 관련 정규화·저장 검증, `scripts/sql-storage-smoke-test.mjs`.

**Interfaces:** `syncEquipmentOverdueWarnings(db, now)`는 `{ changed, createdWarningIds }`를 반환한다. `reviewEquipmentOverdueWarning(db, { warningId, actualReturnedAt, reason, adminId, now })`는 판정된 경고를 반환한다. 두 함수는 저장이나 외부 통신을 직접 수행하지 않고 호출자가 한 트랜잭션에서 저장한다.

- [ ] 같은 예약을 세 번 점검해도 자동 경고는 한 건, 유효 횟수는 +1임을 테스트한다. 같은 예약의 장비가 세 대여도 +1이어야 한다.
- [ ] 예정 시각 이전에는 경고 없음, 예정 시각 이후 대여 중이면 `pending_review`, 실제 지각 반납이 확인되면 `confirmed`, 정시 반납 증빙이면 `cleared`를 구현한다.
- [ ] 기존 반납 점검에서 실제 반납 시각을 기록하고 반납·장비 점검·경고 판정을 한 번에 저장한다. 처리 시각과 실제 시각이 다르면 사유 필수. 저장 실패 시 메모리 변경까지 복구한다.
- [ ] 동일한 반납 요청 재전송은 기존 결과를 반환하도록 한다. 성공한 점검을 중복 저장하거나 경고를 재생성하지 않는다.
- [ ] 기존 `returned` 직접 상태 전이를 같은 반납 함수로 보내 점검·시각 기록 우회를 막는다. 실제 반납 시각 정정은 전후 값과 수행자를 감사 로그에 남긴다.
- [ ] `node scripts/equipment-overdue-test.mjs && npm run test:equipment-operations && npm run test:storage && npm run test:security` 통과 후 커밋한다. 실제 지각 경고는 정상 장비 반납 후에도 남아야 한다.

### Task 5: 자동 실행과 도입 시점

**Files:** Modify `worker.mjs`, `wrangler.worker.jsonc`, `server.mjs`, `core/settings.mjs`, `core.mjs`, `package.json`; Create `scripts/equipment-overdue-scheduler-test.mjs`.

**Interfaces:** Task 2에서 만든 `createMutationQueue().run(operation)`에 자동 점검을 연결한다. 같은 db에 접근하는 예약·승인·반납·경고 변경과 자동 점검은 모두 이 경로에 들어간다. 검증·변경·SQL 저장 사이에 외부 알림 전송을 두지 않고 저장 성공 후 전송한다.

- [ ] Cron과 반납 처리 경합, 이중 신청, 저장 실패 후 다음 요청, 프로세스 재시작 이후 중복 경고 방지를 시험한다.
- [ ] `wrangler.worker.jsonc`에 1분 주기 Cron을 추가하고 기존 데이터 정리 Cron은 유지한다. `scheduled`에서 이벤트의 Cron 식에 따라 내부 점검 경로를 나누어 매분 정리 작업까지 실행되는 실수를 막는다.
- [ ] 자동 점검 성공 시 최근 실행 시각·생성 건수·실패 여부를 저장한다. 관리자 화면에서 실행 실패를 확인할 수 있게 한다. 정기 실행 지연 시 다음 점검이 누락된 대상까지 따라잡는다.
- [ ] 로컬 개발 서버는 같은 도메인 함수를 1분 주기로 실행하고 테스트에서는 타이머를 끄거나 `now`를 주입한다. 요청과 타이머가 각각 읽은 DB를 덮어쓰지 않도록 DB 읽기부터 저장까지 같은 큐에 넣는다.
- [ ] 활성화 설정 `equipmentOverdueWarningsEnabled`의 기본값은 false. 최초 활성화 시 서버가 기록하는 `equipmentOverdueWarningsEnabledAt` 이후 도래한 반납 기한만 자동 경고 대상으로 삼는다. 기존 미반납 건은 관리자 확인 목록에만 올리고 소급 경고하지 않는다.
- [ ] 반납 처리에서는 실제 지각을 즉시 확인하므로 정기 실행보다 먼저 반납되어 경고가 누락되는 경우가 없어야 한다. 경고를 해제한 예약은 정기 실행에서 다시 생성하지 않는다.
- [ ] `node scripts/equipment-overdue-scheduler-test.mjs && node scripts/equipment-overdue-test.mjs && npm run test:storage` 통과 후 커밋한다.

Cron은 UTC로 실행되지만 기한 비교는 ISO 시각으로, 화면은 Asia/Seoul로 통일한다. 1분 주기는 정기 점검 목표이며 외부 실행 지연까지 포함한 정시 실행 보장은 아니다. Cron 변경의 전파 완료도 배포 체크에 포함한다. [Cloudflare Cron Triggers 공식 문서](https://developers.cloudflare.com/workers/configuration/cron-triggers/)

### Task 6: 관리자 확인·개별 해제 화면

**Files:** Modify `src/react/admin/screens/AdminReservations.tsx`, `src/react/admin/screens/AdminUsers.tsx`, `src/react/admin/screens/AdminDashboard.tsx`, `src/react/admin/screens/AdminLogs.tsx`, `src/react/platform/types.ts`, `public/js/actions.js`, `public/js/views-admin.js`, `public/js/events/admin-flow.js`; Extend 관리자 계약·브리지 테스트와 `tests/ui/react-admin.spec.mjs`.

**Interfaces:** 관리자 액션은 `reviewEquipmentWarning(warningId, { actualReturnedAt, reason })`, `correctEquipmentReturnTime(reservationId, { actualReturnedAt, reason })`를 제공한다. 기존 `returnEquipmentReservation`은 반납 시각·사유 인자를 추가한다.

- [ ] 반납 점검창에 예정 반납·실제 반납·처리 시각·자동 경고 판정을 함께 보여주는 UI 테스트를 작성한다.
- [ ] 대시보드에서 `미반납 확인 대기`, `후속 대여 지연`, `확정 경고`를 연결한다. 누르면 해당 예약·장비로 이동하게 한다.
- [ ] 경고 행에 예약, 장비 코드, 예정 반납 시각, 실제 반납 시각, 확인 대기/확정/해제, 확인 관리자·사유를 표시한다. 경고 전체 조회를 통해 최근 3건 밖의 기록도 확인할 수 있어야 한다.
- [ ] 확인 대기 예약은 `반납 점검`으로 유도한다. 이미 반납된 예약은 정시 반납 확인·경고 유지 판정을 제공한다. 전체 초기화로 자동 경고를 해제하는 버튼은 제공하지 않는다.
- [ ] 유효 경고 수는 원본 기록에서 계산한다. 경고 한 건 해제 시 다른 수동·자동 경고에는 영향이 없어야 한다.
- [ ] `npm run check:react-admin && npm run test:react-admin && npm run test:admin-ui`와 관련 관리자 Playwright 테스트 통과 후 커밋한다.

### Task 7: 전체 회귀·배포 준비

**Files:** Modify `docs/service-specification/02-functional-specification.md`, `docs/service-specification/03-api-integration-specification.md`, `docs/service-specification/05-deployment-operations-security.md`, 릴리스 캐시·네이티브 버전 및 해당 검사 파일.

- [ ] 아래 인수 기준을 자동 테스트와 관리자 화면 테스트에 대응시킨다. 신규 테스트 명령을 `release:check`에 포함한다.
- [ ] 기존 데이터는 재작성하지 않는 검증 모드로 경고 대상·시각 누락·경고 수 불일치를 먼저 확인한다. 실제 사용자에게 시험 경고를 부여하지 않는다.
- [ ] `npm run release:check`와 `git diff --check`를 통과시킨다. 데이터 정리·보고서·다른 시설 예약·기존 경고·주말 대여가 유지되는지 확인한다.
- [ ] 구현 승인 후 배포 시 기존 앱의 추가 필드 누락을 고려한다. 백엔드는 읽기 응답에 추가 필드만 더하고, 구형 관리자 앱의 모호한 반납 요청은 잘못된 경고 판정보다 업데이트 안내로 처리한다. 웹에서 관리자 반납·경고 심사 작업이 먼저 가능하도록 배포한다.
- [ ] Worker·Pages 배포, 운영 도메인과 API 릴리스 매니페스트 검증, Cron 실행 확인을 완료한 후 자동 경고를 활성화한다. 기존 학생 앱에서는 날짜 기반 UI가 남을 수 있으므로 iOS/Android 업데이트도 준비한다.
- [ ] iOS는 App Store Connect 업로드와 심사 제출·공개를 구분해 보고한다. 배포 직전 공개 버전·최신 빌드 번호를 조회하고 이번 계획에서 버전 번호를 미리 고정하지 않는다.
- [ ] 문제 발생 시 자동 경고 활성화만 끌 수 있게 한다. 이미 접수된 같은 날 후속 예약이 있으므로 날짜 단위 충돌 판단으로 무조건 롤백하지 않는다. 기존 예약·경고·심사 기록을 보존한다.

## 6. 인수 기준

1. A의 화요일 17:10 반납 예정 장비를 B가 월요일에 화요일 17:30 대여로 예약할 수 있다.
2. B의 예약이 접수되면 C의 같은 장비·겹치는 시간 신청은 409다. 동시 신청에서도 정확히 한 건만 접수된다.
3. A 반납 전 시작되는 예약은 거절한다. 다른 장비 코드와 겹치지 않는 시간은 허용한다.
4. 기존 당일 신규 예약 금지, 1박2일·2박3일·주말 사용 규칙이 유지된다.
5. 반납 기한이 지난 A에게 예약별 경고 1회가 생긴다. 반복 실행·새로고침·재시작·여러 장비에도 늘지 않는다.
6. 실제 17:05 반납·관리자 17:25 처리이면 해당 자동 경고만 해제된다. 해제 기록과 사유는 남는다.
7. 실제 17:20 반납이면 장비가 정상이어도 경고 1회가 확정·유지된다.
8. 정기 점검 전에 늦게 반납 처리해도 경고가 누락되지 않는다.
9. A 미반납 또는 장비 수리 필요 상태이면 B의 실제 대여 처리를 서버에서 거절한다. B의 예약과 경고 횟수는 유지된다.
10. 반납 점검 완료 후 정상 장비만 B에게 인계 가능하며, B·C 동시 인계는 한 건만 성공한다.
11. 학생은 다른 학생의 경고 내역을 조회·변경할 수 없고, 내부 점검 API도 실행할 수 없다.
12. 실제 반납 시각 정정은 사유와 전후 기록이 남고, 재판정해도 중복 경고가 생기지 않는다.
13. 저장 실패 시 반납 상태만 바뀌거나 경고 횟수만 바뀌는 부분 저장이 없어야 한다.
14. 도입 전부터 연체된 예약에 경고를 소급 부과하지 않는다.
15. 웹과 앱에서 같은 시간·장비를 선택하면 가용성 결과가 같아야 한다. 구형 앱의 보수적 표시와 업데이트 필요성은 별도 안내한다.

## 7. 이번 범위에 넣지 않는 기능

- 대기 순번과 자동 예약 승격.
- 경고 누적에 따른 자동 대여금지.
- 하루마다 경고 추가 부여.
- B의 자동 취소, 자동 대체 장비 배정, 운영자가 승인하지 않은 예약 시간 변경.
- 부분 반납·부분 인계 및 학생의 자기 반납 확인.
- 새 외부 메시지 채널이나 강제 푸시 도입. 우선 앱·웹 내부 확인 상태를 제공한다.

## 8. 계획 검토 결과

- 사용자 확정 사항인 정시 반납 처리 지연만 해제·실제 지각 유지 기준을 모든 단계에 반영했다.
- 선예약·승인·실제 인계·반납 점검·경고 생성·개별 해제를 각각 구분했다.
- 중복 경고, 반납과 점검 경합, 대여 중 취소·삭제 우회, 경고 해제 후 재발행, 구형 앱, 도입 전 미반납 사례를 인수 기준에 포함했다.
- 현재 단계에서는 이 문서 외 소스 코드와 운영 설정을 변경하지 않았다.
