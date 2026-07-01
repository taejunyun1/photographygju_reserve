# Equipment And Darkroom Reference

This document is the operational reference for GJU-reserve equipment and darkroom reservations.

## Important Data Decisions

- Managed department equipment is reservable through GJU-reserve.
- Fantasy Lab equipment is inquiry-only by default.
- Stands and softboxes are not directly reserved in detail at first; students reserve/request them and confirm with an assistant.
- Equipment must be editable in Admin at any time.
- Equipment import from Excel/CSV is required.
- Darkroom capacity is set to 6 people based on the 2026 rule text. This conflicts with an earlier 5-person note, so confirm once before launch.

## Darkroom Reservation Rules For 2026

Penalty policy:

```text
1st violation: warning
2nd violation: 2-week restriction
3rd violation: restriction for the semester
```

Rules:

- Late arrival or rule violations can receive penalties.
- Night and weekend use requires contacting an assistant before reservation.
- The user must make their own reservation.
- Users must keep the reserved time. If late or unable to use the space, contact an assistant in advance.
- People other than the reservation participants may not enter.
- Trash bins must not overflow and must be emptied after use.
- The reservation name must be the user's real name.
- Eating and drinking are not allowed inside the darkroom.
- Silver LAB darkroom capacity is up to 6 people.
- After developing or printing, used chemicals must be discarded into the correct waste container by type.
- Cleaning must start 30 minutes before the reserved time ends.
- After darkroom use, users must report chemical usage by type and amount.
- The darkroom is a shared practice space and must be kept clean.

## Darkroom Time Slots

Darkroom can be used 24 hours with 2-hour slots.

```text
00:00-02:00
02:00-04:00
04:00-06:00
06:00-08:00
08:00-10:00
10:00-12:00
12:00-14:00
14:00-16:00
16:00-18:00
18:00-20:00
20:00-22:00
22:00-24:00
```

Blocked recurring times:

```text
Monday 14:00-18:00
Tuesday 14:00-18:00
```

Admin must be able to edit recurring blocked times.

## Darkroom Reservation Fields

Student input:

```text
예약자 이름
전화번호
예약 날짜
사용 시간
현상/인화 선택
사용 약품
약품 사용 예정량
유의사항 동의
```

Admin/status fields:

```text
예약 상태: 자동 확정 / 취소 / 관리자 취소 / 사용 완료 / 경고
약품 사용 확인
정리 확인
관리자 메모
수정 이력
Slack 전송 상태
```

Darkroom chemicals:

| Process | Chemical | Default Options |
| --- | --- | --- |
| 현상 | Kodak D-76 | 500ml, 1000ml, 2000ml, direct input |
| 정지 | ILFORD indicator stopbath | 500ml, 1000ml, 2000ml, direct input |
| 정착 | ILFORD Hypam Rapid Fixer | 500ml, 1000ml, 2000ml, direct input |
| 인화 현상 | ILFORD multigrade paper Developer | 500ml, 1000ml, 2000ml, direct input |
| 확대기 렌즈 | Schneider componon-s 50mm f2.8 | quantity/direct input |

## Darkroom Slack Message

```text
[암실 예약 확정]
예약자: 박찬희 / 010-****-1234
사용일: 2026-06-15
시간: 10:00-12:00, 12:00-14:00
작업: 현상, 인화
사용 약품: Kodak D-76 500ml, ILFORD Hypam Rapid Fixer 500ml
상태: 자동 확정
상세: https://gjureserve.co.kr/reservations/123
```

## Reservable Department Equipment

Facility:

```text
사진영상미디어학과 기자재실
```

### Body

| Name | Quantity | Reservable | Notes |
| --- | ---: | --- | --- |
| 캐논 750D | 5 | yes |  |
| 캐논 800D | 1 | yes |  |
| 소니 A7M3 | 3 | yes |  |
| 캐논 EOS 5 | 3 | yes | film |
| 캐논 EOS 1 | 1 | yes | film |
| 니콘 FM2 | 1 | yes | film |
| 니콘 D800 | 1 | yes |  |
| 라이카 M6 | 1 | yes | film |

### Lens

| Name | Quantity | Reservable | Notes |
| --- | ---: | --- | --- |
| 캐논 EF-S 18-55 | 5 | yes |  |
| 미확인 렌즈 | 2 | no | Original source has quantity only and missing item name. Needs confirmation. |
| 캐논 EF 16-35 | 1 | yes |  |
| 캐논 17-85 | 1 | yes |  |
| 캐논 28-80 | 1 | yes | film compatible |
| 캐논 28-105 | 3 | yes | film compatible |
| 캐논 70-300 | 1 | yes |  |
| 캐논 RF 85mm | 1 | yes |  |
| 캐논 100macro | 2 | yes |  |
| 니콘 105macro | 1 | yes |  |
| 니콘 135mm | 1 | yes | manual |
| 니콘 50mm | 2 | yes | manual |
| 니콘 16-35mm | 1 | yes |  |
| 니콘 85mm | 1 | yes |  |
| 니콘 시그마 70-200mm | 1 | yes |  |
| 소니 16-35GM | 1 | yes |  |
| 소니 24-70GM | 1 | yes |  |
| 소니 90macro | 1 | yes |  |
| 소니 28-70mm | 1 | yes |  |

