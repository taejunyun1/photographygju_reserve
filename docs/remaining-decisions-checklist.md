# Remaining Decisions Checklist

This checklist tracks information that still needs to be confirmed, corrected, or kept configurable before building GJU-reserve.

## Priority 0: Must Confirm Before Development

### 1. Slack Webhook Rotation

Current issue:

- A Slack webhook URL was shared in chat.

Required decision:

- Create a new Slack Incoming Webhook before production.
- Store it only as Cloudflare Secret `SLACK_WEBHOOK_URL`.
- Do not write it in source code, markdown, screenshots, or admin UI.

### 2. Domain And DNS

Current target:

```text
https://photographygju.dothome.co.kr/
https://admin.photographygju.dothome.co.kr/
```

Need to confirm:

- Can Dothome subdomains point to Cloudflare Pages?
- Can DNS records such as CNAME/TXT be edited?

Fallback:

```text
https://photographygju.dothome.co.kr/
https://photographygju.dothome.co.kr/admin
```

### 3. 암실 Capacity

Conflict:

- Earlier planning said 5 people.
- 2026 darkroom rules say 은염LAB maximum 6 people.

Current guide value:

```text
6 people
```

Need final confirmation:

- Use 6 people unless corrected.

### 4. 출력실 Reservation Details

Still needed:

```text
예약 시간 단위: 30분 / 1시간 / 2시간 / 직접 입력
사용 가능 시간: 10:00-19:00 확정 여부
동시 예약 제한 여부
출력 사이즈 상세: 소형/중형/대형 or A4/A3/A2 etc.
출력 매수 입력 여부
출력비 계좌 정보
당일 예약 불가 적용 여부
주말/공휴일 예약 가능 여부
```

Recommended default:

```text
사용 가능 시간: 10:00-19:00
예약 단위: 1시간
사이즈: 소형/중형/대형
매수 입력: yes
동시 예약 제한: no
```

### 5. 스튜디오 Time Slots

Need final confirmation:

```text
10:00-12:00
12:00-14:00
14:00-16:00
16:00-18:00
18:00-20:00
20:00-22:00
22:00-24:00
```

Already decided:

```text
1 slot = 2 hours
max 3 slots per team
vacation period = Studio A only
```

### 6. 스튜디오 Report Fields

Need final confirmation:

```text
실제 사용 시간
실제 사용 인원
사용 장비
정리정돈 확인
파손/이상 여부
파손/이상 상세
특이사항
제출자
```

Need decision:

```text
사진 첨부: yes/no
제출 후 수정 가능: yes/no
보고서 삭제 기준: 제출일 기준 / 사용일 기준
```

Recommended default:

```text
사진 첨부: no for first release
제출 후 수정: no, admin returns for resubmission if needed
삭제 기준: submitted_at 기준 6개월
```

## Priority 1: Should Confirm Before Data Entry

### 7. Equipment List Corrections

Need corrections:

```text
Lens category has one missing item name with only "2pcs".
APUTURE 600X source text had typo "2pcsㄷ"; currently normalized to 2.
노출계, 삼각대, 컬러미터, 스팟미터 quantities are missing and defaulted to 1.
```

Need final data:

```text
정확한 장비명
정확한 수량
예약 가능 여부
문의 전용 여부
초기 점검/수리/분실 상태
```

### 8. Equipment Import Policy

Current guide:

- CSV required.
- XLSX recommended.
- Preview before import.
- Batch rollback required.
- Duplicate detection required.

Need decision:

```text
Admin이 엑셀 업로드 후 바로 적용할 수 있는지
아니면 최고 관리자 확인 후 적용할지
```

Recommended:

```text
조교 admin이 preview 확인 후 직접 적용 가능
```

### 9. Fantasy Lab Handling

Current guide:

```text
판타지랩 장비 = 문의 전용, 예약 불가
```

Need final confirmation:

- Keep inquiry-only?
- Or allow Admin to mark selected items as reservable later?

Recommended:

```text
Default inquiry-only, admin can later switch individual items to reservable.
```

### 10. Stands And Softboxes

Current guide:

```text
예약 후 조교와 직접 확인
```

Need final confirmation:

- Keep as free-text request?
- Or register as normal equipment items?

Recommended:

```text
First release: free-text request.
Later: register exact items if operation requires inventory tracking.
```

## Priority 2: Operational Policy

### 11. Reservation Edit/Cancel Policy

Already decided:

