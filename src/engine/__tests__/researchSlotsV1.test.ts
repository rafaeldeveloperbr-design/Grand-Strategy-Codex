import { afterEach, describe, expect, it, vi } from 'vitest';
import * as engine from '../technology';
import { INITIAL_RESEARCH_SLOTS, MAX_RESEARCH_SLOTS } from '../../constants/research';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../../data/technology';
import { processAIEconomicDecisions } from '../aiEngine/aiEconomy';
import { calculateLawModifiers } from '../government';
import { DIFFICULTY_SPEED_MULTIPLIERS } from '../../types/difficulty';
import type { Country } from '../../types';
import type { CountryTechState } from '../../types/technology';

const country = {tag:'TST', resources:{gold:10000}, politics:{}} as Country;
const initial = () => engine.createInitialTechState('TST');
const unlocked = () => engine.normalizeTechState({...initial(),completedFocuses:['focus_national_academies']});
const pair = (a = 'sanitation', b = 'improved_agriculture', progressDays = 0): CountryTechState => ({...unlocked(),researchSlots:[{id:0,technologyId:a,progressDays},{id:1,technologyId:b,progressDays}]});
afterEach(() => vi.restoreAllMocks());

describe('Research Slots V1 state and normalization', () => {
  it('starts with one empty unlocked slot and capacity capped at two', () => {
    expect(INITIAL_RESEARCH_SLOTS).toBe(1); expect(MAX_RESEARCH_SLOTS).toBe(2);
    expect(initial().researchSlots).toEqual([{id:0,technologyId:null,progressDays:0}]);
    expect(engine.getResearchSlotCount(initial())).toBe(1);
    expect(engine.getTechnologyBlockReason(initial(),'sanitation',country,1)).toBe('Slot de pesquisa bloqueado');
  });
  it('unlocks from the real cumulative reward while retaining the speed effect', () => {
    const focus = NATIONAL_FOCUSES.find(item => item.id === 'focus_national_academies')!;
    expect(focus.title).toBe('Academias Nacionais');
    expect(focus.rewardEffects).toContainEqual({type:'RESEARCH_SPEED',value:.1});
    expect(focus.rewardEffects).toContainEqual({type:'RESEARCH_SLOTS',value:1});
    expect(engine.calculateTechBonuses(unlocked()).researchSlotBonus).toBe(1);
    expect(unlocked().researchSlots).toHaveLength(2);
    expect(engine.formatFocusEffect({type:'RESEARCH_SLOTS',value:1})).toBe('Slots de pesquisa: +1');
  });
  it('caps accumulated rewards without hardcoding slot collection size', () => {
    const focus = NATIONAL_FOCUSES.find(item => item.id === 'focus_national_academies')!;
    vi.spyOn(focus.rewardEffects,'forEach').mockImplementation(callback => callback({type:'RESEARCH_SLOTS',value:10},0,focus.rewardEffects));
    expect(engine.getResearchSlotCount(unlocked())).toBe(MAX_RESEARCH_SLOTS);
    expect(engine.normalizeTechState({...unlocked(),researchSlots:Array.from({length:8},(_,id) => ({id,technologyId:null,progressDays:0}))}).researchSlots).toHaveLength(MAX_RESEARCH_SLOTS);
  });
  it.each([undefined,null,[],{}, {completedFocuses:'invalid',completedTechnologies:7}, {researchSlots:[null,3,'bad']}])('normalizes malformed boundaries safely: %j', value => {
    const normalized = engine.normalizeTechState(value);
    expect(normalized.researchSlots).toHaveLength(1);
    expect(engine.normalizeTechState(normalized)).toEqual(normalized);
  });
  it.each([
    [{id:0,technologyId:'missing',progressDays:8},null,0],
    [{id:0,technologyId:'sanitation',progressDays:-8},'sanitation',0],
    [{id:0,technologyId:null,progressDays:8},null,0],
    [{id:0,technologyId:'sanitation',progressDays:Infinity},'sanitation',0],
    [{id:-1,technologyId:'sanitation',progressDays:8},null,0],
    [{id:0.5,technologyId:'sanitation',progressDays:8},null,0],
    [{id:'0',technologyId:'sanitation',progressDays:8},null,0],
  ])('normalizes invalid slots %j', (slot, technologyId, progressDays) => {
    const result = engine.normalizeTechState({...initial(),researchSlots:[slot]});
    expect(result.researchSlots).toEqual([{id:0,technologyId,progressDays}]);
    expect(engine.normalizeTechState(result)).toEqual(result);
  });
  it('keeps deterministic ordered unique IDs and technologies', () => {
    const result = engine.normalizeTechState({...unlocked(),researchSlots:[
      {id:1,technologyId:'sanitation',progressDays:8}, {id:0,technologyId:'sanitation',progressDays:4},
      {id:0,technologyId:'education',progressDays:9},{id:2,technologyId:'medicine',progressDays:6},
    ]});
    expect(result.researchSlots).toEqual([{id:0,technologyId:'sanitation',progressDays:4},{id:1,technologyId:null,progressDays:0}]);
    expect(engine.normalizeTechState(result)).toEqual(result);
  });
  it('removes completed active technology and preserves completed IDs', () => {
    const result = engine.normalizeTechState({...pair(),completedTechnologies:['sanitation','sanitation','missing']});
    expect(result.completedTechnologies).toEqual(['sanitation']);
    expect(result.researchSlots[0]).toEqual({id:0,technologyId:null,progressDays:0});
    expect(result.researchSlots[1].technologyId).toBe('improved_agriculture');
  });
  it('migrates legacy active progress and derives capacity from completed focus', () => {
    const result = engine.normalizeTechState({activeResearchId:'education',researchProgressDays:15,completedFocuses:['focus_national_academies']});
    expect(result.researchSlots).toEqual([{id:0,technologyId:'education',progressDays:15},{id:1,technologyId:null,progressDays:0}]);
    expect(result).not.toHaveProperty('activeResearchId'); expect(result).not.toHaveProperty('researchProgressDays');
  });
  it('migrates an empty legacy research and discards orphan progress', () => {
    expect(engine.normalizeTechState({activeResearchId:null,researchProgressDays:15}).researchSlots).toEqual(initial().researchSlots);
  });
  it('prefers canonical slots over legacy fields in mixed content', () => {
    expect(engine.normalizeTechState({...pair(),activeResearchId:'education',researchProgressDays:15})).toEqual(pair());
  });
});

