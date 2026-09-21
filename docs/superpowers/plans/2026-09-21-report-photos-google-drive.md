# 스튜디오·기자재 사용 보고서와 Google Drive 저장 구현 계획

> **For agentic workers:** `superpowers:executing-plans`를 사용해 아래 작업을 주 작업자가 순서대로 수행한다. 사용자의 기존 선호에 따라 서브에이전트 반복 검증을 추가하지 않는다.

**Goal:** 학생이 앱에서 스튜디오·대여 기자재의 사용 결과와 파손 여부를 클릭으로 기록하고, 보고서당 사진 최대 5장을 첨부해 제출하며, 관리자는 앱과 연결된 Google Drive에서 내용을 확인한다.

**Architecture:** 앱 DB가 보고서 상태와 집계의 기준이다. 관리자가 OAuth로 연결한 Drive에 사진을 저장하고 보고서 요약 파일을 자동 생성한다. 기존 예약·반납 점검과 보고서 화면을 확장하며, 미완료 작성은 초안으로 보존한다.

**Tech Stack:** 기존 React/TypeScript·레거시 JavaScript, Cloudflare Worker/Pages, SQLite Durable Object, Google Drive API v3, Capacitor iOS/Android.

## 적용 범위와 기본값

- 이 문서는 구현 계획이다. 이번 단계에서는 코드·운영 설정·DB·스토어를 변경하지 않는다.
- 2026-09-21의 앞선 `studio-report-drive-decoupling` 계획을 확장한다. 출력실의 `googleDriveUrl`은 출력실 용도로 유지하고, 보고서 전용 Drive 연결과 폴더 확인 영역을 신설한다.
- 확정 요구: 스튜디오와 기자재 대여 모두 보고서 대상, 사진 전체 합계 최대 5장, 파손 O/X, 파손 시 상세 기술·사진 첨부, 관리자 Drive 확인, 앱에서 작성·업로드.
- 아래 추가 수치와 동작은 구현 기본안이다. 사용자에게서 별도로 확정된 기존 정책으로 표현하지 않는다.
- 기본안: 정상 사용 사진은 선택, 파손이 있는 각 구분에는 상세 내용과 사진 최소 1장 필수. 같은 보고서에서 스튜디오·대여 기자재 사진을 합쳐 5장이다.
- 기본안: 기자재 제출 기한은 반납 예정 시각 또는 실제 조기 반납 시각 중 빠른 시점부터 48시간. 관리자에서 1~720시간으로 조정한다. 기존 스튜디오 기한 설정을 그대로 사용한다.
- 기본안: 서버 전송본 JPEG/PNG, 긴 변 최대 2,048px, 1장 최대 3MiB. 원본 선택은 20MiB/40MP까지 허용하고 순차 축소한다. 변환 불가 파일에는 재선택 안내를 제공한다.
- 기본안: 초안은 마지막 수정 후 7일 보존. 제출 사진·Drive 보고서는 제출 후 183일을 기본 보관안으로 설정하고, 신규 이미지 보관 정책과 삭제 동작을 개인정보 안내에 반영한 뒤 활성화한다.
- 기자재 미제출 의무는 기능 활성화 시점의 대여 중 예약과 이후 실제 인계되는 예약부터 적용한다. 과거 반납 완료 예약에 소급 부과하지 않는다.
- 사진 첨부는 점검 기록이다. 학생의 파손 응답만으로 재고 상태 변경·패널티·예약 제한을 자동 적용하지 않는다. 기존 관리자 반납 점검이 최종 장비 상태를 결정한다.
- 기존 제출 보고서와 사진 링크는 유지한다. 기존 설치 앱이 사용하는 `POST /api/reports/studio`도 유지한다.
- 앱 패키징 요청은 유효하다. 새 기능 구현 및 검증 후 최신 빌드 번호를 확인해 App Store Connect 업로드를 이어간다. 현재 계획 작성 단계에서 기존 앱을 새 기능이 들어간 것처럼 업로드하지 않는다.

## 1. 현재 코드에서 확인한 사실

| 위치 | 현재 상태 | 필요한 변경 |
| --- | --- | --- |
| `src/react/student/screens/ReportsScreen.tsx` | 스튜디오만 제출 필요/완료 목록에 표시 | 스튜디오·기자재 탭 및 공통 대상 상태 |
| `src/react/student/components/ReportForm.tsx` | 텍스트, 단일 `damageFound`, 외부 사진 URL | 구분별 파손 O/X와 최대 5장 첨부 |
| `core.mjs`의 `/api/reports/studio` | 스튜디오 전용 JSON 제출 | 초안·첨부·공통 제출 API 추가 |
| `core.mjs` / `core/admin-lists.mjs` | 스튜디오 미제출만 계산 | 학생 목록·관리자 숫자를 공통 규칙으로 계산 |
| `src/react/admin/screens/AdminSettings.tsx` | 출력실 Drive URL만 있음 | 보고서 Drive 계정·폴더·연결 상태 확인 영역 |
| `src/react/admin/screens/AdminReports.tsx` | 단일 파손 항목 및 링크 표시 | 구분별 점검 내용·사진·Drive 저장 상태 |
| `worker.mjs` | 모든 도메인 응답을 JSON으로 감쌈 | 파일 업로드/다운로드·OAuth redirect 전용 응답 경로 |
| `server.mjs` | 요청 본문을 문자열로 읽고 약 4MiB 제한 | 사진 전용 bounded binary reader, 기존 JSON 제한 유지 |
| `storage-sql.mjs` | `reports` 테이블의 JSON에 필드 확장 가능 | 초안·첨부·내보내기 작업 저장 추가 |
| `core.mjs`의 bootstrap·관리자 export | `db.settings` 그대로 노출 | OAuth 토큰/연결 계정은 별도 비공개 저장소에 보관 |
| `core.mjs`의 반납 점검 | `checked_out → returned`, 이력에 실제 시각 기록 | 기자재 보고서 대상 생성·기한 계산에 활용 |
| `public/js/notification-planner.js` | 스튜디오 보고서 알림만 존재 | 기자재 보고서와 공통 기한 적용 |
| iOS `Info.plist`, `package.json` | 사진/카메라 사용 설명·플러그인 없음 | 촬영·사진 선택·초안 복구 지원 |

