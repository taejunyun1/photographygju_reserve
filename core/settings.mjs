export const SETTING_FACILITY_TYPES = new Set(["studio", "darkroom", "equipment", "print"]);
export const DEFAULT_STUDIO_REPORT_DEADLINE_HOURS = 48;
export const MIN_STUDIO_REPORT_DEADLINE_HOURS = 1;
export const MAX_STUDIO_REPORT_DEADLINE_HOURS = 720;

export function parseStudioReportDeadlineHours(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours < MIN_STUDIO_REPORT_DEADLINE_HOURS || hours > MAX_STUDIO_REPORT_DEADLINE_HOURS) return null;
  return hours;
}

export const defaultSettings = {
  appName: "GJU Photography Reservation",
  departmentName: "광주대학교 사진영상미디어학과",
  studentUrl: "https://gjureserve.co.kr",
  adminUrl: "https://gjureserve.co.kr",
  slackChannel: "#예약_현황automatic",
  phoneMasking: true,
  reservationWindowDays: 30,
  equipmentFacility: "사진영상미디어학과 기자재실",
  equipmentCategories: ["Body", "Lens", "Lighting", "Audio", "Drone", "Other"],
  equipmentRentalTimes: ["10:15", "12:00", "17:30"],
  equipmentReturnTimes: ["10:15", "12:00", "17:10"],
  equipmentPeriods: ["당일", "1박2일", "2박3일", "주말사용"],
  studioSpaces: ["Studio A Front", "Studio A Back", "Studio B Front", "Studio B Back"],
  studioSlots: [
    "10:30-12:00",
    "12:00-14:00",
    "14:00-16:00",
    "16:00-18:00",
    "18:00-20:00 (야간)",
    "20:00-22:00 (야간)",
    "22:00-24:00 (야간)",
    "00:00-02:00 (야간)",
    "02:00-04:00 (야간)",
    "04:00-06:00 (야간)"
  ],
  studioMaxSlots: 3,
  studioReportDeadlineHours: DEFAULT_STUDIO_REPORT_DEADLINE_HOURS,
  darkroomCapacity: 6,
  darkroomSlots: [
    "00:00-02:00",
    "02:00-04:00",
    "04:00-06:00",
    "06:00-08:00",
    "08:00-10:00",
    "10:00-12:00",
    "12:00-14:00",
    "14:00-16:00",
    "16:00-18:00",
    "18:00-20:00",
    "20:00-22:00",
    "22:00-24:00"
  ],
  darkroomBlockedRules: [
    { day: "monday", label: "월요일", start: "14:00", end: "18:00" },
    { day: "tuesday", label: "화요일", start: "14:00", end: "18:00" }
  ],
  printAvailableStart: "10:00",
  printAvailableEnd: "19:00",
  printTimeUnitMinutes: 60,
  printCapacityWindowMinutes: 120,
  printCapacityPerWindow: 4,
  printTypes: ["과제", "개인 작품"],
  printPapers: ["글로시", "매트"],
  printSizes: ["소형", "중형", "대형"],
  printBankAccount: "Admin 설정에서 출력비 계좌를 입력하세요.",
  printUploadStartDate: "",
  printUploadEndDate: "",
  googleDriveUrl: "",
  equipmentHighValueCategories: ["Body", "Lens"],
  equipmentBagKeywords: ["펠리컨", "Pelican"],
  equipmentCameraBagNotice: "고가장비(카메라)를 선택 시 카메라 가방을 지참하겠습니다",
  vacationMode: false,
  vacationRanges: [],
  blockedSchedules: [],
  noticesPinnedFirst: true
};

export const darkroomChemicals = [
  { id: "chem-d76", process: "현상", name: "Kodak D-76", options: ["500ml", "1000ml", "2000ml", "직접 입력"] },
  { id: "chem-stopbath", process: "정지", name: "ILFORD indicator stopbath", options: ["500ml", "1000ml", "2000ml", "직접 입력"] },
  { id: "chem-fixer", process: "정착", name: "ILFORD Hypam Rapid Fixer", options: ["500ml", "1000ml", "2000ml", "직접 입력"] },
  { id: "chem-developer", process: "인화 현상", name: "ILFORD multigrade paper Developer", options: ["500ml", "1000ml", "2000ml", "직접 입력"] },
  { id: "lens-schneider-50", process: "확대기 렌즈", name: "Schneider componon-s 50mm f2.8", options: ["1개", "직접 입력"] }
];

