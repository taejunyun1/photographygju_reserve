# 디지털사진영상실 기본 좌석판 제거

최신 사용자 정정: 메인에 기본으로 펼쳐진 좌석판을 제거한다. 이전 메인 현황판 계획의 상시 표시는 이 요구로 대체한다.

- 기본 메인은 복도 평면도와 공간 요약을 표시한다. 스튜디오 B 왼쪽 디지털실6번 위치는 유지한다.
- 디지털실을 선택하면 기존 상세 안에 Mac12·PC4 좌석 현황, 예약 내역, 예약 시간 선택을 표시한다. 닫기·재선택·다른 방 선택 시 좌석판도 함께 사라진다.
- 항상 표시하던 패널 및 전용 액션/CSS를 삭제했다. 수업·비활성·권한 조건과 실제 예약 화면은 기존 동작을 사용한다.
- React JS/CSS 네 개의 URL은 `release=20261111-lab-detail-r1`로 갱신했다.

## 검증

- 초기 좌석판 없음 검사: 수정 전SSR에서 실패, 수정 후 통과.
- `npm run check:react-admin`, `check-pre-release.mjs`, `digital-lab-cache-test.mjs`, `git diff --check` 통과.
- `facility-board-render-test.mjs` 통과: 선택 전 없음, 선택 후16석, 닫기, 지도·키보드, 수업 차단, 비활성, 학생/관리자 동작.
- 실제 격리 API의 홈 브라우저 검사 **4/4 통과(16.6초)**: 390·430·768·1440px 및 각 검사 내320·621·1000px. 지도·요약 선택, 닫기, 재선택, 다른 방 전환, 좌석 시간 경계, 날짜만 전달하는 예약 진입을 확인했다.
- 읽기 전용 검토 승인: actionable finding 없음. 모바일 기본/선택 및 데스크톱 기본 화면 확인.

이번 변경은 UI 표시 범위에 한정되어 직전 통과한 전체 좌석 예약59개 사례를 반복하지 않았다. 실제 기기 검사가 아니라 Chromium 브라우저 검사다.

## 화면

격리 테스트 데이터로 촬영한 실제 앱 화면이다.

- [모바일 기본 화면](assets/2026-11-11-digital-lab-selected-detail/default-mobile.png)
- [데스크톱 기본 화면](assets/2026-11-11-digital-lab-selected-detail/default-desktop.png)
- [모바일 선택 후 상세](assets/2026-11-11-digital-lab-selected-detail/selected-mobile.png)

## 배포

**2026-11-11 웹 배포 완료.** 배포 소스는 `c9632c14d127e24c60d3238004ada1269ad2561d`이며 이후 QA 전용 커밋은 구분한다.

| 항목 | 확인 결과 |
|---|---|
| Worker | 버전 `44e6f1bc-c337-44ca-9c4a-ee81577cddfa`, 배포 `aaba8054-dcf8-48d3-836a-653a1494e743`,13:06:21 KST,트래픽100% |
| Pages | Production `62ff68d8-f7eb-4991-8f3a-0980b24674d3`, [배포 주소](https://62ff68d8.gju-reserve.pages.dev),소스c9632c1 |
| 대표 도메인 | [gjureserve.co.kr](https://gjureserve.co.kr/),42개 공개 파일 SHA-256 및API/manifest 커밋 일치,배포 검사 종료0 |
| Worker 공개 검증 | 동일하게42개 파일 SHA-256 및API/manifest 커밋 일치,배포 검사 종료0 |
| React 캐시 | 두 주소의JS/CSS 네 개 URL 모두 `release=20261111-lab-detail-r1`;각 파일 해시 일치 및 기존 상시 좌석판 코드 제거 확인 |
| 운영 보존 | 배포 직전13:05:20 KST의 공개 설정45개와전체 deep equality 일치. 디지털실 활성·00:00–24:00,Worker runtime과7개 바인딩 유지 |

Worker는 `npm run deploy -- --keep-vars`, Pages는 `npm run pages:deploy -- --branch main --commit-dirty=true`로 게시했다. 시크릿 값은 읽거나 출력하지 않았다. [운영 검증 JSON](assets/2026-11-11-digital-lab-selected-detail/production-verification.json)에 배포 ID·React 파일 해시·운영 설정 보존을 기록했다.

운영 로그인 세션이 없어 인증된 운영 메인 조작은 미실행이다. 운영은 공개 배포 파일과API로, 인증된 화면 흐름은 격리 API/브라우저로 검증했다. 운영 시험 예약·계정 생성, 외부 메시지, 네이티브 빌드, GitHub push는 하지 않았다. 기존 배포 검사의 비인증 삭제 요청은401 인증 차단만 확인했다.
