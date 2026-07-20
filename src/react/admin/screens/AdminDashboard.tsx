import React from "react";

import { GjuCard, motionClass } from "../../design-system";
import type { AdminOperationsWarning, AdminReservationRecord, AdminView, AdminViewFilterMap, ReactAdminActions, LegacyState } from "../../platform/types";

type DashboardCardTone = "blue" | "amber" | "green" | "neutral" | "red";

type DashboardCardConfig = {
  label: string;
  value: number;
  caption: string;
  badge: string;
  tone: DashboardCardTone;
  targetView: AdminView;
  filters?: Record<string, string | number>;
};

type AdminDashboardProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

type WarningNavigation = {
  title: string;
  detail: string;
  target: "reservations" | "equipment";
  filters: Record<string, string | number>;
};

const styles = {
  screen: {
    display: "grid",
    gap: "20px"
  },
  intro: {
    margin: 0,
    color: "#344054"
  },
  grid: {
    display: "grid"
  },
  button: {
    display: "block",
    padding: 0,
    border: 0,
    textAlign: "left" as const,
    background: "transparent",
    cursor: "pointer",
    font: "inherit"
  },
  count: {
    margin: 0,
    fontSize: "32px",
    fontWeight: 700,
    lineHeight: 1.1
  },
  caption: {
    margin: "8px 0 0",
    color: "#344054"
  },
  badge: {
    color: "#344054",
    fontSize: "13px",
    fontWeight: 700
  },
  list: {
    display: "grid",
    gap: "10px",
    margin: 0,
    padding: 0,
    listStyle: "none"
  },
  listItem: {
    display: "grid",
    gap: "4px",
    padding: "12px 0",
    borderBottom: "1px solid var(--line-soft)"
  },
  metrics: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))"
  }
} satisfies Record<string, React.CSSProperties>;

function navigateDashboardCard(card: DashboardCardConfig, actions: ReactAdminActions) {
  if (card.targetView === "users") {
    return actions.setAdminView("users", card.filters as Partial<AdminViewFilterMap["users"]>);
  }
  if (card.targetView === "reservations") {
    return actions.setAdminView("reservations", card.filters as Partial<AdminViewFilterMap["reservations"]>);
  }
  if (card.targetView === "reports") {
    return actions.setAdminView("reports", card.filters as Partial<AdminViewFilterMap["reports"]>);
  }
  if (card.targetView === "equipment") {
    return actions.setAdminView("equipment", card.filters as Partial<AdminViewFilterMap["equipment"]>);
  }
  return actions.setAdminView(card.targetView);
}

function renderActionCard(card: DashboardCardConfig, actions: ReactAdminActions) {
  return React.createElement(
    "button",
    {
      key: card.label,
      type: "button",
      style: styles.button,
      className: `${motionClass.screen} admin-dashboard-action${card.value === 0 ? " is-empty" : ""}`,
      onClick: () => {
        void navigateDashboardCard(card, actions);
      }
    },
    React.createElement(
      GjuCard,
      {
        title: card.label,
        className: "admin-dashboard-action-card",
        actions: React.createElement("span", { style: styles.badge }, card.badge)
      },
      React.createElement("p", { style: styles.count }, card.value),
      React.createElement("p", { style: styles.caption }, card.caption)
    )
  );
}

function reservationTypeLabel(type: string) {
  return { equipment: "기자재", studio: "스튜디오", darkroom: "암실", print: "출력" }[type] || type || "예약";
}

function reservationTime(reservation: AdminReservationRecord) {
  const fields = reservation.fields || {};
  if (reservation.queueAt) {
    const date = new Date(reservation.queueAt);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(date);
    }
  }
  if (reservation.queueAction === "return") return String(fields.returnTime || "시간 미정");
  return String(fields.rentalTime || fields.startTime || fields.timeSlots?.[0] || "시간 미정");
}

function queueActionLabel(reservation: AdminReservationRecord) {
  if (reservation.queueAction === "checkout") return "대여";
  if (reservation.queueAction === "return") return "반납";
  return "";
}

