import { describe, expect, it } from 'vitest';
import { countries } from '../../data/countries';
import { provincesData } from '../../data/provinces';
import { RECRUITABLE_UNIT_IDS, UNIT_DEFINITIONS, isRecognizedUnitType } from '../../data/units';
import type { UnitType } from '../../types';
import { normalizeMarket } from '../market';
import { createInitialTechState, calculateTechBonuses } from '../technology';
import { createArmy, createRegiment, calculateArmySpeed } from '../military/militaryUtils';
import { calculateArmyCombatStats, calculateArmySupplyUse } from '../military/armyStats';
import { cancelRecruitment, getEffectiveRecruitmentCost, getRecruitmentBlockReason, processRecruitments, queueRecruitment } from '../military/recruitmentEngine';
import { rankRecruitmentProjects } from '../military/aiRecruitment';
import { validateMilitarySave } from '../military/saveCompatibility';
import { getArmySupply } from '../military/supplyEngine';
import { recoverArmy } from '../military/recoveryEngine';
import { calculateArmyBasePower } from '../combat/combatCalculations';
import { startContinuousBattle, processBattleDay } from '../combat/continuousBattle';

export function modernContext(level = 2) {
  const country = structuredClone(countries[0]);
  country.resources.gold = 5000; country.resources.manpower = 20000;
  const province = structuredClone(provincesData.find(p => p.owner === country.tag)!);
  province.buildings = [{ type: 'military_arsenal', level, daysRemaining: 0 }];
  province.market = normalizeMarket(province.market);
  province.market.goods.iron.stock = 1000; province.market.goods.tools.stock = 1000;
  const technology = createInitialTechState(country.tag);
  technology.completedTechnologies.push('improved_weapons');
  return { country, province, technology };
}
const host = (type: UnitType) => ({ ...createArmy('BRA', 'Test', 'p'), regiments: [createRegiment(type)] });

