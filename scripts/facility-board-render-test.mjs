import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const compiled = path.join(process.cwd(), 'scripts/.facility-board-render-test.mjs');
const screenshotDir = process.env.GJU_FACILITY_SCREENSHOT_DIR || 'outputs/facility-board-implementation';
try {
  const result = await build({ stdin: { contents: `export * from '../src/react/shared/facility-board/model'; export * from '../src/react/shared/facility-board/layout'; export { FacilityBoard } from '../src/react/shared/facility-board/FacilityBoard';`, resolveDir: path.join(process.cwd(), 'scripts'), loader: 'tsx' }, bundle: true, platform: 'node', format: 'esm', write: false, external: ['react', 'react-dom', 'react-dom/server'] });
  fs.writeFileSync(compiled, result.outputFiles[0].text);
  const ui = await import(pathToFileURL(compiled).href);
  const date = ui.kstDate(new Date());
  const iso = (time) => `${date}T${time}:00+09:00`;
  const interval = { entryKey:'r1', startAt:iso('10:30'), endAt:iso('12:00'), status:'approved', label:'내 예약', isMine:true, reservationId:'mine', subspaceKeys:['A_FRONT'] };
  const query = ui.timeWindow(date, '10:00');
  assert.equal(ui.overlaps(interval, query), true, 'partial overlap must be retained');
  assert.equal(ui.overlaps({...interval, endAt:iso('10:00')}, query), false, 'end boundary is exclusive');
  const spaces = ['a','b','dark','print'].map((key) => ({key, name:{a:'스튜디오 A',b:'스튜디오 B',dark:'암실',print:'출력실'}[key], type:key==='a'||key==='b'?'studio':key==='dark'?'darkroom':'print', subspaces:[{key:'A_FRONT',label:'A 앞'}], intervals:key==='a'?[interval,{...interval,entryKey:'r2',label:'예약 있음',isMine:false,reservationId:undefined,subspaceKeys:['A_BACK']}]:[], blockedIntervals:[]}));
  const data = {schemaVersion:1,layoutVersion:'corridor-v1',viewer:'student',date,today:date,maxDate:date,timeZone:'Asia/Seoul',generatedAt:new Date().toISOString(),validUntil:new Date(Date.now()+60000).toISOString(),spaces,equipment:[]};
  const gear = {equipmentId:'inventory-id',name:'카메라',category:'camera',facility:'photo',source:'inventory',custody:null,history:[],reservations:[{...interval,status:'pending'}]};
  assert.equal(ui.equipmentAt(gear, query, new Date(iso('11:00')).getTime()).status, '승인 대기', 'pending reservation must not become actual custody');
  const overdue = {...gear,reservations:[],custody:{label:'내 대여',isMine:true,checkedOutAt:iso('09:00'),expectedReturnAt:iso('10:00'),overdue:true}};
  assert.equal(ui.equipmentAt(overdue,query,new Date(iso('11:00')).getTime()).status,'반납 지연 · 종료 미정','unreturned custody must survive its due time');
  assert.equal(ui.equipmentAt({...gear,reservations:[interval]},query,new Date(iso('15:00')).getTime()).status,'이력 확인 불가 · 예약표','approved reservation cannot establish past checkout');
  assert.deepEqual(ui.reservationIntent(spaces[0],date),{type:'studio',selectedDate:date},'whole room selection must not invent a studio subspace or slot');
  assert.deepEqual(ui.equipmentReservationIntent(gear,date),{type:'equipment',selectedDate:date,equipmentItemIds:['inventory-id']},'equipment intent must use inventory ID');
  assert.equal(ui.canOpenReservation({...interval,isMine:false},'student'),false,'students cannot open other reservation IDs');
  assert.equal(ui.canOpenReservation(interval,'student'),true);
  assert.equal(ui.FACILITY_LAYOUT.filter((entry)=>entry.interactive).length,5);
  assert.equal(ui.FACILITY_LAYOUT.filter((entry)=>entry.stairs).length,2);
  assert.deepEqual(ui.FACILITY_LAYOUT.filter((entry)=>entry.interactive).map(({key,x,w,lower})=>({key,x,w,lower:!!lower})),[{key:'print',x:430,w:200,lower:false},{key:'a',x:742,w:210,lower:false},{key:'gear',x:1292,w:308,lower:false},{key:'b',x:930,w:210,lower:true},{key:'dark',x:1140,w:140,lower:true}]);
  data.equipment=Array.from({length:7},(_,index)=>({...gear,equipmentId:`inventory-${index}`,name:`카메라 ${index+1}`,reservations:[{...interval,status:'pending_approval'}]}));
  const props = {viewer:'student',resource:{date,data,loading:false,error:'',lastSucceededAt:data.generatedAt},onLoad(){}};
  const render = (extra={})=>renderToStaticMarkup(React.createElement(ui.FacilityBoard,{...props,...extra}));
  const markup = render();
  assert(markup.includes('공간·장비 현황'));
  assert(markup.includes('gju-card')&&markup.includes('gju-icon-button')&&markup.includes('gju-tabs'));
  assert(markup.includes('조회 시작 시간')&&markup.includes('지금')&&markup.includes('확대'));
  assert.equal((markup.match(/data-facility-room=/g)||[]).length,5,'only five reservation destinations may be interactive on plan');
  assert(markup.includes('공간 요약')&&markup.includes('하루 시간표'),'readable alternatives must accompany the sketch');
  const lab = {
    key:'digital', name:'디지털사진영상실', type:'digital_lab',
    subspaces:['mac','pc'].flatMap(computerType => Array.from({length:computerType==='mac'?12:4},(_,index)=>{
      const number=String(index+1).padStart(2,'0');
      return {key:`${computerType}-${number}`,label:`${computerType==='mac'?'Mac':'PC'} ${number}`,computerType};
    })),
    intervals:[
      {...interval, startAt:iso('10:00'), endAt:iso('12:00'), subspaceKeys:['mac-01']},
      {...interval, entryKey:'r3', startAt:iso('12:00'), endAt:iso('14:00'), subspaceKeys:['mac-01']}
    ],
    blockedIntervals:[{startAt:iso('14:01'),endAt:iso('14:02'),label:'디지털 수업'}]
  };
  const labMarkup = render({resource:{...props.resource,data:{...data,spaces:[...spaces,lab]}}});
  assert(labMarkup.includes('Mac 11/12 · PC 4/4'),'timeline cells show the count of available seats');
  assert(labMarkup.includes('Mac 0/12 · PC 0/4'),'a minute of class blocks all seats');
  assert.equal((labMarkup.match(/data-facility-room=/g)||[]).length,5);
  assert(/예약 있는 공간 [0-4]\/4/.test(labMarkup),'digital lab does not change the corridor count');
  const count = (space,time) => ui.digitalLabSummary(space,ui.timeWindow(date,time)).label;
  assert.equal(count(lab,'11:30'),'Mac 11/12 · PC 4/4','arbitrary-minute interval counts the same seat once');
  assert.equal(count(lab,'14:02'),'Mac 12/12 · PC 4/4','ends touching the query start do not overlap');
  assert.equal(count(lab,'12:02'),'Mac 0/12 · PC 0/4','an interval spanning 14:01 is class-blocked');
  const closedLab = {...lab,blockedIntervals:[{startAt:iso('08:00'),endAt:iso('22:00'),label:'예약 비활성'}]};
  assert.equal(count(closedLab,'11:30'),'Mac 0/12 · PC 0/4');
  assert.deepEqual(ui.reservationIntent(lab,date),{type:'digital_lab',selectedDate:date},'arbitrary query times are not booking defaults');
  const unavailable = render({resource:{date,data:null,loading:true,error:'',lastSucceededAt:''}});
  assert(unavailable.includes('현황을 불러오는 중'));
  assert(!unavailable.includes('예약 없음'),'missing data must not appear as empty reservations');
  const denied = render({approved:false});
  assert(denied.includes('계정 승인 후'));
  assert(!denied.includes('data-facility-room='),'approval gate must hide protected content');
  const failed = render({resource:{...props.resource,error:'offline'}});
  assert(failed.includes('갱신 실패')&&failed.includes('마지막 자료'),'failed refresh must retain and mark stale data');

  assert.equal(ui.equipmentAt({...gear,reservations:[{...interval,status:'pending_approval'}]},query,new Date(iso('11:00')).getTime()).status,'승인 대기');
  assert.equal(ui.statusLabel('pending_approval'),'승인 대기');
  assert.equal(ui.equipmentAt({...overdue,custody:{...overdue.custody,checkedOutAt:null}},query,new Date(iso('15:00')).getTime()).status,'이력 확인 불가');
  assert.equal(ui.overlaps({...interval,startAt:iso('12:00'),endAt:iso('13:00')},query),false,'start at query end is excluded');
  const blockedRender=render({resource:{...props.resource,data:{...data,equipmentBlockedIntervals:[{startAt:iso('00:00'),endAt:`${date}T23:59:59+09:00`,label:'장비 점검'}]}}});
  assert(blockedRender.includes('장비 예약 제한')&&blockedRender.includes('장비 점검'),'equipment restrictions must be visible');
  const allDayGear={...gear,reservations:[{...interval,status:'pending',startAt:iso('00:00'),endAt:`${date}T23:59:59+09:00`}]};
  const mixedEquipment=[{...allDayGear,category:'',facility:'사진영상미디어학과 기자재실',source:'department'},{...allDayGear,equipmentId:'external-id',facility:'외부센터',source:'fantasy_lab'}];
  for(const viewer of ['student','admin']) {
    const mixed=render({viewer,resource:{...props.resource,data:{...data,viewer,equipment:mixedEquipment}}});
    assert(mixed.includes('등록 시설: 사진영상미디어학과 기자재실 · 관리처: 극기관'),'department metadata must remain visible');
    assert(mixed.includes('등록 시설: 외부센터 · 관리처: 판타지랩'),'external facility and readable source must remain distinct');
    assert(mixed.includes('장비의 실제 위치를 뜻하지 않습니다.'),'registered metadata must not assert current physical location');
    assert(mixed.includes('aria-label="장비 10:00, 1점'),'uncategorized inventory must count in the fallback timetable row');
  }
  const browserEntry = await build({stdin:{contents:`
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {FacilityBoard} from '../src/react/shared/facility-board/FacilityBoard';
    const props=${JSON.stringify({...props,onLoad:undefined})};
    window.boardCalls=[]; window.boardReservations=[]; window.boardDetails=[];
    const root=createRoot(document.getElementById('root'));
    window.boardProps={...props,onLoad:(date,options)=>window.boardCalls.push({date,options}),onReserve:intent=>window.boardReservations.push(intent),onOpenReservation:id=>window.boardDetails.push(id)};
    window.updateBoard=extra=>{window.boardProps={...window.boardProps,...extra};root.render(React.createElement(FacilityBoard,window.boardProps));};
    window.updateBoard({});
  `,resolveDir:path.join(process.cwd(),'scripts'),loader:'tsx'},bundle:true,platform:'browser',format:'iife',write:false});
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1280,height:1000}});
    await page.setContent('<html lang="ko"><head><meta charset="utf-8"/></head><body style="margin:0"><main id="root" style="max-width:1100px;margin:20px auto"></main></body></html>');
    await page.addStyleTag({content:fs.readFileSync('src/react/design-system/react-admin.css','utf8')});
    await page.clock.install();
    await page.addScriptTag({content:browserEntry.outputFiles[0].text});
    await page.getByRole('heading',{name:'공간·장비 현황',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.boardCalls.length),0,'fresh initial summary data must not trigger another fetch');
    for(const name of ['지금','새로고침','확대','현황 안내']) {
      const control=page.getByRole('button',{name,exact:true});
      assert.equal((await control.innerText()).trim(),'','board utilities must use labeled icons without repeated visible copy');
      assert.equal(await control.locator('svg').count(),1,`${name} must retain a visible icon`);
    }
    assert.equal(await page.getByText('공간은 예약 시간 기준 · 예약 없음은 즉시 이용 가능을 뜻하지 않습니다.',{exact:true}).count(),0,'long guidance must stay folded by default');
    await page.getByRole('button',{name:'현황 안내',exact:true}).click();
    await page.getByRole('region',{name:'현황 안내',exact:true}).getByText(/예약 없음은 즉시 이용 가능/).waitFor();
    await page.getByRole('button',{name:'현황 안내',exact:true}).click();
    await page.screenshot({path:path.join(screenshotDir,'shared-board-desktop.png'),fullPage:true});
    await page.getByLabel('조회 시작 시간',{exact:true}).fill('10:00');
    assert.equal(await page.locator('.gju-facility-board__equipment-list > li').count(),5,'equipment list defaults to five rows');
    await page.getByRole('button',{name:'전체 7점 보기',exact:true}).click();
    assert.equal(await page.locator('.gju-facility-board__equipment-list > li').count(),7);
    await page.getByRole('button',{name:'5행으로 접기',exact:true}).click();
    assert.equal(await page.locator('.gju-facility-board__equipment-list > li').count(),5);
    await page.getByRole('button',{name:'이 장비 예약',exact:true}).first().click();
    assert.deepEqual(await page.evaluate(()=>window.boardReservations.pop()),{type:'equipment',selectedDate:date,equipmentItemIds:['inventory-0']});
    await page.getByRole('group',{name:'공간 요약',exact:true}).getByRole('button',{name:/스튜디오 A/}).click();
    const detail=page.getByRole('region',{name:'스튜디오 A 예약 요약'});
    await detail.getByText('A 앞',{exact:false}).first().waitFor();
    assert.equal(await detail.getByRole('button',{name:'내 예약 상세',exact:true}).count(),1,'only own booking may open details');
    await detail.getByRole('button',{name:'내 예약 상세',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.boardDetails),['mine']);
    await detail.getByRole('button',{name:'이 조건으로 예약',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.boardReservations),[{type:'studio',selectedDate:date}]);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    assert.equal(await page.getByLabel('조회 시작 시간',{exact:true}).inputValue(),'10:00','focus refresh must preserve a manually chosen time');
    assert.equal(await page.evaluate(()=>window.boardCalls.at(-1).options.force),true);
    await page.evaluate(()=>document.dispatchEvent(new CustomEvent('gju-facility-resume')));
    assert.equal(await page.evaluate(()=>window.boardCalls.length),2,'native resume must quietly refresh just the board');
    await page.setViewportSize({width:390,height:844});
    await detail.getByRole('button',{name:'닫기',exact:true}).click();
    await page.screenshot({path:path.join(screenshotDir,'shared-board-mobile.png'),fullPage:true});
    console.log('mobile default height:',await page.locator('.gju-facility-board').evaluate(element=>Math.round(element.getBoundingClientRect().height)));
    const rail=page.getByRole('group',{name:'공간 요약',exact:true});
    const targets=await rail.getByRole('button').evaluateAll(elements=>elements.map(element=>({w:element.getBoundingClientRect().width,h:element.getBoundingClientRect().height,font:parseFloat(getComputedStyle(element.querySelector('strong')).fontSize)})));
    assert(targets.every(target=>target.w>=44&&target.h>=44&&target.font>=12),'mobile summaries require readable text and 44px targets');
    for(const width of [320,360,390,430]) {
      await page.setViewportSize({width,height:844});
      const complete=await rail.evaluate(element=>{
        const frame=element.getBoundingClientRect();
        return element.scrollWidth<=element.clientWidth+1&&[...element.querySelectorAll('button')].every(button=>{const box=button.getBoundingClientRect();return box.left>=frame.left-1&&box.right<=frame.right+1;});
      });
      assert(complete,`all five room summaries must be visible without horizontal scrolling at ${width}px`);
      assert(await page.getByRole('button',{name:'새로고침',exact:true}).isVisible(),`manual refresh must remain available at ${width}px`);
    }
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile board must not overflow the page');
    await page.getByRole('tab',{name:'시간표',exact:true}).click();
    assert(await page.getByRole('table').isVisible(),'mobile timeline tab must expose full day');
    assert(await page.locator('.gju-facility-board__timeline-scroll').evaluate(element=>{
      const selected=element.querySelector('button[data-selected]');
      const box=selected.getBoundingClientRect(),frame=element.getBoundingClientRect();
      const header=element.querySelector('th').getBoundingClientRect();
      return box.left>=frame.left+header.width-1&&box.right<=frame.right+1;
    }),'opening the mobile timetable must reveal the selected time rather than midnight');
    await page.getByRole('tab',{name:'시간표',exact:true}).press('ArrowLeft');
    assert(await page.getByRole('tab',{name:'평면도',exact:true}).getAttribute('aria-selected')==='true','tabs must support keyboard arrows');
    await page.getByRole('button',{name:'확대',exact:true}).click();
    assert(await page.locator('[data-facility-room="dark"]').isVisible(),'zoom must expose readable interactive floor controls');
    const dark=await page.locator('[data-facility-room="dark"]').boundingBox();
    assert(dark.width>=44&&dark.height>=44);
    await page.getByRole('button',{name:'전체 보기',exact:true}).click();
    // Timer is scoped to visible board/document; manual time survives each refresh.
    const beforeTick=await page.evaluate(()=>window.boardCalls.length);
    await page.clock.fastForward(60001);
    assert.equal(await page.evaluate(()=>window.boardCalls.length),beforeTick+1);
    assert.equal(await page.getByLabel('조회 시작 시간',{exact:true}).inputValue(),'10:00');
    await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}));
    await page.clock.fastForward(60001);
    assert.equal(await page.evaluate(()=>window.boardCalls.length),beforeTick+1,'hidden document cannot poll');
    await page.evaluate(()=>Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'}));
    await page.evaluate(()=>window.updateBoard({resource:{...window.boardProps.resource,data:{...window.boardProps.resource.data,equipmentBlockedIntervals:[{startAt:window.boardProps.resource.date+'T00:00:00+09:00',endAt:window.boardProps.resource.date+'T23:59:59+09:00',label:'장비 점검'}]},invalidated:true}}));
    await page.waitForFunction(count=>window.boardCalls.length===count,beforeTick+2);
    await page.getByRole('group',{name:'공간 요약',exact:true}).getByRole('button',{name:/기자재실/}).click();
    await page.getByLabel('장비 예약 제한 · 장비 점검',{exact:true}).waitFor();
    assert(await page.getByRole('button',{name:'장비 예약하기',exact:true}).isDisabled());
    assert(await page.getByRole('button',{name:'이 장비 예약',exact:true}).first().isDisabled());
    await page.evaluate(()=>window.updateBoard({approved:false}));
    await page.getByText('계정 승인 후 공간·장비 현황을 확인하고 예약할 수 있습니다.',{exact:true}).waitFor();
    await page.clock.fastForward(60001);
    assert.equal(await page.evaluate(()=>window.boardCalls.length),beforeTick+2,'unapproved board cannot load protected data');
    await page.evaluate(()=>window.updateBoard({approved:true,resource:{...window.boardProps.resource,invalidated:false}}));
    await page.getByLabel('현황 조회 날짜',{exact:true}).waitFor();
    const current=await page.getByLabel('현황 조회 날짜',{exact:true}).inputValue();
    const nextDate=new Date(`${current}T00:00:00+09:00`);nextDate.setUTCDate(nextDate.getUTCDate()+1);
    const next=ui.kstDate(nextDate);
    // The fixture's maxDate is today; extend it to exercise date navigation independently of policy bounds.
    await page.getByLabel('현황 조회 날짜',{exact:true}).evaluate(input=>input.max='2099-12-31');
    await page.getByLabel('현황 조회 날짜',{exact:true}).fill(next);
    await page.getByText('현황 자료를 기다리고 있습니다.',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.boardCalls.at(-1).date),next);
    assert.equal(await page.getByText('예약 없음',{exact:true}).count(),0,'date transition cannot display the previous date as empty data');
    // A pending request is tied to its date; selecting another date must start that load immediately.
    await page.evaluate(()=>window.updateBoard({approved:true,resource:{...window.boardProps.resource,date:window.boardProps.resource.data.date,data:null,loading:true,invalidated:false}}));
    await page.getByLabel('현황 조회 날짜',{exact:true}).fill(current);
    await page.evaluate(()=>{window.boardCalls=[];});
    await page.getByLabel('현황 조회 날짜',{exact:true}).fill(next);
    await page.waitForFunction(next=>window.boardCalls.some(call=>call.date===next),next,{timeout:1000});

    const contactPage=await browser.newPage();
    await contactPage.setContent('<main id="root"></main>');
    await contactPage.clock.install({time:new Date(`${date}T11:00:00+09:00`)});
    await contactPage.addScriptTag({content:browserEntry.outputFiles[0].text});
    await contactPage.getByLabel('현황 조회 날짜',{exact:true}).waitFor();
    await contactPage.evaluate(()=>{const d=window.boardProps.resource.data;const spaces=d.spaces.map(s=>s.key==='a'?{...s,intervals:s.intervals.map((r,i)=>i===0?{...r,contactName:'예약자 테스트',phone:'010-1234-5678'}:r)}:s);window.updateBoard({resource:{...window.boardProps.resource,data:{...d,spaces}}});});
    await contactPage.locator('[data-facility-room="a"]').click();
    await contactPage.getByText('예약자 예약자 테스트 · 연락처 010-1234-5678').waitFor();
    await contactPage.addStyleTag({content:fs.readFileSync('src/react/design-system/react-admin.css','utf8')});
    await contactPage.setViewportSize({width:320,height:844});
    await contactPage.evaluate(()=>window.updateBoard({onReserve:async()=>{throw new Error('fixture reservation error');}}));
    for(const [room,action,section] of [['스튜디오 A','이 조건으로 예약','.gju-facility-board__detail'],['기자재실','이 장비 예약','.gju-facility-board__equipment-area']]) {
      const choice=contactPage.getByRole('group',{name:'공간 요약',exact:true}).getByRole('button',{name:new RegExp(room)});
      if(await choice.getAttribute('aria-pressed')!=='true') await choice.click();
      await contactPage.getByRole('button',{name:action,exact:true}).first().click();
      await contactPage.getByText('예약 화면을 열지 못했습니다. 다시 시도해 주세요.',{exact:true}).waitFor();
      assert(await contactPage.evaluate(selector=>document.querySelector('[role="alert"]').getBoundingClientRect().top>=document.querySelector(selector).getBoundingClientRect().bottom,section),'reservation failure must remain below the section whose action failed');
    }
    await contactPage.close();
    // The real admin host already refreshes today's summary on these lifecycle events.
    const adminPage=await browser.newPage();
    await adminPage.setContent('<main id="root"></main>');
    await adminPage.clock.install();
    await adminPage.addScriptTag({content:browserEntry.outputFiles[0].text});
    await adminPage.getByLabel('현황 조회 날짜',{exact:true}).waitFor();
    await adminPage.evaluate(()=>window.updateBoard({viewer:'admin',lifecycleRefresh:'admin-summary-today',resource:{...window.boardProps.resource,data:{...window.boardProps.resource.data,viewer:'admin'}}}));
    await adminPage.waitForFunction(()=>!document.body.textContent.includes('이 장비 예약'));
    await adminPage.evaluate(()=>{window.boardCalls=[];window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));document.dispatchEvent(new CustomEvent('gju-facility-resume'));});
    assert.equal(await adminPage.evaluate(()=>window.boardCalls.length),0,'same-day admin lifecycle must consume the host summary without a dedicated fetch');
    await adminPage.clock.fastForward(60001);
    assert.equal(await adminPage.evaluate(()=>window.boardCalls.length),1,'admin timer must still refresh the dedicated board');
    await adminPage.getByRole('button',{name:'새로고침',exact:true}).click();
    assert.equal(await adminPage.evaluate(()=>window.boardCalls.length),2,'manual admin refresh must still use the dedicated board');
    await adminPage.getByLabel('현황 조회 날짜',{exact:true}).evaluate(input=>input.max='2099-12-31');
    await adminPage.getByLabel('현황 조회 날짜',{exact:true}).fill(next);
    await adminPage.waitForFunction(next=>window.boardCalls.at(-1).date===next,next);
    const beforeLifecycle=await adminPage.evaluate(()=>window.boardCalls.length);
    await adminPage.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new CustomEvent('gju-facility-resume'));});
    assert.equal(await adminPage.evaluate(()=>window.boardCalls.length),beforeLifecycle+2,'manually selected other dates must retain dedicated focus/resume refresh');
    await adminPage.close();

    const labPage=await browser.newPage({viewport:{width:390,height:844}});
    await labPage.setContent('<main id="root"></main>');
    await labPage.addStyleTag({content:fs.readFileSync('src/react/design-system/react-admin.css','utf8')});
    await labPage.clock.install({time:new Date(iso('11:30'))});
    await labPage.addScriptTag({content:browserEntry.outputFiles[0].text});
    await labPage.getByLabel('조회 시작 시간',{exact:true}).waitFor();
    const studentLab={...lab,intervals:[{...lab.intervals[0],isMine:false,reservationId:undefined,label:'예약 있음'},lab.intervals[1]]};
    await labPage.evaluate(space=>window.updateBoard({resource:{...window.boardProps.resource,data:{...window.boardProps.resource.data,spaces:[...window.boardProps.resource.data.spaces,space]}}}),studentLab);
    const labCard=labPage.getByRole('button',{name:/^디지털사진영상실 선택 구간 가용 좌석/});
    await labCard.getByText('선택 구간 가용 좌석 · Mac 11/12 · PC 4/4',{exact:true}).waitFor();
    await labCard.click();
    const labDetail=labPage.getByRole('region',{name:'디지털사진영상실 예약 요약'});
    assert.equal(await labDetail.getByRole('region',{name:'Mac 좌석',exact:true}).getByRole('listitem').count(),12);
    assert.equal(await labDetail.getByRole('region',{name:'PC 좌석',exact:true}).getByRole('listitem').count(),4);
    assert.equal(await labDetail.getByRole('button',{name:'내 예약 상세',exact:true}).count(),1);
    assert.equal(await labDetail.getByRole('button',{name:'예약 상세',exact:true}).count(),0);
    await labDetail.getByRole('button',{name:'예약 시간 선택',exact:true}).click();
    assert.deepEqual(await labPage.evaluate(()=>window.boardReservations),[{type:'digital_lab',selectedDate:date}]);
    for(const width of [320,390,1280]){
      await labPage.setViewportSize({width,height:900});
      assert(await labPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`digital seat detail overflows at ${width}px`);
    }
    await labPage.setViewportSize({width:390,height:844});
    if(process.env.GJU_FACILITY_SCREENSHOT_DIR) await labPage.screenshot({path:path.join(screenshotDir,'digital-lab-board-mobile.png'),fullPage:true});
    const adminLab={...lab,intervals:[{...lab.intervals[0],isMine:false,reservationId:'admin-visible',label:'예약자 테스트'},lab.intervals[1]]};
    await labPage.evaluate(space=>window.updateBoard({viewer:'admin',resource:{...window.boardProps.resource,data:{...window.boardProps.resource.data,viewer:'admin',spaces:window.boardProps.resource.data.spaces.map(item=>item.key==='digital'?space:item)}}}),adminLab);
    await labDetail.getByRole('button',{name:'예약 상세',exact:true}).first().click();
    assert.deepEqual(await labPage.evaluate(()=>window.boardDetails),['admin-visible']);
    await labPage.getByRole('tab',{name:'시간표',exact:true}).click();
    await labPage.getByRole('row',{name:/^디지털사진영상실/}).getByRole('button',{name:/14:00–16:00, Mac 0\/12 · PC 0\/4/}).click();
    await labDetail.getByText('디지털 수업 · 14:01–14:02',{exact:true}).waitFor();
    await labPage.close();
  } finally {await browser.close();}
  console.log('facility-board-render-test: model, privacy, geometry, states, browser actions, lifecycle, mobile targets and keyboard passed');

} finally { fs.rmSync(compiled,{force:true}); }
