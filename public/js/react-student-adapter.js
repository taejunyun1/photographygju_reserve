const STUDENT_VIEWS = new Set(["home", "reserve", "mine", "reports", "lectures", "notices", "my"]);
const RESERVATION_TYPES = new Set(["equipment", "studio", "darkroom", "print"]);

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
    bootstrap: {
      settings: bootstrap.settings || {},
      notices: asArray(bootstrap.notices),
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
      print: state.reservationFlowStep?.print || "date"
    },
    selectedDates: {
      equipment: state.selectedDates?.equipment || "",
      studio: state.selectedDates?.studio || "",
      darkroom: state.selectedDates?.darkroom || "",
      print: state.selectedDates?.print || ""
    },
    selectedEquipmentPeriod: state.selectedEquipmentPeriod || "",
    selectedEquipmentRentalTime: state.selectedEquipmentRentalTime || "",
    selectedEquipmentReturnTime: state.selectedEquipmentReturnTime || "",
    selectedEquipmentItemIds: asArray(state.selectedEquipmentItemIds),
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
  }
}

function applySelectionPatch(state, patch) {
  const type = patch?.type;
  if (!RESERVATION_TYPES.has(type)) return;
  if (patch.selectedDate !== undefined) state.selectedDates[type] = patch.selectedDate;
  const mappings = {
    equipmentPeriod: "selectedEquipmentPeriod",
    equipmentRentalTime: "selectedEquipmentRentalTime",
    equipmentReturnTime: "selectedEquipmentReturnTime",
    equipmentItemIds: "selectedEquipmentItemIds",
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
  state.token = "";
  state.user = null;
  state.myReservations = [];
  state.favoriteGroups = [];
  state.recentReservations = [];
  state.courseDemandSurveys = [];
  state.rebookingDetails = null;
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
    render,
    toast,
    loadBootstrap,
    loadMyReservations,
    loadLectures,
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
    const result = await api("/api/me/reservation-shortcuts");
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

  async function refreshStudentData({ includeLectures = true } = {}) {
    const jobs = [loadBootstrap(), loadMyReservations(), loadReservationShortcuts(), loadCourseDemandSurveys()];
    if (includeLectures) jobs.push(loadLectures());
    await Promise.all(jobs);
  }

  async function refreshAfterMutation(message, options) {
    try {
      await refreshStudentData(options);
      render();
    } catch (error) {
      toast(`${message} 최신 목록을 다시 불러오지 못했습니다: ${error.message || "새로고침 실패"}`, { tone: "error", preserveScroll: true });
    }
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
        if (view === "mine" || view === "reports") await loadMyReservations();
        if (view === "lectures") await loadLectures();
      } catch (error) {
        toast(error.message || "데이터를 불러오지 못했습니다.", { tone: "error" });
      }
      render();
    },
    startReservation(type) {
      if (!RESERVATION_TYPES.has(type)) return;
      state.view = "reserve";
      state.reservationType = type;
      state.reservationFlowStep[type] = "date";
      state.rebookingDetails = null;
      clearReservationRecommendations(state);
      render();
    },
    setReservationStep(type, step) {
      if (!RESERVATION_TYPES.has(type)) return;
      state.reservationFlowStep[type] = step;
      render();
    },
    updateReservationSelection(patch) {
      applySelectionPatch(state, patch);
      clearReservationRecommendations(state);
      render();
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
      let reservation;
      try {
        reservation = await api("/api/reservations", { method: "POST", body: draft });
      } catch (error) {
        if (error?.status === 409) {
          try {
            await loadReservationRecommendations(draft);
          } catch {
            state.reservationRecommendations = { type, alternatives: [] };
          }
          render();
        }
        throw error;
      }
      await notifyNativeReservationCreated(reservation).catch(() => null);
      state.myReservations = [reservation, ...asArray(state.myReservations).filter((item) => item.id !== reservation.id)];
      if (Array.isArray(state.bootstrap?.reservations)) {
        state.bootstrap.reservations = [reservation, ...state.bootstrap.reservations.filter((item) => item.id !== reservation.id)];
      }
      resetReservationSelection(state, type);
      state.rebookingDetails = null;
      clearReservationRecommendations(state);
      state.view = "mine";
      render();
      toast(type === "equipment" ? "기자재 예약 승인 요청이 접수되었습니다." : "예약이 확정되었습니다.");
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
    async submitReport(id, payload) {
      await api("/api/reports/studio", { method: "POST", body: { reservationId: id, ...payload } });
      state.activeReportReservationId = "";
      state.myReservations = asArray(state.myReservations).map((item) => item.id === id
        ? { ...item, fields: { ...(item.fields || {}), reportStatus: "submitted" } }
        : item);
      render();
      toast("스튜디오 보고서가 제출되었습니다.");
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
    openNotice(id) {
      state.activeNoticeId = id || "";
      render();
    },
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
