// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Army, Province, War, CombatResult, BattleExtended } from '../../types';
import { startContinuousBattle, processBattleDay, checkAllProvinceCombats, addReinforcementsToBattle, calculateArmySize, getValidParticipantsBySide, getReinforcementSide, findRetreatProvince } from '../combat';
import { calculateArmyOrganization, issueMoveCommand, getArmyReorganizationBlockReason } from '../military';
import { processBattleArrival } from '../../hooks/gameLoop/battleArrivalTick';
import { processBattleContinuous } from '../../hooks/gameLoop/battleContinuousTick';
import { createInitialTechState } from '../technology';
import { applyMilitaryCasualties } from '../population';
import { countries } from '../../data/map';
import { ActiveBattlePanel } from '../../components/ActiveBattlePanel';
import { BattleReportModal } from '../../components/BattleReportModal';
import { saveGame, loadGame } from '../saveSystem';
import { normalizeBattleSave } from '../combat/battleSave';
import { createBattleHostility } from '../combat';
import { createInitialAirState, airZoneByProvinceId, assignAirMission, getAirSupportForBattle, getAirSuperiorityModifier } from '../air';
import { provincesData } from '../../data/map';
import * as territory from '../territoryTransfer';
import { battleEndFeedback } from '../../components/militaryPresentation';