function reservationUser(reservation: AdminReservationRecord) {
  const user = reservation.user || reservation.student;
  return user?.name || user?.studentId || "학생";
}

function queueList(items: AdminReservationRecord[], empty: string) {
  if (!items.length) return React.createElement("p", { style: styles.caption }, empty);
  return React.createElement(
    "ul",
    { style: styles.list },
    ...items.map((reservation) => React.createElement(
      "li",
      { key: `${reservation.id}:${reservation.queueAction || "schedule"}`, style: styles.listItem },
      React.createElement("strong", null, `${reservationUser(reservation)} · ${reservationTypeLabel(String(reservation.type || ""))}`),
      React.createElement(
        "span",
        { style: styles.caption },
        `${reservation.fields?.reservedDate || "-"} · ${queueActionLabel(reservation) ? `${queueActionLabel(reservation)} ` : ""}${reservationTime(reservation)}`
      )
    ))
  );
}

function metric(label: string, value: React.ReactNode, detail = "") {
  return React.createElement(
    "div",
    { key: label, className: "admin-metric-card" },
    React.createElement("span", { style: styles.badge }, label),
    React.createElement("strong", null, value),
    detail ? React.createElement("small", { style: styles.badge }, detail) : null
  );
}

function insightCard({
  label,
  value,
  detail,
  onClick
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  onClick: () => void;
}) {
  return React.createElement(
    "button",
    {
      key: label,
      type: "button",
      style: styles.button,
      className: "admin-dashboard-insight-action",
      "aria-label": `${label} ${value} · ${detail}`,
      onClick
    },
    React.createElement(
      GjuCard,
      { title: label, className: "admin-dashboard-insight-card" },
      React.createElement("strong", { style: styles.count }, value),
      React.createElement("p", { style: styles.caption }, detail)
    )
  );
}

function warningCopy(warning: AdminOperationsWarning): WarningNavigation {
  if (warning.kind === "overdue_return") {
    return {
      title: "반납 확인 필요",
      detail: `${warning.equipmentName || "기자재"} 반납 예정 시간이 지났습니다.`,
      target: "reservations" as const,
      filters: { type: "equipment", status: "checked_out", q: "", page: 1 }
    };
  }
  if (warning.kind === "shortage") {
    return {
      title: "장비 부족 위험",
      detail: `${warning.name || warning.code || "기자재"} 가동률 ${Number(warning.utilizationPercent || 0)}%`,
      target: "equipment" as const,
      filters: { q: String(warning.name || warning.code || warning.category || "") }
    };
  }
  return {
    title: "수요 증가",
    detail: `${warning.category || "기자재"} 최근 신청 ${Number(warning.recentRequests || 0)}건`,
    target: "equipment" as const,
    filters: { q: String(warning.category || "") }
  };
}

