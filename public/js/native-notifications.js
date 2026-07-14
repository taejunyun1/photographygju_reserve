import { statusLabel, typeLabel } from "./constants.js?v=20260714-mobile-overflow-r4";
import { state } from "./state.js?v=20260714-mobile-overflow-r4";
import {
  planAdminNotifications,
  planReservationNotifications,
  diagnosticNotificationId,
  RESERVATION_REMINDER_CHANNEL_ID,
  reservationEndDate,
  reservationStartDate,
  reservationMeta,
  stableNotificationId
} from "./notification-planner.js";

const LEGACY_PREF_KEY = "gju_native_notifications_enabled";
const LEGACY_IDS_KEY = "gju_native_notification_ids";
const V2_PREFIX = "gju_native_notifications_v2";
const ACTIVE_ACCOUNT_KEY = `${V2_PREFIX}:activeAccount`;
const REMINDER_CHANNEL_ID = RESERVATION_REMINDER_CHANNEL_ID;
const TERMINAL_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected", "returned", "completed"]);

function localNotificationsPlugin() {
  return globalThis.window?.Capacitor?.Plugins?.LocalNotifications || null;
}

function watchReservationsPlugin() {
  return globalThis.window?.Capacitor?.Plugins?.GJUWatchReservations || null;
}

function nativePlatform() {
  return globalThis.window?.Capacitor?.getPlatform?.() || (globalThis.window?.GJU_NATIVE_APP ? "native" : "web");
}

function defaultStorage() {
  return globalThis.localStorage;
}

