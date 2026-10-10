import {describe, expect, it} from 'vitest';
import {countries, provincesData} from '../../data/map';
import {AIR_BALANCE as B, AIRCRAFT_TYPES} from '../../data/aircraft';
import type {ActiveBattle, War} from '../../types';
import type {AirState, AirWing} from '../../types/air';
import {airBases, airBaseByProvinceId, airZoneByProvinceId, airCombatTick, airAITick, airMissionsTick, airMissionEfficiency, assignAirMission, cancelAirMission, rebaseAirWing, cleanupAirState, createInitialAirState, getAirZoneControl, getAirSupportForBattle, type AirContext} from '../air';
import {readAirSave} from '../air/save';
import {createDefaultMarket} from '../market';
const seed=createInitialAirState(countries,provincesData).wings.find(w=>w.countryTag==='BRA' && w.type==='FIGHTER')!;
const zone=airZoneByProvinceId.get(seed.baseProvinceId)!;
const level=airBaseByProvinceId.get(seed.baseProvinceId)!.level;
const ctx=():AirContext=>{
  const provinces=structuredClone(provincesData),cs=structuredClone(countries);
  const base=provinces.find(p=>p.id===seed.baseProvinceId)!;
  base.market=createDefaultMarket();base.market.goods.iron.stock=100;base.market.goods.tools.stock=100;
  cs.find(c=>c.tag==='BRA')!.resources.gold=1000;
  return {provinces,countries:cs,wars:[],relations:[]};
};
const mission=(patch:Partial<AirWing>={}):AirWing=>({...seed,aircraftCount:24,maxAircraft:24,strength:100,organization:100,status:'MISSION',mission:'AIR_SUPERIORITY',assignedAirZoneId:zone.id,...patch});
const recovering=(patch:Partial<AirWing>={}):AirWing=>({...mission(),status:'RECOVERING',mission:undefined,assignedAirZoneId:undefined,recovery:{mission:'AIR_SUPERIORITY',airZoneId:zone.id},...patch});
const war:War={id:'recovery-test',attacker:'BRA',defender:'ARG',startDate:{year:1444,month:11,day:11},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]};
const state=(...wings:AirWing[]):AirState=>({wings,engagements:[]});
const tick=(w:AirWing,c=ctx())=>airMissionsTick(state(w),c);

