import {describe,expect,it} from 'vitest';
import {countries,provincesData} from '../../data/map';
import {AIR_BALANCE as B,AIRCRAFT_TYPES} from '../../data/aircraft';
import type {AirState,AirWing} from '../../types/air';
import {airBases,airZoneByProvinceId,airAITick,airMissionsTick,assignAirMission,cancelAirMission,rebaseAirWing,type AirContext} from '../air';
import {readAirSave} from '../air/save';
import {createDefaultMarket} from '../market';

function fixture(level:1|2|3=1,status:AirWing['status']='MISSION'){
  const base=airBases.find(b=>b.level===level)!;
  const zone=airZoneByProvinceId.get(base.provinceId)!;
  const provinces=structuredClone(provincesData),cs=structuredClone(countries);
  const p=provinces.find(p=>p.id===base.provinceId)!;p.owner='BRA';p.center={...zone.center};p.market=createDefaultMarket();p.market.goods.iron.stock=100;p.market.goods.tools.stock=100;
  cs.find(c=>c.tag==='BRA')!.resources.gold=1000;
  const ctx:AirContext={provinces,countries:cs,wars:[],relations:[]};
  const wing:AirWing={id:'operational',name:'Operational',countryTag:'BRA',type:'FIGHTER',aircraftCount:16,maxAircraft:24,organization:90,strength:75,baseProvinceId:base.provinceId,status,
    ...(status==='MISSION'?{mission:'AIR_SUPERIORITY',assignedAirZoneId:zone.id} as const:{}),
    ...(status==='RECOVERING'?{recovery:{mission:'AIR_SUPERIORITY',airZoneId:zone.id}} as const:{}),
  };
  return {ctx,wing,base,zone,state:{wings:[wing],engagements:[]} as AirState};
}
function advance(s:AirState,ctx:AirContext,days:number){
  let result=airMissionsTick(s,ctx);
  for(let day=1;day<days;day++)result=airMissionsTick(result.state,{...ctx,countries:result.countries,provinces:result.provinces});
  return result;
}

