// Offline authoring benchmark against the preserved Step 3A region rosters.
// Run: node tools/map/benchmark_world.mjs. No runtime dependency or thresholds.
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
try {
  const map=await server.ssrLoadModule('/src/data/map/index.ts');
  const initial=await server.ssrLoadModule('/src/data/map/initialState.ts');
  const diplomacy=await server.ssrLoadModule('/src/engine/diplomacy/index.ts');
  const logistics=await server.ssrLoadModule('/src/engine/logistics/index.ts');
  const economy=await server.ssrLoadModule('/src/hooks/gameLoop/economyTick.ts');
  const movement=await server.ssrLoadModule('/src/hooks/gameLoop/movementTick.ts');
  const ai=await server.ssrLoadModule('/src/engine/aiEngine/aiMovement.ts');
  const tech=await server.ssrLoadModule('/src/engine/technology.ts');
  const gameMap=await server.ssrLoadModule('/src/components/GameMap/GameMap.tsx');
  const regions=[];
  for(const id of ['southAmerica','northAmerica','europe','africa','asia','oceania'])regions.push((await server.ssrLoadModule(`/src/data/map/regions/${id}/index.ts`))[id]);
  const baseline=map.assembleMap(regions,(await server.ssrLoadModule('/src/data/map/crossRegionConnections.ts')).crossRegionConnections);
  const noop=()=>{};
  const samples=(fn,count=10)=>{
    fn();fn();fn();const times=[];
    for(let i=0;i<count;i++){const start=performance.now();fn();times.push(performance.now()-start);}
    times.sort((a,b)=>a-b);return Number(times[Math.floor(times.length/2)].toFixed(3));
  };
  for(const [name,world] of [['Step3A',baseline],['Step3B',map]]) {
    const countries=world.countries,provinces=world.provincesData;
    const relations=diplomacy.createInitialDiplomacy(countries,provinces);
    const armies=initial.createInitialArmies(countries);
    const technologies=new Map(countries.map(c=>[c.tag,tech.createInitialTechState(c.tag)]));
    const ctx={countries,provinces,relations,armies,wars:[],date:{year:1444,month:11,day:11},recruitments:[],buildingConstructions:[],allCountries:countries,playerCountryTag:'BRA',playerTechState:technologies.get('BRA'),botTechStates:technologies,addToast:noop,addAILog:noop,addLog:noop,formatGameDate:()=>''};
    const snapshot=logistics.buildLogisticsNetworks(ctx);
    const measured={countries:countries.length,provinces:provinces.length,relations:relations.length,
      diplomacyInitMs:samples(()=>diplomacy.createInitialDiplomacy(countries,provinces)),
      declareWarMs:samples(()=>diplomacy.declareWar(ctx,'BRA','ARG')),
      logisticsAllMs:samples(()=>logistics.buildLogisticsNetworks(ctx)),
      logisticsTwoMs:samples(()=>logistics.buildLogisticsNetworks({...ctx,countries:countries.filter(c=>['BRA','ARG'].includes(c.tag))})),
      economyTickMs:samples(()=>economy.processEconomyTick(ctx)),
      economy30TicksMs:samples(()=>{
        let state={countries,provinces};
        for(let n=0;n<30;n++){const date=new Date(Date.UTC(1444,10,11+n));const tick=economy.processEconomyTick({...ctx,...state,allCountries:state.countries,date:{year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()}});state={countries:tick.countries,provinces:tick.provinces};}
      },1),
      movementTickMs:samples(()=>movement.processMovementTick(ctx)),
      aiAllMs:samples(()=>countries.forEach(c=>ai.processAI(c.tag,armies,provinces,relations,[],countries,snapshot))),
      svgServerRenderMs:samples(()=>renderToString(React.createElement(gameMap.GameMap,{provinces,countries,armies:[],recruitments:[],buildingConstructions:[],activeBattles:[],selectedProvince:null,hoveredProvince:null,selectedArmy:null,onProvinceHover:noop,onProvinceClick:noop,onArmyClick:noop,onProvinceRightClick:noop}))),
    };
    console.log(JSON.stringify({name,...measured}));
  }
}finally{await server.close();}