describe('Slot-targeted lifecycle', () => {
  it.each([0,1])('starts only target slot %i and returns exactly one cost', slotId => {
    const state = unlocked(); const result = engine.startTechnologyResearch(state,'sanitation',country,slotId);
    expect(result.cost).toBe(300);
    expect(result.techState!.researchSlots[slotId]).toEqual({id:slotId,technologyId:'sanitation',progressDays:0});
    expect(result.techState!.researchSlots[1-slotId]).toEqual(state.researchSlots[1-slotId]);
    expect(state).toEqual(unlocked()); expect(country.resources.gold).toBe(10000);
  });
  it.each([-1,2,99,0.5,NaN])('rejects nonexistent slot %s without a charge', slotId => {
    expect(engine.startTechnologyResearch(unlocked(),'sanitation',country,slotId)).toEqual({techState:null,cost:0});
  });
  it('rejects an existing but locked slot and a missing unlocked slot', () => {
    expect(engine.startTechnologyResearch(initial(),'sanitation',country,1)).toEqual({techState:null,cost:0});
    const missing = {...unlocked(),researchSlots:[]};
    expect(engine.getTechnologyBlockReason(missing,'sanitation',country,1)).toBe('Slot de pesquisa inexistente');
  });
  it('rejects an occupied slot while allowing another empty slot', () => {
    const state = engine.startTechnologyResearch(unlocked(),'sanitation',country,0).techState!;
    expect(engine.getTechnologyBlockReason(state,'improved_agriculture',country,0)).toBe('Slot de pesquisa ocupado');
    expect(engine.startTechnologyResearch(state,'improved_agriculture',country,1).techState).toBeTruthy();
  });
  it('rejects duplicate technology across slots', () => {
    const state = engine.startTechnologyResearch(unlocked(),'sanitation',country,0).techState!;
    expect(engine.getTechnologyBlockReason(state,'sanitation',country,1)).toBe('Tecnologia já sendo pesquisada');
    expect(engine.startTechnologyResearch(state,'sanitation',country,1)).toEqual({techState:null,cost:0});
  });
  it.each([0,1])('cancels slot %i without touching the other or refunding', slotId => {
    const state = pair('sanitation','improved_agriculture',15);
    const result = engine.cancelTechnologyResearch(state,slotId);
    expect(result.researchSlots[slotId]).toEqual({id:slotId,technologyId:null,progressDays:0});
    expect(result.researchSlots[1-slotId]).toEqual(state.researchSlots[1-slotId]);
    expect(state.researchSlots[slotId].progressDays).toBe(15); expect(country.resources.gold).toBe(10000);
  });
  it('ignores cancelling an absent slot', () => expect(engine.cancelTechnologyResearch(pair(),7)).toEqual(pair()));
  it('progress helper targets each slot independently', () => {
    const state = {...pair(),researchSlots:[{id:0,technologyId:'sanitation',progressDays:15},{id:1,technologyId:'improved_agriculture',progressDays:3}]};
    expect(engine.getResearchProgress(state,0)?.percent).toBe(50);
    expect(engine.getResearchProgress(state,1)?.percent).toBe(10);
    expect(engine.getResearchProgress(state,8)).toBeNull();
  });
});