### Lighting

| Name | Quantity | Reservable | Notes |
| --- | ---: | --- | --- |
| 캐논 스피드라이트 430EX | 2 | yes |  |
| 니콘 스피드라이트 SB-900 | 1 | yes |  |
| 프로포토 B10 | 3 | yes |  |
| Aputure Light Dome MINI II | 2 | yes |  |
| Aputure LS 60X LED 조명 바이컬러 | 2 | yes |  |
| Aputure LS 60D LED 조명 5600K | 1 | yes |  |

### Other

| Name | Quantity | Reservable | Notes |
| --- | ---: | --- | --- |
| 노출계 | 1 | yes | Quantity needs confirmation if multiple units exist. |
| 삼각대 | 1 | yes | Quantity needs confirmation if multiple units exist. |
| 컬러미터 | 1 | yes | Quantity needs confirmation if multiple units exist. |
| 스팟미터 | 1 | yes | Quantity needs confirmation if multiple units exist. |
| 모니터 캘리브레이터 IOne | 1 | yes |  |
| ATOMOS Shogun 7 | 2 | yes | video preview monitor |
| 펠리칸 케이스 1510 디바이어스 | 1 | yes |  |
| DJI 로닌 RS2 Pro 짐벌 | 1 | yes |  |
| BW 가변 ND 필터 | 1 | yes |  |

### Audio

| Name | Quantity | Reservable | Notes |
| --- | ---: | --- | --- |
| Zoom H5 레코더 | 3 | yes |  |
| 짓조 붐 마이크 폴 | 1 | yes |  |
| 로데 붐 마이크 폴 | 1 | yes |  |
| 젠하이저 샷건마이크 | 1 | yes |  |
| 로데 샷건 마이크 | 1 | yes |  |
| 로데 쇼크 마운트 | 2 | yes |  |
| 로데 블림프 | 1 | yes |  |
| 벨덴 XLR to XLR 케이블 1M | 4 | yes |  |
| 벨덴 XLR to XLR 케이블 3M | 4 | yes |  |

### Stands And Softboxes

Rule:

```text
스탠드와 소프트박스는 예약 후 조교와 직접 확인한 다음 대여한다.
```

Implementation:

- Show guidance text inside the equipment reservation form.
- Add a free-text field: `스탠드/소프트박스 요청사항`.
- Admin can later register exact stand/softbox items if needed.

## Fantasy Lab Equipment

Rule:

```text
판타지랩 기자재는 GJU-reserve 대여가 아니라 판타지랩 조교에게 연락 후 대여한다.
```

Implementation:

- Display as inquiry-only catalog.
- Do not allow direct reservation by default.
- Admin can later switch selected Fantasy Lab items to reservable if operations change.

### Fantasy Lab Camera And Lens

| Name | Quantity | Reservable | Notes |
| --- | ---: | --- | --- |
| 소니 A7SII Body | 5 | no | video |
| 소니 A7MIII Body | 1 | no |  |
| 소니 FX3 Body | 1 | no | video |
| 소니 PXW FS7 | 1 | no | 4K video camera |
| 삼양 AF 35mm F2.8 Lens | 4 | no |  |
| 소니 FE 28-70mm F3.5-5.6 Lens | 1 | no |  |
| 소니 FE 24-70mm F2.8 Lens | 1 | no |  |
| DJI 오즈모 포켓 | 2 | no | action cam |

### Fantasy Lab Drone

| Name | Quantity | Reservable | Notes |
| --- | ---: | --- | --- |
| DJI 스파크 | 2 | no |  |
| DJI 매빅 에어 | 1 | no |  |
| DJI 매빅2 프로 | 3 | no |  |
| DJI 매빅2 줌 | 1 | no |  |
| DJI 매빅3 | 1 | no |  |

### Fantasy Lab Other

| Name | Quantity | Reservable | Notes |
| --- | ---: | --- | --- |
| SONY UWP-D11 핀마이크 | 3 | no |  |
| RODE Stereo VideoMic Pro | 1 | no | directional microphone |
| BSM200_1 채널 무선 핀마이크 | 1 | no |  |
| TASCAM DR-40x 보이스레코더 | 1 | no |  |
| 하만 C214 마이크믹싱콘솔 | 1 | no |  |
| 세코닉 L-308DC | 1 | no | video light meter |
| 셔틀러 | 4 | no |  |
| 360도 촬영 카메라 어댑터 카메라고정용 | 1 | no |  |
| 360도 촬영 카메라 어댑터 삼각대고정용 | 1 | no |  |
| DJI 오즈모 짐벌 | 1 | no |  |
| DJI 로닌SC Pro 짐벌 | 1 | no |  |
| 호르스벤누 전동슬라이더 | 1 | no |  |
| 포맥스 LITEPAD BL2250 | 8 | no |  |
| 포맥스 LITEPAD LP260C | 3 | no |  |
| 아토모스 쇼군7 | 1 | no | preview monitor |
| APUTURE 600X 바이컬러 조명 | 2 | no | Original source had trailing typo. |
| APUTURE LANTERN 26inch | 2 | no | lighting accessory |
| APUTURE Spotlight Mount | 2 | no | lighting accessory |
| APUTURE Barn doors F10 | 2 | no | lighting accessory |

