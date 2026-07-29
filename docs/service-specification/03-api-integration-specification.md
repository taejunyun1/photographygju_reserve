# 03. API 및 인증 연동 명세

## 1. 기본 규약

### 운영 주소

```text
웹 같은 출처: https://gjureserve.co.kr/api/*
Worker 직접 호출: https://photographygju-reserve.taejunyun.workers.dev/api/*
로컬 개발: http://127.0.0.1:5173/api/*
```

웹은 같은 출처 `/api/*`를 권장한다. iOS·Android 또는 별도 기존 서비스 백엔드는 Worker 직접 주소를 사용할 수 있다.

### 콘텐츠 형식

- 요청: `Content-Type: application/json`
- 응답: `application/json; charset=utf-8`
- 요청 본문 최대 크기: 1MiB
- 날짜: `YYYY-MM-DD`
- 시각: `HH:MM`
- 타임스탬프: ISO 8601 UTC
- 화면 날짜 기준: `Asia/Seoul`

### 성공 응답

```json
{
  "ok": true,
  "data": {}
}
```

### 실패 응답

```json
{
  "ok": false,
  "error": "사용자에게 표시할 오류 메시지"
}
```

### 주요 상태 코드

| 코드 | 의미 |
| ---: | --- |
| 200 | 성공 |
| 204 | CORS 사전 요청 성공 |
| 400 | 입력·업무 규칙 오류 |
| 401 | 로그인 또는 비밀번호 확인 실패 |
| 403 | 승인·역할·소유권 부족 |
| 404 | 경로 또는 대상 없음 |
| 409 | 중복, 상태 전이, 예약 충돌 |
| 413 | 요청 본문 초과 |
| 429 | 로그인 시도 제한 |
| 500 | 서버 설정 또는 처리 오류 |

## 2. 인증

### 방식

로그인 성공 시 반환되는 토큰을 이후 요청에 넣는다.

```http
Authorization: Bearer <session-token>
```

세션 토큰은 32바이트 난수의 16진 문자열이며 기본 유효기간은 14일이다. 서버는 쿠키를 발급하지 않는다.

### 비밀번호

- 최소 8자
- PBKDF2-SHA-256
- 반복 100,000회
- 16바이트 무작위 salt
- 저장 형식: `pbkdf2:<salt>:<hash>`

### 로그인 제한

- 동일 로그인 ID 기준 15분 내 10회 실패 시 5분 잠금
- 현재 제한 상태는 런타임 메모리 기반
- 기존 서비스 통합 시 Cloudflare Rate Limiting, Durable Object 또는 기존 인증 서비스의 영속 제한으로 보강 권장

### 권한 표기

| 표기 | 조건 |
| --- | --- |
| 공개 | 토큰 없이 가능 |
| 선택 인증 | 토큰이 있으면 개인화 |
| 로그인 | 유효한 사용자 세션 |
| 승인 사용자 | 로그인 + 학생 승인 상태 `approved`, 관리자는 통과 |
| 관리자 | 로그인 + `role=admin` |
| 내부 | `x-internal-cron-secret` 일치 |

## 3. 전체 API 목록

### 3.1 공개·계정

| 메서드 | 경로 | 권한 | 목적 | 주요 입력 |
| --- | --- | --- | --- | --- |
| GET | `/api/bootstrap` | 선택 인증 | 설정, 약품, 활성 장비, 공개 공지, 운영 예약 요약 | 없음 |
| GET | `/api/me` | 선택 인증 | 현재 사용자 또는 `null` | 없음 |
| POST | `/api/auth/signup` | 공개 | 학생 가입 신청 | `name`, `studentStatus`, `phone`, `email`, `password`, 선택 `studentId`, `grade` |
| POST | `/api/auth/login` | 공개 | 토큰 발급 | `loginId`, `password` |
| POST | `/api/auth/logout` | 공개 | 지정 토큰 세션 제거 | `token` |
| PATCH | `/api/me` | 로그인 | 프로필 수정 | 선택 `name`, `phone`, `email`, `grade` |
| PATCH | `/api/me/password` | 로그인 | 비밀번호 변경·전체 세션 회수 | `currentPassword`, `newPassword` |
| DELETE | `/api/me` | 로그인 | 학생 계정과 연결 데이터 삭제 | `currentPassword`, `confirmText: "계정 삭제"` |