const date={year:1500,month:1,day:1};
const province=(id='front',owner='ARG',extra:Partial<Province>={}):Province=>({id,name:id,owner,color:'#000',neighbors:['a-home','d-home'],population:{total:100000,growthRate:0,employed:0,unemployed:100000,satisfaction:60},maxPopulation:100000,development:1,buildings:[],defense:0,center:{x:0,y:0},path:'',unrest:0,...extra});
const army=(id:string,owner:string,strength=10000,org=100):Army=>({id,name:id,owner,location:'front',regiments:[{type:'infantry',strength,maxStrength:1000,morale:100,organization:org,originProvinceId:owner==='BRA'?'a-home':'d-home'}],destination:null,targetDestination:null,path:[],movementProgress:0,movementSpeed:1,position:null});
const war:War={id:'war',attacker:'BRA',defender:'ARG',startDate:date,warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]};
const homes=[province('a-home','BRA'),province('d-home','ARG')];
function fixture(a=10000,d=10000,extra:Partial<Province>={}) {
  const field=province('front','ARG',extra), armies=[army('a','BRA',a),army('d','ARG',d)];
  const battle=startContinuousBattle([armies[0]],[armies[1]],field,date,'battle');
  return {field,armies,battle,provinces:[field,...homes]};
}
function duration(a=10000,d=10000,extra:Partial<Province>={},multipliers=new Map<string,number>()) {
  const f=fixture(a,d,extra); let battle=f.battle, armies=f.armies, result, days=0;
  do {result=processBattleDay(battle,armies,f.field,f.provinces,multipliers); battle=result.battle;armies=result.armies;days++;} while(!result.finished && days<150);
  return {...result,days};
}
function tickParams(f:ReturnType<typeof fixture>, wars=[war]) {
  const history:CombatResult[]=[];
  return {p:{...f,armies:f.armies,provinces:f.provinces,countries:countries.filter(c=>['BRA','ARG'].includes(c.tag)),wars,relations:[],currentActiveBattles:[f.battle],recruitments:[],buildingConstructions:[],snapshot:{date},playerCountryTag:'BRA',allCountries:countries,playerTechState:createInitialTechState('BRA'),botTechStates:new Map(),addLog:vi.fn(),addToast:vi.fn(),setActiveBattles:vi.fn(),setArmies:vi.fn(),setBattleHistory:(update:React.SetStateAction<CombatResult[]>)=>{history.splice(0,history.length,...(typeof update==='function'?update(history):update));},setBattleReport:vi.fn(),setIsPaused:vi.fn(),activeBattlesRef:{current:[f.battle]},cancelProvinceActivities:vi.fn()},history};
}
describe('Battle V3 canonical rounds',()=>{
  it.each([[1,1],[2,1],[1,2],[3,3]])('%iv%i tracks every army and distributes strength loss', (a,d)=>{
    const f=fixture();const armies=[...Array.from({length:a},(_,i)=>army(`a${i}`,'BRA')),...Array.from({length:d},(_,i)=>army(`d${i}`,'ARG'))];
    const battle=startContinuousBattle(armies.slice(0,a),armies.slice(a),f.field,date,'multi');
    const result=processBattleDay(battle,armies,f.field,f.provinces);
    expect(result.armies.every(x=>calculateArmySize(x)<10000)).toBe(true);
    expect(result.battle.attackerCasualties).toBe(armies.slice(0,a).reduce((s,x)=>s+calculateArmySize(x),0)-result.armies.slice(0,a).reduce((s,x)=>s+calculateArmySize(x),0));
  });
  it.each(['attacker','defender'] as const)('%s representative disappears while side survives', side=>{
    const f=fixture(), extra=army('extra',side==='attacker'?'BRA':'ARG');
    const b=addReinforcementsToBattle(f.battle,extra,side,f.field);
    const result=processBattleDay(b,[...f.armies.filter(a=>a.id!==(side==='attacker'?'a':'d')),extra],f.field,f.provinces);
    expect(result.finished).toBe(false);expect(result.battle[side==='attacker'?'attackerArmyId':'defenderArmyId']).toBe('extra');
  });
  it.each(['attacker','defender'] as const)('empty %s ends and releases survivors',side=>{
    const f=fixture();const result=processBattleDay(f.battle,f.armies.filter(a=>a.id!==(side==='attacker'?'a':'d')),f.field,f.provinces);
    expect(result.finished).toBe(true);expect(result.battle.endReason).toBe('side_empty');expect(result.armies[0].inCombat).toBe(false);
  });
  it('organization pressure exceeds relative strength loss',()=>{
    const f=fixture();const r=processBattleDay(f.battle,f.armies,f.field,f.provinces);
    for(const a of r.armies) expect(100-calculateArmyOrganization(a)).toBeGreaterThan((10000-calculateArmySize(a))/100);
  });
  it('zero rounded strength loss still damages organization',()=>{
    const f=fixture(1,1);const r=processBattleDay(f.battle,f.armies,f.field,f.provinces);
    expect(r.battle.attackerCasualties).toBe(0);expect(calculateArmyOrganization(r.armies[0])).toBeLessThan(100);
  });
  it('armies below organization threshold no longer exert combat pressure',()=>{
    const f=fixture();f.armies[1]=army('d','ARG',10000,1);
    const result=processBattleDay(f.battle,f.armies,f.field,f.provinces);
    expect(result.battle.attackerCasualties).toBe(0);expect(calculateArmyOrganization(result.armies[0])).toBe(100);expect(result.finished).toBe(true);
  });
  it('balanced fixture lasts 5–15 days',()=>expect(duration().days).toBeGreaterThanOrEqual(5));
  it('balanced fixture remains within gameplay band',()=>expect(duration().days).toBeLessThanOrEqual(15));
  it('overwhelming force breaks faster',()=>expect(duration(50000).days).toBeLessThan(duration().days));
  it('mountains prolong combat',()=>expect(duration(10000,10000,{terrain:'mountains'}).days).toBeGreaterThan(duration().days));
  it('fortress prolongs combat',()=>expect(duration(10000,10000,{defense:5,buildings:[{type:'fortress',level:5,daysRemaining:0}]}).days).toBeGreaterThan(duration().days));
  it('large battles last longer',()=>expect(duration(30000,30000).days).toBeGreaterThan(duration().days));
  it('no fixed deadline resolves battle',()=>{
    const f=fixture();expect(processBattleDay({...f.battle,daysRemaining:0},f.armies,f.field,f.provinces).finished).toBe(false);
  });
  it.each([1.08,1.16])('air multiplier %s changes damage once',multiplier=>{
    const f=fixture();const base=processBattleDay(f.battle,f.armies,f.field,f.provinces), air=processBattleDay(f.battle,f.armies,f.field,f.provinces,new Map([['BRA',multiplier]]));
    expect(air.battle.defenderCasualties).toBeGreaterThan(base.battle.defenderCasualties);expect(air.battle.attackerCasualties).toBeLessThan(base.battle.attackerCasualties);
  });
  it('no-air multiplier 1 is exact baseline',()=>{const f=fixture();expect(processBattleDay(f.battle,f.armies,f.field,f.provinces,new Map([['BRA',1],['ARG',1]]))).toEqual(processBattleDay(f.battle,f.armies,f.field,f.provinces));});
  it('damage ignores input order',()=>{const f=fixture();const r=processBattleDay(f.battle,f.armies,f.field,f.provinces), reversed=processBattleDay(f.battle,[...f.armies].reverse(),f.field,f.provinces);expect(reversed.battle).toEqual(r.battle);expect([...reversed.armies].sort((a,b)=>a.id.localeCompare(b.id))).toEqual(r.armies);});
  it('round does not mutate input snapshots',()=>{const f=fixture(),snapshot=structuredClone(f);processBattleDay(f.battle,f.armies,f.field,f.provinces);expect(f).toEqual(snapshot);});
  it('reinforcement is idempotent and preserves duration',()=>{const f=fixture();const b={...f.battle,durationDays:5};const extra=army('extra','BRA');const r=addReinforcementsToBattle(b,extra,'attacker',f.field);expect(addReinforcementsToBattle(r,extra,'attacker',f.field)).toEqual(r);expect(r.durationDays).toBe(5);});
  it('arrival creates only one battle',()=>{const f=fixture();const r=checkAllProvinceCombats(f.armies,[f.field],[war],date,[]);const again=checkAllProvinceCombats(r.armies,[f.field],[war],date,r.newBattles);expect(again.newBattles).toHaveLength(0);expect(again.updatedBattles).toHaveLength(1);});
  it('IDs are deterministic',()=>{const f=fixture();expect(checkAllProvinceCombats(f.armies,[f.field],[war],date,[]).newBattles).toEqual(checkAllProvinceCombats([...f.armies].reverse(),[f.field],[war],date,[]).newBattles);});
  it('neutral armies never join',()=>{const f=fixture();expect(getReinforcementSide(army('n','CHL'),f.battle,f.armies,[war])).toBeNull();});
  it('contradictory hostility cannot join either side',()=>{const f=fixture();expect(getReinforcementSide(army('n','CHL'),f.battle,f.armies,[war,{attacker:'CHL',defender:'BRA'},{attacker:'CHL',defender:'ARG'}])).toBeNull();});
  it('coalition members join the correct side',()=>{const f=fixture();expect(getReinforcementSide(army('n','CHL'),f.battle,f.armies,[war,{attacker:'CHL',defender:'BRA'}])).toBe('defender');});
  it('one army cannot participate in two provinces',()=>{const f=fixture();const r=checkAllProvinceCombats(f.armies,[f.field],[war],date,[f.battle,{...f.battle,id:'second',provinceId:'other'}]);expect(r.updatedBattles.flatMap(b=>b.participantArmyIds).filter(id=>id==='a')).toHaveLength(1);});
  it('all defeated armies retreat and keep survivors',()=>{const f=fixture();const armies=[f.armies[0],army('d1','ARG',5000,1),army('d2','ARG',5000,1)];const b=startContinuousBattle([armies[0]],armies.slice(1),f.field,date,'retreat');const r=processBattleDay(b,armies,f.field,f.provinces);expect(r.finished).toBe(true);expect(r.armies.slice(1).every(a=>a.location==='d-home'&&a.retreatProtectionDays===2)).toBe(true);expect(r.battle.defenderCasualties).toBeLessThan(1000);});
  it('no route annihilates with actual casualties',()=>{const f=fixture();f.armies[1]=army('d','ARG',10000,1);const r=processBattleDay(f.battle,f.armies,{...f.field,neighbors:[]},f.provinces);expect(r.battle.defenderCasualties).toBe(10000);expect(r.battle.endReason).toBe('no_retreat');expect(r.battle.retreatOutcomes?.d.reason).toBe('no_retreat');});
  it('retreat target is deterministic by ID',()=>{const f=fixture();const p=province('z-home','ARG');expect(findRetreatProvince('ARG',{...f.field,neighbors:['z-home','d-home']},[p,...f.provinces])?.id).toBe('d-home');});
  it('enemy blocks retreat target',()=>{const f=fixture();expect(findRetreatProvince('ARG',f.field,f.provinces,[{...f.armies[0],location:'d-home'}])).toBeNull();});
  it('campaign enemies block retreat even without a direct pair',()=>{
    const f=fixture();const blocker={...army('blocker','CHL'),location:'a-home'};
    const wars=[{attacker:'BRA',defender:'PER',campaignId:'c'},{attacker:'ARG',defender:'CHL',campaignId:'c'}];
    expect(findRetreatProvince('BRA',f.field,f.provinces,[blocker],{wars,relations:[]})).toBeNull();
  });
  it('winners remain and stale orders are cleared',()=>{const f=fixture();f.armies[1]=army('d','ARG',10000,1);const r=processBattleDay(f.battle,f.armies,f.field,f.provinces);expect(r.armies[0].location).toBe('front');expect(r.armies[0].inCombat).toBe(false);expect(r.armies[0].destination).toBeNull();});
  it.each(['battle','retreat'])('%s blocks movement and reorganization',state=>{const f=fixture();const a={...f.armies[0],inCombat:state==='battle',retreatProtectionDays:state==='retreat'?2:0};expect(issueMoveCommand(a,'a-home',f.provinces,[])).toBeNull();expect(getArmyReorganizationBlockReason(a,{armies:[a],provinces:f.provinces,playerCountryTag:'BRA'})).toBeTruthy();});
  it('retreat protection prevents reengagement',()=>{const f=fixture();f.armies[1]={...f.armies[1],retreatProtectionDays:2};expect(checkAllProvinceCombats(f.armies,f.provinces,[war],date,[]).newBattles).toHaveLength(0);});
  it('population follows actual regiment losses only',()=>{const f=fixture();const r=processBattleDay(f.battle,f.armies,f.field,f.provinces);const p=applyMilitaryCasualties(f.provinces,f.armies,r.armies);expect(p.find(x=>x.id==='a-home')!.population.total).toBe(100000-r.battle.attackerCasualties);});
  it.each([false,true])('empty hostile arrival (amphibious=%s) captures without fake battle', amphibious=>{const f=fixture(),{p}=tickParams(f);const a={...f.armies[0],embarkedFleetId:undefined};const r=processBattleArrival({...p,arrivedArmies:[a],armies:[],currentActiveBattles:[],activeBattlesRef:{current:[]}});expect(r.provinces[0].owner).toBe('BRA');expect(r.currentActiveBattles).toHaveLength(0);expect(amphibious ? a.embarkedFleetId : undefined).toBeUndefined();});
  it('neutral occupation is blocked',()=>{const f=fixture(),{p}=tickParams(f,[]);const r=processBattleArrival({...p,arrivedArmies:[f.armies[0]],armies:[],currentActiveBattles:[],activeBattlesRef:{current:[]}});expect(r.provinces[0].owner).toBe('ARG');});
  it('defended disembarked arrival uses standard battle',()=>{const f=fixture(),{p}=tickParams(f);const r=processBattleArrival({...p,arrivedArmies:[f.armies[0]],armies:[f.armies[1]],currentActiveBattles:[],activeBattlesRef:{current:[]}});expect(r.currentActiveBattles).toHaveLength(1);});
  it('ended hostility releases battle and records reason without conquest',()=>{const f=fixture(),{p,history}=tickParams(f,[]);const r=processBattleContinuous(p);expect(r.currentActiveBattles).toHaveLength(0);expect(r.provinces[0].owner).toBe('ARG');expect(history).toHaveLength(1);});
  it('country leaving war is removed from participants',()=>{const f=fixture(),extra=army('n','CHL');f.armies.push(extra);f.battle=addReinforcementsToBattle(f.battle,extra,'attacker',f.field);const {p}=tickParams(f);const r=processBattleContinuous(p);expect(r.currentActiveBattles[0].participantArmyIds).not.toContain('n');expect(r.armies.find(a=>a.id==='n')?.inCombat).toBe(false);});
  it('casualty ledger and battle history record completion once',()=>{const f=fixture();f.armies[1]=army('d','ARG',10000,1);const {p,history}=tickParams(f);p.currentActiveBattles=[f.battle,f.battle];const r=processBattleContinuous(p);expect(history).toHaveLength(1);expect(r.wars[0].recordedBattleIds).toEqual(['battle']);expect(r.wars[0].defenderCasualties).toBe(history[0].countryCasualties!.ARG);expect(r.provinces[0].owner).toBe('BRA');});
  it('active panel shows aggregate force and army count',()=>{cleanup();const f=fixture();f.armies.push(army('extra','BRA',5000));f.battle=addReinforcementsToBattle(f.battle,f.armies[2],'attacker',f.field);render(<ActiveBattlePanel battle={f.battle} armies={f.armies} province={f.field}/>);expect(screen.getByText(/15000 tropas/)).toBeTruthy();expect(screen.getByText(/2 exércitos/)).toBeTruthy();cleanup();});
  it('completed report renders participants and casualties',()=>{cleanup();const f=fixture();f.armies[1]=army('d','ARG',10000,1);const {p,history}=tickParams(f);processBattleContinuous(p);render(<BattleReportModal battleResult={history[0]} playerCountry={countries.find(c=>c.tag==='BRA')!} allCountries={countries} onClose={vi.fn()}/>);expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByText(/Baixas ARG:/)).toBeTruthy();cleanup();});
  it('save/load preserves active round and does not duplicate battle',()=>{const f=fixture();const first=processBattleDay(f.battle,f.armies,f.field,f.provinces);const store=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k)});saveGame({dateRef:{current:date},provincesRef:{current:f.provinces},countriesRef:{current:[]},armiesRef:{current:first.armies},warsRef:{current:[war]},diplomaticRelationsRef:{current:[]},recruitmentsRef:{current:[]},buildingConstructionsRef:{current:[]},playerTechStateRef:{current:createInitialTechState('BRA')},botTechStatesRef:{current:new Map()},activeBattlesRef:{current:[first.battle]}},'battle-v3','Battle');const loaded=loadGame('battle-v3')!;expect(loaded.military.activeBattles).toHaveLength(1);expect(loaded.military.activeBattles[0].durationDays).toBe(1);expect(processBattleDay(loaded.military.activeBattles[0] as BattleExtended,loaded.military.armies,f.field,f.provinces).battle).toEqual(processBattleDay(first.battle,first.armies,f.field,f.provinces).battle);vi.unstubAllGlobals();});
  it('participant helper rejects armies outside battle province',()=>{const f=fixture();expect(getValidParticipantsBySide(f.battle,[{...f.armies[0],location:'a-home'}],'attacker')).toEqual([]);});
  it('campaign hostility expands missing cross-country pairs consistently',()=>{
    const hostile=createBattleHostility([{attacker:'BRA',defender:'PER',campaignId:'c'},{attacker:'ARG',defender:'CHL',campaignId:'c'}]);
    expect(hostile({owner:'BRA'},{owner:'CHL'})).toBe(true);expect(hostile({owner:'BRA'},{owner:'ARG'})).toBe(false);
  });
  it('coalition records each country casualty contribution',()=>{
    const f=fixture();f.field.owner='PER';f.provinces[0]=f.field;
    f.armies=[army('a','BRA'),army('ally','ARG'),army('d','PER',10000,1),army('def-ally','CHL',10000,1)];
    f.battle=startContinuousBattle(f.armies.slice(0,2),f.armies.slice(2),f.field,date,'coalition');
    const wars=[{...war,id:'c',campaignId:'c',defender:'PER'},{...war,id:'pair',campaignId:'c',attacker:'ARG',defender:'CHL'}];
    const {p,history}=tickParams(f,wars);processBattleContinuous(p);
    expect(Object.keys(history[0].countryCasualties!).sort()).toEqual(['ARG','BRA','CHL','PER']);
    expect(history[0].participantDetails).toHaveLength(4);
    expect(history[0].participantDetails!.filter(d=>d.side==='defender').every(d=>d.final===0)).toBe(true);
  });
  it('conquest calls transferProvince and preserves its owner/list contract',()=>{
    const f=fixture();f.armies[1]=army('d','ARG',10000,1);const {p}=tickParams(f);
    const transfer=vi.spyOn(territory,'transferProvince');const result=processBattleContinuous(p);
    expect(transfer).toHaveBeenCalledTimes(1);expect(result.countries.find(c=>c.tag==='BRA')?.provinces).toContain('front');
    expect(f.field.owner).toBe('ARG');transfer.mockRestore();
  });
  it('legacy active saves gain phases and preserve elapsed time',()=>{
    const f=fixture();const legacy={...f.battle,phase:undefined,durationDays:undefined,daysTotal:6,daysRemaining:3};
    expect(normalizeBattleSave([legacy],f.armies)[0]).toMatchObject({durationDays:3,phase:'MAIN_COMBAT'});
  });
  it('legacy migration retains casualties from before load and exact side initial totals',()=>{
    const f=fixture();const extra=army('extra','BRA',5000), battle=startContinuousBattle([f.armies[0],extra],[f.armies[1]],f.field,date,'legacy');
    const damaged=[army('a','BRA',9000),army('extra','BRA',4000),army('d','ARG',9500)];
    const legacy={...battle,participantInitialSizes:undefined,participantSnapshots:undefined};
    const migrated=normalizeBattleSave([legacy],damaged)[0];
    expect(migrated.participantInitialSizes).toEqual({a:10000,d:10000,extra:5000});
    expect(Object.values(migrated.participantInitialSizes!).reduce((sum,n)=>sum+n,0)-damaged.reduce((sum,a)=>sum+calculateArmySize(a),0)).toBe(2500);
  });
  it('save normalization removes duplicate battles and participant membership',()=>{
    const f=fixture();const normalized=normalizeBattleSave([f.battle,f.battle,{...f.battle,id:'other',provinceId:'other'}],f.armies);
    expect(normalized).toHaveLength(2);expect(normalized.flatMap(b=>b.participantArmyIds)).toEqual(['a','d']);
  });
  it('retreat protection survives additive JSON persistence',()=>{
    const f=fixture();f.armies[1]=army('d','ARG',10000,1);const result=processBattleDay(f.battle,f.armies,f.field,f.provinces);
    const loaded=JSON.parse(JSON.stringify(result)) as typeof result;
    expect(loaded.armies[1]).toMatchObject({retreatProtectionDays:2,retreatFromBattleId:'battle',location:'d-home'});
  });
  it('official air APIs supply the exact per-country battle modifier',()=>{
    const air=createInitialAirState(countries,provincesData), fighter=air.wings.find(w=>w.countryTag==='BRA'&&w.type==='FIGHTER')!, cas=air.wings.find(w=>w.countryTag==='BRA'&&w.type==='CAS')!;
    const field=structuredClone(provincesData.find(p=>p.id===fighter.baseProvinceId)!);
    const f=fixture();f.field=field;f.provinces=structuredClone(provincesData);f.armies=f.armies.map(a=>({...a,location:field.id}));f.battle=startContinuousBattle([f.armies[0]],[f.armies[1]],field,date,'air-api');
    const {p}=tickParams(f),ctx={provinces:f.provinces,countries:p.countries,armies:f.armies,wars:[war],relations:[]};
    const zone=airZoneByProvinceId.get(field.id)!;
    air.wings=air.wings.filter(w=>w.countryTag==='BRA').map(w=>w.id===fighter.id?assignAirMission(w,'AIR_SUPERIORITY',zone.id,ctx)!:w.id===cas.id?assignAirMission(w,'CLOSE_AIR_SUPPORT',zone.id,ctx)!:w);
    const result=processBattleContinuous({...p,air});
    expect(getAirSupportForBattle(air,f.battle,'BRA',ctx)).toBeGreaterThan(0);
    expect(result.currentActiveBattles[0].airModifiers?.BRA).toEqual({superiority:getAirSuperiorityModifier(air,field.id,'BRA',ctx),cas:getAirSupportForBattle(air,f.battle,'BRA',ctx)});
  });
  it('invalid province closes stale battle without occupation',()=>{
    const f=fixture(),{p,history}=tickParams(f);p.provinces=homes;const r=processBattleContinuous(p);
    expect(r.currentActiveBattles).toHaveLength(0);expect(history[0].endReason).toBe('territory_invalid');expect(history[0].territoryChanged).toBe(false);
  });
  it('real save/load retains completed history and once-only campaign ledger',()=>{
    const f=fixture();f.armies[1]=army('d','ARG',10000,1);const {p,history}=tickParams(f);const completed=processBattleContinuous(p);
    const store=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v),removeItem:(k:string)=>store.delete(k)});
    saveGame({battleHistoryRef:{current:history},dateRef:{current:date},provincesRef:{current:completed.provinces},countriesRef:{current:completed.countries},armiesRef:{current:completed.armies},warsRef:{current:completed.wars},diplomaticRelationsRef:{current:[]},recruitmentsRef:{current:[]},buildingConstructionsRef:{current:[]},playerTechStateRef:{current:createInitialTechState('BRA')},botTechStatesRef:{current:new Map()},activeBattlesRef:{current:[]}},'finished','Finished');
    const loaded=loadGame('finished')!;expect(loaded.military.battleHistory?.map(b=>b.id)).toEqual(['battle']);expect(loaded.military.wars[0].recordedBattleIds).toEqual(['battle']);expect(loaded.military.activeBattles).toHaveLength(0);vi.unstubAllGlobals();
  });
  it('coalition feedback uses player membership instead of the representative',()=>{
    const f=fixture();f.armies[1]=army('d','ARG',10000,1);const {p,history}=tickParams(f);processBattleContinuous(p);
    const report={...history[0],attackerOriginal:{...history[0].attackerOriginal,owner:'CHL'}};
    expect(battleEndFeedback(report,'BRA')).toMatch(/^Vitória/);expect(battleEndFeedback({...report,endReason:'hostility_ended'},'BRA')).toMatch(/^Combate encerrado/);
  });
});
