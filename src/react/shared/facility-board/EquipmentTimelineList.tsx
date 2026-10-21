import React from 'react';
import { GjuButton, GjuIconButton } from '../../design-system/Button';
import { GjuIcon } from '../../design-system/icons';
import { GjuStatusBadge } from '../../design-system/StatusBadge';
import { canOpenReservation, overlaps, intervalLabel, dateTimeLabel, equipmentViews, equipmentReservationIntent, equipmentCategory, equipmentSourceLabel, type TimeWindow } from './model';
import type { FacilityBoardProps, FacilityTimelineData } from './types';

type Props=Pick<FacilityBoardProps,'viewer'|'onOpenEquipment'|'onOpenReservation'|'onReserve'> & {data:FacilityTimelineData;window:TimeWindow;now:number};
export function EquipmentTimelineList({data,window,now,viewer,onOpenEquipment,onOpenReservation,onReserve}:Props) {
  const [expanded,setExpanded]=React.useState(false);
  const records=equipmentViews(data,window,now);
  const blocked=(data.equipmentBlockedIntervals||[]).filter(record=>overlaps(record,window));
  return <section className="gju-facility-board__equipment" aria-label="이 시간의 장비">
    <div className="gju-facility-board__section-heading"><h3><GjuIcon name="camera"/> 장비 <span>{records.length}</span></h3>{viewer==='admin'&&onOpenEquipment&&<GjuIconButton label="장비 관리" icon="wrench" onClick={()=>onOpenEquipment()}/>}</div>
    {blocked.slice(0,5).map((record,index)=><p className="gju-facility-board__restriction" aria-label={`장비 예약 제한 · ${record.label}`} key={index}><GjuIcon name="warning"/>{record.label} · {intervalLabel(record)}</p>)}
    {!records.length?<p className="gju-facility-board__empty">예약·대여 없음</p>:<ul className={`gju-facility-board__equipment-list${expanded?' is-expanded':''}`}>
      {(expanded?records:records.slice(0,5)).map(({item,view})=><li key={item.equipmentId}>
        <div className="gju-facility-board__equipment-top"><strong>{item.name}{viewer==='admin'&&item.code&&<small> · {item.code}</small>}</strong><GjuStatusBadge tone={view.tone}>{view.status}</GjuStatusBadge></div>
        <div className="gju-facility-board__item-meta"><GjuIcon name="user"/>{view.label}{view.records.length>1?` +${view.records.length-1}`:''}</div>
        <div className="gju-facility-board__item-meta" title={item.custody?'반납 예정':'예약 시간'}><GjuIcon name="clock"/>{item.custody?dateTimeLabel(item.custody.expectedReturnAt):view.records[0]?intervalLabel(view.records[0]):view.note}</div>
        <div className="gju-facility-board__actions">
          <details className="gju-facility-board__equipment-info"><summary aria-label={`${item.name} 장비 정보`} title="장비 정보"><GjuIcon name="info"/></summary><div><p>{equipmentCategory(item.category)} · {`등록 시설: ${item.facility||'미등록'} · 관리처: ${equipmentSourceLabel(item.source)}`}</p><p>{view.note}</p><p>장비의 실제 위치를 뜻하지 않습니다.</p></div></details>
          {viewer==='admin'&&onOpenEquipment&&<GjuIconButton label="장비 상세" icon="wrench" onClick={()=>onOpenEquipment(item.equipmentId)}/>}
          {onOpenReservation&&item.custody&&canOpenReservation(item.custody,viewer)&&<GjuIconButton label={viewer==='admin'?'대여 상세':'내 대여 상세'} icon="fileText" onClick={()=>onOpenReservation(item.custody!.reservationId!)}/>}
          {view.records.filter(record=>canOpenReservation(record,viewer)).slice(0,5).map((record,index)=><GjuIconButton key={`${record.reservationId}-${index}`} label={`${viewer==='admin'?'예약 상세':'내 예약 상세'}${view.records.length>1?` ${index+1}`:''}`} icon="fileText" onClick={()=>onOpenReservation?.(record.reservationId!)}/>)}
          {viewer==='student'&&onReserve&&<GjuIconButton label="이 장비 예약" icon="plus" disabled={blocked.length>0} onClick={()=>void onReserve(equipmentReservationIntent(item,data.date))}/>}
        </div>
      </li>)}
    </ul>}
    {records.length>5&&<GjuButton variant="ghost" icon={expanded?'chevronLeft':'chevronRight'} aria-label={expanded?'5행으로 접기':`전체 ${records.length}점 보기`} aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'5':records.length}</GjuButton>}
    {viewer==='student'&&onReserve&&<GjuButton icon="plus" variant="outline" aria-label="장비 예약하기" disabled={blocked.length>0} onClick={()=>void onReserve({type:'equipment',selectedDate:data.date})}>예약</GjuButton>}
  </section>;
}
