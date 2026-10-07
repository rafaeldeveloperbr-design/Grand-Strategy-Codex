// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { saveGame, loadGame, CURRENT_VERSION } from '../saveSystem';
import { createInitialTechState } from '../technology';
import { date, war, world, army, relation } from './helpers/southAmericaAudit';
import { processWarResolutionTick, recordBattleWarCasualties } from '../diplomacy/warResolution';
import { startContinuousBattle } from '../combat';
afterEach(()=>localStorage.clear());
function save() {
  const s=world(), armies=[army('BRA','sa_arg_chaco'),army('ARG','sa_arg_chaco')];
  const wars=recordBattleWarCasualties([war('BRA','ARG')],'completed',{attacker:armies[0],defender:armies[1],attackerCasualties:100,defenderCasualties:200});
  const battle={...startContinuousBattle([armies[0]],[armies[1]],s.provinces.find(p=>p.id==='sa_arg_chaco')!,date,'ongoing'),warCasualtiesByCountry:{BRA:20,ARG:30}};
  expect(saveGame({dateRef:{current:date},countriesRef:{current:s.countries},provincesRef:{current:s.provinces},armiesRef:{current:armies},warsRef:{current:wars},diplomaticRelationsRef:{current:[relation('BRA','ARG')]},recruitmentsRef:{current:[]},buildingConstructionsRef:{current:[]},activeBattlesRef:{current:[battle]},playerTechStateRef:{current:createInitialTechState('BRA')},botTechStatesRef:{current:new Map()}},'war')).toBe(true);
  return {wars,battle};
}
describe('War resolution additive save compatibility', () => {
  it('round trips deduplication and ongoing per-country statistics in Save V3', () => { const {wars,battle}=save(), loaded=loadGame('war')!; expect(loaded.version).toBe(CURRENT_VERSION); expect(loaded.military.wars).toEqual(wars); expect(loaded.military.activeBattles[0].warCasualtiesByCountry).toEqual(battle.warCasualtiesByCountry); expect(recordBattleWarCasualties(loaded.military.wars,'completed',{attacker:loaded.military.armies[0],defender:loaded.military.armies[1],attackerCasualties:100,defenderCasualties:200})).toEqual(wars); });
  it.each([2,3])('reads an older V%s payload lacking additive ledgers and recalculates derived metrics', version => { save(); const raw=JSON.parse(localStorage.getItem('imperium_save_war')!); raw.version=version; const w=raw.military.wars[0]; delete w.recordedBattleIds; w.warScore=87; w.occupiedByAttacker=['obsolete']; w.attackerCasualties=0; w.defenderCasualties=0; delete raw.military.activeBattles[0].warCasualtiesByCountry; localStorage.setItem('imperium_save_war',JSON.stringify(raw)); const loaded=loadGame('war')!; expect(loaded).not.toBeNull(); const tick=processWarResolutionTick({...loaded.world,armies:loaded.military.armies,wars:loaded.military.wars,activeBattles:loaded.military.activeBattles,relations:loaded.diplomacy.relations,recruitments:loaded.military.recruitments,constructions:loaded.economy.constructions,date:loaded.date}); expect(tick.wars[0].warScore).toBe(0); expect(tick.wars[0].occupiedByAttacker).toEqual([]); });
  it('loads legacy V1 war identity and zero counters', () => { const s=world(); localStorage.setItem('imperium_save_v1',JSON.stringify({id:'v1',name:'legacy',timestamp:1,date,countries:s.countries,provinces:s.provinces,armies:[],wars:[war('BRA','ARG')],relations:[relation('BRA','ARG')],recruitments:[],constructions:[],activeBattles:[],playerTech:createInitialTechState('BRA'),botTechs:{}})); const loaded=loadGame('v1')!; expect(loaded.military.wars[0]).toMatchObject({id:'BRA-ARG',attackerCasualties:0,defenderCasualties:0}); });
});
