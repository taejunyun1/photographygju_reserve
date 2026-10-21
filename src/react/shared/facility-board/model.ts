import type { FacilityEquipmentTimeline, FacilityReservationInterval, FacilityReservationIntent, FacilitySpaceTimeline, FacilityTimelineData, FacilityViewer } from './types';

export type TimeWindow = { start: number; end: number };
export function kstDate(date = new Date()): string { return new Date(date.getTime()+9*3600000).toISOString().slice(0,10); }
export function kstTime(date = new Date()): string { return new Date(date.getTime()+9*3600000).toISOString().slice(11,16); }
export function timeWindow(date: string, time: string, hours = 2): TimeWindow {
  const start = Date.parse(`${date}T${time}:00+09:00`);
  return {start,end:Math.min(start+hours*3600000,Date.parse(`${date}T00:00:00+09:00`)+24*3600000)};
}
export function overlaps(record: {startAt:string;endAt:string}, window: TimeWindow): boolean { return Date.parse(record.startAt)<window.end && Date.parse(record.endAt)>window.start; }
export function clockLabel(value: string | number | null): string {
  if(value===null) return '시각 미기록';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '시각 미기록' : kstTime(date);
}
export function dateTimeLabel(value: string | null): string {
  if (!value) return '예정 미등록';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '시각 미기록' : `${kstDate(date).slice(5).replace('-','/')} ${kstTime(date)}`;
}
export function intervalLabel(record:{startAt:string;endAt:string}):string {
  const crossDate=kstDate(new Date(record.startAt))!==kstDate(new Date(record.endAt));
  return `${clockLabel(record.startAt)}–${crossDate?'다음날 ':''}${clockLabel(record.endAt)}`;
}
export function statusLabel(status:string): string {
  if (status==='pending'||status==='pending_approval') return '승인 대기';
  if (status==='checked_out') return '예약표 · 반출 확인';
  if (status==='approved'||status==='auto_confirmed') return '예약';
  return '예약 예정';
}
export function visibleIntervals(space:FacilitySpaceTimeline,window:TimeWindow) { return space.intervals.filter(record=>overlaps(record,window)); }
export function spaceSummary(space: FacilitySpaceTimeline | undefined,window:TimeWindow) {
  if (!space) return {label:'자료 없음',count:0,blocked:false};
  const records=visibleIntervals(space,window);
  const blocked=space.blockedIntervals.some(record=>overlaps(record,window));
  return {label:records.length?`${records[0].label}${records.length>1?` 외 ${records.length-1}건`:''}`:blocked?'이용 제한':'예약 없음',count:records.length,blocked};
}
export function canOpenReservation(record:{reservationId?:string;isMine:boolean},viewer:FacilityViewer):boolean { return Boolean(record.reservationId&&(viewer==='admin'||record.isMine)); }
export function reservationIntent(space: FacilitySpaceTimeline,selectedDate:string):FacilityReservationIntent { return {type:space.type,selectedDate}; }
export function equipmentReservationIntent(equipment:FacilityEquipmentTimeline,selectedDate:string):FacilityReservationIntent { return {type:'equipment',selectedDate,equipmentItemIds:[equipment.equipmentId]}; }
export function equipmentSourceLabel(source:string):string { return ({department:'극기관',fantasy_lab:'판타지랩',external:'외부 재고',inventory:'등록 재고'} as Record<string,string>)[source]||source||'미등록'; }
export function equipmentCategory(category:string):string { return category||'장비'; }
export function isFresh(data:FacilityTimelineData|null,date:string,now=Date.now()):boolean { return Boolean(data&&data.date===date&&Date.parse(data.validUntil)>now); }

export type EquipmentView = { status:string; tone:'green'|'amber'|'red'|'blue'|'neutral'; label:string; note:string; records: Array<{startAt:string;endAt:string;label:string;isMine:boolean;reservationId?:string}> };
/** Reservations do not establish physical custody. Past records require actual timestamps. */
export function equipmentAt(item:FacilityEquipmentTimeline,window:TimeWindow,now:number):EquipmentView|null {
  const reservations=item.reservations.filter(record=>overlaps(record,window));
  const history=item.history.filter(record=>overlaps(record,window));
  const custody=item.custody;
  const past=window.end<=now;
  const future=window.start>now;
  if (custody) {
    const checkedOut=custody.checkedOutAt?Date.parse(custody.checkedOutAt):NaN;
    const started=Number.isFinite(checkedOut)&&checkedOut<window.end;
    if ((!past || started) && (!Number.isFinite(checkedOut)||started)) {
      const due=custody.expectedReturnAt?Date.parse(custody.expectedReturnAt):NaN;
      const late=custody.overdue||Number.isFinite(due)&&due<now;
      const status=past?'대여 기록 · 미반납':future?(late||Number.isFinite(due)&&due<=window.start?'미반납 · 인계 확인 필요':'반납 예정 기준 예상'):late?'반납 지연 · 종료 미정':'대여 중';
      return {status,tone:late?'red':future?'amber':'green',label:custody.label,note:`반납 예정 ${dateTimeLabel(custody.expectedReturnAt)}${!custody.checkedOutAt?' · 반출 시각 미기록':''}`,records:reservations};
    }
  }
  if (history.length) return {status:'실제 대여 이력',tone:'neutral',label:history[0].label,note:history.map(intervalLabel).join(', '),records:history};
  if (past&&custody&&!custody.checkedOutAt) return {status:'이력 확인 불가',tone:'neutral',label:'현재 반출 기록 있음',note:'반출 시각이 없어 선택 구간의 대여 이력을 확인할 수 없습니다.',records:reservations};
  if (reservations.length) {
    const pending=reservations.every(record=>(record.status==='pending'||record.status==='pending_approval'));
    const review=reservations.some(record=>record.handoffNeedsReview);
    return {status:past||reservations.some(record=>record.historyUnavailable)?'이력 확인 불가 · 예약표':review?'예약 예정 · 인계 확인 필요':pending?'승인 대기':'예약 예정',tone:review?'red':pending?'amber':'blue',label:reservations[0].label,note:reservations.map(intervalLabel).join(', '),records:reservations};
  }
  return null;
}
export function equipmentViews(data:FacilityTimelineData,window:TimeWindow,now:number) { return data.equipment.flatMap(item=>{const view=equipmentAt(item,window,now);return view?[{item,view}]:[];}); }