function safeIds(storage, key) {
  try {
    const ids = JSON.parse(storage?.getItem(key) || "[]");
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function userKey(userId, suffix) {
  return `${V2_PREFIX}:${encodeURIComponent(String(userId || "anonymous"))}:${suffix}`;
}

function baseStatus(supported, enabled, overrides = {}) {
  return {
    supported,
    enabled,
    effective: false,
    permission: "unknown",
    pendingCount: 0,
    syncedAt: "",
    error: "",
    ...overrides
  };
}

export function nativeNotificationsSupported() {
  return Boolean(globalThis.window?.GJU_NATIVE_APP && localNotificationsPlugin());
}

export function createNotificationManager({
  plugin = localNotificationsPlugin(),
  storage = defaultStorage(),
  userId = "anonymous",
  role = "student",
  reservations = [],
  summary = {},
  reportDeadlineHours = 48,
  now = () => new Date(),
  platform = nativePlatform(),
  supported = Boolean(globalThis.window?.GJU_NATIVE_APP && plugin)
} = {}) {
  let queue = Promise.resolve();
  let listenerReady = false;
  let listenerHandle = null;
  let actionHandler = null;
  let listenerSetupError = "";

  const getUserId = () => typeof userId === "function" ? userId() : userId;
  const getRole = () => typeof role === "function" ? role() : role;
  const getReservations = () => typeof reservations === "function" ? reservations() : reservations;
  const getSummary = () => typeof summary === "function" ? summary() : summary;
  const currentSupported = () => typeof supported === "function" ? supported() : supported;
  const currentPlugin = () => typeof plugin === "function" ? plugin() : plugin;
  const storageAvailable = () => storage && typeof storage.getItem === "function";

  function migrate(user) {
    if (!storageAvailable() || !user || user === "anonymous") return;
    const prefKey = userKey(user, "enabled");
    const idsKey = userKey(user, "ids");
    if (!storage.getItem(prefKey) && storage.getItem(LEGACY_PREF_KEY)) storage.setItem(prefKey, "true");
    if (!storage.getItem(idsKey) && storage.getItem(LEGACY_IDS_KEY)) storage.setItem(idsKey, storage.getItem(LEGACY_IDS_KEY));
    if (storage.getItem(LEGACY_PREF_KEY) || storage.getItem(LEGACY_IDS_KEY)) {
      storage.removeItem(LEGACY_PREF_KEY);
      storage.removeItem(LEGACY_IDS_KEY);
    }
  }

  function preferenceEnabledFor(user = getUserId()) {
    migrate(user);
    return storageAvailable() && storage.getItem(userKey(user, "enabled")) === "true";
  }

  function preferenceEnabled() {
    return preferenceEnabledFor();
  }

  function setPreference(value, user = getUserId()) {
    if (!storageAvailable()) return;
    const key = userKey(user, "enabled");
    if (value) storage.setItem(key, "true");
    else storage.removeItem(key);
  }

  function storedIds(user = getUserId()) {
    migrate(user);
    return storageAvailable() ? safeIds(storage, userKey(user, "ids")) : [];
  }

  function storeIds(ids, user = getUserId()) {
    if (!storageAvailable()) return;
    storage.setItem(userKey(user, "ids"), JSON.stringify([...new Set(ids)].filter((id) => Number.isInteger(id))));
  }

  function storedDeliveredIds(user = getUserId()) {
    migrate(user);
    return storageAvailable() ? safeIds(storage, userKey(user, "deliveredIds")) : [];
  }

  function storeDeliveredIds(ids, user = getUserId()) {
    if (!storageAvailable()) return;
    const owned = [...new Set(ids)].filter((id) => Number.isInteger(id));
    storage.setItem(userKey(user, "deliveredIds"), JSON.stringify(owned));
  }

  function storedDiagnosticIds(user = getUserId()) {
    migrate(user);
    return storageAvailable() ? safeIds(storage, userKey(user, "diagnosticIds")) : [];
  }

  function storeDiagnosticIds(ids, user = getUserId()) {
    if (!storageAvailable()) return;
    storage.setItem(userKey(user, "diagnosticIds"), JSON.stringify([...new Set(ids)].filter((id) => Number.isInteger(id))));
  }

  function rememberActiveAccount(user) {
    if (!storageAvailable() || !user || user === "anonymous") return;
    storage.setItem(ACTIVE_ACCOUNT_KEY, String(user));
  }

  function ownedAccountUsers() {
    if (!storageAvailable() || typeof storage.length !== "number" || typeof storage.key !== "function") return [];
    const prefix = `${V2_PREFIX}:`;
    const suffixes = [":ids", ":deliveredIds", ":diagnosticIds"];
    const users = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      const suffix = suffixes.find((candidate) => key?.startsWith(prefix) && key.endsWith(candidate));
      if (!key || !suffix || !safeIds(storage, key).length) continue;
      const encodedUser = key.slice(prefix.length, -suffix.length);
      try {
        users.push(decodeURIComponent(encodedUser));
      } catch {
        users.push(encodedUser);
      }
    }
    return [...new Set(users)];
  }

  function activateAccount(user) {
    if (!storageAvailable()) return;
    const previousUser = storage.getItem(ACTIVE_ACCOUNT_KEY);
    if (previousUser && previousUser !== String(user || "anonymous")) setClearPending(true, previousUser);
    if (!previousUser && (storage.getItem(LEGACY_PREF_KEY) || storage.getItem(LEGACY_IDS_KEY))) {
      if (user && user !== "anonymous") {
        migrate(user);
      } else {
        const legacyIds = safeIds(storage, LEGACY_IDS_KEY);
        if (legacyIds.length) {
          storeIds(legacyIds, "legacy");
          setClearPending(true, "legacy");
        }
        storage.removeItem(LEGACY_PREF_KEY);
        storage.removeItem(LEGACY_IDS_KEY);
      }
    }
    if (!previousUser) {
      ownedAccountUsers()
        .filter((ownedUser) => ownedUser !== user)
        .forEach((ownedUser) => setClearPending(true, ownedUser));
    }
    if (user && user !== "anonymous") rememberActiveAccount(user);
  }

  function forgetActiveAccount(user) {
    if (!storageAvailable() || storage.getItem(ACTIVE_ACCOUNT_KEY) !== String(user)) return;
    storage.removeItem(ACTIVE_ACCOUNT_KEY);
  }

  function storedPendingEstimate() {
    if (!storageAvailable() || typeof storage.length !== "number" || typeof storage.key !== "function") return 0;
    const ids = new Set();
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(`${V2_PREFIX}:`) || (!key.endsWith(":ids") && !key.endsWith(":diagnosticIds"))) continue;
      safeIds(storage, key).forEach((id) => ids.add(id));
    }
    return ids.size;
  }

  function setClearPending(value, user = getUserId()) {
    if (!storageAvailable()) return;
    const key = userKey(user, "clearPending");
    if (value) storage.setItem(key, "true");
    else storage.removeItem(key);
  }

  function pendingClearUsers() {
    if (!storageAvailable() || typeof storage.length !== "number" || typeof storage.key !== "function") return [];
    const prefix = `${V2_PREFIX}:`;
    const suffix = ":clearPending";
    const users = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(prefix) || !key.endsWith(suffix) || storage.getItem(key) !== "true") continue;
      const encodedUser = key.slice(prefix.length, -suffix.length);
      try {
        users.push(decodeURIComponent(encodedUser));
      } catch {
        users.push(encodedUser);
      }
    }
    return [...new Set(users)];
  }

  async function ensureChannel() {
    const activePlugin = currentPlugin();
    const activePlatform = typeof platform === "function" ? platform() : platform;
    if (activePlatform !== "android" || !activePlugin?.createChannel) return;
    await activePlugin.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: "예약 알림",
      description: "예약 접수, 사용 시간, 보고서 리마인더",
      importance: 4,
      visibility: 1,
      lights: true,
      lightColor: "#1558B0",
      vibration: true
    }).catch(() => null);
  }

  async function permission() {
    const result = await currentPlugin()?.checkPermissions?.();
    return result?.display || "unknown";
  }

  async function cancelOwned({ user = getUserId(), preserveOnFailure = true, accountBoundary = false } = {}) {
    const ids = storedIds(user);
    const diagnosticIds = accountBoundary ? storedDiagnosticIds(user) : [];
    const deliveredIds = accountBoundary ? storedDeliveredIds(user) : [];
    const pendingIds = [...new Set([...ids, ...diagnosticIds])];
    const ownedIds = [...new Set([...pendingIds, ...deliveredIds])];
    const activePlugin = currentPlugin();
    try {
      if (pendingIds.length && activePlugin?.cancel) await activePlugin.cancel({ notifications: pendingIds.map((id) => ({ id })) });
      if (accountBoundary && ownedIds.length && activePlugin?.removeDeliveredNotifications) {
        await activePlugin.removeDeliveredNotifications({ notifications: ownedIds.map((id) => ({ id })) });
      }
      if (!accountBoundary && ids.length) {
        storeDeliveredIds([...storedDeliveredIds(user), ...ids], user);
      }
      storeIds([], user);
      if (accountBoundary) {
        storeDiagnosticIds([], user);
        storeDeliveredIds([], user);
        forgetActiveAccount(user);
      }
      if (accountBoundary) setClearPending(false, user);
      return { ids: accountBoundary ? ownedIds : pendingIds, cancelled: true };
    } catch (error) {
      if (!preserveOnFailure) {
        storeIds([], user);
        if (accountBoundary) {
          storeDiagnosticIds([], user);
          storeDeliveredIds([], user);
        }
      }
      if (accountBoundary && preserveOnFailure) setClearPending(true, user);
      throw error;
    }
  }

  async function retryPendingClears() {
    if (!currentSupported() || !currentPlugin()) return { retried: 0, failed: 0 };
    let retried = 0;
    let failed = 0;
    for (const user of pendingClearUsers()) {
      try {
        await cancelOwned({ user, accountBoundary: true });
        retried += 1;
      } catch {
        failed += 1;
      }
    }
    return { retried, failed };
  }

  async function availablePendingSlots() {
    const activePlatform = typeof platform === "function" ? platform() : platform;
    if (activePlatform !== "ios") return 64;
    const activePlugin = currentPlugin();
    const storedCount = storedPendingEstimate();
    if (!activePlugin?.getPending) return 0;
    let pendingCount;
    try {
      const pending = await activePlugin.getPending();
      const nativeCount = Array.isArray(pending?.notifications) ? pending.notifications.length : 0;
      pendingCount = Math.max(storedCount, nativeCount);
    } catch {
      return 0;
    }
    return Math.max(0, 64 - pendingCount);
  }

  function accountSnapshot() {
    return {
      user: getUserId(),
      role: getRole(),
      reservations: getReservations(),
      summary: getSummary(),
      reportDeadlineHours: typeof reportDeadlineHours === "function" ? reportDeadlineHours() : reportDeadlineHours
    };
  }

  function planned(account, max = 64) {
    if (max <= 0) return [];
    if (account.role === "admin") return planAdminNotifications({ userId: account.user, summary: account.summary, now: now() }).slice(0, max);
    return planReservationNotifications({
      userId: account.user,
      reservations: account.reservations,
      now: now(),
      reportDeadlineHours: account.reportDeadlineHours,
      max
    });
  }

  async function syncNow({ force = false } = {}, account = accountSnapshot()) {
    const activePlugin = currentPlugin();
    const enabled = preferenceEnabledFor(account.user);
    if (!currentSupported() || !activePlugin) return { scheduled: 0, effective: false };
    await retryPendingClears();
    if (!force && !enabled) return { scheduled: 0, effective: false };
    const permissionState = await permission();
    if (permissionState !== "granted") return { scheduled: 0, effective: false, permission: permissionState };
    await ensureChannel();
    await cancelOwned({ user: account.user });
    const notifications = planned(account, await availablePendingSlots());
    storeIds(notifications.map((notification) => notification.id), account.user);
    if (notifications.length) await activePlugin.schedule({ notifications });
    return { scheduled: notifications.length, effective: enabled, permission: permissionState };
  }

  function enqueue(operation) {
    const next = queue.then(operation);
    queue = next.catch(() => null);
    return next;
  }

  async function sync(options = {}) {
    const account = accountSnapshot();
    const operation = enqueue(async () => {
      activateAccount(account.user);
      return syncNow(options, account);
    });
    if (!options.silent) return operation;
    try {
      return await operation;
    } catch (error) {
      return { scheduled: 0, effective: false, error: error.message || "예약 알림을 동기화하지 못했습니다." };
    }
  }

  async function refresh(account = accountSnapshot()) {
    const activePlugin = currentPlugin();
    const enabled = preferenceEnabledFor(account.user);
    if (!currentSupported() || !activePlugin) return baseStatus(false, enabled, { permission: globalThis.window?.GJU_NATIVE_APP ? "unavailable" : "web" });
    try {
      const permissionState = await permission();
      const pending = await activePlugin.getPending?.().catch(() => ({ notifications: [] }));
      return baseStatus(true, enabled, {
        effective: enabled && permissionState === "granted",
        permission: permissionState,
        pendingCount: Array.isArray(pending?.notifications) ? pending.notifications.length : 0
      });
    } catch (error) {
      return baseStatus(true, enabled, { error: error.message || "알림 상태를 확인하지 못했습니다." });
    }
  }

  async function enable() {
    const account = accountSnapshot();
    return enqueue(async () => {
      activateAccount(account.user);
      await retryPendingClears();
      if (!currentSupported()) throw new Error("네이티브 앱에서만 알림을 사용할 수 있습니다.");
      let permissionState = await permission();
      if (permissionState !== "granted") permissionState = (await currentPlugin().requestPermissions())?.display || "unknown";
      if (permissionState !== "granted") {
        setPreference(false, account.user);
        throw new Error("알림 권한이 허용되지 않았습니다. 기기 설정에서 알림을 허용해 주세요.");
      }
      setPreference(true, account.user);
      await syncNow({ force: true }, account);
      return refresh(account);
    });
  }

  async function clearAccount(user = getUserId()) {
    return enqueue(async () => {
      setPreference(false, user);
      setClearPending(true, user);
      await cancelOwned({ user, accountBoundary: true });
      return refresh();
    });
  }

  async function disable() {
    return clearAccount();
  }

  async function cleanup() {
    return clearAccount();
  }

  async function notifyCreated(reservation) {
    const account = accountSnapshot();
    return enqueue(async () => {
      activateAccount(account.user);
      await retryPendingClears();
      const activePlugin = currentPlugin();
      if (!currentSupported() || !activePlugin || !preferenceEnabledFor(account.user) || !reservation) return { scheduled: 0 };
      if (await permission() !== "granted") return { scheduled: 0, effective: false };
      await ensureChannel();
      const type = typeLabel[reservation.type] || "예약";
      const id = stableNotificationId(`${account.user}:${reservation.id}:created`);
      storeDeliveredIds([...storedDeliveredIds(account.user), id], account.user);
      await activePlugin.schedule({
        notifications: [{
          id,
          title: reservation.type === "equipment" ? "기자재 예약 승인 요청 접수" : `${type} 예약 확정`,
          body: `${reservation.fields?.reservedDate || ""} · ${reservationMeta(reservation) || type}`,
          channelId: REMINDER_CHANNEL_ID,
          autoCancel: true,
          extra: { route: "mine", reservationId: reservation.id, reservationType: reservation.type, notificationType: "reservation-created" }
        }]
      });
      return { scheduled: 1, effective: true };
    });
  }

  async function scheduleDiagnostic(delaySeconds = 10) {
    const account = accountSnapshot();
    return enqueue(async () => {
      activateAccount(account.user);
      await retryPendingClears();
      const activePlugin = currentPlugin();
      if (!currentSupported() || !activePlugin) throw new Error("네이티브 앱에서만 테스트 알림을 예약할 수 있습니다.");
      if (await permission() !== "granted") throw new Error("알림 권한을 먼저 허용해 주세요.");
      await ensureChannel();
      if (await availablePendingSlots() <= 0) throw new Error("iOS 대기 알림 64개 한도에 도달했습니다.");
      const scheduledAt = new Date(now().getTime() + Math.max(1, Number(delaySeconds || 10)) * 1000);
      const id = diagnosticNotificationId(`${account.user}:diagnostic:${scheduledAt.toISOString()}`);
      storeDiagnosticIds([...storedDiagnosticIds(account.user), id], account.user);
      await activePlugin.schedule({
        notifications: [{
          id,
          title: "GJU Reserve 알림 테스트",
          body: "로컬 예약 알림이 정상적으로 전달되었습니다.",
          schedule: { at: scheduledAt },
          channelId: REMINDER_CHANNEL_ID,
          autoCancel: true,
          extra: { route: account.role === "admin" ? "admin" : "mine", adminView: "dashboard", notificationType: "diagnostic" }
        }]
      });
      return { id, scheduledAt: scheduledAt.toISOString() };
    });
  }

  async function getPending() {
    const activePlugin = currentPlugin();
    if (!currentSupported() || !activePlugin?.getPending) return [];
    const result = await activePlugin.getPending();
    return Array.isArray(result?.notifications) ? result.notifications : [];
  }

  async function cancelDiagnostics() {
    const user = getUserId();
    return enqueue(async () => {
      activateAccount(user);
      await retryPendingClears();
      const ids = storedDiagnosticIds(user);
      const activePlugin = currentPlugin();
      if (ids.length && activePlugin?.cancel) await activePlugin.cancel({ notifications: ids.map((id) => ({ id })) });
      if (ids.length && activePlugin?.removeDeliveredNotifications) {
        await activePlugin.removeDeliveredNotifications({ notifications: ids.map((id) => ({ id })) });
      }
      storeDiagnosticIds([], user);
      return { ids, cancelled: true };
    });
  }

  function handleAction(extra = {}) {
    actionHandler?.(extra);
    return extra;
  }

  async function setupListeners(onOpen) {
    const activePlugin = currentPlugin();
    if (onOpen) actionHandler = onOpen;
    if (!currentSupported() || !activePlugin?.addListener || listenerReady) return;
    listenerReady = true;
    try {
      const listener = await activePlugin.addListener("localNotificationActionPerformed", (event) => {
        handleAction(event?.notification?.extra || {});
      });
      listenerHandle = listener;
      listenerSetupError = "";
    } catch (error) {
      listenerReady = false;
      listenerHandle = null;
      listenerSetupError = error.message || "알림 동작 연결을 초기화하지 못했습니다.";
      throw error;
    }
  }

  async function initialize({ onAction } = {}) {
    if (onAction) actionHandler = onAction;
    const account = accountSnapshot();
    return enqueue(async () => {
      activateAccount(account.user);
      await retryPendingClears();
      try {
        await setupListeners(onAction);
      } catch {
        // The status carries the setup error and resume retries the listener.
      }
      return {
        ...(await refresh(account)),
        error: listenerSetupError
      };
    });
  }

  async function handleResume() {
    const account = accountSnapshot();
    return enqueue(async () => {
      activateAccount(account.user);
      let setupError = "";
      if (!listenerReady) {
        try {
          await setupListeners(actionHandler);
        } catch (error) {
          setupError = error.message || listenerSetupError;
        }
      }
      let syncResult;
      try {
        syncResult = await syncNow({}, account);
      } catch (error) {
        syncResult = { scheduled: 0, effective: false, error: error.message || "예약 알림을 동기화하지 못했습니다." };
      }
      const status = await refresh(account);
      return {
        sync: syncResult,
        status: {
          ...status,
          error: [setupError, syncResult.error, status.error].filter(Boolean).join(" · ")
        }
      };
    });
  }

  return {
    preferenceEnabled,
    refresh,
    enable,
    disable,
    clearAccount,
    cleanup,
    sync,
    initialize,
    handleResume,
    handleAction,
    notifyCreated,
    scheduleDiagnostic,
    getPending,
    cancelDiagnostics,
    setupListeners,
    getListenerHandle: () => listenerHandle,
    getStoredIds: storedIds,
    getEffective: async () => {
      const permissionState = await permission();
      return preferenceEnabled() && permissionState === "granted";
    }
  };
}

