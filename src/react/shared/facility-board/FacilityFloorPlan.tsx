import React from 'react';
import { FACILITY_LAYOUT, FACILITY_ROOM_NUMBERS, FACILITY_SELECTION_ORDER } from './layout';
import { spaceSummary, overlaps, visibleIntervals, type TimeWindow } from './model';
import type { FacilitySelectionKey, FacilityTimelineData } from './types';

function PixelFurniture({kind}:{kind:string}) {
  const path=kind==='gear'?'M2 2h58v3H2zm0 14h58v3H2zm0 14h58v3H2zM2 2h3v31H2zm55 0h3v31h-3zM9 7h10v6H9zm16 0h6v6h-6zm14 0h9v6h-9zM9 21h10v6H9zm16 0h6v6h-6zm14 0h9v6h-9z':kind==='print'?'M4 9h52v18H4zm5 18h4v5H9zm38 0h4v5h-4zM11 3h37v7H11zm0 16h37v4H11z':kind==='dark'?'M2 26h58v4H2zM7 20h12v6H7zm22 0h12v6H29zM10 4h5v15h-5zm22 0h5v15h-5zM6 2h13v5H6zm22 0h13v5H28zM49 8h9v12h-9z':'M4 2h38v3H4zm0 3h3v20H4zm35 0h3v20h-3zM7 24h35v3H7zM50 5h9v8h-9zm3 9h3v16h-3zm-5 16h14v3H48zM20 29h9v3h-9z';
  return <svg viewBox="0 0 64 36" className="gju-facility-board__furniture" aria-hidden="true"><path fill="currentColor" d={path}/></svg>;
}
export function FacilityFloorPlan({data,window,selection,onSelect,zoomed}:{data:FacilityTimelineData;window:TimeWindow;selection:FacilitySelectionKey|null;onSelect:(key:FacilitySelectionKey)=>void;zoomed:boolean}) {
  const refs=React.useRef(new Map<string,HTMLButtonElement>());
  const navigate=(key:FacilitySelectionKey,event:React.KeyboardEvent<HTMLButtonElement>)=>{
    if(!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    const current=FACILITY_SELECTION_ORDER.indexOf(key);
    const next=event.key==='Home'?0:event.key==='End'?4:(current+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+5)%5;
    event.preventDefault(); refs.current.get(FACILITY_SELECTION_ORDER[next])?.focus();
  };
  return <div className={`gju-facility-board__floor-viewport${zoomed?' is-zoomed':''}`}>
    <div className="gju-facility-board__floor" role="group" aria-label="복도 평면도. 공간 요약에서도 같은 정보를 확인할 수 있습니다.">
      <div className="gju-facility-board__hall" aria-hidden="true"><span>← 복도</span><span>복도 →</span></div>
      <div className="gju-facility-board__gate" aria-hidden="true"/>
      {FACILITY_LAYOUT.map(position=>{
        const style={'--room-x':position.x,'--room-w':position.w} as React.CSSProperties;
        const lower=position.lower?' is-lower':'';
        if(position.stairs) return <div key={position.key} style={style} className={`gju-facility-board__stairs${lower}`} aria-hidden="true"><i/><span>계단</span></div>;
        if(!position.interactive) return <div key={position.key} style={style} className={`gju-facility-board__context${lower}`} aria-hidden="true"/>;
        const key=position.interactive;
        const space=data.spaces.find(item=>item.key===key);
        const summary=spaceSummary(space,window);
        const name=key==='gear'?'기자재실':space?.name||'자료 없음';
        const label=key==='gear'?((data.equipmentBlockedIntervals||[]).some(record=>overlaps(record,window))?'장비 예약 제한':'장비 현황 보기'):summary.label;
        const record=space&&visibleIntervals(space,window)[0];
        return <div key={key} style={style} className={`gju-facility-board__room${lower}${selection===key?' is-selected':''}${summary.count?' has-reservation':''}${summary.blocked?' is-blocked':''}`}>
          <div className="gju-facility-board__room-copy" aria-hidden="true"><strong><span className="gju-facility-board__room-name">{name}</span><span className="gju-facility-board__room-index">{FACILITY_ROOM_NUMBERS[key]}</span></strong><span>{label}</span>{record&&<small>{record.subspaceKeys?.map(sub=>space?.subspaces.find(item=>item.key===sub)?.label||sub).join(' · ')}</small>}</div>
          <PixelFurniture kind={key}/><i className="gju-facility-board__door" aria-hidden="true"/>
          <button type="button" data-facility-room={key} className="gju-facility-board__room-hit" aria-label={`${name}, ${label}`} aria-pressed={selection===key} onClick={()=>onSelect(key)} onKeyDown={event=>navigate(key,event)} ref={node=>{if(node)refs.current.set(key,node);else refs.current.delete(key);}}/>
        </div>;
      })}
    </div>
  </div>;
}
