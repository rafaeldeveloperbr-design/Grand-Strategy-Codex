// Browser validation via Chrome DevTools Protocol; no extra package dependency.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chromePath=process.env.NAVAL_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=await mkdtemp(join(tmpdir(),'province-panel-smoke-'));
const server=await createServer({server:{host:'127.0.0.1',port:3011,strictPort:true,hmr:false},logLevel:'error'});
let chrome,ws;let sequence=0;const pending=new Map(),errors=[];
try {
  await server.listen();
  chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9333',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let pages;
  for(let i=0;i<60;i++) {try {pages=await (await fetch('http://127.0.0.1:9333/json/list')).json();if(pages.some(p=>p.type==='page'))break;} catch {} await delay(250);}
  const target=pages?.find(p=>p.type==='page');if(!target)throw new Error('Chrome debugger unavailable');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.reject(new Error(msg.error.message));else p.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description??msg.params.exceptionDetails.text);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error(`Timed out: ${expression}`);};
  const click=async selector=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Element missing: '+${JSON.stringify(selector)});e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));})()`);await delay(200);};
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'http://127.0.0.1:3011/?newgame=1'});
  await waitFor(`document.querySelector('.country-selection__list button')`);
  await evaluate(`([...document.querySelectorAll('.country-selection__list button')].find(b=>b.textContent==='Brasil')).click()`);await delay(150);
  await click('.country-selection__play');await waitFor(`document.querySelector('[data-fleet-id="fleet-BRA-1"]')`);



  const report={checks:[],errors};
  const tab=async name=>{await evaluate(`([...document.querySelectorAll('.province-panel__tab')].find(b=>b.textContent.includes(${JSON.stringify(name)}))).click()`);await delay(150);};
  const press=async expression=>{await evaluate(expression);await delay(200);};
  const overview=()=>evaluate(`document.querySelector('.province-panel__sidebar')?.textContent`);
  await click('[data-province-id="sa_bra_sao_paulo"]');
  assert(await evaluate(`document.querySelectorAll('.province-panel__tab').length===5 && !document.querySelector('.naval-port-info')`),'Initial tabs/naval placement');
  await tab('Porto');await waitFor(`document.querySelector('[aria-label="Naval construction"]')`);
  await press(`([...document.querySelectorAll('[aria-label="Naval construction"] button')].find(b=>b.textContent==='Build Destroyer')).click()`);
  assert((await overview()).includes('Destroyer'),'Naval overview missing');
  await tab('Militar');
  await press(`document.querySelector('button[aria-label="Recrutar Guarnição"]').click()`);
  assert((await overview()).includes('Guarnição'),'Recruitment overview missing on Militar');
  await tab('Obras');
  await press(`([...document.querySelectorAll('.province-panel__build-option')].find(el=>el.textContent.includes('Serraria'))).querySelector('button').click()`);
  assert(await evaluate(`document.querySelectorAll('.province-panel__sidebar-section').length===3`),'Three activity sections missing: '+await evaluate(`document.querySelector('.province-panel').textContent`));
  report.checks.push('BRA / São Paulo: Destroyer + Guarnição + Serraria started through UI and aggregated');
  await tab('Porto');
  for(const [width,height] of [[1440,900],[1280,720],[1024,768],[768,720]]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(150);
    const layout=await evaluate(`(()=>{const p=document.querySelector('.province-panel'),tabs=p.querySelector('.province-panel__tabs'),c=p.querySelector('.province-panel__content'),s=p.querySelector('.province-panel__sidebar-content');const r=p.getBoundingClientRect(),t=tabs.getBoundingClientRect();return {panel:{top:r.top,bottom:r.bottom},tabs:{top:t.top,bottom:t.bottom},contentHeight:c.clientHeight,sidebarHeight:s.clientHeight,contentScroll:getComputedStyle(c).overflowY,sidebarScroll:getComputedStyle(s).overflowY,horizontalOverflow:p.scrollWidth>p.clientWidth}})()`);
    assert(layout.tabs.top>=layout.panel.top && layout.tabs.bottom<=layout.panel.bottom && layout.contentHeight>0 && layout.sidebarHeight>0 && !layout.horizontalOverflow,'Broken viewport layout '+JSON.stringify(layout));
    assert(layout.contentScroll==='auto'&&layout.sidebarScroll==='auto','Independent scroll missing');
    report.checks.push({viewport:[width,height],layout});
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const capture=await call('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/province-panel-ux-cleanup-v1.png',Buffer.from(capture.data,'base64'));
  const {provincesData}=await server.ssrLoadModule('/src/data/map/index.ts');const {portByProvince}=await server.ssrLoadModule('/src/engine/naval/index.ts');
  const {airBaseByProvinceId}=await server.ssrLoadModule('/src/engine/air/index.ts');
  const inland=provincesData.find(p=>p.owner==='BRA'&&!portByProvince.has(p.id)&&!airBaseByProvinceId.has(p.id));
  await click(`[data-province-id="${inland.id}"]`);
  assert(await evaluate(`document.querySelectorAll('.province-panel__tab').length===3&&document.querySelector('.province-panel__tab--active').textContent.includes('Info')`),'Inland fallback failed');
  await click('[data-province-id="sa_bra_sao_paulo"]');assert(await evaluate(`document.querySelectorAll('.province-panel__tab').length===5 && !document.querySelector('.naval-port-info')`),'Return layout failed');
  report.checks.push('Inland selection hides Porto, falls back to Info; return to São Paulo restores five tabs');
  assert(errors.length===0,'Browser exceptions');await writeFile('artifacts/province-panel-ux-cleanup-v1-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {ws?.close();chrome?.kill();await server.close();}
