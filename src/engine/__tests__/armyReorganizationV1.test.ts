import { describe, expect, it } from 'vitest';
import { countries, provincesData } from '../../data/map';
import { UNIT_DEFINITIONS } from '../../data/units';
import type { Army, UnitType } from '../../types';
import { createArmy, createRegiment, calculateArmySpeed, calculateArmySupplyUse, getRegimentMaximum, getArmyReorganizationBlockReason, splitArmyByRegiments, splitArmyByHalf, transferRegiments, mergeArmyGroup, splitArmy, type ReorganizationContext } from '../military';
const province = provincesData.find(p => p.owner === 'BRA')!;
function host(id: string, types: UnitType[] = ['infantry', 'motorized_infantry', 'artillery', 'cavalry']): Army {
  const army = { ...createArmy('BRA', id, province.id), id, regiments: types.map((type, i) => ({ ...createRegiment(type, province.id), strength: Math.min(333 + i, UNIT_DEFINITIONS[type].maxStrength), organization: 31 + i, morale: 48 + i, experience: 12 + i })) };
  return { ...army, movementSpeed: calculateArmySpeed(army) };
}
function context(armies = [host('one'), host('two', ['armor', 'engineers'])]): ReorganizationContext { return { armies, provinces: [province], playerCountryTag: 'BRA', activeBattles: [] }; }
const totals = (armies: Army[]) => armies.reduce((sum, a) => ({ strength: sum.strength + a.regiments.reduce((s, r) => s + r.strength, 0), maximum: sum.maximum + a.regiments.reduce((s, r) => s + getRegimentMaximum(r), 0), count: sum.count + a.regiments.length, supply: sum.supply + calculateArmySupplyUse(a) }), { strength: 0, maximum: 0, count: 0, supply: 0 });
const sortedState = (armies: Army[]) => armies.flatMap(a => a.regiments).map(r => JSON.stringify(r)).sort();

describe('Army Reorganization V1 conservation', () => {
  it.each(['split', 'transfer', 'merge'] as const)('%s conserves troops, maximum, count, supply, resources and every regiment field', mode => {
    const ctx = context(), before = structuredClone(ctx), country = structuredClone(countries.find(c => c.tag === 'BRA')!);
    const result = mode === 'split' ? splitArmyByRegiments('one', [2, 0], ctx) : mode === 'transfer' ? transferRegiments('one', 'two', [2, 0], ctx) : mergeArmyGroup(['one', 'two'], ctx);
    expect(result.success).toBe(true); if (!result.success) return;
    const after = totals(result.armies), initial = totals(before.armies);
    expect(after.strength).toBe(initial.strength); expect(after.maximum).toBe(initial.maximum); expect(after.count).toBe(initial.count); expect(after.supply).toBeCloseTo(initial.supply, 12);
    expect(sortedState(result.armies)).toEqual(sortedState(before.armies));
    expect(ctx).toEqual(before); expect(country).toEqual(countries.find(c => c.tag === 'BRA'));
    expect(result.armies.every(a => a.regiments.some(r => r.strength > 0))).toBe(true);
    for (const army of result.armies) expect(army.movementSpeed).toBe(calculateArmySpeed(army));
  });
  it('preserves input order and creates an idle detachment selected after split', () => {
    const ctx = context(), result = splitArmyByRegiments('one', [2, 0], ctx);
    if (!result.success) throw new Error('fixture');
    const original = result.armies.find(a => a.id === 'one')!, created = result.armies.find(a => a.id === result.selectedArmyId)!;
    expect(original.regiments.map(r => r.type)).toEqual(['motorized_infantry', 'cavalry']);
    expect(created.regiments.map(r => r.type)).toEqual(['infantry', 'artillery']);
    expect(created.location).toBe(province.id); expect(created.destination).toBeNull(); expect(created.path).toEqual([]);
    expect(created.movementPlan).toBeUndefined(); expect(created.inCombat).toBe(false);
  });
  it('transfers whole damaged regiments to the end of the target and retains source selection', () => {
    const ctx = context(), result = transferRegiments('one', 'two', [2, 0], ctx);
    if (!result.success) throw new Error('fixture');
    expect(result.armies[1].regiments.map(r => r.type)).toEqual(['armor', 'engineers', 'infantry', 'artillery']);
    expect(result.armies[1].regiments[2]).toEqual(ctx.armies[0].regiments[0]); expect(result.selectedArmyId).toBe('one');
  });
  it('merges several modern/legacy armies keeping the primary ID/name and independent regiments', () => {
    const ctx = context([host('one'), host('two', ['armor']), host('three', ['archers', 'heavy_cavalry', 'siege_engine', 'elite_guard'])]);
    const result = mergeArmyGroup(['two', 'one', 'three'], ctx);
    if (!result.success) throw new Error('fixture');
    expect(result.armies).toHaveLength(1); expect(result.selectedArmyId).toBe('two'); expect(result.armies[0].name).toBe('two');
    expect(result.armies[0].regiments).toEqual([...ctx.armies[1].regiments, ...ctx.armies[0].regiments, ...ctx.armies[2].regiments]);
  });
  it('supports all twelve recognized unit IDs and never resets damaged state', () => {
    const types = Object.keys(UNIT_DEFINITIONS) as UnitType[], ctx = context([host('all', types)]);
    const result = splitArmyByRegiments('all', types.map((_, i) => i).filter(i => i % 2 === 0), ctx);
    expect(result.success).toBe(true); if (!result.success) return;
    expect(sortedState(result.armies)).toEqual(sortedState(ctx.armies));
  });
  it('uses deterministic half-count split without balancing strength', () => {
    const ctx = context(), result = splitArmyByHalf('one', ctx);
    if (!result.success) throw new Error('fixture');
    expect(result.armies.find(a => a.id === result.selectedArmyId)!.regiments).toEqual(ctx.armies[0].regiments.slice(0, 2));
  });
  it('avoids loaded IDs and duplicate detachment names', () => {
    const ctx = context([host('one'), ...Array.from({ length: 100 }, (_, i) => host(`army_${i + 1}`, ['infantry']))]);
    ctx.armies[1].name = 'one (Destacamento)'; ctx.armies[2].name = 'one (Destacamento) 2';
    const result = splitArmyByRegiments('one', [0], ctx);
    if (!result.success) throw new Error('fixture');
    expect(new Set(result.armies.map(a => a.id)).size).toBe(result.armies.length);
    expect(result.armies.find(a => a.id === result.selectedArmyId)!.name).toBe('one (Destacamento) 3');
  });
  it('preserves extra persisted regiment IDs without introducing an ID system', () => {
    const ctx = context();
    ctx.armies[0].regiments = ctx.armies[0].regiments.map((r, i) => Object.assign(r, { id: `reg-${i}`, extra: 'preserved' }));
    const result = splitArmyByRegiments('one', [1], ctx);
    if (!result.success) throw new Error('fixture');
    expect(sortedState(result.armies)).toEqual(sortedState(ctx.armies));
  });
});