describe('Military Units V3', () => {
  it('has exactly seven recruitable types and twelve complete recognized definitions', () => {
    expect(RECRUITABLE_UNIT_IDS).toEqual(['infantry', 'motorized_infantry', 'armor', 'artillery', 'reconnaissance', 'engineers', 'garrison']);
    expect(Object.keys(UNIT_DEFINITIONS)).toHaveLength(12);
    for (const [id, definition] of Object.entries(UNIT_DEFINITIONS)) {
      expect(isRecognizedUnitType(id)).toBe(true);
      for (const field of ['attack', 'defense', 'mobility', 'supplyUse', 'cost', 'maxStrength'] as const) expect(Number.isFinite(definition[field])).toBe(true);
    }
    expect(isRecognizedUnitType('tank')).toBe(false);
  });
  it('gives units distinct strategic roles and mobility without cavalry conversion', () => {
    expect(calculateArmyCombatStats(host('armor')).attack).toBeGreaterThan(calculateArmyCombatStats(host('artillery')).attack);
    expect(calculateArmyCombatStats(host('engineers')).defense).toBeGreaterThan(calculateArmyCombatStats(host('motorized_infantry')).defense);
    expect(calculateArmySpeed(host('reconnaissance'))).toBeGreaterThan(calculateArmySpeed(host('motorized_infantry')));
    expect(calculateArmySupplyUse(host('armor'))).toBeGreaterThan(calculateArmySupplyUse(host('infantry')));
    expect(UNIT_DEFINITIONS.cavalry.name).not.toBe(UNIT_DEFINITIONS.armor.name);
  });
  it.each(RECRUITABLE_UNIT_IDS)('charges real resources once for %s and records its paid workload', type => {
    const ctx = modernContext(), cost = getEffectiveRecruitmentCost(type, ctx);
    const result = queueRecruitment(type, ctx, 'paid');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.country.resources.gold).toBe(ctx.country.resources.gold - cost.gold);
    expect(result.country.resources.manpower).toBe(ctx.country.resources.manpower - cost.manpower);
    expect(result.province.market!.goods.iron.stock).toBeCloseTo(1000 - cost.iron);
    expect(result.province.market!.goods.tools.stock).toBeCloseTo(1000 - cost.tools);
    expect(result.recruitment.totalDays).toBe(cost.days);
    expect(result.recruitment.paidCost?.gold).toBe(cost.gold);
  });
  it('requires Arsenal levels and technology, but not for infantry or garrison', () => {
    const ctx = modernContext(1);
    expect(getRecruitmentBlockReason('armor', ctx)).toContain('2');
    ctx.province.buildings = [];
    expect(getRecruitmentBlockReason('motorized_infantry', ctx)).toContain('Arsenal');
    expect(getRecruitmentBlockReason('infantry', ctx)).toBeNull();
    expect(getRecruitmentBlockReason('garrison', ctx)).toBeNull();
    ctx.technology.completedTechnologies = [];
    expect(getRecruitmentBlockReason('artillery', ctx)).toContain('tecnologia');
  });
  it('preserves paid legacy queues without new prerequisites or another payment', () => {
    const ctx = modernContext(); ctx.province.buildings = []; ctx.technology.completedTechnologies = [];
    const legacy = ['cavalry', 'archers', 'heavy_cavalry', 'elite_guard', 'siege_engine'] as const;
    for (const type of legacy) expect(queueRecruitment(type, ctx).success).toBe(false);
    const queues = legacy.map((unitType, i) => ({ id: String(i), owner: ctx.country.tag, provinceId: ctx.province.id, unitType, count: 1, daysRemaining: 1 }));
    const done = processRecruitments(queues, [], [ctx.country], [ctx.province]);
    expect(done.recruitments).toEqual([]);
    expect(done.armies.flatMap(a => a.regiments.map(r => r.type))).toEqual(legacy);
    expect(done.countries[0].resources).toEqual(ctx.country.resources);
  });
  it('refunds actual paid gold without multiplying grouped budgets or over-refunding', () => {
    const ctx = modernContext(); const result = queueRecruitment('armor', ctx, 'paid');
    if (!result.success) throw new Error('fixture');
    const rec = { ...result.recruitment, count: 2, daysRemaining: 10000 };
    const first = cancelRecruitment('paid', [rec], 0);
    const second = cancelRecruitment('paid', first.updatedRecruitments, first.newGold);
    expect(second.newGold).toBe(rec.paidCost!.gold);
    expect(first.updatedRecruitments[0].paidCost!.gold).toBe(rec.paidCost!.gold / 2);
  });
  it('caps Arsenal equipment discounts at 15 percent', () => {
    const cost = getEffectiveRecruitmentCost('armor', modernContext(5));
    expect(cost.iron).toBeCloseTo(UNIT_DEFINITIONS.armor.ironCost * .85);
    expect(cost.tools).toBeCloseTo(UNIT_DEFINITIONS.armor.toolsCost * .85);
  });
  it('technology bonuses cover all recognized types and remain specific to their unit', () => {
    const bonus = calculateTechBonuses(createInitialTechState('BRA'));
    expect(Object.keys(bonus.combatPowerBonus)).toHaveLength(12);
    expect(calculateArmyCombatStats(host('armor'), { cavalry: 1 })).toEqual(calculateArmyCombatStats(host('armor')));
    expect(calculateArmyCombatStats(host('cavalry'), { cavalry: 1 }).attack).toBe(calculateArmyCombatStats(host('cavalry')).attack * 2);
  });
  it('shares scarce supply across modern stacks without draining organization or morale', () => {
    const ctx = modernContext(); const first = host('armor'), second = host('armor');
    first.owner = second.owner = ctx.country.tag; first.location = second.location = ctx.province.id;
    first.regiments = Array.from({ length: 100 }, () => ({ ...createRegiment('armor'), organization: 40, morale: 50 }));
    const supply = getArmySupply(first, ctx.province, [first, second]);
    expect(supply.status).toBe('critical'); expect(supply.ratio).toBeGreaterThanOrEqual(0); expect(supply.ratio).toBeLessThanOrEqual(1);
    expect(supply.ratio).toBeLessThan(getArmySupply(first, ctx.province, [first]).ratio);
    const recovered = recoverArmy(first, ctx.country, ctx.province, [first, second]);
    expect(recovered.army.regiments[0].organization).toBeGreaterThanOrEqual(40);
    expect(recovered.army.regiments[0].morale).toBeGreaterThanOrEqual(50);
  });
  it('uses the same combat stats for legacy resolution and daily modern battle snapshots', () => {
    const ctx = modernContext(); const attacker = host('armor'), defender = host('infantry');
    attacker.owner = 'ARG'; defender.owner = ctx.country.tag;
    attacker.location = defender.location = ctx.province.id;
    const stats = calculateArmyCombatStats(attacker);
    expect(calculateArmyBasePower(attacker)).toBeCloseTo((stats.attack + stats.defense * .35 + stats.shock * .45) * 100);
    const date = { year: 1836, month: 1, day: 1 };
    const battle = startContinuousBattle([attacker], [defender], ctx.province, date, 'v3-battle');
    expect(battle.attackerCombatSnapshot?.regimentComposition.armor).toBe(UNIT_DEFINITIONS.armor.maxStrength);
    const result = processBattleDay(battle, [attacker, defender], ctx.province, [ctx.province]);
    expect(result).toBeTruthy();
    validateMilitarySave(battle);
  });
  it('AI is deterministic, respects requirements and queues, and retains a treasury reserve', () => {
    const ctx = modernContext();
    const args: Parameters<typeof rankRecruitmentProjects> = [ctx.country, [ctx.province], ctx.technology, [], [], true];
    expect(rankRecruitmentProjects(...args)).toEqual(rankRecruitmentProjects(...args));
    expect(rankRecruitmentProjects(...args)[0].type).toBe('infantry');
    const queues = [{ id: 'pending', owner: ctx.country.tag, provinceId: ctx.province.id, unitType: 'infantry' as const, count: 10, daysRemaining: 30 }];
    expect(rankRecruitmentProjects(ctx.country, [ctx.province], ctx.technology, [], queues, true)[0]?.type).not.toBe('infantry');
    ctx.country.resources.gold = 150;
    expect(rankRecruitmentProjects(...args)).toEqual([]);
  });
  it.each([
    { armies: [{ regiments: [{ type: 'tank' }] }] },
    { recruitments: [{ unitType: 'tank' }] },
    { rebelArmy: { regiments: [{ type: 'tank' }] } },
    { activeBattles: [{ initialSnapshot: { regiments: [{ type: 'tank' }] } }] },
    { report: { regimentComposition: { tank: 1 } } },
  ])('rejects unknown IDs throughout nested military data', payload => {
    expect(() => validateMilitarySave(payload)).toThrow(/tank/);
  });
  it('preserves partial legacy state and rejects nonfinite military values', () => {
    const regiment = { ...createRegiment('archers'), strength: 333, experience: 12, organization: 67, morale: 81 };
    const original = structuredClone(regiment);
    validateMilitarySave({ armies: [{ regiments: [regiment] }] });
    expect(regiment).toEqual(original);
    expect(() => validateMilitarySave({ regiments: [{ ...regiment, strength: Infinity }] })).toThrow();
  });
});
