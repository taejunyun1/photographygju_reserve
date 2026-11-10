import React from "react";

import { GjuCard, GjuEmptyState, GjuIconButton } from "../../design-system";
import {
  adminSettings,
  blockedSchedules
} from "../../platform/adminActions";
import type { AdminBlockedSchedule, AdminBlockedScheduleConflict, LegacyState, ReactAdminActions } from "../../platform/types";
import { digitalLabSeatLabel } from "../../student/availability";
import {
  checkedValue,
  fieldValue,
  formatDateTime,
  normalizedQuery,
  property,
  runAdminAction,
  searchText,
  stopSubmit
} from "./adminScreenUtils";

type AdminSettingsProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

export type BlockDraft = {
  type: string;
  day: string;
  from: string;
  to: string;
  start: string;
  end: string;
  target: string;
};

const WEEKDAYS = [
  ["sunday", "일"],
  ["monday", "월"],
  ["tuesday", "화"],
  ["wednesday", "수"],
  ["thursday", "목"],
  ["friday", "금"],
  ["saturday", "토"]
] as const;

const TYPE_LABEL: Record<string, string> = {
  studio: "스튜디오",
  darkroom: "암실",
  equipment: "기자재",
  print: "출력실",
  digital_lab: "디지털사진영상실"
};

const LAB_SLOT_BOUNDARIES = Array.from({ length: 13 }, (_, index) => `${String(index * 2).padStart(2, "0")}:00`);
const LAB_CLASS_TIME_PATTERN = "(?:[01][0-9]|2[0-3]):[0-5][0-9]";

function blockedScheduleLabel(item: AdminBlockedSchedule) {
  return item.type === "digital_lab" ? `${item.target || "수업"} · 16석 전체 차단` : item.target || "운영 차단";
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return dateKey(date).slice(0, 7);
}

function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" }).format(new Date(year, month - 1, 1));
}

function blockedItemsForDate(items: AdminBlockedSchedule[], key: string) {
  const day = new Date(`${key}T00:00:00`).getDay();
  return items.filter((item) => {
    const weekday = WEEKDAYS.findIndex(([value]) => value === item.day);
    if (weekday !== day) return false;
    if (item.from && key < item.from) return false;
    if (item.to && key > item.to) return false;
    return true;
  });
}

