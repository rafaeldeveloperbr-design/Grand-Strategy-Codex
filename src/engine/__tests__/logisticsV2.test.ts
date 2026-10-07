import { describe, expect, it, vi, afterEach } from 'vitest';
import type { Country, Province } from '../../types';
import { countries, provincesData } from '../../data/map';
import { buildLogisticsNetworks, getProvinceLogistics, logisticsDistanceModifier, logisticsInfrastructureModifier, logisticsCategory, projectRouteLogistics, resolveLogisticsOrigin, LOGISTICS_BALANCE as B } from '../logistics';
import { getArmySupply, recoverArmy } from '../military';
import { calculateLocalSupplyBaseCapacity, calculateLocalSupplyCapacity } from '../military/supplyEngine';
import { processArmyMovement, moveArmy } from '../military/movementEngine';
import { processAI } from '../aiEngine/aiMovement';
import { army, relation, war } from './helpers/southAmericaAudit';
import { getTerrainDefinition } from '../terrain';
import { startContinuousBattle, processBattleDay } from '../combat/continuousBattle';

afterEach(() => vi.restoreAllMocks());
const p = (id: string, owner = 'BRA', neighbors: string[] = []): Province => ({...structuredClone(provincesData[0]),id,name:id,owner,originalOwner:owner,neighbors,terrain:'plains',development:0,buildings:[],defense:1});
const c = (tag = 'BRA',capital = 'p0'): Country => ({...structuredClone(countries.find(c => c.tag === tag) ?? countries[0]),tag,capital,capitalId:capital,provinces:[],isAnnexed:false});
function chain(count = 4) {
  return Array.from({length:count},(_,i) => p(`p${i}`,'BRA',[...(i ? [`p${i-1}`] : []),...(i<count-1 ? [`p${i+1}`] : [])]));
}
const snapshot = (provinces: Province[], relations: ReturnType<typeof relation>[] = [], wars: ReturnType<typeof war>[] = [], nations = [c(),c('ARG','foreign')]) => buildLogisticsNetworks({provinces,countries:nations,relations,wars});
const at = (network: ReturnType<typeof snapshot>,id: string,tag = 'BRA') => getProvinceLogistics(network,tag,id)!;

describe('Logistics V2 origin and network',() => {
  it('uses a controlled capital, independently of stale country province indexes',() => {
    const provinces = chain(); provinces[3].development=50;
    expect(resolveLogisticsOrigin(c(),provinces)?.id).toBe('p0');
    expect(at(snapshot(provinces),'p0')).toMatchObject({connected:true,distance:0,originId:'p0'});
  });
  it('falls back deterministically after capital occupation or invalidation',() => {
    const provinces = chain(); provinces[0].owner='ARG'; provinces[2].development=20;
    expect(resolveLogisticsOrigin(c(),provinces)?.id).toBe('p2');
    expect(resolveLogisticsOrigin(c('BRA','missing'),[...provinces].reverse())?.id).toBe('p2');
  });
  it('has no origin for annexed, landless or rebel countries and restores after territory returns',() => {
    expect(resolveLogisticsOrigin(c(),[])).toBeUndefined();
    expect(resolveLogisticsOrigin({...c(),isAnnexed:true},chain())).toBeUndefined();
    expect(resolveLogisticsOrigin(c('rebel_test'),[p('p0','rebel_test')])).toBeUndefined();
    expect(snapshot([],[],[],[c()]).networks.get('BRA')?.originId).toBeNull();
    expect(snapshot(chain(),[],[],[c()]).networks.get('BRA')?.originId).toBe('p0');
  });
  it('cuts a corridor immediately and restores it despite stale occupation records',() => {
    const provinces=chain(), conflict=war('ARG','BRA');
    expect(at(snapshot(provinces,[],[conflict]),'p3').distance).toBe(3);
    provinces[1].owner='ARG'; conflict.occupiedByAttacker=['p1'];
    expect(at(snapshot(provinces,[],[conflict]),'p3').connected).toBe(false);
    provinces[1].owner='BRA';
    expect(at(snapshot(provinces,[],[conflict]),'p3').connected).toBe(true);
  });
  it('never crosses absent edges, water gaps or nonexistent neighbors',() => {
    const provinces=[p('p0','BRA',['missing']),p('island')];
    expect(at(snapshot(provinces),'island')).toMatchObject({connected:false,distance:null,efficiency:.25});
  });
  it('permits alliances and directed military access, blocks neutral and wartime access',() => {
    const provinces=chain();provinces[1].owner='ARG';
    expect(at(snapshot(provinces),'p3').connected).toBe(false);
    expect(at(snapshot(provinces,[relation('BRA','ARG','alliance')]),'p3').connected).toBe(true);
    expect(at(snapshot(provinces,[relation('BRA','ARG','access')]),'p3').connected).toBe(true);
    expect(at(snapshot(provinces,[relation('BRA','ARG','alliance')],[war('BRA','ARG')]),'p3').connected).toBe(false);
    expect(at(snapshot(provinces,[relation('ARG','BRA','access')]),'p3').connected).toBe(false);
  });
  it('degrades conquered routes once and stops occupation degradation after peace',() => {
    const provinces=chain();provinces[1].originalOwner='ARG';
    expect(at(snapshot(provinces,[],[war('BRA','ARG')]),'p3').efficiency).toBeCloseTo(.9*.8);
    expect(at(snapshot(provinces),'p3').efficiency).toBeCloseTo(.9);
  });
  it('is deterministic across country, province and neighbor ordering',() => {
    const provinces=chain(15),first=snapshot(provinces),second=snapshot([...provinces].reverse().map(p => ({...p,neighbors:[...p.neighbors].reverse()})),[],[],[c('ARG','foreign'),c()]);
    for(const p of provinces) expect(at(first,p.id)).toEqual(at(second,p.id));
    expect(at(first,'p14').distance).toBe(14);
    expect(at(first,'p0').dependentProvinces).toBe(14);
  });
});

