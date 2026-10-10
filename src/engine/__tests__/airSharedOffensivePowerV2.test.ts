import {describe, expect, it} from 'vitest';
import {countries, provincesData} from '../../data/map';
import {AIR_BALANCE as B, AIRCRAFT_TYPES} from '../../data/aircraft';
import type {War} from '../../types';
import type {AirState, AirWing} from '../../types/air';
import {airBases, airCombatTick, airMissionEfficiency, airZones, type AirContext} from '../air';

const tags=['BRA','ARG','BOL','CHL','PER','USA','URY'];
const bases=new Map(tags.map((tag,i)=>[tag,airBases[i].provinceId]));
const zone=airZones[0];
const otherZone=airZones[1];
const center={x:(zone.center.x+otherZone.center.x)/2,y:(zone.center.y+otherZone.center.y)/2};
const war: War={id:'shared',attacker:'BRA',defender:'BOL',startDate:{year:1444,month:11,day:11},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]};
const context=(enemies: string[]): AirContext=>({countries,provinces:provincesData.map(p=>{
  const tag=tags.find(tag=>bases.get(tag)===p.id);
  return tag?{...p,owner:tag,center}:p;
}),wars:enemies.map(tag=>({...war,id:`war-${tag}`,defender:tag})),relations:[
  {countryA:'BRA',countryB:'USA',opinion:0,trust:0,status:'peace',alliance:{since:0}},
]});
const wing=(tag: string,n: number,id=tag): AirWing=>({id,countryTag:tag,name:id,type:'FIGHTER',aircraftCount:n,maxAircraft:n,strength:100,organization:100,baseProvinceId:bases.get(tag)!,assignedAirZoneId:zone.id,status:'MISSION',mission:'AIR_SUPERIORITY'});
const state=(...wings: AirWing[]): AirState=>({wings,engagements:[]});
const pairKey=(a: string,b: string,z=zone.id)=>JSON.stringify([z,a,b]);
const tick=(s: AirState,enemies: string[],day=0)=>airCombatTick(s,context(enemies),day);
// With one attacker per target, applied losses + carry expose its exact pair budget.
const pairBudget=(s: AirState,attacker: string,defender: string)=>
  (s.engagements[0].losses[defender]??0)+(s.fighterLossRemainders![pairKey(attacker,defender)]??0);
const recoveredAllocation=(s: AirState,defender: string,totalPower: number,attackerEffective: number)=>{
  const ratio=Math.min(2,Math.max(.5,Math.sqrt(attackerEffective*AIRCRAFT_TYPES.FIGHTER.airAttack/Math.max(1,totalPower))));
  return pairBudget(s,'BRA',defender)/(B.combatLossRate*ratio);
};