`GET /api/bootstrap`은 인증 사용자의 경우 현재 운영 예약 요약을 포함한다. 비로그인 사용자는 빈 예약 배열을 받는다. 별도 `/api/health`는 없으며 운영 상태 확인은 이 경로를 사용한다.

### 3.2 학생 예약·편의 기능

| 메서드 | 경로 | 권한 | 목적 | 주요 입력 |
| --- | --- | --- | --- | --- |
| GET | `/api/reservations/my` | 로그인 | 본인 예약과 특강 신청 통합 조회 | 없음 |
| POST | `/api/reservations` | 승인 사용자 | 예약 생성 | `type`, `fields` |
| PATCH | `/api/reservations/:id` | 소유자 또는 관리자 | 예약 필드 수정 | `fields` |
| POST | `/api/reservations/:id/cancel` | 소유자 또는 관리자 | 예약 취소 | 선택 `reason` |
| POST | `/api/reservations/recommendations` | 승인 사용자 | 불가 초안의 대안 최대 3개 | `type`, `fields` |
| GET | `/api/me/reservation-shortcuts` | 승인 사용자 | 즐겨찾기 그룹과 최근 예약 3건 | 없음 |
| PUT | `/api/me/favorite-equipment-groups` | 승인 사용자 | 즐겨찾기 그룹 전체 교체 | `groups` |

예약 종류는 `equipment`, `studio`, `darkroom`, `print`만 허용한다.

### 3.3 교과 수요조사

| 메서드 | 경로 | 권한 | 목적 | 주요 입력 |
| --- | --- | --- | --- | --- |
| GET | `/api/me/course-demand-surveys` | 승인 사용자 | 본인 학년이 볼 수 있는 설문과 기존 응답 | 없음 |
| PUT | `/api/me/course-demand-surveys/:id/response` | 승인 사용자 | 순위 응답 신규·수정 저장 | `rankings` |
| GET | `/api/admin/course-planning` | 관리자 | 과목·설문·집계 묶음 조회 | 없음 |
| GET | `/api/admin/courses` | 관리자 | 과목 마스터 조회 | 없음 |
| PUT | `/api/admin/courses` | 관리자 | 과목 마스터 전체 교체 | `courses` |
| POST | `/api/admin/course-demand-surveys` | 관리자 | 설문안 생성 | 설문 정의 |
| PUT | `/api/admin/course-demand-surveys/:id` | 관리자 | 임시안 수정, 공개 설문 연장·마감 | 설문 정의 일부 |
| GET | `/api/admin/course-demand-surveys/:id/summary` | 관리자 | 설문 집계 조회 | 없음 |

레거시/보조 API:

| 메서드 | 경로 | 비고 |
| --- | --- | --- |
| GET/PUT | `/api/admin/curriculum-versions` | 130학점 교육과정 버전 |
| GET/PUT | `/api/admin/annual-offering-plans` | 연간 개설안 저장 |
| PUT | `/api/admin/annual-offering-plans/:id` | 개설안 검증·확정 |
| POST | `/api/admin/annual-offering-plans/:id/recommendations` | 85학점·전필·주기·수요 기반 추천 |

기존 서비스 연동 기본 범위에서는 위 개설안 API를 제외한다. 공식 편성 작업은 학교 웹에서 수행한다.

### 3.4 비교과 특강

| 메서드 | 경로 | 권한 | 목적 | 주요 입력 |
| --- | --- | --- | --- | --- |
| GET | `/api/lectures` | 로그인 | 개인 신청 상태를 포함한 특강 목록 | 없음 |
| POST | `/api/lectures/:id/apply` | 승인 사용자 | 특강 신청 | 없음 |
| DELETE | `/api/lectures/:id/apply` | 승인 사용자 | 특강 신청 취소 | 없음 |
| GET | `/api/admin/lectures` | 관리자 | 특강·신청자 목록 | 목록 쿼리 |
| POST | `/api/admin/lectures` | 관리자 | 특강 생성 | 특강 필드 |
| PATCH | `/api/admin/lectures/:id` | 관리자 | 특강 수정 | 수정 필드 |
| DELETE | `/api/admin/lectures/:id` | 관리자 | 특강과 신청 삭제 | 없음 |
| DELETE | `/api/admin/lectures/bulk` | 관리자 | 필터 결과 또는 전체 삭제 | 일괄 삭제 본문 |

