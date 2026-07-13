const NOTICE_LIST_QUERY_KEYS = new Set(["q", "type", "status", "from", "to", "page", "pageSize", "sort", "direction"]);

export function createReportsLecturesNoticesHelpers({ publicUser, lectureCancelLimitMs = 6 * 60 * 60 * 1000 }) {
  function reportWithDetails(db, report) {
    return {
      ...report,
      reservation: db.reservations.find((item) => item.id === report.reservationId) || null,
      user: publicUser(db.users.find((item) => item.id === report.userId))
    };
  }

  function hasNoticeListQuery(searchParams) {
    return Boolean(searchParams && [...searchParams.keys()].some((key) => NOTICE_LIST_QUERY_KEYS.has(key)));
  }

  function lectureApplicationCount(db, lecture) {
    const internalCount = (db.lectureApplications || []).filter((item) => item.lectureId === lecture.id).length;
    return internalCount + Number(lecture.baseApplicationCount || 0);
  }

  function lectureStartTimestamp(lecture) {
    const date = String(lecture?.lectureDate || "").trim();
    const timeMatch = String(lecture?.time || "").match(/(\d{1,2}):(\d{2})/);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !timeMatch) return null;
    const hour = String(timeMatch[1]).padStart(2, "0");
    const minute = String(timeMatch[2]).padStart(2, "0");
    const timestamp = Date.parse(`${date}T${hour}:${minute}:00+09:00`);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function canCancelLectureApplication(lecture, now = Date.now()) {
    const startAt = lectureStartTimestamp(lecture);
    if (!startAt) return true;
    return startAt - now > lectureCancelLimitMs;
  }

  function lectureSummary(db, lecture, user = null) {
    const applications = (db.lectureApplications || []).filter((item) => item.lectureId === lecture.id);
    const applied = user ? applications.some((item) => item.userId === user.id) : false;
    return {
      ...lecture,
      applicationCount: lectureApplicationCount(db, lecture),
      applied,
      canCancelApplication: applied ? canCancelLectureApplication(lecture) : false
    };
  }

  function lectureDetail(db, lecture) {
    const applications = (db.lectureApplications || [])
      .filter((item) => item.lectureId === lecture.id)
      .map((item) => {
        const user = db.users.find((candidate) => candidate.id === item.userId) || {};
        return {
          ...item,
          userName: item.userName || user.name || "",
          studentId: item.studentId || user.studentId || "",
          studentStatus: item.studentStatus || user.studentStatus || "",
          phone: item.phone || user.phone || "",
          email: item.email || user.email || ""
        };
      });
    return { ...lectureSummary(db, lecture), applications };
  }

  function withLectureApplicationDetails(db, application) {
    const lecture = db.lectures.find((item) => item.id === application.lectureId) || {};
    return {
      id: application.id,
      type: "lecture",
      status: lecture.status === "취소" ? "cancelled" : "lecture_applied",
      userId: application.userId,
      fields: {
        reservedDate: lecture.lectureDate || "",
        title: lecture.title || "비교과 특강",
        time: lecture.time || "",
        location: lecture.location || "",
        instructorName: lecture.instructorName || "",
        instructorAffiliation: lecture.instructorAffiliation || "",
        professor: lecture.professor || "",
        targetGrades: lecture.targetGrades || "",
        description: lecture.description || "",
        notes: lecture.notes || "",
        appliedAt: application.appliedAt || ""
      },
      lecture: lecture.id ? lectureSummary(db, lecture, null) : null,
      application,
      createdAt: application.appliedAt || "",
      updatedAt: application.appliedAt || ""
    };
  }

  return {
    canCancelLectureApplication,
    hasNoticeListQuery,
    lectureApplicationCount,
    lectureDetail,
    lectureSummary,
    reportWithDetails,
    withLectureApplicationDetails
  };
}
