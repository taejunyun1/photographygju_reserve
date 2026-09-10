export function createAdminRefreshLifecycle({
  canRefresh = () => false,
  refresh = async () => {},
  clock = () => Date.now(),
  minIntervalMs = 15_000
} = {}) {
  let pending = null;
  let lastSucceededAt = 0;

  function request({ force = false } = {}) {
    if (!canRefresh()) return Promise.resolve(false);
    if (pending) return pending;
    if (!force && lastSucceededAt && clock() - lastSucceededAt < minIntervalMs) return Promise.resolve(false);
    let refreshResult;
    try {
      refreshResult = refresh();
    } catch (error) {
      return Promise.reject(error);
    }
    pending = Promise.resolve(refreshResult)
      .then(() => {
        lastSucceededAt = clock();
        return true;
      })
      .finally(() => { pending = null; });
    return pending;
  }

  return {
    request,
    get refreshing() { return Boolean(pending); },
    get lastSucceededAt() { return lastSucceededAt; }
  };
}

let configuredLifecycle = null;

export function configureAdminRefreshLifecycle(options) {
  configuredLifecycle = createAdminRefreshLifecycle(options);
  return configuredLifecycle;
}

export function requestAdminRefresh(options) {
  return configuredLifecycle?.request(options) || Promise.resolve(false);
}
