export const adminNavItems = [
  ["dashboard", "대시보드"],
  ["users", "학생 승인"],
  ["reservations", "예약 관리"],
  ["equipment", "기자재"],
  ["reports", "보고서"],
  ["lectures", "비교과 특강"],
  ["course-demand", "교과 편성"],
  ["notices", "공지사항"],
  ["logs", "로그/세션"],
  ["settings", "설정"]
] as const;

export type AdminNavKey = (typeof adminNavItems)[number][0] | "account";

export function adminTitle(view = "dashboard") {
  return {
    dashboard: "대시보드",
    users: "학생 승인",
    reservations: "예약 관리",
    equipment: "기자재 관리",
    reports: "보고서",
    lectures: "비교과 특강",
    "course-demand": "교과 편성",
    notices: "공지사항",
    logs: "로그/세션",
    settings: "설정",
    account: "내 정보"
  }[view] || "대시보드";
}
