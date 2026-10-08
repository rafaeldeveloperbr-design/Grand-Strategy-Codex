// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AI_PHASES, createAITickProfiler } from '../performance/aiTickProfiler';
import { createGameLoopProfiler } from '../performance/gameLoopProfiler';
import { processAiTick } from '../../hooks/gameLoop/aiTick';
import { countries, provincesData } from '../../data/map';
import { createInitialTechState } from '../technology';
import { createArmy } from '../military';

const date = { year: 1444, month: 11, day: 11 };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('AI subprofiler', () => {
  it('measures all subphases and accounts for overhead without double counting', () => {
    let time = 0;
    const profiler = createAITickProfiler(true, { now: () => time });
    profiler.begin(date);
    for (const phase of AI_PHASES.filter(p => p !== 'TOTAL' && p !== 'overhead')) {
      profiler.measure(phase, () => { time += 2; });
    }
    time += 5; profiler.finish();
    const breakdown = profiler.last!.phases;
    expect(breakdown.overhead).toBe(5); expect(breakdown.TOTAL).toBe(23);
    expect(AI_PHASES.filter(p => p !== 'TOTAL').reduce((sum, p) => sum + breakdown[p], 0)).toBe(breakdown.TOTAL);
    for (const phase of AI_PHASES.filter(p => p !== 'TOTAL' && p !== 'overhead')) expect(breakdown[phase]).toBe(2);
  });
  it('sums bot call durations and identifies the slowest economic and military bot', () => {
    let time = 0;
    const profiler = createAITickProfiler(true, { now: () => time }); profiler.begin(date);
    for (const [tag, economic, military] of [['AAA', 4, 15], ['BBB', 9, 3]] as const) {
      profiler.measure('botEconomicDecisions', () => { time += economic; }, tag);
      profiler.measure('botMilitaryAI', () => { time += military; }, tag);
    }
    profiler.finish();
    expect(profiler.last?.phases.botEconomicDecisions).toBe(13);
    expect(profiler.last?.phases.botMilitaryAI).toBe(18);
    expect(profiler.last?.slowestEconomicBot).toEqual({ tag: 'BBB', duration: 9, date });
    expect(profiler.last?.slowestMilitaryBot).toEqual({ tag: 'AAA', duration: 15, date });
  });
  it('reports spikes strictly above 1000 ms with phase, game date and applicable bot tag', () => {
    let time = 0; const reportSpike = vi.fn();
    const profiler = createAITickProfiler(true, { now: () => time, reportSpike }); profiler.begin(date);
    profiler.measure('diplomacyAI', () => { time += 1000; }); expect(reportSpike).not.toHaveBeenCalled();
    profiler.measure('botMilitaryAI', () => { time += 42913; }, 'SLOW');
    expect(reportSpike).toHaveBeenCalledWith({ phase: 'botMilitaryAI', duration: 42913, date, countryTag: 'SLOW' });
    profiler.measure('buildLogisticsNetworks', () => { time += 1001; });
    expect(reportSpike).toHaveBeenCalledWith({ phase: 'buildLogisticsNetworks', duration: 1001, date });
    profiler.finish();
    expect(reportSpike.mock.calls.filter(([event]) => event.phase === 'botMilitaryAI')).toHaveLength(1);
  });
  it('reports accumulated internal phase spikes and uses a compact default warning', () => {
    let time = 0; const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const profiler = createAITickProfiler(true, { now: () => time }); profiler.begin(date);
    profiler.measure('botEconomicDecisions', () => { time += 600; }, 'A');
    profiler.measure('botEconomicDecisions', () => { time += 600; }, 'B');
    expect(warn).not.toHaveBeenCalled(); profiler.finish();
    expect(warn).toHaveBeenCalledWith('[AI Slow Phase]', { phase: 'botEconomicDecisions', duration: 1200, date });
  });
  it('reads no clocks and preserves returned identity and exceptions when disabled', () => {
    const now = vi.fn(() => { throw new Error('disabled clock'); }), reportSpike = vi.fn();
    const profiler = createAITickProfiler(false, { now, reportSpike }); const result = { value: 42 };
    profiler.begin(date); expect(profiler.measure('botMilitaryAI', () => result, 'A')).toBe(result);
    const error = new Error('engine error'); expect(() => profiler.measure('diplomacyAI', () => { throw error; })).toThrow(error);
    profiler.finish(); expect(now).not.toHaveBeenCalled(); expect(reportSpike).not.toHaveBeenCalled();
    expect(profiler.last).toBeUndefined();
  });
  it('works when performance is unavailable', () => {
    vi.stubGlobal('performance', undefined);
    const profiler = createAITickProfiler(true); profiler.begin(date);
    expect(profiler.measure('rebelMovement', () => 42)).toBe(42); profiler.finish();
    expect(profiler.last?.phases.TOTAL).toBeGreaterThanOrEqual(0);
  });
  it('resets all statistics and bot maxima after each recent 60-tick report', () => {
    let time = 0; const report = vi.fn();
    const profiler = createGameLoopProfiler(true, { now: () => time, report });
    for (const [speed, cost, tag] of [[1, 4, 'FIRST'], [5, 2, 'SECOND']] as const) {
      for (let i = 0; i < 60; i++) {
        profiler.begin(); profiler.aiProfiler.begin(date);
        profiler.aiProfiler.measure('botEconomicDecisions', () => { time += cost; }, tag);
        profiler.aiProfiler.measure('botMilitaryAI', () => { time += cost; }, tag);
        profiler.aiProfiler.finish(); profiler.endPhase('AI'); profiler.finish(speed, speed === 1 ? 1000 : 60);
      }
    }
    expect(report).toHaveBeenCalledTimes(2);
    const first = report.mock.calls[0][0], second = report.mock.calls[1][0];
    expect(first.total).toEqual({ count: 60, total: 480, average: 8, max: 8, last: 8 });
    expect(second.total).toEqual({ count: 60, total: 240, average: 4, max: 4, last: 4 });
    expect(second.aiBreakdown.phases.botMilitaryAI).toEqual({ count: 60, total: 120, average: 2, max: 2, last: 2 });
    expect(first.aiBreakdown.slowestEconomicBot.tag).toBe('FIRST');
    expect(second.aiBreakdown.slowestEconomicBot).toEqual({ tag: 'SECOND', duration: 2, date });
    expect(second.aiBreakdown.slowestMilitaryBot.tag).toBe('SECOND');
    expect(first.speedCounts).toEqual({ 1: 60 }); expect(second.speedCounts).toEqual({ 5: 60 });
    expect(profiler.phases).toEqual({});
  });
  it('identifies mixed speeds and resets slow-tick counts between windows', () => {
    let time = 0; const report = vi.fn(); const profiler = createGameLoopProfiler(true, { now: () => time, reportEvery: 2, report });
    for (const [speed, cost] of [[1, 1500], [5, 70], [5, 1], [5, 1]]) {
      profiler.begin(); time += cost; profiler.finish(speed, speed === 1 ? 1000 : 60);
    }
    expect(report.mock.calls[0][0]).toMatchObject({ slowTicks: 2, speedCounts: { 1: 1, 5: 1 } });
    expect(report.mock.calls[1][0]).toMatchObject({ slowTicks: 0, speedCounts: { 5: 2 }, total: { max: 1 } });
  });
  it('leaves real AI simulation, feedback, country order and army merging identical', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); vi.spyOn(Date, 'now').mockReturnValue(100);
    const makeParams = (enabled: boolean): Parameters<typeof processAiTick>[0] => {
      const world = ['P', 'A', 'B'].map(tag => ({ ...structuredClone(countries[0]), tag, name: tag, capitalId: tag, provinces: [tag] }));
      world.forEach(c => { c.resources.gold = 10000; c.resources.manpower = 10000; });
      const provinces = world.map(c => ({ ...structuredClone(provincesData[0]), id: c.tag, owner: c.tag, neighbors: world.filter(o => o.tag !== c.tag).map(o => o.tag) }));
      let time = 0;
      return { countries: world, provinces, armies: [{ ...createArmy('A', 'One', 'A'), id: 'one' }, { ...createArmy('A', 'Two', 'A'), id: 'two' }, { ...createArmy('B', 'Three', 'B'), id: 'three' }],
        wars: [], relations: [], recruitments: [], buildingConstructions: [],
        currentBotTechStates: new Map(world.filter(c => c.tag !== 'P').map(c => [c.tag, createInitialTechState(c.tag)])),
        playerCountryTag: 'P', aiDifficultyRef: { current: 'medium' }, ceilingLogRef: { current: new Set() }, snapshot: { date },
        allCountries: world, addAILog: vi.fn(), addToast: vi.fn(), formatGameDate: () => '11/11/1444',
        profiler: createAITickProfiler(enabled, { now: () => ++time }) };
    };
    const off = makeParams(false), on = makeParams(true);
    const expected = processAiTick(off), actual = processAiTick(on);
    expect(actual).toEqual(expected); expect(on.ceilingLogRef.current).toEqual(off.ceilingLogRef.current);
    expect(vi.mocked(on.addAILog).mock.calls).toEqual(vi.mocked(off.addAILog).mock.calls);
    expect(vi.mocked(on.addToast!).mock.calls).toEqual(vi.mocked(off.addToast!).mock.calls);
    expect(actual.currentBotTechStates.get('A')?.activeFocusId).toBeTruthy();
    expect(on.profiler?.last?.slowestEconomicBot).toBeDefined();
    const measured = on.profiler!.last!.phases;
    expect(AI_PHASES.filter(p => p !== 'TOTAL').reduce((sum, p) => sum + measured[p], 0)).toBe(measured.TOTAL);
  });
});
