export const statusColor = {
  approval_pending: "yellow",
  pending_approval: "yellow",
  auto_confirmed: "blue",
  approved: "green",
  rejected: "red",
  cancelled: "gray",
  admin_cancelled: "gray",
  checked_out: "purple",
  returned: "green",
  completed: "green",
  lecture_applied: "blue",
  warning: "orange",
  blocked: "red"
};

export const statusLabel = {
  approval_pending: "승인 대기",
  approved: "승인 완료",
  rejected: "반려",
  blocked: "이용 제한",
  pending_approval: "승인 대기",
  auto_confirmed: "자동 확정",
  cancelled: "취소",
  admin_cancelled: "관리자 취소",
  checked_out: "대여 완료",
  returned: "반납 완료",
  completed: "사용 완료",
  lecture_applied: "신청완료",
  warning: "경고"
};

export const typeLabel = {
  equipment: "기자재",
  studio: "스튜디오",
  darkroom: "암실",
  print: "출력실",
  lecture: "특강"
};

export const adminNavItems = [
  ["dashboard", "대시보드"],
  ["users", "학생 승인"],
  ["reservations", "예약 관리"],
  ["equipment", "기자재"],
  ["reports", "보고서"],
  ["lectures", "비교과 특강"],
  ["notices", "공지사항"],
  ["logs", "로그/세션"],
  ["settings", "설정"]
];

export const lectureStatusOptions = ["모집중", "진행완료", "취소"];

export const sourceLabel = {
  department: "극기관",
  fantasy_lab: "판타지랩"
};

export const weekdayLabel = {
  sunday: "일",
  monday: "월",
  tuesday: "화",
  wednesday: "수",
  thursday: "목",
  friday: "금",
  saturday: "토"
};

export const weekdayIndex = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

export const userLimitOptions = {
  week1: "1주일",
  week2: "2주일",
  month1: "1달",
  semester: "1학기"
};