export function nativeNotificationPreferenceEnabled() {
  return getBridgeManager().preferenceEnabled();
}

let bridgeManager;

function getBridgeManager() {
  if (!bridgeManager) {
    bridgeManager = createNotificationManager({
      plugin: () => localNotificationsPlugin(),
      storage: globalThis.localStorage,
      userId: () => state.user?.id || "anonymous",
      role: () => state.user?.role || "student",
      reservations: () => state.myReservations || [],
      summary: () => state.summary || {},
      reportDeadlineHours: () => Number(state.bootstrap?.settings?.studioReportDeadlineHours || 48),
      supported: () => nativeNotificationsSupported(),
      platform: () => nativePlatform()
    });
  }
  return bridgeManager;
}

export function plannedReservationNotifications(now = new Date()) {
  return planReservationNotifications({
    userId: state.user?.id || "user",
    reservations: state.myReservations || [],
    now,
    reportDeadlineHours: Number(state.bootstrap?.settings?.studioReportDeadlineHours || 48)
  });
}

export function plannedAdminNotifications(now = new Date()) {
  if (state.user?.role !== "admin") return [];
  return planAdminNotifications({ userId: state.user?.id || "admin", summary: state.summary || {}, now });
}

export function plannedNativeNotifications(now = new Date()) {
  return state.user?.role === "admin" ? plannedAdminNotifications(now) : plannedReservationNotifications(now);
}

