const TERMINAL_RETENTION_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected", "returned", "completed"]);

function cutoffMs(nowDate, days) {
  return nowDate.getTime() - days * 24 * 60 * 60 * 1000;
}

function parseRecordTime(value) {
  if (!value) return Number.NaN;
  const text = String(value);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? Date.parse(`${text}T00:00:00+09:00`)
    : Date.parse(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function reservationRetentionTime(reservation) {
  return parseRecordTime(reservation.fields?.reservedDate) ||
    parseRecordTime(reservation.updatedAt) ||
    parseRecordTime(reservation.createdAt);
}

export function createMaintenanceHelpers({
  normalizeDb,
  capLogs,
  id,
  reservationRetentionDays = 90,
  reportHtmlRetentionDays = 183
}) {
  function cleanupExpiredData(db, nowDate = new Date(), actorId = "system") {
    normalizeDb(db);
    const nowValue = nowDate.toISOString();
    const nowMs = nowDate.getTime();
    const reservationCutoff = cutoffMs(nowDate, reservationRetentionDays);
    const reportHtmlCutoff = cutoffMs(nowDate, reportHtmlRetentionDays);
    const summary = {
      at: nowValue,
      anonymizedReservations: 0,
      deletedReportHtmlSnapshots: 0,
      deletedExpiredSessions: 0
    };

    for (const reservation of db.reservations) {
      if (!TERMINAL_RETENTION_STATUSES.has(reservation.status) || reservation.retentionAnonymizedAt) continue;
      const retentionTime = reservationRetentionTime(reservation);
      if (!Number.isFinite(retentionTime) || retentionTime > reservationCutoff) continue;
      reservation.userId = "";
      reservation.fields = {
        ...reservation.fields,
        phone: "",
        studentStatus: "",
        renterName: "",
        userName: ""
      };
      reservation.history = [];
      reservation.retentionAnonymizedAt = nowValue;
      summary.anonymizedReservations += 1;
    }

    for (const report of db.reports) {
      if (!report.htmlSnapshot || report.htmlDeletedAt) continue;
      const expiresAt = parseRecordTime(report.expiresAt);
      const submittedAt = parseRecordTime(report.submittedAt);
      const expiredByDate = Number.isFinite(expiresAt) && expiresAt <= nowMs;
      const expiredBySubmittedAt = Number.isFinite(submittedAt) && submittedAt <= reportHtmlCutoff;
      if (!expiredByDate && !expiredBySubmittedAt) continue;
      report.htmlSnapshot = "";
      report.htmlDeletedAt = nowValue;
      summary.deletedReportHtmlSnapshots += 1;
    }

    const beforeSessions = db.sessions.length;
    db.sessions = db.sessions.filter((session) => parseRecordTime(session.expiresAt) > nowDate.getTime());
    summary.deletedExpiredSessions = beforeSessions - db.sessions.length;

    const changed = summary.anonymizedReservations ||
      summary.deletedReportHtmlSnapshots ||
      summary.deletedExpiredSessions;
    if (changed) {
      db.auditLogs.push({
        id: id("audit"),
        actorId,
        action: "maintenance.cleanup",
        targetId: "db",
        detail: summary,
        createdAt: nowValue
      });
      capLogs(db);
    }
    return { ...summary, changed: Boolean(changed) };
  }

  function closeSemesterData(db, actorId = "system") {
    normalizeDb(db);
    const reservationIds = new Set(db.reservations.map((reservation) => reservation.id));
    const summary = {
      deletedReservations: db.reservations.length,
      deletedReports: db.reports.filter((report) => reservationIds.has(report.reservationId)).length,
      deletedSessions: db.sessions.length
    };

    db.reservations = [];
    db.reports = db.reports.filter((report) => !reservationIds.has(report.reservationId));
    db.sessions = [];
    db.auditLogs.push({
      id: id("audit"),
      actorId,
      action: "maintenance.semester_close",
      targetId: "db",
      detail: summary,
      createdAt: new Date().toISOString()
    });
    capLogs(db);
    return summary;
  }

  return { cleanupExpiredData, closeSemesterData };
}
