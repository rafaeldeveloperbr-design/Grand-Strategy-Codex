import { describe, expect, it } from 'vitest';
import { countries, provincesData } from '../../data/map';
import type { Country, DiplomaticRelation, Province, War } from '../../types';
import { processAI } from '../aiEngine/aiMovement';
import { createMilitaryAIContext } from '../aiEngine/militaryAIContext';
import { buildLogisticsNetworks } from '../logistics';
import { createMilitaryAIProfiler } from '../performance/militaryAIProfiler';
import { createGameLoopProfiler } from '../performance/gameLoopProfiler';
import { processAI as legacyAI } from './helpers/legacyMilitaryAI';
import { militaryWorld } from './helpers/militaryWorld';
import { army, relation, war } from './helpers/southAmericaAudit';

function fixture() {
  const provinces = ['home', 'front', 'enemy', 'neutral'].map((id, index): Province => ({
    ...structuredClone(provincesData[0]), id, owner: index < 2 ? 'BRA' : index === 2 ? 'ARG' : 'COL',
    originalOwner: index < 2 ? 'BRA' : index === 2 ? 'ARG' : 'COL', development: 100,
    neighbors: [['front'], ['home', 'enemy'], ['front', 'neutral'], ['enemy']][index],
  }));
  const world = {
    provinces,
    countries: ['BRA', 'ARG', 'COL'].map((tag): Country => ({
      ...structuredClone(countries.find(c => c.tag === tag)!),
      capital: tag === 'BRA' ? 'home' : tag === 'ARG' ? 'enemy' : 'neutral',
      capitalId: tag === 'BRA' ? 'home' : tag === 'ARG' ? 'enemy' : 'neutral',
      provinces: provinces.filter(p => p.owner === tag).map(p => p.id),
    })),
    armies: [army('BRA', 'home', 4, 'own')],
    relations: [] as DiplomaticRelation[], wars: [] as War[],
  };
  return world;
}
type World = ReturnType<typeof fixture>;
function compare(w: World, tags = ['BRA'], supplied = true) {
  const input = structuredClone(w);
  const logistics = supplied ? buildLogisticsNetworks(w) : undefined;
  const context = createMilitaryAIContext(w.countries, w.provinces, w.armies, w.relations, w.wars);
  let expected = w.armies, actual = w.armies;
  for (const tag of tags) {
    expected = legacyAI(tag, expected, w.provinces, w.relations, w.wars, w.countries, logistics);
    actual = processAI(tag, actual, w.provinces, w.relations, w.wars, w.countries, logistics, context);
    expect(actual).toEqual(expected);
    expect(context.armiesByOwner.get(tag) ?? []).toEqual(actual.filter(a => a.owner === tag));
  }
  for (const province of w.provinces) expect(context.armiesByProvince.get(province.id) ?? []).toEqual(actual.filter(a => a.location === province.id));
  expect(w).toEqual(input);
  return actual;
}
function fighting(w: World) { w.relations.push(relation('BRA', 'ARG')); w.wars.push(war('BRA', 'ARG')); }