export function AdminDashboard({ state, actions }: AdminDashboardProps) {
  const summary = state.summary || {};
  const pendingUsers = Number(summary.pendingUsers || 0);
  const pendingApproval = Number(summary.equipmentPendingApproval || summary.pendingEquipment || 0);
  const approved = Number(summary.equipmentApproved || 0);
  const checkedOut = Number(summary.equipmentCheckedOut || 0);
  const returned = Number(summary.equipmentReturned || 0);
  const cancelled = Number(summary.equipmentCancelled || 0);
  const missingReports = Number(summary.missingReports || 0);

  const cards: DashboardCardConfig[] = [
    {
      label: "가입 승인 대기",
      value: pendingUsers,
      caption: "학생 승인으로 이동",
      badge: "학생 승인",
      tone: "blue",
      targetView: "users",
      filters: { status: "approval_pending", q: "", page: 1 }
    },
    {
      label: "기자재 승인 대기",
      value: pendingApproval,
      caption: "승인 요청 확인",
      badge: "예약 관리",
      tone: "amber",
      targetView: "reservations",
      filters: { type: "equipment", status: "pending_approval", q: "", page: 1 }
    },
    {
      label: "승인 완료",
      value: approved,
      caption: "인계 전 예약",
      badge: "예약 관리",
      tone: "blue",
      targetView: "reservations",
      filters: { type: "equipment", status: "approved", q: "", page: 1 }
    },
    {
      label: "대여 중",
      value: checkedOut,
      caption: "반납 대기 장비",
      badge: "예약 관리",
      tone: "amber",
      targetView: "reservations",
      filters: { type: "equipment", status: "checked_out", q: "", page: 1 }
    },
    {
      label: "반납 완료",
      value: returned,
      caption: "기자재 반납 상태",
      badge: "예약 관리",
      tone: "green",
      targetView: "reservations",
      filters: { type: "equipment", status: "returned", q: "", page: 1 }
    },
    {
      label: "취소/반려",
      value: cancelled,
      caption: "기자재 취소 상태",
      badge: "예약 관리",
      tone: "neutral",
      targetView: "reservations",
      filters: { type: "equipment", status: "cancelled_or_rejected", q: "", page: 1 }
    },
    {
      label: "보고서 확인 필요",
      value: missingReports,
      caption: "보고서로 이동",
      badge: "보고서",
      tone: "red",
      targetView: "reports",
      filters: { q: "", semester: "all", page: 1 }
    }
  ];

  const todaySchedule = Array.isArray(summary.todaySchedule) ? summary.todaySchedule : [];
  const checkoutReturnQueue = Array.isArray(summary.checkoutReturnQueue) ? summary.checkoutReturnQueue : [];
  const metrics = summary.metrics || {};
  const typeCounts = metrics.typeCounts || {};
  const popularEquipment = Array.isArray(metrics.popularEquipment) ? metrics.popularEquipment : [];
  const typeTotal = Object.values(typeCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const operationsInsights = metrics.insights;
  const congestion = Array.isArray(operationsInsights?.congestion?.items) ? operationsInsights.congestion.items : [];
  const utilization = Array.isArray(operationsInsights?.equipmentUtilization) ? operationsInsights.equipmentUtilization : [];
  const cancellationRate = operationsInsights?.cancellationRate;
  const warnings = Array.isArray(operationsInsights?.warnings) ? operationsInsights.warnings : [];
  const hasOperationsInsights = congestion.length > 0 || utilization.length > 0 || Number(cancellationRate?.totalRequests || 0) >= 3;

  return React.createElement(
    "section",
    { className: motionClass.screen, style: styles.screen },
    React.createElement(
      GjuCard,
      {
        title: "오늘 처리할 일",
        surface: "workspace"
      },
      React.createElement(
        "p",
        { style: styles.intro },
        "학생 승인과 기자재 승인·대여 흐름, 보고서 확인 대상을 빠르게 확인합니다."
      )
    ),
    React.createElement("section", { className: "admin-dashboard-action-grid", style: styles.grid }, cards.map((card) => renderActionCard(card, actions))),
    React.createElement(
      GjuCard,
      { title: "운영 큐" },
      React.createElement(
        "div",
        { style: styles.grid },
        React.createElement(
          "section",
          null,
          React.createElement("h3", null, "오늘 예약 타임라인"),
          queueList(todaySchedule, "오늘 예약 상세 데이터가 없습니다.")
        ),
        React.createElement(
          "section",
          null,
          React.createElement("h3", null, "대여/반납 큐"),
          queueList(checkoutReturnQueue, "오늘 처리할 대여/반납 항목이 없습니다.")
        )
      )
    ),
    React.createElement(
      GjuCard,
      { title: "운영 인사이트" },
      hasOperationsInsights
        ? React.createElement(
          "div",
          { className: "admin-dashboard-insights__grid" },
          ...congestion.map((item) => insightCard({
            label: "혼잡 시간",
            value: `${item.time || "시간 미정"} · ${Number(item.count || 0)}건`,
            detail: `${item.label || "예약"}의 최근 4주 예약 비중 ${Number(item.sharePercent || 0)}%`,
            onClick: () => { void actions.setAdminView("reservations", { q: "", type: String(item.type || "all"), status: "all", page: 1 }); }
          })),
          ...utilization.slice(0, 3).map((item) => insightCard({
            label: "장비 가동률",
            value: `${Number(item.utilizationPercent || 0)}%`,
            detail: `${item.name || item.code || "기자재"} · 최근 ${Number(item.reservedDays || 0)}일 사용`,
            onClick: () => { void actions.setAdminView("equipment", { q: String(item.name || item.code || "") }); }
          })),
          Number(cancellationRate?.totalRequests || 0) >= 3
            ? insightCard({
              label: "취소율",
              value: `${Number(cancellationRate?.percent || 0)}%`,
              detail: `최근 4주 ${Number(cancellationRate?.cancelledRequests || 0)}건 / ${Number(cancellationRate?.totalRequests || 0)}건`,
              onClick: () => { void actions.setAdminView("reservations", { q: "", type: "all", status: "cancelled_or_rejected", page: 1 }); }
            })
            : null
        )
        : React.createElement("p", { style: styles.caption }, "최근 4주 데이터가 충분하지 않아 추세를 표시하지 않습니다.")
    ),
    React.createElement(
      GjuCard,
      { title: "주의 필요" },
      warnings.length
        ? React.createElement(
          "div",
          { className: "admin-dashboard-insights__grid" },
          ...warnings.map((warning, index) => {
            const copy = warningCopy(warning);
            return insightCard({
              label: copy.title,
              value: "확인",
              detail: copy.detail,
              onClick: () => { void navigateDashboardCard({ label: copy.title, value: 1, caption: copy.detail, badge: "확인", tone: "amber", targetView: copy.target, filters: copy.filters }, actions); }
            });
          })
        )
        : React.createElement("p", { style: styles.caption }, "현재 확인이 필요한 운영 위험이 없습니다.")
    ),
    React.createElement(
      GjuCard,
      { title: "운영 지표" },
      React.createElement(
        "div",
        { style: styles.metrics },
        metric("이번 주 예약 수", Number(metrics.weekReservations || 0)),
        metric("기자재 가용률", `${Number(metrics.equipmentAvailableRate || 0)}%`, `가능 ${Number(metrics.availableEquipment || 0)} / 전체 ${Number(metrics.activeEquipment || 0)}`),
        metric("수리중 기자재", Number(metrics.repairEquipment || 0)),
        metric("취소/반려 예약", Number(metrics.cancelledReservations || 0)),
        metric("보고서 확인 큐", Number(metrics.reportQueueCount || 0)),
        metric("모집중 특강", Number(metrics.openLectures || 0))
      ),
      React.createElement(
        "div",
        { className: "admin-dashboard-insight-grid" },
        React.createElement(
          "section",
          { className: "admin-insight-panel" },
          React.createElement("h3", null, "예약 유형별 비중"),
          ...Object.entries(typeCounts).map(([type, count]) => React.createElement(
            "p",
            { key: type, style: styles.caption },
            `${reservationTypeLabel(type)} ${typeTotal ? Math.round((Number(count) / typeTotal) * 100) : 0}%`
          ))
        ),
        React.createElement(
          "section",
          { className: "admin-insight-panel" },
          React.createElement("h3", null, "인기 기자재 Top 5"),
          popularEquipment.length
            ? React.createElement("ul", null, ...popularEquipment.map((item) => React.createElement("li", { key: item.name, style: styles.caption }, `${item.name} ${item.count}회`)))
            : React.createElement("p", { style: styles.caption }, "선택 기자재 데이터 없음")
        ),
        React.createElement(
          "section",
          { className: "admin-insight-panel" },
          React.createElement("h3", null, "공지/특강 상태"),
          React.createElement("p", { style: styles.caption }, `${Number(metrics.openLectures || 0)}개 특강 모집중`),
          React.createElement("p", { style: styles.caption }, metrics.latestNotice?.title || "최근 공지 없음")
        )
      )
    )
  );
}