## Equipment Code Rules

Generate individual item codes from a prefix plus a two-digit index.

Examples:

```text
CAM-CANON-750D-01
CAM-CANON-750D-02
CAM-SONY-A7M3-01
LEN-SONY-2470GM-01
LGT-PROFOTO-B10-01
AUD-ZOOM-H5-01
ETC-TRIPOD-01
```

Category prefixes:

| Category | Prefix |
| --- | --- |
| Body | CAM |
| Lens | LEN |
| Lighting | LGT |
| Audio | AUD |
| Drone | DRN |
| Other | ETC |

Status values:

```text
available
reserved
checked_out
maintenance
repair
lost
retired
```

Admin labels:

```text
사용 가능
예약 중
대여 중
점검 중
수리 중
분실
폐기
```

## Admin Equipment Management Requirements

Admin must support:

- Add equipment manually.
- Edit equipment name, category, facility, quantity, reservable status, notes.
- Create individual physical items from quantity.
- Deactivate equipment instead of hard deleting.
- Restore deactivated equipment.
- Change item status.
- Search by category, name, code, status, facility.
- Filter reservable vs inquiry-only items.
- Upload Excel/CSV.
- Preview import before applying.
- Show errors and ambiguous rows.
- Roll back an import batch.

Deletion behavior:

- If an item has reservation history, deactivate it.
- If an item has no reservation history, hard delete may be allowed for admins.

## Excel/CSV Import Requirements

Supported formats:

- `.csv` required
- `.xlsx` recommended

Implementation approach:

- CSV can be parsed server-side with low complexity.
- XLSX can be parsed in the browser and converted to rows before sending to API, or parsed server-side if bundle size remains acceptable.
- The import screen must show a preview before saving.

Recommended import columns:

```text
facility
source
category
name
brand
model
quantity
code_prefix
reservable
inquiry_only
status
notes
```

Column aliases to recognize:

| Canonical | Accepted Korean Headers |
| --- | --- |
| facility | 시설, 장소, 기자재실 |
| source | 출처, 구분, 관리처 |
| category | 카테고리, 종류, 기자재 종류 |
| name | 이름, 장비명, 기자재명, 상세 기자재 |
| brand | 브랜드, 제조사 |
| model | 모델, 모델명 |
| quantity | 수량, 개수, pcs, ea |
| code_prefix | 코드, 코드 prefix, 장비코드 |
| reservable | 예약가능, 대여가능 |
| inquiry_only | 문의전용, 별도문의 |
| status | 상태 |
| notes | 비고, 메모, 설명 |

Auto-recognition rules:

- `5pcs`, `5 pcs`, `5ea`, `5개` should become quantity `5`.
- Missing quantity defaults to `1`, but import preview must mark it as `quantity_assumed`.
- Rows under "판타지랩" default to `inquiry_only=true` and `reservable=false`.
- Rows under department equipment default to `reservable=true`.
- Rows with missing names must be blocked from import.
- Duplicate code prefixes should be flagged.
- Duplicate item names in the same facility/category should show a warning, not hard fail.
- Typos in quantity text should be cleaned where obvious, for example `2pcsㄷ` to `2`.
- Imported rows must belong to an `equipment_import_batch`.

Import preview statuses:

```text
ready
warning
error
duplicate
skipped
```

Example import row:

```text
사진영상미디어학과 기자재실,department,Body,소니 A7M3,소니,A7M3,3,CAM-SONY-A7M3,true,false,available,
```

## Equipment Import Tables

```text
equipment_import_batches
- id
- filename
- uploaded_by
- status: previewed | applied | rolled_back | failed
- total_rows
- ready_rows
- warning_rows
- error_rows
- created_at
- applied_at
- rolled_back_at
```

```text
equipment_import_rows
- id
- batch_id
- row_number
- raw_json
- normalized_json
- status
- message
- created_equipment_group_id
- created_item_ids_json
- created_at
```

## Equipment Slack Message

```text
[기자재 예약 승인 요청]
예약자: 김현석 / 010-****-6412
신분: 재학생
시설: 사진영상미디어학과 기자재실
대여일: 2026-06-15 12:00
반납예정: 2026-06-16 17:30
품목: CAM-SONY-A7M3-01, LEN-SONY-2470GM-01
상태: 승인 대기
상세: https://gjureserve.co.kr/reservations/123
```
