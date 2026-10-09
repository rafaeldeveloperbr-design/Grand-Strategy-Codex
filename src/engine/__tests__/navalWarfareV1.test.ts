import { describe, expect, it } from 'vitest';
import { countries, provincesData, mapMetadata } from '../../data/map';
import { createNavalUnit, NAVAL_UNIT_STATS } from '../../data/navalUnits';
import type { Fleet, NavalState, NavalUnitType } from '../../types/naval';
import type { War, DiplomaticRelation } from '../../types/diplomacy';
import { buildSimulationActivation } from '../simulationActivation';
import { createGameLoopProfiler } from '../performance/gameLoopProfiler';
import { readNavalSave } from '../naval/saveCompatibility';
import { diplomacyDay } from '../diplomacy/diplomacyRelations';
import { cleanupNavalState } from '../naval';
import { buildNavalPresence, buildNavalHostility, buildNavalIndexes, canUseNavalPort, cancelNavalOrder, createInitialNavies, findSeaRoute, fleetPosition, fleetSpeed, getCoastalProvinces, isCoastalProvince, navalAITick, navalCombatTick, navalMovementTick, navalPorts, navalRecoveryTick, orderFleetMove, orderFleetReturn, portByProvince, seaEdges, seaNodeById, seaNodes, seaRouteDistance, validateSeaGraph } from '../naval';
const initial = createInitialNavies(countries,provincesData);
const brazil = () => structuredClone(initial.find(f=>f.countryTag==='BRA')!);
const port = (tag:string) => navalPorts.find(p=>provincesData.find(v=>v.id===p.provinceId)?.owner===tag)!;
const node = port('BRA').seaNodeId;
const fleet = (tag='BRA',id=tag,types:NavalUnitType[]=['CRUISER']):Fleet => ({id,name:id,countryTag:tag,units:types.map((t,i)=>createNavalUnit(`${id}-${i}`,t)),locationSeaNodeId:node,route:[],movementProgress:0,status:'HOLDING'});
const war = (a='BRA',b='ARG'):War => ({id:`${a}-${b}`,attacker:a,defender:b,startDate:{year:1444,month:1,day:1},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]});
const relation = (access=false):DiplomaticRelation => ({countryA:'BRA',countryB:'ARG',opinion:0,trust:0,status:'peace',...(access?{militaryAccess:['ARG']}:{alliance:{since:0}})});
const combat=(fleets:Fleet[],wars:War[]=[war()],day=1,state?:NavalState) => navalCombatTick(state??{fleets,battles:[]},wars,day,provincesData,[]);
const move=(f:Fleet,wars:War[]=[])=>navalMovementTick([f],provincesData,[],wars)[0];