describe('Universal automatic air recovery',()=>{
  it.each([{organization:39},{strength:39},{aircraftCount:11}])('withdraws every damaged mission %j preserving its order',patch=>{
    const w=mission(patch),before=structuredClone(w),next=tick(w).state.wings[0];
    expect(next).toMatchObject({status:'RECOVERING',recovery:{mission:'AIR_SUPERIORITY',airZoneId:zone.id}});
    expect(next.mission).toBeUndefined();expect(next.assignedAirZoneId).toBeUndefined();expect(w).toEqual(before);
  });
  it.each([{organization:40},{strength:40},{aircraftCount:12}])('does not withdraw at the exact entry boundary %j',patch=>{
    expect(tick(mission(patch)).state.wings[0].status).toBe('MISSION');
  });
  it('applies the same transition to player, FULL AI and PASSIVE before AI choices',()=>{
    const s=state(mission({organization:39})),c=ctx();
    const player=airAITick(s,new Set(['BRA']),'BRA',c,[]).state;
    const ai=airAITick(s,new Set(['BRA']),'USA',c,[]).state;
    const passive=airAITick(s,new Set(),'USA',c,[]).state;
    expect(player).toEqual(ai);expect(passive).toEqual(ai);expect(ai.wings[0].status).toBe('RECOVERING');
    expect(airAITick(ai,new Set(['BRA']),'USA',c,[]).state).toEqual(ai);
    expect(airMissionsTick(player,c)).toEqual(airMissionsTick(ai,c));
  });
  it('contributes zero combat, superiority and CAS even with stale normal mission fields',()=>{
    const w=recovering(),c=ctx();
    expect(airMissionEfficiency(w,c)).toBe(0);
    const enemyBase=airBases.find(b=>b.provinceId!==seed.baseProvinceId)!;
    const combatCtx={...c,wars:[war],provinces:c.provinces.map(p=>p.id===enemyBase.provinceId?{...p,owner:'ARG',center:zone.center}:p)};
    const enemy=mission({id:'enemy',countryTag:'ARG',baseProvinceId:enemyBase.provinceId});
    expect(airCombatTick(state(mission(),enemy),combatCtx,0).engagements).toHaveLength(1);
    expect(airCombatTick(state(w,enemy),combatCtx,0).engagements).toEqual([]);
    expect(getAirZoneControl(state(w),zone.id,'BRA',c).friendly).toBe(0);
    const cas={...w,type:'CAS' as const,mission:'CLOSE_AIR_SUPPORT' as const,assignedAirZoneId:zone.id};
    const battle={provinceId:zone.provinceIds[0],attackerCountryId:'BRA',defenderCountryId:'ARG'} as ActiveBattle;
    expect(getAirSupportForBattle(state({...cas,status:'MISSION'}),battle,'BRA',c)).toBeGreaterThan(0);
    expect(getAirSupportForBattle(state(cas),battle,'BRA',c)).toBe(0);
  });
  it('does not execute bombing during recovery',()=>{
    const c=ctx(),w=recovering({type:'BOMBER',organization:30,recovery:{mission:'BOMBING',airZoneId:zone.id}});
    const target=c.provinces.find(p=>zone.provinceIds.includes(p.id) && p.id!==seed.baseProvinceId)!;
    const hostileCtx={...c,wars:[war],provinces:c.provinces.map(p=>p.id===target.id?{...p,owner:'ARG'}:p)};
    const before=c.countries.find(c=>c.tag==='ARG')!.resources.gold;
    expect(tick(w,hostileCtx).countries.find(c=>c.tag==='ARG')!.resources.gold).toBe(before);
    expect(tick(mission({type:'BOMBER',mission:'BOMBING'}),hostileCtx).countries.find(c=>c.tag==='ARG')!.resources.gold).toBeLessThan(before);
  });
  it('recovers organization, strength and replacements with the existing resource costs',()=>{
    const w=recovering({organization:30,strength:40,aircraftCount:10}),c=ctx(),before=structuredClone(c),result=tick(w,c),next=result.state.wings[0];
    const n=Math.floor(B.replacementPerLevel*level);
    expect(next.organization).toBe(30+B.organizationRecovery*level);
    expect(next.strength).toBe(40+B.strengthRecovery*level);expect(next.aircraftCount).toBe(10+n);
    expect(result.countries.find(c=>c.tag==='BRA')!.resources.gold).toBeCloseTo(1000-10*AIRCRAFT_TYPES.FIGHTER.maintenance-n*B.replacementGold);
    const market=result.provinces.find(p=>p.id===w.baseProvinceId)!.market!;
    expect(market.goods.iron.stock).toBe(100-n*B.replacementIron);expect(market.goods.tools.stock).toBe(100-n*B.replacementTools);
    expect(c).toEqual(before);
  });
  it('returns on the same tick all three thresholds are reached and restores original order',()=>{
    const w=recovering({organization:80-B.organizationRecovery*level,strength:70-B.strengthRecovery*level,aircraftCount:18-Math.floor(B.replacementPerLevel*level),recovery:{mission:'INTERCEPTION',airZoneId:zone.id}});
    expect(tick(w).state.wings[0]).toMatchObject({status:'MISSION',organization:80,strength:70,aircraftCount:18,mission:'INTERCEPTION',assignedAirZoneId:zone.id,recovery:undefined});
  });
  it.each(['organization','strength','aircraftCount'] as const)('waits if %s remains below the return threshold',field=>{
    const patches={organization:79-B.organizationRecovery*level,strength:69-B.strengthRecovery*level,aircraftCount:17-Math.floor(B.replacementPerLevel*level)};
    const w=recovering({organization:80,strength:70,aircraftCount:18,[field]:patches[field]});
    expect(tick(w).state.wings[0].status).toBe('RECOVERING');
  });
  it('rounds the 75 percent aircraft threshold up',()=>{
    const c=ctx();c.countries.find(c=>c.tag==='BRA')!.resources.gold=0;
    expect(tick(recovering({maxAircraft:25,aircraftCount:18}),c).state.wings[0].status).toBe('RECOVERING');
    expect(tick(recovering({maxAircraft:25,aircraftCount:19}),c).state.wings[0].status).toBe('MISSION');
  });
  it.each(['mission','zone','range','base'])('clears an invalid preserved %s and becomes READY',fault=>{
    let w=recovering({organization:30}),c=ctx();
    if(fault==='mission')w={...w,recovery:{mission:'BOMBING',airZoneId:zone.id}};
    if(fault==='zone')w={...w,recovery:{mission:'AIR_SUPERIORITY',airZoneId:'missing'}};
    if(fault==='range')c={...c,provinces:c.provinces.map(p=>p.id===w.baseProvinceId?{...p,center:{x:1e9,y:1e9}}:p)};
    if(fault==='base')c={...c,provinces:c.provinces.map(p=>p.id===w.baseProvinceId?{...p,owner:'ARG'}:p)};
    const next=tick(w,c).state.wings[0];expect(next.status).toBe('READY');expect(next.recovery).toBeUndefined();
  });
  it('manual cancellation forgets recovery and a valid new mission overrides it',()=>{
    const w=recovering({organization:30});
    expect(cancelAirMission(w)).toMatchObject({status:'READY',recovery:undefined,mission:undefined,assignedAirZoneId:undefined});
    expect(assignAirMission(w,'INTERCEPTION',zone.id,ctx())).toMatchObject({status:'MISSION',mission:'INTERCEPTION',recovery:undefined});
    expect(assignAirMission(w,'BOMBING',zone.id,ctx())).toBeNull();expect(w.status).toBe('RECOVERING');
  });
  it('rebase clears recovery and completes normally',()=>{
    const w=recovering(),c=ctx(),target=airBases.find(b=>b.provinceId!==w.baseProvinceId && c.provinces.find(p=>p.id===b.provinceId)?.owner==='BRA')!;
    const rebased=rebaseAirWing(w,target.provinceId,state(w),c)!;
    expect(rebased).toMatchObject({status:'REBASING',recovery:undefined});
    const next=tick({...rebased,rebase:{...rebased.rebase!,daysRemaining:1}},c).state.wings[0];
    expect(next).toMatchObject({status:'READY',baseProvinceId:target.provinceId,recovery:undefined});
  });
  it('cleanup evacuates a recovering wing after capture or removes it without access',()=>{
    const w=recovering(),c=ctx();
    const captured={...c,provinces:c.provinces.map(p=>p.id===w.baseProvinceId?{...p,owner:'ARG'}:p)};
    const next=cleanupAirState(state(w),captured).wings[0];
    expect(next.status).toBe('READY');expect(next.recovery).toBeUndefined();expect(next.baseProvinceId).not.toBe(w.baseProvinceId);
    const noAccess={...c,provinces:c.provinces.map(p=>p.owner==='BRA'?{...p,owner:'ARG'}:p)};
    expect(cleanupAirState(state(w),noAccess).wings).toEqual([]);
  });
  it('round-trips RECOVERING and preserves legacy READY and MISSION saves',()=>{
    for(const w of [recovering({organization:30}),mission(),{...seed,status:'READY' as const}]){
      const loaded=readAirSave(JSON.parse(JSON.stringify(state(w))),ctx());expect(loaded.wings[0]).toEqual(w);
    }
    expect(readAirSave(undefined,ctx())).toEqual(state());
  });
  it.each([
    {recovery:undefined},{recovery:{mission:'BOMBING',airZoneId:zone.id}},
    {recovery:{mission:'AIR_SUPERIORITY',airZoneId:'missing'}},
    {mission:'AIR_SUPERIORITY'},{assignedAirZoneId:zone.id},
    {rebase:{targetProvinceId:seed.baseProvinceId,totalDays:1,daysRemaining:1}},
    {status:'READY'},{status:'MISSION',mission:'AIR_SUPERIORITY',assignedAirZoneId:zone.id},
    {status:'REBASING'},
  ])('rejects invalid recovery save %j',patch=>{
    expect(()=>readAirSave({wings:[{...recovering(),...patch}]},ctx())).toThrow('invalid wing');
  });
});
