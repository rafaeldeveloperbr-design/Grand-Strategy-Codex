import {createServer} from 'vite';
import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
const samples=Number(process.argv.find(a=>a.startsWith('--samples='))?.split('=')[1]??30);
if(!Number.isInteger(samples)||samples<1)throw new Error('Invalid samples');
const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
  const {countries,provincesData:provinces}=await server.ssrLoadModule('/src/data/map/index.ts');
  const air=await server.ssrLoadModule('/src/engine/air/index.ts');
  const initial=air.createInitialAirState(countries,provinces);
  const war=(attacker,defender,i)=>({id:`bench-${i}`,attacker,defender,startDate:{year:1444,month:11,day:11},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]});
  const wars=[war('BRA','ARG',1),war('USA','CAN',2),war('FRA','DEU',3),war('CHN','IND',4)];
  const ctx={countries,provinces,wars,relations:[]};
  const full=new Set(countries.map(c=>c.tag));
  const active=initial.wings.map(w=>air.assignAirMission(w,w.type==='FIGHTER'?'AIR_SUPERIORITY':w.type==='CAS'?'CLOSE_AIR_SUPPORT':'BOMBING',air.airZoneByProvinceId.get(w.baseProvinceId).id,ctx)??w);
  const disputed=active.map(w=>{const opponent=wars.find(war=>war.defender===w.countryTag);const enemy=opponent&&active.find(e=>e.countryTag===opponent.attacker);const zone=enemy?.assignedAirZoneId;return zone?air.assignAirMission(w,w.mission,zone,ctx)??w:w;});
  const hundred=Array.from({length:100},(_,i)=>({...disputed[i%disputed.length],id:`hundred-${i}`}));
  const cases=[['zero',{wings:[],engagements:[]},[]],['initial-peace',initial,[]],['some-wars',{wings:active,engagements:[]},wars.slice(0,2)],['disputed-zones',{wings:disputed,engagements:[]},wars],['100-wings',{wings:hundred,engagements:[]},wars],['CAS-and-bombing',{wings:disputed.filter(w=>w.type!=='TRANSPORT_PLANE'),engagements:[]},wars]];
  const results=[];
  for(const [name,state,caseWars] of cases) {
    const context={...ctx,wars:caseWars};const times={airAI:[],airCombat:[],airMissions:[],range:[]};
    const battles=caseWars.flatMap(war=>{const cas=state.wings.find(w=>w.countryTag===war.attacker&&w.type==='CAS'&&w.assignedAirZoneId);const zone=cas&&air.airZoneById.get(cas.assignedAirZoneId);return zone?[{id:`land-${war.id}`,provinceId:zone.provinceIds[0],attackerCountryId:war.attacker,defenderCountryId:war.defender}]:[];});
    for(let i=0;i<samples+5;i++) {
      let start=performance.now();const ai=air.airAITick(state,full,'BRA',context,battles);const a=performance.now()-start;
      start=performance.now();const fought=air.airCombatTick(state,context, 0);const c=performance.now()-start;
      start=performance.now();air.airMissionsTick(fought,context);for(const battle of battles)air.getAirSupportForBattle(fought,battle,battle.attackerCountryId,context);const m=performance.now()-start;
      start=performance.now();for(const w of state.wings)for(const z of air.airZones)air.isAirZoneInRange(w,z.id,provinces);const r=performance.now()-start;
      if(i>=5){times.airAI.push(a);times.airCombat.push(c);times.airMissions.push(m);times.range.push(r);}void ai;
    }
    results.push({name,wings:state.wings.length,engagements:air.airCombatTick(state,context, 0).engagements.length,landBattles:battles.length,rangeChecks:state.wings.length*air.airZones.length,phases:Object.fromEntries(Object.entries(times).map(([key,values])=>[key,{averageMs:values.reduce((s,v)=>s+v,0)/values.length,maxMs:Math.max(...values)}]))});
  }
  const report={samples,world:{countries:countries.length,provinces:provinces.length,zones:air.airZones.length,bases:air.airBases.length,initialWings:initial.wings.length,countriesWithWings:new Set(initial.wings.map(w=>w.countryTag)).size},results};
  await writeFile('artifacts/air-warfare-v1-benchmark.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await server.close();}