function defaultDraft(): BlockDraft {
  return {
    type: "studio",
    day: "monday",
    from: "",
    to: "",
    start: "10:30",
    end: "17:00",
    target: ""
  };
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function settingsPayload(form: HTMLFormElement) {
  return {
    printBankAccount: fieldValue(form, "printBankAccount"),
    googleDriveUrl: fieldValue(form, "googleDriveUrl"),
    darkroomCapacity: Number(fieldValue(form, "darkroomCapacity") || 6),
    digitalLabEnabled: checkedValue(form, "digitalLabEnabled"),
    digitalLabOpenTime: fieldValue(form, "digitalLabOpenTime"),
    digitalLabCloseTime: fieldValue(form, "digitalLabCloseTime"),
    studioReportDeadlineHours: Number(fieldValue(form, "studioReportDeadlineHours") || 48),
    equipmentReportDeadlineHours: Number(fieldValue(form, "equipmentReportDeadlineHours") || 48),
    printAvailableStart: fieldValue(form, "printAvailableStart"),
    printAvailableEnd: fieldValue(form, "printAvailableEnd"),
    printUploadStartDate: fieldValue(form, "printUploadStartDate"),
    printUploadEndDate: fieldValue(form, "printUploadEndDate"),
    equipmentHighValueCategories: splitList(fieldValue(form, "equipmentHighValueCategories")),
    equipmentBagKeywords: splitList(fieldValue(form, "equipmentBagKeywords")),
    equipmentCameraBagNotice: fieldValue(form, "equipmentCameraBagNotice"),
    vacationMode: checkedValue(form, "vacationMode")
  };
}

function blockMatches(item: AdminBlockedSchedule, query: string) {
  if (!query) return true;
  return searchText(
    TYPE_LABEL[String(item.type || "")] || item.type,
    WEEKDAYS.find(([value]) => value === item.day)?.[1],
    item.from,
    item.to,
    item.start,
    item.end,
    item.target
  ).includes(query);
}

function removeBlockedSchedule(
  state: LegacyState,
  actions: ReactAdminActions,
  item: AdminBlockedSchedule
) {
  const schedules = blockedSchedules(state).filter((entry) => entry.id !== item.id);
  runAdminAction(() => actions.saveBlockedSchedules(schedules));
}

function renderCalendar(
  month: string,
  schedules: AdminBlockedSchedule[],
  selectedDate: string,
  onMonth: (month: string) => void,
  onDate: (key: string) => void
) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = dateKey(day);
    return {
      key,
      date: day.getDate(),
      currentMonth: day.getMonth() === monthNumber - 1,
      blocked: blockedItemsForDate(schedules, key)
    };
  });
  const selectedLabClasses = days.find((day) => day.key === selectedDate)?.blocked.filter((item) => item.type === "digital_lab") || [];

  return (
    <section className="calendar-card admin-settings-calendar" aria-label="학기 차단 캘린더">
      <div className="calendar-head">
        <div>
          <p className="eyebrow">학기 차단 캘린더</p>
          <h2>{monthTitle(month)}</h2>
        </div>
        <div className="row-actions calendar-month-actions">
          <GjuIconButton label="이전 달" icon="chevronLeft" onClick={() => onMonth(addMonths(month, -1))} />
          <GjuIconButton label="오늘" icon="calendar" onClick={() => onMonth(dateKey(new Date()).slice(0, 7))} />
          <GjuIconButton label="다음 달" icon="chevronRight" onClick={() => onMonth(addMonths(month, 1))} />
        </div>
      </div>
      <div className="calendar-weekdays">
        {WEEKDAYS.map(([, label]) => <span key={label}>{label}</span>)}
      </div>
      <div className="calendar-grid-large">
        {days.map((day) => (
          <button
            key={day.key}
            className={`calendar-day ${day.currentMonth ? "" : "outside"} ${day.blocked.length ? "blocked" : ""}`}
            type="button"
            aria-label={`${day.key} 차단 일정 입력`}
            aria-pressed={day.key === selectedDate}
            onClick={() => onDate(day.key)}
          >
            <span>{day.date}</span>
            {day.blocked.slice(0, 2).map((item) => (
              <small key={`${item.id || item.target}:${item.start}:${item.end}`}>
                {item.type === "digital_lab" ? blockedScheduleLabel(item) : TYPE_LABEL[String(item.type || "")] || item.type} {item.start}-{item.end}
              </small>
            ))}
          </button>
        ))}
      </div>
      {selectedLabClasses.length > 0 && (
        <section className="admin-react-card-list" aria-label="선택 날짜 디지털사진영상실 수업">
          <strong>{selectedDate} 디지털사진영상실 수업</strong>
          {selectedLabClasses.map((item) => (
            <p className="admin-react-body-text" key={item.id}>
              {item.start}–{item.end} · {blockedScheduleLabel(item)}
            </p>
          ))}
        </section>
      )}
    </section>
  );
}

function SettingsDisclosure({
  title,
  description,
  children,
  danger = false
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <details className="admin-settings-disclosure" data-tone={danger ? "danger" : "neutral"}>
      <summary>
        <span>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
      </summary>
      <div className="admin-settings-disclosure__body">{children}</div>
    </details>
  );
}