운영 Drive 계정, Google Cloud OAuth 클라이언트, 저장 폴더 권한은 이번 조사에서 확인하지 않았다. 기존에 연결되어 있다고 가정하지 않는다.

## 2. 학생이 보게 될 작성 흐름

### 진입

- 학생 대시보드: `작성할 보고서 2건` 작은 카드 → 기존 보고서 탭.
- 내 예약: 해당 예약의 `보고서 작성` 또는 `이어서 작성` 버튼.
- 보고서 탭: `전체 / 스튜디오 / 기자재`, 목록 상태는 `작성 필요 / 작성 중 / 제출 완료`.
- 예약의 학생명, 날짜, 공간, 장비명·코드, 대여·반납 시각을 자동 표시한다. 장비 목록을 학생이 다시 입력하지 않는다.

### 화면 구성

```text
스튜디오 / 기자재 사용 보고서
예약 기본정보 자동 표시

스튜디오 기자재 파손·이상     [없음 X] [있음 O]
  있음 → 장비/위치 + 상세 내용 + 사진 추가

대여 기자재 파손·이상         [없음 X] [있음 O]
  있음 → 빌린 장비 선택 + 상세 내용 + 사진 추가

사진 2 / 5                    [촬영] [사진 선택]
[미리보기 · 구분 표시 · 삭제] × 첨부 수

[정리정돈 완료] 또는 [반납 준비 상태 확인]
비고 (선택)
[임시저장]                    [보고서 제출]
```

스튜디오 보고서에서는 스튜디오 점검을 필수로 표시한다. 별도로 빌린 기자재가 있으면 `내 대여 예약 연결`에서 본인의 실제 대여 이력이 있는 예약을 선택한다. 없다면 `별도 대여 기자재 없음`으로 표시한다. 날짜가 같다는 이유로 임의 연결하지 않는다.

기자재 보고서에서는 해당 대여 건의 기자재 점검을 필수로 표시하고 스튜디오 점검을 숨긴다. 스튜디오 보고서에 대여 기자재를 언급했더라도 별도 대여 건의 보고서가 자동 제출되지는 않는다. 관리자는 연결된 예약을 따라가 같은 장비의 기록을 함께 확인할 수 있다.

O/X에는 초기 선택값을 넣지 않는다. `없음 X`를 선택하면 상세 기술이 필요 없고, `있음 O`를 선택한 구분만 상세 내용과 사진이 필요하다. 구분당 상세 내용은 1~2,000자, 비고는 최대 2,000자이다. 파손 없음으로 바꾸어도 작성한 상세 내용·사진은 제출 전까지 초안에 남기며 삭제를 강제하지 않는다. 최종 제출본에는 선택된 점검 상태에 맞는 필드만 포함한다.

### 대상·제출 시각

| 예약 | 작성 시작 | 최종 제출 가능 | 제출 안내·기한 |
| --- | --- | --- | --- |
| 새 스튜디오 보고서 | 사용일 도래 | 실제 예약 종료 후 또는 관리자 완료 처리 후 | 실제 슬롯 종료 + 기존 설정 시간 |
| 새 기자재 보고서 | 관리자 인계 완료(`checked_out`) 후 | 반납 처리 후 또는 예정 사용 종료 후 | 예정 반납/실제 조기 반납 중 빠른 시각 + 설정 시간 |
| 대여 승인만 된 기자재 | 작성 대상 아님 | 불가 | 인계 전 보고서 의무 없음 |
| 취소·반려 예약 | 불가 | 불가 | 집계 제외 |

야간 스튜디오의 24시 이후 슬롯은 기존 `core/reservation-timing.mjs`를 이용해 다음 날짜로 계산한다. 늦게 반납 처리하거나 예약 메모를 수정했다고 제출 기한이 연장되지 않는다. 기한이 지나도 제출은 가능하고 `기한 초과`만 표시한다.

활성화 이전 스튜디오 예약과 구버전 API는 기존 제출 계약을 유지한다. 새 정책은 예약에 저장한 `reportPolicyVersion: 2`로 판별한다. 기존 정책과 새 정책의 경계, 진행 중 기자재 예약에 대한 적용은 마이그레이션 테스트로 고정한다.

## 3. Google Drive에 가장 간단하게 저장하는 방법

### 추천: 관리자 OAuth 연결 + 보고서 전용 폴더 자동 생성

1. 서비스 개발자가 Google Cloud에 Drive API·웹 OAuth 클라이언트를 1회 구성한다.
2. 관리자가 웹 관리자 설정에서 `보고서 Google Drive 연결`을 누르고 학과 보관 계정으로 동의한다.
3. 앱이 그 계정의 My Drive에 `GJU 사용보고서` 폴더를 생성하고, 관리자에게 폴더명과 `드라이브에서 열기`를 표시한다.
4. 이후 학생은 앱에서 사진을 선택하고 제출한다. 서버가 연결된 Drive로 전송한다.

