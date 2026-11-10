import { equipmentScheduledWindow } from "../public/js/equipment-schedule.mjs";
import { DIGITAL_LAB_SEATS, evaluateDigitalLabSelection, overlappingDigitalLabReservations } from "./digital-lab.mjs";

export function digitalLabAvailability(db, fields, { viewerId, editing, now }) {
  const mySeatIds = new Set(overlappingDigitalLabReservations(db, fields)
    .filter((reservation) => reservation.userId === viewerId)
    .map((reservation) => reservation.fields.seatId));
  const options = { userId: editing?.userId ?? viewerId, editingId: editing?.id, now };
  return {
    date: fields.reservedDate,
    startTime: fields.startTime,
    endTime: fields.endTime,
    generatedAt: now.toISOString(),
    seats: DIGITAL_LAB_SEATS.map((seat) => ({
      ...seat,
      ...evaluateDigitalLabSelection(db, { ...fields, seatId: seat.id }, options),
      isMine: mySeatIds.has(seat.id)
    }))
  };
}

export function getEquipmentHandoffBlockers(db, reservation, now = new Date()) {
  if (reservation.type !== "equipment") return [];
  const window = equipmentScheduledWindow(reservation.fields);
  return (reservation.fields?.equipmentItemIds || []).flatMap(equipmentId => {
    const item = db.equipment.find(eq => eq.id === equipmentId);
    const blockers = [];
    if (!window || Date.parse(window.startAt) > new Date(now).getTime()) blockers.push({ equipmentId, reason: "not_started" });
    if (!item || item.active === false || item.status !== "가능" || item.reservable === false) blockers.push({ equipmentId, reason: "unavailable" });
    if (db.reservations.some(r => r.id !== reservation.id && r.type === "equipment" && r.status === "checked_out" && r.fields?.equipmentItemIds?.includes(equipmentId))) blockers.push({ equipmentId, reason: "not_returned" });
    return blockers;
  });
}
export function createReservationViewHelpers({ publicUser, reservationTiming }) {
  function equipmentItemsFor(db, reservation) {
    return reservation.type === "equipment"
      ? (reservation.fields?.equipmentItemIds || []).map((itemId) => db.equipment.find((item) => item.id === itemId)).filter(Boolean)
      : [];
  }

  function withReservationDetails(db, reservation) {
    const user = db.users.find((item) => item.id === reservation.userId);
    const equipmentItems = equipmentItemsFor(db, reservation);
    const timing = reservationTiming(reservation, db.settings);
    return {
      ...reservation,
      ...(reservation.type === "equipment" ? { handoffBlockers: getEquipmentHandoffBlockers(db, reservation), handoffNeedsReview: getEquipmentHandoffBlockers(db, reservation).some(b => b.reason !== "not_started") } : {}),
      user: user ? publicUser(user) : null,
      equipmentItems,
      ...(timing ? { timing } : {})
    };
  }

  function publicReservationSummary(db, reservation) {
    const user = db.users.find((item) => item.id === reservation.userId);
    const equipmentItems = equipmentItemsFor(db, reservation);
    const fields = reservation.fields || {};
    const timing = reservationTiming(reservation, db.settings);
    return {
      ...(reservation.type === "equipment" ? { handoffNeedsReview: getEquipmentHandoffBlockers(db, reservation).some(b => b.reason !== "not_started") } : {}),
      id: reservation.id,
      type: reservation.type,
      status: reservation.status,
      userId: reservation.userId,
      userName: user?.name || "예약자",
      userStatus: user?.studentStatus || "",
      fields: {
        reservedDate: fields.reservedDate || "",
        ...(reservation.type === "digital_lab" ? { seatId: fields.seatId || "" } : {}),
        period: fields.period || "",
        rentalTime: fields.rentalTime || "",
        returnTime: fields.returnTime || "",
        timeSlots: fields.timeSlots || [],
        studioSpaces: fields.studioSpaces || [],
        studioSpace: fields.studioSpace || "",
        processTypes: fields.processTypes || [],
        participantCount: fields.participantCount || "",
        printType: fields.printType || "",
        startTime: fields.startTime || "",
        endTime: fields.endTime || "",
        cameraBagConfirmationRequired: Boolean(fields.cameraBagConfirmationRequired),
        cameraBagConfirmed: Boolean(fields.cameraBagConfirmed),
        pelicanBagReserved: Boolean(fields.pelicanBagReserved)
      },
      equipmentItems: equipmentItems.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category
      })),
      ...(timing ? { timing } : {})
    };
  }

  return { publicReservationSummary, withReservationDetails };
}
