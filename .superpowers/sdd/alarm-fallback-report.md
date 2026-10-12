# 2026-10-12 기자재 자동 경고 Alarm 보조 실행

기존 Cron과 데이터 정리 작업을 유지하고 Durable Object `alarm()`을 60초 간격의 보조 실행으로 추가했다. 성공한 DB API 요청은 활성 설정 또는 아직 적용되지 않은 유효하고 도래한 배포 활성 시각에 한해 미등록 Alarm을 등록한다. 요청마다 기존 예약을 뒤로 미루지 않는다. 생성자와 공개 HTTP 경로에서 Alarm을 실행하지 않는다.

Alarm, Cron, 일반 요청은 같은 mutation queue를 사용한다. 첫 활성화 시각은 서버 현재 시각으로 기록하며 동일한 도메인 함수와 SQLite 원자 저장을 사용한다. 비활성 설정은 Alarm을 삭제한다. SQL 실패 시 캐시를 폐기하고 예외를 전달하며 다음 Alarm을 등록하여 플랫폼 최대 재시도 이후에도 후속 실행을 유지한다. 이미 성공한 API 작업의 Alarm 등록 실패는 응답을 바꾸지 않고 구조화 로그를 남긴다.

검증: 실제 Worker를 esbuild로 묶고 `cloudflare:workers` 기반 클래스만 대체했다. Node `DatabaseSync`의 실제 SQLite에서 기존 마이그레이션/스토어 SQL을 실행했다. 첫 성공 API가 Alarm을 등록하지 않는 기존 코드에서 RED 확인 후 구현했고 `npm run test:equipment-overdue`, `npm run check`가 PASS했다. API 등록, 기존 Alarm 유지, 첫 활성화, 객체 재생성, 관리자 중지, SQL 트랜잭션 실패/캐시 폐기/다음 Alarm 유지, 동시 Cron+Alarm의 경고 1개/경고 수 1회 증가 및 예약/다른 사용자 보존, Alarm 저장 실패 시 API 200을 검증했다.

운영: 배포 후 성공한 `/api/bootstrap` 등의 DB API 호출로 최초 Alarm을 등록한다. `equipment_overdue_alarm_completed`, `equipment_overdue_alarm_failed`, `equipment_overdue_alarm_arm_failed` 로그와 관리자 점검 상태의 `lastSuccessAt`을 확인한다. 관리자 자동 경고 중지는 후속 Alarm을 제거한다. React/public/native 파일은 변경하지 않았다.

제한: 로컬 테스트는 플랫폼 Alarm 시각 전달/eviction/재시도 자체를 재현하지 않는다. 배포 및 실환경 1분 후 자동 실행 증거는 별도 확인해야 한다. 플랫폼 Alarm 저장 자체가 계속 실패하면 재시도/후속 성공 API로 복구가 필요하다. 참고: https://developers.cloudflare.com/durable-objects/api/alarms/

추가 검증: 최초 활성화 이전 관리자가 명시적으로 중지한 경우 기존 코드에서 Alarm이 남는 RED를 확인했다. 인증된 설정 PATCH의 동일 저장 트랜잭션에서 미적용 activation marker를 기록하도록 수정한 후 GREEN을 확인했다. 객체 재생성/API/Alarm 이후에도 비활성 상태와 빈 최초 활성 시각을 보존하며, 이미 존재하는 marker는 덮어쓰지 않는다.
