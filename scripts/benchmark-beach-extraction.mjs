import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
const server = await createServer({ server: { hmr: false }, logLevel: 'error' });
try {
  const { countries, provincesData } = await server.ssrLoadModule('/src/data/map/index.ts');
  const { createInitialNavies, resolveAmphibiousLandingSeaNode, beachExtractionTick } = await server.ssrLoadModule('/src/engine/naval/index.ts');
  const fleet = createInitialNavies(countries, provincesData).find(f=>f.countryTag==='BRA');
  const provinceId='sa_arg_restored_1', nodeId=resolveAmphibiousLandingSeaNode(provinceId).id;
  const provinces=provincesData.map(p=>p.id===provinceId?{...p,owner:'BRA'}:p);
  function stats(fn) {
    for(let i=0;i<30;i++)fn();
    const samples=[];
    for(let i=0;i<200;i++){const start=performance.now();fn();samples.push(performance.now()-start);}
    samples.sort((a,b)=>a-b);
    return { samples:samples.length,medianMs:samples[100],p95Ms:samples[190],meanMs:samples.reduce((a,b)=>a+b,0)/samples.length };
  }
  const cases=[];
  for(const [count,totalFleets] of [[0,1000],[20,20],[50,50],[20,1000]]) {
    const fleets=Array.from({length:totalFleets},(_,i)=>({...fleet,id:`extraction-fleet-${i}`,portProvinceId:undefined,locationSeaNodeId:nodeId,status:'HOLDING',route:[],movementProgress:0}));
    const armies=Array.from({length:count},(_,i)=>({id:`extraction-army-${i}`,owner:'BRA',name:`Army ${i}`,location:provinceId,destination:null,targetDestination:null,path:[],position:null,movementProgress:0,movementSpeed:1,regiments:[{type:'infantry',strength:3600,morale:100,organization:100}],beachExtraction:{fleetId:fleets[i].id,provinceId,seaNodeId:nodeId,elapsedDays:2}}));
    const ctx={armies,naval:{fleets,battles:[]},provinces,wars:[],relations:[]};
    const completing={...ctx,armies:armies.map(a=>({...a,beachExtraction:{...a.beachExtraction,elapsedDays:4}}))};
    cases.push({activeExtractions:count,totalFleets,tick:stats(()=>beachExtractionTick(ctx)),cleanup:stats(()=>beachExtractionTick(ctx,new Set(),false)),completion:stats(()=>beachExtractionTick(completing)),destroyedFleetCancellation:stats(()=>beachExtractionTick({...ctx,naval:{fleets:[],battles:[]}}))});
  }
  const report={environment:{node:process.version,platform:process.platform},provinces:provinces.length,cases};
  await writeFile('artifacts/amphibious-v1.2-benchmark.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await server.close(); }