describe('Logistics V2 distance, terrain and infrastructure',() => {
  it.each([[0,1],[2,1],[3,.9],[5,.9],[6,.8],[8,.8],[9,.7],[12,.7],[13,.6],[100,.6]])('distance %i yields %f', (distance,expected) => expect(logisticsDistanceModifier(distance)).toBe(expected));
  it('uses the weakest terrain along a route once, including intervening terrain',() => {
    const provinces=chain();provinces[1].terrain='mountains';provinces[2].terrain='mountains';
    expect(at(snapshot(provinces),'p3').efficiency).toBeCloseTo(.9*.75);
    provinces[1].terrain='forest';provinces[2].terrain='forest';
    const forest=at(snapshot(provinces),'p3').efficiency;
    provinces[1].terrain='jungle';
    expect(at(snapshot(provinces),'p3').efficiency).toBeLessThan(forest);
  });
  it('uses a specific terrain factor without multiplying Terrain V1 supply again',() => {
    const mountain=p('p0');mountain.terrain='mountains'; const force=army('BRA','p0',20);
    expect(getTerrainDefinition(mountain).supplyModifier).toBe(.6);
    expect(calculateLocalSupplyCapacity(mountain)).toBeCloseTo(3*.6);
    expect(getArmySupply(force,mountain,[force],snapshot([mountain])).ratio).toBeCloseTo(3*.75/20);
    expect(getTerrainDefinition(mountain).supplyModifier).toBe(.6);
  });
  it('completed infrastructure improves capacity and efficiency with a clamp',() => {
    const provinces=chain();const initial=at(snapshot(provinces),'p3').efficiency;
    provinces[3].buildings=[{type:'infrastructure',level:1,daysRemaining:0}];
    expect(logisticsInfrastructureModifier(provinces[3])).toBe(1.08);
    expect(at(snapshot(provinces),'p3').efficiency).toBeGreaterThan(initial);
    provinces[3].buildings[0].level=100;
    expect(logisticsInfrastructureModifier(provinces[3])).toBe(B.maximumInfrastructureModifier);
    for (const info of snapshot(provinces).networks.get('BRA')!.provinces.values()) {
      expect(info.efficiency).toBeGreaterThanOrEqual(B.minimumLogisticsEfficiency);
      expect(info.efficiency).toBeLessThanOrEqual(B.maximumLogisticsEfficiency);
    }
  });
  it('unfinished infrastructure does not affect logistics',() => {
    const province=p('p0');province.buildings=[{type:'infrastructure',level:5,daysRemaining:10}];
    expect(logisticsInfrastructureModifier(province)).toBe(1);
  });
});

