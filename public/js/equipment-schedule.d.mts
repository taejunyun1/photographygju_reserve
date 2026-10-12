export interface EquipmentScheduleFields {
  reservedDate?: unknown;
  period?: unknown;
  rentalTime?: unknown;
  returnTime?: unknown;
}
export interface EquipmentScheduledWindow {
  startAt: string;
  endAt: string;
}
export function equipmentScheduledWindow(fields: EquipmentScheduleFields | null | undefined): EquipmentScheduledWindow | null;
export function equipmentWindowsOverlap(left: EquipmentScheduledWindow | null | undefined, right: EquipmentScheduledWindow | null | undefined): boolean;
