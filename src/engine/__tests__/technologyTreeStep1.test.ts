import { afterEach, describe, expect, it, vi } from 'vitest';
import { TECHNOLOGIES, validateTechnologyTree } from '../../data/technology';
import * as engine from '../technology';
import { processAIEconomicDecisions } from '../aiEngine/aiEconomy';
import type { Country, Province } from '../../types';
import { DIFFICULTY_SPEED_MULTIPLIERS } from '../../types/difficulty';
import { calculateLawModifiers } from '../government';

const legacyIds = ['military_organization', 'improved_weapons', 'military_logistics', 'fortifications', 'professional_army', 'improved_agriculture', 'advanced_sawmills', 'advanced_mining', 'standardized_tools', 'commercial_administration', 'sanitation', 'medicine', 'public_administration', 'education', 'urbanization'];
const country = { tag: 'TST', resources: { gold: 1000 }, politics: {} } as Country;
const initial = () => engine.createInitialTechState('TST');
afterEach(() => vi.restoreAllMocks());

describe('Technology Tree V2 step 1 structure', () => {
  it('preserves all 15 IDs and validates the 32 definitions', () => {
    expect(TECHNOLOGIES).toHaveLength(32);
    expect(TECHNOLOGIES.map(technology => technology.id)).toEqual(expect.arrayContaining(legacyIds));
    expect(validateTechnologyTree(TECHNOLOGIES)).toEqual([]);
    expect(Object.fromEntries(['MILITARY', 'INDUSTRY', 'ECONOMY', 'SOCIETY'].map(category => [category, TECHNOLOGIES.filter(technology => technology.category === category).length]))).toEqual({ MILITARY: 11, INDUSTRY: 7, ECONOMY: 6, SOCIETY: 8 });
  });
  const root = TECHNOLOGIES[0];
  it.each([
    ['Unknown prerequisite', [{ ...root, prerequisites: ['missing'] }]],
    ['Self prerequisite', [{ ...root, prerequisites: [root.id] }]],
    ['Duplicate prerequisites', [{ ...root, prerequisites: ['missing', 'missing'] }]],
    ['Duplicate technology ID', [root, root]],
    ['Duplicate position', [root, { ...root, id: 'other' }]],
    ['Invalid position', [{ ...root, position: { column: -1, row: 0 } }]],
    ['Invalid position', [{ ...root, position: { column: 0, row: 1.5 } }]],
    ['Prerequisite cycle', [{ ...root, prerequisites: ['other'] }, { ...root, id: 'other', position: { column: 1, row: 1 }, prerequisites: [root.id] }]],
    ['Prerequisite must precede successor', [{ ...root, prerequisites: ['other'] }, { ...root, id: 'other', position: { column: 1, row: 1 } }]],
  ])('detects %s', (error, definitions) => expect(validateTechnologyTree(definitions).some(message => message.includes(error))).toBe(true));
  it('allows equal coordinates across categories', () => expect(validateTechnologyTree([root, { ...root, id: 'other', category: 'INDUSTRY' }])).toEqual([]));
});

