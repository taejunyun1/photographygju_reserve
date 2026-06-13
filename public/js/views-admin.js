import { state } from "./state.js?v=20260613-mod3";
import {
  adminNavItems,
  lectureStatusOptions,
  sourceLabel,
  typeLabel,
  userLimitOptions,
  weekdayLabel
} from "./constants.js?v=20260613-mod3";
import {
  addMonths,
  adminGuide,
  blockedItemsForDate,
  dateKey,
  equipmentCategories,
  escapeHtml,
  monthTitle,
  sortedAdminUsers,
  tag,
  todayKey,
  userSortButton,
  userStatusCell
} from "./utils.js?v=20260613-mod3";
import { noticeCard } from "./views-student.js?v=20260613-mod3";

export function adminShell() {
  return `
    <main class="admin-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">G</div>
          <div>
            <h1>GJU-reserve</h1>
            <p>Admin</p>
          </div>
        </div>
        <nav class="side-nav">
          ${adminNavItems.map(([key, label]) => `<button class="${state.adminView === key ? "active" : ""}" data-admin-view="${key}">${label}</button>`).join("")}
        </nav>
      </aside>
      <section class="admin-main">
        <header class="admin-mobile-header">
          <div class="appbar-brand">
            <div class="brand-mark">G</div>
            <div>
              <strong>GJU-reserve</strong>
              <span>${adminTitle()}</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="button ghost compact ${state.adminView === "account" ? "active" : ""}" data-admin-view="account">내 정보</button>
            <button class="button ghost compact" data-action="logout">나가기</button>
          </div>
        </header>
        <header class="admin-header">
          <div><h1 class="page-title">${adminTitle()}</h1><p class="muted">admin 통합 관리 계정</p></div>
          <div class="header-actions">
            <button class="button ghost ${state.adminView === "account" ? "active" : ""}" data-admin-view="account">내 정보</button>
            <button class="button ghost" data-action="logout">로그아웃</button>
          </div>
        </header>
        ${adminContent()}
      </section>
      <nav class="admin-mobile-nav">
        ${adminNavItems.map(([key, label]) => `<button class="${state.adminView === key ? "active" : ""}" data-admin-view="${key}">${label}</button>`).join("")}
      </nav>
    </main>
  `;
}

export function adminTitle() {
  return {
    dashboard: "대시보드",
    users: "학생 승인",
    reservations: "예약 관리",
    equipment: "기자재 관리",
    reports: "보고서",
    lectures: "비교과 특강",
    notices: "공지사항",
    settings: "설정",
    account: "내 정보"
  }[state.adminView];
}

export function adminContent() {
  if (state.adminView === "account") return adminAccountView();
  if (state.adminView === "users") return adminUsersView();
  if (state.adminView === "reservations") return adminReservationsView();
  if (state.adminView === "equipment") return adminEquipmentView();
  if (state.adminView === "reports") return adminReportsView();
  if (state.adminView === "lectures") return adminLecturesView();
  if (state.adminView === "notices") return adminNoticesView();
  if (state.adminView === "settings") return adminSettingsView();
  return adminDashboardView();
}

export function adminAccountView() {
  const u = state.user || {};
  return `
    <section class="grid">
      ${adminGuide("내 정보 사용 가이드", "관리자 계정의 이름, 이메일, 연락처와 비밀번호를 직접 변경할 수 있습니다. 비밀번호는 현재 비밀번호 확인 후 변경됩니다.")}
      <div class="card">
        <h2 class="card-title">개인정보 수정</h2>
        <form class="report-form" data-form="profile-edit">
          <div class="field"><label>이름</label><input class="input" name="name" value="${escapeHtml(u.name || "")}" required /></div>
          <div class="field"><label>이메일</label><input class="input" name="email" type="email" value="${escapeHtml(u.email || "")}" /></div>
          <div class="field"><label>연락처</label><input class="input" name="phone" value="${escapeHtml(u.phone || "")}" /></div>
          <button class="button primary full" type="submit">개인정보 저장</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">비밀번호 변경</h2>
        <form class="report-form" data-form="password-change">
          <div class="field"><label>현재 비밀번호</label><input class="input" name="currentPassword" type="password" autocomplete="current-password" required /></div>
          <div class="field"><label>새 비밀번호</label><input class="input" name="newPassword" type="password" autocomplete="new-password" minlength="8" required /></div>
          <div class="field"><label>새 비밀번호 확인</label><input class="input" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></div>
          <button class="button primary full" type="submit">비밀번호 변경</button>
        </form>
      </div>
    </section>
  `;
}

