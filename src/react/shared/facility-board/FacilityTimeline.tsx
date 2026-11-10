import React from 'react';
import { clockLabel, overlaps, equipmentAt, equipmentCategory, digitalLabSummary, spaceSummary, timeWindow, type TimeWindow } from './model';
import type { FacilitySelectionKey, FacilityTimelineData } from './types';

export function FacilityTimeline({data,window,now,active=true,onChoose}:{data:FacilityTimelineData;window:TimeWindow;now:number;active?:boolean;onChoose:(time:string,key:FacilitySelectionKey)=>void}) {
  const scrollRef=React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{
    const scroll=scrollRef.current;
    if(!active||!scroll||!globalThis.matchMedia?.('(max-width: 620px)').matches) return;
    const selected=scroll.querySelector<HTMLElement>('button[data-selected]');
    const heading=scroll.querySelector('th');
    if(selected&&heading) scroll.scrollLeft=Math.max(0,scroll.scrollLeft+selected.getBoundingClientRect().left-scroll.getBoundingClientRect().left-heading.getBoundingClientRect().width-6);
  },[active,window.start]);
  const times=Array.from({length:12},(_,index)=>`${String(index*2).padStart(2,'0')}:00`);
  const categories=[...new Set(data.equipment.map(item=>equipmentCategory(item.category)))];
  if(!categories.length&&data.equipmentBlockedIntervals?.length) categories.push('장비');
  return <><div ref={scrollRef} className="gju-facility-board__timeline-scroll" tabIndex={0} aria-label="하루 시간표, 가로로 스크롤 가능">
    <table className="gju-facility-board__timeline"><caption>하루 시간표 · 각 칸은 2시간 구간과 겹치는 예약입니다</caption><thead><tr><th scope="col">공간 / 분류</th>{times.map(time=><th scope="col" key={time}>{time.slice(0,2)}시</th>)}</tr></thead><tbody>
      {data.spaces.map(space=><tr key={space.key}><th scope="row">{space.name}</th>{times.map(time=>{
        const period=timeWindow(data.date,time);
        if(space.key==='digital'){
          const summary=digitalLabSummary(space,period);
          const label=`${summary.label}${summary.restriction?` · ${summary.restriction}`:''}`;
          return <td key={time}><button type="button" data-selected={window.start>=period.start&&window.start<period.end||undefined} data-event={summary.restriction?'blocked':undefined} aria-label={`${space.name} ${time}–${clockLabel(period.end)}, ${label}`} title={label} onClick={()=>onChoose(time,space.key)}>{summary.restriction?'제한':summary.groups.map(group=>group.count).join(' · ')}</button></td>;
        }
        const summary=spaceSummary(space,period);
        return <td key={time}><button type="button" data-selected={window.start>=period.start&&window.start<period.end||undefined} data-event={summary.count?'reserved':summary.blocked?'blocked':undefined} aria-label={`${space.name} ${time}–${clockLabel(period.end)}, ${summary.label}${summary.count>1?`, ${summary.count}건`:''}`} title={summary.label} onClick={()=>onChoose(time,space.key)}>{summary.count?summary.label:summary.blocked?'제한':'—'}</button></td>;
      })}</tr>)}
      {categories.map(category=><tr key={`equipment-${category}`}><th scope="row">{category}</th>{times.map(time=>{
        const period=timeWindow(data.date,time);
        const records=data.equipment.filter(item=>equipmentCategory(item.category)===category).map(item=>equipmentAt(item,period,now)).filter(Boolean);
        const actual=records.filter(record=>record?.status==='대여 중'||record?.status==='반납 지연 · 종료 미정').length;
        const pending=records.filter(record=>record?.status==='승인 대기').length;
        const blocked=(data.equipmentBlockedIntervals||[]).some(record=>overlaps(record,period));
        const label=(records.length?`${records.length}점${pending?' (대기 포함)':''}`:'예약·대여 자료 없음')+(blocked?' · 장비 예약 제한':'');
        return <td key={time}><button type="button" data-event={blocked?'blocked':records.length?'equipment':undefined} data-selected={window.start>=period.start&&window.start<period.end||undefined} aria-label={`${category} ${time}, ${label}${actual?`, 실제 대여 ${actual}점`:''}`} onClick={()=>onChoose(time,'gear')}>{records.length?`${records.length}점`:blocked?'제한':'—'}</button></td>;
      })}</tr>)}
    </tbody></table>
  </div></>;
}