describe('Naval entities, ports and world',()=>{
  it.each(['USA','GBR','JPN','FRA','ITA','DEU','BRA'])('creates initial navy for %s',tag=>{const f=initial.find(f=>f.countryTag===tag)!;expect(f).toBeDefined();expect(f.units.length).toBeGreaterThan(0);expect(f.status).toBe('DOCKED');expect(portByProvince.has(f.portProvinceId!)).toBe(true);});
  it.each(['DESTROYER','CRUISER','BATTLESHIP','TRANSPORT'] as const)('centralizes %s stats',type=>{const u=createNavalUnit('unit',type);expect(u).toMatchObject({type,strength:100,organization:100,attack:NAVAL_UNIT_STATS[type].attack,defense:NAVAL_UNIT_STATS[type].defense,speed:NAVAL_UNIT_STATS[type].speed});});
  it('uses slowest ship speed',()=>expect(fleetSpeed(fleet('BRA','f',['DESTROYER','BATTLESHIP']))).toBe(18));
  it('does not create navies for inland microstates',()=>{for(const tag of ['AND','SMR','VAT','LIE','LUX']) expect(initial.some(f=>f.countryTag===tag)).toBe(false);});
  it('keeps inland provinces outside the port network',()=>{const inland=provincesData.find(p=>p.id==='sa_bra_mato_grosso')!;expect(inland).toBeDefined();expect(portByProvince.has(inland.id)).toBe(false);expect(isCoastalProvince(inland)).toBe(false);});
  it('indexes coastal metadata centrally',()=>expect(getCoastalProvinces(provincesData).every(p=>isCoastalProvince(p.id))).toBe(true));
  it('all ports have coastal metadata and valid ocean links',()=>{for(const p of navalPorts) {expect(isCoastalProvince(p.provinceId)).toBe(true);expect(seaNodeById.has(p.seaNodeId)).toBe(true);expect(provincesData.some(v=>v.id===p.provinceId)).toBe(true);}});
  it('validates graph',()=>expect(validateSeaGraph()).toEqual([]));
  it('rejects duplicate, self, missing and asymmetric links',()=>{const nodes=[{id:'a',x:0,y:0,neighbors:['a','missing','b'],ocean:'test'},{id:'a',x:0,y:0,neighbors:[],ocean:'test'},{id:'b',x:0,y:0,neighbors:[],ocean:'test'}];expect(validateSeaGraph(nodes,[],[]).length).toBeGreaterThan(2);});
  it('rejects invalid port links',()=>expect(validateSeaGraph(seaNodes,seaEdges,[{provinceId:'unknown',level:0,seaNodeId:'missing',x:0,y:0}]).some(i=>i.includes('Invalid port'))).toBe(true));
  it('preserves world-v1, 201 countries and 494 provinces',()=>{expect(mapMetadata.id).toBe('world-v1');expect(countries).toHaveLength(201);expect(provincesData).toHaveLength(494);});
  it('keeps land topology and immutable world data through every naval phase',()=>{const before=JSON.stringify([countries,provincesData,seaNodes,seaEdges,navalPorts]);const navies=createInitialNavies(countries,provincesData);navalAITick(navies,new Set(['BRA']),'USA',provincesData,[],[]);navalMovementTick(navies,provincesData,[],[]);navalRecoveryTick(navies,countries,provincesData,[],[]);combat([fleet(),fleet('ARG')]);expect(JSON.stringify([countries,provincesData,seaNodes,seaEdges,navalPorts])).toBe(before);});
  it('builds ephemeral country, sea and port indexes',()=>{const dock=brazil(),sea=fleet();const i=buildNavalIndexes([dock,sea]);expect(i.byCountry.get('BRA')).toHaveLength(2);expect(i.byPort.get(dock.portProvinceId!)).toEqual([dock]);expect(i.bySeaNode.get(node)).toEqual([sea]);});
});

