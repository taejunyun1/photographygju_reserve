# 메인 디지털사진영상실 좌석 현황판 QA

사용자 확정: 메인에서 Mac 12석·PC 4석을 바로 보는 펼쳐진 현황판. 기존 요약 줄을 확장하고, 복도 도면과 예약 정책을 유지한다.

## 변경

- Mac 12석·PC 4석과 선택 구간의 예약 있음/없음·이용 제한을 기본으로 표시한다.
- 조회 날짜·시간에 따라 기존 현황 데이터를 사용한다. 수업·운영 제한 문구도 표시한다.
- 학생은 `좌석 예약`으로 기존 예약 화면에 진입한다. 선택 날짜만 전달하고 조회 시각(예:18:30)을 예약 시간으로 자동 채우지 않는다. 실제 시간·좌석은 기존 예약 과정에서 검증한다.
- `예약 내역` 버튼으로 기존 권한 범위의 상세를 연다. 펼쳐진 상세의 중복 좌석표를 제거했다. 관리자 화면에는 학생 예약 버튼을 노출하지 않는다.
- 변경된 React JS/CSS 4개의 HTML URL에 `release=20261111-lab-home-r1`을 적용했다. 변경 없는 기존 모듈의 v값 `20261110-digital-lab-r1`은 유지한다.
- 서버 판정·저장 구조·운영 설정·복도 좌표·큰 새 예약 버튼은 변경하지 않는다.

## 검증

| 검사 | 결과 |
|---|---|
| 새 메인 흐름 RED | 구현 전 실제 격리 API/브라우저에서 `디지털사진영상실 좌석 현황` 영역 없음으로 실패 |
| 새 메인 흐름 GREEN | 390·430·768·1440px 4/4 통과; 각 실행에서 320px도 검사 |
| 타입/React 렌더 | `npm run check:react-admin` 통과 |
| 기존 현황판 모델/Chromium | `node scripts/facility-board-render-test.mjs` 통과; 수업 구간 전환 시16석 제한, 관리자 CTA 미노출, 비활성 CTA 차단 포함 |
| 현황판·좌석 예약 UI 통합 | `playwright test tests/ui/facility-board.spec.mjs tests/ui/facility-board-mobile-layout.spec.mjs tests/ui/digital-lab.spec.mjs --workers=1`: **47 통과·12 조건부 제외,1.9분**, 종료0 |
| 캐시 연결·배포 사전 검사 | `node scripts/digital-lab-cache-test.mjs`, `node scripts/check-pre-release.mjs` 통과 |
| 코드 검토 | Critical·Important·Minor 지적 없음. 개인정보·예약 진입·반응형 CSS·범위 검토 승인 |

통합 검사의 제외12개는 공유 수업 설정을390px에서만 변경하는3개와 좁은 화면 전용 검사를 다른3개 폭에서 반복하지 않는9개다. Chromium 및 iOS WebKit 에뮬레이션으로 확인했으며 실기기 검증은 아니다. 별도 서버 도메인 전체 검사와 전체 release:check를 변경 없는 범위까지 다시 실행하지 않았다. 새로운 메인 진입은 실제 격리 서버의 예약을 만들어 시간 경계와 예약 화면 연결을 확인했다.

브라우저 스크린샷은 앱 내부 스크롤을 좌석판 위치로 옮겨 캡처했다. 기존 `outputs/`와 `.codex-audit/`는 변경하지 않았다.

## 화면

격리 테스트 데이터다. 390·430·768·1440px 이미지를 시각적으로 확인했고 모든 폭의 좌석 경계·문구·겹침을 자동 확인했다.

- [390px](assets/2026-11-11-digital-lab-home/mobile-390.png)
- [430px](assets/2026-11-11-digital-lab-home/mobile-430.png)
- [768px](assets/2026-11-11-digital-lab-home/tablet-768.png)
- [1440px](assets/2026-11-11-digital-lab-home/desktop-1440.png)

## 배포

운영 배포 대기. 배포 전 공개 설정45개와 기존 소스30d6886을 읽어 보존 비교 기준으로 확보했다. 운영 활성화는 true,00:00–24:00이다. 배포 후 자산 해시·API 버전·설정 비교 결과를 아래에 추가한다. 운영 시험 예약·계정 생성, GitHub push, 네이티브 빌드는 수행하지 않는다.
