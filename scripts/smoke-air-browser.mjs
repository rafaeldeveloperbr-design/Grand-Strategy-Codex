// Browser validation via Chrome DevTools Protocol; no extra package dependency.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chromePath=process.env.AIR_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=await mkdtemp(join(tmpdir(),'air-smoke-'));
const server=await createServer({server:{host:'127.0.0.1',port:3013,strictPort:true,hmr:false},logLevel:'error'});
let chrome,ws,inspect;let sequence=0;const pending=new Map(),errors=[];
try {
  await server.listen();
  chrome=spawn(chromePath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9335',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let pages;
  for(let i=0;i<60;i++) {try {pages=await (await fetch('http://127.0.0.1:9335/json/list')).json();if(pages.some(p=>p.type==='page'))break;} catch {} await delay(250);}
  const target=pages?.find(p=>p.type==='page');if(!target)throw new Error('Chrome debugger unavailable');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=e=>{const msg=JSON.parse(e.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.reject(new Error(msg.error.message));else p.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description??msg.params.exceptionDetails.text);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  inspect=evaluate;
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error(`Timed out: ${expression}`);};
  const click=async selector=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Element missing: '+${JSON.stringify(selector)});e.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));})()`);await delay(200);};
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const {airBases,airZoneByProvinceId,createInitialAirState}=await server.ssrLoadModule('/src/engine/air/index.ts');
  const {countries,provincesData}=await server.ssrLoadModule('/src/data/map/index.ts');
  const {startContinuousBattle}=await server.ssrLoadModule('/src/engine/combat/index.ts');
  const initial=createInitialAirState(countries,provincesData),fighter=initial.wings.find(w=>w.countryTag==='BRA'&&w.type==='FIGHTER');
  const zone=airZoneByProvinceId.get(fighter.baseProvinceId);
  const report={browser:'Chrome headless CDP',checks:[],errors,performance:{}};
  const choose=async(selector,value)=>{await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(100);};
  const button=async(label)=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(label)});if(!b)throw new Error('Missing button '+${JSON.stringify(label)});b.click();})()`);await delay(150);};
  const current=()=>evaluate(`(()=>{let f=document.querySelector('.game')?.[Object.keys(document.querySelector('.game')??{}).find(k=>k.startsWith('__reactFiber'))];while(f?.return)f=f.return;const queue=[f?.stateNode?.current??f];f=undefined;while(queue.length){const candidate=queue.pop();if(candidate?.type?.name==='GameApp'){f=candidate;break;}if(candidate?.sibling)queue.push(candidate.sibling);if(candidate?.child)queue.push(candidate.child);}const hooks=[];let h=f?.memoizedState;while(h){hooks.push(h.memoizedState);h=h.next;}return {air:hooks.find(v=>v?.wings&&v?.engagements),battles:hooks.find(v=>Array.isArray(v)&&v[0]?.participantArmyIds),wars:hooks.find(v=>Array.isArray(v)&&v[0]?.attacker),date:document.querySelector('.top-bar__date')?.textContent};})()`);
  await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'http://127.0.0.1:3013/?newgame=1'});
  await waitFor(`document.querySelector('.country-selection__list button')`);
  await button('Brasil');await click('.country-selection__play');await waitFor(`document.querySelector('[aria-label="Air Mode"]')`);
  report.checks.push('New Game BRA and Country Selection');
  await click('[aria-label="Reset View"]');await click('[aria-label="Air Mode"]');assert(await evaluate(`document.querySelectorAll('[aria-label^="AirBase "]').length===${airBases.length}`),'Missing bases');
  await click(`[aria-label="AirBase ${provincesData.find(p=>p.id===fighter.baseProvinceId).name}"]`);
  assert(await evaluate(`!!document.querySelector('.province-panel')`),'Base province panel missing');
  await evaluate(`([...document.querySelectorAll('.province-panel button')].find(b=>b.textContent.includes('Militar'))).click()`);await delay(100);
  await button(`${fighter.name} · 24 aeronaves`);await waitFor(`document.querySelector('[aria-label="AirWing panel"]')`);
  assert(await evaluate(`!document.querySelector('.province-panel')`),'Selection exclusivity failed');
  report.checks.push('Air Mode, base military section, selectable wing and selection exclusivity');
  const before=await evaluate(`document.querySelector('.map__svg').getAttribute('viewBox')`);
  await button('Localizar (F)');assert((await evaluate(`document.querySelector('.map__svg').getAttribute('viewBox')`))!==before,'Locate failed');
  await click('[aria-label="Reset View"]');await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',bubbles:true}))`);report.checks.push('Locate and F');
  await choose('[aria-label="Assign Mission"]','AIR_SUPERIORITY');await choose('[aria-label="Select AirZone"]',zone.id);await button('Atribuir missão');
  assert((await current()).air.wings.find(w=>w.id===fighter.id).mission==='AIR_SUPERIORITY','Mission command failed');report.checks.push('Assign Air Superiority in range');
  await click('[aria-label="Close AirWing"]');await click('[data-province-id="sa_arg_buenos_aires"]');await waitFor(`document.querySelector('.diplomacy-panel')`);
  await button('Declarar guerra');await button('Confirmar Declaração de Guerra');assert((await current()).wars.some(w=>w.attacker==='BRA'&&w.defender==='ARG'),'War declaration failed');await click('[aria-label="Fechar diplomacia"]');report.checks.push('Declare war through diplomacy UI');
  await click('[title="Configurações"]');await click('.settings-modal__btn--primary');
  const keys=await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('imperium_save_')&&k!=='imperium_save_autosave')`);
  assert(keys.length===1,'Manual save missing');const saved=await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(keys[0])}))`);
  // A saved front supplies a reproducible battle to the real simulation; no live-state mutation.
  const enemy=saved.air.wings.find(w=>w.countryTag==='ARG'&&w.type==='FIGHTER');
  enemy.mission='AIR_SUPERIORITY';enemy.status='MISSION';enemy.assignedAirZoneId=zone.id;
  const cas=saved.air.wings.find(w=>w.countryTag==='BRA'&&w.type==='CAS'),bomber=saved.air.wings.find(w=>w.countryTag==='BRA'&&w.type==='BOMBER');
  for(const [w,mission] of [[cas,'CLOSE_AIR_SUPPORT'],[bomber,'BOMBING']]) {w.mission=mission;w.status='MISSION';w.assignedAirZoneId=zone.id;}
  const province=saved.world.provinces.find(p=>p.id==='sa_bra_brasilia');
  const ownArmy=saved.military.armies.find(a=>a.owner==='BRA'),enemyArmy=saved.military.armies.find(a=>a.owner==='ARG');
  for(const a of [ownArmy,enemyArmy]) {a.location=province.id;a.destination=null;a.targetDestination=null;a.path=[];a.movementProgress=0;a.inCombat=true;}
  saved.military.activeBattles=[startContinuousBattle([ownArmy],[enemyArmy],province,saved.date,'air-smoke-land')];
  await evaluate(`localStorage.setItem(${JSON.stringify(keys[0])},${JSON.stringify(JSON.stringify(saved))})`);
  await click('.settings-modal__btn--small');await click('[title="Velocidade 1"]');
  await waitFor(`document.querySelector('.top-bar__date')?.textContent!==${JSON.stringify((await current()).date)}`);
  await delay(500);await click('[title="Pausar"]');const combat=await current();
  assert(combat.air.wings.find(w=>w.id===fighter.id).aircraftCount<24,'Air combat caused no losses');
  assert(combat.battles?.length,'Land battle not preserved');report.checks.push('Saved hostile zone resolves simultaneous air losses before CAS and bombing');
  await click('[aria-label="Air Mode"]'); // Loading preserves map mode, so toggle off then on for a predictable overlay.
  await click('[aria-label="Air Mode"]');
  await click(`[aria-label="AirWing ${cas.name}"]`);assert(await evaluate(`document.querySelector('[aria-label="AirWing panel"]').textContent.includes('CLOSE_AIR_SUPPORT')`),'CAS mission missing');
  await click('[aria-label="Close AirWing"]');
  await evaluate(`document.querySelector('[data-air-zone-id="${zone.id}"]').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,altKey:true}))`);await delay(100);
  assert(await evaluate(`document.querySelector('[aria-label="AirZone panel"]')?.textContent.includes('CAS +')`),'Battle support feedback missing');
  report.checks.push('CAS and bombing missions continue with land battle');
  await click(`[aria-label="AirWing ${fighter.name}"]`);const rebaseTarget=airBases.find(b=>b.provinceId!==fighter.baseProvinceId&&provincesData.find(p=>p.id===b.provinceId)?.owner==='BRA');
  await choose('[aria-label="Rebase target"]',rebaseTarget.provinceId);await button('Rebase');assert((await current()).air.wings.find(w=>w.id===fighter.id).status==='REBASING','Rebase command failed');
  // Full-world saves share the existing browser quota. Keep one slot in this disposable profile.
  await evaluate(`localStorage.removeItem(${JSON.stringify(keys[0])})`);
  await click('[title="Configurações"]');await click('.settings-modal__btn--primary');const rebaseKeys=await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('imperium_save_')&&k!=='imperium_save_autosave')`);
  const rebaseKey=rebaseKeys.find(k=>k!==keys[0]);assert(rebaseKey,'Rebase save missing');const moving=await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(rebaseKey)}))`);
  assert(moving.air.wings.find(w=>w.id===fighter.id).rebase,'Rebase progress absent from save');
  await evaluate(`(()=>{const rows=[...document.querySelectorAll('.settings-modal__save-item')];const buttons=[...document.querySelectorAll('.settings-modal__btn--small:not(.settings-modal__btn--danger)')];buttons[0].click();void rows;})()`);await delay(150);
  assert((await current()).air.wings.find(w=>w.id===fighter.id).status==='REBASING','Rebase load failed');report.checks.push('Timed Rebase, manual Save V3 and load restores exact progress without duplication');
  const measure=()=>evaluate(`new Promise(resolve=>{const gaps=[];let previous=performance.now(),start=previous;function frame(now){gaps.push(now-previous);previous=now;window.dispatchEvent(new KeyboardEvent('keydown',{key:gaps.length%2?'ArrowLeft':'ArrowRight',bubbles:true}));if(now-start<1800)requestAnimationFrame(frame);else resolve({frames:gaps.length,maxFrameGapMs:Math.max(...gaps),over50ms:gaps.filter(x=>x>50).length,overlayPaths:document.querySelectorAll('.air-zone').length});}requestAnimationFrame(frame);})`);
  const samples={airMode:[],normalMode:[]};
  // Restore the same saved front and camera before each sample; alternate order.
  for(let round=0;round<3;round++) for(const mode of round%2?['airMode','normalMode']:['normalMode','airMode']) {
    await click('[title="Configurações"]');await click('.settings-modal__btn--small');await button('Localizar (F)');
    const enabled=await evaluate(`document.querySelector('[aria-label="Air Mode"]').getAttribute('aria-pressed')==='true'`);
    if(enabled!==(mode==='airMode'))await click('[aria-label="Air Mode"]');
    await click('[title="Velocidade 3"]');samples[mode].push(await measure());await click('[title="Pausar"]');
  }
  report.performance=Object.fromEntries(Object.entries(samples).map(([mode,values])=>[mode,{samples:values,averageFrames:values.reduce((s,v)=>s+v.frames,0)/values.length,averageMaxFrameGapMs:values.reduce((s,v)=>s+v.maxFrameGapMs,0)/values.length,averageOver50ms:values.reduce((s,v)=>s+v.over50ms,0)/values.length}]));
  assert((await current()).air.wings.find(w=>w.id===fighter.id).baseProvinceId===rebaseTarget.provinceId,'Rebase did not complete');
  report.checks.push('Rebase completes, x3 with zoom/pan and air overlay');
  if(await evaluate(`document.querySelector('[aria-label="Air Mode"]').getAttribute('aria-pressed')!=='true'`))await click('[aria-label="Air Mode"]');
  await button('Localizar (F)');await click(`[aria-label="AirWing ${fighter.name}"]`);
  const screenshot=await call('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/air-warfare-v1-browser.png',Buffer.from(screenshot.data,'base64'));
  assert(errors.length===0,'Browser exceptions');await writeFile('artifacts/air-warfare-v1-browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){if(inspect)console.log('Browser diagnostic',await inspect(`({panel:document.querySelector('.air-panel')?.textContent,settings:document.querySelector('.settings-modal')?.textContent,toasts:[...document.querySelectorAll('.toast-message')].map(e=>e.textContent),errors:${JSON.stringify(errors)}})`));throw error;}
finally{ws?.close();chrome?.kill();await server.close();}
