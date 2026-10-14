import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium, webkit } from '@playwright/test';
import sharp from 'sharp';

// Use the production form in both browser checks and the offline iOS QA bundle.
const fixture = await build({
  stdin: {
    contents: `import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {ReportForm} from './src/react/student/components/ReportForm';
      function Fixture() {
        const [kind,setKind]=useState('studio');
        const [submitted,setSubmitted]=useState(null);
        const reservation={id:'photo-'+kind,userId:'photo-qa',type:kind,status:'returned',fields:{reservedDate:'2026-10-13',timeSlots:['10:30-12:00'],participants:'2',studioSpaces:['QA Studio']}};
        return <><h1>Photo upload QA</h1><nav><button onClick={()=>{setKind('studio');setSubmitted(null)}}>Studio report</button><button onClick={()=>{setKind('equipment');setSubmitted(null)}}>Equipment report</button></nav>
          <ReportForm key={kind} reservation={reservation} actions={{openReport:()=>{},submitReport:async(id,payload)=>{
            const result={id,photos:payload.photos.map(photo=>({category:photo.category,type:photo.file.type,size:photo.file.size}))};
            setSubmitted(result);
          }}}/><output data-testid="submitted">{submitted?JSON.stringify(submitted):''}</output></>;
      }
      createRoot(document.getElementById('root')).render(<Fixture/>);`,
    resolveDir:process.cwd(),loader:'tsx'
  },
  bundle:true,write:false,format:'iife',platform:'browser',loader:{'.css':'empty'}
});
const html = '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;padding:16px}button,input,textarea{font:inherit}fieldset,.field{margin:12px 0}label{display:block}input[type=file]{display:block;max-width:100%}.report-photo-thumb img{width:120px}.report-photo-add{padding:20px;border:1px solid #aaa}.row-actions{display:flex;gap:12px}h2{font-size:20px}</style></head><body><div id="root"></div><script src="fixture.js"></script></body></html>';
if(process.argv.includes('--write-fixture')) {
  const directory = path.resolve(process.argv[process.argv.indexOf('--write-fixture')+1]);
  fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'index.html'),html);
  fs.writeFileSync(path.join(directory,'fixture.js'),fixture.outputFiles[0].text);
  console.log(`Offline native QA fixture written to ${directory}`);
} else {
  const png = await sharp({create:{width:3000,height:2000,channels:3,background:'#548d9c'}}).png().toBuffer();
  for(const [engine,browserType] of [['chromium',chromium],['webkit',webkit]]) {
    const browser = await browserType.launch({headless:true});
    try {
      const page = await browser.newPage({viewport:{width:390,height:844}});
      const pageErrors=[];
      page.on('pageerror',error=>pageErrors.push(error.message));
      await page.route('http://photo-qa.local/fixture.js',route=>route.fulfill({body:fixture.outputFiles[0].text,contentType:'text/javascript'}));
      await page.route('http://photo-qa.local/',route=>route.fulfill({body:html,contentType:'text/html'}));
      await page.goto('http://photo-qa.local/');
      for(const kind of ['studio','equipment']) {
        await page.getByRole('button',{name:kind==='studio'?'Studio report':'Equipment report',exact:true}).click();
        const input=page.locator('input[type=file]');
        assert.equal(await input.getAttribute('capture'),null, `${kind}: clicking add must offer a picker, not immediately open the camera`);
        const chooserPromise=page.waitForEvent('filechooser');
        await input.click();
        const chooser=await chooserPromise;
        await chooser.setFiles([]);
        assert.equal(await page.getByRole('heading',{name:kind==='studio'?'스튜디오 사용 보고서':'기자재 사용 보고서'}).isVisible(),true);
        await input.setInputFiles({name:'broken.jpg',mimeType:'image/jpeg',buffer:Buffer.from('invalid image')});
        await page.getByRole('alert').filter({hasText:'사진을 읽을 수 없습니다.'}).waitFor();
        await input.setInputFiles({name:'qa-photo.png',mimeType:'image/png',buffer:png});
        await page.getByAltText('첨부 미리보기').waitFor();
        const dimensions=await page.getByAltText('첨부 미리보기').evaluate(image=>({width:image.naturalWidth,height:image.naturalHeight}));
        assert.equal(dimensions.width,2048);
        assert.ok(dimensions.height>0);
        await page.getByLabel('없음 (X)').check();
        await page.getByLabel(kind==='studio'?'정리정돈을 완료했습니다.':'반납할 기자재의 상태와 구성품을 확인했습니다.').check();
        await page.getByRole('button',{name:'보고서 제출',exact:true}).click();
        await page.getByTestId('submitted').filter({hasText:'image/jpeg'}).waitFor();
        const submitted=JSON.parse(await page.getByTestId('submitted').textContent());
        assert.equal(submitted.photos.length,1);
        assert.equal(submitted.photos[0].category,`${kind}_damage`);
        assert.ok(submitted.photos[0].size>0 && submitted.photos[0].size<=3*1024*1024);
        await page.getByRole('button',{name:'사진 삭제',exact:true}).click();
        assert.equal(await page.getByAltText('첨부 미리보기').count(),0);
      }
      assert.deepEqual(pageErrors,[]);
      console.log(`${engine}: studio/equipment picker click, cancellation, invalid image recovery, resize, preview, submission and deletion passed.`);
    } finally {await browser.close();}
  }
}