export async function notifyNativeReservationCreated(reservation) {
  return getBridgeManager().notifyCreated(reservation);
}

export async function refreshNativeNotificationState() {
  state.nativeNotifications = await getBridgeManager().refresh();
  return state.nativeNotifications;
}

function routeNativeNotification(extra, onOpenReservation) {
  if (extra.route === "admin") {
    state.adminView = extra.adminView || "dashboard";
  } else {
    state.view = extra.route === "reports" ? "reports" : "mine";
    if (state.view === "reports" && extra.reservationId) state.activeReportReservationId = extra.reservationId;
  }
  onOpenReservation?.();
}

export async function initializeNativeNotifications(onOpenReservation) {
  state.nativeNotifications = await getBridgeManager().initialize({
    onAction: (extra) => routeNativeNotification(extra, onOpenReservation)
  });
  installNativeNotificationDiagnostics();
  return state.nativeNotifications;
}

export async function enableNativeReservationNotifications() {
  try {
    state.nativeNotifications = await getBridgeManager().enable();
    return state.nativeNotifications;
  } catch (error) {
    state.nativeNotifications = {
      ...(await getBridgeManager().refresh()),
      error: error.message || "알림을 켜지 못했습니다."
    };
    throw error;
  }
}

export async function disableNativeReservationNotifications() {
  state.nativeNotifications = await getBridgeManager().disable();
  return state.nativeNotifications;
}

