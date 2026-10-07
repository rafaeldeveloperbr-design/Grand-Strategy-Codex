import { describe, expect, it } from 'vitest';
import { countries } from '../../data/countries';
import { provincesData } from '../../data/provinces';
import { UNIT_DEFINITIONS } from '../../data/units';
import { createInitialTechState } from '../technology';
import { normalizeMarket } from '../market';
import {
  NEUTRAL_TERRAIN_MODIFIERS, calculateArmyCombatStats, calculateArmyMaintenance,
  calculateArmyOrganization, calculateArmySiege, calculateArmySize, canRecruit,
  createArmy, createRegiment, getArmySupply, getEffectiveRecruitmentCost,
  getRecruitmentBlockReason, mergeArmies, queueRecruitment, recoverArmy,
} from '../military';

const setup = () => {
  const country = { ...countries[0], resources: { ...countries[0].resources, gold: 5000, manpower: 10000 }, activeLaws: { ...countries[0].activeLaws } };
  const base = provincesData.find(province => province.owner === country.tag)!;
  const market = normalizeMarket(base.market);
  market.goods.iron.stock = 1000; market.goods.tools.stock = 1000;
  const province = { ...base, buildings: [...base.buildings], market };
  return { country, province, technology: createInitialTechState(country.tag) };
};

describe('Military V2 recruitment', () => {
  it('centralizes adjusted costs and charges every canonical resource exactly once', () => {
    const context = setup();
    const cost = getEffectiveRecruitmentCost('infantry', context);
    const result = queueRecruitment('infantry', context, 'rec-test');
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.country.resources.gold).toBe(context.country.resources.gold - cost.gold);
    expect(result.country.resources.manpower).toBe(context.country.resources.manpower - cost.manpower);
    expect(result.province.market!.goods.iron.stock).toBe(context.province.market!.goods.iron.stock - cost.iron);
    expect(result.recruitment.paidCost).toEqual({ gold: cost.gold, manpower: cost.manpower, iron: cost.iron, tools: cost.tools });
  });

  it('blocks unavailable technology and insufficient resources without mutation', () => {
    const context = setup();
    expect(canRecruit('artillery', context)).toBe(false);
    expect(getRecruitmentBlockReason('artillery', context)).toContain('Armas Melhoradas');
    const poor = { ...context, country: { ...context.country, resources: { ...context.country.resources, manpower: 0 } } };
    expect(getRecruitmentBlockReason('infantry', poor)).toBe('Manpower insuficiente');
    expect(queueRecruitment('infantry', poor).success).toBe(false);
  });
});

describe('Military V2 regiments, logistics and recovery', () => {
  it('derives meaningful army stats from composition and keeps merged regiments valid', () => {
    const first = createArmy('IMP', 'I', 'p1'); first.regiments = [createRegiment('infantry', 'p1')];
    const second = createArmy('IMP', 'II', 'p1'); second.regiments = [createRegiment('infantry', 'p1'), createRegiment('siege_engine', 'p1')];
    const merged = mergeArmies(first, second);
    expect(calculateArmySize(merged)).toBe(UNIT_DEFINITIONS.infantry.maxStrength * 2 + UNIT_DEFINITIONS.siege_engine.maxStrength);
    expect(merged.regiments.every(regiment => regiment.strength <= (regiment.maxStrength ?? UNIT_DEFINITIONS[regiment.type].maxStrength))).toBe(true);
    expect(calculateArmySiege(merged)).toBeGreaterThan(30);
    expect(calculateArmyMaintenance(merged)).toBeGreaterThan(calculateArmyMaintenance(first));
    expect(calculateArmyCombatStats(merged).attack).toBeGreaterThan(calculateArmyCombatStats(first).attack);
  });

  it('reinforces only from manpower and equipment, while recovering organization separately', () => {
    const context = setup();
    const army = createArmy(context.country.tag, 'Damaged', context.province.id);
    army.regiments = [{ ...createRegiment('infantry', context.province.id), strength: 700, morale: 50, organization: 40, experience: 12 }];
    const result = recoverArmy(army, context.country, context.province);
    expect(result.reinforced).toBeGreaterThan(0);
    expect(calculateArmySize(result.army)).toBeGreaterThan(700);
    expect(result.country.resources.manpower).toBe(context.country.resources.manpower - result.reinforced);
    expect(calculateArmyOrganization(result.army)).toBeGreaterThan(40);
    expect(result.army.regiments[0].experience).toBe(12);
  });

  it('shares local supply and applies critical penalties without terrain effects', () => {
    const context = setup();
    const army = createArmy(context.country.tag, 'Host', context.province.id);
    army.regiments = Array.from({ length: 30 }, () => createRegiment('heavy_cavalry', context.province.id));
    const supply = getArmySupply(army, context.province, [army]);
    expect(supply.status).toBe('critical');
    expect(supply.combatMultiplier).toBeLessThan(1);
    expect(NEUTRAL_TERRAIN_MODIFIERS).toEqual({ attack: 1, defense: 1, movement: 1, supply: 1 });
  });
});
