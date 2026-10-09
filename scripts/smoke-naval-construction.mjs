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



  const report={browser:'Chrome headless UI / real daily ticks',checks:[],errors};
  const text=()=>evaluate(`document.querySelector('[aria-label="Naval construction"]')?.textContent`);
  await click('[data-province-id="sa_bra_sao_paulo"]');await waitFor(`document.querySelector('[aria-label="Naval construction"]')`);
  assert((await text()).includes('Shipyard'),'Initial yard missing');
  await evaluate(`document.querySelector('[aria-label="Reinforcement fleet"]').value='fleet-BRA-1';document.querySelector('[aria-label="Reinforcement fleet"]').dispatchEvent(new Event('change',{bubbles:true}))`);
  const before=await text();
  await evaluate(`([...document.querySelectorAll('[aria-label="Naval construction"] button')].find(b=>b.textContent==='Build Destroyer')).click()`);await delay(150);
  assert((await text()).includes('Destroyer'),'Build order missing');report.checks.push({check:'New Game BRA / Sao Paulo shipyard / Destroyer paid from treasury and local stock',before,after:await text()});
  assert(await evaluate(`([...document.querySelectorAll('[aria-label="Naval construction"] button')].find(b=>b.textContent==='Build Cruiser')).disabled`),'Cruiser should require level 2');
  await click('[title="Velocidade 3"]');
  for(let i=0;i<600;i++){if(await evaluate(`document.querySelector('[aria-label="Naval build queue"]')?.children.length===0`))break;await delay(100);}
  await click('[title="Pausar"]');
  assert(await evaluate(`document.querySelector('[aria-label="Naval build queue"]').children.length===0`),'Destroyer did not complete');
  await click('[data-fleet-id="fleet-BRA-1"]');assert(await evaluate(`document.querySelector('[aria-label="Fleet panel"] ul').children.length===6`),'Completed ship did not join first fleet');
  report.checks.push('Real x3 daily progress completes Destroyer and adds sixth ship to initial fleet');
  await evaluate(`localStorage.removeItem('imperium_save_autosave')`);
  await click('[title^="Configura"]');await click('.settings-modal__btn--primary');
  const keys=await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('imperium_save_')&&k!=='imperium_save_autosave')`);
  const saved=await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(keys[0])}))`);
  // Isolated resource/progress fixture exercises upgrade and reload without waiting another 180 days.
  const province=saved.world.provinces.find(p=>p.id==='sa_bra_sao_paulo'),country=saved.world.countries.find(c=>c.tag==='BRA');
  province.market.goods.iron.stock=1000;province.market.goods.tools.stock=1000;country.resources.gold=10000;
  const {startNavalConstruction}=await server.ssrLoadModule('/src/engine/naval/construction.ts');
  const next=startNavalConstruction(saved.naval,saved.world.provinces,saved.world.countries,'BRA',province.id,'UPGRADE',-190000);
  assert(!next.error,next.error);saved.naval=next.naval;saved.world.provinces=next.provinces;saved.world.countries=next.countries;
  const playerUpgrade=saved.naval.construction.upgrades.find(u=>u.provinceId===province.id&&u.countryTag==='BRA');
  playerUpgrade.progress=playerUpgrade.requiredProgress-1;
  await evaluate(`localStorage.clear();localStorage.setItem('imperium_save_autosave',${JSON.stringify(JSON.stringify(saved))});window.__navalNavigating=true`);
  await call('Page.navigate',{url:'http://127.0.0.1:3011/'});await waitFor(`!window.__navalNavigating&&document.querySelector('[data-fleet-id="fleet-BRA-1"]')`);
  await click('[data-province-id="sa_bra_sao_paulo"]');await click('[title="Velocidade 3"]');await waitFor(`document.querySelector('[aria-label="Naval construction"] h4')?.textContent.includes('vel 2')`);await click('[title="Pausar"]');
  assert((await text()).includes('vel 2'),'Upgrade failed');
  await evaluate(`([...document.querySelectorAll('[aria-label="Naval construction"] button')].find(b=>b.textContent==='Build Cruiser')).click()`);await delay(150);
  assert(await evaluate(`document.querySelector('[aria-label="Naval build queue"]')?.textContent.includes('Cruiser')`),'Cruiser order missing');
  report.checks.push('Explicit resource/progress fixture: upgrade completes, unlocks Cruiser and paid queue starts');
  await evaluate(`localStorage.removeItem('imperium_save_autosave')`);
  await click('[title^="Configura"]');await click('.settings-modal__btn--primary');
  await click('.settings-modal__btn--small');await delay(200);await click('[data-province-id="sa_bra_sao_paulo"]');
  assert(await evaluate(`document.querySelector('[aria-label="Naval build queue"]')?.children.length===1`),'Reload lost/duplicated Cruiser queue');
  report.checks.push('Save V3 / load restores one paid queue item and shipyard level');
  assert(errors.length===0,'Browser exceptions');
  await writeFile('artifacts/naval-construction-v1-1-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 } catch(error) {
  if(inspect)console.log('Construction diagnostic',await inspect(`(()=>{const el=document.querySelector('.game');let fiber=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(fiber&&fiber.type?.name!=='GameApp')fiber=fiber.return;const hooks=[];let h=fiber?.memoizedState;while(h){hooks.push(h.memoizedState);h=h.next;}const naval=hooks.find(v=>v?.fleets);return {date:document.querySelector('.top-bar__date')?.textContent,heading:document.querySelector('[aria-label="Naval construction"] h4')?.textContent,naval:naval?.construction,tail:document.body.textContent.slice(-900)}})()`));
  throw error;
} finally {ws?.close();chrome?.kill();await server.close();}