function ReportDrivePanel({ state, actions }: AdminSettingsProps) {
  const drive = (state.reportDrive || {}) as { connection?: { status?: string; accountEmail?: string; folderName?: string; folderUrl?: string; lastVerifiedAt?: string | null; errorCode?: string | null }; pending?: number; failed?: number };
  const connection = drive.connection || {};
  const connected = connection.status === "connected";
  return <section className="admin-report-drive-panel">
    <div className="section-heading"><div><p className="eyebrow">보고서 저장소</p><h3>Google Drive 연결</h3></div><span className="tag blue">스튜디오 · 기자재</span></div>
    <div className="property-list">
      {property("상태", connected ? "연결됨" : connection.status === "reauth_required" ? "재연결 필요" : "연결 안 됨")}
      {property("연결 계정", connection.accountEmail || "-")}
      {property("저장 폴더", connection.folderName || "GJU 사용보고서")}
      {property("대기 / 실패", `${Number(drive.pending || 0)}건 / ${Number(drive.failed || 0)}건`)}
      {property("마지막 확인", connection.lastVerifiedAt ? formatDateTime(connection.lastVerifiedAt) : "확인 전")}
    </div>
    {connection.folderUrl ? <p><a href={connection.folderUrl} target="_blank" rel="noreferrer">드라이브에서 보고서 폴더 열기</a></p> : null}
    {connection.errorCode ? <p className="muted warning-text">저장 상태: {connection.errorCode}</p> : null}
    <div className="button-row">
      {connected ? <button className="button" type="button" onClick={() => runAdminAction(actions.verifyReportDrive)}>연결 확인</button> : null}
      <button className="button primary" type="button" onClick={() => runAdminAction(actions.connectReportDrive)}>{connected ? "다른 계정으로 재연결" : "Google Drive 연결"}</button>
      {connected ? <button className="button danger" type="button" onClick={() => runAdminAction(actions.disconnectReportDrive)}>연결 해제</button> : null}
    </div>
    <p className="muted">관리자 계정만 연결하며, 학생에게 Google 로그인이나 폴더 공유 권한을 요구하지 않습니다.</p>
  </section>;
}

