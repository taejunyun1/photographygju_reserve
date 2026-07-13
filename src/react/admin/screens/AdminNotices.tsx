import React from "react";

import { GjuCard, GjuEmptyState, GjuIconButton, GjuStatusBadge, GjuTable } from "../../design-system";
import type { AdminNoticeRecord, LegacyState, ReactAdminActions } from "../../platform/types";
import {
  bulkDeleteAvailability,
  checkedValue,
  fieldValue,
  formatDateTime,
  property,
  renderPager,
  runAdminAction,
  stopSubmit
} from "./adminScreenUtils";

type AdminNoticesProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

function noticeActive(notice: AdminNoticeRecord) {
  return typeof notice.active === "boolean" ? notice.active : notice.status === "published";
}

function noticePayload(form: HTMLFormElement) {
  return {
    title: fieldValue(form, "title"),
    body: fieldValue(form, "body"),
    category: fieldValue(form, "category"),
    link: fieldValue(form, "linkUrl"),
    pinned: checkedValue(form, "pinned"),
    active: checkedValue(form, "active")
  };
}

function bulkDeleteNotices(state: LegacyState, actions: ReactAdminActions) {
  runAdminAction(() => actions.bulkDeleteNotices({ q: state.adminNoticeSearch || "" }));
}

function renderNoticeDeleteAction(notice: AdminNoticeRecord, actions: ReactAdminActions) {
  return (
    <GjuIconButton
      label="공지 삭제"
      icon="trash"
      tone="danger"
      onClick={() => runAdminAction(() => actions.deleteNotice(notice.id, notice.title))}
    />
  );
}

export function AdminNotices({ state, actions }: AdminNoticesProps) {
  const notices = state.adminNotices || [];
  const noticeSort = state.adminNoticeSort || { field: "createdAt", direction: "desc" as const };
  const deleteFilters = { q: state.adminNoticeSearch || "" };
  const deleteAvailability = bulkDeleteAvailability(state.adminNoticesPage, deleteFilters);

  const submitSearch = stopSubmit((form) => {
    void actions.setAdminFilters("notices", {
      q: String(new FormData(form).get("q") || ""),
      page: 1
    });
  });

  const submitNotice = stopSubmit(async (form) => {
    await actions.createNotice(noticePayload(form));
    form.reset();
  });
  const setSort = (field: "title" | "category" | "status" | "createdAt") => {
    const direction = noticeSort.field === field && noticeSort.direction === "asc" ? "desc" : "asc";
    void actions.setAdminFilters("notices", { sort: field, direction, page: 1 });
  };

  return (
    <section className="grid admin-react-screen">
      <GjuCard title="공지사항" eyebrow="React Admin" actions={<span className="tag blue">{notices.length}건</span>} surface="workspace">
        <form className="list-control-panel compact admin-react-toolbar" onSubmit={submitSearch}>
          <label>
            <span className="sr-only">공지 검색</span>
            <input
              className="input"
              name="q"
              defaultValue={String(state.adminNoticeSearch || "")}
              placeholder="제목·본문·분류 검색"
            />
          </label>
          <button className="button primary compact" type="submit">
            검색
          </button>
        </form>
        <form className="admin-react-form-grid" onSubmit={submitNotice}>
          <label>
            제목
            <input className="input" name="title" required />
          </label>
          <label>
            분류
            <input className="input" name="category" placeholder="일반" />
          </label>
          <label className="admin-react-form-wide">
            링크
            <input className="input" name="linkUrl" type="url" placeholder="https://..." />
          </label>
          <label className="admin-react-form-wide">
            본문
            <textarea className="textarea" name="body" rows={4} required />
          </label>
          <label className="admin-react-check">
            <input name="pinned" type="checkbox" />
            상단 고정
          </label>
          <label className="admin-react-check">
            <input name="active" type="checkbox" defaultChecked />
            공개
          </label>
          <div className="button-row admin-react-form-wide">
            <button className="button primary" type="submit">
              공지 등록
            </button>
            <button className="button danger" type="button" disabled={deleteAvailability.filteredDisabled} onClick={() => bulkDeleteNotices(state, actions)}>
              필터 결과 공지 삭제
            </button>
            <button className="button danger" type="button" disabled={deleteAvailability.allDisabled} onClick={() => runAdminAction(() => actions.deleteAllNotices(deleteAvailability.collectionTotal))}>
              전체 공지 삭제
            </button>
          </div>
        </form>
        <div className="table-wrap embedded admin-react-desktop-table">
          <GjuTable>
            <thead>
              <tr>
                <th><button className="table-sort" type="button" onClick={() => setSort("title")}>공지</button></th>
                <th><button className="table-sort" type="button" onClick={() => setSort("category")}>분류</button></th>
                <th><button className="table-sort" type="button" onClick={() => setSort("status")}>상태</button></th>
                <th><button className="table-sort" type="button" onClick={() => setSort("createdAt")}>작성일</button></th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {notices.length ? notices.map((notice) => (
                <tr key={notice.id}>
                  <td>
                    <strong>{notice.title || "-"}</strong>
                    {notice.body ? (
                      <>
                        <br />
                        <span className="muted">{notice.body}</span>
                      </>
                    ) : null}
                  </td>
                  <td>{notice.category || "-"}</td>
                  <td>
                    <GjuStatusBadge tone={noticeActive(notice) ? "green" : "neutral"}>
                      {noticeActive(notice) ? "공개" : "숨김"}
                    </GjuStatusBadge>
                    {notice.pinned ? <span className="tag blue">고정</span> : null}
                  </td>
                  <td>{formatDateTime(notice.createdAt || notice.updatedAt)}</td>
                  <td>{renderNoticeDeleteAction(notice, actions)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5}>
                    <GjuEmptyState title="공지사항이 없습니다." message="검색어를 확인하세요." />
                  </td>
                </tr>
              )}
            </tbody>
          </GjuTable>
        </div>
        <div className="admin-react-card-list" aria-label="공지 목록">
          {notices.length ? notices.map((notice) => (
            <article key={notice.id} className="admin-react-list-card">
              <div className="reservation-card-head">
                <div>
                  <strong>{notice.title || "-"}</strong>
                  <span>{notice.category || "-"}</span>
                </div>
                <GjuStatusBadge tone={noticeActive(notice) ? "green" : "neutral"}>
                  {noticeActive(notice) ? "공개" : "숨김"}
                </GjuStatusBadge>
              </div>
              <p className="admin-react-body-text">{notice.body || "-"}</p>
              <dl className="property-list">
                {property("고정", notice.pinned ? "예" : "아니오")}
                {property("링크", notice.link || notice.linkUrl || "-")}
                {property("작성일", formatDateTime(notice.createdAt || notice.updatedAt))}
              </dl>
              {renderNoticeDeleteAction(notice, actions)}
            </article>
          )) : <GjuEmptyState title="공지사항이 없습니다." message="검색어를 확인하세요." />}
        </div>
        {renderPager(actions, state.adminNoticesPage, "notices", "공지 페이지 이동")}
      </GjuCard>
    </section>
  );
}
