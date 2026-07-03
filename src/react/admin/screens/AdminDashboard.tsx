import React from "react";

import { GjuCard, GjuStatusBadge, motionClass } from "../../design-system";
import type { ReactAdminActions, LegacyState } from "../../platform/types";

type DashboardCardTone = "blue" | "amber" | "green" | "neutral" | "red";

type DashboardCardConfig = {
  label: string;
  value: number;
  caption: string;
  badge: string;
  tone: DashboardCardTone;
  targetView: string;
};

type AdminDashboardProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

const styles = {
  screen: {
    display: "grid",
    gap: "20px"
  },
  intro: {
    margin: 0,
    color: "var(--gju-color-text-muted)"
  },
  grid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
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
    color: "var(--gju-color-text-muted)"
  }
} satisfies Record<string, React.CSSProperties>;

function renderActionCard(card: DashboardCardConfig, actions: ReactAdminActions) {
  return React.createElement(
    "button",
    {
      key: card.label,
      type: "button",
      style: styles.button,
      className: motionClass.screen,
      "data-admin-dashboard-card": card.label,
      "data-admin-target-view": card.targetView,
      onClick: () => {
        void actions.setAdminView(card.targetView);
      }
    },
    React.createElement(
      GjuCard,
      {
        title: card.label,
        eyebrow: "오늘 처리할 일",
        actions: React.createElement(GjuStatusBadge, { tone: card.tone }, card.badge)
      },
      React.createElement("p", { style: styles.count }, card.value),
      React.createElement("p", { style: styles.caption }, card.caption)
    )
  );
}

export function AdminDashboard({ state, actions }: AdminDashboardProps) {
  const summary = state.summary || {};
  const pendingUsers = Number(summary.pendingUsers || 0);
  const checkedOut = Number(summary.equipmentCheckedOut || summary.pendingEquipment || 0);
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
      targetView: "users"
    },
    {
      label: "대여완료",
      value: checkedOut,
      caption: "기자재 대여 상태",
      badge: "예약 관리",
      tone: "amber",
      targetView: "reservations"
    },
    {
      label: "반납완료",
      value: returned,
      caption: "기자재 반납 상태",
      badge: "예약 관리",
      tone: "green",
      targetView: "reservations"
    },
    {
      label: "대여취소",
      value: cancelled,
      caption: "기자재 취소 상태",
      badge: "예약 관리",
      tone: "neutral",
      targetView: "reservations"
    },
    {
      label: "보고서 확인 필요",
      value: missingReports,
      caption: "보고서로 이동",
      badge: "보고서",
      tone: "red",
      targetView: "reports"
    }
  ];

  return React.createElement(
    "section",
    { className: motionClass.screen, style: styles.screen },
    React.createElement(
      GjuCard,
      {
        title: "오늘 처리할 일",
        eyebrow: "React Admin"
      },
      React.createElement(
        "p",
        { style: styles.intro },
        "학생 승인과 기자재 3상태, 보고서 확인 대상을 빠르게 확인합니다."
      )
    ),
    React.createElement("section", { style: styles.grid }, cards.map((card) => renderActionCard(card, actions)))
  );
}
