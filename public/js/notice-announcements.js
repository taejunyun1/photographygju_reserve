function identity(state) {
  return state.user?.role === "student" && state.user.id && state.token
    ? JSON.stringify([state.user.id, state.token]) : "";
}

export function mergeNoticeReads(bootstrap, readerId, readNoticeIds) {
  return [...new Set([
    ...(bootstrap?.noticeReaderId === readerId && Array.isArray(bootstrap.readNoticeIds) ? bootstrap.readNoticeIds : []),
    ...(Array.isArray(readNoticeIds) ? readNoticeIds : [])
  ])].filter((id) => typeof id === "string");
}

export function createNoticeReader({ state, api, render, toast }) {
  return async function openNotice(id) {
    if (!id) { state.activeNoticeId = ""; render(); return; }
    const notice = state.bootstrap?.notices?.find((item) => item.id === id && item.active !== false);
    if (!notice) return;
    const viewer = identity(state);
    state.activeNoticeId = id;
    state.view = "notices";
    render();
    if (!viewer || (state.bootstrap.noticeReaderId === state.user.id && state.bootstrap.readNoticeIds?.includes(id))) return;
    try {
      const result = await api(`/api/me/notices/${encodeURIComponent(id)}/read`, { method: "POST", body: {}, loading: false });
      if (identity(state) !== viewer || result.readerId !== state.user.id) return;
      state.bootstrap = { ...state.bootstrap, noticeReaderId: result.readerId, readNoticeIds: mergeNoticeReads(state.bootstrap, result.readerId, result.readNoticeIds) };
      render();
    } catch {
      if (identity(state) === viewer) toast("공지 읽음 상태를 저장하지 못했습니다. 다시 확인해 주세요.", { tone: "error", preserveScroll: true });
    }
  };
}

export function createStudentNoticeRefresher({ state, api, render }) {
  let pending = null;
  let lastIdentity = "";
  let lastSucceeded = 0;
  return function refresh({ force = false } = {}) {
    const viewer = identity(state);
    if (!viewer) return Promise.resolve();
    if (pending?.identity === viewer) return pending.promise;
    if (!force && lastIdentity === viewer && Date.now() - lastSucceeded < 15_000) return Promise.resolve();
    const request = { identity: viewer, promise: null };
    request.promise = (async () => {
      try {
        const result = await api("/api/me/notices", { loading: false });
        if (identity(state) !== viewer || !state.bootstrap || result.readerId !== state.user.id || !Array.isArray(result.notices) || !Array.isArray(result.readNoticeIds)) return;
        state.bootstrap = { ...state.bootstrap, notices: result.notices, noticeReaderId: result.readerId, readNoticeIds: mergeNoticeReads(state.bootstrap, result.readerId, result.readNoticeIds) };
        lastIdentity = viewer;
        lastSucceeded = Date.now();
        render();
      } catch { /* Keep the last known notices when a quiet refresh fails. */ }
      finally { if (pending === request) pending = null; }
    })();
    pending = request;
    return request.promise;
  };
}