describe('Routing and movement',()=>{
  it.each([['GBR','USA'],['GBR','BRA'],['GBR','ZAF'],['GBR','IND'],['ZAF','IND'],['JPN','AUS'],['JPN','USA'],['BRA','AUS'],['CUB','GBR'],['ITA','GBR']])('%s reaches %s over water', (a,b)=>{const route=findSeaRoute(port(a).seaNodeId,port(b).seaNodeId);expect(route).not.toBeNull();expect(route![route!.length-1]).toBe(port(b).seaNodeId);expect(seaRouteDistance(port(a).seaNodeId,route!)).toBeGreaterThan(0);});
  it('Japan reaches California by logical Pacific edges',()=>{const start=port('JPN').seaNodeId,end=portByProvince.get('na_usa_california')!.seaNodeId,route=findSeaRoute(start,end)!;const ids=[start,...route];expect(seaEdges.some(e=>e.logical&&ids.some((id,i)=>id===e.a&&ids[i+1]===e.b||id===e.b&&ids[i+1]===e.a))).toBe(true);});
  it('produces deterministic routes',()=>expect(findSeaRoute(port('GBR').seaNodeId,port('BRA').seaNodeId)).toEqual(findSeaRoute(port('GBR').seaNodeId,port('BRA').seaNodeId)));
  it('blocks unknown start and destination',()=>{expect(findSeaRoute('unknown',node)).toBeNull();expect(orderFleetMove(brazil(),'unknown','BRA')).toBeNull();});
  it('blocks orders from another country',()=>expect(orderFleetMove(brazil(),node,'ARG')).toBeNull());
  it('moves continuously rather than teleporting',()=>{const f=fleet(),target=seaNodes.find(n=>(findSeaRoute(node,n.id)?.length??0)>10)!;const ordered=orderFleetMove(f,target.id,'BRA')!;const next=move(ordered);expect(next.locationSeaNodeId).not.toBe(target.id);expect(next.movementProgress).toBeGreaterThan(0);expect(fleetPosition(next)).not.toEqual(fleetPosition(ordered));});
  it('adds a validated port entry before ocean routes',()=>{const f=brazil(),ordered=orderFleetMove(f,port('GBR').seaNodeId,'BRA')!;expect(ordered.route[0]).toBe(portByProvince.get(f.portProvinceId!)!.seaNodeId);expect(()=>readNavalSave({fleets:[ordered],battles:[]})).not.toThrow();});
  it('reaches its destination with daily ticks',()=>{const neighbor=seaNodeById.get(node)!.neighbors[0];let f=orderFleetMove(fleet(),neighbor,'BRA')!;for(let i=0;i<100&&f.status==='MOVING';i++)f=move(f);expect(f.locationSeaNodeId).toBe(neighbor);expect(f.status).toBe('HOLDING');});
  it('return to port docks and clears orders',()=>{let f=orderFleetReturn(fleet(),provincesData,[],[],'BRA')!;for(let i=0;i<100&&f.status==='MOVING';i++)f=move(f);expect(f.status).toBe('DOCKED');expect(f.portProvinceId).toBe(port('BRA').provinceId);expect(f.destinationPortId).toBeUndefined();});
  it('cannot return to enemy or inland port',()=>{expect(orderFleetReturn(fleet(),provincesData,[],[war()],'BRA',port('ARG').provinceId)).toBeNull();expect(orderFleetReturn(fleet(),provincesData,[],[],'BRA','sa_bra_mato_grosso')).toBeNull();});
  it.each([false,true])('permits foreign friendly base with alliance/access=%s',access=>expect(orderFleetReturn(fleet(),provincesData,[relation(access)],[],'BRA',port('ARG').provinceId)).not.toBeNull());
  it('war overrides allied/access port permission',()=>expect(canUseNavalPort('BRA',provincesData.find(p=>p.id===port('ARG').provinceId)!,[relation(true)],buildNavalHostility([war()]))).toBe(false));
  it('cancel preserves current leg without snapping back',()=>{const f=orderFleetMove(fleet(),port('GBR').seaNodeId,'BRA')!;f.movementProgress=.25;const stop=cancelNavalOrder(f);expect(stop.route).toEqual([f.route[0]]);expect(stop.movementProgress).toBe(.25);});
  it('replanning preserves a traversed edge',()=>{const f=orderFleetMove(fleet(),port('GBR').seaNodeId,'BRA')!;f.movementProgress=.3;const changed=orderFleetMove(f,port('ARG').seaNodeId,'BRA')!;expect(changed.route[0]).toBe(f.route[0]);expect(changed.movementProgress).toBe(.3);});
  it('logical crossings never interpolate through the world interior',()=>{const e=seaEdges.find(e=>e.logical)!,f={...fleet(),locationSeaNodeId:e.a,route:[e.b],movementProgress:.25};expect([0,5040]).toContain(fleetPosition(f)!.x);f.movementProgress=.75;expect([0,5040]).toContain(fleetPosition(f)!.x);});
  it('expels fleets when their port becomes hostile',()=>{const f={...fleet(),portProvinceId:port('ARG').provinceId,locationSeaNodeId:undefined,status:'DOCKED' as const};expect(move(f,[war()]).portProvinceId).toBeUndefined();});
});

