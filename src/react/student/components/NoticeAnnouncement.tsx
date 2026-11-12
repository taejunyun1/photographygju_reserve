import React from "react";

import { GjuIcon } from "../../design-system";
import type { StudentActions, StudentState } from "../types";

export function NoticeAnnouncement({ state, actions }: { state: StudentState; actions: StudentActions }) {
  if (!state.user.id || state.bootstrap.noticeReaderId !== state.user.id || state.activeNoticeId
    || state.transientMessageActive || ["reserve", "reports"].includes(state.view)) return null;
  const read = new Set(state.bootstrap.readNoticeIds || []);
  const unread = state.bootstrap.notices.filter((notice) => !read.has(notice.id))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      || String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || a.id.localeCompare(b.id));
  const notice = unread[0];
  if (!notice) return null;

  return <aside className="student-react-notice-announcement" role="status" aria-live="polite" aria-atomic="true">
    <button type="button" aria-label={`새 공지: ${notice.title}${unread.length > 1 ? `, 미확인 ${unread.length}건` : ""}`} onClick={() => void actions.openNotice(notice.id)}>
      <GjuIcon name="fileText" />
      <span className="student-react-notice-announcement__copy"><small>새 공지{unread.length > 1 ? ` · ${unread.length}` : ""}</small><strong>{notice.title}</strong></span>
      <GjuIcon name="chevronRight" />
    </button>
  </aside>;
}
