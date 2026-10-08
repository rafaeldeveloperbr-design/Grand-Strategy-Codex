// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { Province } from '../../types';
import { NATIONAL_FOCUSES } from '../../data/technology';
import { countries, provincesData } from '../../data/map';
import { processEconomyTick } from '../../hooks/gameLoop/economyTick';
import { processDiplomacyTechTick } from '../../hooks/gameLoop/diplomacyTechTick';
import { processAiTick } from '../../hooks/gameLoop/aiTick';
import { createInitialTechState, processDailyTechProgress } from '../technology';
import { processAIEconomicDecisions } from '../aiEngine/aiEconomy';
import { initializePolitics, changeGovernmentPolicy, processPoliticalTick } from '../politics';
import * as D from '../diplomacy';
import { createGameLoopProfiler, GAME_LOOP_PHASES } from '../performance/gameLoopProfiler';

const date = { year: 1444, month: 1, day: 1 };
function fixture(tag = 'B') {
  const country = { ...structuredClone(countries[0]), tag, name: tag, provinces: [tag], capitalId: tag };
  country.resources.gold = 10000; country.resources.manpower = 10000;
  const province: Province = { ...structuredClone(provincesData[0]), id: tag, owner: tag, neighbors: [], buildings: [] };
  return { country, province };
}
function economy(tag = 'B') {
  const { country, province } = fixture(tag);
  const p: Parameters<typeof processEconomyTick>[0] = {
    countries: [country], provinces: [province], armies: [], recruitments: [], buildingConstructions: [],
    wars: [], relations: [], playerCountryTag: 'P', date, allCountries: [country],
    playerTechState: createInitialTechState('P'), botTechStates: new Map(),
    addLog: vi.fn(), addAILog: vi.fn(), addToast: vi.fn(), formatGameDate: vi.fn(() => 'date'),
  };
  return p;
}
function diplomacyTech(tag: string) {
  const { country, province } = fixture(tag);
  const state = { ...createInitialTechState(tag), researchSlots: [{ id: 0, technologyId: 'improved_agriculture', progressDays: 1000 }] };
  const p: Parameters<typeof processDiplomacyTechTick>[0] = {
    countries: [country], provinces: [province], armies: [], wars: [], relations: [], playerCountryTag: 'P', snapshot: { date },
    currentPlayerTechState: tag === 'P' ? state : createInitialTechState('P'), currentBotTechStates: new Map([[tag, state]]),
    aiDifficultyRef: { current: 'medium' }, playerTechStateRef: { current: state }, botTechStatesRef: { current: new Map() },
    addLog: vi.fn(), addAILog: vi.fn(), addToast: vi.fn(), formatGameDate: vi.fn(() => 'date'),
  };
  return p;
}
function ai(ctx: D.DiplomacyContext) {
  const p: Parameters<typeof processAiTick>[0] = {
    countries: ctx.countries, provinces: ctx.provinces ?? [], armies: ctx.armies ?? [], wars: ctx.wars, relations: ctx.relations,
    buildingConstructions: [], recruitments: [], currentBotTechStates: new Map(), playerCountryTag: 'P',
    aiDifficultyRef: { current: 'medium' }, ceilingLogRef: { current: new Set() }, snapshot: { date: ctx.date },
    allCountries: ctx.countries, addAILog: vi.fn(), addToast: vi.fn(), formatGameDate: () => 'date',
  };
  const result = processAiTick(p);
  return { p, result };
}
function pair(a: string, b: string): D.DiplomacyContext {
  const fa = fixture(a), fb = fixture(b);
  fa.province.neighbors = [b]; fb.province.neighbors = [a];
  const day = D.diplomacyDay(date), cycle = day + (D.DIPLOMACY_BALANCE.aiInterval - day % D.DIPLOMACY_BALANCE.aiInterval) % D.DIPLOMACY_BALANCE.aiInterval;
  const d = new Date(cycle * 86400000);
  return { countries: [fa.country, fb.country], provinces: [fa.province, fb.province], armies: [], wars: [],
    relations: D.setTrust(D.setOpinion([], a, b, 70), a, b, 70),
    date: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() } };
}