describe('Military AI exact legacy state equivalence', () => {
  it('peace keeps necessary frontier positioning', () => {
    expect(compare(fixture())[0].targetDestination).toBe('front');
  });
  it('war selects a territorial attack', () => {
    const w = fixture(); fighting(w);
    expect(compare(w)[0].targetDestination).toBe('enemy');
  });
  it('attacks a weaker enemy army', () => {
    const w = fixture(); fighting(w); w.armies.push(army('ARG', 'enemy', 1, 'weak'));
    expect(compare(w)[0].targetDestination).toBe('enemy');
  });
  it('defends a threatened capital', () => {
    const w = fixture(); fighting(w); w.armies[0].location = 'front'; w.armies.push(army('ARG', 'home', 3, 'invader'));
    expect(compare(w)[0].targetDestination).toBe('home');
  });
  it('preserves pending movement and combat state', () => {
    const w = fixture(); w.armies[0] = { ...w.armies[0], destination: 'front', targetDestination: 'enemy', path: ['front', 'enemy'], movementProgress: 37 };
    w.armies.push({ ...army('BRA', 'front', 2, 'combat'), inCombat: true });
    expect(compare(w)).toEqual(w.armies);
  });
  it.each(['access', 'alliance'] as const)('respects %s through third country territory', status => {
    const w = fixture(); fighting(w);
    w.provinces[1].owner = 'COL'; w.provinces[1].originalOwner = 'COL'; w.relations.push(relation('BRA', 'COL', status));
    expect(compare(w)[0].targetDestination).toBe('enemy');
  });
  it('does not route through a neutral territory without access', () => {
    const w = fixture(); fighting(w); w.provinces[1].owner = 'COL'; w.provinces[1].originalOwner = 'COL';
    expect(compare(w)[0].destination).toBeNull();
  });
  it('logistics rejects an unsustainable offensive target', () => {
    const w = fixture(); fighting(w); w.provinces[2].development = 1; w.armies[0] = army('BRA', 'front', 30, 'large');
    expect(compare(w)[0].destination).toBeNull();
  });
  it('retreats a disconnected army using the original defensive scoring', () => {
    const w = fixture(); fighting(w);
    w.provinces[3].owner = 'BRA'; w.provinces[3].originalOwner = 'BRA';
    w.armies[0].location = 'neutral';
    expect(compare(w)[0].targetDestination).toBe('front');
  });
  it('preserves reinforcement reservations and army iteration order', () => {
    const w = fixture(); fighting(w);
    w.armies = [army('BRA', 'front', 3, 'first'), army('BRA', 'home', 3, 'second'), army('ARG', 'enemy', 3, 'enemy')];
    const output = compare(w);
    expect(output[0].destination).toBeNull(); expect(output[1].targetDestination).toBe('front');
  });
  it('preserves an unreachable target and missing location', () => {
    const w = fixture(); fighting(w); w.provinces[1].neighbors = ['home']; w.provinces[2].neighbors = ['neutral'];
    w.armies.push({ ...army('BRA', 'home', 1, 'unplaced'), location: null });
    expect(compare(w).every(a => a.destination === null)).toBe(true);
  });
  it('responds to rebel-related capital threats even without a formal war row', () => {
    const w = fixture(); w.armies[0].location = 'front'; w.armies.push(army('REB_BRA', 'home', 2, 'rebel'));
    w.relations.push(relation('BRA', 'REB_BRA'));
    expect(compare(w, ['BRA'], false)[0].targetDestination).toBe('home');
  });
  it('retains duplicate relation order and duplicate first-match country/province behavior', () => {
    const w = fixture(); fighting(w); w.relations.unshift(relation('BRA', 'ARG', 'alliance'));
    w.countries.push({ ...w.countries[0], capitalId: 'front' });
    w.provinces.push({ ...w.provinces[0], owner: 'COL' });
    compare(w);
  });
  it('publishes replacements for later bots, without changing the first bot input view', () => {
    const w = fixture(); fighting(w); w.armies.push(army('ARG', 'enemy', 4, 'other'));
    compare(w, ['BRA', 'ARG', 'COL']);
  });
  it('retains world army order when enemy war rows are reversed or duplicated', () => {
    const w = fixture(); fighting(w);
    w.wars.push(war('BRA', 'COL'), war('BRA', 'ARG'));
    w.relations.push(relation('BRA', 'COL'));
    w.armies = [army('COL', 'neutral', 1, 'first-enemy'), w.armies[0], army('ARG', 'enemy', 1, 'second-enemy')];
    compare(w, ['BRA', 'COL', 'ARG']);
  });
  it('publishes economic country replacements before military lookup', () => {
    const w = fixture(); fighting(w); w.armies[0].location = 'front'; w.armies.push(army('ARG', 'home', 2, 'enemy'));
    const context = createMilitaryAIContext(w.countries, w.provinces, w.armies, w.relations, w.wars);
    w.countries = w.countries.map(c => c.tag === 'BRA' ? { ...c, capitalId: 'front' } : c);
    context.countryByTag.set('BRA', w.countries[0]);
    const logistics = buildLogisticsNetworks(w);
    expect(processAI('BRA', w.armies, w.provinces, w.relations, w.wars, w.countries, logistics, context))
      .toEqual(legacyAI('BRA', w.armies, w.provinces, w.relations, w.wars, w.countries, logistics));
  });
  it('rebuilds context after ownership, location and access change on the next tick', () => {
    const w = fixture(); fighting(w); compare(w);
    w.provinces[1].owner = 'ARG'; w.armies[0].location = 'front'; w.relations[0].status = 'peace'; w.wars = [];
    compare(w);
  });
  it.each(['peace', 'wars', 'manyArmies'] as const)('matches a full 201-country / 494-province round: %s', scenario => {
    const w = militaryWorld(scenario);
    expect(w.countries).toHaveLength(201); expect(w.provinces).toHaveLength(494);
    compare(w, w.countries.filter(c => c.tag !== 'BRA').map(c => c.tag));
  });
});

