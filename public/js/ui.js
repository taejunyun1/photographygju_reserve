import { escapeHtml, normalizeUnicodeText } from "./utils.js?v=20260702-admin-scroll-fix";

export function cx(...classes) {
  return classes.flat().filter(Boolean).join(" ");
}

const ICONS = {
  arrowRight: '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
  arrowUpRight: '<path d="M7 17 17 7"></path><path d="M7 7h10v10"></path>',
  calendar: '<path d="M8 2v4"></path><path d="M16 2v4"></path><rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M3 10h18"></path>',
  camera: '<path d="M14.5 5 13 3H9L7.5 5H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3z"></path><circle cx="12" cy="13" r="3.5"></circle>',
  check: '<path d="m5 12 4 4L19 6"></path>',
  chevronLeft: '<path d="m15 18-6-6 6-6"></path>',
  download: '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path>',
  edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>',
  external: '<path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h5"></path>',
  fileText: '<path d="M14 2H7a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8z"></path><path d="M14 2v6h6"></path><path d="M8 13h8"></path><path d="M8 17h6"></path>',
  home: '<path d="m3 11 9-8 9 8"></path><path d="M5 10v10h14V10"></path><path d="M9 20v-6h6v6"></path>',
  logIn: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path>',
  logOut: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="M16 17l5-5-5-5"></path><path d="M21 12H9"></path>',
  megaphone: '<path d="M3 11v2a2 2 0 0 0 2 2h2l4 5v-5l8-3V7l-8-3v12"></path><path d="M7 15V9"></path>',
  moon: '<path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 6.5 6.5 0 0 0 21 14.5z"></path>',
  plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
  printer: '<path d="M7 9V3h10v6"></path><path d="M7 17H5a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3h-2"></path><path d="M7 14h10v7H7z"></path>',
  send: '<path d="m22 2-7 20-4-9-9-4z"></path><path d="M22 2 11 13"></path>',
  spark: '<path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"></path>',
  trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path>',
  user: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
  userPlus: '<path d="M16 21a6 6 0 0 0-12 0"></path><circle cx="10" cy="8" r="4"></circle><path d="M19 8v6"></path><path d="M16 11h6"></path>',
  users: '<path d="M16 21a6 6 0 0 0-12 0"></path><circle cx="10" cy="8" r="4"></circle><path d="M22 21a5 5 0 0 0-4-4.9"></path><path d="M17 4.1a4 4 0 0 1 0 7.8"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>'
};

export function icon(name, className = "") {
  const paths = ICONS[name];
  if (!paths) return "";
  return `<svg class="${cx("button-icon", className)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;
}

export function sectionHeader({ title, subtitle = "", meta = "", actions = "", className = "" }) {
  return `
    <div class="${cx("ui-section-head", className)}">
      <div>
        ${meta ? `<p class="ui-section-meta">${escapeHtml(meta)}</p>` : ""}
        <h2 class="card-title">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="muted">${escapeHtml(subtitle)}</p>` : ""}
      </div>
      ${actions ? `<div class="ui-section-actions">${actions}</div>` : ""}
    </div>
  `;
}

export function card({ title = "", subtitle = "", meta = "", actions = "", body = "", footer = "", className = "", tag = "section" }) {
  const heading = title || subtitle || meta || actions
    ? sectionHeader({ title, subtitle, meta, actions })
    : "";
  return `
    <${tag} class="${cx("card", "ui-card", className)}">
      ${heading}
      ${body}
      ${footer ? `<div class="ui-card-footer">${footer}</div>` : ""}
    </${tag}>
  `;
}

export function emptyState({ title = "표시할 항목이 없습니다.", body = "", action = "", className = "" } = {}) {
  return `
    <div class="${cx("empty", "ui-empty", className)}">
      <strong>${escapeHtml(title)}</strong>
      ${body ? `<span>${escapeHtml(body)}</span>` : ""}
      ${action}
    </div>
  `;
}

export function actionRow(actions = "", className = "") {
  const content = String(actions || "").trim();
  return content ? `<div class="${cx("row-actions", "ui-action-row", className)}">${content}</div>` : "";
}

export function tabs(items, { active = "", dataset = "", className = "wrap", ariaLabel = "탭" } = {}) {
  const buttons = items.map((item) => {
    const key = item.key ?? item[0];
    const label = item.label ?? item[1];
    const count = item.count ?? item[2];
    const attrs = item.attrs || (dataset ? `data-${dataset}="${escapeHtml(key)}"` : "");
    return `
      <button class="tab-button ${active === key ? "active" : ""}" type="button" ${attrs}>
        ${escapeHtml(label)}${count !== undefined ? ` <span>${escapeHtml(count)}</span>` : ""}
      </button>
    `;
  }).join("");
  return `<div class="${cx("tab-row", className)}" aria-label="${escapeHtml(ariaLabel)}">${buttons}</div>`;
}

export function statCard({ label, value, caption = "", attrs = "", tone = "" }) {
  return `
    <button class="${cx("stat", "stat-button", "ui-stat-card", tone && `tone-${tone}`)}" ${attrs}>
      <span class="muted">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${caption ? `<em>${escapeHtml(caption)}</em>` : ""}
    </button>
  `;
}

export function propertyList(items, { compact = false, className = "" } = {}) {
  return `
    <div class="${cx("property-list", compact && "compact", "ui-property-list", className)}">
      ${items.map(([key, value]) => `
        <div class="prop">
          <span class="key">${escapeHtml(key)}</span>
          <span>${value}</span>
        </div>
      `).join("")}
    </div>
  `;
}

export function searchField({ value = "", placeholder = "검색", dataset = "", label = "" }) {
  return `
    <div class="field ui-search-field">
      ${label ? `<label>${escapeHtml(label)}</label>` : ""}
      <input class="input" type="text" role="searchbox" inputmode="search" enterkeyhint="search" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(normalizeUnicodeText(value))}" ${dataset} autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" />
    </div>
  `;
}

export function accordion({ title, body = "", summary = "", open = false, className = "", attrs = "" }) {
  return `
    <details class="${cx("ui-accordion", className)}" ${open ? "open" : ""} ${attrs}>
      <summary>
        <span>${escapeHtml(title)}</span>
        ${summary ? `<em>${escapeHtml(summary)}</em>` : ""}
      </summary>
      <div class="ui-accordion-body">${body}</div>
    </details>
  `;
}

export function pagination({ page = 1, totalPages = 1, dataset = "page", className = "" } = {}) {
  const current = Math.max(1, Number(page) || 1);
  const total = Math.max(1, Number(totalPages) || 1);
  const pages = [];
  for (let index = 1; index <= total; index += 1) {
    if (total > 7 && index !== 1 && index !== total && Math.abs(index - current) > 1) {
      if (pages[pages.length - 1] !== "ellipsis") pages.push("ellipsis");
      continue;
    }
    pages.push(index);
  }
  return `
    <nav class="${cx("pagination", className)}" aria-label="페이지 이동">
      <button class="button compact pagination-button" type="button" data-${dataset}="${Math.max(1, current - 1)}" ${current <= 1 ? "disabled" : ""}>이전</button>
      ${pages.map((item) => item === "ellipsis"
        ? `<span class="pagination-summary">...</span>`
        : `<button class="button compact pagination-button ${item === current ? "is-active" : ""}" type="button" data-${dataset}="${item}" aria-current="${item === current ? "page" : "false"}">${item}</button>`
      ).join("")}
      <button class="button compact pagination-button" type="button" data-${dataset}="${Math.min(total, current + 1)}" ${current >= total ? "disabled" : ""}>다음</button>
    </nav>
  `;
}