export async function clearNativeNotificationAccount(userId = state.user?.id || "anonymous") {
  state.nativeNotifications = await getBridgeManager().clearAccount(userId);
  return state.nativeNotifications;
}

export async function syncNativeReservationNotifications(options = {}) {
  const result = await getBridgeManager().sync(options);
  state.nativeNotifications = {
    ...(await getBridgeManager().refresh()),
    error: result.error || ""
  };
  return result;
}

export async function handleNativeNotificationResume() {
  const result = await getBridgeManager().handleResume();
  state.nativeNotifications = result.status;
  return result;
}

export async function setupNativeNotificationListeners(onOpenReservation) {
  return getBridgeManager().setupListeners((extra) => routeNativeNotification(extra, onOpenReservation));
}

export function installNativeNotificationDiagnostics() {
  if (globalThis.window?.GJU_NOTIFICATION_DIAGNOSTICS !== true) return null;
  const manager = getBridgeManager();
  const diagnostics = Object.freeze({
    enabled: true,
    scheduleTest: (delaySeconds = 10) => manager.scheduleDiagnostic(delaySeconds),
    pending: () => manager.getPending(),
    cancel: () => manager.cancelDiagnostics()
  });
  globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS = diagnostics;
  if (globalThis.window.GJU_NOTIFICATION_DIAGNOSTICS_AUTORUN === true) {
    const autorunKey = "gju_notification_diagnostics_autorun_v1";
    let shouldRun = true;
    try {
      shouldRun = globalThis.localStorage?.getItem(autorunKey) !== "1";
      if (shouldRun) globalThis.localStorage?.setItem(autorunKey, "1");
    } catch {
      shouldRun = true;
    }
    if (shouldRun) {
      void manager.enable()
        .then(() => manager.scheduleDiagnostic(10))
        .catch((error) => globalThis.console?.error?.("GJU notification diagnostic autorun failed", error));
    }
  }
  return diagnostics;
}