export function adminDashboardView() {
  const s = state.summary || {};
  return `
    <section class="grid">
      ${adminGuide("대시보드 사용 가이드", "오늘 처리해야 할 승인, 예약, 보고서 현황을 빠르게 보는 화면입니다. 카드를 누르면 해당 관리 페이지로 이동합니다.")}
      <div class="stat-grid">
        <button class="stat stat-button" data-admin-view="users"><span class="muted">가입 승인 대기</span><strong>${s.pendingUsers || 0}</strong><em>학생 승인으로 이동</em></button>
        <button class="stat stat-button" data-admin-view="reservations" data-admin-reservation-tab="equipment"><span class="muted">기자재 승인 대기</span><strong>${s.pendingEquipment || 0}</strong><em>기자재 예약 확인</em></button>
        <button class="stat stat-button" data-admin-view="reservations" data-admin-reservation-tab="all"><span class="muted">오늘 예약</span><strong>${s.todayReservations || 0}</strong><em>전체 예약 보기</em></button>
        <button class="stat stat-button" data-admin-view="reports"><span class="muted">보고서 확인 필요</span><strong>${s.missingReports || 0}</strong><em>보고서로 이동</em></button>
      </div>
      <div class="card"><h2 class="card-title">운영 순서</h2><p class="muted">신규 가입 승인 → 기자재 승인 → 오늘 대여/반납 → 스튜디오 보고서 확인 → 공지 관리</p></div>
    </section>
  `;
}

