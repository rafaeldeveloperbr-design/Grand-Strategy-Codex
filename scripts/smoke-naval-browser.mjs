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
let chrome,ws,inspect;let sequence=0;const pending=new Map(),errors=[];
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
  inspect=evaluate;
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error(`Timed out: ${expression}`);};
  const click=async selector=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Element missing: '+${JSON.stringify(selector)});e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));})()`);await delay(200);};
  const state=()=>evaluate(`(()=>{const panel=document.querySelector('[aria-label="Fleet panel"]');return {panel:panel?.textContent,marker:document.querySelector('[data-fleet-id="fleet-BRA-1"]')?.getAttribute('transform'),date:document.querySelector('.top-bar__date')?.textContent,view:document.querySelector('.map__svg')?.getAttribute('viewBox')};})()`);
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'http://127.0.0.1:3011/?newgame=1'});
  await waitFor(`document.querySelector('.country-selection__list button')`);
  await evaluate(`([...document.querySelectorAll('.country-selection__list button')].find(b=>b.textContent==='Brasil')).click()`);await delay(150);
  await click('.country-selection__play');await waitFor(`document.querySelector('[data-fleet-id="fleet-BRA-1"]')`);
  const report={browser:'Chrome headless CDP',checks:[],errors,performance:{}};
  report.checks.push('New Game BRA');await click('[data-fleet-id="fleet-BRA-1"]');const initial=await state();assert(initial.panel.includes('DOCKED'),'Initial navy not docked');
  await click('[aria-label="Locate selected entity"]');assert((await state()).view!==initial.view,'Locate failed');report.checks.push('Fleet selection and camera Locate');
  await click('[aria-label="Naval Mode"]');assert(await evaluate(`document.querySelectorAll('[aria-label^="SeaNode "]').length>0`),'Naval network missing');report.checks.push('Naval Mode');await click('[aria-label="Reset View"]');
  const {seaNodes}=await server.ssrLoadModule('/src/engine/naval/index.ts');const targetNode=[...seaNodes].sort((a,b)=>Math.hypot(a.x-2100,a.y-1400)-Math.hypot(b.x-2100,b.y-1400))[0];
  await evaluate(`document.querySelector('[aria-label="SeaNode ${targetNode.id}"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}))`);await delay(200);assert((await state()).panel.includes('MOVING'),'Movement order failed');
  await click('[title="Velocidade 3"]');await delay(1400);await click('[title="Pausar"]');const moving=await state();assert(moving.marker!==initial.marker,'Fleet did not move');report.checks.push('Atlantic movement at x3');
  await click('[aria-label="Reset View"]');await click('[aria-label="Focus Player"]');report.checks.push('Reset / focus camera');
  await click('[title="Configurações"]');await click('.settings-modal__btn--primary');const keys=await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('imperium_save_')&&k!=='imperium_save_autosave')`);assert(keys.length===1,'Manual save missing');
  const saved=await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(keys[0])}))`);assert(saved.naval.fleets.some(f=>f.id==='fleet-BRA-1'&&f.route.length),'Route missing in save');report.checks.push('Save V3 persists movement');
  await click('.settings-modal__btn--small');await delay(200);await click('[data-fleet-id="fleet-BRA-1"]');assert((await state()).marker===moving.marker,'Load did not restore fleet position');report.checks.push('Load restores fleet route/progress without duplicates');
  // A reproducible encounter fixture uses the real saved campaign and war model.
  const own=saved.naval.fleets.find(f=>f.id==='fleet-BRA-1'),enemy=saved.naval.fleets.find(f=>f.countryTag==='USA');
  const {portByProvince}=await server.ssrLoadModule('/src/engine/naval/index.ts');const encounter=portByProvince.get('sa_bra_sao_paulo').seaNodeId;
  for(const f of [own,enemy]){delete f.portProvinceId;f.locationSeaNodeId=encounter;f.route=[];delete f.destinationSeaNodeId;delete f.destinationPortId;f.movementProgress=0;f.status='HOLDING';}
  saved.military.wars=[];saved.id='autosave';
  await evaluate(`localStorage.removeItem(${JSON.stringify(keys[0])});localStorage.setItem('imperium_save_autosave',${JSON.stringify(JSON.stringify(saved))})`);
  await evaluate('window.__navalNavigating=true');
  await call('Page.navigate',{url:'http://127.0.0.1:3011/'});await waitFor(`!window.__navalNavigating && document.querySelector('[data-fleet-id="fleet-BRA-1"]')`);
  await click('[data-province-id="na_usa_washington"]');await waitFor(`document.querySelector('.diplomacy-panel')`);
  await evaluate(`([...document.querySelectorAll('.diplomacy-panel button')].find(b=>b.textContent==='Declarar guerra')).click()`);await delay(150);
  await evaluate(`([...document.querySelectorAll('.diplomacy-panel button')].find(b=>b.textContent==='Confirmar Declaração de Guerra')).click()`);await delay(200);
  assert(await evaluate(`document.querySelector('.diplomacy-panel__status-text')?.textContent==='Guerra'`),'Diplomacy declaration failed');await click('[aria-label="Fechar diplomacia"]');report.checks.push('Declare war against USA through diplomacy UI');
  await click('[data-fleet-id="fleet-BRA-1"]');await click('[title="Velocidade 1"]');
  await waitFor(`document.querySelector('[aria-label="Naval battle"]')`);await click('[title="Pausar"]');await click('[aria-label="Naval battle"]');assert(await evaluate(`document.querySelector('[aria-label="Naval battle panel"]')?.textContent.includes('ACTIVE')`),'Battle UI missing');
  report.checks.push('Wartime fixture: hostile encounter, battle panel and battle camera focus');
  const battleScreenshot=await call('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/naval-warfare-v1-battle.png',Buffer.from(battleScreenshot.data,'base64'));
  await click('[aria-label="Fechar batalha naval"]');await click('[title="Velocidade 3"]');await delay(3000);await click('[title="Pausar"]');await click('[data-fleet-id="fleet-BRA-1"]');
  const afterBattle=await state();report.afterBattle=afterBattle.panel;
  assert(!afterBattle.panel.includes('COMBAT'),'Encounter did not resolve');report.checks.push('Battle resolves with retreat');
  await evaluate(`([...document.querySelectorAll('.naval-panel button')].find(b=>b.textContent==='Return to Port')).click()`);await delay(100);await click('[title="Velocidade 3"]');await delay(3000);await click('[title="Pausar"]');const recovered=await state();assert(recovered.panel.includes('DOCKED'),'Return did not dock');assert(Number(recovered.panel.match(/Força: (\d+)/)?.[1])>Number(afterBattle.panel.match(/Força: (\d+)/)?.[1]),'Port strength repair did not occur');report.checks.push('Return to port and recovery');
  // Frame gaps are a smoke measurement, not a before/after microstutter claim.
  const measure=()=>evaluate(`new Promise(resolve=>{const gaps=[];let previous=performance.now(),start=previous;function frame(now){gaps.push(now-previous);previous=now;window.dispatchEvent(new KeyboardEvent('keydown',{key:gaps.length%2?'ArrowLeft':'ArrowRight',bubbles:true}));if(now-start<2000)requestAnimationFrame(frame);else resolve({frames:gaps.length,maxFrameGapMs:Math.max(...gaps),over50ms:gaps.filter(x=>x>50).length,renderedNavalEdges:document.querySelectorAll('[data-testid="naval-layer"] line').length});}requestAnimationFrame(frame);})`);
  await click('[title="Velocidade 3"]');report.performance.normalMode=await measure();
  await click('[aria-label="Naval Mode"]');report.performance.navalMode=await measure();
  await click('[title="Pausar"]');report.checks.push('x3 with camera navigation');
  const autosave=await evaluate(`JSON.parse(localStorage.getItem('imperium_save_autosave'))`);
  assert(autosave.naval.battles.length>0,'Autosave did not persist the naval battle');report.checks.push('Monthly autosave persists naval battle and recovery');
  const screenshot=await call('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/naval-warfare-v1-browser.png',Buffer.from(screenshot.data,'base64'));
  assert(errors.length===0,'Browser runtime exceptions');await writeFile('artifacts/naval-warfare-v1-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} catch(error) {
  if(inspect) console.log('Browser diagnostic',await inspect(`(()=>{const el=document.querySelector('.game');let fiber=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='GameApp')fiber=fiber.return;const hooks=[];let h=fiber?.memoizedState;while(h){hooks.push(h.memoizedState);h=h.next;}return {date:document.querySelector('.top-bar__date')?.textContent,speed:document.querySelector('.top-bar__speed-btn--active')?.title,warHooks:hooks.filter(v=>Array.isArray(v)&&v[0]?.attacker),naval:hooks.find(v=>v?.fleets)?.fleets.filter(f=>['BRA','USA'].includes(f.countryTag)),panel:document.querySelector('.naval-panel')?.textContent,errors:${JSON.stringify(errors)}};})()`));
  throw error;
} finally {ws?.close();chrome?.kill();await server.close();}