### 3.5 보고서

| 메서드 | 경로 | 권한 | 목적 | 주요 입력 |
| --- | --- | --- | --- | --- |
| POST | `/api/reports/studio` | 승인 사용자 | 스튜디오 보고서 제출 | `reservationId`, `actualTime`, `participants`, `cleanupConfirmed` 등 |
| GET | `/api/admin/reports` | 관리자 | 실제 보고서와 계산된 미제출 행 | 목록 쿼리 |
| PATCH | `/api/admin/reports/:id/status` | 관리자 | 검토 완료 | `status: "reviewed"` |
| DELETE | `/api/admin/reports/bulk` | 관리자 | 실제 보고서 일괄 삭제 | 일괄 삭제 본문 |

### 3.6 관리자 대시보드·사용자

| 메서드 | 경로 | 권한 | 목적 | 주요 입력 |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/summary` | 관리자 | 운영 큐, 지표, 최근 28일 인사이트 | 없음 |
| GET | `/api/admin/users` | 관리자 | 사용자 목록 | 목록 쿼리 |
| PATCH | `/api/admin/users/:id/approval` | 관리자 | 승인·반려·차단 | `approvalStatus`, 선택 `limitDuration` |
| POST | `/api/admin/users/:id/warning` | 관리자 | 경고 발급 또는 초기화 | `reason` 또는 `reset: true` |
| PATCH | `/api/admin/users/:id/password` | 관리자 | 지정 또는 임시 비밀번호 설정 | 선택 `newPassword` |
| DELETE | `/api/admin/users/:id` | 관리자 | 학생 계정·연결 데이터 삭제 | 없음 |

승인 상태는 `approval_pending`, `approved`, `rejected`, `blocked`다. 차단 기간은 `week1`, `week2`, `month1`, `semester`다.

### 3.7 관리자 예약

| 메서드 | 경로 | 권한 | 목적 | 주요 입력 |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/reservations` | 관리자 | 상세 예약 목록 | 목록 쿼리 |
| PATCH | `/api/admin/reservations/:id/status` | 관리자 | 상태 전이 | `status`, 선택 `adminNote` |
| DELETE | `/api/admin/reservations/:id` | 관리자 | 예약과 연결 보고서 삭제 | 없음 |
| DELETE | `/api/admin/reservations/bulk` | 관리자 | 필터 결과 또는 전체 삭제 | 일괄 삭제 본문 |

공간 예약의 관리자 상태 변경은 `completed`와 `admin_cancelled`만 지원한다. 기자재 상태 전이는 기능 명세를 따른다.

### 3.8 관리자 기자재