```text
Students can edit reservations.
Students can cancel reservations.
Admin can force cancel.
Edit history must remain.
```

Need final details:

```text
학생 수정 가능 마감 시간
학생 취소 가능 마감 시간
수정/취소 시 Slack 알림 여부
Admin 강제 취소 사유 필수 여부
```

Recommended:

```text
수정: 예약 1시간 전까지
취소: 예약 1시간 전까지
Slack 알림: yes
Admin 취소 사유: required
```

### 12. Vacation Mode

Already decided:

```text
Admin sets vacation period on calendar.
Vacation mode changes available rental dates.
Studio A only during vacation.
```

Need final details:

```text
방학 중 기자재는 admin 지정 날짜만 가능
방학 중 출력실/암실도 동일하게 제한할지
방학 중 야간/주말 사용은 별도 연락 필수 문구 표시
```

### 13. Holiday Policy

Current note:

```text
공휴일 예약 가능
```

Need final details:

```text
전체 예약 가능인지
예약은 가능하지만 경고 문구만 표시인지
Admin이 공휴일별로 막을 수 있는지
```

Recommended:

```text
Admin blocked_dates로 막을 수 있게 하고, 기본은 가능.
```

### 14. 휴학생/졸업생 Priority

Current guide:

```text
예약 가능하나 재학생 최우선
```

Need implementation decision:

```text
휴학생/졸업생 예약을 자동 확정으로 둘지
Admin 확인 필요 상태로 둘지
재학생 중복 예약 발생 시 자동 취소할지, Admin 경고만 띄울지
```

Recommended:

```text
자동 취소는 하지 말고 Admin에 "재학생 우선 확인 필요" 경고를 표시.
```

## Priority 3: Admin And Security

### 15. Initial Admin Creation

Need decision:

```text
초기 admin 계정을 seed script로 만들지
one-time bootstrap API로 만들지
수동 DB insert로 만들지
```

Recommended:

```text
one-time bootstrap API protected by ADMIN_BOOTSTRAP_TOKEN, then disable after use.
```

Do not write admin passwords in markdown or chat.

### 16. Password Reset

Need decision:

```text
학생이 직접 비밀번호 재설정 가능
Admin이 임시 비밀번호 발급
처음에는 재설정 기능 없음
```

Recommended:

```text
First release: Admin manual reset.
```

### 17. Phone Number Privacy

Recommended fixed policy:

```text
DB/Admin: full phone number visible.
Slack: masked phone number only, e.g. 010-****-1234.
Student list: show only when needed.
```

Need final confirmation:

- Keep Slack masking.

### 18. Data Retention

Current guide:

```text
Reservations: 3 months
Warnings: 3 months
Studio report HTML: 6 months
Student accounts: keep active unless admin deactivates/deletes
```

Need final confirmation:

```text
예약 3개월 후 완전 삭제 vs 개인정보만 익명화
경고 3개월 후 삭제 vs 학기 종료까지 유지
보고서 HTML 삭제 후 제출 기록만 유지 여부
```

Recommended:

```text
예약: 개인정보 익명화, 통계는 유지
경고: 학기 종료까지 유지 가능하도록 Admin setting
보고서: HTML 삭제, 제출 상태 유지
```

## Priority 4: Content And Archive

### 19. Notices

Need final decision:

```text
상단 고정 기능
게시 시작일/종료일
Slack 신청 링크
첨부 이미지/파일
긴급 공지 홈 상단 노출
```

Recommended:

```text
상단 고정: yes
게시 시작/종료: yes
Slack 신청 링크: optional
첨부 파일: later
긴급 공지 홈 상단: yes
```

### 20. Student Archive

Still underdefined:

```text
Admin만 등록 or 학생 업로드
학생 업로드 시 Admin 승인 필요 여부
이미지 파일 업로드 or 외부 링크
영상은 YouTube/Vimeo 링크 or 직접 업로드
공개 범위
```

Recommended:

```text
First release: Admin registers archive.
Images: R2 upload.
Videos: YouTube/Vimeo URL.
Visibility: internal link public.
```

## Current Build Readiness

Ready enough:

- Core stack
- Cloudflare architecture
- Student signup/admin approval
- Equipment reservation policy
- Studio reservation policy
- Darkroom rules
- Slack one-channel notification
- Equipment admin/import concept

Not ready until confirmed:

- Print room details
- Studio report final fields
- Darkroom capacity final confirmation
- Equipment list corrections
- Domain/DNS feasibility
- Slack webhook rotation

