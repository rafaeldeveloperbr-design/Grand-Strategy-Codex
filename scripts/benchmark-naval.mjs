import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
const samples=Number(process.argv.find(a=>a.startsWith('--samples='))?.split('=')[1]??20);
if(!Number.isInteger(samples)||samples<1) throw new Error('Invalid samples');
const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
  const {countries,provincesData:provinces}=await server.ssrLoadModule('/src/data/map/index.ts');
  const naval=await server.ssrLoadModule('/src/engine/naval/index.ts');
  const {buildSimulationActivation}=await server.ssrLoadModule('/src/engine/simulationActivation.ts');
  const initial=naval.createInitialNavies(countries,provinces), byCountry=new Map(initial.map(f=>[f.countryTag,f]));
  const war=(a,b)=>({id:`${a}-${b}`,attacker:a,defender:b,startDate:{year:1444,month:1,day:1},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]});
  const results={environment:{node:process.version,cpu:cpus()[0]?.model,samples,warmups:3,measurement:'Node/Vite SSR independent cloned one-day states. Not browser rendering or scheduler latency.'},world:{countries:countries.length,provinces:provinces.length,nodes:naval.seaNodes.length,edges:naval.seaEdges.length,ports:naval.navalPorts.length,initialFleets:initial.length,initialShips:initial.reduce((s,f)=>s+f.units.length,0)},scenarios:{}};
  for(const scenario of ['peace','wars','moving','battles']) {
    const wars=scenario==='peace'?[]:[war('GBR','USA'),war('JPN','AUS'),war('BRA','ARG'),war('FRA','ITA')];
    let fleets=structuredClone(initial);
    if(scenario==='moving') fleets=fleets.map((f,i)=>naval.orderFleetMove(f,naval.seaNodes[(i*29)%naval.seaNodes.length].id,f.countryTag)??f);
    if(scenario==='battles') for(const [i,w] of wars.entries()) {const a=fleets.find(f=>f.countryTag===w.attacker),b=fleets.find(f=>f.countryTag===w.defender);const home=naval.portByProvince.get(a.portProvinceId);for(const f of [a,b]) {f.portProvinceId=undefined;f.locationSeaNodeId=home.seaNodeId;f.status='HOLDING';} if(i<0) throw new Error('unreachable');}
    const activation=buildSimulationActivation({countries,provinces,armies:[],wars,relations:[],playerCountryTag:'BRA'});
    const values={navalAI:[],navalMovement:[],navalCombat:[],pathfinding:[],totalNaval:[]};let counters;
    for(let i=-3;i<samples;i++) {
      naval.resetNavalPathfindCalls();const input=structuredClone(fleets), start=performance.now();
      const ai=naval.navalAITick(input,activation.fullCountryTags,'BRA',provinces,[],wars), afterAI=performance.now();
      const moving=naval.navalMovementTick(ai.fleets,provinces,[],wars), afterMove=performance.now();
      const combat=naval.navalCombatTick({fleets:moving,battles:[]},wars,1,provinces,[]);
      naval.navalRecoveryTick(combat.fleets,countries,provinces,[],wars);const afterCombat=performance.now();
      const calls=naval.getNavalPathfindCalls();
      naval.findSeaRoute(naval.portByProvince.get(byCountry.get('JPN').portProvinceId).seaNodeId,naval.portByProvince.get('na_usa_california').seaNodeId);const afterPath=performance.now();
      if(i>=0) {values.navalAI.push(afterAI-start);values.navalMovement.push(afterMove-afterAI);values.navalCombat.push(afterCombat-afterMove);values.pathfinding.push(afterPath-afterCombat);values.totalNaval.push(afterCombat-start);}
      counters={fullCountries:activation.fullCountryTags.size,navalAIBots:ai.bots,movingFleets:moving.filter(f=>f.status==='MOVING'||f.status==='RETREATING').length,activeNavalBattles:combat.battles.filter(b=>b.status==='ACTIVE').length,pathfindCalls:calls};
    }
    results.scenarios[scenario]={...counters,phases:Object.fromEntries(Object.entries(values).map(([phase,values])=>[phase,{medianMs:[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)],maxMs:Math.max(...values),samples:values}]))};
  }
  await writeFile('artifacts/naval-warfare-v1-benchmark.json',JSON.stringify(results,null,2));
  console.log(JSON.stringify({world:results.world,scenarios:Object.fromEntries(Object.entries(results.scenarios).map(([name,s])=>[name,{...s,phases:Object.fromEntries(Object.entries(s.phases).map(([p,v])=>[p,{medianMs:+v.medianMs.toFixed(3),maxMs:+v.maxMs.toFixed(3)}]))}]))},null,2));
} finally {await server.close();}