describe('Operational air replacements V2',()=>{
  it.each([1,2,3] as const)('MISSION level %s uses the halved rate with bounded carry',level=>{
    const f=fixture(level);
    const rate=[.125,.25,.375][level-1];
    for(let days=1;days<=8;days++){
      const next=advance(f.state,f.ctx,days).state.wings[0];
      expect(next.aircraftCount).toBe(16+Math.floor(days*rate));
      expect(next.replacementRemainder).toBe(days*rate-Math.floor(days*rate));
      expect(next.replacementRemainder).toBeGreaterThanOrEqual(0);
      expect(next.replacementRemainder).toBeLessThan(1);
    }
  });
  it.each((['READY','RECOVERING'] as const).flatMap(status=>([1,2,3] as const).map(level=>({status,level}))))('$status level $level accumulates full fractional capacity',({status,level})=>{
    const f=fixture(level,status);
    // Keep RECOVERING below its return thresholds across both ticks.
    f.wing.organization=30;
    const first=advance(f.state,f.ctx,1).state.wings[0];
    expect(first.aircraftCount).toBe(16+Math.floor(level*.5));
    expect(first.replacementRemainder).toBe(level*.5-Math.floor(level*.5));
    const second=advance(f.state,f.ctx,2).state.wings[0];
    expect(second.aircraftCount).toBe(16+level);expect(second.replacementRemainder).toBe(0);
  });
  it.each(['READY','RECOVERING'] as const)('%s reuses saved fractional progress',status=>{
    const f=fixture(3,status);f.wing.replacementRemainder=.75;
    const next=airMissionsTick(f.state,f.ctx).state.wings[0];
    expect(next.aircraftCount).toBe(18);expect(next.replacementRemainder).toBe(.25);
    expect(next.organization).toBe(100);expect(next.strength).toBe(81);
  });
  it('REBASING adds no aircraft, does not advance carry and retains normal timing',()=>{
    const f=fixture(3,'REBASING'),target=airBases.find(b=>b.provinceId!==f.base.provinceId)!;
    f.ctx={...f.ctx,provinces:f.ctx.provinces.map(p=>p.id===target.provinceId?{...p,owner:'BRA'}:p)};
    f.wing.rebase={targetProvinceId:target.provinceId,totalDays:10,daysRemaining:10};f.wing.replacementRemainder=.75;
    expect(airMissionsTick(f.state,f.ctx).state.wings[0]).toMatchObject({aircraftCount:16,replacementRemainder:.75,rebase:{daysRemaining:9},organization:90,strength:75});
  });
  it('MISSION spends maintenance and mission organization without recovering strength',()=>{
    const f=fixture(),next=advance(f.state,f.ctx,8).state.wings[0];
    expect(next.aircraftCount).toBe(17);expect(next.organization).toBe(90-8*B.missionOrganizationLoss);expect(next.strength).toBe(75);expect(next.status).toBe('MISSION');
  });
  it.each(['gold','iron','tools'] as const)('missing %s prevents delivery and stores no integer debt',resource=>{
    const f=fixture(3);
    const p=f.ctx.provinces.find(p=>p.id===f.base.provinceId)!;
    if(resource==='gold')f.ctx.countries.find(c=>c.tag==='BRA')!.resources.gold=0;
    else p.market!.goods[resource].stock=0;
    const starved=advance(f.state,f.ctx,8);
    expect(starved.state.wings[0]).toMatchObject({aircraftCount:16,replacementRemainder:0});
    const countries=structuredClone(starved.countries),provinces=structuredClone(starved.provinces);
    countries.find(c=>c.tag==='BRA')!.resources.gold=1000;
    const market=provinces.find(p=>p.id===f.base.provinceId)!.market!;market.goods.iron.stock=100;market.goods.tools.stock=100;
    const next=airMissionsTick(starved.state,{...f.ctx,countries,provinces});
    expect(next.state.wings[0]).toMatchObject({aircraftCount:16,replacementRemainder:.375});
    expect(advance(next.state,{...f.ctx,countries:next.countries,provinces:next.provinces},2).state.wings[0].aircraftCount).toBe(17);
  });
  it('caps aircraft at max and charges only actual deliveries',()=>{
    const f=fixture(3);f.wing.aircraftCount=23;f.wing.replacementRemainder=.75;
    const first=airMissionsTick(f.state,f.ctx);expect(first.state.wings[0]).toMatchObject({aircraftCount:24,replacementRemainder:.125});
    const gold=first.countries.find(c=>c.tag==='BRA')!.resources.gold;
    expect(gold).toBeCloseTo(1000-23*AIRCRAFT_TYPES.FIGHTER.maintenance-B.replacementGold);
    const market=first.provinces.find(p=>p.id===f.base.provinceId)!.market!;
    expect(market.goods.iron.stock).toBe(98);expect(market.goods.tools.stock).toBe(99);
    const full=airMissionsTick(first.state,{...f.ctx,countries:first.countries,provinces:first.provinces});
    expect(full.state.wings[0].aircraftCount).toBe(24);
    expect(full.countries.find(c=>c.tag==='BRA')!.resources.gold).toBeCloseTo(gold-24*AIRCRAFT_TYPES.FIGHTER.maintenance);
    expect(full.provinces.find(p=>p.id===f.base.provinceId)!.market!.goods).toEqual(market.goods);
  });
  it('uses the same rule for player and AI',()=>{
    const f=fixture();
    const player=airAITick(f.state,new Set(['BRA']),'BRA',f.ctx,[]).state;
    const ai=airAITick(f.state,new Set(['BRA']),'USA',f.ctx,[]).state;
    expect(advance(player,f.ctx,8)).toEqual(advance(ai,f.ctx,8));
  });
  it('spends scarce shared resources deterministically regardless of wing order',()=>{
    const f=fixture(3);f.wing.replacementRemainder=.75;
    f.ctx.provinces.find(p=>p.id===f.base.provinceId)!.market!.goods.iron.stock=2;
    const wings=[{...f.wing,id:'b'},{...f.wing,id:'a'}];
    const a=airMissionsTick({wings,engagements:[]},f.ctx),b=airMissionsTick({wings:[...wings].reverse(),engagements:[]},f.ctx);
    expect([...a.state.wings].sort((x,y)=>x.id.localeCompare(y.id))).toEqual([...b.state.wings].sort((x,y)=>x.id.localeCompare(y.id)));
    expect(a.state.wings.find(w=>w.id==='a')!.aircraftCount).toBe(17);expect(a.state.wings.find(w=>w.id==='b')!.aircraftCount).toBe(16);
    expect(a.countries).toEqual(b.countries);expect(a.provinces).toEqual(b.provinces);
  });
  it('fraction follows the wing across mission override, cancellation, recovery and rebase',()=>{
    const f=fixture();f.wing.replacementRemainder=.5;
    expect(assignAirMission(f.wing,'INTERCEPTION',f.zone.id,f.ctx)!.replacementRemainder).toBe(.5);
    expect(cancelAirMission(f.wing).replacementRemainder).toBe(.5);
    const withdrawn=airMissionsTick({wings:[{...f.wing,organization:39}],engagements:[]},f.ctx).state.wings[0];
    expect(withdrawn.status).toBe('RECOVERING');expect(withdrawn.replacementRemainder).toBe(0);
    const target=airBases.find(b=>b.provinceId!==f.base.provinceId)!;
    const c={...f.ctx,provinces:f.ctx.provinces.map(p=>p.id===target.provinceId?{...p,owner:'BRA'}:p)};
    expect(rebaseAirWing(f.wing,target.provinceId,f.state,c)!.replacementRemainder).toBe(.5);
  });
  it('save/load preserves fractional progress and legacy missing remainder',()=>{
    const f=fixture(),first=airMissionsTick(f.state,f.ctx);
    const c={...f.ctx,countries:first.countries,provinces:first.provinces};
    const loaded=readAirSave(JSON.parse(JSON.stringify(first.state)),c);
    expect(loaded.wings[0].replacementRemainder).toBe(.125);
    expect(advance(loaded,c,7)).toEqual(advance(first.state,c,7));
    expect(readAirSave(f.state,f.ctx).wings[0].replacementRemainder).toBeUndefined();
  });
  it.each([NaN,Infinity,-Infinity,-.1,1,2,'0.5',null])('rejects invalid saved remainder %s',replacementRemainder=>{
    const f=fixture();expect(()=>readAirSave({wings:[{...f.wing,replacementRemainder}]},f.ctx)).toThrow('invalid wing');
  });
});
