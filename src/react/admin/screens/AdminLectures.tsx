import React from "react";

import { GjuCard, GjuEmptyState, GjuIconButton, GjuStatusBadge, GjuTable, GjuTabs } from "../../design-system";
import type { AdminLectureRecord, LegacyState, ReactAdminActions } from "../../platform/types";
import {
  bulkDeleteAvailability,
  fieldValue,
  formatDate,
  formatDateTime,
  numberValue,
  property,
  renderPager,
  runAdminAction,
  semesterOptions,
  stopSubmit
} from "./adminScreenUtils";

type AdminLecturesProps = {
  state: LegacyState;
  actions: ReactAdminActions;
};

function lectureTone(status: string) {
  if (status === "open" || status === "published" || status === "모집중") return "green" as const;
  if (status === "draft") return "amber" as const;
  if (status === "closed" || status === "cancelled" || status === "취소") return "red" as const;
  return "neutral" as const;
}

function lectureStatusLabel(status: string) {
  return {
    open: "신청중",
    published: "공개",
    draft: "임시저장",
    closed: "마감",
    cancelled: "취소"
  }[status] || status || "미정";
}

function lectureSchedule(lecture: AdminLectureRecord) {
  return [
    formatDate(lecture.lectureDate || lecture.date),
    lecture.time || [lecture.startTime, lecture.endTime].filter(Boolean).join(" - ")
  ].filter(Boolean).join(" · ");
}

function lecturePayload(form: HTMLFormElement) {
  const startTime = fieldValue(form, "startTime");
  const endTime = fieldValue(form, "endTime");
  return {
    title: fieldValue(form, "title"),
    instructorName: fieldValue(form, "lecturer"),
    lectureDate: fieldValue(form, "date"),
    time: [startTime, endTime].filter(Boolean).join(" - "),
    location: fieldValue(form, "location"),
    instructorAffiliation: fieldValue(form, "instructorAffiliation"),
    professor: fieldValue(form, "professor"),
    targetGrades: fieldValue(form, "targetGrades"),
    capacity: numberValue(form, "capacity"),
    status: fieldValue(form, "status") || "모집중",
    description: fieldValue(form, "description"),
    notes: fieldValue(form, "notes")
  };
}

function lectureApplications(lecture: AdminLectureRecord) {
  const applications = Array.isArray(lecture.applications) ? lecture.applications : [];
  if (!applications.length) return <span className="muted">신청자 없음</span>;
  return (
    <ul className="admin-lecture-application-list">
      {applications.map((application, index) => (
        <li key={application.id || `${application.studentId || application.email}:${index}`}>
          <strong>{application.userName || "-"}</strong>
          <span>{[application.studentId, application.studentStatus].filter(Boolean).join(" · ") || "-"}</span>
          <span>
            {application.phone ? <a href={`tel:${application.phone}`}>{application.phone}</a> : "-"}
            {application.email ? <> · <a href={`mailto:${application.email}`}>{application.email}</a></> : null}
          </span>
          <span>{formatDateTime(application.appliedAt)}</span>
        </li>
      ))}
    </ul>
  );
}

function deleteLecture(actions: ReactAdminActions, lecture: AdminLectureRecord) {
  runAdminAction(() => actions.deleteLecture(lecture.id, lecture.title || lecture.id));
}

function renderLectureActions(
  lecture: AdminLectureRecord,
  actions: ReactAdminActions,
  onEdit: (lectureId: string) => void
) {
  return (
    <div className="admin-react-action-row">
      <GjuIconButton label="특강 수정" icon="edit" onClick={() => onEdit(lecture.id)} />
      <GjuIconButton label="특강 삭제" icon="trash" tone="danger" onClick={() => deleteLecture(actions, lecture)} />
    </div>
  );
}

function bulkDeleteLectures(state: LegacyState, actions: ReactAdminActions) {
  runAdminAction(() => actions.bulkDeleteLectures({
    semester: state.adminLectureSemesterFilter || "all",
    q: state.adminLectureSearch || ""
  }));
}

