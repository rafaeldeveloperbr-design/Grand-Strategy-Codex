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

  await click('[data-fleet-id="fleet-BRA-1"]');
  await click('[aria-label="Naval Mode"]');
  await click('[aria-label="Locate selected entity"]');

  const report={browser:'Chrome headless, physical CDP right mouse input',checks:[],errors};
  const nodeTarget=()=>evaluate(`(()=>{
    for(const hit of document.querySelectorAll('[data-sea-node-hit-target]')) {
      const m=hit.getScreenCTM(),p=new DOMPoint(+hit.getAttribute('cx'),+hit.getAttribute('cy')).matrixTransform(m);
      const x=p.x+8,y=p.y,r=+hit.getAttribute('r')*m.a;
      if(x<100||x>1100||y<200||y>800)continue;
      if(document.elementFromPoint(x,y)!==hit)continue;
      return {x,y,id:hit.parentElement.dataset.seaNodeId,r,pointerEvents:getComputedStyle(hit).pointerEvents};
    }
    throw new Error('No exposed node hit target');
  })()`);
  const rightClick=async p=>{
    await evaluate(`window.__nodeContext=null;document.addEventListener('contextmenu',e=>{setTimeout(()=>{window.__nodeContext={id:e.target.closest('[data-sea-node-id]')?.dataset.seaNodeId,prevented:e.defaultPrevented};},0);},{once:true,capture:true})`);
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y});
    await call('Input.dispatchMouseEvent',{type:'mousePressed',x:p.x,y:p.y,button:'right',buttons:2,clickCount:1});
    await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:p.x,y:p.y,button:'right',buttons:0,clickCount:1});
    await delay(200);
    const event=await evaluate('window.__nodeContext');
    assert(event?.id===p.id&&event.prevented,'Physical contextmenu failed/preventDefault missing');
    assert((await state()).panel.includes('MOVING'),'Physical right click did not create movement order');
  };
  assert((await state()).panel.includes('DOCKED'),'Initial status is not DOCKED');
  const first=await nodeTarget();assert(Math.abs(first.r-12)<.1&&first.pointerEvents==='all','Hit target is not 24px');
  const before=(await state()).view;
  await rightClick(first);
  assert((await state()).view===before,'Right click initiated pan');
  report.checks.push({check:'DOCKED -> MOVING in peace, 8px away from center',...first});
  await evaluate(`([...document.querySelectorAll('.naval-panel button')].find(b=>b.textContent==='Cancel Order')).click()`);
  assert((await state()).panel.includes('DOCKED'),'Docked cancellation failed');
  await click('[title="Zoom In"]');
  const zoomed=await nodeTarget();assert(Math.abs(zoomed.r-12)<.1,'Zoom changed screen hit radius');
  await rightClick(zoomed);
  report.checks.push({check:'Physical right click after zoom',...zoomed});
  // Cancel after advancing into the sea: obtain HOLDING through existing UI, without save fixtures.
  await click('[title="Velocidade 3"]');await delay(1800);await click('[title="Pausar"]');
  await evaluate(`([...document.querySelectorAll('.naval-panel button')].find(b=>b.textContent==='Cancel Order')).click()`);
  assert((await state()).panel.includes('HOLDING'),'Fleet did not reach HOLDING');
  await rightClick(await nodeTarget());
  report.checks.push('HOLDING -> MOVING through physical contextmenu');
  assert(errors.length===0,'Browser runtime exceptions');
  await writeFile('artifacts/sea-node-contextmenu-browser.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {ws?.close();chrome?.kill();await server.close();}
