/**
 * Shared report policy and validation.
 *
 * Reports are intentionally derived from reservations rather than from UI
 * dates.  This keeps the student list, admin queue and dashboard counters on
 * the same source of truth.
 */

export const REPORT_SCHEMA_VERSION = 2;
export const REPORT_POLICY_VERSION = 2;
export const REPORT_PHOTO_LIMIT = 5;
export const REPORT_PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const REPORT_DESCRIPTION_MAX = 2000;
export const REPORT_NOTES_MAX = 2000;
export const DEFAULT_EQUIPMENT_REPORT_DEADLINE_HOURS = 48;
export const MIN_REPORT_DEADLINE_HOURS = 1;
export const MAX_REPORT_DEADLINE_HOURS = 720;

const INELIGIBLE = new Set(["cancelled", "admin_cancelled", "rejected"]);

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoOrNull(value) {
  const date = asDate(value);
  return date ? date.toISOString() : null;
}

function reservationEnd(reservation) {
  const explicit = asDate(reservation?.timing?.endAt || reservation?.fields?.endAt);
  if (explicit) return explicit;
  const date = String(reservation?.fields?.reservedDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // A date-only fallback is deliberately end-of-day. It prevents an old
  // reservation from being blocked forever when timing could not be rebuilt.
  return new Date(`${date}T23:59:59.999+09:00`);
}

function historyAt(reservation, actions) {
  const matches = (reservation?.history || [])
    .filter((item) => actions.has(item.action) && asDate(item.at))
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime());
  return matches[0]?.at || null;
}

function reportFor(db, reservation, type = reservation?.type) {
  return (db?.reports || []).find((report) => report.reservationId === reservation?.id && report.type === type) || null;
}

