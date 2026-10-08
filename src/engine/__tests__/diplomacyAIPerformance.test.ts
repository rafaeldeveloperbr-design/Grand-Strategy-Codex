import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Country, Province } from '../../types';
import { countries, provincesData } from '../../data/map';
import * as current from '../diplomacy/diplomacyAI';
import * as legacy from './helpers/legacyDiplomacyAI';
import { DiplomacyAIIndex } from '../diplomacy/diplomacyAIIndex';
import { createDiplomacyAIProfiler } from '../performance/diplomacyAIProfiler';
import { diplomacyWorld } from './helpers/diplomacyWorld';
import * as D from '../diplomacy';
import type { DiplomacyContext } from '../diplomacy';

const quiet = () => createDiplomacyAIProfiler(false);
const day = (ctx: DiplomacyContext, delta: number) => {
  const d = new Date((D.diplomacyDay(ctx.date) + delta) * 86400000);
  return { ...ctx, date: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() } };
};
function fixture(size = 8): DiplomacyContext {
  const tags = Array.from({ length: size }, (_, i) => `C${String(i).padStart(3, '0')}`);
  const world: Country[] = tags.map((tag, i) => ({ ...structuredClone(countries[0]), tag, name: tag,
    capitalId: tag, provinces: [tag, ...Array.from({ length: i % 3 }, (_, j) => `${tag}_owned${j}`)] }));
  const provinces: Province[] = tags.map((tag, i) => ({ ...structuredClone(provincesData[0]), id: tag, owner: tag,
    neighbors: [tags[(i + 1) % size], tags[(i + size - 1) % size]] }));
  const relations = world.flatMap((a, i) => world.slice(i + 1).map((b, j) => ({ ...D.createRelation(a.tag, b.tag), opinion: (i + j) % 4 === 0 ? -85 : 75, trust: (i + j) % 4 === 0 ? 25 : 75 })));
  let ctx: DiplomacyContext = { countries: world, provinces, relations, wars: [], armies: [], date: { year: 1444, month: 11, day: 11 } };
  ctx = day(ctx, (D.DIPLOMACY_BALANCE.aiInterval - D.diplomacyDay(ctx.date) % D.DIPLOMACY_BALANCE.aiInterval) % D.DIPLOMACY_BALANCE.aiInterval);
  return ctx;
}
function equivalent(ctx: DiplomacyContext, player = 'C000') {
  const input = structuredClone(ctx);
  const before = legacy.processDiplomacyAI(ctx, player, quiet());
  const after = current.processDiplomacyAI(ctx, player, quiet());
  expect(after).toEqual(before); // Includes array order, orientation, cooldowns, proposals, wars and messages.
  expect(ctx).toEqual(input);
  return after;
}
function offer(ctx: DiplomacyContext, kind: 'alliance' | 'nap' | 'access', from = 'C001', to = 'C002') {
  ctx.relations = D.setTrust(D.setOpinion(ctx.relations, from, to, 85), from, to, 80);
  const offered = D.offerAgreement(ctx, from, to, kind);
  expect(offered.ok).toBe(true);
  return { ...ctx, relations: offered.relations, wars: offered.wars };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Diplomacy AI indexed equivalence', () => {
  it('preserves quiet days without proposals and does not build unused indexes', () => {
    const ctx = day(fixture(), 1), profiler = createDiplomacyAIProfiler(true);
    const result = current.processDiplomacyAI(ctx, 'C000', profiler);
    expect(result).toEqual(legacy.processDiplomacyAI(ctx, 'C000', quiet()));
    expect(result.relations).toBe(ctx.relations); expect(profiler.last?.phases.indexBuild).toBeUndefined();
  });
  it('preserves maintenance decisions, guarantees and hostile agreement breaks', () => {
    const ctx = day(fixture(), 30);
    ctx.relations[0] = { ...ctx.relations[0], alliance: { since: 0 }, nonAggressionPact: { since: 0, expiresAt: D.diplomacyDay(ctx.date) + 10 } };
    equivalent(ctx);
  });
  it.each(['alliance', 'nap', 'access'] as const)('preserves %s proposal evaluation and agreement effects', kind => {
    const ctx = day(offer(fixture(), kind), 1), result = equivalent(ctx);
    const r = D.getRelation(result.relations, 'C001', 'C002');
    expect(r?.proposals).toEqual([]);
    if (kind === 'alliance') expect(r?.alliance).toBeDefined();
    if (kind === 'nap') expect(r?.nonAggressionPact).toBeDefined();
    if (kind === 'access') expect(r?.militaryAccess).toContain('C002');
  });
  it('preserves military access route traversal and hostile-transit checks', () => {
    const ctx = fixture(); ctx.provinces = ctx.provinces!.slice(0, 4);
    ctx.provinces[0].owner = 'C001'; ctx.provinces[0].neighbors = [ctx.provinces[1].id];
    ctx.provinces[1].owner = 'C002'; ctx.provinces[1].neighbors = [ctx.provinces[2].id];
    ctx.provinces[2].owner = 'C001'; ctx.provinces[2].neighbors = [];
    ctx.countries.find(c => c.tag === 'C001')!.capitalId = ctx.provinces[0].id;
    const index = new DiplomacyAIIndex(ctx);
    expect(current.hasUsefulMilitaryAccessRoute(ctx, 'C001', 'C002', index)).toBe(true);
    expect(current.hasUsefulMilitaryAccessRoute(ctx, 'C001', 'C002', index)).toBe(legacy.hasUsefulMilitaryAccessRoute(ctx, 'C001', 'C002'));
    equivalent(ctx);
  });
  it('preserves calls after a war declaration, campaign joins, penalties and messages', () => {
    let ctx = fixture();
    ctx.relations = D.updateRelation(ctx.relations, 'C001', 'C002', r => ({ ...r, opinion: 90, trust: 90, alliance: { since: 0 } }));
    const declared = D.declareWar(ctx, 'C001', 'C003'); expect(declared.ok).toBe(true);
    ctx = day({ ...ctx, relations: declared.relations, wars: declared.wars }, 1);
    expect(ctx.relations.flatMap(r => r.proposals ?? []).some(p => p.kind === 'call')).toBe(true);
    equivalent(ctx);
  });
  it('refreshes all enemy relations after a war-call join before generating proposals', () => {
    let ctx = fixture(); ctx.relations = ctx.relations.map(r => ({ ...r, opinion: 0, trust: 50 }));
    ctx.countries.find(c => c.tag === 'C001')!.provinces = Array.from({ length: 50 }, (_, i) => `caller_${i}`);
    ctx.countries.find(c => c.tag === 'C003')!.provinces = Array.from({ length: 20 }, (_, i) => `enemy_${i}`);
    ctx.provinces!.find(p => p.id === 'C002')!.neighbors = ['C003'];
    ctx.provinces!.find(p => p.id === 'C004')!.neighbors = ['C003'];
    for (const [a, b] of [['C001', 'C002'], ['C002', 'C003'], ['C002', 'C004'], ['C004', 'C003']]) {
      ctx.relations = D.updateRelation(ctx.relations, a, b, r => ({ ...r, opinion: 80, trust: 90 }));
    }
    ctx.relations = D.updateRelation(ctx.relations, 'C001', 'C002', r => ({ ...r, alliance: { since: 0 } }));
    const declared = D.declareWar(ctx, 'C001', 'C003'); expect(declared.ok).toBe(true);
    ctx = { ...ctx, relations: declared.relations, wars: declared.wars };
    const result = equivalent(ctx);
    expect(D.getRelation(result.relations, 'C002', 'C003')?.status).toBe('war');
    expect(result.relations.flatMap(r => r.proposals ?? []).some(p => p.kind === 'alliance' && p.from === 'C002' && p.to === 'C004')).toBe(true);
  });
  it('preserves rejection, expiry handling and all proposal cooldowns', () => {
    const ctx = offer(fixture(), 'nap');
    ctx.relations = ctx.relations.map((r, i) => ({ ...r, cooldowns: { ...r.cooldowns,
      [`${r.countryA}:aiProposalRetry:alliance`]: D.diplomacyDay(ctx.date) + 180,
      [`${r.countryB}:offerNap`]: D.diplomacyDay(ctx.date) + 90 },
      ...(i === 2 ? { proposals: [{ id: 'expired', kind: 'nap' as const, from: r.countryA, to: r.countryB, createdAt: D.diplomacyDay(ctx.date) - 30, expiresAt: D.diplomacyDay(ctx.date) - 1 }] } : {}) }));
    equivalent(ctx);
    equivalent(day(ctx, 180));
  });
  it('preserves duplicate and reverse legacy rows, including first-match and all-row selectors', () => {
    const ctx = offer(fixture(), 'alliance');
    const first = ctx.relations[0];
    ctx.relations.splice(1, 0, { ...first, countryA: first.countryB, countryB: first.countryA,
      opinion: 90, trust: 90, alliance: { since: 0 }, guarantees: [first.countryA] });
    const duplicate = ctx.relations.find(r => r.proposals?.length)!;
    ctx.relations.push({ ...duplicate, countryA: duplicate.countryB, countryB: duplicate.countryA, opinion: 0 });
    const index = new DiplomacyAIIndex(ctx);
    expect(index.relation(first.countryA, first.countryB)).toBe(first);
    expect(index.alliesByTag.get(first.countryA) ?? []).toEqual(D.getAllies(ctx.relations, first.countryA));
    equivalent(ctx);
  });
  it('preserves many proposals and updates its read snapshot after every accepted response', () => {
    const ctx = fixture(32), today = D.diplomacyDay(ctx.date);
    ctx.relations = ctx.relations.map((r, i) => ({ ...r, opinion: 80, trust: 80, proposals: [
      { id: `pending:${i}`, kind: (['alliance', 'nap', 'access'] as const)[i % 3], from: r.countryA, to: r.countryB, createdAt: today, expiresAt: today + 30 },
    ] }));
    const result = equivalent(day(ctx, 1));
    expect(result.relations.flatMap(r => r.proposals ?? [])).toHaveLength(0);
  });
  it('preserves candidate scores and deterministic ordering across varied relations, wars and country orders', () => {
    for (let seed = 0; seed < 12; seed++) {
      const ctx = fixture(12);
      ctx.relations = ctx.relations.map((r, i) => ({ ...r, opinion: ((i * 37 + seed * 13) % 201) - 100, trust: (i * 17 + seed) % 101,
        ...(i % 5 === 0 ? { alliance: { since: 0 } } : {}), ...(i % 7 === 0 ? { militaryAccess: [r.countryA] } : {}),
        ...(i % 11 === 0 ? { guarantees: [r.countryB] } : {}) }));
      const index = new DiplomacyAIIndex(ctx);
      expect(current.collectProactiveProposalCandidates(ctx, 'C000', undefined, index)).toEqual(legacy.collectProactiveProposalCandidates(ctx, 'C000'));
      for (const a of ctx.countries) for (const b of ctx.countries) {
        expect(current.diplomaticPower(ctx, a.tag, index)).toBe(legacy.diplomaticPower(ctx, a.tag));
        for (const kind of ['alliance', 'nap', 'access'] as const) expect(current.shouldAcceptAgreement(ctx, a.tag, b.tag, kind, index))
          .toBe(legacy.shouldAcceptAgreement(ctx, a.tag, b.tag, kind));
      }
      equivalent(seed % 2 ? { ...ctx, countries: [...ctx.countries].reverse() } : ctx);
    }
  });
  it('preserves evolving diplomatic state across consecutive quiet and periodic ticks', () => {
    let before = offer(fixture(12), 'alliance'), after = structuredClone(before);
    for (const advance of [0, 1, 29, 30, 30, 30, 1, 89]) {
      before = day(before, advance); after = day(after, advance);
      const oldResult = legacy.processDiplomacyAI(before, 'C000', quiet());
      const newResult = current.processDiplomacyAI(after, 'C000', quiet());
      expect(newResult).toEqual(oldResult);
      before = oldResult; after = newResult;
    }
  });
  it.each([
    ['normal', '3a610beb59fba8f09cfd7f79f86a93df66f5dcea9d50daa3e7a4a89da404d9de'],
    ['maintenance', '09c80916b5273aec946d9d8154a3b7d0bf8646743b6cd050d3217d0d54783f6a'],
    ['proposalCycle', '70621f4cd11441149479e1f9f71eb0a5d6d7e41492887c1d556f1d657e6fe934'],
  ] as const)('matches frozen full-world baseline exactly: %s (201 countries / 20100 relations)', async (scenario, expected) => {
    const ctx = diplomacyWorld(scenario); expect(ctx.countries).toHaveLength(201); expect(ctx.relations).toHaveLength(20100);
    const result = current.processDiplomacyAI(ctx, 'BRA', quiet());
    // Hashes from three identical pre-optimization benchmark outputs; exact array order is part of this oracle.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ relations: result.relations, wars: result.wars, messages: result.messages })));
    const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    expect(actual).toBe(expected);
  });
});

