import { describe, expect, it, vi } from 'vitest';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../../data/technology';
import { validateFocusTree } from '../../data/technology/focuses/validation';
import * as engine from '../technology';
import { processAIEconomicDecisions } from '../aiEngine/aiEconomy';
import type { Country, Province } from '../../types';

const state = () => engine.createInitialTechState('TST');
const country = {
  tag:'TST', resources:{gold:1000,manpower:0,maxManpower:0,stability:60,prestige:0},
  economy:{goldIncome:10,goldExpense:5,manpowerGain:0,manpowerExpense:0},
} as Country;
const oldIds = [
  'military_modernization', 'army_modernization', 'modern_doctrine', 'fortification_program',
  'border_fortification', 'defense_in_depth', 'cavalry_traditions', 'professional_cavalry',
  'economic_expansion', 'agrarian_reform', 'agricultural_mechanization', 'intensive_agriculture',
  'manufacturing_incentive', 'industrial_revolution', 'mass_production', 'commercial_expansion', 'national_infrastructure',
  'national_unity', 'national_identity', 'social_cohesion', 'kingdom_centralization',
  'central_administration', 'modern_state', 'scientific_patronage', 'national_academies', 'scientific_revolution',
].map(id => `focus_${id}`);

describe('Focus Tree V2 engine and data', () => {
  it('preserves every legacy ID and the six category counts', () => {
    expect(oldIds.every(id => NATIONAL_FOCUSES.some(f => f.id === id))).toBe(true);
    expect(Object.fromEntries(['POLITICS','ECONOMY','INDUSTRY','MILITARY','DIPLOMACY','RESEARCH'].map(category => [category,NATIONAL_FOCUSES.filter(f => f.category === category).length])))
      .toEqual({POLITICS:7,ECONOMY:3,INDUSTRY:6,MILITARY:12,DIPLOMACY:5,RESEARCH:3});
    expect(validateFocusTree(NATIONAL_FOCUSES)).toEqual([]);
    expect(NATIONAL_FOCUSES.every(f => (f.prerequisites ?? []).every(id => NATIONAL_FOCUSES.find(p => p.id === id)!.position.row < f.position.row))).toBe(true);
  });
  it('detects invalid references, self edges, duplicates, positions and cycles', () => {
    const base = NATIONAL_FOCUSES[0];
    const malformed = [
      {...base,id:'a',prerequisites:['b','b','missing'],mutuallyExclusive:['a','a','missing'],position:{column:-1,row:0}},
      {...base,id:'b',prerequisites:['a','b'],position:{column:0,row:.5}},
      {...base,id:'b',prerequisites:['a','b'],position:{column:0,row:1}},
    ];
    const errors = validateFocusTree(malformed).join(';');
    for (const message of ['Duplicate focus ID','Duplicate prerequisites','Unknown prerequisites','Unknown mutuallyExclusive','Self prerequisites','Self mutuallyExclusive','Duplicate mutuallyExclusive','Invalid position','Prerequisite cycle']) expect(errors).toContain(message);
  });
  it('validates starting, completion, prerequisites and both active cases', () => {
    expect(engine.getFocusBlockReason(state(),'missing')).toBe('Foco inexistente');
    expect(engine.startNationalFocus(state(),'focus_national_unity')?.activeFocusId).toBe('focus_national_unity');
    expect(engine.startNationalFocus({...state(),completedFocuses:['focus_national_unity']},'focus_national_unity')).toBeNull();
    expect(engine.startNationalFocus(state(),'focus_national_identity')).toBeNull();
    const active = engine.startNationalFocus(state(),'focus_national_unity')!;
    expect(engine.startNationalFocus(active,'focus_national_unity')).toBeNull();
    expect(engine.startNationalFocus(active,'focus_economic_expansion')).toBeNull();
    expect(engine.startNationalFocus({...state(),completedFocuses:['focus_national_unity']},'focus_national_identity')).not.toBeNull();
  });
  it('blocks exclusive choices in both directions', () => {
    for (const [a,b] of [['focus_kingdom_centralization','focus_civil_reforms'],['focus_alliance_policy','focus_regional_projection']]) {
      for (const [done,target] of [[a,b],[b,a]]) {
        const completedFocuses = [...(NATIONAL_FOCUSES.find(f => f.id === target)!.prerequisites ?? []),done];
        expect(engine.getFocusBlockReason({...state(),completedFocuses},target)).toContain('exclusiva');
        expect(engine.startNationalFocus({...state(),completedFocuses},target)).toBeNull();
      }
    }
  });
  it('cancels without changing research or input, losing progress on restart', () => {
    const active = {...state(),activeFocusId:'focus_national_unity',focusProgressDays:35,activeResearchId:'education',researchProgressDays:4};
    const canceled = engine.cancelNationalFocus(active);
    expect(canceled).toEqual({...active,activeFocusId:null,focusProgressDays:0});
    expect(active.focusProgressDays).toBe(35);
    expect(engine.startNationalFocus(canceled,'focus_national_unity')?.focusProgressDays).toBe(0);
  });
  it('retains AI difficulty and law focus speed modifiers', () => {
    const active = engine.startNationalFocus(state(),'focus_national_unity')!;
    const governed = {...country,activeLaws:{intelligence:'intel_agency'}} as Country;
    expect(engine.processDailyFocusProgress(active,governed,'medium',true).techState.focusProgressDays).toBeCloseTo(1.05);
    expect(engine.processDailyFocusProgress(active,governed,'easy',false).techState.focusProgressDays).toBeLessThan(1.05);
  });
  it('accumulates modern unit bonuses and research bonuses without granting technology', () => {
    const completed = {...state(),completedFocuses:['focus_motorization','focus_armored_corps','focus_combat_engineering','focus_scientific_patronage','focus_national_academies','focus_scientific_revolution']};
    const bonuses = engine.calculateTechBonuses(completed);
    expect(bonuses.combatPowerBonus).toMatchObject({motorized_infantry:.1,reconnaissance:.05,armor:.15,engineers:.1,garrison:.1});
    expect(bonuses.researchSpeedMultiplier).toBeCloseTo(1.35);
    expect(completed.completedTechnologies).toEqual([]);
    const stacked = engine.calculateTechBonuses({...state(),completedFocuses:['focus_military_modernization','focus_modern_doctrine','focus_economic_expansion','focus_kingdom_centralization']});
    expect(stacked.combatPowerBonus.infantry).toBeCloseTo(.2);
    expect(stacked.goldIncomeMultiplier).toBeCloseTo(1.1);
  });
  it('isolates focus progress and preserves same-day research bonus on completion', () => {
    const active = {...state(),activeFocusId:'focus_scientific_patronage',focusProgressDays:74,activeResearchId:'education',researchProgressDays:0};
    const focusOnly = engine.processDailyFocusProgress(active,country,'medium',true);
    expect(focusOnly.techState).toMatchObject({activeFocusId:null,focusProgressDays:0,researchProgressDays:0,completedFocuses:['focus_scientific_patronage']});
    expect(focusOnly.notifications).toHaveLength(1);
    expect(engine.processDailyTechProgress(active,country,'medium',true).techState.researchProgressDays).toBeCloseTo(1.1);
  });
  it('preserves legacy and contradictory completions deterministically', () => {
    const legacy = {...state(),activeFocusId:'focus_professional_cavalry',focusProgressDays:12.5,completedFocuses:[...oldIds,'focus_civil_reforms','missing',oldIds[0]]};
    const normalized = engine.normalizeTechState(legacy);
    expect(normalized.completedFocuses).toEqual([...oldIds,'focus_civil_reforms']);
    expect(normalized.activeFocusId).toBe(legacy.activeFocusId);
    expect(normalized.focusProgressDays).toBe(12.5);
    expect(engine.normalizeTechState(normalized)).toEqual(normalized);
    expect(engine.normalizeTechState({...legacy,activeFocusId:'missing'}).focusProgressDays).toBe(0);
    expect(engine.normalizeTechState({...legacy,focusProgressDays:-1}).focusProgressDays).toBe(0);
  });
});

