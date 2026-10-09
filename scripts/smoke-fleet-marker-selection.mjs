// Browser validation via Chrome DevTools Protocol; no extra package dependency.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chromePath=process.env.NAVAL_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=await mkdtemp(join(tmpdir(),'naval-smoke-'));
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
  const state=()=>evaluate(`(()=>{const panel=document.querySelector('[aria-label="Fleet panel"]');return {panel:panel?.textContent,marker:document.querySelector('[data-fleet-id="fleet-BRA-1"]')?.getAttribute('transform'),date:document.querySelector('.top-bar__date')?.textContent,view:document.querySelector('.map__svg')?.getAttribute('viewBox')};})()`);
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'http://127.0.0.1:3011/?newgame=1'});
  await waitFor(`document.querySelector('.country-selection__list button')`);
  await evaluate(`([...document.querySelectorAll('.country-selection__list button')].find(b=>b.textContent==='Brasil')).click()`);await delay(150);
  await click('.country-selection__play');await waitFor(`document.querySelector('[data-fleet-id="fleet-BRA-1"]')`);


  const report={browser:'Chrome headless, physical mouse input',checks:[],errors};
  const fleetPoint=()=>evaluate(`(()=>{const hit=document.querySelector('[data-fleet-id="fleet-BRA-1"] [data-fleet-hit-target]');const m=hit.getScreenCTM(),p=new DOMPoint(0,0).matrixTransform(m);const x=p.x+14,y=p.y;return {x,y,r:+hit.getAttribute('r')*m.a,exposed:document.elementFromPoint(x,y)===hit};})()`);
  const physicalClick=async p=>{
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
    await call('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'left',buttons:1,clickCount:1});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'left',buttons:0,clickCount:1});
    await delay(150);
  };
  // Setup camera through existing UI; fleet selection itself always uses physical input.
  await click('[aria-label="Focus Player"]');
  for(const mode of [false,true]) {
    if(mode)await click('[aria-label="Naval Mode"]');
    const p=await fleetPoint();assert(p.exposed&&Math.abs(p.r-16)<.1,'Fleet hit target blocked');
    const before=(await state()).view;await physicalClick(p);
    assert((await state()).panel?.includes('DOCKED'),'Physical docked selection failed');
    assert((await state()).view===before,'Fleet selection started pan');
    await click('[data-province-id="sa_bra_sao_paulo"]');
    assert(!(await state()).panel,'Province did not clear fleet');
    await physicalClick(await fleetPoint());
    assert((await state()).panel?.includes('DOCKED'),'Fleet reselection failed');
    assert(!await evaluate(`document.querySelector('.province-panel')`),'Province panel remained after fleet selection');
    report.checks.push(`Physical DOCKED selection/reselection, Naval Mode ${mode}`);
  }
  await click('[aria-label="Locate selected entity"]');
  await click('[title="Zoom In"]');
  const zoom=await fleetPoint();assert(zoom.exposed&&Math.abs(zoom.r-16)<.1,'Fleet hit target failed after zoom');
  await click('[aria-label="Fechar frota"]');
  await physicalClick(zoom);assert((await state()).panel,'Zoomed reselection failed');
  report.checks.push('32px screen target and reselection after zoom');
  const seaTarget=await evaluate(`(()=>{for(const h of document.querySelectorAll('[data-sea-node-hit-target]')){const m=h.getScreenCTM(),p=new DOMPoint(+h.getAttribute('cx'),+h.getAttribute('cy')).matrixTransform(m);if(p.x>100&&p.x<1100&&p.y>200&&p.y<800&&document.elementFromPoint(p.x+8,p.y)===h)return {x:p.x+8,y:p.y};}throw new Error('No exposed SeaNode');})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...seaTarget,button:'right',buttons:2,clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',...seaTarget,button:'right',buttons:0,clickCount:1});await delay(200);
  assert((await state()).panel?.includes('MOVING'),'Node command after reselection failed');
  await click('[title="Velocidade 1"]');await delay(600);await click('[title="Pausar"]');
  await click('[aria-label="Fechar frota"]');
  const moving=await fleetPoint();assert(moving.exposed,'Moving target blocked');await physicalClick(moving);
  assert((await state()).panel?.includes('MOVING'),'Moving fleet reselection failed');
  report.checks.push('SeaNode physical right click after reselection and physical MOVING selection');
  await click('[title="Velocidade 3"]');await delay(1800);await click('[title="Pausar"]');
  await evaluate(`([...document.querySelectorAll('.naval-panel button')].find(b=>b.textContent==='Cancel Order')).click()`);
  assert((await state()).panel?.includes('HOLDING'),'Holding setup failed');
  await click('[aria-label="Fechar frota"]');await physicalClick(await fleetPoint());
  assert((await state()).panel?.includes('HOLDING'),'Holding fleet reselection failed');
  report.checks.push('Physical HOLDING reselection');
  assert(errors.length===0,'Browser runtime exceptions');
  await writeFile('artifacts/fleet-marker-selection-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {ws?.close();chrome?.kill();await server.close();}