describe('Combat, retreat and recovery',()=>{
  it('cleanup ends battle on territorial elimination and releases the surviving fleet',()=>{const state=combat([fleet(),fleet('ARG')]);const result=cleanupNavalState(state,provincesData.filter(p=>p.owner!=='ARG'),[war()]);expect(result.fleets).toHaveLength(1);expect(result.fleets[0].status).toBe('HOLDING');expect(result.battles[0].status).toBe('ENDED');});
  it('cleanup immediately releases combat fleets after peace',()=>{const state=combat([fleet(),fleet('ARG')]);const result=cleanupNavalState(state,provincesData,[]);expect(result.fleets.every(f=>f.status==='HOLDING')).toBe(true);expect(result.battles[0].status).toBe('ENDED');});
  it('detects encounters and permits save dates before the Unix epoch in 1444',()=>{const day=diplomacyDay({year:1444,month:11,day:11});expect(day).toBeLessThan(0);const result=combat([fleet(),fleet('ARG')],[war()],day);expect(result.battles[0].status).toBe('ACTIVE');expect(readNavalSave(result)).toEqual(result);});
  it('derives peaceful presence and contested hostile control without blocking neutral seas',()=>{expect(buildNavalPresence([fleet()],[]).get(node)?.controller).toBe('BRA');expect(buildNavalPresence([fleet(),fleet('ARG')],[]).get(node)?.contested).toBe(false);expect(buildNavalPresence([fleet(),fleet('ARG')],[war()]).get(node)?.contested).toBe(true);});
  it('hostile fleets create a separate naval battle',()=>{const result=combat([fleet(),fleet('ARG')]);expect(result.battles).toHaveLength(1);expect(result.battles[0].seaNodeId).toBe(node);});
  it('neutrals and allies never fight without war',()=>{expect(combat([fleet(),fleet('ARG')],[]).battles).toEqual([]);expect(navalCombatTick({fleets:[fleet(),fleet('ARG')],battles:[]},[],1,provincesData,[relation()]).battles).toEqual([]);});
  it('coalition hostility covers campaign participants',()=>{const wars=[{...war('BRA','ARG'),campaignId:'root'},{...war('USA','ARG'),campaignId:'root'},{...war('BRA','GBR'),campaignId:'root'}];expect(buildNavalHostility(wars).get('USA')?.has('GBR')).toBe(true);});
  it('never damages a neutral sharing the battle node',()=>{const result=combat([fleet(),fleet('ARG'),fleet('USA')]);expect(result.fleets.find(f=>f.countryTag==='USA')!.units[0].strength).toBe(100);});
  it('applies damage to individual ships',()=>{const result=combat([fleet(),fleet('ARG')]);expect(result.fleets[0].units[0].strength).toBeLessThan(100);expect(result.battles[0].lossesA).toBeGreaterThan(0);});
  it('destroys empty units and fleets',()=>{const weak=fleet();weak.units[0].strength=.01;const result=combat([weak,fleet('ARG')]);expect(result.fleets.some(f=>f.countryTag==='BRA')).toBe(false);expect(result.battles[0].status).toBe('ENDED');});
  it('removes only sunk ships in a surviving fleet',()=>{const weak=fleet('BRA','f',['DESTROYER','BATTLESHIP']);weak.units[0].strength=.01;const result=combat([weak,fleet('ARG')]);expect(result.fleets.find(f=>f.id==='f')!.units).toHaveLength(1);});
  it('retreats surviving defeated fleet to a neighboring node',()=>{const weak=fleet();weak.units[0].organization=1;const result=combat([weak,fleet('ARG')]);const retreat=result.fleets.find(f=>f.countryTag==='BRA')!;expect(retreat.status).toBe('RETREATING');expect(seaNodeById.get(node)!.neighbors).toContain(retreat.route[0]);expect(retreat.units.length).toBeGreaterThan(0);});
  it('retreat movement continues and cannot be overridden',()=>{const weak=fleet();weak.units[0].organization=1;const retreat=combat([weak,fleet('ARG')]).fleets.find(f=>f.countryTag==='BRA')!;expect(orderFleetMove(retreat,node,'BRA')).toBeNull();expect(move(retreat)).not.toEqual(retreat);});
  it('ends ongoing combat when war ends',()=>{const state=combat([fleet(),fleet('ARG')]);const peace=combat([],[],2,state);expect(peace.battles[0].status).toBe('ENDED');expect(peace.fleets.every(f=>f.status!=='COMBAT')).toBe(true);});
  it('does not duplicate an existing battle',()=>{const state=combat([fleet(),fleet('ARG')]);expect(combat([],[war()],2,state).battles).toHaveLength(1);});
  it('combat is deterministic and does not mutate input',()=>{const input={fleets:[fleet(),fleet('ARG')],battles:[]},before=structuredClone(input);expect(combat([],[war()],1,input)).toEqual(combat([],[war()],1,input));expect(input).toEqual(before);});
  it('repairs and recovers at a friendly port with a gold cost',()=>{const f=brazil();f.units[0].strength=50;f.units[0].organization=20;const result=navalRecoveryTick([f],countries,provincesData,[],[]);expect(result.fleets[0].units[0].strength).toBeGreaterThan(50);expect(result.fleets[0].units[0].organization).toBeGreaterThan(20);expect(result.countries.find(c=>c.tag==='BRA')!.resources.gold).toBeLessThan(countries.find(c=>c.tag==='BRA')!.resources.gold);});
  it('enemy ports never repair',()=>{const f=brazil();f.portProvinceId=port('ARG').provinceId;f.units[0].strength=50;expect(navalRecoveryTick([f],countries,provincesData,[],[war()]).fleets[0].units[0].strength).toBe(50);});
  it('zero gold prevents strength repair but preserves organization recovery',()=>{const f=brazil();f.units[0].strength=50;f.units[0].organization=20;const poor=countries.map(c=>({...c,resources:{...c.resources,gold:0}}));const result=navalRecoveryTick([f],poor,provincesData,[],[]);expect(result.fleets[0].units[0].strength).toBe(50);expect(result.fleets[0].units[0].organization).toBeGreaterThan(20);});
  it('maintenance is applied for all fleet statuses',()=>{const f=fleet(),before=countries.find(c=>c.tag==='BRA')!;const result=navalRecoveryTick([f],countries,provincesData,[],[]).countries.find(c=>c.tag==='BRA')!;expect(result.resources.gold).toBeCloseTo(before.resources.gold-NAVAL_UNIT_STATS.CRUISER.maintenance);expect(result.economy.goldExpense).toBeCloseTo(before.economy.goldExpense+NAVAL_UNIT_STATS.CRUISER.maintenance);});
});

