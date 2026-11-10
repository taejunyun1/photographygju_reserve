# 디지털사진영상실 좌석 예약 QA

검증일: 2026-11-10. 대상: `gjureserve.co.kr` 웹. 웹 버전: `20261110-digital-lab-r1`. 이 문서는 11월 9일 승인한 작업의 QA 기록이므로 파일 날짜를 유지한다.

## 적용 정책과 상태

- Mac 01–12, PC 01–04의 16석을 개별 예약한다. 실제 운영 설정은 KST 00:00–24:00이다.
- 시작·종료는 짝수 시 정각의 2시간 단위이다. 같은 날 연속 여러 구간을 예약할 수 있으며, 당일 미래 구간도 가능하다. 자정을 넘는 예약은 지원하지 않는다.
- 승인된 사용자는 자동 확정된다. 같은 좌석 또는 같은 사용자의 중복 구간은 거절한다. 구간은 시작 포함·종료 제외이다.
- 수업은 날짜·요일·분 단위 시간에 맞춰 16석 전체를 차단한다. 기존 예약과 충돌하면 관리자 취소 후 다시 등록해야 한다.
- **구현·검사·운영 Worker/Pages 배포와 활성화를 완료했다.** 2026-11-10 22:49 KST에 두 운영 주소에서 활성화·00:00–24:00 설정과 기존 설정 42개 보존을 확인했다. 실제 로그인 후 좌석 조회는 운영 세션이 없어 수행하지 않았으며, 해당 기능은 격리 API/브라우저로 검증했다.

## 검증 결과

| 검증 | 명령 / 환경 | 결과 |
|---|---|---|
| 도메인 | `node scripts/digital-lab-domain-test.mjs` | 16/16 통과: 좌석·KST·짝수 시간·연속 구간·수업·기존 시설 정책 |
| 실제 HTTP API | `node scripts/digital-lab-api-test.mjs` | 17/17 통과: 권한·개인정보·동시 예약·수정·취소·수업 충돌·16석 수용 |
| Worker / 실제 SQLite | `node --no-warnings scripts/digital-lab-worker-test.mjs` | 누락/잘못된/미래 활성화 값 무시, SQL 롤백, 캐시 폐기, 동시 요청 직렬화, 재시작, 관리자 사전 거부, 다른 설정·기존 알람 보존 통과 |
| 브라우저 캐시 연결 | `node scripts/digital-lab-cache-test.mjs` | HTML 및 28개 도달 가능한 모듈의 동일 버전 검증 통과 |
| 좌석 UI | `npx playwright test tests/ui/digital-lab.spec.mjs --workers=1` | 390·430·768·1440px: 17 통과, 공유 수업 설정 중복 실행 방지 3 제외 |
| 이전 실제 배포 번들 | `node scripts/digital-lab-compatibility-test.mjs <previous-snapshot> <screenshot-directory>` | 42개 자산 SHA-256 일치, 소유자·관리자 목록에서 새 API 데이터 소비, pageerror 0. 아래 표시 제한 있음 |
| 전체 release:check | `GJU_FACILITY_SCREENSHOT_DIR=$(mktemp -d /tmp/gju-task6-release-screens.XXXXXX) npm run release:check` | **종료 코드 0**. UI 202 통과·53 조건부 제외(48.0초), 전체 선행 검사·사전 배포 검사·네이티브 준비 정적 검사 통과 |

API 수용 검증은 서로 다른 승인 사용자 16명으로 Mac 12석과 PC 4석을 채운다. 17번째 같은 구간 요청은 409이고, PC 04 한 건 취소 후 가용 목록은 PC 04 하나뿐이며 17번째 사용자가 이를 예약한다. 운영 데이터는 사용하지 않았다.

브라우저 수업 흐름은 학생 예약 → 관리자 수업 충돌 409 → 예약 상세로 이동 → 관리자 취소 → 입력 초안 유지 → 수업 등록 200 → 학생 예약 409 → 수업 삭제 → 학생 재예약 200을 실제 격리 API로 검증했다. 좌석 선택은 키보드 Enter로도 수행했다. 16개 버튼의 경계와 텍스트 크기를 검사했고, 상태는 “예약 가능”, “선택”, 차단 사유 등의 텍스트로도 전달된다.