export function createSettingsHelpers({ assertPlainObject, assertDateKey, assertOptionalDateKey, assertTimeValue, sanitizeHttpUrl, id, nowIso }) {
  function sanitizeBlockedSchedule(rule = {}) {
    assertPlainObject(rule, "차단 일정");
    const type = String(rule.type || "").trim();
    const day = String(rule.day || "").trim();
    if (!SETTING_FACILITY_TYPES.has(type)) throw Object.assign(new Error("지원하지 않는 차단 시설입니다."), { status: 400 });
    const weekdays = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    if (!(day in weekdays)) throw Object.assign(new Error("차단 요일이 올바르지 않습니다."), { status: 400 });
    assertDateKey(rule.from, "차단 시작일");
    assertDateKey(rule.to, "차단 종료일");
    if (String(rule.from) > String(rule.to)) throw Object.assign(new Error("차단 종료일은 시작일 이후여야 합니다."), { status: 400 });
    assertTimeValue(rule.start, "차단 시작 시간");
    assertTimeValue(rule.end, "차단 종료 시간");
    return {
      id: String(rule.id || id("block")).trim().slice(0, 80),
      type,
      day,
      from: String(rule.from),
      to: String(rule.to),
      start: String(rule.start),
      end: String(rule.end),
      target: String(rule.target || "").trim().slice(0, 120)
    };
  }

  function sanitizeStringList(value, maxItems = 80, maxLength = 80) {
    const source = Array.isArray(value) ? value : String(value || "").split(",");
    return [...new Set(source.map((item) => String(item || "").trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems);
  }

  function sanitizeSettingsPatch(current, body = {}) {
    assertPlainObject(body, "설정");
    const patch = {};
    if (body.printBankAccount !== undefined) patch.printBankAccount = String(body.printBankAccount || "").trim().slice(0, 240);
    if (body.googleDriveUrl !== undefined) {
      const googleDriveUrl = sanitizeHttpUrl(body.googleDriveUrl || "", "출력실 구글 드라이브 URL");
      if (googleDriveUrl.length > 500) throw Object.assign(new Error("출력실 구글 드라이브 URL은 500자 이하로 입력하세요."), { status: 400 });
      patch.googleDriveUrl = googleDriveUrl;
    }
    if (body.printUploadStartDate !== undefined) {
      assertOptionalDateKey(body.printUploadStartDate, "출력 업로드 시작일");
      patch.printUploadStartDate = String(body.printUploadStartDate || "");
    }
    if (body.printUploadEndDate !== undefined) {
      assertOptionalDateKey(body.printUploadEndDate, "출력 업로드 종료일");
      patch.printUploadEndDate = String(body.printUploadEndDate || "");
    }
    if (body.darkroomCapacity !== undefined) {
      const capacity = Number(body.darkroomCapacity);
      if (!Number.isFinite(capacity) || capacity < 1 || capacity > 200) throw Object.assign(new Error("암실 최대 인원은 1-200 사이로 입력하세요."), { status: 400 });
      patch.darkroomCapacity = Math.floor(capacity);
    }
    if (body.studioReportDeadlineHours !== undefined) {
      const deadlineHours = parseStudioReportDeadlineHours(body.studioReportDeadlineHours);
      if (deadlineHours === null) {
        throw Object.assign(new Error(`스튜디오 보고서 제출 기한은 ${MIN_STUDIO_REPORT_DEADLINE_HOURS}-${MAX_STUDIO_REPORT_DEADLINE_HOURS}시간 사이로 입력하세요.`), { status: 400 });
      }
      patch.studioReportDeadlineHours = Math.floor(deadlineHours);
    }
    if (body.printAvailableStart !== undefined) {
      assertTimeValue(body.printAvailableStart, "출력실 시작 시간");
      patch.printAvailableStart = String(body.printAvailableStart);
    }
    if (body.printAvailableEnd !== undefined) {
      assertTimeValue(body.printAvailableEnd, "출력실 종료 시간");
      patch.printAvailableEnd = String(body.printAvailableEnd);
    }
    if (body.equipmentCategories !== undefined) {
      if (!Array.isArray(body.equipmentCategories)) throw Object.assign(new Error("기자재 카테고리는 배열이어야 합니다."), { status: 400 });
      patch.equipmentCategories = sanitizeStringList(body.equipmentCategories, 80, 60);
    }
    if (body.equipmentHighValueCategories !== undefined) patch.equipmentHighValueCategories = sanitizeStringList(body.equipmentHighValueCategories, 40, 60);
    if (body.equipmentBagKeywords !== undefined) patch.equipmentBagKeywords = sanitizeStringList(body.equipmentBagKeywords, 40, 60);
    if (body.equipmentCameraBagNotice !== undefined) patch.equipmentCameraBagNotice = String(body.equipmentCameraBagNotice || "").trim().slice(0, 160) || defaultSettings.equipmentCameraBagNotice;
    if (body.blockedSchedules !== undefined) {
      if (!Array.isArray(body.blockedSchedules) || body.blockedSchedules.length > 400) throw Object.assign(new Error("차단 일정은 400개 이하 배열이어야 합니다."), { status: 400 });
      patch.blockedSchedules = body.blockedSchedules.map(sanitizeBlockedSchedule);
    }
    if (body.vacationMode !== undefined) patch.vacationMode = body.vacationMode === true;
    const next = { ...current, ...patch };
    if (next.printUploadStartDate && next.printUploadEndDate && next.printUploadStartDate > next.printUploadEndDate) throw Object.assign(new Error("출력 업로드 종료일은 시작일 이후여야 합니다."), { status: 400 });
    return { ...next, updatedAt: nowIso() };
  }

  return { sanitizeBlockedSchedule, sanitizeStringList, sanitizeSettingsPatch };
}
