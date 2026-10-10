import {describe, expect, it} from 'vitest';
import {countries, provincesData} from '../../data/map';
import {AIR_BALANCE as B} from '../../data/aircraft';
import type {War} from '../../types';
import type {AirState, AirWing} from '../../types/air';
import {airBases, airCombatTick, airMissionEfficiency, airZoneByProvinceId, createInitialAirState, type AirContext} from '../air';
import {readAirSave} from '../air/save';

const seed = createInitialAirState(countries, provincesData).wings.find(w => w.countryTag === 'BRA')!;
const zone = airZoneByProvinceId.get(seed.baseProvinceId)!;
const war: War = {id:'v2',attacker:'BRA',defender:'BOL',startDate:{year:1444,month:11,day:11},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]};
// Separate owned bases at the same center control range and efficiency.
const bolBase = airBases.find(b => b.provinceId !== seed.baseProvinceId)!;
const ctx: AirContext = {countries, provinces:provincesData.map(p => p.id === bolBase.provinceId ?
  {...p,owner:'BOL',center:provincesData.find(p=>p.id===seed.baseProvinceId)!.center} : p), wars:[war], relations:[
  {countryA:'BRA',countryB:'ARG',opinion:0,trust:0,status:'peace',alliance:{since:0}} as AirContext['relations'][number],
]};
const wing = (tag: string, n: number, id = tag): AirWing => ({...seed,id,countryTag:tag,type:'FIGHTER',baseProvinceId:tag==='BOL'?bolBase.provinceId:seed.baseProvinceId,aircraftCount:n,maxAircraft:n,strength:100,organization:100,status:'MISSION',mission:'AIR_SUPERIORITY',assignedAirZoneId:zone.id});
const state = (...wings: AirWing[]): AirState => ({wings,engagements:[]});
const tick = (s: AirState, day = 0) => airCombatTick(s, ctx, day);
const lost = (s: AirState, tag: string) => s.reports![0].lossesByCountry[tag] ?? 0;
const key = (a: string, b: string) => JSON.stringify([zone.id,a,b]);

describe('Air warfare V2 country fighter combat', () => {
  it('24 vs 24 accumulates symmetric deterministic losses', () => {
    const s=state(wing('BRA',24),wing('BOL',24));
    expect(airMissionEfficiency(s.wings[1],ctx)).toBe(1);
    const first=tick(s); expect(lost(first,'BRA')).toBe(0); expect(lost(first,'BOL')).toBe(0);
    const second=tick(first,1); expect(lost(second,'BRA')).toBe(1); expect(lost(second,'BOL')).toBe(1);
    expect(tick(tick(s),1)).toEqual(second);
  });
  it('96 vs 24 causes significantly more losses to the weaker side', () => {
    const next=tick(state(wing('BRA',96),wing('BOL',24)));
    expect(lost(next,'BOL')).toBe(4); expect(lost(next,'BRA')).toBe(0);
  });
  it('fragmentation preserves side totals and fractional budgets', () => {
    const a=tick(state(...[24,24,24,24].map((n,i)=>wing('BRA',n,`a${i}`)),wing('BOL',24)));
    const b=tick(state(wing('BRA',32,'x'),wing('BRA',64,'y'),wing('BOL',24)));
    expect(a.reports![0].lossesByCountry).toEqual(b.reports![0].lossesByCountry);
    expect(a.fighterLossRemainders).toEqual(b.fighterLossRemainders);
  });
  it('reversing the wing array preserves all combat results', () => {
    const ws=[wing('BRA',24,'a'),wing('BRA',72,'b'),wing('BOL',24)];
    const a=tick(state(...ws)),b=tick(state(...ws.reverse()));
    expect(a.engagements).toEqual(b.engagements); expect(a.reports).toEqual(b.reports);
    expect(a.fighterLossRemainders).toEqual(b.fighterLossRemainders);
    expect([...a.wings].sort((x,y)=>x.id.localeCompare(y.id))).toEqual([...b.wings].sort((x,y)=>x.id.localeCompare(y.id)));
  });
  it('neutral and allied wings receive zero losses and organization damage', () => {
    const ally=wing('ARG',24); const next=tick(state(wing('BRA',96),wing('BOL',24),ally));
    expect(next.wings.find(w=>w.id===ally.id)).toEqual(ally);
    const peace=airCombatTick(state(wing('BRA',24),wing('ARG',24)),{...ctx,wars:[]},0);
    expect(peace.engagements).toEqual([]); expect(peace.wings.every(w=>w.aircraftCount===24 && w.organization===100)).toBe(true);
  });
  it('fractional carry crosses one and retains the exact remainder across ticks', () => {
    const first=tick(state(wing('BRA',24),wing('BOL',24)));
    expect(first.fighterLossRemainders![key('BRA','BOL')]).toBeCloseTo(.6);
    const second=tick(first,1);
    expect(second.engagements[0].losses.BOL).toBe(1);
    expect(second.fighterLossRemainders![key('BRA','BOL')]).toBeCloseTo(.152);
    expect(Object.values(second.fighterLossRemainders!).every(n=>n>=0 && n<1)).toBe(true);
  });
  it('distribution applies the exact capped total with ID tie-breaks', () => {
    const next=tick(state(wing('BRA',96),...['z','a','b'].map(id=>wing('BOL',8,id))));
    expect(next.engagements[0].losses).toMatchObject({a:2,b:1,z:1});
    expect(['a','b','z'].reduce((s,id)=>s+next.engagements[0].losses[id],0)).toBe(4);
    const capped=tick(state(wing('BRA',1000),wing('BOL',1)));
    expect(capped.engagements[0].losses.BOL).toBe(1); expect(capped.wings.some(w=>w.id==='BOL')).toBe(false);
  });
  it('updates organization for engagement and strength for actual aircraft losses', () => {
    const next=tick(state(wing('BRA',96),wing('BOL',24)));
    expect(next.wings.find(w=>w.id==='BRA')).toMatchObject({organization:100-B.combatOrganizationLoss,strength:100});
    expect(next.wings.find(w=>w.id==='BOL')!.strength).toBeCloseTo(100-4/24*100);
  });
  it('ignores nonoperational fighters and includes interception fighters', () => {
    expect(tick(state(wing('BRA',24),{...wing('BOL',24),organization:0})).engagements).toEqual([]);
    expect(tick(state({...wing('BRA',96),mission:'INTERCEPTION'},wing('BOL',24))).engagements[0].losses.BOL).toBe(4);
  });
  it('loads legacy saves and round-trips carry with the same next tick', () => {
    const s=state(wing('BRA',24),wing('BOL',24));
    expect(readAirSave(s,ctx).fighterLossRemainders).toBeUndefined();
    const next=tick(s), loaded=readAirSave(JSON.parse(JSON.stringify(next)),ctx);
    expect(loaded.fighterLossRemainders).toEqual(next.fighterLossRemainders);
    expect(tick(loaded,1)).toEqual(tick(next,1));
  });
  it.each([-1,1,NaN,Infinity])('rejects invalid saved carry %s', n => {
    expect(()=>readAirSave({...state(),fighterLossRemainders:{[key('BRA','BOL')]:n}},ctx)).toThrow('invalid fighter loss remainder');
  });
});