describe('Daily parallel research', () => {
  it('progresses both slots with research bonuses, law and difficulty', () => {
    const state = pair(); const result = engine.processDailyResearchProgress(state,country,'hard');
    const expected = engine.calculateTechBonuses(state).researchSpeedMultiplier * calculateLawModifiers(country.activeLaws).researchSpeedMultiplier * DIFFICULTY_SPEED_MULTIPLIERS.hard;
    for (const slot of result.techState.researchSlots) expect(slot.progressDays).toBeCloseTo(expected);
    expect(state.researchSlots.every(slot => slot.progressDays === 0)).toBe(true);
  });
  it('completion cleans only its slot', () => {
    const state = pair(); state.researchSlots[0].progressDays = 29;
    const result = engine.processDailyResearchProgress(state,country,'medium',true);
    expect(result.techState.researchSlots[0].technologyId).toBeNull();
    expect(result.techState.researchSlots[1].technologyId).toBe('improved_agriculture');
    expect(result.techState.researchSlots[1].progressDays).toBeCloseTo(1.1);
    expect(result.notifications).toEqual(['🔬 Pesquisa concluída: Saneamento']);
  });
  it('completes two technologies with two notifications and both effects once', () => {
    const result = engine.processDailyResearchProgress(pair('sanitation','improved_agriculture',29),country,'medium',true);
    expect(result.techState.completedTechnologies).toEqual(['sanitation','improved_agriculture']);
    expect(result.techState.researchSlots.every(slot => slot.technologyId === null && slot.progressDays === 0)).toBe(true);
    expect(result.notifications).toHaveLength(2);
    for (const tech of TECHNOLOGIES.filter(item => result.techState.completedTechnologies.includes(item.id))) expect(result.notifications).toContain(`🔬 Pesquisa concluída: ${tech.title}`);
    expect(engine.calculateTechnologyBonuses(result.techState).productionMultipliers.food).toBeGreaterThan(1);
    expect(engine.calculateTechnologyBonuses(result.techState).populationGrowthMultiplier).toBeGreaterThan(1);
    expect(engine.processDailyResearchProgress(result.techState,country).notifications).toEqual([]);
  });
  it('applies a research-speed completion to the next ID during the same tick', () => {
    const state = pair('education','sanitation');
    state.researchSlots[0].progressDays = TECHNOLOGIES.find(item => item.id === 'education')!.durationDays-1;
    state.researchSlots.reverse();
    const result = engine.processDailyResearchProgress(state,country,'medium',true);
    expect(result.techState.completedTechnologies).toContain('education');
    expect(result.techState.researchSlots[1].progressDays).toBeCloseTo(1.2);
  });
  it('does not duplicate a completed technology from inconsistent slots', () => {
    const result = engine.processDailyResearchProgress({...pair('sanitation','sanitation',29),completedTechnologies:['sanitation']},country,'medium',true);
    expect(result.techState.completedTechnologies).toEqual(['sanitation']); expect(result.notifications).toEqual([]);
  });
  it('unlocks the slot on focus completion and preserves both existing focus rewards', () => {
    const focus = NATIONAL_FOCUSES.find(item => item.id === 'focus_national_academies')!;
    const result = engine.processDailyFocusProgress({...initial(),activeFocusId:focus.id,focusProgressDays:focus.durationDays-1},country,'medium',true);
    expect(result.techState.researchSlots).toHaveLength(2);
    expect(engine.calculateTechBonuses(result.techState).researchSpeedMultiplier).toBeCloseTo(1.1);
    expect(result.notifications).toEqual(['✅ Foco concluído: Academias Nacionais']);
  });
});