export function AdminSettings({
  state,
  actions,
  rejectedLabDraft,
  retainLabDraft
}: AdminSettingsProps & {
  rejectedLabDraft?: BlockDraft;
  retainLabDraft: (draft: BlockDraft | null) => void;
}) {
  const settings = adminSettings(state);
  const schedules = blockedSchedules(state);
  const [month, setMonth] = React.useState(() => (rejectedLabDraft?.from || dateKey(new Date())).slice(0, 7));
  const [calendarDate, setCalendarDate] = React.useState(rejectedLabDraft?.from || "");
  const [draft, setDraft] = React.useState<BlockDraft>(() => rejectedLabDraft || defaultDraft());
  const [conflicts, setConflicts] = React.useState<AdminBlockedScheduleConflict[]>([]);
  const [savingBlock, setSavingBlock] = React.useState(false);
  const labClass = draft.type === "digital_lab";
  const startDateRef = React.useRef<HTMLInputElement>(null);
  const query = normalizedQuery(state.adminBlockedScheduleSearch);
  const filteredSchedules = schedules.filter((item) => blockMatches(item, query));

  React.useEffect(() => {
    void actions.loadReportDrive().catch(() => null);
  }, [actions]);

  const clearConflict = () => {
    setConflicts([]);
    retainLabDraft(null);
  };

  const onCalendarDate = (key: string) => {
    const date = new Date(`${key}T00:00:00`);
    setCalendarDate(key);
    clearConflict();
    setDraft((current) => ({
      ...current,
      from: key,
      to: key,
      day: WEEKDAYS[date.getDay()][0]
    }));
    window.setTimeout(() => startDateRef.current?.focus(), 0);
  };

  const submitSettings = stopSubmit((form) => {
    runAdminAction(() => actions.saveSettings(settingsPayload(form)));
  });

  const submitBlockedSchedule = stopSubmit(async (form) => {
    const next = [
      ...schedules,
      {
        id: `block_${Date.now()}`,
        type: fieldValue(form, "type"),
        day: fieldValue(form, "day"),
        from: fieldValue(form, "from"),
        to: fieldValue(form, "to"),
        start: fieldValue(form, "start"),
        end: fieldValue(form, "end"),
        target: fieldValue(form, "target")
      }
    ];
    setConflicts([]);
    setSavingBlock(true);
    try {
      await actions.saveBlockedSchedules(next);
      setDraft(defaultDraft());
      retainLabDraft(null);
    } catch (error) {
      const response = error as { status?: number; conflicts?: AdminBlockedScheduleConflict[] } | null;
      if (response?.status === 409 && Array.isArray(response.conflicts)) setConflicts(response.conflicts);
    } finally {
      setSavingBlock(false);
    }
  });

  const submitBlockedSearch = stopSubmit((form) => {
    void actions.setAdminFilters("settings", { blockedQuery: String(new FormData(form).get("q") || "") });
  });

  return (
    <section className="grid admin-react-screen admin-settings-react-screen">
      {renderCalendar(month, schedules, calendarDate, setMonth, onCalendarDate)}
      <GjuCard title="수업/학기 차단 일정">
        <form className="admin-react-form-grid" onSubmit={submitBlockedSchedule} onChange={clearConflict}>
          <label>
            시설
            <select className="select" name="type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.currentTarget.value })}>
              <option value="studio">스튜디오</option>
              <option value="darkroom">암실</option>
              <option value="equipment">기자재</option>
              <option value="print">출력실</option>
              <option value="digital_lab">{TYPE_LABEL.digital_lab}</option>
            </select>
          </label>
          <label>
            요일
            <select className="select" name="day" value={draft.day} onChange={(event) => setDraft({ ...draft, day: event.currentTarget.value })}>
              {WEEKDAYS.map(([value, label]) => <option key={value} value={value}>{label}요일</option>)}
            </select>
          </label>
          <label>
            시작일
            <input
              ref={startDateRef}
              className="input"
              name="from"
              type="date"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.currentTarget.value })}
              required
            />
          </label>
          <label>
            종료일
            <input
              className="input"
              name="to"
              type="date"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.currentTarget.value })}
              required
            />
          </label>
          <label>
            시작 시간
            <input className="input" name="start" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.currentTarget.value })} pattern={labClass ? LAB_CLASS_TIME_PATTERN : undefined} required />
          </label>
          <label>
            종료 시간
            <input className="input" name="end" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.currentTarget.value })} pattern={labClass ? `${LAB_CLASS_TIME_PATTERN}|24:00` : undefined} required />
          </label>
          <label className="admin-react-form-wide">
            {labClass ? "수업명" : "공간/메모"}
            <input
              className="input"
              name="target"
              value={draft.target}
              onChange={(event) => setDraft({ ...draft, target: event.currentTarget.value })}
              placeholder={labClass ? "예: 디지털 사진 편집" : "Studio A,B / 수업명"}
            />
          </label>
          <button className="button primary admin-react-form-wide" type="submit" disabled={savingBlock}>
            차단 일정 추가
          </button>
        </form>
        {conflicts.length > 0 && (
          <section className="admin-react-card-list" aria-label="차단 일정과 겹치는 예약">
            <p role="alert">차단 일정과 겹치는 예약이 있습니다. 기존 예약을 수정하거나 취소한 뒤 다시 저장하세요.</p>
            {conflicts.map((item) => (
              <article key={item.reservationId} className="admin-react-list-card">
                <p>{item.reservedDate} · {digitalLabSeatLabel(item.seatId) || item.seatId} · {item.startTime}–{item.endTime}</p>
                <button className="button compact" type="button" onClick={() => {
                  retainLabDraft(draft);
                  runAdminAction(() => actions.setAdminView("reservations", { q: item.reservationId, page: 1 }));
                }}>
                  예약 상세
                </button>
              </article>
            ))}
          </section>
        )}
        <form className="list-control-panel compact admin-react-toolbar" onSubmit={submitBlockedSearch}>
          <label>
            <span className="sr-only">차단 일정 검색</span>
            <input
              className="input"
              name="q"
              defaultValue={String(state.adminBlockedScheduleSearch || "")}
              placeholder="시설·요일·시간·공간 검색"
            />
          </label>
          <button className="button compact" type="submit">
            검색
          </button>
        </form>
        <div className="admin-react-card-list blocked-list">
          {filteredSchedules.length ? filteredSchedules.map((item) => (
            <article key={item.id || `${item.type}:${item.day}:${item.from}:${item.start}`} className="admin-react-list-card blocked-item">
              <div className="reservation-card-head">
                <div>
                  <strong>{WEEKDAYS.find(([value]) => value === item.day)?.[1] || item.day}요일 {item.start}-{item.end}</strong>
                  <span>{item.from || "-"} ~ {item.to || "-"}</span>
                </div>
                <span className="tag blue">{TYPE_LABEL[String(item.type || "")] || item.type || "-"}</span>
              </div>
              <p className="admin-react-body-text">{blockedScheduleLabel(item)}</p>
              <GjuIconButton
                label="차단 일정 삭제"
                icon="trash"
                tone="danger"
                onClick={() => removeBlockedSchedule(state, actions, item)}
              />
            </article>
          )) : <GjuEmptyState title="등록된 차단 일정이 없습니다." message="캘린더 날짜를 눌러 일정을 빠르게 입력하세요." />}
        </div>
      </GjuCard>
      <SettingsDisclosure title="운영 설정" description="운영값·출력·기자재 규칙">
        <ReportDrivePanel state={state} actions={actions} />
        <form className="admin-react-form-grid" onSubmit={submitSettings}>
          <label className="admin-react-form-wide">
            출력비 계좌 안내
            <input className="input" name="printBankAccount" defaultValue={String(settings.printBankAccount || "")} />
          </label>
          <label className="admin-react-form-wide">
            출력실 구글 드라이브 URL
            <input className="input" name="googleDriveUrl" type="url" defaultValue={String(settings.googleDriveUrl || "")} />
          </label>
          <label>
            암실 최대 인원
            <input className="input" name="darkroomCapacity" type="number" min="1" defaultValue={String(settings.darkroomCapacity || 6)} />
          </label>
          <label className="admin-react-check admin-react-form-wide">
            <input name="digitalLabEnabled" type="checkbox" defaultChecked={settings.digitalLabEnabled === true} />
            디지털사진영상실 예약 활성화
          </label>
          <label>
            디지털사진영상실 운영 시작
            <select className="select" name="digitalLabOpenTime" defaultValue={settings.digitalLabOpenTime || ""}>
              <option value="">미설정</option>
              {LAB_SLOT_BOUNDARIES.slice(0, -1).map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
          </label>
          <label>
            디지털사진영상실 운영 종료
            <select className="select" name="digitalLabCloseTime" defaultValue={settings.digitalLabCloseTime || ""}>
              <option value="">미설정</option>
              {LAB_SLOT_BOUNDARIES.slice(1).map((time) => <option key={time} value={time}>{time}</option>)}
            </select>
          </label>
          <label>
            스튜디오 보고서 제출 기한
            <input className="input" name="studioReportDeadlineHours" type="number" min="1" max="720" defaultValue={String(settings.studioReportDeadlineHours || 48)} />
          </label>
          <label>
            기자재 보고서 제출 기한
            <input className="input" name="equipmentReportDeadlineHours" type="number" min="1" max="720" defaultValue={String(settings.equipmentReportDeadlineHours || 48)} />
          </label>
          <label>
            출력실 시작
            <input className="input" name="printAvailableStart" defaultValue={String(settings.printAvailableStart || "")} />
          </label>
          <label>
            출력실 종료
            <input className="input" name="printAvailableEnd" defaultValue={String(settings.printAvailableEnd || "")} />
          </label>
          <label>
            출력 업로드 시작일
            <input className="input" name="printUploadStartDate" type="date" defaultValue={String(settings.printUploadStartDate || "")} />
          </label>
          <label>
            출력 업로드 종료일
            <input className="input" name="printUploadEndDate" type="date" defaultValue={String(settings.printUploadEndDate || "")} />
          </label>
          <label className="admin-react-form-wide">
            고가장비 카테고리
            <input className="input" name="equipmentHighValueCategories" defaultValue={(settings.equipmentHighValueCategories as string[] || ["Body", "Lens"]).join(", ")} />
          </label>
          <label className="admin-react-form-wide">
            카메라 가방 키워드
            <input className="input" name="equipmentBagKeywords" defaultValue={(settings.equipmentBagKeywords as string[] || ["펠리컨", "Pelican"]).join(", ")} />
          </label>
          <label className="admin-react-form-wide">
            카메라 가방 확인 문구
            <input className="input" name="equipmentCameraBagNotice" defaultValue={String(settings.equipmentCameraBagNotice || "고가장비(카메라)를 선택 시 카메라 가방을 지참하겠습니다")} />
          </label>
          <label className="admin-react-check admin-react-form-wide">
            <input name="vacationMode" type="checkbox" defaultChecked={settings.vacationMode === true} />
            방학 모드
          </label>
          <button className="button primary admin-react-form-wide" type="submit">
            설정 저장
          </button>
        </form>
      </SettingsDisclosure>
      <SettingsDisclosure title="Slack" description="서버 알림 연결 안내">
        <p className="muted">Webhook URL은 코드가 아니라 서버 환경변수 SLACK_WEBHOOK_URL에 저장합니다.</p>
      </SettingsDisclosure>
      <SettingsDisclosure title="운영 알림" description="권한·예정 알림·동기화">
        <dl className="property-list">
          {property("지원", state.nativeNotifications?.supported ? "지원됨" : "앱에서 사용 가능")}
          {property("권한", ({
            granted: "허용됨",
            denied: "거부됨",
            prompt: "허용 필요",
            unavailable: "플러그인 없음",
            web: "웹 미지원"
          } as Record<string, string>)[String(state.nativeNotifications?.permission || "")] || state.nativeNotifications?.permission || "확인 중")}
          {property("상태", state.nativeNotifications?.enabled ? "켜짐" : "꺼짐")}
          {property("예정 알림", `${Number(state.nativeNotifications?.pendingCount || 0)}개`)}
          {property("마지막 동기화", state.nativeNotifications?.syncedAt ? formatDateTime(state.nativeNotifications.syncedAt) : "동기화 전")}
        </dl>
        {state.nativeNotifications?.error ? <p className="muted warning-text">{state.nativeNotifications.error}</p> : null}
        {state.nativeNotifications?.supported ? (
          <div className="button-row">
            {state.nativeNotifications.enabled ? (
              <>
                <button className="button" type="button" onClick={() => runAdminAction(actions.syncNativeNotifications)}>동기화</button>
                <button className="button ghost" type="button" onClick={() => runAdminAction(actions.disableNativeNotifications)}>알림 끄기</button>
              </>
            ) : (
              <button className="button primary" type="button" onClick={() => runAdminAction(actions.enableNativeNotifications)}>알림 켜기</button>
            )}
          </div>
        ) : null}
      </SettingsDisclosure>
      <SettingsDisclosure title="보안 / 데이터 관리" description="백업·보관정책·학기 종료" danger>
        <p className="muted">보관정책 정리는 오래된 예약 개인정보를 익명화하고 만료된 보고서 HTML과 세션을 삭제합니다.</p>
        <p className="muted">
          <strong>학기 종료 데이터 정리</strong>는 모든 예약과 연결된 보고서, 모든 로그인 세션을 삭제하며 완료 후 즉시 로그아웃됩니다.
        </p>
        <div className="button-row">
          <button className="button" type="button" onClick={() => runAdminAction(actions.downloadAdminBackup)}>
            백업 JSON
          </button>
          <button className="button danger" type="button" onClick={() => runAdminAction(actions.cleanupAdminData)}>
            보관정책 정리
          </button>
          <button className="button danger" type="button" onClick={() => runAdminAction(actions.closeSemester)}>
            학기 종료 데이터 정리
          </button>
        </div>
      </SettingsDisclosure>
    </section>
  );
}
