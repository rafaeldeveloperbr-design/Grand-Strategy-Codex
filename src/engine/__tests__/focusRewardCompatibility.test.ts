import { describe, expect, it, vi } from 'vitest';
import type { RewardEffect } from '../../types/technology';
import { calculateTechBonuses, createInitialTechState, formatFocusEffect } from '../technology';
import { NATIONAL_FOCUSES } from '../../data/technology';

vi.mock('../../data/technology', () => ({
  TECHNOLOGIES: [],
  NATIONAL_FOCUSES: [{id:'compatibility',rewardEffects:[
    {type:'COMBAT_POWER',unitType:'armor',value:.1},
    {type:'GOOD_PRODUCTION',good:'food',value:.1},
    ...['GOLD_INCOME','BUILD_COST','BUILD_TIME','MANPOWER','STABILITY','RESEARCH_SPEED','DEFENSE_BONUS','POPULATION_GROWTH','POPULATION_CAPACITY','MIGRATION_ATTRACTION','INTERNAL_TRADE'].map(type => ({type,value:.1})),
    {type:'RECRUITMENT_TIME',value:-.1},{type:'MILITARY_MAINTENANCE',value:-.1},{type:'SATISFACTION',value:2},
  ]}],
}));

describe('legacy RewardEffect compatibility', () => {
  it('keeps all sixteen effect types', () => {
    const initial = createInitialTechState('TST');
    const once = calculateTechBonuses({...initial,completedFocuses:['compatibility']});
    expect(once.combatPowerBonus.armor).toBeCloseTo(.1);
    expect(once.productionMultipliers.food).toBeCloseTo(1.1);
    for (const key of ['goldIncomeMultiplier','buildCostMultiplier','buildTimeMultiplier','manpowerMultiplier','researchSpeedMultiplier','fortificationMultiplier','populationGrowthMultiplier','populationCapacityMultiplier','migrationAttractionMultiplier','internalTradeMultiplier'] as const) expect(once[key]).toBeCloseTo(1.1);
    expect(once.stabilityModifier).toBeCloseTo(.1);
    expect(once.satisfactionModifier).toBe(2);
    expect(once.recruitmentTimeMultiplier).toBeCloseTo(.9);
    expect(once.militaryMaintenanceMultiplier).toBeCloseTo(.9);
    for (const effect of NATIONAL_FOCUSES[0].rewardEffects) expect(formatFocusEffect(effect as RewardEffect)).toBeTruthy();
  });
});
