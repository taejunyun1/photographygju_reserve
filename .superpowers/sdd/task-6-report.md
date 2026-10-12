# Task 6 관리자 반납·경고 확인 구현

2026-10-12. 실행 계획 Task 6 범위 구현 및 부모 요청의 기존 학생 최종 제출 연결 보완.

## 변경
- 반납 점검: 실제 반납 Asia/Seoul 입력, 현재 처리 시각과 예정 반납 표시, 명시적인 지금 반납 입력, 확인 사유, 시간 유효성 및 점검 결과별 메모 검증. UTC ISO와 returnTimeNote 전달.
- 사용자: 유효 경고 count와 pending_review/confirmed/cleared 라벨. 사용자별 전체 경고 GET 페이지 조회, 장비 ID·예약·기한·실제 시각·관리자·사유 표시, 미반납 예약 점검 이동, 이미 반납한 자동 경고 개별 심사.
- 이미 반납한 예약: actualReturnedAt 정정과 필수 사유를 별도 API에 전달. 판정 상태는 서버가 계산.
- 대시보드: equipmentOverdueStatus 실패/비활성/첫 실행 대기/최근 성공 표시, 미반납 목록 이동, 기존 settings PATCH를 사용하는 자동 경고 활성화/중지 버튼. 인계 지연/확정 경고 종류가 공급되면 각각 예약/학생 화면 연결.
- legacy: 직접 returned 상태 요청은 최신 반납 점검 안내로 차단. 수동 메모만 초기화 문구, 상태 라벨/해제 제외 count 반영.
- 부모 요청: legacy 기자재 최종 제출이 전체 일정 fields를 전달.409 시 bootstrap만 갱신하고 입력/장비 선택을 초기화하지 않는다.

## 검증
- npm run check:react-admin 통과 (TypeScript, bundle dry-run, SSR render).
- npm run test:react-admin 통과 (계약 및 브리지).
- npm run test:admin-ui 통과.
- 브리지: 최근 3건 밖의 페이지·total·해제 기록 유지, URL ID 인코딩, 반납 UTC/time note 전달, 심사 요청에 임의 status 없음 검증 추가.
- Playwright desktop-1440 반납 점검 + 경고 archive 2/2 통과.
- Playwright mobile-390 반납 점검 + 경고 archive 2/2 통과.
- browser API 응답은 {ok:true,data} 실제 봉투 사용. 반납 입력 두 필드 없으면 제출 불가, 수리메모와 시간이 함께 충족될 때 제출; 전체 기록 다음 페이지에 오래된 해제 기록 및 사유 보존 검증.

## 남은 통합 확인
- 서버는 returnTimeNote 계약을 받아야 한다. 기존 서버가 reason/note만 참조하는 부분을 발견하여 부모에게 수정 요청 전달.
- equipmentOverdueStatus 요약과 인계/확정 경고 데이터가 서버에서 공급되어야 dashboard 정보가 표시된다.
- 장비 표시는 warning API의 equipmentIds이며 코드 매핑이 공급되면 별도 풍부화 가능.
- 구형 legacy 화면은 새로운 전체 심사 인터랙션을 제공하지 않고 최신 관리자 화면으로 안내한다. React 관리자 화면에서 심사 가능.
- UI fixture 브라우저 검증과 도메인/backend 검증은 구분. 외부 배포는 수행하지 않음.