describe('Military AI development profiling', () => {
  it('is inert when disabled', () => {
    let reads = 0;
    const p = createMilitaryAIProfiler(false, () => { reads++; return 0; });
    p.begin(); const value = {};
    expect(p.measure('TOTAL', () => value)).toBe(value); p.count('bots'); p.finish();
    expect(reads).toBe(0); expect(p.last).toBeUndefined();
  });
  it('aggregates counters and inclusive phase timing, including throws', () => {
    let time = 0; const p = createMilitaryAIProfiler(true, () => time);
    p.begin(); p.count('bots', 2);
    p.measure('TOTAL', () => p.measure('pathfinding', () => { time += 4; }));
    expect(() => p.measure('accessChecks', () => { time += 2; throw new Error('expected'); })).toThrow('expected');
    p.finish();
    expect(p.last?.phases.TOTAL?.total).toBe(4); expect(p.last?.phases.pathfinding?.total).toBe(4);
    expect(p.last?.phases.accessChecks?.total).toBe(2); expect(p.last?.counts.bots).toBe(2);
    p.begin(); p.finish(); expect(p.last?.counts.bots).toBe(0);
  });
  it('reports 60-tick military counters in the existing GameLoop window and resets it', () => {
    const reports: { aiBreakdown: { militaryAI?: { counts: { bots: number }; phases: { TOTAL?: { total: number } } } } }[] = [];
    let time = 0;
    const p = createGameLoopProfiler(true, { now: () => time, report: r => reports.push(r) });
    for (let tick = 0; tick < 120; tick++) {
      p.begin(); p.aiProfiler.begin({ year: 1444, month: 1, day: 1 });
      p.aiProfiler.militaryProfiler.count('bots', tick < 60 ? 200 : 3);
      p.aiProfiler.militaryProfiler.measure('TOTAL', () => { time += 2; });
      p.aiProfiler.finish(); p.finish(3, 250);
    }
    expect(reports[0].aiBreakdown.militaryAI?.counts.bots).toBe(12000);
    expect(reports[1].aiBreakdown.militaryAI?.counts.bots).toBe(180);
    expect(reports[0].aiBreakdown.militaryAI?.phases.TOTAL?.total).toBe(120);
  });
  it('counts route cache hits and preserves the output with instrumentation', () => {
    const w = fixture(); fighting(w); w.armies.push(army('ARG', 'enemy', 1, 'enemy'));
    const p = createMilitaryAIProfiler(true); p.begin();
    const logistics = buildLogisticsNetworks(w);
    const context = createMilitaryAIContext(w.countries, w.provinces, w.armies, w.relations, w.wars);
    const output = processAI('BRA', w.armies, w.provinces, w.relations, w.wars, w.countries, logistics, context, p);
    p.finish();
    expect(output).toEqual(legacyAI('BRA', w.armies, w.provinces, w.relations, w.wars, w.countries, logistics));
    expect(p.last?.counts.bots).toBe(1); expect(p.last?.counts.warBots).toBe(1);
    expect(p.last?.counts.pathCacheHits).toBeGreaterThan(0); expect(p.last?.counts.routeChecks).toBeGreaterThan(0);
  });
});