export function adminUsersView() {
  return `
    <section class="grid">
      ${adminGuide("학생 승인 사용 가이드", "가입 신청 학생의 이름, 학번, 연락처를 확인한 뒤 바로 승인/반려/제한을 누릅니다. 제한은 1주일, 2주일, 1달, 1학기 중 선택할 수 있고 제한 기간 동안 학생은 예약할 수 없습니다.")}
      <div class="table-wrap">
        <table>
          <thead><tr><th>${userSortButton("name", "이름")}</th><th>${userSortButton("studentId", "학번")}</th><th>${userSortButton("studentStatus", "신분")}</th><th>연락처</th><th>${userSortButton("approvalStatus", "상태")}</th><th>작업</th></tr></thead>
          <tbody>
            ${sortedAdminUsers().map((user) => `
              <tr>
                <td><strong>${escapeHtml(user.name)}</strong><br><span class="muted">${escapeHtml(user.email || "")}</span></td>
                <td>${escapeHtml(user.studentId || "-")}</td>
                <td>${escapeHtml(user.studentStatus)}</td>
                <td>${escapeHtml(user.phone)}</td>
                <td>${userStatusCell(user)}</td>
                <td>
                  <div class="row-actions">
                    <button class="button primary" data-user-approval="${user.id}" data-status="approved">승인</button>
                    <button class="button danger" data-user-approval="${user.id}" data-status="rejected">반려</button>
                    <button class="button" data-user-reset="${user.id}">비번 리셋</button>
                  </div>
                  <div class="limit-actions">
                    <select class="select compact-select" data-user-limit-duration="${user.id}">
                      ${Object.entries(userLimitOptions).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
                    </select>
                    <button class="button" data-user-approval="${user.id}" data-status="blocked">제한</button>
                  </div>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

export function adminReservationsView() {
  const tabs = [["all", "전체"], ["equipment", "기자재"], ["darkroom", "암실"], ["studio", "스튜디오"], ["print", "출력"]];
  const reservations = state.adminReservationTab === "all"
    ? state.adminReservations
    : state.adminReservations.filter((reservation) => reservation.type === state.adminReservationTab);
  return `
    <section class="grid">
      ${adminGuide("예약관리 사용 가이드", "예약 종류별 탭에서 학생 예약을 확인합니다. 기자재는 승인→대여→반납 순서로 처리하고, 스튜디오/암실/출력은 현장 상황에 맞게 완료 또는 취소 처리합니다.")}
      <div class="tab-row">
        ${tabs.map(([key, label]) => {
          const count = key === "all" ? state.adminReservations.length : state.adminReservations.filter((item) => item.type === key).length;
          return `<button class="tab-button ${state.adminReservationTab === key ? "active" : ""}" data-admin-reservation-tab="${key}">${label} <span>${count}</span></button>`;
        }).join("")}
      </div>
      <div class="admin-reservation-grid">
        ${reservations.length ? reservations.map(adminReservationCard).join("") : `<p class="empty">해당 탭의 예약이 없습니다.</p>`}
      </div>
    </section>
  `;
}

export function adminReservationDetail(reservation) {
  const f = reservation.fields || {};
  if (reservation.type === "equipment") {
    return [
      ["대여/반납", `${f.rentalTime || "-"} / ${f.returnTime || "-"}`],
      ["기간", f.period || "-"],
      ["장비", (reservation.equipmentItems || []).map((item) => `${item.code} ${item.name}`).join(", ") || "-"],
      ["목적", f.purpose || "-"]
    ];
  }
  if (reservation.type === "studio") {
    return [
      ["시간", (f.timeSlots || []).join(", ") || "-"],
      ["공간", (f.studioSpaces || [f.studioSpace]).filter(Boolean).join(", ") || "-"],
      ["명단", f.participants || "-"],
      ["필요 장비", f.requiredEquipment || "-"]
    ];
  }
  if (reservation.type === "darkroom") {
    const chemicals = (f.chemicals || []).map((item) => `${item.name} ${item.amount}`).join(", ");
    return [
      ["시간", (f.timeSlots || []).join(", ") || "-"],
      ["작업", (f.processTypes || []).join(", ") || "-"],
      ["인원", `${f.participantCount || 1}명`],
      ["약품", chemicals || "-"]
    ];
  }
  return [
    ["시간", `${f.startTime || "-"}-${f.endTime || "-"}`],
    ["출력", `${f.printType || "-"} / ${f.paper || "-"} / ${f.size || "-"}`],
    ["매수", f.count || "-"],
    ["메모", f.memo || "-"]
  ];
}

export function adminReservationCard(reservation) {
  const f = reservation.fields || {};
  const rows = adminReservationDetail(reservation);
  return `
    <article class="admin-reservation-card">
      <div class="reservation-card-head">
        <div>
          <div class="chips"><span class="tag blue">${typeLabel[reservation.type]}</span>${tag(reservation.status)}</div>
          <h3>${escapeHtml(reservation.user?.name || "-")}</h3>
          <p>${escapeHtml(f.reservedDate || "-")} · ${escapeHtml(f.phone || reservation.user?.phone || "")}</p>
        </div>
      </div>
      <div class="property-list compact">
        ${rows.map(([key, value]) => `<div class="prop"><span class="key">${escapeHtml(key)}</span><span>${escapeHtml(value)}</span></div>`).join("")}
      </div>
      <div class="row-actions">
        ${reservation.type === "equipment" && reservation.status === "pending_approval" ? `<button class="button primary" data-res-status="${reservation.id}" data-status="approved">승인</button>` : ""}
        ${reservation.type === "equipment" ? `<button class="button" data-res-status="${reservation.id}" data-status="checked_out">대여</button><button class="button" data-res-status="${reservation.id}" data-status="returned">반납</button>` : ""}
        <button class="button" data-res-status="${reservation.id}" data-status="completed">완료</button>
        <button class="button danger" data-res-status="${reservation.id}" data-status="admin_cancelled">취소</button>
      </div>
    </article>
  `;
}

export function adminEquipmentView() {
  const active = state.adminEquipment.filter((item) => item.active !== false);
  const categories = equipmentCategories();
  const sourceTabs = [["department", "극기관"], ["fantasy_lab", "판타지랩"], ["all", "전체"]];
  const filtered = active
    .filter((item) => state.adminEquipmentTab === "all" || item.source === state.adminEquipmentTab)
    .filter((item) => state.adminEquipmentCategoryTab === "all" || item.category === state.adminEquipmentCategoryTab);
  return `
    <section class="grid">
      ${adminGuide("기자재 사용 가이드", "카테고리와 관리처를 먼저 정리한 뒤 장비를 등록합니다. CSV는 바로 등록하지 말고 미리보기로 행이 제대로 읽혔는지 확인한 다음 등록하세요.")}
      <div class="card">
        <h2 class="card-title">장비 추가</h2>
        <form class="grid two" data-form="equipment-add">
          <div class="field"><label>장비명</label><input class="input" name="name" required /></div>
          <div class="field"><label>카테고리</label><select class="select" name="category">${categories.map((item) => `<option>${escapeHtml(item)}</option>`).join("")}</select></div>
          <div class="field"><label>수량</label><input class="input" name="quantity" type="number" min="1" value="1" /></div>
          <div class="field"><label>코드 prefix</label><input class="input" name="codePrefix" placeholder="CAM-SONY-A7M3" /></div>
          <div class="field"><label>관리처</label><select class="select" name="source"><option value="department">극기관</option><option value="fantasy_lab">판타지랩</option></select></div>
          <div class="field"><label>비고</label><input class="input" name="notes" /></div>
          <button class="button primary" type="submit">추가</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">카테고리 추가</h2>
        <p class="muted">학생 예약 화면과 Admin 장비 등록 선택지에 같이 반영됩니다.</p>
        <form class="inline-form" data-form="equipment-category-add">
          <input class="input" name="categoryName" placeholder="예: Tripod, Monitor, Battery" required />
          <button class="button primary" type="submit">카테고리 추가</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">CSV 업로드</h2>
        <p class="muted">컬럼: facility,source,category,name,brand,model,quantity,code_prefix,reservable,inquiry_only,status,notes</p>
        <form data-form="equipment-import">
          <textarea class="textarea" name="csv" placeholder="CSV 내용을 붙여넣기"></textarea>
          <div class="row-actions">
            <button class="button" type="button" data-action="csv-preview">미리보기</button>
            <button class="button primary" type="submit">미리보기 내용 등록</button>
          </div>
        </form>
        ${state.csvPreviewRows.length ? csvPreviewTable(state.csvPreviewRows) : `<p class="empty">CSV를 붙여넣고 미리보기를 누르면 임시 표가 표시됩니다.</p>`}
      </div>
      <div class="card">
        <div class="form-head">
          <div>
            <h2 class="card-title">등록된 전체 기자재</h2>
            <p class="muted">관리처와 카테고리 탭으로 나눠 확인합니다.</p>
          </div>
          <span class="tag blue">${filtered.length}개</span>
        </div>
        <div class="tab-row">
          ${sourceTabs.map(([key, label]) => `<button class="tab-button ${state.adminEquipmentTab === key ? "active" : ""}" data-admin-equipment-tab="${key}">${label}</button>`).join("")}
        </div>
        <div class="tab-row wrap">
          <button class="tab-button ${state.adminEquipmentCategoryTab === "all" ? "active" : ""}" data-admin-equipment-category-tab="all">전체</button>
          ${categories.map((cat) => `<button class="tab-button ${state.adminEquipmentCategoryTab === cat ? "active" : ""}" data-admin-equipment-category-tab="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`).join("")}
        </div>
        <div class="table-wrap embedded">
          <table>
            <thead><tr><th>코드</th><th>장비</th><th>분류</th><th>관리처</th><th>상태</th><th>예약</th><th>작업</th></tr></thead>
            <tbody>${filtered.map((item) => `
              <tr>
                <td>${escapeHtml(item.code)}</td>
                <td>${escapeHtml(item.name)}<br><span class="muted">${escapeHtml(item.notes || "")}</span></td>
                <td>${escapeHtml(item.category)}</td>
                <td>${escapeHtml(sourceLabel[item.source] || item.facility || "-")}</td>
                <td>${escapeHtml(item.status)}</td>
                <td>${item.reservable ? tag("가능", "green") : tag("문의전용", "yellow")}</td>
                <td><button class="button danger" data-equipment-disable="${item.id}">비활성</button></td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

export function csvPreviewTable(rows) {
  const preview = rows.slice(0, 8);
  return `
    <div class="preview-box">
      <div class="form-head"><strong>임시 미리보기</strong><span class="tag yellow">${rows.length}행</span></div>
      <div class="table-wrap embedded">
        <table>
          <thead><tr><th>관리처</th><th>카테고리</th><th>장비명</th><th>수량</th><th>예약</th><th>비고</th></tr></thead>
          <tbody>${preview.map((row) => `
            <tr>
              <td>${escapeHtml(row.facility || sourceLabel[row.source] || row.source || "-")}</td>
              <td>${escapeHtml(row.category || "Other")}</td>
              <td>${escapeHtml(row.name || "(장비명 없음)")}</td>
              <td>${escapeHtml(row.quantity || "1")}</td>
              <td>${escapeHtml(row.reservable || row.inquiry_only || "-")}</td>
              <td>${escapeHtml(row.notes || "")}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
      ${rows.length > preview.length ? `<p class="muted">표시는 ${preview.length}행까지만 보여주고, 등록은 전체 ${rows.length}행을 사용합니다.</p>` : ""}
    </div>
  `;
}

export function adminReportsView() {
  return `
    <section class="grid">
      ${adminGuide("보고서 사용 가이드", "스튜디오 사용 후 학생이 제출한 보고서를 확인하는 화면입니다. 파손/이상 여부와 실제 사용 인원을 확인하고 필요한 경우 예약 상태를 완료 처리하세요.")}
      ${state.adminReports.length ? state.adminReports.map((report) => `
        <article class="card">
          <div class="chips"><span class="tag blue">스튜디오 보고서</span><span class="tag green">제출완료</span></div>
          <h3 class="card-title card-title-spaced">${escapeHtml(report.user?.name || "-")}</h3>
          <div class="property-list">
            <div class="prop"><span class="key">예약</span><span>${escapeHtml(report.reservationId)}</span></div>
            <div class="prop"><span class="key">사용 시간</span><span>${escapeHtml(report.fields.actualTime)}</span></div>
            <div class="prop"><span class="key">인원</span><span>${escapeHtml(report.fields.participants)}</span></div>
            <div class="prop"><span class="key">파손</span><span>${report.fields.damageFound ? escapeHtml(report.fields.damageDescription || "있음") : "없음"}</span></div>
          </div>
        </article>`).join("") : `<p class="empty">제출된 보고서가 없습니다.</p>`}
    </section>
  `;
}

export function adminLecturesView() {
  return `
    <section class="grid">
      ${adminGuide("비교과 특강 사용 가이드", "특강 정보를 등록하면 학생 화면에 리스트가 표시됩니다. 모집중 상태인 특강은 학생이 직접 신청할 수 있고, 결과는 CSV로 내려받아 엑셀에서 열 수 있습니다.")}
      <div class="card">
        <h2 class="card-title">특강 등록</h2>
        <form class="grid two" data-form="lecture-add">
          <div class="field"><label>특강명</label><input class="input" name="title" required /></div>
          <div class="field"><label>특강일</label><input class="input" name="lectureDate" type="date" required /></div>
          <div class="field"><label>시간</label><input class="input" name="time" placeholder="14:00-16:00" required /></div>
          <div class="field"><label>장소</label><input class="input" name="location" required /></div>
          <div class="field"><label>강사명</label><input class="input" name="instructorName" required /></div>
          <div class="field"><label>강사 소속</label><input class="input" name="instructorAffiliation" /></div>
          <div class="field"><label>담당교수</label><input class="input" name="professor" /></div>
          <div class="field"><label>대상 학년</label><input class="input" name="targetGrades" placeholder="예: 2-4학년" /></div>
          <div class="field"><label>모집인원</label><input class="input" name="capacity" type="number" min="0" value="0" /></div>
          <div class="field"><label>신청인원</label><input class="input" name="baseApplicationCount" type="number" min="0" value="0" /></div>
          <div class="field"><label>진행상태</label><select class="select" name="status">${lectureStatusOptions.map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>비고</label><input class="input" name="notes" /></div>
          <div class="field span-two"><label>특강 내용</label><textarea class="textarea" name="description" required></textarea></div>
          <button class="button primary" type="submit">특강 등록</button>
        </form>
      </div>
      <div class="card">
        <div class="form-head">
          <div>
            <h2 class="card-title">특강 리스트</h2>
            <p class="muted">날짜, 특강명, 강사명, 장소, 신청인원, 진행상태를 기준으로 확인합니다.</p>
          </div>
          <button class="button" data-action="lecture-export">CSV 내보내기</button>
        </div>
        ${state.adminLectures.length ? adminLectureTable(state.adminLectures) : `<p class="empty">등록된 비교과 특강이 없습니다.</p>`}
      </div>
    </section>
  `;
}

export function adminLectureTable(lectures) {
  return `
    <div class="table-wrap embedded">
      <table>
        <thead><tr><th>날짜</th><th>특강명</th><th>강사명</th><th>장소</th><th>신청인원</th><th>진행상태</th><th>작업</th></tr></thead>
        <tbody>${lectures.map((lecture) => {
          const count = Number(lecture.applicationCount || 0);
          const capacity = Number(lecture.capacity || 0);
          return `
            <tr>
              <td>${escapeHtml(lecture.lectureDate || "-")}<br><span class="muted">${escapeHtml(lecture.time || "")}</span></td>
              <td><strong>${escapeHtml(lecture.title)}</strong><br><span class="muted">${escapeHtml(lecture.description || "")}</span></td>
              <td>${escapeHtml(lecture.instructorName || "-")}<br><span class="muted">${escapeHtml(lecture.instructorAffiliation || "")}</span></td>
              <td>${escapeHtml(lecture.location || "-")}</td>
              <td>${capacity ? `${count}/${capacity}` : count}</td>
              <td><select class="select compact-select" data-lecture-status="${lecture.id}">${lectureStatusOptions.map((item) => `<option value="${item}" ${lecture.status === item ? "selected" : ""}>${item}</option>`).join("")}</select></td>
              <td>
                <button class="button compact" data-lecture-update="${lecture.id}">상태 저장</button>
                <div class="muted">${(lecture.applications || []).map((app) => `${app.userName || app.name || ""} ${app.studentId || ""}`).filter(Boolean).join(", ") || "신청자 없음"}</div>
              </td>
            </tr>
          `;
        }).join("")}</tbody>
      </table>
    </div>
  `;
}

export function adminNoticesView() {
  return `
    <section class="grid">
      ${adminGuide("공지사항 사용 가이드", "비교과, 특강, 장비/시설 안내를 학생 화면에 공지합니다. 중요한 내용은 상단 고정으로 설정하고, 신청은 Slack 링크나 외부 링크를 넣으면 됩니다.")}
      <div class="card">
        <h2 class="card-title">공지 작성</h2>
        <form data-form="notice-add">
          <div class="field"><label>제목</label><input class="input" name="title" required /></div>
          <div class="field"><label>카테고리</label><select class="select" name="category">${["일반", "비교과", "특강", "장비/시설", "긴급"].map((item) => `<option>${item}</option>`).join("")}</select></div>
          <div class="field"><label>본문</label><textarea class="textarea" name="body" required></textarea></div>
          <div class="field"><label>신청/참고 링크</label><input class="input" name="link" /></div>
          <label class="field"><span><input type="checkbox" name="pinned" value="true" /> 상단 고정</span></label>
          <button class="button primary" type="submit">게시</button>
        </form>
      </div>
      ${state.adminNotices.map(noticeCard).join("")}
    </section>
  `;
}

export function adminSettingsView() {
  const settings = state.bootstrap.settings;
  return `
    <section class="grid">
      ${adminGuide("설정 사용 가이드", "학기별 수업 시간, 출력실 시간, 암실 정원처럼 예약 규칙에 영향을 주는 값을 관리합니다. 차단 일정은 캘린더에 표시되어 조교가 학기 운영 상황을 빠르게 확인할 수 있습니다.")}
      <div class="card">
        <h2 class="card-title">운영 설정</h2>
        <form data-form="settings-save">
          <div class="field"><label>출력비 계좌 안내</label><input class="input" name="printBankAccount" value="${escapeHtml(settings.printBankAccount)}" /></div>
          <div class="field"><label>암실 최대 인원</label><input class="input" name="darkroomCapacity" type="number" min="1" value="${settings.darkroomCapacity}" /></div>
          <div class="field"><label>출력실 시작</label><input class="input" name="printAvailableStart" value="${escapeHtml(settings.printAvailableStart)}" /></div>
          <div class="field"><label>출력실 종료</label><input class="input" name="printAvailableEnd" value="${escapeHtml(settings.printAvailableEnd)}" /></div>
          <button class="button primary" type="submit">저장</button>
        </form>
      </div>
      <div class="card">
        <h2 class="card-title">수업/학기 차단 일정</h2>
        <p class="muted">예: 월요일 10:30-17:00 Studio A/B 사용 불가. 등록 후 아래 캘린더에 표시됩니다.</p>
        <form class="grid two" data-form="blocked-schedule-add">
          <div class="field"><label>시설</label><select class="select" name="type">
            <option value="studio">스튜디오</option>
            <option value="darkroom">암실</option>
            <option value="equipment">기자재</option>
            <option value="print">출력실</option>
          </select></div>
          <div class="field"><label>요일</label><select class="select" name="day">
            ${Object.entries(weekdayLabel).map(([key, label]) => `<option value="${key}">${label}요일</option>`).join("")}
          </select></div>
          <div class="field"><label>시작일</label><input class="input" name="from" type="date" required /></div>
          <div class="field"><label>종료일</label><input class="input" name="to" type="date" required /></div>
          <div class="field"><label>시작 시간</label><input class="input" name="start" placeholder="10:30" required /></div>
          <div class="field"><label>종료 시간</label><input class="input" name="end" placeholder="17:00" required /></div>
          <div class="field"><label>공간/메모</label><input class="input" name="target" placeholder="Studio A,B / 수업명" /></div>
          <button class="button primary" type="submit">차단 일정 추가</button>
        </form>
        ${blockedScheduleList(settings.blockedSchedules || [])}
      </div>
      ${adminBlockedCalendar(settings.blockedSchedules || [])}
      <div class="card"><h2 class="card-title">Slack</h2><p class="muted">Webhook URL은 코드가 아니라 서버 환경변수 SLACK_WEBHOOK_URL에 저장합니다.</p></div>
    </section>
  `;
}

export function blockedScheduleList(items) {
  if (!items.length) return `<p class="empty">등록된 차단 일정이 없습니다.</p>`;
  return `
    <div class="blocked-list">
      ${items.map((item) => `
        <div class="blocked-item">
          <span class="tag blue">${typeLabel[item.type] || item.type}</span>
          <strong>${weekdayLabel[item.day] || item.day}요일 ${escapeHtml(item.start)}-${escapeHtml(item.end)}</strong>
          <span>${escapeHtml(item.from)} ~ ${escapeHtml(item.to)} · ${escapeHtml(item.target || "전체")}</span>
          <button class="button danger compact" data-blocked-remove="${item.id}">삭제</button>
        </div>
      `).join("")}
    </div>
  `;
}

export function adminBlockedCalendar(items) {
  const monthKey = state.calendarMonth || todayKey().slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = dateKey(day);
    const blocked = blockedItemsForDate(items, key);
    return { key, day: day.getDate(), currentMonth: day.getMonth() === month - 1, blocked };
  });
  return `
    <section class="calendar-card">
      <div class="calendar-head">
        <div>
          <p class="eyebrow">학기 차단 캘린더</p>
          <h2>${monthTitle(monthKey)}</h2>
        </div>
        <div class="row-actions">
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, -1)}">이전</button>
          <button class="button compact" type="button" data-calendar-month="${todayKey().slice(0, 7)}">오늘</button>
          <button class="button compact" type="button" data-calendar-month="${addMonths(monthKey, 1)}">다음</button>
        </div>
      </div>
      <div class="calendar-weekdays">${["일", "월", "화", "수", "목", "금", "토"].map((item) => `<span>${item}</span>`).join("")}</div>
      <div class="calendar-grid-large">
        ${days.map((day) => `
          <div class="calendar-day ${day.currentMonth ? "" : "outside"} ${day.blocked.length ? "blocked" : ""}">
            <span>${day.day}</span>
            ${day.blocked.slice(0, 2).map((item) => `<small>${typeLabel[item.type] || item.type} ${escapeHtml(item.start)}-${escapeHtml(item.end)}</small>`).join("")}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}