describe('Army Reorganization V1 blocking and atomicity', () => {
  it.each([[], [0, 1, 2, 3], [0, 0], [-1], [9], [.5]].map(indices => ({ indices })))('rejects invalid split/transfer indices $indices without mutations', ({ indices }) => {
    const ctx = context(), before = structuredClone(ctx);
    expect(splitArmyByRegiments('one', indices, ctx).success).toBe(false);
    expect(transferRegiments('one', 'two', indices, ctx).success).toBe(false); expect(ctx).toEqual(before);
  });
  it.each([
    { inCombat: true }, { destination: province.id }, { path: [province.id] },
    { movementPlan: { waypoints: [province.id] } }, { targetDestination: province.id }, { movementProgress: .5 },
    { owner: 'ARG' }, { owner: 'rebel_BRA' }, { location: null }, { location: 'missing' },
  ] as Partial<Army>[])('blocks every operation for an ineligible army %j', patch => {
    const ctx = context(); Object.assign(ctx.armies[0], patch); const before = structuredClone(ctx);
    expect(getArmyReorganizationBlockReason(ctx.armies[0], ctx)).toBeTruthy();
    expect(splitArmyByRegiments('one', [0], ctx).success).toBe(false);
    expect(transferRegiments('one', 'two', [0], ctx).success).toBe(false);
    expect(mergeArmyGroup(['one', 'two'], ctx).success).toBe(false); expect(ctx).toEqual(before);
  });
  it('blocks an active battle participant even if its army flag is stale', () => {
    const ctx = context(); ctx.activeBattles = [{ participantArmyIds: ['one'] } as NonNullable<ReorganizationContext['activeBattles']>[number]];
    expect(getArmyReorganizationBlockReason(ctx.armies[0], ctx)).toBe('Exército em batalha');
  });
  it('blocks different provinces, foreign/moving targets and self transfer', () => {
    const ctx = context(); ctx.armies[1].location = 'elsewhere'; ctx.provinces.push({ ...province, id: 'elsewhere' });
    expect(transferRegiments('one', 'two', [0], ctx).success).toBe(false); expect(mergeArmyGroup(['one', 'two'], ctx).success).toBe(false);
    ctx.armies[1].location = province.id; ctx.armies[1].inCombat = true;
    expect(transferRegiments('one', 'two', [0], ctx).success).toBe(false);
    expect(transferRegiments('one', 'one', [0], ctx).success).toBe(false);
    expect(mergeArmyGroup(['one', 'one'], ctx).success).toBe(false);
  });
  it('blocks stale confirmations, absent sources and leaving only a destroyed regiment', () => {
    const ctx = context(), expected = JSON.stringify(ctx.armies[0].regiments);
    ctx.armies[0].regiments[0].strength -= 10;
    expect(splitArmyByRegiments('one', [0], ctx, expected).success).toBe(false);
    expect(splitArmyByRegiments('missing', [0], ctx).success).toBe(false);
    ctx.armies[0].regiments = [ctx.armies[0].regiments[0], { ...ctx.armies[0].regiments[1], strength: 0 }];
    expect(splitArmyByRegiments('one', [0], ctx).success).toBe(false);
  });
  it('fixes duplicate/fractional indices in the legacy split primitive too', () => {
    expect(splitArmy(host('one'), [0, 0], 'bad')).toBeNull(); expect(splitArmy(host('one'), [.5], 'bad')).toBeNull();
  });
});