function watchText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, 90);
}

export function watchReservationSnapshot(reservations = state.myReservations || []) {
  return (Array.isArray(reservations) ? reservations : [])
    .filter((reservation) => reservation && !TERMINAL_STATUSES.has(reservation.status))
    .sort((a, b) => (reservationStartDate(a)?.getTime?.() || Number.MAX_SAFE_INTEGER) - (reservationStartDate(b)?.getTime?.() || Number.MAX_SAFE_INTEGER))
    .slice(0, 10)
    .map((reservation, index) => {
      const type = typeLabel[reservation.type] || "예약";
      const status = statusLabel[reservation.status] || reservation.status || "진행 중";
      const startAt = reservationStartDate(reservation);
      return {
        id: watchText(reservation.id, `${reservation.type || "reservation"}-${index}`),
        type: watchText(type),
        status: watchText(status),
        title: watchText(`${type} · ${status}`),
        subtitle: watchText(reservationMeta(reservation), type),
        dateLabel: watchText(startAt ? startAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : reservation.fields?.reservedDate || "")
      };
    });
}

export async function syncWatchReservationSnapshot({ silent = false } = {}) {
  const reservations = watchReservationSnapshot();
  const plugin = watchReservationsPlugin();
  if (!globalThis.window?.GJU_NATIVE_APP || nativePlatform() !== "ios" || !plugin?.sync) return { supported: false, reservations: reservations.length };
  try {
    return await plugin.sync({ reservations, syncedAt: new Date().toISOString() });
  } catch (error) {
    if (!silent) throw error;
    return { supported: true, reservations: reservations.length, error: error.message || "Apple Watch 예약 정보를 동기화하지 못했습니다." };
  }
}