describe('canonical research lifecycle', () => {
  it.each([
    ['missing', initial(), country],
    ['sanitation', { ...initial(), completedTechnologies: ['sanitation'] }, country],
    ['medicine', initial(), country],
    ['sanitation', { ...initial(), activeResearchId: 'improved_agriculture' }, country],
    ['sanitation', initial(), { ...country, resources: { ...country.resources, gold: 0 } }],
  ])('blocks %s with zero charge', (id, state, currentCountry) => {
    expect(engine.getTechnologyBlockReason(state, id, currentCountry)).toBeTruthy();
    expect(engine.startTechnologyResearch(state, id, currentCountry)).toEqual({ techState: null, cost: 0 });
    expect(currentCountry.resources.gold).toBe(currentCountry === country ? 1000 : 0);
  });
  it('cancels immutably, loses progress and preserves focus', () => {
    const state = { ...initial(), activeResearchId: 'sanitation', researchProgressDays: 12, activeFocusId: 'focus_national_unity', focusProgressDays: 7 };
    expect(engine.cancelTechnologyResearch(state)).toEqual({ ...state, activeResearchId: null, researchProgressDays: 0 });
    expect(state.researchProgressDays).toBe(12);
  });
  it('preserves difficulty, combined research bonuses and law speed', () => {
    const state = { ...initial(), activeResearchId: 'sanitation', completedTechnologies: ['education', 'scientific_institutions'], completedFocuses: ['focus_scientific_patronage'] };
    const result = engine.processDailyResearchProgress(state, country, 'hard');
    expect(result.techState.researchProgressDays).toBeCloseTo(DIFFICULTY_SPEED_MULTIPLIERS.hard * engine.calculateTechBonuses(state).researchSpeedMultiplier * calculateLawModifiers(country.activeLaws).researchSpeedMultiplier);
    expect(result.techState.focusProgressDays).toBe(0);
  });
  it('completes once, resets progress and emits a notification', () => {
    const result = engine.processDailyResearchProgress({ ...initial(), activeResearchId: 'sanitation', researchProgressDays: 29 }, country, 'medium', true);
    expect(result.techState).toEqual({ ...initial(), completedTechnologies: ['sanitation'] });
    expect(result.notifications).toHaveLength(1);
    expect(engine.processDailyResearchProgress(result.techState, country).notifications).toEqual([]);
  });
  it('normalizes all legacy IDs, duplicates, invalid references and negative/orphan progress', () => {
    expect(engine.normalizeTechState({ ...initial(), activeResearchId: 'education', researchProgressDays: 12.5, completedTechnologies: [...legacyIds, 'missing', 'sanitation'] })).toEqual({ ...initial(), activeResearchId: 'education', researchProgressDays: 12.5, completedTechnologies: legacyIds });
    expect(engine.normalizeTechState({ ...initial(), activeResearchId: 'education', researchProgressDays: -2 }).researchProgressDays).toBe(0);
    expect(engine.normalizeTechState({ ...initial(), researchProgressDays: 12 }).researchProgressDays).toBe(0);
  });
});

describe('AI canonical research and four priorities', () => {
  it.each([
    ['MILITARY', true, [], country],
    ['INDUSTRY', false, [{ id: 'p', owner: 'TST', buildings: [], population: { total: 1000, employed: 500, unemployed: 0, satisfaction: 60 }, neighbors: [] } as unknown as Province], country],
    ['ECONOMY', false, [], { ...country, economy: { goldIncome: 1, goldExpense: 2 } } as Country],
    ['SOCIETY', false, [], country],
  ])('prioritizes %s and pays exactly once through canonical start', (category, atWar, provinces, currentCountry) => {
    const start = vi.spyOn(engine, 'startTechnologyResearch');
    const result = processAIEconomicDecisions(currentCountry, provinces, initial(), [], [], '1/1/1', false, atWar);
    const selected = TECHNOLOGIES.find(technology => technology.id === result.techState.activeResearchId)!;
    expect(selected.category).toBe(category);
    expect(engine.getTechnologyBlockReason(initial(), selected.id, currentCountry)).toBeNull();
    expect(start).toHaveBeenCalledOnce();
    expect(result.country.resources.gold).toBe(currentCountry.resources.gold - selected.costGold);
  });
  it('does not pay or log a research if canonical start fails', () => {
    vi.spyOn(engine, 'startTechnologyResearch').mockReturnValue({ techState: null, cost: 300 });
    const result = processAIEconomicDecisions(country, [], initial(), [], [], '1/1/1', false);
    expect(result.country.resources.gold).toBe(1000);
    expect(result.techState.activeResearchId).toBeNull();
    expect(result.logs.filter(log => log.actionType === 'tech')).toEqual([]);
  });
  it('ignores completed and unaffordable candidates without calling start', () => {
    const start = vi.spyOn(engine, 'startTechnologyResearch');
    processAIEconomicDecisions({ ...country, resources: { ...country.resources, gold: 0 } }, [], initial(), [], [], '1/1/1', false);
    processAIEconomicDecisions(country, [], { ...initial(), completedTechnologies: TECHNOLOGIES.map(technology => technology.id) }, [], [], '1/1/1', false);
    expect(start).not.toHaveBeenCalled();
  });
});
