export function createNativeAppResumeLifecycle({
  isNative,
  appPlugin,
  onResume,
  onError = () => {}
}) {
  let queue = Promise.resolve();
  let subscription = null;

  function reportError(error) {
    return Promise.resolve(onError(error instanceof Error ? error : new Error(String(error || "앱 복귀 처리에 실패했습니다."))))
      .catch(() => undefined);
  }

  function enqueueResume() {
    queue = queue
      .then(() => onResume())
      .catch(reportError);
  }

  return {
    async setup() {
      if (!isNative || typeof appPlugin?.addListener !== "function") return false;
      try {
        subscription = await appPlugin.addListener("appStateChange", ({ isActive }) => {
          if (isActive) enqueueResume();
        });
        return true;
      } catch (error) {
        await reportError(error);
        return false;
      }
    },
    drain() {
      return queue;
    },
    async dispose() {
      await queue;
      await subscription?.remove?.();
      subscription = null;
    }
  };
}
