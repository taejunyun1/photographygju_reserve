function leapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function normalizedDateKey(value) {
  const match = String(value || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

export function dateToAcademicSemesterKey(value) {
  const date = normalizedDateKey(value);
  if (!date) return "";
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  if (month >= 3 && month <= 8) return `${year}-S1`;
  if (month >= 9 && month <= 12) return `${year}-S2`;
  if (month >= 1 && month <= 2) return `${year - 1}-S2`;
  return "";
}

export function academicSemesterLabel(key) {
  const match = String(key || "").match(/^(\d{4})-S([12])$/);
  if (!match) return "";
  return `${match[1]}년 ${match[2]}학기`;
}

export function academicSemesterRange(key) {
  const match = String(key || "").match(/^(\d{4})-S([12])$/);
  if (!match) return null;
  const year = Number(match[1]);
  if (match[2] === "1") return { from: `${year}-03-01`, to: `${year}-08-31` };
  const nextYear = year + 1;
  return { from: `${year}-09-01`, to: `${nextYear}-02-${leapYear(nextYear) ? "29" : "28"}` };
}

export function dateMatchesAcademicSemester(value, key) {
  if (!key || key === "all") return true;
  return dateToAcademicSemesterKey(value) === key;
}

export function academicSemesterOptionsFromDates(values = []) {
  return [...new Set(values.map(dateToAcademicSemesterKey).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ key, label: academicSemesterLabel(key) }));
}