첫 버전은 자동 생성 폴더를 사용한다. 기존 임의 폴더 URL 붙여넣기와 폴더 탐색기는 범위에서 제외한다. URL만 붙여넣으면 쓰기 권한이 생기는 것이 아니다. 기존 폴더를 꼭 써야 할 경우 Google Picker 기반 폴더 선택을 후속으로 추가한다.

`drive.file` 범위는 앱이 생성하거나 사용자가 앱에 선택해 준 파일에 한정해 접근할 수 있어 이 구조에 맞는다. [Google Drive 권한 문서](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)

개인/학과 My Drive 사용을 기본으로 하므로 서비스 계정에 폴더만 공유하는 방식을 기본안으로 삼지 않는다. Google은 서비스 계정이 자체 저장 용량을 가지거나 파일을 소유할 수 없으며, 공유 드라이브 또는 사용자 OAuth가 필요하다고 설명한다. [Google Drive 오류 문서](https://developers.google.com/workspace/drive/api/guides/handle-errors)

관리자 화면에는 다음만 표시한다.

| 영역 | 항목 |
| --- | --- |
| 보고서 저장소 | 연결 계정, 연결됨/재연결 필요, 마지막 저장 성공 시각 |
| 폴더 | 폴더명, 읽기 전용 폴더 URL, `드라이브에서 열기` |
| 동작 | `연결`, `연결 확인`, `재연결`, `연결 해제` |
| 기한 | 스튜디오 제출 기한, 기자재 제출 기한 |
| 운영 확인 | 저장 대기/실패 건수, 해당 보고서로 이동 |

Google 최초 로그인은 시스템 브라우저의 관리자 웹에서 진행한다. 학생 앱에 Google 로그인 화면을 넣지 않는다. 관리자 설치 앱에서도 연결 상태 확인·폴더 열기는 제공하고, 최초 연결은 관리자 웹으로 이동한다.

### 저장 결과

```text
GJU 사용보고서/
  2026년 2학기/
    스튜디오/
      2026-09-21_<예약ID>/
        보고서.html
        보고서.json
        01_스튜디오파손.jpg
        02_대여기자재파손.jpg
    기자재/
      2026-09-21_<예약ID>/
        보고서.html
        보고서.json
        01_사용상태.jpg
```

HTML은 사람이 읽고 인쇄할 수 있는 요약, JSON은 보관·재사용용 구조화 데이터이다. PDF 자동 생성은 첫 버전에서 추가하지 않는다. 파일명에는 학생 전화번호·이메일을 넣지 않고, 요약에는 필요한 이름·학번·예약·점검 정보를 담는다. HTML의 사진은 같은 폴더의 첨부 목록과 연결하며 앱 관리자 상세 화면에서도 바로 본다. 모든 텍스트를 HTML escape한다.

학생에게 학과 Drive 폴더 접근 권한을 주지 않는다. 앱 서버가 본인 보고서 또는 관리자 여부를 검사한 후 사진을 전달한다. 전체 공개 링크를 생성하지 않는다.

## 4. 저장·실패·재시도 원칙

별도 이미지 저장 서비스를 추가하지 않고 Drive에 직접 저장하는 1차안을 사용한다. 따라서 Drive가 끊긴 상태에서 아직 업로드하지 못한 사진은 서버에 저장되었다고 표시할 수 없다.

```text
앱에서 작성 → 텍스트 초안 저장 → 사진 1장씩 Drive 업로드
         → 첨부 저장 확인 → 보고서 최종 제출(DB)
         → Drive 요약 파일 생성/갱신 → 저장 완료
```

- 작성 화면은 Drive 연결 여부와 무관하게 열 수 있다. 텍스트 초안을 저장한다.
- 첨부 선택 시 원본을 기기에 보존하고 처리한 사본을 순차 업로드한다. 웹은 IndexedDB, 설치 앱은 앱 전용 Filesystem 저장소를 사용한다.
- `기기에 임시저장`과 `서버에 저장됨`을 구분한다. 기기 저장 실패·용량 부족이면 저장됐다고 표시하지 않는다. 로그인 계정별로 격리하고 로그아웃 시 미전송 사진에 대한 안내 후 해당 계정의 로컬 자료를 정리한다.
- 선택한 사진 중 실패 항목이 있으면 최종 제출을 보류하고 해당 사진만 재시도한다. 학생이 명시적으로 사진을 제거할 수 있다. 필수 파손 사진을 자동 생략하지 않는다.
- 사진 없는 정상 보고서는 Drive 장애 중에도 DB에 최종 제출할 수 있다. 이 경우 관리자는 `보고서 접수 완료 · Drive 저장 대기`를 본다.
- 사진이 모두 저장된 보고서도 요약 파일 생성 실패 때문에 학생이 재제출할 필요는 없다. 요약은 DB로 재생성할 수 있어 서버가 재시도한다.
- 신규 파일 ID를 먼저 발급·저장하고 같은 ID로 재시도한다. 업로드 성공 응답이 유실되면 기존 파일의 크기·해시·소유 메타데이터를 확인한다. [Google의 사전 발급 ID 재시도 방식](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- 서버의 Drive 요약 작업은 Durable Object alarm으로 최대 10건씩 수행한다. 임시 오류는 1분/5분/30분/2시간 간격으로 재시도하고 반복 실패는 관리자 목록에 남긴다. 브라우저 타이머나 `waitUntil`만으로 재시도를 유지하지 않는다.
- `401 invalid_grant`는 재연결 필요, `403`은 권한/용량 오류 구분, `429`·`5xx`는 지수 백오프를 적용한다. 최종 접수 상태와 Drive 저장 상태를 별도 보관한다.
- Drive 계정을 바꿔도 이전 첨부가 새 계정에 자동 이전되지는 않는다. 기존 작업에 `connectionId`를 고정하고, 다른 계정 재연결 시 기존 작업은 복구 필요로 표시한다.
- 앱 종료 중 촬영·사진 선택에서 복귀하는 Android 경로와 iOS 제한된 사진 접근 권한을 포함해 확인한다. Google 재인증 후에도 학생이 작성한 초안을 유지한다.

## 5. 데이터·API 계약

### 상태 모델

```ts
type ReportType = "studio" | "equipment";
type PhotoCategory = "usage" | "studio_damage" | "equipment_damage";
type DamageAnswer = null | "no" | "yes" | "not_applicable";
type ReportState = "draft" | "submitted" | "reviewed";
type DriveState = "pending" | "syncing" | "synced" | "failed";

type ReportChecks = {
  studio: { answer: DamageAnswer; description: string; equipmentLabel: string };
  equipment: { answer: DamageAnswer; description: string; equipmentIds: string[] };
  cleanupConfirmed: boolean;
};

type ReportRequirement = {
  required: boolean; canDraft: boolean; canSubmit: boolean;
  dueAt: string | null; deadlineAt: string | null;
  reportId: string | null; draftId: string | null;
  submitted: boolean; reviewed: boolean; overdue: boolean;
};

type ReportV2 = {
  id: string; schemaVersion: 2; type: ReportType;
  reservationId: string; userId: string; status: "submitted" | "reviewed";
  fields: { actualTime: string; participants: string; usedEquipment: string;
    checks: ReportChecks; notes: string; resultPhotoUrl: string };
  linkedEquipmentReservationId: string | null;
  photoIds: string[]; reservationSnapshot: Record<string, unknown>;
  submittedAt: string; expiresAt: string;
  drive: { connectionId: string | null; status: DriveState; folderId: string | null;
    htmlFileId: string | null; jsonFileId: string | null;
    lastSyncedAt: string | null; errorCode: string | null };
};
```

`not_applicable`은 해당 구분이 실제로 없을 때만 서버가 허용한다. 미응답 `null`은 최종 제출 불가다. 최종 보고서의 `reservationSnapshot`은 당시 예약 정보·장비명·코드를 보존하며, 이후 품목 삭제로 과거 보고서가 빈 내용이 되지 않도록 한다.

DB 변경:

| 저장 위치 | 내용 |
| --- | --- |
| 기존 `reports.data` | `ReportV2`, 기존 보고서 읽기 호환 유지 |
| 신규 `report_drafts` | 본인 예약별 초안 1개, `revision`, `checks`, 연결 예약, 수정 시각 |
| 신규 `report_attachments` | attachment ID, draft/report ID, user ID, 구분, MIME, 크기, SHA-256, Drive ID, `reserved/uploaded/deleted`, 생성 시각 |
| 신규 `report_drive_jobs` | report ID + revision + 작업 종류 유일 키, connection ID, retry 시각, 상태, lease, provider 파일 ID |
| 비공개 `report_drive_connections` | 연결 관리자·계정·폴더·토큰 암호문·상태. 일반 `db`와 export에 포함하지 않음 |
| 기존 `settings` | 기자재 기한, 새 정책 활성화 시각/버전. OAuth 토큰·폴더 소유 계정 저장 금지 |
| 예약 `fields` | `reportPolicyVersion`, `reportRequired`, `reportDueAt`, `reportDeadlineAt`, 호환용 `reportStatus` |

사진 바이너리나 base64를 DB JSON에 넣지 않는다. 기존 `reports`에는 유일 제약이 없으므로 신규 제출은 예약별 트랜잭션 검사와 멱등 키로 중복을 막는다. 기존 중복 데이터를 임의 삭제하거나 무조건 unique index를 생성하지 않는다.

API:

| 메서드·경로 | 권한·동작 |
| --- | --- |
| `GET /api/admin/report-drive` | 관리자만 연결 상태·폴더 URL·실패 수 조회 |
| `POST /api/admin/report-drive/connect` | 관리자 세션에 묶인 OAuth URL 생성 |
| `GET /api/oauth/report-drive/callback` | 일회용 state 검증 후 code 교환, 관리자 웹으로 복귀 |
| `POST /api/admin/report-drive/verify` | 실제 폴더 존재·쓰기가능 확인, 검사 파일은 앱 소유 테스트 파일만 정리 |
| `DELETE /api/admin/report-drive` | 연결 해제, 파일은 자동 삭제하지 않음 |
| `GET /api/reports/my` | 본인 제출본·초안·대상 요약 |
| `POST /api/reports/drafts` | `{ reservationId }`, 본인 대상 예약이면 초안 생성/기존 반환 |
| `PATCH /api/reports/drafts/:id` | `{ revision, fields, linkedEquipmentReservationId }`, 오래된 revision은 409 |
| `POST /api/reports/drafts/:id/photos` | `{ clientPhotoId, category, mimeType, size, sha256 }`, 최대 5장 슬롯 예약 |
| `POST /api/reports/drafts/:id/photos/:photoId/content` | 1장 binary 전송, 스트리밍 중에도 크기 제한 |
| `DELETE /api/reports/drafts/:id/photos/:photoId` | 본인 미제출 초안 사진 제거, Drive 정리 작업 기록 |
| `POST /api/reports/drafts/:id/submit` | `{ revision, submissionKey }`, 소유권·예약·O/X·필수사진 검증 후 최종 제출 |
| `GET /api/reports/:reportId/photos/:photoId/content` | 본인 또는 관리자만 바이너리 읽기, `private, no-store` |
| `GET /api/reports/drafts/:id/photos/:photoId/content` | 본인 초안에 이미 저장된 사진 복구 |
| `POST /api/admin/reports/:id/drive-retry` | 관리자 재시도, 기존 파일 ID 재사용 |
| 기존 `POST /api/reports/studio` | 구버전 계약 유지, 새 공통 도메인의 legacy 어댑터로 처리 |

응답에 OAuth 토큰이나 Google 업로드 세션 URL을 넣지 않는다. Drive 파일 ID를 클라이언트가 제출해 다른 파일을 보고서에 붙일 수 없게 한다. binary API는 기존 JSON serializer 밖에서 처리하며, Pages 프록시도 응답 헤더와 body를 보존한다.

## 6. 구현 작업

### Task 1 — 보고서 대상과 저장 계약 통합

**Files:** Create `core/reporting.mjs`, `scripts/reporting-domain-test.mjs`; Modify `core.mjs`, `core/admin-lists.mjs`, `core/reservation-views.mjs`, `core/reservation-timing.mjs`, `core/settings.mjs`, `storage-sql.mjs`, `src/react/student/types.ts`, `src/react/platform/types.ts`, `package.json`.

**Interfaces:** `getReportRequirement(db, reservation, now)` → `ReportRequirement`; `validateReportDraft(db, user, draft, photos, now)` → validated fields; `submitReportDraft(ctx, draftId, revision, submissionKey)` → persisted `ReportV2`. `ctx`에는 인증된 user, db, saveDb, now를 전달한다.

- [ ] 고정 시각의 fixture로 인계 전/대여 중/반납/취소/과거 반납/야간 스튜디오를 시험한다. 아래 경계값 검사를 먼저 작성한다.

```js
assert.equal(getReportRequirement(db, approvedRental, now).required, false);
assert.equal(getReportRequirement(db, checkedOutRental, beforeEnd).canDraft, true);
assert.equal(getReportRequirement(db, checkedOutRental, beforeEnd).canSubmit, false);
assert.equal(getReportRequirement(db, checkedOutRental, afterEnd).canSubmit, true);
assert.equal(getReportRequirement(db, cancelledRental, afterEnd).required, false);
assert.equal(getReportRequirement(db, oldReturnedRental, afterEnd).required, false);
```

- [ ] `node scripts/reporting-domain-test.mjs`로 신규 함수 부재에 의한 실패 확인 후, 대상·기한·정책 버전을 구현한다. 기존 제출본은 가장 우선해 판단한다.
- [ ] 새 컬렉션을 초기화/normalize/load/save/export/import에 반영한다. 토큰 저장 테이블은 컬렉션·singleton 목록 밖에 두며, 기존 테이블 유지·재시작 후 초안 복원을 확인한다.
- [ ] 최종 제출의 트랜잭션은 보고서 생성·예약 flag 갱신·Drive job 생성을 함께 완료한다. 저장 실패 시 캐시 객체도 원복한다. 외부 Google 요청은 이 트랜잭션 안에서 기다리지 않는다.
- [ ] 동일 submissionKey의 반복 요청은 같은 보고서를 반환하고, 같은 예약의 다른 초안 제출은 409를 반환한다. 학생/관리자 미제출 수는 동일 `getReportRequirement` 결과로 계산한다.
- [ ] `npm run test:studio-report`, `node scripts/reporting-domain-test.mjs`, `npm run test:dashboard-integrity`, `npm run test:storage` 통과 후 관련 파일 커밋: `2026-09-21 스튜디오 기자재 보고서 대상 및 저장 모델 통합`.

### Task 2 — 관리자 Drive 연결과 비공개 설정

**Files:** Create `integrations/report-drive.mjs`, `integrations/report-drive-store.mjs`, `scripts/report-drive-test.mjs`; Modify `worker.mjs`, `server.mjs`, `src/react/admin/screens/AdminSettings.tsx`, `src/react/platform/adminActions.ts`, `src/react/platform/types.ts`, `public/js/data.js`, `public/js/views-admin.js`, `public/js/events/forms.js`.

**Interfaces:** `ReportDriveClient`는 `connectUrl`, `exchangeCode`, `refreshAccessToken`, `ensureFolder`, `verifyConnection`, `generateFileId`, `uploadFile`, `getFile`, `readFile`, `trashFile`, `deleteFile`을 제공한다. 모든 Drive 작업은 서버가 connection ID를 해석하고 `fetch` 의존성을 주입받아 fixture 응답으로 시험한다.

- [ ] 관리자 외 connect/status 요청 403, 잘못된/만료된/재사용 state 거부, 다른 세션으로 시작된 연결 거부, export/학생 bootstrap에 토큰·계정·폴더가 없는 테스트를 작성한다.
- [ ] OAuth 웹 클라이언트의 callback을 `https://gjureserve.co.kr/api/oauth/report-drive/callback`으로 고정한다. state는 10분 유효·일회용·시작 관리자 세션에 연결하고 callback 시 현재 권한도 재검사한다. 토큰은 서버에서 교환하며 임의 return URL을 받지 않는다.
- [ ] Worker secrets `REPORT_DRIVE_CLIENT_ID`, `REPORT_DRIVE_CLIENT_SECRET`, `REPORT_DRIVE_TOKEN_ENCRYPTION_KEY`를 사용한다. refresh token은 AES-GCM으로 암호화해 비공개 저장소에 보관한다. stdout·URL·일반 로그에 code/token을 기록하지 않는다.
- [ ] `drive.file` + `access_type=offline`으로 연결하고 루트 폴더를 멱등 생성한다. 연결 계정이 재인증을 요구하면 상태를 `reauth_required`로 돌린다. 개인 토큰을 소스에 하드코딩하지 않는다.
- [ ] 관리자 설정에 전용 카드, 폴더 열기, 실패 현황, 기한 저장을 연결한다. 레거시 관리자는 동일 카드 또는 해당 기능의 React 관리자 화면 진입을 제공한다.
- [ ] `node scripts/report-drive-test.mjs`, `npm run check:react-admin`, `npm run test:security` 통과 후 커밋: `2026-09-21 관리자 보고서 구글드라이브 연결 추가`.

### Task 3 — 최대 5장 파일 저장과 Drive 내보내기

**Files:** Create `core/report-attachments.mjs`, `integrations/report-drive-jobs.mjs`, `scripts/report-attachments-test.mjs`; Modify `worker.mjs`, `server.mjs`, `functions/api/[[path]].js`, `storage-sql.mjs`, `core.mjs`, `core/maintenance.mjs`.

**Interfaces:** `reserveReportPhoto(ctx, draftId, metadata)`, `uploadReportPhoto(ctx, draftId, photoId, bodyStream)`, `readReportPhoto(ctx, ownerId, photoId)`, `runReportDriveJobs(ctx, now, limit=10)`. `ctx`에는 인증된 user, DB, privateStore, DriveClient, saveDb를 전달한다.

- [ ] 5장 성공/6번째 거부, 6개 동시 요청에도 예약된 슬롯 합계 5장 유지, 3MiB 초과, 위장 이미지, 타인 첨부, 전송 성공 후 응답 유실, 동일 clientPhotoId 재전송을 시험한다.
- [ ] 슬롯 수를 짧은 SQL 트랜잭션으로 확보한다. `reserved`도 5장 제한에 포함하고, 예약 실패/만료 슬롯은 회수한다. bytes 읽기는 인증·소유권 확인 후 시작하고 Content-Length 없이도 초과를 차단한다.
- [ ] MIME/확장자만 믿지 않고 JPEG/PNG signature·dimensions·크기·해시를 확인한다. SVG/HTML/GIF 동영상·비허용 파일은 거부한다. 전송 파일별 시간 제한과 동시 업로드 상한을 둔다.
- [ ] 사전 발급한 Drive 파일 ID와 `appProperties`의 report/draft/photo ID를 저장한 뒤 업로드한다. 409나 응답 유실에서는 동일 파일 확인 후 성공 처리하며 새 파일을 만들지 않는다.
- [ ] HTML/JSON 요약 업로드는 durable job으로 구현한다. `submitted/reviewed` 상태와 Drive 동기화 상태는 별개로 갱신한다. 관리자 확인 후 요약 갱신도 같은 파일 ID를 쓴다.
- [ ] 초안 만료·사진 제거·보고서/예약/계정 삭제·학기 정리 경로가 첨부와 job까지 정리하도록 공통 삭제 함수를 연결한다. 일반 사용자 삭제는 개인정보 안내에 맞게 앱 소유 파일만 삭제하고, 장애 시 삭제 작업을 남겨 재시도한다. 공유 루트 폴더나 사용자가 따로 넣은 파일을 재귀 삭제하지 않는다.
- [ ] 비공개 사진 응답을 받아 Blob URL로 보여주는 경로를 제공한다. root/report 파일 접근을 확인하고 외부 URL proxy로 사용할 수 없게 한다.
- [ ] `node scripts/report-attachments-test.mjs`, `node scripts/report-drive-test.mjs`, `npm run test:storage`, `npm run test:security` 통과 후 커밋: `2026-09-21 보고서 사진 업로드 및 드라이브 저장 처리`.

### Task 4 — 학생 공통 폼과 기기 사진 선택

**Files:** Create `src/react/student/components/ReportDamageSection.tsx`, `src/react/student/components/ReportPhotoPicker.tsx`, `src/react/student/reportPhotos.ts`, `src/react/student/reportDraftStorage.ts`; Modify `src/react/student/components/ReportForm.tsx`, `src/react/student/screens/ReportsScreen.tsx`, `src/react/student/screens/HomeScreen.tsx`, `src/react/student/components/StudentPrimitives.tsx`, `src/react/student/reporting.ts`, `src/react/student/types.ts`, `public/js/react-student-adapter.js`, `public/js/api.js`, `public/js/views-student.js`, `public/js/actions.js`, `public/js/events/forms.js`, `public/index.html`, `worker.mjs`, `package.json`, `package-lock.json`, `ios/App/App/Info.plist`, `ios/App/App/PrivacyInfo.xcprivacy`, `android/app/src/main/AndroidManifest.xml`.

**Interfaces:** `selectReportPhotos(source, remainingSlots)` → local photo records; `prepareReportPhoto(photo)` → `{blob,mimeType,size,sha256}`; `saveLocalReportDraft(userId,reservationId,draft)` / `loadLocalReportDraft(userId,reservationId)` / `clearLocalReportDraft(userId,reservationId)`. Camera/Filesystem 플러그인은 설치한 Capacitor 8 호환 버전의 API를 이 어댑터 안에서만 사용한다.

- [ ] 학생 UI 계약에 타입별 질문, null 응답 차단, O 선택 시 상세·사진 표시, N/A 표시, 사진 전체 5장 상한, 파손별 1장 조건, 초안 복구를 추가한다.
- [ ] O/X는 `<fieldset>`·`<legend>`·라디오 버튼으로 구현해 선택 상태를 음성 안내한다. 장비 파손 시 실제 대여 equipment ID를 선택하고 스튜디오 파손 위치는 텍스트로 기재한다.
- [ ] 웹은 `input[type=file]` 촬영/선택, 설치 앱은 Camera 플러그인을 사용한다. 사진은 1장씩 읽고 리사이즈·회전 보정·재인코딩하며 EXIF 위치 메타데이터를 제거한다. iPhone HEIC은 변환 가능한 네이티브 경로로 JPEG를 만들고 지원되지 않는 웹에서는 구체적인 형식 안내를 한다.
- [ ] 사진 미리보기 때문에 필요한 `img-src blob:`을 HTML/Worker의 CSP에 반영한다. 웹 직접 카메라 스트림을 쓰지 않고 파일 선택을 기본으로 하며, camera 권한 정책을 임의로 전체 허용하지 않는다.
- [ ] 촬영 설명 `스튜디오 및 기자재 사용 보고서에 사진을 첨부하기 위해 카메라를 사용합니다.`와 사진 보관함 설명을 iOS에 추가한다. Filesystem 사용 사유와 개인정보 매니페스트를 플러그인 공식 문서에 맞춘다. Android activity 복원도 처리한다.
- [ ] 폼 첫 진입부터 초안 ID를 확보한다. 텍스트는 700ms debounce + 명시적 임시저장, 첨부 실패는 개별 재시도, 업로드 중 제출 연타 차단을 적용한다. 파일과 입력값을 일반 API JSON에 함께 넣지 않는다.
- [ ] 성공하면 제출 필요 수와 목록을 갱신하고 로컬 사본을 정리한다. API 응답/새로고침 실패가 제출 성공을 취소한 것처럼 보이지 않도록 기존 bridge 갱신 처리와 맞춘다.
- [ ] `npm run test:student-react`, `npm run test:student-bridge`, `npm run check:react-admin`, `npm run test:ui -- tests/ui/react-student.spec.mjs -g report` 통과 후 커밋: `2026-09-21 학생 보고서 파손 선택 및 사진 첨부 화면`.

### Task 5 — 관리자 조회·정량 집계·호환성 마무리

**Files:** Modify `src/react/admin/screens/AdminReports.tsx`, `src/react/platform/types.ts`, `src/react/platform/adminActions.ts`, `core/admin-lists.mjs`, `core/reports-lectures-notices.mjs`, `core.mjs`, `public/js/data.js`, `public/js/views-admin.js`, `public/js/notification-planner.js`, `public/js/native-notifications.js`, `scripts/dashboard-data-integrity-test.mjs`, `scripts/count-consistency-test.mjs`, `scripts/native-notifications-test.mjs`, `tests/ui/react-admin.spec.mjs`, `tests/ui/react-student.spec.mjs`.

**Interfaces:** 기존 `GET /api/admin/reports`에 `type=studio|equipment`, `damage=yes|no`, `driveStatus=pending|synced|failed` 필터 추가. 기존 `status=missing|submitted|reviewed` 의미는 유지한다. `reportQueueCount`는 제출했으나 관리자 미확인인 보고서 수이며 Drive 실패 건수와 혼합하지 않는다.

- [ ] 관리자 화면에서 타입 필터·파손 구분·관련 장비 코드·사진 확대·보고서별 Drive 폴더·저장 실패 재시도를 제공한다. 레거시 `damageFound/resultPhotoUrl`만 있는 보고서는 기존 정보로 표시한다.
- [ ] 학생 필요 수 = 동일 대상 조건의 관리자 제출 대기 수, 관리자 확인 큐 = submitted 저장 레코드 수가 되도록 비교 테스트한다. 초안을 저장해도 제출 대기가 사라지지 않고, Drive 실패도 중복 제출 건으로 세지 않는다.
- [ ] 기존 반납 점검의 장비 상태와 학생 파손 응답을 나란히 보여준다. 불일치하면 관리자 확인 표시만 하고 재고를 자동 갱신하지 않는다.
- [ ] 기자재 사용 종료/반납 시 기존 보고서 알림 계획기에 연결한다. 예약당 최대 2회(작성 안내·마감 전), 이미 제출했으면 취소한다. 반납 알림과 가까우면 중복 알림을 줄인다. 푸시 서버 구축은 범위에 넣지 않는다.
- [ ] 기존 설치 앱의 스튜디오 API, 텍스트 제출, 기존 Drive 링크, 계정 삭제, 보고서 삭제를 회귀 검증한다. 구버전의 기자재 보고서 미지원은 홈페이지 사용 또는 앱 업데이트 안내로 전달한다.
- [ ] `npm run test:dashboard-integrity`, `npm run test:react-admin`, `npm run test:notifications`, `npm run test:ui -- tests/ui/react-admin.spec.mjs tests/ui/react-student.spec.mjs` 통과 후 커밋: `2026-09-21 관리자 보고서 조회 및 집계 연동`.

### Task 6 — 운영 연결·웹 배포·앱 패키징

**Files:** Modify `docs/native-app-build.md`, `docs/store-submission-materials.md`, `public/privacy.html`, `public/account-deletion.html`, `scripts/check-pre-release.mjs`, `scripts/check-native-release.mjs`, 웹 캐시 버전 참조 파일, `ios/App/App.xcodeproj/project.pbxproj`, `android/app/build.gradle`; Create `docs/releases/2026-09-21-report-drive-release.md`.

- [ ] 연결할 학과 Google 계정과 Cloud 프로젝트 권한을 실행 시 확인한다. OAuth 동의·client secret 설정은 실제 관리자 계정으로 수행해야 하며, 개발 코드만으로 계정 동의를 대신할 수 없다.
- [ ] 외부 OAuth 앱을 Testing 상태로 계속 운영하지 않는다. Google 문서상 이 조건에서는 Drive refresh token이 7일 뒤 만료될 수 있으므로 배포 상태·필요 검증을 점검한다. [OAuth 토큰 만료 문서](https://developers.google.com/identity/protocols/oauth2)
- [ ] 명시적인 테스트 예약으로 사진 0/1/5장, 파손 O/X, 관리자 앱 사진 조회, Drive 실제 생성 파일, 연결 해제·복구를 확인한다. 실제 학생 예약에 테스트 보고서를 넣지 않는다.
- [ ] 새 정책 활성화 전 신규 바이너리 API를 Pages 도메인과 native origin 모두에서 확인한다. 원격 저장 성공/오류를 모의 응답만으로 완료 처리하지 않는다.
- [ ] `reportPolicyVersion: 2` 활성화는 서버 API·사진 저장·관리자 조회 검증 후 진행한다. 장애 시 신규 정책 대상 생성을 끌 수 있게 하되, 이미 접수한 보고서·초안·Drive 파일과 저장 작업은 유지한다. 롤백이 데이터 삭제가 되지 않도록 한다.
- [ ] 범위별 테스트가 통과하면 `npm run build`, `node scripts/check-pre-release.mjs`, `npm run native:sync`, `npm run native:release:check`를 수행한다. 테스트 반복은 신규 실패나 변경이 있을 때만 한다.
- [ ] 웹 배포 후 현재 App Store Connect 최대 빌드를 조회해 다음 버전을 결정한다. 최신 GJU 아이콘과 사진 권한을 포함해 archive/export/upload한다. Android는 버전 정합성·패키징을 확인하고 기존 Play Console 테스트 조건은 별도로 기록한다.
- [ ] iPhone 실기기에서 촬영·사진 선택·5장 첨부·회전/HEIC·권한 거부·앱 재실행 후 초안 복구를 확인한다. 시뮬레이터 테스트만으로 촬영 검증 완료라고 기록하지 않는다.
- [ ] App Store Connect 업로드 접수, 처리 완료, TestFlight 확인, 심사 제출, 스토어 출시는 각각 실제 상태를 기록한다. 사용자가 명시하지 않은 스토어 즉시 출시를 자동 수행하지 않는다.
- [ ] 릴리스 문서에 커밋, 배포 manifest, iOS 버전/빌드, 실기기 테스트, Drive 테스트 파일 확인, 정책 활성화 시각, 남은 외부 설정을 기록한다.

## 7. 검증 완료 기준

- [ ] 관리자에서 보고서 전용 Drive 계정·폴더·연결 상태를 확인하고 해당 폴더를 열 수 있다.
- [ ] 학생은 앱에서 스튜디오/기자재 보고서를 작성하며 별도 Google 로그인·공유 URL 복사 없이 사진을 첨부한다.
- [ ] 정상 사용은 클릭만으로 작성 가능하고, 파손 선택 시 상세와 해당 구분 사진이 요구된다.
- [ ] 6장·위장 파일·타인 첨부·동시 업로드로 상한을 우회할 수 없다.
- [ ] Drive 폴더에는 요약 HTML/JSON과 최대 5장의 실제 사진이 생성되며 앱 조회 결과와 일치한다.
- [ ] 인계 전/예정 종료/조기 반납/연체/취소/과거 예약 정책이 문서의 대상표와 일치한다.
- [ ] 학생·관리자 숫자가 일치하고 사진 업로드 실패·초안·재시도로 중복 집계되지 않는다.
- [ ] Drive 장애·토큰 만료 시 현재 저장 위치와 접수 여부를 정확히 표시하고 데이터 유실 없이 가능한 부분을 복구한다.
- [ ] 기존 보고서·구버전 스튜디오 API·출력실 Drive 기능이 유지된다.
- [ ] 사진·보고서의 보관/삭제 정책이 실제 앱·Drive 동작 및 개인정보 안내와 일치한다.
- [ ] 웹 반영 및 설치 앱 반영을 각각 확인한다.

## 참고한 공식 문서

- [Google 웹 서버 OAuth](https://developers.google.com/identity/protocols/oauth2/web-server): 관리자 일회 연결·offline 접근·서버 토큰 처리.
- [Google Drive 권한](https://developers.google.com/workspace/drive/api/guides/api-specific-auth): `drive.file` 및 기존 폴더 선택 제약.
- [Drive 파일 업로드](https://developers.google.com/workspace/drive/api/guides/manage-uploads): 파일 ID 기반 중복 방지·재시도.
- [Drive 오류 처리](https://developers.google.com/workspace/drive/api/guides/handle-errors): 계정 용량·권한·서비스 계정 제약.
- [Drive 폴더 생성](https://developers.google.com/workspace/drive/api/guides/folder): 보고서 디렉터리 구조.
- [Capacitor Camera](https://capacitorjs.com/docs/apis/camera): 촬영·사진 선택·iOS 사용 설명·Android 복원.
- [Capacitor Filesystem](https://capacitorjs.com/docs/apis/filesystem): 앱 내 미전송 사진 보존 및 개인정보 매니페스트.

공식 문서는 2026-09-21에 확인했다. 실제 연결 계정의 Workspace 정책과 사진 플러그인 API는 구현 시 선택한 계정·설치 버전을 기준으로 검증한다.
