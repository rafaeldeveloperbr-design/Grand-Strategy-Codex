import { describe, expect, it } from 'vitest';
import { countries, provincesData } from '../../data/map';
import { createDefaultMarket } from '../market';
import { NAVAL_BUILD_CONFIG, SHIPYARD_UPGRADES } from '../../data/navalConstruction';
import { createNavalUnit } from '../../data/navalUnits';
import { createInitialShipyards, emptyNavalConstruction, navalConstructionAI, processNavalConstructionTick, startNavalConstruction, cancelNavalConstruction } from '../naval/construction';
import { cleanupNavalState, createInitialNavies, navalCombatTick, navalRecoveryTick, portByProvince, seaNodeById, navalMovementTick, orderFleetMove } from '../naval';
import { readNavalSave } from '../naval/saveCompatibility';
import { createGameLoopProfiler } from '../performance/gameLoopProfiler';
import type { NavalState, NavalUnitType } from '../../types/naval';
const port='sa_bra_sao_paulo';
function setup(level=1) {
  const province=structuredClone(provincesData.find(p=>p.id===port)!);province.market=createDefaultMarket();
  province.market.goods.iron.stock=1000;province.market.goods.tools.stock=1000;
  const country=structuredClone(countries.find(c=>c.tag==='BRA')!);country.resources.gold=10000;country.economy.goldIncome=100;country.economy.goldExpense=1;
  const fleets=createInitialNavies(countries,provincesData).filter(f=>f.countryTag==='BRA');
  const naval:NavalState={fleets,battles:[],construction:{...emptyNavalConstruction(),shipyards:[{provinceId:port,level}]}};
  return {naval,provinces:[province],countries:[country]};
}
function order(s=setup(),type:NavalUnitType|'UPGRADE'='DESTROYER',target?:string) {return startNavalConstruction(s.naval,s.provinces,s.countries,'BRA',port,type,-190000,target);}
function finish(s:ReturnType<typeof setup>) {let naval=s.naval;for(let i=0;i<500&&(naval.construction!.builds.length||naval.construction!.upgrades.length);i++)naval=processNavalConstructionTick(naval,s.provinces,s.countries).naval;return naval;}
describe('Shipyard definitions, costs and ownership',()=>{
  it.each([[0,'DESTROYER',false],[1,'DESTROYER',true],[1,'TRANSPORT',true],[1,'CRUISER',false],[2,'CRUISER',true],[2,'BATTLESHIP',false],[3,'BATTLESHIP',true]] as const)('level %s permits %s = %s',(level,type,allowed)=>expect(!order(setup(level),type).error).toBe(allowed));
  it.each(['DESTROYER','TRANSPORT','CRUISER','BATTLESHIP'] as const)('pays exact %s costs from treasury and local stock once',type=>{
    const s=setup(3),result=order(s,type),cost=NAVAL_BUILD_CONFIG[type];
    expect(result.error).toBeNull();expect(result.countries[0].resources.gold).toBe(10000-cost.gold);
    expect(result.provinces[0].market!.goods.iron.stock).toBe(1000-cost.iron);expect(result.provinces[0].market!.goods.tools.stock).toBe(1000-cost.tools);
    expect(s.countries[0].resources.gold).toBe(10000);expect(s.provinces[0].market!.goods.iron.stock).toBe(1000);
  });
  it.each(['gold','iron','tools'] as const)('blocks missing %s atomically',good=>{
    const s=setup();if(good==='gold')s.countries[0].resources.gold=0;else s.provinces[0].market!.goods[good].stock=0;
    const before=structuredClone(s),result=order(s);expect(result.error).toBeTruthy();expect(result.naval).toBe(s.naval);expect(s).toEqual(before);
  });
  it('cannot take stock from another province',()=>{
    const s=setup();s.provinces[0].market!.goods.iron.stock=0;
    s.provinces.push({...structuredClone(s.provinces[0]),id:'other',market:createDefaultMarket()});s.provinces[1].market!.goods.iron.stock=10000;
    expect(order(s).error).toContain('IRON');
  });
  it.each(['foreign','allied','access'])('rejects %s ports regardless of diplomatic permissions',()=>{const s=setup();s.provinces[0].owner='USA';expect(order(s).error).toContain('próprio');});
  it.each(['DESTROYER','UPGRADE'] as const)('rejects inland %s',type=>{
    const s=setup();s.provinces[0].id='sa_bra_mato_grosso';expect(startNavalConstruction(s.naval,s.provinces,s.countries,'BRA',s.provinces[0].id,type,0).error).toContain('porto');
  });
  it('limits each queue to five paid orders',()=>{let s=order();for(let i=1;i<5;i++)s=order(s);const gold=s.countries[0].resources.gold;expect(order(s).error).toContain('cheia');expect(s.countries[0].resources.gold).toBe(gold);});
  it('cancels with zero refund and cannot cancel another country order',()=>{
    const s=order(),id=s.naval.construction!.builds[0].id;
    expect(cancelNavalConstruction(s.naval,id,'USA').construction!.builds).toHaveLength(1);
    expect(cancelNavalConstruction(s.naval,id,'BRA').construction!.builds).toHaveLength(0);
    expect(s.countries[0].resources.gold).toBe(10000-NAVAL_BUILD_CONFIG.DESTROYER.gold);
  });
});
describe('Daily queue, upgrades and delivery',()=>{
  it.each([1,2,3])('level %s advances daily at configured speed',level=>{const s=order(setup(level));expect(processNavalConstructionTick(s.naval,s.provinces,s.countries).naval.construction!.builds[0].progress).toBe([0,1,1.5,2][level]);});
  it('advances only the head per province and never double charges',()=>{
    const first=order(),s=order(first),gold=s.countries[0].resources.gold;
    const result=processNavalConstructionTick(s.naval,s.provinces,s.countries);expect(result.naval.construction!.builds.map(b=>b.progress)).toEqual([1,0]);expect(s.countries[0].resources.gold).toBe(gold);
  });
  it.each([0,1,2])('upgrades %s to next level after configured days',level=>{
    const s=order(setup(level),'UPGRADE'),result=finish(s);expect(result.construction!.shipyards[0].level).toBe(level+1);
    expect(s.countries[0].resources.gold).toBe(10000-SHIPYARD_UPGRADES[level].gold);
  });
  it('blocks upgrade above level 3',()=>expect(order(setup(3),'UPGRADE').error).toContain('máximo'));
  it('pauses existing builds throughout upgrade including completion day',()=>{
    const s=order(order(),'UPGRADE');s.naval.construction!.upgrades[0].progress=s.naval.construction!.upgrades[0].requiredProgress-1;
    const result=processNavalConstructionTick(s.naval,s.provinces,s.countries).naval;
    expect(result.construction!.shipyards[0].level).toBe(2);expect(result.construction!.builds[0].progress).toBe(0);
    expect(processNavalConstructionTick(result,s.provinces,s.countries).naval.construction!.builds[0].progress).toBe(1.5);
  });
  it('blocks new builds during upgrade',()=>expect(order(order(setup(),'UPGRADE')).error).toContain('upgrade'));
  it('completion adds a unit to existing DOCKED fleet and removes the order',()=>{
    const s=order(),result=finish(s);expect(result.fleets).toHaveLength(1);expect(result.fleets[0].units).toHaveLength(s.naval.fleets[0].units.length+1);
    expect(result.fleets[0].units[result.fleets[0].units.length-1].id).toBe('ship-naval-build-1');expect(result.construction!.builds).toHaveLength(0);
  });
  it('creates a new correctly located fleet if no docked fleet exists',()=>{
    const s=setup();s.naval.fleets=[];const result=finish(order(s));expect(result.fleets[0]).toMatchObject({status:'DOCKED',portProvinceId:port});expect(readNavalSave(result)).toEqual(result);
  });
  it('uses targetFleetId ahead of deterministic fallback',()=>{
    const s=setup();s.naval.fleets.push({...structuredClone(s.naval.fleets[0]),id:'target',units:[]});
    const result=finish(order(s,'DESTROYER','target'));expect(result.fleets.find(f=>f.id==='target')!.units).toHaveLength(1);
  });
  it('uses another docked fleet if target has departed',()=>{
    const s=order(setup(),'DESTROYER',setup().naval.fleets[0].id),f=s.naval.fleets[0];
    s.naval.fleets=[{...f,status:'HOLDING',portProvinceId:undefined,locationSeaNodeId:portByProvince.get(port)!.seaNodeId},{...structuredClone(f),id:'fallback'}];
    const result=finish(s);expect(result.fleets[0].units).toHaveLength(f.units.length);expect(result.fleets[1].units).toHaveLength(f.units.length+1);
  });
  it('creates new fleet if every existing fleet has left',()=>{
    const s=order(),f=s.naval.fleets[0];s.naval.fleets=[{...f,status:'HOLDING',portProvinceId:undefined,locationSeaNodeId:portByProvince.get(port)!.seaNodeId}];expect(finish(s).fleets).toHaveLength(2);
  });
  it('new ship immediately uses normal maintenance with no duplicate cost',()=>{
    const s=order(),naval=finish(s),before=navalRecoveryTick(s.naval.fleets,s.countries,s.provinces,[],[]),after=navalRecoveryTick(naval.fleets,s.countries,s.provinces,[],[]);
    expect(before.countries[0].resources.gold-after.countries[0].resources.gold).toBeCloseTo(.12);
  });
  it('can replace a ship sunk by real naval combat without reinforcing a fleet still in COMBAT',()=>{
    const s=setup(),f=s.naval.fleets[0],node=portByProvince.get(port)!.seaNodeId;
    const weak=createNavalUnit('weak','DESTROYER');weak.strength=.01;
    s.naval={...s.naval,fleets:[{...f,portProvinceId:undefined,locationSeaNodeId:node,status:'HOLDING',units:[weak,createNavalUnit('survivor','BATTLESHIP')]},{...f,id:'enemy',countryTag:'USA',portProvinceId:undefined,locationSeaNodeId:node,status:'HOLDING',units:[createNavalUnit('enemy-unit','BATTLESHIP')]}]};
    const war={id:'war',attacker:'BRA',defender:'USA',startDate:{year:1444,month:1,day:1},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]};
    s.naval=navalCombatTick(s.naval,[war],0,s.provinces,[]);expect(s.naval.fleets.find(f=>f.countryTag==='BRA')!.units.some(u=>u.id==='weak')).toBe(false);
    const result=finish(order(s));expect(result.fleets.some(f=>f.countryTag==='BRA'&&f.status==='DOCKED'&&f.units.some(u=>u.id==='ship-naval-build-1'))).toBe(true);
  });
  it('capture cancels builds and upgrades without refund and retains the shipyard',()=>{
    const s=order(order(),'UPGRADE');s.provinces[0].owner='USA';const result=processNavalConstructionTick(s.naval,s.provinces,s.countries).naval;
    expect(result.construction!.builds).toHaveLength(0);expect(result.construction!.upgrades).toHaveLength(0);expect(result.construction!.shipyards[0].level).toBe(1);
    expect(cleanupNavalState(s.naval,s.provinces,[]).construction!.builds).toHaveLength(0);
  });
  it('elimination removes ghost queues',()=>{const s=order();expect(processNavalConstructionTick(s.naval,[],s.countries).naval.construction!.builds).toHaveLength(0);});
  it('repair, movement and combat preserve construction state',()=>{
    const s=order(),node=portByProvince.get(port)!.seaNodeId,neighbor=seaNodeById.get(node)!.neighbors[0];
    const moved=navalMovementTick([orderFleetMove(s.naval.fleets[0],neighbor,'BRA')!],s.provinces,[],[]);expect(moved[0].status).toBe('MOVING');
    expect(navalCombatTick(s.naval,[],0,s.provinces,[]).construction).toEqual(s.naval.construction);
    expect(navalRecoveryTick(s.naval.fleets,s.countries,s.provinces,[],[]).fleets[0].status).toBe('DOCKED');
  });
});
describe('Activation, persistence, IDs and profiling',()=>{
  it('PASSIVE and player start neither builds nor upgrades',()=>{
    const s=setup();expect(navalConstructionAI(s.naval,s.provinces,s.countries,new Set(),'USA',[],0).naval).toBe(s.naval);
    expect(navalConstructionAI(s.naval,s.provinces,s.countries,new Set(['BRA']),'BRA',[],0).naval).toBe(s.naval);
  });
  it('PASSIVE paid build and upgrade continue',()=>{const s=order(order(),'UPGRADE');expect(processNavalConstructionTick(s.naval,s.provinces,s.countries).naval.construction!.upgrades[0].progress).toBe(1);});
  it('FULL AI replaces a missing fleet and pays real resources',()=>{
    const s=setup();s.naval.fleets=[];const r=navalConstructionAI(s.naval,s.provinces,s.countries,new Set(['BRA']),'USA',[],0);
    expect(r.naval.construction!.builds[0].unitType).toBe('DESTROYER');expect(r.countries[0].resources.gold).toBe(9820);
  });
  it('AI is capped and respects reserve/budget',()=>{
    const s=setup(2);s.naval.fleets[0].units=Array.from({length:12},()=>s.naval.fleets[0].units[0]);
    expect(navalConstructionAI(s.naval,s.provinces,s.countries,new Set(['BRA']),'USA',[],0).naval.construction!.builds).toHaveLength(0);
    s.naval.fleets=[];s.countries[0].resources.gold=1100;expect(navalConstructionAI(s.naval,s.provinces,s.countries,new Set(['BRA']),'USA',[],0).naval.construction!.builds).toHaveLength(0);
  });
  it('AI can conservatively upgrade in peace',()=>{const s=setup();expect(navalConstructionAI(s.naval,s.provinces,s.countries,new Set(['BRA']),'USA',[],0).naval.construction!.upgrades).toHaveLength(1);});
  it('AI skips negative operating balances',()=>{const s=setup();s.naval.fleets=[];s.countries[0].economy.goldExpense=101;expect(navalConstructionAI(s.naval,s.provinces,s.countries,new Set(['BRA']),'USA',[],0).naval).toBe(s.naval);});
  it('AI counts paid queues toward wartime cap and does not upgrade during war',()=>{
    const s=setup(2);s.naval.fleets[0].units=Array.from({length:24},()=>s.naval.fleets[0].units[0]);
    const war={id:'war',attacker:'BRA',defender:'USA',startDate:{year:1444,month:1,day:1},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]};
    expect(navalConstructionAI(s.naval,s.provinces,s.countries,new Set(['BRA']),'USA',[war],0).naval.construction!.builds).toHaveLength(0);
    s.naval.construction!.shipyards[0].level=0;expect(navalConstructionAI(s.naval,s.provinces,s.countries,new Set(['BRA']),'USA',[war],0).naval.construction!.upgrades).toHaveLength(0);
  });
  it.each(['USA','GBR','JPN','FRA','ITA','DEU','BRA'])('New Game %s has a functional yard and existing navy',tag=>{
    const initial=createInitialShipyards(countries,provincesData);expect(initial.shipyards.some(s=>provincesData.find(p=>p.id===s.provinceId)?.owner===tag&&s.level>0)).toBe(true);expect(createInitialNavies(countries,provincesData).some(f=>f.countryTag===tag)).toBe(true);
  });
  it('initial yards are deterministic, coastal and fewer than 124',()=>{
    const a=createInitialShipyards(countries,provincesData);expect(a).toEqual(createInitialShipyards(countries,provincesData));expect(a.shipyards.length).toBeLessThan(124);expect(a.shipyards.every(s=>portByProvince.has(s.provinceId))).toBe(true);expect(countries).toHaveLength(201);expect(provincesData).toHaveLength(494);
  });
  it('roundtrip retains progress, target and IDs without charging again',()=>{
    const s=order(setup(),'DESTROYER',setup().naval.fleets[0].id),naval=processNavalConstructionTick(s.naval,s.provinces,s.countries).naval;
    const loaded=readNavalSave(JSON.parse(JSON.stringify(naval)));expect(loaded).toEqual(naval);expect(s.countries[0].resources.gold).toBe(9820);
    expect(order({...s,naval:loaded}).naval.construction!.builds.map(b=>b.id)).toEqual(['naval-build-1','naval-build-2']);
  });
  it('completed ships are not recreated after load and IDs survive cancellation',()=>{
    const s=order(),completed=finish(s),loaded=readNavalSave(completed);expect(processNavalConstructionTick(loaded,s.provinces,s.countries).naval.fleets).toEqual(completed.fleets);
    const cancelled=cancelNavalConstruction(s.naval,'naval-build-1','BRA');expect(order({...s,naval:cancelled}).naval.construction!.builds[0].id).toBe('naval-build-2');
  });
  it('legacy naval saves remain unchanged without initial-yard respawn',()=>{const state={fleets:[],battles:[]};expect(readNavalSave(state)).toEqual(state);});
  it.each(['nextId','inland','level','duplicate','progress','unit'])('rejects corrupted %s at save boundary',kind=>{
    const s=order().naval;const c=s.construction!;
    if(kind==='nextId')c.nextId=1;if(kind==='inland')c.shipyards[0].provinceId='inland';if(kind==='level')c.shipyards[0].level=4;if(kind==='duplicate')c.builds.push({...c.builds[0]});if(kind==='progress')c.builds[0].progress=-1;if(kind==='unit')Object.assign(c.builds[0],{unitType:'SUBMARINE'});
    expect(()=>readNavalSave(s)).toThrow();
  });
  it('ticks are deterministic and do not mutate inputs',()=>{const s=order(),before=structuredClone(s);expect(processNavalConstructionTick(s.naval,s.provinces,s.countries)).toEqual(processNavalConstructionTick(s.naval,s.provinces,s.countries));expect(s).toEqual(before);});
  it('aggregates construction counters and resets report window',()=>{
    const reports: {navalConstruction:{completedShips:number}}[]=[];let time=0;
    const profiler=createGameLoopProfiler(true,{now:()=>time,reportEvery:2,report:r=>reports.push(r)});
    for(let i=0;i<4;i++){profiler.begin();profiler.recordNavalConstruction({activeNavalBuilds:1,queuedNavalBuilds:2,completedShips:1,shipyardUpgrades:1});time++;profiler.endPhase('navalConstruction');profiler.finish(3,100);}
    expect(reports[0].navalConstruction.completedShips).toBe(2);
    expect(reports[1].navalConstruction.completedShips).toBe(2);
  });
});
