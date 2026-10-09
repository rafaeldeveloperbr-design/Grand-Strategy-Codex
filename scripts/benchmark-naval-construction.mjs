import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
const server=await createServer({server:{hmr:false},logLevel:'error'});
try {
  const {countries,provincesData}=await server.ssrLoadModule('/src/data/map/index.ts');
  const {createDefaultMarket}=await server.ssrLoadModule('/src/engine/market.ts');
  const {navalPorts,createInitialNavies,resetNavalPathfindCalls,getNavalPathfindCalls}=await server.ssrLoadModule('/src/engine/naval/index.ts');
  const {createInitialShipyards,emptyNavalConstruction,startNavalConstruction,processNavalConstructionTick,navalConstructionAI}=await server.ssrLoadModule('/src/engine/naval/construction.ts');
  const nations=structuredClone(countries),provinces=structuredClone(provincesData);
  for(const c of nations){c.resources.gold=100000;c.economy.goldIncome=100;c.economy.goldExpense=1;}
  for(const p of provinces){p.market=createDefaultMarket();p.market.goods.iron.stock=10000;p.market.goods.tools.stock=10000;}
  const full=new Set(nations.map(c=>c.tag));
  const stats=fn=>{for(let i=0;i<20;i++)fn();const times=[];for(let i=0;i<100;i++){const begin=performance.now();fn();times.push(performance.now()-begin);}times.sort((a,b)=>a-b);return {samples:times.length,medianMs:times[50],p95Ms:times[95],meanMs:times.reduce((a,b)=>a+b,0)/times.length};};
  const initial=createInitialShipyards(countries,provincesData);
  const report={initialShipyards:{total:initial.shipyards.length,levels:[1,2,3].map(level=>({level,count:initial.shipyards.filter(s=>s.level===level).length})),brazil:initial.shipyards.filter(s=>provincesData.find(p=>p.id===s.provinceId)?.owner==='BRA')},environment:{node:process.version,platform:process.platform},cases:[]};
  for(const count of [0,20,50,100]) {
    let s={naval:{fleets:createInitialNavies(nations,provinces),battles:[],construction:{...emptyNavalConstruction(),shipyards:navalPorts.map(p=>({provinceId:p.provinceId,level:1}))}},provinces,nations};
    for(let i=0;i<count;i++) {
      const port=navalPorts[Math.floor(i/5)],actor=provinces.find(p=>p.id===port.provinceId).owner;
      const next=startNavalConstruction(s.naval,s.provinces,s.nations,actor,port.provinceId,'DESTROYER',0);
      if(next.error)throw new Error(next.error);s={naval:next.naval,provinces:next.provinces,nations:next.countries};
    }
    resetNavalPathfindCalls();
    const constructionTick=stats(()=>processNavalConstructionTick(s.naval,s.provinces,s.nations));
    const aiDecisions=stats(()=>navalConstructionAI(s.naval,s.provinces,s.nations,full,'BRA',[],0));
    report.cases.push({queuedBuilds:count,activePorts:Math.ceil(count/5),constructionTick,aiDecisions,pathfindCalls:getNavalPathfindCalls()});
  }
  await writeFile('artifacts/naval-construction-v1-1-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await server.close();}
