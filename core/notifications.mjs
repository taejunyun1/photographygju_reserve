export function createNotificationHelpers({
  id,
  maskPhone,
  normalizeStatusLabel,
  reservationTitle,
  studioSpaces,
  nowIso
}) {
  function formatSlackMessage(db, event, reservation) {
    const user = db.users.find((item) => item.id === reservation.userId) || {};
    const title = {
      student_signup: "[학생 가입 승인 요청]",
      reservation_created: `[${reservationTitle(reservation.type)} 예약 ${reservation.type === "equipment" ? "승인 요청" : "확정"}]`,
      reservation_updated: `[${reservationTitle(reservation.type)} 예약 수정]`,
      reservation_cancelled: `[${reservationTitle(reservation.type)} 예약 취소]`,
      reservation_status: `[${reservationTitle(reservation.type)} 상태 변경]`,
      studio_report: "[스튜디오 보고서 제출]"
    }[event] || "[GJU Photography Reservation]";

    if (event === "student_signup") {
      return `${title}\n이름: ${reservation.name}\n학번: ${reservation.studentId || "-"}\n신분: ${reservation.studentStatus}\n연락처: ${maskPhone(reservation.phone)}\n상태: 승인 대기`;
    }

    const fields = reservation.fields || {};
    const detailUrl = `${db.settings.adminUrl}/reservations/${reservation.id}`;
    const lines = [
      title,
      `예약자: ${user.name || "-"} / ${maskPhone(fields.phone || user.phone)}`,
      `신분: ${fields.studentStatus || user.studentStatus || "-"}`,
      `사용일: ${fields.reservedDate || "-"}`,
      `상태: ${normalizeStatusLabel(reservation.status)}`
    ];

    if (reservation.type === "equipment") {
      const items = (fields.equipmentItemIds || []).map((itemId) => db.equipment.find((item) => item.id === itemId)).filter(Boolean).map((item) => item.code).join(", ");
      lines.splice(4, 0, `대여시간: ${fields.rentalTime}`, `반납시간: ${fields.returnTime}`, `품목: ${items || fields.detailEquipment || "-"}`);
    }
    if (reservation.type === "studio") lines.splice(4, 0, `시간: ${(fields.timeSlots || []).join(", ")}`, `장소: ${studioSpaces(fields).join(", ")}`, `필요 장비: ${fields.requiredEquipment || "-"}`);
    if (reservation.type === "darkroom") {
      const chemicals = (fields.chemicals || []).map((item) => `${item.name} ${item.amount}`).join(", ");
      lines.splice(4, 0, `시간: ${(fields.timeSlots || []).join(", ")}`, `작업: ${(fields.processTypes || []).join(", ")}`, `사용 약품: ${chemicals || "-"}`);
    }
    if (reservation.type === "print") lines.splice(4, 0, `시간: ${fields.startTime}-${fields.endTime}`, `출력: ${fields.printType} / ${fields.paper} / ${fields.size}`, `매수: ${fields.count || "-"}`);

    lines.push(`상세: ${detailUrl}`);
    return lines.join("\n");
  }

  async function postSlack(webhook, db, event, payload) {
    const log = { id: id("slack"), event, status: "skipped", message: "", createdAt: nowIso() };
    const text = typeof payload === "string" ? payload : formatSlackMessage(db, event, payload);
    log.message = text;

    if (!webhook) {
      db.slackLogs.push(log);
      return log;
    }

    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      });
      log.status = response.ok ? "sent" : "failed";
      log.response = await response.text();
    } catch (error) {
      log.status = "failed";
      log.response = error.message;
    }
    db.slackLogs.push(log);
    return log;
  }

  return {
    formatSlackMessage,
    postSlack
  };
}