처음 전체 검사에서 관리자 예약 유형의 여섯 번째 탭이 320px 화면에서 넘쳤다(`mobile-layout.spec.mjs`, 너비 282px에 scrollWidth 371px). 기존 한 줄 flex 배치가 새 긴 시설명을 수용하지 못한 회귀여서 해당 모바일 탭에만 줄바꿈을 적용했다. 이 실패를 기존 문제로 분류하지 않았다. 최초 실행은 UI 201 통과·53 제외·1 실패로 중단되어 뒤의 사전 배포/네이티브 준비 정적 검사까지 도달하지 않았다.

두 번째 전체 실행은 UI 201 통과·53 제외·1 로컬 네트워크 실패였다. 데스크톱 좌석 테스트가 취소를 완료한 뒤 최종 읽기 요청에서 `ECONNRESET`을 받았다. 유휴 연결 재사용 경계로 추정하며, [Playwright의 공식 maxRetries 옵션](https://playwright.dev/docs/api/class-apirequestcontext#api-request-context-fetch-option-max-retries)을 이 테스트의 GET 요청에만 1회 적용했다. 이 옵션은 ECONNRESET만 재시도하며 HTTP 오류나 POST/PATCH/DELETE를 다시 실행하지 않는다.

기존 `MODULE_TYPELESS_PACKAGE_JSON` 경고와 Playwright `NO_COLOR`/`FORCE_COLOR` 경고는 별도 기록하며 package type은 변경하지 않았다. Worker 테스트의 injected save/alarm failure 로그는 롤백 검증용 의도된 오류다. 브라우저는 로컬 Chromium 및 기존 전체 검사에 포함된 WebKit 에뮬레이션이다. 실제 iPhone/iPad/Android 기기 검증, 서명·네이티브 패키지 생성·스토어 배포는 수행하지 않았다.

## 화면 증거

아래 이미지는 모두 격리된 테스트 사용자와 fixture이다. 좌석 네 폭과 현황판·수업 등록·이전 번들 화면은 캡처 후 시각적으로 확인했다.

| 화면 | 증거 |
|---|---|
| 390px 좌석·상태·다음 버튼 | [좌석 390](assets/2026-11-10-digital-lab/seats-390.png) |
| 430px | [좌석 430](assets/2026-11-10-digital-lab/seats-430.png) |
| 768px | [좌석 768](assets/2026-11-10-digital-lab/seats-768.png) |
| 1440px | [좌석 1440](assets/2026-11-10-digital-lab/seats-1440.png) |
| 320px 관리자 예약 유형 줄바꿈 | [관리자 탭](assets/2026-11-10-digital-lab/admin-tabs-320.png) |
| 수업 충돌 해소 후 등록 | [수업 등록](assets/2026-11-10-digital-lab/class-conflict-resolved-390.png) |
| 기존 복도 도면과 분리된 16석 현황 | [현황판](assets/2026-11-10-digital-lab/board-390.png) |
| 이전 소유자 목록 | [이전 학생 번들](assets/2026-11-10-digital-lab/old-bundle-student.png) |
| 이전 관리자 전체 목록 | [이전 관리자 번들](assets/2026-11-10-digital-lab/old-bundle-admin.png) |

390px에서 선택 상태 문구는 두 줄로 보일 수 있지만 버튼 내부에 들어가며 다른 좌석·하단 동작과 겹치지 않는다.

## 이전 배포 번들 호환성 범위

이전 Pages 커밋 `78abedd44e1b8680e9d9bdf98372a2dfc89d7a2c`, manifest 생성 시각 `2026-11-09T02:45:11.687Z`의 실제 공개 자산 42개를 그대로 사용했다. 다운로드된 자산 각각을 manifest SHA-256과 비교한다. 스냅샷은 테스트 입력이며 저장소의 정상 release 검사에 의존성을 추가하지 않았다. 재실행 시 같은 manifest와 자산을 별도 경로로 제공해야 한다.

현재 `handleApiRequest`에서 로컬 승인 학생과 관리자 토큰을 발급하고 새 `digital_lab` 예약을 생성했다. 변경하지 않은 이전 HTML/JS/CSS/config를 로컬 HTTP로 제공하고, API만 현재 구현에 연결했다. 소유자는 `/api/bootstrap`, `/api/reservations/my`의 새 예약을 “내 예약”에서 읽는다. 관리자는 기본 기자재 필터를 “전체”로 바꿔 `/api/admin/reservations?...`의 새 예약을 읽는다. 역할별 실제 응답에 예약 ID가 포함되는지와 해당 화면이 렌더링되는지, 런타임 예외가 없는지 확인했다.

**이전 번들에 새 기능의 표시·조작 동등성이 있다는 뜻은 아니다.** 이전 학생 화면의 제목은 `undefined 예약`이고 날짜·시간은 보인다. 이전 관리자 화면은 유형을 `digital_lab`로 표시하고 기존 출력 유형용 빈 속성 및 기존 동작 버튼을 보여준다. 새 좌석 선택·시설 전용 탭은 이전 번들에 없다. 이를 숨기거나 다른 예약 유형으로 바꾸는 API 처리는 넣지 않았다. 최신 웹은 새 시설명과 좌석·시간을 표시하며 전체 캐시 연결을 갱신한다. 기존 네이티브 앱의 내장 정적 번들은 웹 배포만으로 바뀌지 않으므로 별도 앱 업데이트가 필요하다.

## 일회성 활성화 인터페이스와 운영 순서

`DIGITAL_LAB_ACTIVATION_AT`은 UTC ISO 시각(`YYYY-MM-DDTHH:mm:ss[.sss]Z`)이다. 유효하고 현재보다 늦지 않은 값만 처리한다. 누락·빈 값·잘못된 날짜·미래 값은 아무 변경도 하지 않는다. 소스 기본 설정은 비활성이다. 소스 Wrangler config에는 변수를 추가하지 않았으며, 최종 운영 Worker에는 아래 기록의 명시적인 원격 변수를 적용했다.

일반 API 요청의 기존 Worker mutation queue 안에서 설정을 읽고, `digitalLabEnabled=true`, `digitalLabOpenTime=00:00`, `digitalLabCloseTime=24:00`과 `meta.digitalLabActivationApplied=<flag>`를 같은 SQL 저장 트랜잭션에 넣는다. 저장 완료 뒤에만 응답한다. 실패하면 요청은 오류를 반환하고 메모리 캐시는 폐기해 다음 요청에서 저장된 상태를 다시 읽는다. 활성화 전 관리자가 세 디지털실 설정 중 하나를 명시적으로 저장하면 같은 marker를 함께 저장하여 배포 기본값을 거부한다. marker가 있으면 후속 배포나 재시작으로 관리자의 비활성화·시간 변경을 덮어쓰지 않는다. 다른 설정·예약·사용자와 기존 기자재 자동 경고 알람은 보존한다.

검토 후 컨트롤러가 다음 순서로 실행했다. 아래는 재현 가능한 절차이며, 실제 배포 식별자와 적용 시각은 마지막 절에 기록한다.

1. `npm run build:worker` 후 `npx wrangler deploy --config wrangler.worker.jsonc --keep-vars`로 비활성 백엔드를 먼저 배포한다. 기존 변수·시크릿·DO·cron을 유지한다.
2. `npm run pages:build` 후 `npx wrangler pages deploy dist --project-name gju-reserve --branch main`으로 웹을 배포한다. GitHub push는 하지 않는다.
3. 공개 자산 버전/manifest, `/api/version`, `/api/bootstrap`, 웹 화면을 읽기 전용으로 확인한다. 가능하면 승인된 계정의 좌석 조회 API도 읽기 전용으로 확인한다. 별도 관리자 사전 설정으로 marker가 소비됐다면 해당 설정을 존중하고 자동 활성화를 강제하지 않는다.
4. 확인 후 아래 명령으로 현재 시각을 명시한다. 기존 기자재 활성화 값은 반드시 그대로 유지한다.

```sh
DIGITAL_LAB_ACTIVATION_AT="$(node -e 'process.stdout.write(new Date().toISOString())')"
npx wrangler deploy --config wrangler.worker.jsonc --keep-vars \
  --var "DIGITAL_LAB_ACTIVATION_AT:$DIGITAL_LAB_ACTIVATION_AT" \
  --var "EQUIPMENT_OVERDUE_ACTIVATION_AT:2026-10-12T04:17:07.000Z"
```

5. 일반 API 읽기 요청이 일회성 설정을 적용한 후 실제 00:00–24:00 설정, 공개 최신 자산과 좌석 목록을 확인한다. 실제 운영에 시험 예약을 만들지 않는다. 활성화 변수 제거만으로 기능이 꺼지지는 않으며, 이후 운영 중단은 정상 관리자 설정으로 한다.

`--keep-vars`와 `--var`는 설치된 Wrangler 도움말로 확인했다. 원자적 SQL 저장과 메모리 상태 복구는 [Cloudflare SQLite transactions](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#transactions), [Durable Objects 규칙](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)에 맞춰 기존 저장 방식을 유지했다. 롤백·실패 주입 검증은 실제 SQLite와 Worker 소스에 대한 로컬 테스트다. Cloudflare 운영에서는 공개 API 응답·설정·자산과 배포 구성을 검증했으며 운영 저장 실패를 주입하지 않았다.

## 주요 판단과 비용 기록

| 판단 | 근거 / 변경 범위 | 잘못 판단했을 때의 비용 또는 제한 |
|---|---|---|
| 기존 checkout의 전용 codex 브랜치 재사용 | 사용자 요청과 작업 환경; 관련 없는 `.codex-audit/`, `outputs/` 보존 | 새 worktree를 늘리지 않으며 변경 파일 범위 확인 필요 |
| 승인된 계획을 구현·검사·웹 배포까지 진행 | 사용자의 후속 실행 요청이 이전 계획만 작성하라는 범위를 대체 | 계획의 기본값도 구현 범위에 포함; 이후 수정은 별도 변경 필요 |
| 단계별 집중 검사 후 전체 검사 | 작업별 불필요한 전체 반복 방지; 최종 실패는 수정 후 재검증 | 작업 간 회귀 발견이 통합 단계까지 늦어질 수 있음; 실제 탭 회귀와 로컬 연결 오류로 전체 검사 2회 추가 |
| 수정 조회에 선택적 `editingId` 추가 | 소유자·관리자 권한 확인 후 수정 대상만 점유에서 제외 | 잘못된 권한 판정이면 다른 예약을 제외할 수 있으므로 API 권한 회귀 검사로 확인 |
| 기존 API 오류에 수업 충돌 정보 유지 | 관리자 화면에서 실제 충돌 예약을 열어 취소·재시도 | 관리자 전용 메타데이터 노출 위험이 있어 학생 응답과 권한을 구분해 검사 |
| 환경 제한·실패·실기기 검증을 구분 | 격리 서버·브라우저 실행 권한은 승인된 테스트 범위에서 해결 | 에뮬레이션으로 실제 기기·서명·스토어 동작을 보장하지 않음 |
| 배포 변수로 일회성 활성화 | 지정된 운영 관리자 자격 증명 없이 승인된 설정 적용; 공개 우회 endpoint 없음 | marker는 영속적; 이후 변경은 정상 관리자 경로 이용 |
| 전체 모듈 버전 갱신 | 공개 JS 캐시 4시간, HTML 재검증; unversioned planner/schedule까지 포함 | 기존 브라우저가 자산을 한 번 추가로 내려받음 |
| 재예약 whitelist와 표시 보완 | 사용자 자신의 새 유형을 최근 예약에서 다시 시작 | 기존 바로가기 목록에 자기 예약 한 항목이 추가될 수 있음 |
| 관리자 좌석·날짜·시간 수정 추가 | 승인된 관리자 수정 요구를 기존 소유자 검증 PATCH에 연결 | 좁은 수정 화면이 추가되며 다른 사용자 예약 수정 권한은 관리자에게만 허용 |
| 기존 취소 API에 활성 디지털실 예약 허용 | 수업 충돌 해결에 필요한 `admin_cancelled`만 추가; 종료 예약 보호 | 작은 상태 허용 변경이며 지원하지 않는 완료 동작은 노출하지 않음 |
| 배포 후 현재 브랜치·checkout 보존 | 직접 웹 배포는 승인됐고 공유 main push는 별도 자동 승인 검토에서 거절됨 | 원격 소스 병합·push는 완료하지 않으며 별도 사용자 결정 필요 |

이 표는 작업 기록의 `Ruling:` 판단을 시간순으로 보존한다. 24시간·2시간 단위는 사용자 확정 요구이며, 이전 앱의 표시 제한과 별도 배포 범위는 위 호환성 절에 명시했다.

## 최종 검토와 검증 범위

여섯 작업별 검토와 전체 변경 `78abedd..30d6886` 검토가 승인됐다. 마지막 검토에서 Critical·Important 결함은 없었으며 추가 수정 없이 단계적 웹 배포를 진행했다. 알려진 구버전 표시 제한과 기존 경고는 위에 명시했다.

최종 검토에서 제외한 범위도 유지한다: 네이티브 빌드·서명·스토어·실기기, 제공되지 않은 실제 좌석 배치도와 물리 점유 센서, 그룹별 차단·고장 관리·별도 반출입·새 보고서 의무, 외부 Slack 실전송·기기 알림 수신이다. 앞 항목들은 이번 구현의 비목표이고 외부 알림은 전송 없이 내용만 검증하라는 조건이다. 이 판단의 제한은 해당 기능 또는 실전달을 완료·검증했다고 주장하지 않는 것이다.

## 운영 배포 기록

배포한 소스 커밋은 **`30d688634b479d8e8496cfabb9242755e95b1e41`**이다. 이후 QA 기록만 커밋하므로 현재 저장소 HEAD와 배포 소스 커밋은 다를 수 있다. 공개 사이트는 [gjureserve.co.kr](https://gjureserve.co.kr/)이다.

| 단계 | 실제 결과 |
|---|---|
| 비활성 Worker | 버전 `f9bf5d11-8db6-4c13-b6d8-90fa74205214`; 배포 `ba7b3ee8-986d-48be-894d-6749df90a090`; 2026-11-10 22:45:11 KST. bootstrap에서 비활성 확인 |
| Pages 운영 배포 | `874df914-3542-4391-94a2-76975defc0df`; [배포 주소](https://874df914.gju-reserve.pages.dev); source `30d6886`, Production. 빌드 22:46:09 KST, 운영 반영 확인 22:46:54 KST |
| 활성화 Worker | 버전 `85b69980-d740-42ba-bfde-0660798d3103`; 배포 `9f137fa5-73da-4bdc-a1a2-189b650000f7`; 22:48:25 KST, 트래픽 100% |
| 일회성 활성화 값 | `DIGITAL_LAB_ACTIVATION_AT=2026-11-10T13:48:00.000Z` |
| 최종 운영 확인 | 22:49:14 KST부터 Worker·대표 도메인 모두 `digitalLabEnabled=true`, `digitalLabOpenTime=00:00`, `digitalLabCloseTime=24:00` 확인 |

`npm run deploy -- --keep-vars` → `npm run pages:deploy -- --branch main --commit-dirty=true` → 활성화 변수를 명시한 동일 소스의 Wrangler deploy 순서로 실행했다. Pages의 `main`은 운영 배포 대상이며 GitHub main에 push한 것이 아니다.

각 호스트에서 `scripts/check-production-deploy.mjs --manifest`가 종료 코드 0으로 통과했다. **Pages 42개·Worker 42개 공개 자산 모두 SHA-256이 로컬 빌드와 일치**하며 manifest와 `/api/version` 커밋도 일치한다. 앱 모듈 버전은 `20261110-digital-lab-r1`이다. 실제 브라우저에서 운영 로그인 화면이 렌더링됐다. 기존에 열어둔 웹 화면은 새로고침하여 새 번들을 읽어야 한다.

활성화 전후 공개 설정을 배포 전 스냅샷과 비교해 기존 42개 키가 모두 동일함을 확인했다. 기존 `EQUIPMENT_OVERDUE_ACTIVATION_AT=2026-10-12T04:17:07.000Z`, 시크릿 3개의 이름/바인딩, ASSETS·GJU_RESERVE_DB, migration `v1`, compatibility `2026-06-12`/`nodejs_compat`, cron 두 개를 유지했다. 시크릿 값은 읽거나 출력하지 않았다.

운영 좌석 조회 API는 비인증 요청에서 두 호스트 모두 401을 반환했다. **운영 로그인 세션이 없어 실제 인증된 좌석 목록 조회는 미실행**이며, 좌석 목록·예약·취소·수업 차단은 위 격리 환경 검증 결과로 구분한다. 운영 시험 예약·계정은 생성하지 않았다. 기존 배포 점검의 비인증 계정 삭제 요청은 401 차단만 확인했고 데이터 변경은 없었다. 네이티브 패키지와 GitHub push도 수행하지 않았다.

[기계 판독 가능한 운영 검증 기록](assets/2026-11-10-digital-lab/production-verification.json)에 두 단계의 설정·버전, 배포 ID와 보존된 바인딩 정보를 저장했다. 복구 참조는 이전 Worker 버전 `4b2780c0-7783-4a7e-816c-0ddd560b4f8e`와 이전 Pages 배포 `0962b4bf`이다. 배포만 되돌리거나 활성화 변수를 제거해도 이미 저장된 활성화 marker/설정이 자동 취소되지는 않으며, 운영 중단은 정상 관리자 설정으로 처리한다.
