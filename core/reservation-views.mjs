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
      id: reservation.id,
      type: reservation.type,
      status: reservation.status,
      userId: reservation.userId,
      userName: user?.name || "예약자",
      userStatus: user?.studentStatus || "",
      fields: {
        reservedDate: fields.reservedDate || "",
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
