const MAX_REQUESTS = 20;

function invalid(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

export function normalizeRequestedEquipment(value) {
  if (!Array.isArray(value)) invalid("요청 기자재 목록은 배열이어야 합니다.");
  if (value.length > MAX_REQUESTS) invalid(`요청 기자재는 최대 ${MAX_REQUESTS}개까지 입력하세요.`);
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) invalid(`${index + 1}번째 요청 기자재를 확인하세요.`);
    const name = String(row.name ?? "").trim();
    const note = String(row.note ?? "").trim();
    const quantity = Number(row.quantity);
    if (!name || name.length > 120) invalid(`${index + 1}번째 요청 기자재 이름은 1~120자로 입력하세요.`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) invalid(`${index + 1}번째 요청 기자재 수량은 1~99개로 입력하세요.`);
    if (note.length > 500) invalid(`${index + 1}번째 요청 기자재 설명은 500자 이하로 입력하세요.`);
    return { name, quantity, note };
  });
}

export function formatRequestedEquipment(value) {
  if (!Array.isArray(value)) return "";
  return value.map((row) => {
    const name = String(row?.name || "").trim();
    if (!name) return "";
    const quantity = Number(row?.quantity) || 1;
    const note = String(row?.note || "").trim();
    return `${name} × ${quantity}${note ? ` (${note})` : ""}`;
  }).filter(Boolean).join(", ");
}