describe('Logistics V2 supply integration',() => {
  it('disconnected armies forage but receive strongly reduced supply',() => {
    const provinces=chain(),force=army('BRA','p3',20);
    const connected=getArmySupply(force,provinces[3],[force],snapshot(provinces));
    provinces[1].owner='ARG';const disconnected=getArmySupply(force,provinces[3],[force],snapshot(provinces));
    expect(disconnected.ratio).toBeGreaterThan(0);expect(disconnected.ratio).toBeLessThan(connected.ratio);
  });
  it('shares capacity by owner and location, excluding unrelated provinces and enemy demand',() => {
    const province=p('p0'),a=army('BRA','p0',10,'a'),b=army('BRA','p0',10,'b'),elsewhere=army('BRA','other',100),enemy=army('ARG','p0',100);
    const cache=snapshot([province]);
    expect(getArmySupply(a,province,[a,b,elsewhere,enemy],cache).ratio).toBeCloseTo(3/20);
    expect(getArmySupply(b,province,[a,b],cache).ratio).toBeCloseTo(3/20);
    expect(getArmySupply(a,province,[a],cache).ratio).toBeCloseTo(3/10);
  });
  it('clamps supply safely for invalid capacity, zero/invalid demand and no province',() => {
    const province=p('p0'),force=army('BRA','p0',10);
    for(const development of [-100,NaN,Infinity]) {
      province.development=development;
      const supply=getArmySupply(force,province,[force],snapshot([province]));
      expect(Number.isFinite(supply.ratio)).toBe(true);expect(supply.ratio).toBeGreaterThanOrEqual(0);expect(supply.ratio).toBeLessThanOrEqual(1);
    }
    province.development=0;
    for(const strength of [0,NaN,Infinity]) {
      force.regiments.forEach(r => {r.strength=strength;});
      expect(Number.isFinite(getArmySupply(force,province,[force],snapshot([province])).ratio)).toBe(true);
    }
    expect(getArmySupply(force).ratio).toBe(0);
  });
  it('critical supply never drains organization, morale or strength over 90 days',() => {
    const provinces=[p('p0'),p('isolated')],cache=snapshot(provinces);
    let force=army('BRA','isolated',30);force.regiments.forEach(r => {r.organization=40;r.morale=50;});
    let nation=c();nation.resources={...nation.resources,gold:0,manpower:0};let province=provinces[1];
    expect(getArmySupply(force,province,[force],cache).status).toBe('critical');
    for(let i=0;i<90;i++) {
      const before=force.regiments.map(r => ({...r}));const result=recoverArmy(force,nation,province,[force],cache);
      force=result.army;nation=result.country;province=result.province;
      force.regiments.forEach((r,j) => {expect(r.organization).toBeGreaterThanOrEqual(before[j].organization!);expect(r.morale).toBeGreaterThanOrEqual(before[j].morale);expect(r.strength).toBe(before[j].strength);});
    }
  });
  it('movement applies the existing supply multiplier exactly once',() => {
    const provinces=chain(2),force=army('BRA','p0',30),cache=snapshot(provinces);
    const order=moveArmy(force,'p1',provinces,[])!;
    const moved=processArmyMovement([order],provinces,[],cache).updatedArmies[0];
    expect(moved.movementProgress).toBeCloseTo(order.movementSpeed*getArmySupply(order,provinces[0],[order],cache).movementMultiplier/getTerrainDefinition(provinces[1]).movementCost);
  });
  it('rebels keep their existing local supply and never obtain a national network',() => {
    const province=p('p0','rebel_test'),force=army('rebel_test','p0',20),cache=snapshot([province],[],[],[c('rebel_test')]);
    expect(cache.networks.has('rebel_test')).toBe(false);
    expect(getArmySupply(force,province,[force],cache)).toEqual(getArmySupply(force,province,[force]));
  });
  it('combat snapshots and daily pressure use the same logistics-aware supply',() => {
    const provinces=chain(2);const attacker=army('ARG','p1',15),defender=army('BRA','p1',15);
    const forces=[attacker,defender],cache=snapshot(provinces,[],[war('ARG','BRA')]);
    const battle=startContinuousBattle([attacker],[defender],provinces[1],{year:1444,month:11,day:11},'logistics-combat',cache);
    expect(battle.attackerCombatSnapshot?.supply).toBe(getArmySupply(attacker,provinces[1],forces,cache).status);
    expect(battle.defenderCombatSnapshot?.supply).toBe(getArmySupply(defender,provinces[1],forces,cache).status);
    const day=processBattleDay(battle,forces,provinces[1],provinces,new Map(),new Map(),cache);
    expect(day).toBeDefined();
  });
});

