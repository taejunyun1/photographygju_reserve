import type { StudentEquipmentRequest } from "./types";

export function cleanEquipmentRequests(rows: readonly StudentEquipmentRequest[] | undefined): Array<{ name: string; quantity: number; note: string }> {
  const filled = (rows || []).filter((row) => String(row.name || "").trim() || String(row.note || "").trim() || Number(row.quantity) !== 1);
  if (filled.length > 20) throw new Error("요청 기자재는 최대 20개까지 입력하세요.");
  return filled.map((row, index) => {
    const name = String(row.name || "").trim();
    const note = String(row.note || "").trim();
    const quantity = Number(row.quantity);
    if (!name || name.length > 120) throw new Error(`${index + 1}번째 요청 기자재 이름을 입력하세요.`);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error(`${index + 1}번째 요청 기자재 수량은 1~99개로 입력하세요.`);
    if (note.length > 500) throw new Error(`${index + 1}번째 요청 기자재 설명은 500자 이하로 입력하세요.`);
    return { name, quantity, note };
  });
}

export function equipmentRequestSummary(rows: readonly StudentEquipmentRequest[] | undefined): string {
  return (rows || []).map((row) => {
    const name = String(row.name || "").trim();
    if (!name) return "";
    return `${name} × ${Number(row.quantity) || 1}`;
  }).filter(Boolean).join(", ");
}