describe('Diplomacy AI subprofiler', () => {
  it('reports phases above 500 ms with date, pair, iteration and world counts', () => {
    let time = 0; const reportSpike = vi.fn(), ctx = fixture();
    const profiler = createDiplomacyAIProfiler(true, { now: () => time, reportSpike }); profiler.begin(ctx);
    profiler.count('candidatePairs', 12); profiler.count('proposals', 4); profiler.count('proposalsProcessed', 3);
    profiler.measure('accessLogic', () => { time += 500; }, { from: 'A', to: 'B' }); expect(reportSpike).not.toHaveBeenCalled();
    profiler.measure('relationEvaluation', () => { time += 501; }, { from: 'SLOW', to: 'PAIR' }); profiler.finish();
    expect(reportSpike).toHaveBeenCalledWith(expect.objectContaining({ phase: 'relationEvaluation', duration: 501,
      date: ctx.date, context: { from: 'SLOW', to: 'PAIR' }, counts: expect.objectContaining({ countries: 8, relations: 28, wars: 0, candidatePairs: 12, proposals: 4, proposalsProcessed: 3 }) }));
    expect(profiler.last?.slowestPair).toEqual({ phase: 'relationEvaluation', duration: 501, context: { from: 'SLOW', to: 'PAIR' } });
    expect(profiler.last?.slowest).toEqual({ phase: 'relationEvaluation', duration: 501, context: { from: 'SLOW', to: 'PAIR' } });
  });
  it('reports accumulated subphase cost above 500 ms without printing arrays', () => {
    let time = 0; const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const profiler = createDiplomacyAIProfiler(true, { now: () => time }); profiler.begin(fixture());
    profiler.measure('relationEvaluation', () => { time += 300; }, { from: 'A', to: 'B' });
    profiler.measure('relationEvaluation', () => { time += 250; }, { from: 'C', to: 'D' }); profiler.finish();
    expect(warn).toHaveBeenCalledWith('[DiplomacyAI Slow Phase]', expect.objectContaining({ phase: 'relationEvaluation', duration: 550, context: { from: 'A', to: 'B' } }));
    expect(JSON.stringify(warn.mock.calls).length).toBeLessThan(1500);
  });
  it('preserves results, exceptions and skips clocks and warnings when disabled', () => {
    const now = vi.fn(() => { throw Error('disabled clock'); }), reportSpike = vi.fn();
    const profiler = createDiplomacyAIProfiler(false, { now, reportSpike }); const ctx = fixture();
    expect(current.processDiplomacyAI(ctx, 'C000', profiler)).toEqual(current.processDiplomacyAI(ctx, 'C000', quiet()));
    const error = new Error('engine failure'); expect(() => profiler.measure('accessLogic', () => { throw error; })).toThrow(error);
    expect(now).not.toHaveBeenCalled(); expect(reportSpike).not.toHaveBeenCalled(); expect(profiler.last).toBeUndefined();
  });
  it('records actual iteration counts and measures the same decisions when enabled', () => {
    const ctx = fixture(), profiler = createDiplomacyAIProfiler(true);
    const result = current.processDiplomacyAI(ctx, 'C000', profiler);
    expect(result).toEqual(current.processDiplomacyAI(ctx, 'C000', quiet()));
    expect(profiler.last?.counts).toMatchObject({ countries: 8, relations: 28, maintenancePairs: 49, candidatePairs: 49, wars: 0 });
    const stats = profiler.last!.phases;
    expect(Object.entries(stats).filter(([phase]) => phase !== 'TOTAL').reduce((sum, [, stat]) => sum + stat!.total, 0)).toBeCloseTo(stats.TOTAL!.total, 6);
  });
  it('handles performance unavailable and resets context between calls', () => {
    vi.stubGlobal('performance', undefined);
    const profiler = createDiplomacyAIProfiler(true); const ctx = day(fixture(), 1);
    current.processDiplomacyAI(ctx, 'C000', profiler); expect(profiler.last?.phases.TOTAL?.total).toBeGreaterThanOrEqual(0);
    const next = day(ctx, 1); current.processDiplomacyAI(next, 'C000', profiler);
    expect(profiler.last?.date).toEqual(next.date); expect(profiler.last?.counts.candidatePairs).toBe(0);
  });
});