describe('Logistics V2 military AI',() => {
  it('projects captured enemy routes without altering the actual network or territory',() => {
    const provinces=chain();provinces.slice(1).forEach(p => {p.owner='ARG';p.originalOwner='ARG';});
    const cache=snapshot(provinces,[relation('BRA','ARG')],[war('BRA','ARG')]);
    const before=JSON.stringify(provinces);
    expect(projectRouteLogistics(cache,'BRA','p0',['p1','p2','p3'])).toMatchObject({connected:true,distance:3,occupationModifier:.8});
    expect(at(cache,'p3').connected).toBe(false);expect(JSON.stringify(provinces)).toBe(before);
    expect(projectRouteLogistics(cache,'BRA','p0',['p3'])).toBeUndefined();
  });
  it('rejects an offensive route that cannot sustain its stack',() => {
    vi.spyOn(console,'log').mockImplementation(() => {});
    const provinces=chain(2);provinces[1].owner='ARG';provinces[1].originalOwner='ARG';provinces[0].development=100;
    const force=army('BRA','p0',30),relations=[relation('BRA','ARG')];
    expect(processAI('BRA',[force],provinces,relations,[war('BRA','ARG')],[c(),c('ARG','p1')])[0].destination).toBeNull();
    provinces[1].development=100;
    expect(processAI('BRA',[force],provinces,relations,[war('BRA','ARG')],[c(),c('ARG','p1')])[0].destination).toBe('p1');
  });
  it('prefers the better supplied option when military and strategic values match',() => {
    vi.spyOn(console,'log').mockImplementation(() => {});
    const provinces=[p('p0','BRA',['a','b']),p('a','ARG',['p0']),p('b','ARG',['p0'])];
    provinces[1].terrain='mountains'; const force=army('BRA','p0',4),relations=[relation('BRA','ARG')];
    // Neither target is a capital; otherwise its strategic priority legitimately differs.
    const result=processAI('BRA',[force],provinces,relations,[war('BRA','ARG')],[c(),c('ARG','missing')]);
    expect(result[0].destination).toBe('b');
  });
  it('identifies deterministic downstream corridors for defensive scoring',() => {
    const network=snapshot(chain(5));
    expect(at(network,'p1').dependentProvinces).toBe(3);
    expect(at(network,'p4').dependentProvinces).toBe(0);
  });
  it('prefers a disconnected enemy when military strength and route supply are equal',() => {
    vi.spyOn(console,'log').mockImplementation(() => {});
    const provinces=[p('p0','BRA',['a','b']),p('a','ARG',['p0']),p('b','ARG',['p0'])];provinces.forEach(p => {p.development=30;});
    const force=army('BRA','p0',6),weak=army('ARG','a',1,'weak'),connected=army('ARG','b',1,'connected');
    const result=processAI('BRA',[force,connected,weak],provinces,[relation('BRA','ARG')],[war('BRA','ARG')],[c(),c('ARG','b')]);
    expect(result.find(a => a.id===force.id)?.destination).toBe('a');
  });
  it('retreats a disconnected army along an existing valid route to its network',() => {
    vi.spyOn(console,'log').mockImplementation(() => {});
    // BRA controls the end but neutral ARG blocks its supply corridor. During war
    // the existing movement rules permit retreat across that same enemy corridor.
    const provinces=chain();provinces[1].owner='ARG';provinces[1].originalOwner='ARG';
    const force=army('BRA','p3',4),relations=[relation('BRA','ARG')];
    const result=processAI('BRA',[force],provinces,relations,[war('BRA','ARG')],[c(),c('ARG','p1')]);
    expect(result[0].targetDestination).toBe('p0');expect(result[0].path).toEqual(['p2','p1','p0']);
  });
});

describe('Logistics V2 presentation and map data',() => {
  it.each([[1,'strong'],[.9,'moderate'],[.7,'distant'],[.6,'weak']])('categorizes connected efficiency %f as %s',(efficiency,id) => {
    expect(logisticsCategory({...at(snapshot(chain()),'p0'),efficiency}).id).toBe(id);
  });
  it('always marks disconnected provinces red regardless of efficiency',() => expect(logisticsCategory({...at(snapshot(chain()),'p0'),connected:false,efficiency:1}).color).toBe('#d64545'));
  it('resolves Brasília and computes the entire Brazil peace network without modifying the world',() => {
    const before=JSON.stringify(provincesData);const cache=buildLogisticsNetworks({provinces:provincesData,countries,relations:[],wars:[]});
    expect(cache.networks.get('BRA')?.originId).toBe('sa_bra_brasilia');
    for(const province of provincesData.filter(p => p.owner==='BRA')) {
      const connection=at(cache,province.id);expect(connection.connected).toBe(true);expect(Number.isFinite(connection.efficiency)).toBe(true);
    }
    expect(JSON.stringify(provincesData)).toBe(before);
    expect(calculateLocalSupplyBaseCapacity(provincesData[0])).toBeGreaterThan(0);
  });
});
