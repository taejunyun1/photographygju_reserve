import React from 'react';
import { GjuCard } from '../../design-system/Card';
import { GjuButton, GjuIconButton } from '../../design-system/Button';
import { GjuIcon } from '../../design-system/icons';
import { GjuStatusBadge } from '../../design-system/StatusBadge';
import { GjuTabs, gjuTabId } from '../../design-system/Tabs';
import { FacilityFloorPlan } from './FacilityFloorPlan';
import { FacilityTimeline } from './FacilityTimeline';
import { EquipmentTimelineList } from './EquipmentTimelineList';
import { FACILITY_ROOM_NUMBERS } from './layout';
import { canOpenReservation, clockLabel, dateTimeLabel, equipmentViews, intervalLabel, isFresh, kstDate, kstTime, overlaps, reservationIntent, spaceSummary, statusLabel, timeWindow, visibleIntervals } from './model';
import type { FacilityBoardProps, FacilitySelectionKey, FacilityReservationIntent } from './types';

export function FacilityBoard({viewer,resource,approved=true,lifecycleRefresh='dedicated',onLoad,onOpenReservation,onOpenEquipment,onReserve}:FacilityBoardProps) {
  const [clock,setClock]=React.useState(()=>Date.now());
  const [date,setDate]=React.useState(()=>resource.date||resource.data?.date||kstDate());
  const [time,setTime]=React.useState(()=>kstTime());
  const [followNow,setFollowNow]=React.useState(true);
  const [selection,setSelection]=React.useState<FacilitySelectionKey|null>(null);
  const [panel,setPanel]=React.useState('plan');
  const [zoomed,setZoomed]=React.useState(false);
  const [showAll,setShowAll]=React.useState(false);
  const [actionError,setActionError]=React.useState('');
  const [helpOpen,setHelpOpen]=React.useState(false);
  const element=React.useRef<HTMLDivElement>(null);
  const resourceRef=React.useRef(resource); resourceRef.current=resource;
  const loadRef=React.useRef(onLoad); loadRef.current=onLoad;
  const followNowRef=React.useRef(followNow); followNowRef.current=followNow;
  const tabsId=`facility-${React.useId().replace(/[^a-z0-9_-]/gi,'')}`;
  const helpId=`${tabsId}-help`;
  const data=resource.data?.date===date&&resource.data.viewer===viewer?resource.data:null;
  const window=timeWindow(date,time);
  const fresh=!resource.invalidated&&isFresh(data,date,clock);
  const busy=resource.loading;
  const choose=(key:FacilitySelectionKey)=>{setSelection(current=>current===key?null:key);setShowAll(false);};
  const reserve=onReserve?async(intent:FacilityReservationIntent)=>{
    setActionError('');
    try { await onReserve(intent); } catch { setActionError('예약 화면을 열지 못했습니다. 다시 시도해 주세요.'); }
  }:undefined;

  // Summary seeds are consumed without an immediate duplicate request. The loader also deduplicates StrictMode mounts.
  React.useEffect(()=>{
    if(!approved) return;
    const current=resourceRef.current;
    if((!current.loading||current.date!==date)&&(current.invalidated||!isFresh(current.data,date))) void Promise.resolve(loadRef.current(date)).catch(()=>{});
    let visible=true;
    const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);}):null;
    if(element.current) observer?.observe(element.current);
    const refresh=(reason:'timer'|'lifecycle')=>{
      if(document.visibilityState!=='visible'||!visible) return;
      const now=Date.now();setClock(now);
      const today=kstDate(new Date(now));
      const refreshDate=followNowRef.current?today:date;
      if(followNowRef.current) {setDate(today);setTime(kstTime(new Date(now)));}
      // The dashboard's existing lifecycle refresh already computes and seeds today's board.
      if(reason==='lifecycle'&&viewer==='admin'&&lifecycleRefresh==='admin-summary-today'&&refreshDate===today) return;
      void Promise.resolve(loadRef.current(refreshDate,{force:true})).catch(()=>{});
    };
    const timer=globalThis.setInterval(()=>refresh('timer'),60000);
    const onLifecycle=()=>refresh('lifecycle');
    const onVisibility=()=>{if(document.visibilityState==='visible')onLifecycle();};
    windowGlobal().addEventListener('focus',onLifecycle);
    document.addEventListener('visibilitychange',onVisibility);
    document.addEventListener('gju-facility-resume',onLifecycle);
    return ()=>{globalThis.clearInterval(timer);observer?.disconnect();windowGlobal().removeEventListener('focus',onLifecycle);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('gju-facility-resume',onLifecycle);};
  },[approved,date,resource.invalidated,viewer,lifecycleRefresh]);

  const now=()=>{const value=new Date();setClock(value.getTime());setFollowNow(true);setDate(kstDate(value));setTime(kstTime(value));};
  const summarySpaces=data?.spaces.filter(space=>visibleIntervals(space,window).length).length;
  const selectedSpace=data?.spaces.find(space=>space.key===selection);
  const selectedIntervals=selectedSpace?visibleIntervals(selectedSpace,window):[];
  const selectedBlocks=selectedSpace?.blockedIntervals.filter(record=>overlaps(record,window))||[];
  const lastUpdated=data?.generatedAt||resource.lastSucceededAt;
  const gearCount=data?equipmentViews(data,window,clock).length:0;
  const zoomControl=<GjuIconButton label={zoomed?'전체 보기':'확대'} icon={zoomed?'zoomOut':'zoomIn'} aria-pressed={zoomed} onClick={()=>setZoomed(!zoomed)}/>;
  return <GjuCard className="gju-facility-board" title="공간·장비 현황" actions={<GjuIconButton label="현황 안내" icon="info" aria-expanded={helpOpen} aria-controls={helpId} onClick={()=>setHelpOpen(!helpOpen)}/>}>
    <div ref={element} className="gju-facility-board__body" aria-busy={busy}>
      {!approved?<p className="gju-facility-board__notice">계정 승인 후 공간·장비 현황을 확인하고 예약할 수 있습니다.</p>:<>
        <div className="gju-facility-board__controls">
          <label><span className="gju-facility-board__sr-only">날짜</span><input aria-label="현황 조회 날짜" type="date" min={resource.data?.today||kstDate()} max={resource.data?.maxDate||kstDate(new Date(clock+30*86400000))} value={date} onChange={event=>{if(event.target.value){setDate(event.target.value);setFollowNow(false);}}}/></label>
          <label><span className="gju-facility-board__sr-only">조회 시작 시간</span><input aria-label="조회 시작 시간" type="time" value={time} step={60} onChange={event=>{if(event.target.value){setTime(event.target.value);setFollowNow(false);}}}/></label>
        </div>
        <div className="gju-facility-board__status-line" role="status">
          <span aria-label={`${time}–${clockLabel(window.end)} 예약 시간 기준`}><GjuIcon name="clock"/>{time}–{clockLabel(window.end)}</span>
          {data&&<span aria-label={`예약 있는 공간 ${summarySpaces}/${data.spaces.length}`}><GjuIcon name="map"/>{summarySpaces}/{data.spaces.length}</span>}
          {data&&!fresh&&<GjuStatusBadge tone="amber">갱신 필요</GjuStatusBadge>}
          {busy&&data&&<span className="gju-facility-board__sr-only">갱신 중</span>}
        </div>
        <div className="gju-facility-board__toolbar">
          {data&&<GjuTabs className="gju-facility-board__view-tabs" id={tabsId} panelId={`${tabsId}-panel`} ariaLabel="현황 보기" activeKey={panel} items={[{key:'plan',label:<><GjuIcon name="map"/><span className="gju-facility-board__sr-only">평면도</span></>},{key:'timeline',label:<><GjuIcon name="grid"/><span className="gju-facility-board__sr-only">시간표</span></>}]} onChange={setPanel}/>}
          <div className="gju-facility-board__toolbar-actions">
            <GjuIconButton label="지금" icon="locate" aria-pressed={followNow} onClick={now}/>
            <GjuIconButton label="새로고침" icon="refresh" disabled={busy} className={busy?'is-refreshing':''} onClick={()=>void Promise.resolve(onLoad(date,{force:true})).catch(()=>{})}/>
            {data&&zoomControl}
          </div>
        </div>
        {helpOpen&&<div id={helpId} className="gju-facility-board__notice" role="region" aria-label="현황 안내">
          <p>공간은 예약 시간 기준 · 예약 없음은 즉시 이용 가능을 뜻하지 않습니다.</p>
          <p>장비는 반출과 예약을 구분하며, 장비의 실제 위치를 뜻하지 않습니다.</p>
          <p>{lastUpdated?`최근 갱신 ${dateTimeLabel(lastUpdated)}`:'갱신 대기'} · 회색은 주변 공간 윤곽입니다.</p>
        </div>}
        {resource.error&&<div className="gju-facility-board__notice is-error" role="alert"><GjuIcon name="warning"/> 갱신 실패 · {data?`마지막 자료 ${clockLabel(lastUpdated||null)}`:'자료 없음'} <GjuIconButton label="다시 시도" icon="refresh" disabled={busy} onClick={()=>void Promise.resolve(onLoad(date,{force:true})).catch(()=>{})}/></div>}
        {!data?<p className="gju-facility-board__empty" role="status">{busy?'현황을 불러오는 중…':resource.error?'잠시 후 다시 시도해 주세요.':'현황 자료를 기다리고 있습니다.'}</p>:<>
          <div id={`${tabsId}-panel`} className={`gju-facility-board__views is-${panel}`} role="tabpanel" aria-labelledby={gjuTabId(tabsId,panel)}>
            <section className="gju-facility-board__plan-section" aria-label="복도 평면도">
              <div className="gju-facility-board__section-heading"><h3>복도 평면도</h3></div>
              <FacilityFloorPlan data={data} window={window} selection={selection} onSelect={choose} zoomed={zoomed}/>
            </section>
            <div className="gju-facility-board__summary" role="group" aria-label="공간 요약">
              {data.spaces.map(space=>{
                const summary=spaceSummary(space,window),records=visibleIntervals(space,window);
                const label=viewer==='admin'?`${records[0]?.label||''}${records.length>1?` +${records.length-1}`:''}`:records.some(record=>record.isMine)?`내 예약${records.length>1?` +${records.length-1}`:''}`:String(records.length);
                return <button type="button" key={space.key} aria-label={`${space.name}, ${summary.label}${summary.blocked?' · 이용 제한':''}`} title={summary.label} aria-pressed={selection===space.key} onClick={()=>choose(space.key)}>
                  <strong><i className="gju-facility-board__space-index" aria-hidden="true">{FACILITY_ROOM_NUMBERS[space.key]}</i>{space.name}</strong>
                  <span className="gju-facility-board__compact-status" aria-hidden="true"><GjuIcon name={summary.count?'user':summary.blocked?'warning':'minus'}/>{summary.count?label:''}{summary.blocked&&summary.count>0&&<GjuIcon name="warning"/>}</span>
                </button>;
              })}
              <button type="button" aria-label={`기자재실, 장비 ${gearCount}점${(data.equipmentBlockedIntervals||[]).some(record=>overlaps(record,window))?' · 장비 예약 제한':''}`} aria-pressed={selection==='gear'} onClick={()=>choose('gear')}><strong><i className="gju-facility-board__space-index" aria-hidden="true">{FACILITY_ROOM_NUMBERS.gear}</i>기자재실</strong><span className="gju-facility-board__compact-status" aria-hidden="true"><GjuIcon name={(data.equipmentBlockedIntervals||[]).some(record=>overlaps(record,window))?'warning':'camera'}/>{gearCount}</span></button>
            </div>
            <section className="gju-facility-board__schedule-section" aria-label="하루 시간표"><h3>하루 시간표</h3><FacilityTimeline data={data} window={window} now={clock} active={panel==='timeline'} onChoose={(value,key)=>{setTime(value);setFollowNow(false);setSelection(key);setShowAll(false);}}/></section>
          </div>
          {selectedSpace&&<section className="gju-facility-board__detail" aria-label={`${selectedSpace.name} 예약 요약`}>
            <div className="gju-facility-board__section-heading"><h3>{selectedSpace.name} · {time}–{clockLabel(window.end)}</h3><GjuIconButton label="닫기" icon="x" onClick={()=>setSelection(null)}/></div>
            {!selectedIntervals.length&&<p className="gju-facility-board__muted">예약 없음</p>}
            {!!selectedIntervals.length&&<ul className={`gju-facility-board__reservation-list${showAll?' is-expanded':''}`}>{(showAll?selectedIntervals:selectedIntervals.slice(0,5)).map(record=><li key={record.entryKey}>
              <div><strong>{record.label}</strong> <GjuStatusBadge tone={record.status==='pending'||record.status==='pending_approval'?'amber':'blue'}>{statusLabel(record.status)}</GjuStatusBadge></div>
              <span>{intervalLabel(record)}{record.subspaceKeys?.length?` · ${record.subspaceKeys.map(key=>selectedSpace.subspaces.find(space=>space.key===key)?.label||key).join(' · ')}`:''}</span>
              {canOpenReservation(record,viewer)&&onOpenReservation&&<GjuIconButton label={viewer==='admin'?'예약 상세':'내 예약 상세'} icon="fileText" onClick={()=>onOpenReservation(record.reservationId!)}/>}
            </li>)}</ul>}
            {selectedIntervals.length>5&&<GjuButton variant="ghost" icon={showAll?'chevronLeft':'chevronRight'} aria-label={showAll?'5행으로 접기':`전체 ${selectedIntervals.length}건 보기`} aria-expanded={showAll} onClick={()=>setShowAll(!showAll)}>{showAll?'5':selectedIntervals.length}</GjuButton>}
            {selectedBlocks.slice(0,5).map((record,index)=><p className="gju-facility-board__restriction" aria-label={`이용 제한 · ${record.label} · ${intervalLabel(record)}`} key={`${record.startAt}-${index}`}><GjuIcon name="warning"/>{record.label} · {intervalLabel(record)}{record.subspaceKeys?.map(key=>` · ${selectedSpace.subspaces.find(space=>space.key===key)?.label||key}`)}</p>)}
            {selectedBlocks.length>5&&<p className="gju-facility-board__muted">외 {selectedBlocks.length-5}건의 제한 · 예약 단계에서 확인</p>}
            {viewer==='student'&&reserve&&<GjuButton icon="plus" aria-label="이 조건으로 예약" onClick={()=>void reserve(reservationIntent(selectedSpace,date))}>예약</GjuButton>}
          </section>}
          <div className={`gju-facility-board__equipment-area${selection==='gear'?' is-open':''}`}><EquipmentTimelineList data={data} window={window} now={clock} viewer={viewer} onOpenEquipment={onOpenEquipment} onOpenReservation={onOpenReservation} onReserve={reserve}/></div>
          {actionError&&<p role="alert" className="gju-facility-board__notice is-error">{actionError}</p>}
        </>}
      </>}
    </div>
  </GjuCard>;
}
// Avoid shadowing the selected time window in effects.
function windowGlobal() { return globalThis.window; }