describe('AI research slots', () => {
  const ai = (state: CountryTechState, currentCountry = country) => processAIEconomicDecisions(currentCountry,[],state,[],[],'1/1/1',false,true);
  it('uses only the initial slot before unlocking', () => {
    const result = ai(initial()); expect(result.techState.researchSlots).toHaveLength(1);
    expect(result.techState.researchSlots[0].technologyId).toBeTruthy();
  });
  it('uses both unlocked slots, diversifies and pays once per successful start', () => {
    const start = vi.spyOn(engine,'startTechnologyResearch'); const block = vi.spyOn(engine,'getTechnologyBlockReason');
    const result = ai(unlocked()); const ids = result.techState.researchSlots.map(slot => slot.technologyId);
    expect(ids.every(Boolean)).toBe(true); expect(new Set(ids).size).toBe(2);
    const techs = ids.map(id => TECHNOLOGIES.find(item => item.id === id)!);
    expect(techs[0].category).toBe('MILITARY'); expect(techs[1].category).not.toBe('MILITARY');
    expect(result.country.resources.gold).toBe(country.resources.gold-techs.reduce((sum,item) => sum+item.costGold,0));
    expect(start).toHaveBeenCalledTimes(2);
    expect(start.mock.calls.map(call => call[3])).toEqual([0,1]);
    expect(block).toHaveBeenCalled(); expect(result.logs.filter(log => log.actionType === 'tech')).toHaveLength(2);
  });
  it('does not pay when canonical start fails in either slot', () => {
    vi.spyOn(engine,'startTechnologyResearch').mockReturnValue({techState:null,cost:300});
    const result = ai(unlocked()); expect(result.country.resources.gold).toBe(country.resources.gold);
    expect(result.techState.researchSlots.every(slot => !slot.technologyId)).toBe(true);
    expect(result.logs.filter(log => log.actionType === 'tech')).toEqual([]);
  });
  it('rechecks remaining gold before filling the next slot', () => {
    const result = ai(unlocked(),{...country,resources:{...country.resources,gold:350}});
    expect(result.techState.researchSlots.filter(slot => slot.technologyId)).toHaveLength(1);
    expect(result.country.resources.gold).toBeGreaterThanOrEqual(0);
  });
});
