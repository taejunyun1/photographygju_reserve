export function readNoticeIdsForUser(user, notices) {
  if (!user || user.role !== "student") return [];
  const existing = new Set(notices.map((notice) => notice.id));
  return [...new Set(Array.isArray(user.noticeReadIds) ? user.noticeReadIds : [])]
    .filter((id) => typeof id === "string" && existing.has(id));
}
