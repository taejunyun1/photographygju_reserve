import React, { useMemo, useState } from "react";

import { GjuCard, GjuDialog, GjuEmptyState } from "../../design-system";
import { NoticeList, ScreenHeader } from "../components/StudentPrimitives";
import type { StudentActions, StudentState } from "../types";

export function NoticesScreen({ state, actions }: { state: StudentState; actions: StudentActions }) {
  const [query, setQuery] = useState("");
  const notices = useMemo(() => state.bootstrap.notices.filter((notice) => {
    const haystack = [notice.title, notice.category, notice.body, notice.createdAt].filter(Boolean).join(" ").toLowerCase();
    return !query.trim() || haystack.includes(query.trim().toLowerCase());
  }), [query, state.bootstrap.notices]);
  const selected = state.activeNoticeId
    ? state.bootstrap.notices.find((notice) => notice.id === state.activeNoticeId)
    : undefined;
  const closeNotice = () => {
    void actions.openNotice(null);
  };

  return (
    <section className="grid student-react-notices">
      <ScreenHeader title="공지사항" description="학과 공지를 한곳에서 확인합니다." />
      <GjuDialog
        open={Boolean(selected)}
        title={selected?.title || "공지사항"}
        confirmLabel="닫기"
        cancelLabel="닫기"
        onClose={closeNotice}
        onCancel={closeNotice}
        onConfirm={closeNotice}
      >
        {selected ? (
          <div className="student-react-notice-dialog">
            <p className="student-react-notice-dialog__category">{selected.category || "공지"}</p>
            <p>{selected.body || "내용이 없습니다."}</p>
            {selected.link ? <a className="button ghost" href={selected.link} target="_blank" rel="noopener noreferrer">관련 링크</a> : null}
          </div>
        ) : null}
      </GjuDialog>
      <GjuCard title="공지 검색">
        <div className="field"><label htmlFor="student-notice-search">공지 검색</label><input id="student-notice-search" className="input" value={query} placeholder="제목·분류·본문 검색" onChange={(event) => setQuery(event.target.value)} /></div>
      </GjuCard>
      {notices.length ? <NoticeList notices={notices} onOpen={(id) => void actions.openNotice(id)} /> : <GjuEmptyState title="검색 결과가 없습니다." message="검색어를 지우면 전체 공지를 볼 수 있습니다." />}
    </section>
  );
}