export function AdminLectures({ state, actions }: AdminLecturesProps) {
  const [editingId, setEditingId] = React.useState<string>("");
  const lectures = state.adminLectures || state.lectures || [];
  const semesterFilter = String(state.adminLectureSemesterFilter || "all");
  const semesters = semesterOptions(state.adminLectureSemesters);
  const filtered = lectures;
  const editingLecture = filtered.find((lecture) => lecture.id === editingId);
  const [editingStartTime = "", editingEndTime = ""] = String(editingLecture?.time || "").split(/\s*-\s*/, 2);
  const lectureSort = state.adminLectureSort || { field: "lectureDate", direction: "asc" as const };
  const deleteFilters = {
    semester: semesterFilter,
    q: state.adminLectureSearch || ""
  };
  const deleteAvailability = bulkDeleteAvailability(state.adminLecturesPage, deleteFilters);

  const submitSearch = stopSubmit((form) => {
    void actions.setAdminFilters("lectures", {
      q: String(new FormData(form).get("q") || ""),
      page: 1
    });
  });

  const submitLecture = stopSubmit(async (form) => {
    const payload = lecturePayload(form);
    await actions.saveLecture(editingLecture?.id || null, payload);
    if (editingLecture) {
      setEditingId("");
      return;
    }
    form.reset();
  });

  const setSemester = (semester: string) => {
    void actions.setAdminFilters("lectures", { semester, page: 1 });
  };
  const setSort = (field: "title" | "lectureDate" | "instructorName" | "status") => {
    const direction = lectureSort.field === field && lectureSort.direction === "asc" ? "desc" : "asc";
    void actions.setAdminFilters("lectures", { sort: field, direction, page: 1 });
  };

  return (
    <section className="grid admin-react-screen">
      <GjuCard title="비교과 특강" eyebrow="React Admin" actions={<span className="tag blue">{filtered.length}건</span>} surface="workspace">
        <form className="list-control-panel compact admin-react-toolbar" onSubmit={submitSearch}>
          <label>
            <span className="sr-only">특강 검색</span>
            <input
              className="input"
              name="q"
              defaultValue={String(state.adminLectureSearch || "")}
              placeholder="제목·강사·장소 검색"
            />
          </label>
          <button className="button primary compact" type="submit">
            검색
          </button>
        </form>
        <GjuTabs
          id="admin-lecture-semester-tabs"
          ariaLabel="특강 학기"
          className="tab-row"
          tabClassName="tab-button"
          items={[{ key: "all", label: "전체" }, ...semesters]}
          activeKey={semesterFilter}
          onChange={setSemester}
        />
        <form key={editingLecture?.id || "new"} className="admin-react-form-grid" onSubmit={submitLecture}>
          <label>
            제목
            <input className="input" name="title" defaultValue={editingLecture?.title || ""} required />
          </label>
          <label>
            강사
            <input className="input" name="lecturer" defaultValue={editingLecture?.instructorName || editingLecture?.lecturer || ""} required />
          </label>
          <label>
            날짜
            <input className="input" name="date" type="date" defaultValue={editingLecture?.lectureDate || editingLecture?.date || ""} required />
          </label>
          <label>
            시작
            <input className="input" name="startTime" type="time" defaultValue={editingLecture?.startTime || editingStartTime} required />
          </label>
          <label>
            종료
            <input className="input" name="endTime" type="time" defaultValue={editingLecture?.endTime || editingEndTime} required />
          </label>
          <label>
            장소
            <input className="input" name="location" defaultValue={editingLecture?.location || ""} required />
          </label>
          <label>
            강사 소속
            <input className="input" name="instructorAffiliation" defaultValue={editingLecture?.instructorAffiliation || ""} />
          </label>
          <label>
            담당교수
            <input className="input" name="professor" defaultValue={editingLecture?.professor || ""} />
          </label>
          <label>
            대상 학년
            <input className="input" name="targetGrades" defaultValue={editingLecture?.targetGrades || ""} />
          </label>
          <label>
            정원
            <input className="input" name="capacity" type="number" min="0" defaultValue={editingLecture?.capacity || ""} />
          </label>
          <label>
            상태
            <select className="select" name="status" defaultValue={editingLecture?.status || "모집중"}>
              <option value="모집중">모집중</option>
              <option value="진행완료">진행완료</option>
              <option value="취소">취소</option>
            </select>
          </label>
          <label className="admin-react-form-wide">
            설명
            <textarea className="textarea" name="description" defaultValue={editingLecture?.description || ""} rows={3} required />
          </label>
          <label className="admin-react-form-wide">
            비고
            <textarea className="textarea" name="notes" defaultValue={editingLecture?.notes || ""} rows={2} />
          </label>
          <div className="button-row admin-react-form-wide">
            <button className="button primary" type="submit">
              {editingLecture ? "특강 수정" : "특강 등록"}
            </button>
            {editingLecture ? (
              <button className="button ghost" type="button" onClick={() => setEditingId("")}>
                취소
              </button>
            ) : null}
            <button className="button" type="button" onClick={() => runAdminAction(() => actions.downloadLectureCsv())}>
              CSV 내보내기
            </button>
            <button className="button danger" type="button" disabled={deleteAvailability.filteredDisabled} onClick={() => bulkDeleteLectures(state, actions)}>
              필터 결과 특강 삭제
            </button>
            <button className="button danger" type="button" disabled={deleteAvailability.allDisabled} onClick={() => runAdminAction(() => actions.deleteAllLectures(deleteAvailability.collectionTotal))}>
              전체 특강 삭제
            </button>
          </div>
        </form>
        <div className="table-wrap embedded admin-react-desktop-table">
          <GjuTable>
            <thead>
              <tr>
                <th><button className="table-sort" type="button" onClick={() => setSort("title")}>특강</button></th>
                <th><button className="table-sort" type="button" onClick={() => setSort("lectureDate")}>일정</button></th>
                <th>장소</th>
                <th>정원</th>
                <th><button className="table-sort" type="button" onClick={() => setSort("status")}>상태</button></th>
                <th>신청자 명단 / 연락처</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((lecture) => (
                <tr key={lecture.id}>
                  <td>
                    <strong>{lecture.title || "-"}</strong>
                    <br />
                    <span className="muted">{lecture.instructorName || lecture.lecturer || "-"}</span>
                  </td>
                  <td>{lectureSchedule(lecture)}</td>
                  <td>{lecture.location || "-"}</td>
                  <td>{Number(lecture.applicationCount ?? lecture.enrolledCount ?? 0)} / {lecture.capacity || "-"}</td>
                  <td>
                    <GjuStatusBadge tone={lectureTone(String(lecture.status || ""))}>
                      {lectureStatusLabel(String(lecture.status || ""))}
                    </GjuStatusBadge>
                  </td>
                  <td>{lectureApplications(lecture)}</td>
                  <td>
                    {renderLectureActions(lecture, actions, setEditingId)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>
                    <GjuEmptyState title="특강이 없습니다." message="검색어와 학기 필터를 확인하세요." />
                  </td>
                </tr>
              )}
            </tbody>
          </GjuTable>
        </div>
        <div className="admin-react-card-list" aria-label="특강 목록">
          {filtered.length ? filtered.map((lecture) => (
            <article key={lecture.id} className="admin-react-list-card">
              <div className="reservation-card-head">
                <div>
                  <strong>{lecture.title || "-"}</strong>
                  <span>{lecture.instructorName || lecture.lecturer || "-"}</span>
                </div>
                <GjuStatusBadge tone={lectureTone(String(lecture.status || ""))}>
                  {lectureStatusLabel(String(lecture.status || ""))}
                </GjuStatusBadge>
              </div>
              <dl className="property-list">
                {property("일정", lectureSchedule(lecture))}
                {property("장소", lecture.location || "-")}
                {property("정원", `${Number(lecture.applicationCount ?? lecture.enrolledCount ?? 0)} / ${lecture.capacity || "-"}`)}
                {property("담당교수", lecture.professor || "-")}
                {property("대상 학년", lecture.targetGrades || "-")}
                {property("비고", lecture.notes || "-")}
              </dl>
              {lectureApplications(lecture)}
              {renderLectureActions(lecture, actions, setEditingId)}
            </article>
          )) : <GjuEmptyState title="특강이 없습니다." message="검색어와 학기 필터를 확인하세요." />}
        </div>
        {renderPager(actions, state.adminLecturesPage, "lectures", "특강 페이지 이동")}
      </GjuCard>
    </section>
  );
}
