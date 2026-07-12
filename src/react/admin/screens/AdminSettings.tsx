import React from "react";

import { GjuCard, GjuEmptyState } from "../../design-system";
import {
  adminSettings,
  blockedSchedules
} from "../../platform/adminActions";
import type { AdminBlockedSchedule, LegacyState, ReactAdminActions } from "../../platform/types";
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

type BlockDraft = {
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
  print: "출력실"
};

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
    studioReportDeadlineHours: Number(fieldValue(form, "studioReportDeadlineHours") || 48),
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

  return (
    <section className="calendar-card admin-settings-calendar" aria-label="학기 차단 캘린더">
      <div className="calendar-head">
        <div>
          <p className="eyebrow">학기 차단 캘린더</p>
          <h2>{monthTitle(month)}</h2>
        </div>
        <div className="row-actions calendar-month-actions">
          <button className="button compact" type="button" aria-label="이전 달" title="이전 달" onClick={() => onMonth(addMonths(month, -1))}>
            ‹
          </button>
          <button className="button compact" type="button" aria-label="오늘" title="오늘" onClick={() => onMonth(dateKey(new Date()).slice(0, 7))}>
            오늘
          </button>
          <button className="button compact" type="button" aria-label="다음 달" title="다음 달" onClick={() => onMonth(addMonths(month, 1))}>
            ›
          </button>
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
            onClick={() => onDate(day.key)}
          >
            <span>{day.date}</span>
            {day.blocked.slice(0, 2).map((item) => (
              <small key={`${item.id || item.target}:${item.start}:${item.end}`}>
                {TYPE_LABEL[String(item.type || "")] || item.type} {item.start}-{item.end}
              </small>
            ))}
          </button>
        ))}
      </div>
    </section>
  );
}

export function AdminSettings({ state, actions }: AdminSettingsProps) {
  const settings = adminSettings(state);
  const schedules = blockedSchedules(state);
  const [month, setMonth] = React.useState(dateKey(new Date()).slice(0, 7));
  const [draft, setDraft] = React.useState<BlockDraft>(defaultDraft);
  const startDateRef = React.useRef<HTMLInputElement>(null);
  const query = normalizedQuery(state.adminBlockedScheduleSearch);
  const filteredSchedules = schedules.filter((item) => blockMatches(item, query));

  const onCalendarDate = (key: string) => {
    const date = new Date(`${key}T00:00:00`);
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
    await actions.saveBlockedSchedules(next);
    setDraft(defaultDraft());
  });

  const submitBlockedSearch = stopSubmit((form) => {
    void actions.setAdminFilters("settings", { blockedQuery: String(new FormData(form).get("q") || "") });
  });

  return (
    <section className="grid admin-react-screen admin-settings-react-screen">
      {renderCalendar(month, schedules, setMonth, onCalendarDate)}
      <GjuCard title="수업/학기 차단 일정" eyebrow="React Admin">
        <form className="admin-react-form-grid" onSubmit={submitBlockedSchedule}>
          <label>
            시설
            <select className="select" name="type" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.currentTarget.value })}>
              <option value="studio">스튜디오</option>
              <option value="darkroom">암실</option>
              <option value="equipment">기자재</option>
              <option value="print">출력실</option>
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
            <input className="input" name="start" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.currentTarget.value })} required />
          </label>
          <label>
            종료 시간
            <input className="input" name="end" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.currentTarget.value })} required />
          </label>
          <label className="admin-react-form-wide">
            공간/메모
            <input
              className="input"
              name="target"
              value={draft.target}
              onChange={(event) => setDraft({ ...draft, target: event.currentTarget.value })}
              placeholder="Studio A,B / 수업명"
            />
          </label>
          <button className="button primary admin-react-form-wide" type="submit">
            차단 일정 추가
          </button>
        </form>
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
              <p className="admin-react-body-text">{item.target || "운영 차단"}</p>
              <button className="button danger compact" type="button" onClick={() => removeBlockedSchedule(state, actions, item)}>
                삭제
              </button>
            </article>
          )) : <GjuEmptyState title="등록된 차단 일정이 없습니다." message="캘린더 날짜를 눌러 일정을 빠르게 입력하세요." />}
        </div>
      </GjuCard>
      <GjuCard title="운영 설정" eyebrow="React Admin">
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
          <label>
            스튜디오 보고서 제출 기한
            <input className="input" name="studioReportDeadlineHours" type="number" min="1" max="720" defaultValue={String(settings.studioReportDeadlineHours || 48)} />
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
      </GjuCard>
      <GjuCard title="Slack" eyebrow="알림">
        <p className="muted">Webhook URL은 코드가 아니라 서버 환경변수 SLACK_WEBHOOK_URL에 저장합니다.</p>
      </GjuCard>
      <GjuCard title="운영 알림" eyebrow="네이티브">
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
      </GjuCard>
      <GjuCard title="보안 / 데이터 관리" eyebrow="위험 작업" className="admin-settings-danger-card">
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
      </GjuCard>
    </section>
  );
}