describe('Air V2 shared offensive budget',()=>{
  it('keeps single-enemy 96 vs 24 behavior unchanged',()=>{
    const next=tick(state(wing('BRA',96),wing('BOL',24)),['BOL']);
    expect(next.engagements[0].losses).toEqual({BRA:0,BOL:4});
    expect(pairBudget(next,'BRA','BOL')).toBeCloseTo(4.8,12);
    expect(next.fighterLossRemainders![pairKey('BOL','BRA')]).toBeCloseTo(.3,12);
  });
  it('splits 96 equally into four allocations of 24',()=>{
    const enemies=['ARG','BOL','CHL','PER'];
    const next=tick(state(wing('BRA',96),...enemies.map(tag=>wing(tag,24))),enemies);
    for(const tag of enemies){
      expect(pairBudget(next,'BRA',tag)).toBeCloseTo(.6,12);
      expect(recoveredAllocation(next,tag,96*8,96)).toBeCloseTo(24,12);
    }
  });
  it('conserves the effective budget with unequal counts and efficiencies',()=>{
    const enemies=['ARG','BOL','CHL'];
    const ws=[{...wing('BRA',90),organization:80},wing('ARG',60),{...wing('BOL',30),strength:50},wing('CHL',10)];
    const ctx=context(enemies),next=airCombatTick(state(...ws),ctx,0);
    const effective=ws[0].aircraftCount*airMissionEfficiency(ws[0],ctx);
    const hostilePower=ws.slice(1).reduce((sum,w)=>sum+w.aircraftCount*airMissionEfficiency(w,ctx)*8,0);
    expect(enemies.reduce((sum,tag)=>sum+recoveredAllocation(next,tag,hostilePower,effective),0)).toBeCloseTo(effective,12);
  });
  it('allocates 80 percent to ARG and 20 percent to BOL by effective power',()=>{
    const next=tick(state(wing('BRA',90),wing('ARG',80),wing('BOL',20)),['ARG','BOL']);
    expect(recoveredAllocation(next,'ARG',100*8,90)).toBeCloseTo(72,12);
    expect(recoveredAllocation(next,'BOL',100*8,90)).toBeCloseTo(18,12);
  });
  it('does not multiply the budget when operational enemies are added',()=>{
    for(const enemies of [['BOL'],['BOL','ARG'],['BOL','ARG','CHL','PER']]){
      const next=tick(state(wing('BRA',96),...enemies.map(tag=>wing(tag,24))),enemies);
      const allocations=enemies.map(tag=>recoveredAllocation(next,tag,enemies.length*24*8,96));
      expect(allocations.reduce((sum,n)=>sum+n,0)).toBeCloseTo(96,12);
    }
  });
  it('equivalent coalition uses bounded opposing budgets with the prescribed pair ratios',()=>{
    const enemies=['ARG','BOL','CHL','PER'];
    const next=tick(state(wing('BRA',96),...enemies.map(tag=>wing(tag,24))),enemies);
    const coalitionExpected=enemies.reduce((sum,tag)=>sum+pairBudget(next,'BRA',tag),0);
    const braExpected=next.engagements[0].losses.BRA+enemies.reduce((sum,tag)=>sum+next.fighterLossRemainders![pairKey(tag,'BRA')],0);
    expect(coalitionExpected).toBeCloseTo(2.4,12);
    expect(braExpected).toBeCloseTo(1.2,12);
    // Each defender faces the full BRA power, so its ratio is .5 rather than 1.
    expect(coalitionExpected/braExpected).toBeCloseTo(2,12);
  });
  it('is deterministic across reordered wings, countries, wars and zone insertion',()=>{
    const enemies=['ARG','BOL','CHL','PER'];
    const ws=[wing('BRA',96),...enemies.map(tag=>wing(tag,24))];
    const second=ws.map(w=>({...w,id:`second-${w.id}`,assignedAirZoneId:otherZone.id}));
    const ctx=context(enemies);
    expect([...ws,...second].every(w=>airMissionEfficiency(w,ctx)>0)).toBe(true);
    const a=airCombatTick(state(...ws,...second),ctx,0);
    const reversed={...ctx,countries:[...ctx.countries].reverse(),wars:[...ctx.wars].reverse(),provinces:[...ctx.provinces].reverse()};
    const b=airCombatTick(state(...[...ws,...second].reverse()),reversed,0);
    expect(a.engagements).toEqual(b.engagements); expect(a.reports).toEqual(b.reports);
    expect(a.fighterLossRemainders).toEqual(b.fighterLossRemainders);
    expect([...a.wings].sort((x,y)=>x.id.localeCompare(y.id))).toEqual([...b.wings].sort((x,y)=>x.id.localeCompare(y.id)));
  });
  it('excludes neutral, allied and nonoperational enemies from allocations and denominator',()=>{
    const basic=state(wing('BRA',96),wing('BOL',24));
    const extra=[wing('USA',1000),wing('URY',1000),{...wing('ARG',1000),organization:0}];
    const a=tick(basic,['BOL','ARG']),b=tick(state(...basic.wings,...extra),['BOL','ARG']);
    expect(a.engagements).toEqual(b.engagements); expect(a.fighterLossRemainders).toEqual(b.fighterLossRemainders);
    for(const w of extra)expect(b.wings.find(x=>x.id===w.id)).toEqual(w);
    expect(Object.keys(b.fighterLossRemainders!)).toHaveLength(2);
  });
  it('retains pair carry when shares change and applies only actual integer losses',()=>{
    const first=tick(state(wing('BRA',96),wing('ARG',24),wing('BOL',24)),['ARG','BOL']);
    const previous=first.fighterLossRemainders![pairKey('BRA','BOL')];
    const ws=first.wings.map(w=>w.countryTag==='ARG'?{...w,organization:0}:w);
    const next=tick({...first,wings:ws},['ARG','BOL'],1);
    const bra=ws.find(w=>w.countryTag==='BRA')!,bol=ws.find(w=>w.countryTag==='BOL')!;
    const ctx=context(['ARG','BOL']);
    const effective=bra.aircraftCount*airMissionEfficiency(bra,ctx);
    const defenderPower=bol.aircraftCount*airMissionEfficiency(bol,ctx)*8;
    const ratio=Math.min(2,Math.max(.5,Math.sqrt(effective*8/Math.max(1,defenderPower))));
    const budget=previous+effective*B.combatLossRate*ratio;
    expect(next.engagements[0].losses.BOL).toBe(Math.floor(budget));
    expect(next.fighterLossRemainders![pairKey('BRA','BOL')]).toBeCloseTo(budget-Math.floor(budget),12);
    expect(next.fighterLossRemainders![pairKey('BRA','ARG')]).toBe(first.fighterLossRemainders![pairKey('BRA','ARG')]);
    expect(Object.values(next.fighterLossRemainders!).every(n=>n>=0&&n<1)).toBe(true);
  });
});