| 메서드 | 경로 | 권한 | 목적 | 주요 입력 |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/equipment` | 관리자 | 전체 장비 조회 | 없음 |
| POST | `/api/admin/equipment` | 관리자 | 장비 1개 이상 생성 | `name`, `category`, 선택 `quantity` 등 |
| POST | `/api/admin/equipment/import` | 관리자 | CSV 파싱 결과 적용 | `rows`, 선택 `filename` |
| PATCH | `/api/admin/equipment/bulk` | 관리자 | 최대 200개 일괄 수정 | `ids`, `patch` |
| PATCH | `/api/admin/equipment/:id` | 관리자 | 장비 수정·비활성화 | 수정 필드 |

장비 상태는 입력 호환값을 받아 최종적으로 `가능`, `수리중`, `파손`으로 정규화한다. 판타지랩 소스는 항상 예약 불가·문의 전용으로 재정규화된다.

### 3.9 관리자 공지·설정·운영

| 메서드 | 경로 | 권한 | 목적 | 주요 입력 |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/notices` | 관리자 | 공지 목록 | 목록 쿼리 |
| POST | `/api/admin/notices` | 관리자 | 공지 생성 | `title`, `body` 등 |
| DELETE | `/api/admin/notices/:id` | 관리자 | 공지 삭제 | 없음 |
| DELETE | `/api/admin/notices/bulk` | 관리자 | 필터 결과 또는 전체 삭제 | 일괄 삭제 본문 |
| GET | `/api/admin/settings` | 관리자 | 운영 설정 조회 | 없음 |
| PATCH | `/api/admin/settings` | 관리자 | 허용된 운영 설정 수정 | 설정 필드 |
| GET | `/api/admin/sessions` | 관리자 | 활성 세션 목록 | 없음 |
| POST | `/api/admin/sessions/:id/revoke` | 관리자 | 다른 세션 회수 | 없음 |
| GET | `/api/admin/logs` | 관리자 | 최근 감사 로그 최대 400건 | 없음 |
| GET | `/api/admin/export` | 관리자 | 운영 백업 JSON | 없음 |
| POST | `/api/admin/maintenance/cleanup` | 관리자 | 보관정책 정리 | 없음 |
| POST | `/api/admin/maintenance/semester-close` | 관리자 | 학기 종료 정리 | `confirmText: "학기 종료"` |
| POST | `/api/internal/cleanup` | 내부 | Cron 보관정책 정리 | 헤더 비밀값 |

## 4. 목록 쿼리 규약

공통:

| 파라미터 | 의미 | 제한 |
| --- | --- | --- |
| `page` | 페이지 번호 | 최소 1 |
| `pageSize` | 페이지 크기 | 1~200, 기본 100 |
| `q` | 전체 검색어 | 대소문자 비구분 |
| `type` | 종류 또는 분류 | 화면별 의미 |
| `status` | 상태 | 화면별 허용값 |
| `semester` | 학기 키 | `YYYY-S1`, `YYYY-S2` |
| `role` | 사용자 역할 | 사용자 목록 |
| `from`, `to` | 날짜 범위 | `YYYY-MM-DD` |
| `sort` | 정렬 필드 | 목록별 허용 필드 |
| `direction` | 정렬 방향 | `asc`, `desc` |