function settingHours(settings, key, fallback) {
  const value = Number(settings?.[key]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(MAX_REPORT_DEADLINE_HOURS, Math.max(MIN_REPORT_DEADLINE_HOURS, Math.floor(value)));
}

function requirementForTiming({ reservation, type, now, settings }) {
  const endAt = reservationEnd(reservation);
  const endMs = endAt?.getTime() || 0;
  const nowMs = now.getTime();
  const studio = type === "studio";
  const checkedOut = reservation?.status === "checked_out";
  const returned = reservation?.status === "returned";
  const hasStarted = studio
    ? endMs > 0 && nowMs >= (asDate(reservation?.timing?.startAt)?.getTime() || 0)
    : checkedOut || returned;
  const canDraft = studio
    ? Boolean(reservation?.fields?.reservedDate) && (hasStarted || nowMs >= endMs)
    : checkedOut || returned;
  const canSubmit = studio ? Boolean(endMs && nowMs >= endMs) : Boolean(returned || (endMs && nowMs >= endMs));
  const anchor = studio
    ? endAt
    : (asDate(historyAt(reservation, new Set(["returned", "return_inspected"]))) || endAt);
  const deadlineHours = settingHours(settings, studio ? "studioReportDeadlineHours" : "equipmentReportDeadlineHours", studio ? 48 : DEFAULT_EQUIPMENT_REPORT_DEADLINE_HOURS);
  const deadlineAt = anchor ? new Date(anchor.getTime() + deadlineHours * 60 * 60 * 1000) : null;
  return { canDraft, canSubmit, endAt, deadlineAt, deadlineHours };
}

/**
 * Return the canonical report requirement for a reservation.
 */
export function getReportRequirement(db, reservation, now = new Date(), settings = db?.settings || {}) {
  const type = reservation?.type;
  const supported = type === "studio" || type === "equipment";
  const persisted = supported ? reportFor(db, reservation, type) : null;
  const base = {
    required: false,
    canDraft: false,
    canSubmit: false,
    dueAt: null,
    deadlineAt: null,
    reportId: persisted?.id || null,
    draftId: null,
    submitted: Boolean(persisted),
    reviewed: persisted?.status === "reviewed",
    overdue: false,
    type: supported ? type : null,
    policyVersion: Number(reservation?.fields?.reportPolicyVersion || 1)
  };
  if (!supported || !reservation?.id || INELIGIBLE.has(reservation.status)) return base;
  if (persisted) return { ...base, canDraft: false, canSubmit: false };

  // Equipment reports begin at physical hand-off. Approved requests are not
  // report obligations because the student may never receive the item.
  if (type === "equipment" && !["checked_out", "returned"].includes(reservation.status)) return base;
  const timing = requirementForTiming({ reservation, type, now: asDate(now) || new Date(), settings });
  const nowDate = asDate(now) || new Date();
  const required = type === "studio"
    ? Boolean(reservation.fields?.reservedDate) && (timing.canDraft || new Date(`${reservation.fields.reservedDate}T00:00:00+09:00`) <= nowDate)
    : true;
  const overdue = Boolean(timing.deadlineAt && nowDate.getTime() > timing.deadlineAt.getTime());
  return {
    ...base,
    required,
    canDraft: timing.canDraft,
    canSubmit: timing.canSubmit,
    dueAt: timing.endAt?.toISOString() || null,
    deadlineAt: timing.deadlineAt?.toISOString() || null,
    overdue,
    policyVersion: Math.max(REPORT_POLICY_VERSION, Number(reservation?.fields?.reportPolicyVersion || REPORT_POLICY_VERSION))
  };
}

function answerFrom(body, type) {
  const checks = body?.checks || {};
  const key = type === "studio" ? "studio" : "equipment";
  const raw = checks?.[key]?.answer ?? (type === "studio" ? body?.studioDamageAnswer : body?.equipmentDamageAnswer);
  if (raw === "yes" || raw === "no" || raw === "not_applicable") return raw;
  if (typeof body?.damageFound === "boolean") return body.damageFound ? "yes" : "no";
  return null;
}

function descriptionFrom(body, type) {
  const checks = body?.checks || {};
  const key = type === "studio" ? "studio" : "equipment";
  return String(checks?.[key]?.description ?? (type === "studio" ? body?.damageDescription : body?.equipmentDamageDescription) ?? "").trim();
}

function photosFor(photos, category) {
  return (Array.isArray(photos) ? photos : []).filter((photo) => String(photo?.category || "usage") === category);
}

/**
 * Validate and normalize a report draft. The function does not mutate the DB
 * and can therefore be used by both the legacy and v2 routes.
 */
export function validateReportDraft({ reservation, type = reservation?.type, body = {}, photos = [], now = new Date() }) {
  if (!reservation || !["studio", "equipment"].includes(type)) throw Object.assign(new Error("지원하지 않는 보고서 종류입니다."), { status: 400 });
  if (INELIGIBLE.has(reservation.status)) throw Object.assign(new Error("취소되었거나 반려된 예약에는 보고서를 제출할 수 없습니다."), { status: 400 });
  if (type === "equipment" && !["checked_out", "returned"].includes(reservation.status)) {
    throw Object.assign(new Error("기자재를 실제로 인계받은 후 보고서를 작성할 수 있습니다."), { status: 400 });
  }
  const studioAnswer = answerFrom(body, "studio");
  const equipmentAnswer = answerFrom(body, "equipment");
  const activeAnswer = type === "studio" ? studioAnswer : equipmentAnswer;
  if (activeAnswer === null) throw Object.assign(new Error("파손·이상 여부를 선택하세요."), { status: 400 });
  const combinedStudioChecks = type === "studio" && body?._legacy !== true;
  if (combinedStudioChecks && equipmentAnswer === null) {
    throw Object.assign(new Error("스튜디오와 대여 기자재의 파손·이상 여부를 모두 선택하세요."), { status: 400 });
  }
  if (type === "studio" && body.cleanupConfirmed !== true) throw Object.assign(new Error("정리정돈 확인이 필요합니다."), { status: 400 });
  if (type === "equipment" && body.returnReadyConfirmed !== true && body.cleanupConfirmed !== true) {
    throw Object.assign(new Error("반납 준비 상태를 확인하세요."), { status: 400 });
  }
  const studioDescription = descriptionFrom(body, "studio");
  const equipmentDescription = descriptionFrom(body, "equipment");
  const checksToValidate = type === "equipment"
    ? [{ answer: equipmentAnswer, description: equipmentDescription, category: "equipment_damage" }]
    : [
      { answer: studioAnswer, description: studioDescription, category: "studio_damage" },
      ...(combinedStudioChecks ? [{ answer: equipmentAnswer, description: equipmentDescription, category: "equipment_damage" }] : [])
    ];
  for (const check of checksToValidate) {
    const checkPhotos = photosFor(photos, check.category);
    if (check.answer === "yes" && !check.description) throw Object.assign(new Error("파손·이상 내용을 입력하세요."), { status: 400 });
    if (check.description.length > REPORT_DESCRIPTION_MAX) throw Object.assign(new Error(`파손·이상 내용은 ${REPORT_DESCRIPTION_MAX}자 이하로 입력하세요.`), { status: 400 });
    if (check.answer === "yes" && checkPhotos.length < 1) throw Object.assign(new Error("파손·이상 사진을 1장 이상 첨부하세요."), { status: 400 });
  }
  if (!Array.isArray(photos) || photos.length > REPORT_PHOTO_LIMIT) throw Object.assign(new Error(`사진은 보고서당 ${REPORT_PHOTO_LIMIT}장까지 첨부할 수 있습니다.`), { status: 400 });
  for (const photo of photos) {
    const size = Number(photo?.size || 0);
    if (size <= 0 || size > REPORT_PHOTO_MAX_BYTES) throw Object.assign(new Error("사진은 3MiB 이하로 업로드하세요."), { status: 400 });
    if (!/^image\/(jpeg|png)$/i.test(String(photo?.mimeType || photo?.type || ""))) throw Object.assign(new Error("JPG 또는 PNG 사진만 업로드할 수 있습니다."), { status: 400 });
  }
  const notes = String(body.notes || "").trim();
  if (notes.length > REPORT_NOTES_MAX) throw Object.assign(new Error(`비고는 ${REPORT_NOTES_MAX}자 이하로 입력하세요.`), { status: 400 });
  const actualTime = String(body.actualTime || "").trim();
  const participants = String(body.participants || "").trim();
  if (type === "studio" && (!actualTime || !participants)) throw Object.assign(new Error("실제 사용 시간과 사용 인원을 입력하세요."), { status: 400 });
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    actualTime,
    participants,
    usedEquipment: body.usedEquipment || "",
    cleanupConfirmed: body.cleanupConfirmed === true,
    returnReadyConfirmed: body.returnReadyConfirmed === true || body.cleanupConfirmed === true,
    checks: {
      studio: {
        answer: type === "studio" ? studioAnswer : "not_applicable",
        description: type === "studio" ? studioDescription : "",
        equipmentLabel: String(body?.checks?.studio?.equipmentLabel || body.studioEquipmentLabel || "").trim()
      },
      equipment: {
        answer: type === "equipment" || combinedStudioChecks ? equipmentAnswer : "not_applicable",
        description: type === "equipment" || combinedStudioChecks ? equipmentDescription : "",
        equipmentIds: Array.isArray(body?.checks?.equipment?.equipmentIds)
          ? body.checks.equipment.equipmentIds.map(String).filter(Boolean)
          : (Array.isArray(body.equipmentIds) ? body.equipmentIds.map(String).filter(Boolean) : [])
      }
    },
    damageFound: checksToValidate.some((check) => check.answer === "yes"),
    damageDescription: type === "studio" ? studioDescription : equipmentDescription,
    equipmentDamageDescription: type === "studio" ? equipmentDescription : "",
    notes,
    resultPhotoUrl: String(body.resultPhotoUrl || "").trim(),
    submittedAt: isoOrNull(now)
  };
}

export function reservationSnapshot(reservation, user, equipmentItems = []) {
  return {
    reservationId: reservation?.id || "",
    type: reservation?.type || "",
    status: reservation?.status || "",
    fields: { ...(reservation?.fields || {}) },
    equipmentItems: equipmentItems.map((item) => ({ id: item.id, code: item.code || "", name: item.name || "", category: item.category || "" })),
    user: { id: user?.id || "", name: user?.name || "", studentId: user?.studentId || "" }
  };
}

export function reportQueueCount(db, now = new Date()) {
  return (db?.reservations || []).filter((reservation) => getReportRequirement(db, reservation, now).required).length;
}