const province = {
  id:'p',name:'Teste',color:'#000',defense:1,center:{x:0,y:0},path:'',owner:'TST',development:3,maxPopulation:10000,neighbors:[],
  population:{total:5000,growthRate:.002,employed:3000,unemployed:0,satisfaction:60},
  buildings:[{type:'workshop',level:1,daysRemaining:0},{type:'iron_mine',level:1,daysRemaining:0}],
} as Province;
const runAI = (c = country, provinces: Province[] = [], techState = state(), war = false) => processAIEconomicDecisions(c,provinces,techState,[],[],'1/1/1',false,war);

describe('Focus Tree V2 AI', () => {
  it.each([
    ['POLITICS',{...country,resources:{...country.resources,stability:30}},[],state(),false],
    ['ECONOMY',{...country,resources:{...country.resources,gold:50}},[],state(),false],
    ['MILITARY',country,[],state(),true],
    ['INDUSTRY',country,[{...province,buildings:[]}],{...state(),completedFocuses:['focus_economic_expansion']},false],
    ['RESEARCH',country,[province],state(),false],
    ['DIPLOMACY',country,[],{...state(),completedTechnologies:TECHNOLOGIES.map(t => t.id)},false],
  ] satisfies [string, Country, Province[], ReturnType<typeof state>, boolean][])('selects %s using existing state', (category,c,provinces,techState,war) => {
    const result = runAI(c,[...provinces],techState,war);
    expect(NATIONAL_FOCUSES.find(f => f.id === result.techState.activeFocusId)?.category).toBe(category);
    expect(engine.getFocusBlockReason(techState,result.techState.activeFocusId!)).toBeNull();
    expect(runAI(c,[...provinces],techState,war).techState.activeFocusId).toBe(result.techState.activeFocusId);
  });
  it('starts via canonical API and never chooses an exclusive blocked focus', () => {
    const spy = vi.spyOn(engine,'startNationalFocus');
    try {
      const completedFocuses = NATIONAL_FOCUSES.map(f => f.id).filter(id => id !== 'focus_regional_projection' && id !== 'focus_territorial_ambitions');
      const initial = {...state(),completedFocuses};
      expect(runAI(country,[],initial).techState.activeFocusId).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      const result = runAI();
      expect(spy).toHaveBeenCalledWith(state(),result.techState.activeFocusId);
    } finally { spy.mockRestore(); }
  });
});