페이지 응답:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 100,
  "hasMore": false,
  "collectionTotal": 0
}
```

예약·보고서·특강은 학기 필터 선택지 `semesterOptions`를 추가한다. 보고서는 가상 미제출 행을 포함하므로 `persistedTotal`, `persistedCollectionTotal`을 별도로 제공한다.

학기 범위:

- 1학기: 해당 연도 03-01~08-31
- 2학기: 해당 연도 09-01~다음 연도 02월 말

## 5. 주요 데이터 계약

### 5.1 로그인

요청:

```json
{
  "loginId": "20260001",
  "password": "example-password"
}
```

응답:

```json
{
  "ok": true,
  "data": {
    "token": "64-character-hex-token",
    "user": {
      "id": "user_xxx",
      "role": "student",
      "name": "학생 이름",
      "email": "student@example.com",
      "studentId": "20260001",
      "grade": "2",
      "approvalStatus": "approved"
    }
  }
}
```

`passwordHash`는 공개 사용자 응답에 포함하지 않는다.

### 5.2 기자재 예약 생성

```json
{
  "type": "equipment",
  "fields": {
    "reservedDate": "2026-08-07",
    "period": "1박2일",
    "rentalTime": "12:00",
    "returnTime": "17:10",
    "equipmentItemIds": ["eq_xxx", "eq_yyy"],
    "cameraBagConfirmed": true,
    "phone": "010-0000-0000",
    "purpose": "전공 수업 촬영",
    "standRequest": ""
  }
}
```

### 5.3 예약 추천

요청은 예약 생성과 같은 `type`, `fields`를 사용한다.

응답:

```json
{
  "ok": true,
  "data": {
    "alternatives": [
      {
        "kind": "alternate_equipment",
        "label": "대체 장비 · 소니 A7M3",
        "patch": {
          "type": "equipment",
          "equipmentItemIds": ["eq_alternative"]
        }
      }
    ]
  }
}
```

### 5.4 즐겨찾기 그룹

```json
{
  "groups": [
    {
      "id": "favorite_group_xxx",
      "name": "영상 촬영",
      "equipmentItemIds": ["eq_1", "eq_2"]
    }
  ]
}
```

PUT은 부분 수정이 아니라 전체 그룹 목록 교체다.

### 5.5 수요조사 생성

```json
{
  "title": "2027학년도 1학기 전공선택 수요조사",
  "academicYear": 2027,
  "term": "spring",
  "eligibleCurrentYears": [2],
  "targetStudentYears": [2],
  "opensAt": "2026-12-01T00:00:00.000Z",
  "closesAt": "2026-12-14T14:59:59.000Z",
  "status": "open",
  "courseIds": ["course_a", "course_b", "course_c", "course_d", "course_e"]
}
```

### 5.6 학생 수요조사 응답

```json
{
  "rankings": [
    { "courseId": "course_a", "rank": 1 },
    { "courseId": "course_c", "rank": 2 },
    { "courseId": "course_b", "rank": 3 }
  ]
}
```

### 5.7 설문 집계

```json
{
  "surveyId": "course_survey_xxx",
  "eligibleStudentCount": 24,
  "responseCount": 18,
  "responseRate": 75,
  "courses": [
    {
      "courseId": "course_a",
      "courseName": "다큐멘터리 메이킹",
      "demandCategory": "documentary",
      "selections": 14,
      "demandScore": 58,
      "rankCounts": { "1": 8, "2": 3, "3": 2, "4": 1, "5": 0 }
    }
  ],
  "categories": [
    { "category": "documentary", "selections": 20, "demandScore": 76 }
  ]
}
```

### 5.8 일괄 삭제

필터 결과 삭제:

```json
{
  "scope": "filtered",
  "filters": {
    "semester": "2026-S1",
    "status": "cancelled"
  }
}
```

전체 삭제:

```json
{
  "scope": "all",
  "confirmText": "전체 삭제"
}
```

필터가 없거나 필터 결과가 사실상 전체와 같으면 확인 문구 없이 삭제할 수 없다.

## 6. CORS와 보안 헤더

Worker 허용 출처:

- `https://gjureserve.co.kr`
- `https://www.gjureserve.co.kr`
- 기존 Dothome 학생·관리자 주소
- Worker 자체 주소
- `capacitor://localhost`
- `ionic://localhost`
- localhost 또는 127.0.0.1 개발 주소

허용 메서드:

```text
GET, POST, PATCH, DELETE, OPTIONS
```

허용 헤더:

```text
content-type, authorization
```

응답에는 CSP, Permissions-Policy, Referrer-Policy, X-Content-Type-Options, X-Frame-Options와 `Cache-Control: no-store`를 적용한다.

## 7. 기존 서비스 API 연동 권장

### 서버 대 서버

- 기존 서비스 백엔드가 GJU Worker를 호출하는 프록시를 둔다.
- 브라우저에 Worker 운영 주소와 시스템 비밀값을 직접 노출하지 않는다.
- 기존 사용자와 GJU 사용자의 연결 키를 별도 테이블로 관리한다.
- 관리자 동작은 GJU 관리자 세션을 그대로 공유하기보다 기존 권한을 검증한 뒤 제한된 서버 어댑터를 호출한다.

### 프론트 직접 연동

- `/api/*`를 같은 출처로 프록시한다.
- CSP `connect-src`와 Worker CORS에 새 운영 도메인을 추가한다.
- Bearer 토큰의 XSS 노출 위험을 수용하거나, 기존 서비스 BFF가 HttpOnly 쿠키를 세션 토큰으로 교환하도록 개선한다.

### 계약 안정화

현재 API는 명시적 버전 경로가 없다. 기존 서비스 통합 전에 다음을 권장한다.

- `/api/v1/*` 또는 게이트웨이 버전 추가
- 오류 코드 필드 추가: `{ ok, error, code }`
- OpenAPI 문서 자동 생성
- 낙관적 동시성 또는 `updatedAt` 조건부 수정
- 일괄 교체 API에 idempotency key 적용
- 관리자 세부 권한 정책 추가

