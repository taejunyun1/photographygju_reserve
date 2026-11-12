import { createNoticeReader } from "./notice-announcements.js?v=20261110-digital-lab-r1";

const STUDENT_VIEWS = new Set(["home", "reserve", "mine", "reports", "lectures", "notices", "my"]);
const RESERVATION_TYPES = new Set(["equipment", "studio", "darkroom", "print", "digital_lab"]);
const INACTIVE_DIGITAL_LAB_STATUSES = new Set(["cancelled", "admin_cancelled", "rejected", "returned", "completed"]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function seoulToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function notificationSnapshot(value = {}) {
  const permission = String(value.permission || "unknown");
  const effective = value.effective === undefined
    ? Boolean(value.enabled && permission === "granted")
    : Boolean(value.effective);
  return {
    supported: Boolean(value.supported),
    enabled: effective,
    effective,
    permission,
    pendingCount: Math.max(0, Number(value.pendingCount || 0)),
    syncedAt: String(value.syncedAt || ""),
    error: String(value.error || "")
  };
}

export function studentReactSnapshot(state, today = seoulToday()) {
  const bootstrap = state.bootstrap || {};
  const reservationType = RESERVATION_TYPES.has(state.reservationType) ? state.reservationType : undefined;
  return {
    view: STUDENT_VIEWS.has(state.view) ? state.view : "home",
    today,
    user: state.user || { name: "학생" },
    transientMessageActive: Boolean(state.toast),
    facilityTimeline: state.facilityTimeline || { date: today, data: null, loading: false, error: "", lastSucceededAt: "" },
    bootstrap: {
      settings: bootstrap.settings || {},
      notices: asArray(bootstrap.notices),
      noticeReaderId: bootstrap.noticeReaderId || null,
      readNoticeIds: asArray(bootstrap.readNoticeIds),
      equipment: asArray(bootstrap.equipment),
      darkroomChemicals: asArray(bootstrap.darkroomChemicals),
      reservations: asArray(bootstrap.reservations)
    },
    myReservations: asArray(state.myReservations),
    lectures: asArray(state.lectures),
    favoriteGroups: asArray(state.favoriteGroups),
    recentReservations: asArray(state.recentReservations),
    courseDemandSurveys: asArray(state.courseDemandSurveys),
    rebookingDetails: state.rebookingDetails || null,
    reservationRecommendations: state.reservationRecommendations || null,
    reservationType,
    reservationFlowStep: {
      equipment: state.reservationFlowStep?.equipment || "date",
      studio: state.reservationFlowStep?.studio || "date",
      darkroom: state.reservationFlowStep?.darkroom || "date",
      print: state.reservationFlowStep?.print || "date",
      digital_lab: state.reservationFlowStep?.digital_lab || "date"
    },
    selectedDates: {
      equipment: state.selectedDates?.equipment || "",
      studio: state.selectedDates?.studio || "",
      darkroom: state.selectedDates?.darkroom || "",
      print: state.selectedDates?.print || "",
      digital_lab: state.selectedDates?.digital_lab || ""
    },
    selectedEquipmentPeriod: state.selectedEquipmentPeriod || "",
    selectedEquipmentRentalTime: state.selectedEquipmentRentalTime || "",
    selectedEquipmentReturnTime: state.selectedEquipmentReturnTime || "",
    selectedEquipmentItemIds: asArray(state.selectedEquipmentItemIds),
    selectedRequestedEquipment: asArray(state.selectedRequestedEquipment),
    selectedStudioSpace: state.selectedStudioSpace || "",
    selectedStudioSlots: asArray(state.selectedStudioSlots),
    selectedDarkroomSlots: asArray(state.selectedDarkroomSlots),
    selectedDarkroomProcessTypes: asArray(state.selectedDarkroomProcessTypes),
    selectedDarkroomParticipantCount: state.selectedDarkroomParticipantCount || "1",
    selectedDarkroomChemicals: state.selectedDarkroomChemicals || {},
    selectedPrintStartTime: state.selectedPrintStartTime || "",
    selectedPrintEndTime: state.selectedPrintEndTime || "",
    selectedPrintTypes: asArray(state.selectedPrintTypes),
    selectedPrintPapers: asArray(state.selectedPrintPapers),
    selectedPrintSizes: asArray(state.selectedPrintSizes),
    selectedDigitalLabStartTime: state.selectedDigitalLabStartTime || "",
    selectedDigitalLabEndTime: state.selectedDigitalLabEndTime || "",
    selectedDigitalLabSeatId: state.selectedDigitalLabSeatId || "",
    digitalLabEditing: state.digitalLabEditing || null,
    digitalLabAvailability: state.digitalLabAvailability || null,
    activeNoticeId: state.activeNoticeId || null,
    activeReportReservationId: state.activeReportReservationId || null,
    nativeNotifications: notificationSnapshot(state.nativeNotifications)
  };
}

function resetReservationSelection(state, type) {
  state.reservationType = "";
  if (state.selectedDates) state.selectedDates[type] = "";
  if (type === "equipment") {
    state.selectedEquipmentItemIds = [];
    state.selectedRequestedEquipment = [];
    state.selectedEquipmentPeriod = "";
    state.selectedEquipmentRentalTime = "";
    state.selectedEquipmentReturnTime = "";
  } else if (type === "studio") {
    state.selectedStudioSpace = "";
    state.selectedStudioSlots = [];
  } else if (type === "darkroom") {
    state.selectedDarkroomSlots = [];
    state.selectedDarkroomProcessTypes = [];
    state.selectedDarkroomParticipantCount = "1";
    state.selectedDarkroomChemicals = {};
  } else if (type === "print") {
    state.selectedPrintStartTime = "";
    state.selectedPrintEndTime = "";
    state.selectedPrintTypes = [];
    state.selectedPrintPapers = [];
    state.selectedPrintSizes = [];
  } else if (type === "digital_lab") {
    state.selectedDigitalLabStartTime = "";
    state.selectedDigitalLabEndTime = "";
    state.selectedDigitalLabSeatId = "";
    state.digitalLabEditing = null;
    state.digitalLabAvailability = null;
  }
}

function digitalLabAvailabilityQuery(state) {
  const query = new URLSearchParams({
    date: state.selectedDates.digital_lab || "",
    start: state.selectedDigitalLabStartTime || "",
    end: state.selectedDigitalLabEndTime || ""
  });
  if (state.digitalLabEditing?.id) query.set("editingId", state.digitalLabEditing.id);
  return query;
}

function applyDigitalLabPatch(state, patch) {
  const previousKey = digitalLabAvailabilityQuery(state).toString();
  if (patch.selectedDate !== undefined && patch.selectedDate !== state.selectedDates.digital_lab) {
    state.selectedDates.digital_lab = patch.selectedDate;
    state.selectedDigitalLabStartTime = "";
    state.selectedDigitalLabEndTime = "";
  }
  if (patch.digitalLabStartTime !== undefined) state.selectedDigitalLabStartTime = patch.digitalLabStartTime;
  if (patch.digitalLabEndTime !== undefined) state.selectedDigitalLabEndTime = patch.digitalLabEndTime;
  const changed = previousKey !== digitalLabAvailabilityQuery(state).toString();
  if (changed) {
    state.selectedDigitalLabSeatId = "";
    state.digitalLabAvailability = null;
  }
  if (patch.digitalLabSeatId !== undefined) state.selectedDigitalLabSeatId = patch.digitalLabSeatId;
  return changed;
}

function applySelectionPatch(state, patch) {
  const type = patch?.type;
  if (!RESERVATION_TYPES.has(type)) return;
  if (type === "digital_lab") return applyDigitalLabPatch(state, patch);
  if (patch.selectedDate !== undefined) state.selectedDates[type] = patch.selectedDate;
  const mappings = {
    equipmentPeriod: "selectedEquipmentPeriod",
    equipmentRentalTime: "selectedEquipmentRentalTime",
    equipmentReturnTime: "selectedEquipmentReturnTime",
    equipmentItemIds: "selectedEquipmentItemIds",
    requestedEquipment: "selectedRequestedEquipment",
    studioSpace: "selectedStudioSpace",
    studioSlots: "selectedStudioSlots",
    darkroomSlots: "selectedDarkroomSlots",
    darkroomProcessTypes: "selectedDarkroomProcessTypes",
    darkroomParticipantCount: "selectedDarkroomParticipantCount",
    darkroomChemicals: "selectedDarkroomChemicals",
    printStartTime: "selectedPrintStartTime",
    printEndTime: "selectedPrintEndTime",
    printTypes: "selectedPrintTypes",
    printPapers: "selectedPrintPapers",
    printSizes: "selectedPrintSizes"
  };
  for (const [source, target] of Object.entries(mappings)) {
    if (patch[source] !== undefined) state[target] = patch[source];
  }
}

function reusableText(value) {
  return String(value || "").trim();
}

function reusableValues(value) {
  return asArray(value).map((item) => reusableText(item)).filter(Boolean);
}

function applyReusableReservationFields(state, reservation) {
  const type = reservation?.type;
  if (!RESERVATION_TYPES.has(type)) return false;

  for (const reservationType of RESERVATION_TYPES) resetReservationSelection(state, reservationType);
  clearReservationRecommendations(state);

  const source = reservation?.fields || {};
  const fields = {
    period: reusableText(source.period),
    equipmentItemIds: reusableValues(source.equipmentItemIds),
    requestedEquipment: asArray(source.requestedEquipment).map((item) => ({
      name: reusableText(item?.name),
      quantity: Number(item?.quantity) || 1,
      note: reusableText(item?.note)
    })).filter((item) => item.name),
    studioSpace: reusableText(source.studioSpace) || reusableValues(source.studioSpaces)[0] || "",
    studioSpaces: reusableValues(source.studioSpaces),
    processTypes: reusableValues(source.processTypes),
    participantCount: source.participantCount === undefined || source.participantCount === null ? "" : String(source.participantCount),
    participants: reusableText(source.participants),
    requiredEquipment: reusableText(source.requiredEquipment),
    purpose: reusableText(source.purpose),
    standRequest: reusableText(source.standRequest),
    printType: reusableText(source.printType),
    paper: reusableText(source.paper),
    size: reusableText(source.size),
    count: Math.max(0, Number(source.count || 0)),
    memo: reusableText(source.memo)
  };

  if (type === "equipment") {
    state.selectedEquipmentPeriod = fields.period;
    state.selectedEquipmentItemIds = fields.equipmentItemIds;
    state.selectedRequestedEquipment = fields.requestedEquipment;
  } else if (type === "studio") {
    state.selectedStudioSpace = fields.studioSpace;
  } else if (type === "darkroom") {
    state.selectedDarkroomProcessTypes = fields.processTypes;
    state.selectedDarkroomParticipantCount = fields.participantCount || "1";
  } else if (type === "print") {
    state.selectedPrintTypes = fields.printType ? [fields.printType] : [];
    state.selectedPrintPapers = fields.paper ? [fields.paper] : [];
    state.selectedPrintSizes = fields.size ? [fields.size] : [];
  }

  state.rebookingDetails = { type, fields };
  state.reservationType = type;
  state.reservationFlowStep[type] = "date";
  state.view = "reserve";
  return true;
}

function clearReservationRecommendations(state) {
  state.reservationRecommendations = null;
}

function clearAuthenticatedState(state, clearStoredSession) {
  state.facilityTimeline = { date: "", data: null, loading: false, error: "", lastSucceededAt: "" };
  state.equipmentDraftFields = null;
  state.token = "";
  state.user = null;
  state.myReservations = [];
  state.selectedRequestedEquipment = [];
  state.favoriteGroups = [];
  state.recentReservations = [];
  state.courseDemandSurveys = [];
  state.rebookingDetails = null;
  resetReservationSelection(state, "digital_lab");
  clearReservationRecommendations(state);
  state.lectures = [];
  state.view = "home";
  state.reservationType = "";
  state.activeNoticeId = "";
  state.activeReportReservationId = "";
  clearStoredSession?.();
}

export function createStudentReactActions(dependencies) {
  const {
    state,
    api,
    uploadBinary,
    render,
    toast,
    loadBootstrap,
    loadMyReservations,
    loadLectures,
    loadFacilityTimeline: loadFacilityData = async () => null,
    invalidateFacilityTimelineCache: invalidateFacilityData = () => {},
    notifyNativeReservationCreated,
    clearNativeNotificationAccount,
    enableNativeReservationNotifications,
    disableNativeReservationNotifications,
    syncNativeReservationNotifications,
    handleNativeNotificationResume,
    logout,
    clearStoredSession = () => {},
    confirm: confirmAction = (message) => globalThis.confirm?.(message) ?? true
  } = dependencies;

  async function loadReservationShortcuts() {
    const viewer = state.user;
    const token = state.token;
    const result = await api("/api/me/reservation-shortcuts");
    if (state.user !== viewer || state.token !== token) return;
    state.favoriteGroups = asArray(result?.favoriteGroups);
    state.recentReservations = asArray(result?.recentReservations);
  }

  async function loadCourseDemandSurveys() {
    state.courseDemandSurveys = asArray(await api("/api/me/course-demand-surveys"));
  }

  async function loadReservationRecommendations(draft) {
    const result = await api("/api/reservations/recommendations", { method: "POST", body: draft });
    state.reservationRecommendations = {
      type: draft.type,
      alternatives: asArray(result?.alternatives)
    };
  }

  async function loadDigitalLabAvailability() {
    if (state.view !== "reserve" || state.reservationType !== "digital_lab") return;
    const query = digitalLabAvailabilityQuery(state);
    if (!["date", "start", "end"].every((field) => query.get(field))) return;
    const key = query.toString();
    const pending = { key, loading: true, error: "", data: null };
    const token = state.token;
    state.digitalLabAvailability = pending;
    render();
    let result;
    try {
      const data = await api(`/api/digital-lab/availability?${key}`, { loading: false });
      result = { ...pending, loading: false, data };
    } catch (error) {
      result = { ...pending, loading: false, error: error.message || "좌석 가용 상태를 불러오지 못했습니다." };
    }
    if (state.digitalLabAvailability !== pending || state.token !== token) return;
    state.digitalLabAvailability = result;
    render();
  }

  async function refreshStudentData({ includeLectures = true } = {}) {
    const jobs = [loadBootstrap(), loadMyReservations(), loadReservationShortcuts(), loadCourseDemandSurveys()];
    if (includeLectures) jobs.push(loadLectures());
    await Promise.all(jobs);
  }

  async function refreshAfterMutation(message, options) {
    invalidateFacilityData();
    try {
      await refreshStudentData(options);
      if (state.view === "home" && state.user?.approvalStatus === "approved") await loadFacilityData(state.facilityTimeline?.date || seoulToday(), { force: true });
      render();
    } catch (error) {
      toast(`${message} 최신 목록을 다시 불러오지 못했습니다: ${error.message || "새로고침 실패"}`, { tone: "error", preserveScroll: true });
    }
  }

  async function saveReportDraft(id, payload) {
    const reservation = asArray(state.myReservations).find((item) => item.id === id);
    if (!reservation || !["studio", "equipment"].includes(reservation.type)) throw new Error("보고서 예약을 찾을 수 없습니다.");
    const draft = await api("/api/reports/drafts", { method: "POST", body: { reservationId: id, type: reservation.type } });
    const fields = { ...(payload || {}) };
    delete fields.photos;
    let updatedDraft = draft;
    if (Object.keys(fields).length) {
      updatedDraft = await api(`/api/reports/drafts/${encodeURIComponent(draft.id)}`, {
        method: "PATCH",
        body: { revision: Number(draft.revision || 0), fields }
      });
    }
    for (const photo of asArray(payload?.photos)) {
      if (!photo?.file || ["uploaded", "deleted"].includes(photo.status)) continue;
      const reserved = await api(`/api/reports/drafts/${encodeURIComponent(draft.id)}/photos`, {
        method: "POST",
        body: {
          clientPhotoId: photo.clientPhotoId || photo.id,
          category: photo.category || "usage",
          mimeType: photo.mimeType || photo.file.type,
          size: Number(photo.size || photo.file.size)
        }
      });
      if (typeof uploadBinary !== "function") throw new Error("사진 업로드 기능을 초기화하지 못했습니다.");
      await uploadBinary(`/api/reports/drafts/${encodeURIComponent(draft.id)}/photos/${encodeURIComponent(reserved.id)}/content`, photo.file, { contentType: photo.mimeType || photo.file.type });
    }
    const reloaded = await api("/api/reports/drafts", { method: "POST", body: { reservationId: id, type: reservation.type } });
    state.myReservations = asArray(state.myReservations).map((item) => item.id === id ? { ...item, reportDraft: reloaded } : item);
    render();
    return reloaded;
  }

  return {
    async setView(view) {
      if (!STUDENT_VIEWS.has(view)) return;
      if (view === "reserve" && RESERVATION_TYPES.has(state.reservationType)) {
        const activeType = state.reservationType;
        resetReservationSelection(state, activeType);
        state.reservationFlowStep[activeType] = "date";
        state.rebookingDetails = null;
        clearReservationRecommendations(state);
      }
      state.view = view;
      try {
        if (view === "home" || view === "mine" || view === "reports") await loadMyReservations();
        if (view === "reserve" && state.user?.approvalStatus === "approved") await loadReservationShortcuts();
        if (view === "home" && state.user?.approvalStatus === "approved") await loadFacilityData(state.facilityTimeline?.date || seoulToday());
        if (view === "lectures") await loadLectures();
      } catch (error) {
        toast(error.message || "데이터를 불러오지 못했습니다.", { tone: "error" });
      }
      render();
    },
    startReservation(type) {
      if (!RESERVATION_TYPES.has(type)) return;
      if (type === "digital_lab") {
        if (!state.bootstrap?.settings?.digitalLabEnabled) return;
        resetReservationSelection(state, type);
      }
      state.view = "reserve";
      state.reservationType = type;
      state.reservationFlowStep[type] = "date";
      state.rebookingDetails = null;
      clearReservationRecommendations(state);
      render();
    },
    startDigitalLabEdit(id) {
      if (state.user?.approvalStatus !== "approved" || !state.bootstrap?.settings?.digitalLabEnabled) return;
      const reservation = asArray(state.myReservations).find((item) => item.id === id && item.type === "digital_lab");
      if (!reservation || INACTIVE_DIGITAL_LAB_STATUSES.has(reservation.status)) return;
      resetReservationSelection(state, "digital_lab");
      state.digitalLabEditing = reservation;
      state.view = "reserve";
      state.reservationType = "digital_lab";
      state.rebookingDetails = null;
      clearReservationRecommendations(state);
      const { reservedDate, startTime, endTime, seatId } = reservation.fields;
      applyDigitalLabPatch(state, { selectedDate: reservedDate, digitalLabStartTime: startTime, digitalLabEndTime: endTime, digitalLabSeatId: seatId });
      state.reservationFlowStep.digital_lab = Date.parse(`${reservedDate}T${startTime}:00+09:00`) >= Date.now() ? "select" : "date";
      render();
      if (state.reservationFlowStep.digital_lab === "select") return loadDigitalLabAvailability();
    },
    loadDigitalLabAvailability,
    async loadFacilityTimeline(date, options) {
      const pending = loadFacilityData(date, options);
      render();
      try {
        return await pending;
      } finally {
        render();
      }
    },
    startFacilityReservation(intent) {
      if (state.user?.approvalStatus !== "approved") {
        toast("학과 관리자 승인 후 예약할 수 있습니다.", { tone: "error" });
        return;
      }
      const type = intent?.type;
      if (!RESERVATION_TYPES.has(type) || !/^\d{4}-\d{2}-\d{2}$/.test(intent?.selectedDate || "")) return;
      if (type === "digital_lab" && !state.bootstrap?.settings?.digitalLabEnabled) return;
      const hasDraft = Boolean(state.selectedDates?.[type]) || (
        type === "equipment" ? Boolean(asArray(state.selectedEquipmentItemIds).length || asArray(state.selectedRequestedEquipment).length) :
        type === "studio" ? Boolean(state.selectedStudioSpace || asArray(state.selectedStudioSlots).length) :
        type === "darkroom" ? Boolean(asArray(state.selectedDarkroomSlots).length) :
        type === "digital_lab" ? Boolean(state.selectedDigitalLabStartTime) : Boolean(state.selectedPrintStartTime)
      );
      if (hasDraft && !confirmAction("작성 중인 예약을 선택한 조건으로 새로 시작할까요?")) return;
      resetReservationSelection(state, type);
      state.view = "reserve";
      state.reservationType = type;
      state.reservationFlowStep[type] = "date";
      state.rebookingDetails = null;
      applySelectionPatch(state, intent);
      clearReservationRecommendations(state);
      render();
      if (type === "digital_lab") return loadDigitalLabAvailability();
    },
    setReservationStep(type, step) {
      if (!RESERVATION_TYPES.has(type)) return;
      state.reservationFlowStep[type] = step;
      render();
    },
    updateReservationSelection(patch) {
      const changed = applySelectionPatch(state, patch);
      clearReservationRecommendations(state);
      render();
      if (patch.type === "digital_lab" && changed) return loadDigitalLabAvailability();
    },
    async loadReservationShortcuts() {
      await loadReservationShortcuts();
      render();
    },
    async saveFavoriteGroups(groups) {
      const result = await api("/api/me/favorite-equipment-groups", { method: "PUT", body: { groups } });
      state.favoriteGroups = asArray(result?.favoriteGroups);
      render();
    },
    async loadCourseDemandSurveys() {
      await loadCourseDemandSurveys();
      render();
    },
    async saveCourseDemandResponse(surveyId, rankings) {
      const result = await api(`/api/me/course-demand-surveys/${encodeURIComponent(surveyId)}/response`, {
        method: "PUT",
        body: { rankings }
      });
      state.courseDemandSurveys = asArray(state.courseDemandSurveys).map((survey) => survey.id === surveyId ? result : survey);
      render();
    },
    startRebooking(reservationId) {
      const reservation = asArray(state.recentReservations).find((item) => item?.id === reservationId);
      if (reservation?.type === "digital_lab" && !state.bootstrap?.settings?.digitalLabEnabled) return;
      if (!applyReusableReservationFields(state, reservation)) return;
      render();
    },
    async loadReservationRecommendations(draft) {
      await loadReservationRecommendations(draft);
      render();
    },
    async submitReservation(draft) {
      const type = draft?.type;
      if (!RESERVATION_TYPES.has(type)) throw new Error("지원하지 않는 예약 종류입니다.");
      const editingId = type === "digital_lab" ? state.digitalLabEditing?.id : undefined;
      const submittedResource = state.digitalLabAvailability;
      const submittedToken = state.token;
      let reservation;
      try {
        reservation = editingId
          ? await api(`/api/reservations/${encodeURIComponent(editingId)}`, { method: "PATCH", body: { fields: draft.fields } })
          : await api("/api/reservations", { method: "POST", body: draft });
      } catch (error) {
        if (error?.status === 409 && type === "digital_lab") {
          if (state.digitalLabAvailability === submittedResource && state.token === submittedToken
            && state.view === "reserve" && state.reservationType === type) {
            state.reservationFlowStep.digital_lab = "select";
            void loadDigitalLabAvailability();
          }
        } else if (error?.status === 409) {
          try {
            await loadReservationRecommendations(draft);
          } catch {
            state.reservationRecommendations = { type, alternatives: [] };
          }
          render();
        }
        throw error;
      }
      if (type === "digital_lab" && state.token !== submittedToken) return reservation;
      if (!editingId) await notifyNativeReservationCreated(reservation).catch(() => null);
      state.myReservations = [reservation, ...asArray(state.myReservations).filter((item) => item.id !== reservation.id)];
      if (Array.isArray(state.bootstrap?.reservations)) {
        state.bootstrap.reservations = [reservation, ...state.bootstrap.reservations.filter((item) => item.id !== reservation.id)];
      }
      resetReservationSelection(state, type);
      state.rebookingDetails = null;
      clearReservationRecommendations(state);
      state.view = "mine";
      render();
      toast(editingId ? "예약이 수정되었습니다." : type === "equipment" ? "기자재 예약 승인 요청이 접수되었습니다." : "예약이 확정되었습니다.");
      await refreshAfterMutation("예약은 처리됐지만");
      return reservation;
    },
    async cancelReservation(id) {
      if (!confirmAction("예약을 취소할까요?")) return;
      const cancelled = await api(`/api/reservations/${encodeURIComponent(id)}/cancel`, { method: "POST", body: { reason: "학생 취소" } });
      state.myReservations = asArray(state.myReservations).map((item) => item.id === cancelled.id ? cancelled : item);
      if (Array.isArray(state.bootstrap?.reservations)) {
        state.bootstrap.reservations = state.bootstrap.reservations.filter((item) => item.id !== cancelled.id);
      }
      render();
      toast("예약이 취소되었습니다.");
      await refreshAfterMutation("취소는 처리됐지만");
    },
    openReport(id) {
      state.view = "reports";
      state.activeReportReservationId = id || "";
      render();
    },
    saveReportDraft,
    async loadReportDraftPhoto(draftId, photoId) {
      return api(`/api/reports/drafts/${encodeURIComponent(draftId)}/photos/${encodeURIComponent(photoId)}/content`);
    },
    async loadReportPhoto(reportId, photoId) {
      return api(`/api/reports/${encodeURIComponent(reportId)}/photos/${encodeURIComponent(photoId)}/content`);
    },
    async submitReport(id, payload) {
      const reservation = asArray(state.myReservations).find((item) => item.id === id);
      const isNewReportPayload = Boolean(
        (Array.isArray(payload?.photos) && payload.photos.length > 0) ||
        payload?.equipmentDamageAnswer ||
        payload?.studioDamageAnswer === "yes" ||
        reservation?.type === "equipment"
      );
      if (!isNewReportPayload && reservation?.type !== "equipment") {
        await api("/api/reports/studio", { method: "POST", body: { reservationId: id, ...payload } });
      } else {
        const updatedDraft = await saveReportDraft(id, payload);
        await api(`/api/reports/drafts/${encodeURIComponent(updatedDraft.id)}/submit`, {
          method: "POST",
          body: { revision: Number(updatedDraft.revision || 0), submissionKey: updatedDraft.submissionKey || `report:${id}:${updatedDraft.id}` }
        });
      }
      state.activeReportReservationId = "";
      state.myReservations = asArray(state.myReservations).map((item) => item.id === id
        ? { ...item, fields: { ...(item.fields || {}), reportStatus: "submitted" } }
        : item);
      render();
      toast(reservation?.type === "equipment" ? "기자재 사용 보고서가 제출되었습니다." : "스튜디오 보고서가 제출되었습니다.");
      await refreshAfterMutation("보고서는 제출됐지만", { includeLectures: false });
    },
    async applyLecture(id) {
      const updated = await api(`/api/lectures/${encodeURIComponent(id)}/apply`, { method: "POST" });
      state.lectures = asArray(state.lectures).map((lecture) => lecture.id === id ? { ...lecture, ...updated } : lecture);
      render();
      toast("특강 신청이 완료되었습니다.");
      await refreshAfterMutation("특강 신청은 처리됐지만");
    },
    async cancelLecture(id) {
      if (!confirmAction("특강 신청을 취소할까요?")) return;
      const updated = await api(`/api/lectures/${encodeURIComponent(id)}/apply`, { method: "DELETE" });
      state.lectures = asArray(state.lectures).map((lecture) => lecture.id === id ? { ...lecture, ...updated } : lecture);
      state.myReservations = asArray(state.myReservations).filter((item) => item.type !== "lecture" || item.lecture?.id !== id);
      render();
      toast("특강 신청을 취소했습니다.");
      await refreshAfterMutation("특강 취소는 처리됐지만");
    },
    openNotice: createNoticeReader(dependencies),
    async updateProfile(profile) {
      const result = await api("/api/me", { method: "PATCH", body: profile });
      state.user = result?.user || result || state.user;
      render();
    },
    async changePassword(payload) {
      const userId = state.user?.id;
      await api("/api/me/password", { method: "PATCH", body: payload });
      let cleanupError = null;
      if (userId) {
        try {
          await clearNativeNotificationAccount(userId);
        } catch (error) {
          cleanupError = error;
        }
      }
      invalidateFacilityData({ clear: true });
      clearAuthenticatedState(state, clearStoredSession);
      render();
      toast(cleanupError
        ? "비밀번호는 변경됐지만 이 기기의 기존 예약 알림을 정리하지 못했습니다. 기기 알림 설정을 확인하세요."
        : "비밀번호가 변경되었습니다. 모든 기기에서 로그아웃되었습니다.", cleanupError ? { tone: "error" } : undefined);
    },
    async deleteAccount(payload) {
      const userId = state.user?.id;
      const result = await api("/api/me", { method: "DELETE", body: payload });
      let cleanupError = null;
      if (userId) {
        try {
          await clearNativeNotificationAccount(userId);
        } catch (error) {
          cleanupError = error;
        }
      }
      clearAuthenticatedState(state, clearStoredSession);
      render();
      toast(cleanupError
        ? "계정은 삭제됐지만 이 기기의 기존 예약 알림을 정리하지 못했습니다. 기기 알림 설정에서 직접 삭제하세요."
        : `계정이 삭제되었습니다.${result?.removedReservations ? ` 예약 ${result.removedReservations}건도 함께 삭제했습니다.` : ""}`, cleanupError ? { tone: "error" } : undefined);
    },
    async refresh() {
      try {
        await refreshStudentData();
        if (state.view === "home" && state.user?.approvalStatus === "approved") await loadFacilityData(state.facilityTimeline?.date || seoulToday(), { force: true });
        await handleNativeNotificationResume();
        render();
        toast("최신 데이터를 불러왔습니다.", { preserveScroll: true });
      } catch (error) {
        render();
        toast(error.message || "데이터를 새로고침하지 못했습니다.", { tone: "error", preserveScroll: true });
      }
    },
    openAccount() {
      state.view = "my";
      render();
    },
    logout,
    async enableNotifications() {
      try {
        await enableNativeReservationNotifications();
        render();
        toast("예약 알림을 켰습니다.");
      } catch (error) {
        render();
        toast(error.message || "알림을 켜지 못했습니다.", { tone: "error" });
      }
    },
    async syncNotifications() {
      try {
        const result = await syncNativeReservationNotifications({ force: true });
        render();
        toast(`예약 알림 ${result.scheduled || 0}개를 동기화했습니다.`);
      } catch (error) {
        render();
        toast(error.message || "알림을 동기화하지 못했습니다.", { tone: "error" });
      }
    },
    async disableNotifications() {
      try {
        await disableNativeReservationNotifications();
        render();
        toast("예약 알림을 껐습니다.");
      } catch (error) {
        render();
        toast(error.message || "알림을 끄지 못했습니다.", { tone: "error" });
      }
    }
  };
}