describe('routine bot feedback removal', () => {
  it('completes bot research without main/AI logs or formatting', () => {
    const p = diplomacyTech('B');
    const state = p.currentBotTechStates.get('B')!;
    state.activeFocusId = NATIONAL_FOCUSES[0].id; state.focusProgressDays = 1000;
    const expected = processDailyTechProgress(state, p.countries[0], 'medium', false);
    const mutedProgress = processDailyTechProgress(state, p.countries[0], 'medium', false, false);
    expect(expected.notifications).toHaveLength(2);
    expect(mutedProgress.techState).toEqual(expected.techState); expect(mutedProgress.notifications).toEqual([]);
    const result = processDiplomacyTechTick(p);
    expect(result.currentBotTechStates.get('B')?.completedTechnologies).toContain('improved_agriculture');
    expect(p.addLog).not.toHaveBeenCalled(); expect(p.addAILog).not.toHaveBeenCalled();
    expect(p.formatGameDate).not.toHaveBeenCalled();
    const muted = processDailyTechProgress(p.currentBotTechStates.get('B')!, p.countries[0], 'medium', false, false);
    expect(muted.notifications).toEqual([]);
  });
  it('completes bot construction without publishing or formatting feedback', () => {
    const p = economy();
    p.buildingConstructions = [{ id: 'build', owner: 'B', provinceId: 'B', buildingType: 'farm', cost: 0, daysRemaining: 0, totalDays: 30 }];
    const result = processEconomyTick(p);
    expect(result.provinces[0].buildings.some(b => b.type === 'farm')).toBe(true);
    expect(result.buildingConstructions).toEqual([]);
    expect(p.addLog).not.toHaveBeenCalled(); expect(p.addAILog).not.toHaveBeenCalled();
    expect(p.addToast).not.toHaveBeenCalled(); expect(p.formatGameDate).not.toHaveBeenCalled();
  });
  it('completes bot recruitment without publishing or formatting feedback', () => {
    const p = economy(); p.recruitments = [{ id: 'rec', owner: 'B', provinceId: 'B', unitType: 'infantry', count: 1, daysRemaining: 0 }];
    const result = processEconomyTick(p);
    expect(result.armies).toHaveLength(1); expect(result.recruitments).toEqual([]);
    expect(p.addLog).not.toHaveBeenCalled(); expect(p.addAILog).not.toHaveBeenCalled();
    expect(p.addToast).not.toHaveBeenCalled(); expect(p.formatGameDate).not.toHaveBeenCalled();
  });
  it('changes bot policy with identical effects and no routine message', () => {
    const { country, province } = fixture(); const c = initializePolitics(country);
    c.politics!.politicalCapital = 100;
    const normal = changeGovernmentPolicy(c, 'taxation_high', date);
    const muted = changeGovernmentPolicy(c, 'taxation_high', date, false, false);
    expect(normal.allowed).toBe(true); expect(muted.country).toEqual(normal.country); expect(muted.message).toBe('');
    c.politics!.lastTickDay = 0;
    const ctx = { provinces: [province], armies: [], wars: [], date };
    expect(processPoliticalTick([c], ctx, 'P', false).messages).toEqual([]);
  });
  it('retains AI economic actions without routine log objects', () => {
    const { country, province } = fixture();
    const result = processAIEconomicDecisions(country, [province], createInitialTechState('B'), [], [], 'date');
    expect(result.logs).toEqual([]); expect(result.techState.activeFocusId).toBeTruthy();
    expect(result.techState.researchSlots.some(slot => slot.technologyId)).toBe(true);
    expect(result.country.resources.gold).toBeLessThan(country.resources.gold);
  });
  it('keeps bot-to-bot proposals simulated without showing player feedback', () => {
    const { result, p } = ai(pair('A', 'B'));
    expect(result.relations.flatMap(r => r.proposals ?? []).length).toBeGreaterThan(0);
    expect(p.addAILog).not.toHaveBeenCalled(); expect(p.addToast).not.toHaveBeenCalled();
  });
  it('still announces proposals sent to the player', () => {
    const { result, p } = ai(pair('A', 'P'));
    expect(result.relations.flatMap(r => r.proposals ?? []).some(q => q.to === 'P')).toBe(true);
    expect(p.addAILog).toHaveBeenCalled(); expect(p.addToast).toHaveBeenCalled();
  });
  it('preserves feedback for a war call involving the player', () => {
    const ctx = pair('P', 'B'); const enemy = fixture('E'); ctx.countries.push(enemy.country); ctx.provinces!.push(enemy.province);
    ctx.relations = D.updateRelation(ctx.relations, 'P', 'B', r => ({ ...r, alliance: { since: D.diplomacyDay(ctx.date) } }));
    const declared = D.declareWar(ctx, 'P', 'E'); expect(declared.ok).toBe(true);
    ctx.wars = declared.wars; ctx.relations = declared.relations;
    expect(ctx.relations.flatMap(r => r.proposals ?? []).some(p => p.kind === 'call')).toBe(true);
    const { p } = ai(ctx); expect(p.addAILog).toHaveBeenCalled();
  });
  it('keeps player research, construction and recruitment feedback', () => {
    const tech = diplomacyTech('P'); processDiplomacyTechTick(tech);
    expect(tech.addLog).toHaveBeenCalled(); expect(tech.addToast).toHaveBeenCalled();
    const p = economy('P');
    p.recruitments = [{ id: 'rec', owner: 'P', provinceId: 'P', unitType: 'infantry', count: 1, daysRemaining: 0 }];
    p.buildingConstructions = [{ id: 'build', owner: 'P', provinceId: 'P', buildingType: 'farm', cost: 0, daysRemaining: 0, totalDays: 30 }];
    processEconomyTick(p); expect(p.addToast).toHaveBeenCalledTimes(2);
  });
  it('automatically prints visible profiler summaries every 60 development ticks', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    try {
      let time = 0; const profiler = createGameLoopProfiler(import.meta.env.DEV, { now: () => time });
      const tick = () => { profiler.begin(); for (const phase of GAME_LOOP_PHASES.filter(p => p !== 'TOTAL')) { time++; profiler.endPhase(phase); } profiler.finish(5, 60); };
      for (let i = 0; i < 59; i++) tick(); expect(info).not.toHaveBeenCalled();
      tick(); expect(info).toHaveBeenCalledTimes(1);
      const [label, summary] = info.mock.calls[0]; expect(label).toContain('[GameLoop]');
      expect(summary).toMatchObject({ speed: 5, targetInterval: 60, total: { last: 12, average: 12, max: 12 } });
      expect(Object.keys(summary.phases)).toHaveLength(13); expect(debug).not.toHaveBeenCalled();
      for (let i = 0; i < 60; i++) tick(); expect(info).toHaveBeenCalledTimes(2);
    } finally { info.mockRestore(); debug.mockRestore(); }
  });
});
