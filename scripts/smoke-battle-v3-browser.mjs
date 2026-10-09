// Public save/load fixtures in a disposable headless Chrome profile.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const profile=await mkdtemp(join(tmpdir(),'battle-v3-smoke-'));
const server=await createServer({server:{host:'127.0.0.1',port:3016,strictPort:true,hmr:false},logLevel:'error'});
let chrome,ws,sequence=0;const pending=new Map(),errors=[];
try {
  await mkdir('artifacts',{recursive:true});await server.listen();
  chrome=spawn(process.env.BATTLE_CHROME_PATH??'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9338',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let pages;
  for(let i=0;i<60;i++){try{pages=await(await fetch('http://127.0.0.1:9338/json/list')).json();if(pages.some(p=>p.type==='page'))break;}catch{}await delay(250);}
  const target=pages?.find(p=>p.type==='page');if(!target)throw new Error('Chrome debugger unavailable');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.reject(new Error(m.error.message));else p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let i=0;i<200;i++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw new Error(`Timed out: ${expression}`);};
  const waitUntil=async predicate=>{for(let i=0;i<300;i++){if(await predicate())return;await delay(100);}throw new Error('Timed out waiting for fixture completion');};
  const click=async selector=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw new Error('Missing: '+${JSON.stringify(selector)});e.click();})()`);await delay(150);};
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const current=()=>evaluate(`(()=>{let f=document.querySelector('.game')?.[Object.keys(document.querySelector('.game')??{}).find(k=>k.startsWith('__reactFiber'))];while(f?.return)f=f.return;const queue=[f?.stateNode?.current??f];while(queue.length){const candidate=queue.pop();if(candidate?.type?.name==='GameApp'){f=candidate;break;}if(candidate?.sibling)queue.push(candidate.sibling);if(candidate?.child)queue.push(candidate.child);}const hooks=[];let h=f?.memoizedState;while(h){hooks.push(h.memoizedState);h=h.next;}return {naval:hooks.find(v=>v?.fleets&&v?.battles),battles:hooks.find(v=>Array.isArray(v)&&v[0]?.participantArmyIds)??[],history:hooks.find(v=>Array.isArray(v)&&v[0]?.attackerOriginal)??[],armies:hooks.find(v=>Array.isArray(v)&&v[0]?.regiments)??[],date:document.querySelector('.top-bar__date')?.textContent};})()`);
  await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:'http://127.0.0.1:3016/?newgame=1'});await waitFor(`document.querySelector('.country-selection__list button')`);
  await evaluate(`([...document.querySelectorAll('button')].find(b=>b.textContent==='Brasil')).click()`);await click('.country-selection__play');await waitFor(`document.querySelector('.game')`);
  await click('[title^="Configura"]');await click('.settings-modal__btn--primary');
  let key=await evaluate(`Object.keys(localStorage).find(k=>k.startsWith('imperium_save_')&&k!=='imperium_save_autosave')`);
  assert(key,'Missing base save');const base=await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}))`);
  const {startContinuousBattle}=await server.ssrLoadModule('/src/engine/combat/index.ts');
  const {embarkArmy,planInvasion,portByProvince}=await server.ssrLoadModule('/src/engine/naval/index.ts');
  const {createNavalUnit}=await server.ssrLoadModule('/src/data/navalUnits.ts');
  const {airZoneByProvinceId,assignAirMission}=await server.ssrLoadModule('/src/engine/air/index.ts');
  const front=base.world.provinces.find(p=>p.owner==='ARG'&&p.neighbors.some(id=>base.world.provinces.find(q=>q.id===id)?.owner==='BRA'));
  assert(front,'Missing BRA/ARG border');
  const checks=[];
  const loadFixture=async saved=>{
    saved.id=key.replace('imperium_save_','');saved.name='Battle V3';await evaluate(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(JSON.stringify(saved))})`);
    if(await evaluate(`!!document.querySelector('.settings-modal')`))await click('.settings-modal__close');
    await click('[title^="Configura"]');
    await click('.settings-modal__btn--small:not(.settings-modal__btn--danger)');await delay(200);if(await evaluate(`!!document.querySelector('.settings-modal')`))throw new Error(await evaluate(`([...document.querySelectorAll('.toast-message')].map(e=>e.textContent)).join('; ')`));
  };
  for(const name of (process.argv.length>2?process.argv.slice(2):['plain','mountains','fortress','air','reinforcement','annihilation','amphibious'])) {
    let expectedId=`browser-${name}`;
    const saved=structuredClone(base),province=saved.world.provinces.find(p=>name==='amphibious'?p.owner==='ARG'&&portByProvince.has(p.id):p.id===front.id);
    province.terrain=name==='mountains'?'mountains':'plains';province.defense=name==='fortress'?5:0;province.buildings=name==='fortress'?[{type:'fortress',level:5,daysRemaining:0}]:[];
    const own=structuredClone(saved.military.armies.find(a=>a.owner==='BRA')),enemy=structuredClone(saved.military.armies.find(a=>a.owner==='ARG'));
    const braHome=saved.world.provinces.find(p=>p.owner==='BRA'&&province.neighbors.includes(p.id))?.id ?? saved.world.provinces.find(p=>p.owner==='BRA').id,argHome=saved.world.provinces.find(p=>p.owner==='ARG'&&province.neighbors.includes(p.id))?.id ?? saved.world.provinces.find(p=>p.owner==='ARG'&&p.id!==province.id).id;
    // Preserve the real land graph; only the encirclement fixture removes escape routes.
    if(name==='annihilation')province.neighbors=[];
    for(const a of [own,enemy]) {a.location=province.id;a.inCombat=true;a.destination=null;a.targetDestination=null;a.path=[];a.movementPlan=undefined;a.position=null;a.movementProgress=0;a.regiments=Array.from({length:10},()=>({type:'infantry',strength:1000,maxStrength:1000,morale:100,organization:name==='annihilation'&&a.owner==='ARG'?1:100,originProvinceId:a.owner==='BRA'?braHome:argHome}));}
    saved.military.armies=[own,enemy];
    saved.military.wars=[{id:'battle-smoke-war',attacker:'BRA',defender:'ARG',startDate:saved.date,warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]}];
    saved.military.activeBattles=[startContinuousBattle([own],[enemy],province,saved.date,`browser-${name}`)];
    saved.air.wings=saved.air.wings.map(w=>({...w,mission:undefined,assignedAirZoneId:undefined,status:'READY'}));
    if(name==='air') {
      const ctx={provinces:saved.world.provinces,countries:saved.world.countries,armies:saved.military.armies,wars:saved.military.wars,relations:[]};
      saved.air.wings=saved.air.wings.map(w=>w.countryTag==='BRA'&&['FIGHTER','CAS'].includes(w.type)?assignAirMission(w,w.type==='FIGHTER'?'AIR_SUPERIORITY':'CLOSE_AIR_SUPPORT',airZoneByProvinceId.get(province.id).id,ctx)??w:w);
    }
    if(name==='reinforcement') {const extra={...structuredClone(own),id:'browser-reinforcement',name:'Reinforcement',inCombat:false};saved.military.armies.push(extra);}
    if(name==='amphibious') {
      const fleet=saved.naval.fleets.find(f=>f.countryTag==='BRA');
      fleet.units.push(...Array.from({length:10},(_,i)=>createNavalUnit(`fixture-transport-${i}`,'TRANSPORT')));
      own.location=fleet.portProvinceId;own.inCombat=false;enemy.inCombat=false;
      saved.military.activeBattles=[];saved.naval={fleets:[fleet],battles:[],invasions:[]};
      const ctx={armies:saved.military.armies,naval:saved.naval,provinces:saved.world.provinces,wars:saved.military.wars,relations:[],actor:'BRA'};
      const embarked=embarkArmy(ctx,own.id,fleet.id);assert(!embarked.error,embarked.error);ctx.armies=embarked.armies;
      const planned=planInvasion(ctx,fleet.id,[own.id],province.id);assert(!planned.error,planned.error);saved.naval=planned.naval;saved.military.armies=embarked.armies;
      saved.naval.fleets[0]={...saved.naval.fleets[0],portProvinceId:undefined,locationSeaNodeId:portByProvince.get(province.id).seaNodeId,status:'HOLDING',route:[],movementProgress:0,destinationPortId:undefined,destinationSeaNodeId:undefined};
    }
    await loadFixture(saved);
    if(name==='amphibious') {await click('[title="Velocidade 3"]');await waitUntil(async()=> (await current()).battles.some(b=>b.provinceId===province.id));await click('[title="Pausar"]');expectedId=(await current()).battles.find(b=>b.provinceId===province.id).id;}

    await click('.active-battle-panel summary');
    assert(await evaluate(`document.querySelector('.active-battle-panel').textContent.includes(${JSON.stringify(name==='amphibious'?'tropas':'10000 tropas')})`),`Missing aggregate force: ${name}`);
    await click('[title="Velocidade 3"]');
    if(name==='annihilation') await waitUntil(async()=> (await current()).history.some(b=>b.id===expectedId));
    else {await waitFor(`document.querySelector('.active-battle-panel summary')?.textContent.match(/ [3-9] dias/)`);await click('[title="Pausar"]');const state=await current();assert(state.battles.length===1&&state.battles[0].durationDays>=3,'Normal combat ended in 1–2 days');
      if(name==='reinforcement')assert(state.battles[0].participantArmyIds.length===3,'Reinforcement failed');
      if(name==='plain') {
        await click('[title^="Configura"]');await evaluate(`localStorage.removeItem(${JSON.stringify(key)})`);await click('.settings-modal__btn--primary');
        const savedKey=await evaluate(`Object.keys(localStorage).find(k=>k.startsWith('imperium_save_')&&k!=='imperium_save_autosave')`);
        const mid=await evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(savedKey)}))`);assert(mid.military.activeBattles[0].durationDays>=3,'Missing mid-battle state');
        await click('.settings-modal__btn--small');assert((await current()).battles.length===1,'Duplicate on load');
        // Keep using the original slot for subsequent fixtures.
        key=savedKey;
        const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/battle-v3-active-browser.png',Buffer.from(shot.data,'base64'));
        checks.push('mid-battle save/load retains one battle and elapsed days');
      }
      await click('[title="Velocidade 3"]');await waitUntil(async()=> (await current()).history.some(b=>b.id===expectedId));
    }
    if(await evaluate(`!!document.querySelector('[title="Pausar"]')`))await click('[title="Pausar"]');
    const ended=await current();const results=ended.history.filter(b=>b.id===expectedId);assert(!ended.battles.some(b=>b.id===expectedId),'Zombie active battle');assert(results.length===1,'Non-unique history');const result=results[0];
    await click('.game__bottom-history-btn');await evaluate(`document.querySelectorAll('.battle-history-item')[${ended.history.findIndex(b=>b.id===expectedId)}].click()`);await waitFor(`document.querySelector('.battle-report-modal')`);
    await delay(500);const text=await evaluate(`document.querySelector('.battle-report-modal').textContent`);assert(text.includes('Baixas BRA:')&&text.includes('Baixas ARG:'),'Report lacks country losses');
    if(name==='annihilation')assert(result.endReason==='no_retreat','Missing annihilation reason');
    checks.push({name,duration:result.duration,reason:result.endReason,casualties:[result.attackerCasualties,result.defenderCasualties]});
    const shot=await call('Page.captureScreenshot',{format:'png'});await writeFile(`artifacts/battle-v3-${name}-browser.png`,Buffer.from(shot.data,'base64'));
    await click('.battle-report-close-btn');
  }
  assert(errors.length===0,'Browser exceptions');const report={browser:'Chrome headless CDP',checks,errors};await writeFile('artifacts/battle-v3-browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{ws?.close();chrome?.kill();await server.close();}
