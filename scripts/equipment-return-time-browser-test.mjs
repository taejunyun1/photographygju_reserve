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
  const completeButton = page.getByRole('button',{name:'반납 점검 완료',exact:true});
  assert.equal(await completeButton.isEnabled(),true, 'return must not require a manually entered timestamp or reason');
  assert.equal(await page.locator('input[type="datetime-local"]').count(),0);
  await Promise.all([
    page.waitForResponse('http://fixture.local/return-inspection'),
    completeButton.click()
  ]);
  assert.deepEqual(requestBody, {id:'seconds',inspections:[{equipmentId:'camera',outcome:'normal',note:''}]});
  console.log('Equipment return browser: immediate completion without time input; server timestamps the return.');

} finally {
  await browser.close();
}
