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

  const report={browser:'Chrome headless physical contextmenu and click',checks:[],errors};
  await click('[title="Configura\u00e7\u00f5es"]');await click('.settings-modal__btn--primary');
  const keys=await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('imperium_save_')&&k!=='imperium_save_autosave')`);
  const saved=await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(keys[0])}))`);
  const {portByProvince,seaNodeById}=await server.ssrLoadModule('/src/engine/naval/index.ts');
  const node=portByProvince.get('sa_bra_sao_paulo').seaNodeId,next=seaNodeById.get(node).neighbors[0];
  const own=saved.naval.fleets.find(f=>f.id==='fleet-BRA-1'),enemy=saved.naval.fleets.find(f=>f.countryTag==='USA');
  for(const f of [own,enemy]){delete f.portProvinceId;f.locationSeaNodeId=f===own?node:next;f.route=[];delete f.destinationSeaNodeId;delete f.destinationPortId;f.movementProgress=0;f.status='HOLDING';}
  saved.military.wars=[];saved.id='autosave';
  await evaluate(`localStorage.removeItem(${JSON.stringify(keys[0])});localStorage.setItem('imperium_save_autosave',${JSON.stringify(JSON.stringify(saved))})`);
  await evaluate('window.__navalNavigating=true');
  await call('Page.navigate',{url:'http://127.0.0.1:3011/'});await waitFor(`!window.__navalNavigating&&document.querySelector('[data-fleet-id="fleet-BRA-1"]')`);
  await click('[data-province-id="na_usa_washington"]');await waitFor(`document.querySelector('.diplomacy-panel')`);
  await evaluate(`([...document.querySelectorAll('.diplomacy-panel button')].find(b=>b.textContent==='Declarar guerra')).click()`);await delay(100);
  await evaluate(`([...document.querySelectorAll('.diplomacy-panel button')].find(b=>b.textContent==='Confirmar Declara\u00e7\u00e3o de Guerra')).click()`);await delay(100);
  await click('[aria-label="Fechar diplomacia"]');
  await click('[data-fleet-id="fleet-BRA-1"]');await click('[aria-label="Locate selected entity"]');await click('[aria-label="Naval Mode"]');
  for(let i=0;i<3;i++)await click('[title="Zoom Out"]');
  const point=await evaluate(`(()=>{const h=document.querySelector('[data-fleet-id="${enemy.id}"] [data-fleet-hit-target]'),p=new DOMPoint(0,0).matrixTransform(h.getScreenCTM());if(document.elementFromPoint(p.x,p.y)!==h)throw new Error('Enemy marker blocked '+JSON.stringify({x:p.x,y:p.y,element:document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,300),view:document.querySelector('.map__svg').getAttribute('viewBox')}));return {x:p.x,y:p.y};})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'right',buttons:2,clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'right',buttons:0,clickCount:1});await delay(150);
  assert((await state()).panel.includes('MOVING'),'Physical enemy interception failed');
  assert((await state()).panel.includes(next),'Wrong intercept destination');report.checks.push('Declare war through UI; physical right click hostile anchor creates route to logical node');
  await click('[title="Velocidade 3"]');await waitFor(`document.querySelector('[aria-label="Naval battle"]')`);await click('[title="Pausar"]');
  const battlePoint=await evaluate(`(()=>{const h=document.querySelector('[data-naval-battle-hit-target]'),p=new DOMPoint(0,0).matrixTransform(h.getScreenCTM());if(document.elementFromPoint(p.x,p.y)!==h)throw new Error('Battle marker blocked');return {x:p.x,y:p.y};})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...battlePoint,button:'left',buttons:1,clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',...battlePoint,button:'left',buttons:0,clickCount:1});await delay(100);
  assert(await evaluate(`document.querySelector('[aria-label="Naval battle panel"]')?.textContent.includes('ACTIVE')`),'Physical battle inspection failed');
  report.checks.push('x3 encounter starts battle automatically; physical click on battle marker opens ACTIVE panel');
  // Remove only this browser fixture: it was written uncompressed and consumes quota.
  await evaluate(`localStorage.removeItem('imperium_save_autosave')`);
  await click('[title="Configura\u00e7\u00f5es"]');await click('.settings-modal__btn--primary');
  const saves=await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('imperium_save_')&&k!=='imperium_save_autosave')`);
  const battleSave=await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(saves[0]??'imperium_save_autosave')}))`);
  assert(battleSave.naval.battles.some(b=>b.status==='ACTIVE'),'Active battle missing from save');
  await click('.settings-modal__btn--small');await delay(200);
  assert(await evaluate(`document.querySelector('[data-naval-battle-hit-target]')!==null`),'Load lost active battle');
  report.checks.push('Save/load preserves active NavalBattle');
  assert(errors.length===0,'Browser runtime exceptions');
  await writeFile('artifacts/naval-interception-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {ws?.close();chrome?.kill();await server.close();}