describe('Activation and naval AI',()=>{
  it('FULL bot generates a home-water order',()=>{const result=navalAITick([brazil()],new Set(['BRA']),'USA',provincesData,[],[]);expect(result.fleets[0].status).toBe('MOVING');expect(result.bots).toBe(1);});
  it('PASSIVE bot never generates strategic orders',()=>{const f=brazil();expect(navalAITick([f],new Set(),'USA',provincesData,[],[]).fleets).toEqual([f]);});
  it('player is never controlled by naval AI',()=>{const f=brazil();expect(navalAITick([f],new Set(['BRA']),'BRA',provincesData,[],[]).fleets).toEqual([f]);});
  it('PASSIVE fleet continues existing movement',()=>{const f=orderFleetMove(fleet(),port('GBR').seaNodeId,'BRA')!;const ai=navalAITick([f],new Set(),'USA',provincesData,[],[]);expect(move(ai.fleets[0])).not.toEqual(f);});
  it('FULL bot pursues a nearby wartime opponent',()=>{const a=fleet(),b=fleet('ARG');b.locationSeaNodeId=seaNodeById.get(node)!.neighbors[0];const result=navalAITick([a,b],new Set(['BRA']),'USA',provincesData,[],[war()]);expect(result.fleets[0].destinationSeaNodeId).toBe(b.locationSeaNodeId);});
  it('AI avoids a much stronger enemy',()=>{const a=fleet('BRA','a',['TRANSPORT']),b=fleet('ARG','b',['BATTLESHIP']);b.locationSeaNodeId=seaNodeById.get(node)!.neighbors[0];expect(navalAITick([a,b],new Set(['BRA']),'USA',provincesData,[],[war()]).fleets[0].route).toEqual([]);});
  it('war participants are FULL without a duplicate naval activation rule',()=>{const activation=buildSimulationActivation({countries,provinces:provincesData,armies:[],wars:[war('MLT','CYP')],relations:[],playerCountryTag:'BRA',strategicPowerCount:0});expect(activation.fullCountryTags.has('MLT')).toBe(true);expect(activation.fullCountryTags.has('CYP')).toBe(true);});
  it('aggregates profiler phases and counters over the report window',()=>{let now=0;const reports: {navalCounters:{fleets:number;pathfindCalls:number}}[]=[];const profiler=createGameLoopProfiler(true,{now:()=>now,reportEvery:2,report:r=>reports.push(r)});for(let i=0;i<2;i++){profiler.begin();now+=2;profiler.endPhase('navalAI');now+=3;profiler.endPhase('navalMovement');now+=4;profiler.endPhase('navalCombat');profiler.recordNaval({fleets:3,movingFleets:1,navalAIBots:2,activeNavalBattles:1,pathfindCalls:5});profiler.finish(3,100);}expect(reports[0].navalCounters.fleets).toBe(6);expect(reports[0].navalCounters.pathfindCalls).toBe(10);expect(profiler.phases).toEqual({});});
});
