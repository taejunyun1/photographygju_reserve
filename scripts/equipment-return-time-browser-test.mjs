import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// Render the production dialog without adding a public component export.
const screenDirectory = path.resolve('src/react/admin/screens');
const source = fs.readFileSync(path.join(screenDirectory, 'AdminReservations.tsx'), 'utf8');
const fixture = await build({
  stdin: {
    contents: `${source}\nimport { createRoot } from 'react-dom/client';
      createRoot(document.getElementById('root')).render(
        <EquipmentReturnInspectionDialog reservation={{
          id:'seconds',type:'equipment',status:'checked_out',fields:{},
          actualCheckedOutAt:'2026-10-13T01:15:00.000Z',
          timing:{endAt:'2026-10-13T08:10:00.000Z'},
          equipmentItems:[{id:'camera',code:'C1',name:'Camera'}]
        }} actions={{notify:()=>{},returnEquipmentReservation:async(id,inspections,details)=>{
          await fetch('/return-inspection',{method:'POST',body:JSON.stringify({id,inspections,...details})});
        }}} onClose={()=>{}} />);`,
    resolveDir: screenDirectory, loader:'tsx'
  },
  bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'}
});
const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage();
  await page.clock.install({time:new Date('2026-10-13T08:10:50.000Z')});
  let requestBody;
  await page.route('http://fixture.local/return-inspection', async route => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({status:200,body:'{}'});
  });
  await page.route('http://fixture.local/', route => route.fulfill({body:'<div id="root"></div>',contentType:'text/html'}));
  await page.goto('http://fixture.local/');
  await page.addScriptTag({content:fixture.outputFiles[0].text});
  const actualTime = page.getByLabel('실제 반납 시각 (필수)');
  assert.equal(await actualTime.getAttribute('step'),'1');
  await page.getByRole('button',{name:'지금 반납한 것으로 입력'}).click();
  assert.equal(await actualTime.inputValue(),'2026-10-13T17:10:50');
  await page.getByText('실제 지각 · 해당 자동 경고 확정·유지',{exact:true}).waitFor();
  await page.getByLabel('반납 시각 확인 사유 (필수)').fill('직접 확인');
  await Promise.all([
    page.waitForResponse('http://fixture.local/return-inspection'),
    page.getByRole('button',{name:'반납 점검 완료',exact:true}).click()
  ]);
  assert.equal(requestBody.actualReturnedAt,'2026-10-13T08:10:50.000Z');
  await actualTime.fill('2026-10-13T17:10');
  await page.getByText('정시 반납 · 해당 자동 경고만 해제',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'반납 점검 완료',exact:true}).isEnabled(),true);
  await actualTime.fill('');
  assert.equal(await page.getByRole('button',{name:'반납 점검 완료',exact:true}).isEnabled(),false);
  console.log('Equipment return browser: now preserves late seconds, POST body preserves seconds, minute/empty inputs render safely.');
} finally {
  await browser.close();
}
