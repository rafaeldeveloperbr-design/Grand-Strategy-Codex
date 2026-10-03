import { describe, expect, it } from 'vitest';
import type { Army, Province } from '../../types';
import { calculateProvinceGoldIncome } from '../economy';
import {
  applyMilitaryCasualties,
  calculateEmploymentCapacity,
  calculateSatisfaction,
  normalizePopulation,
  processProvincePopulation,
  recalculateEmployment,
} from '../population';
import { processDailyUnrestDecay } from '../unrest';

const makeProvince = (overrides: Partial<Province> = {}): Province => ({
  id: 'p1', name: 'Province', owner: 'A', color: '#000', neighbors: [],
  population: { total: 10000, growthRate: 0.002, employed: 5000, unemployed: 1000, satisfaction: 60 },
  maxPopulation: 20000, development: 5, buildings: [], defense: 0,
  center: { x: 0, y: 0 }, path: '', unrest: 10, ...overrides,
});
const makeArmy = (strength: number): Army => ({
  id: 'a1', owner: 'A', name: 'Army', regiments: strength ? [{ type: 'infantry', strength, morale: 100, originProvinceId: 'p1' }] : [],
  location: 'p1', destination: null, targetDestination: null, movementProgress: 0,
  movementSpeed: 1, position: null, path: [], inCombat: true,
});

describe('Population V1', () => {
  it('cresce gradualmente e nunca ultrapassa a capacidade', () => {
    const updated = processProvincePopulation(makeProvince(), 1, 'taxation_normal');
    expect(updated.population.total).toBe(10020);
    expect(updated.population.total).toBeLessThanOrEqual(updated.maxPopulation);
  });

  it('normaliza população negativa sem permitir totais ou trabalhadores negativos', () => {
    const population = normalizePopulation({ total: -10, growthRate: -3, employed: -4, unemployed: -2, satisfaction: -30 });
    expect(population).toEqual({ total: 0, growthRate: -0.99, employed: 0, unemployed: 0, satisfaction: 0 });
  });

  it('calcula empregos a partir do desenvolvimento e construções', () => {
    const basic = makeProvince({ development: 1 });
    const productive = makeProvince({ development: 8, buildings: [{ type: 'market', level: 2, daysRemaining: 0 }] });
    expect(calculateEmploymentCapacity(productive)).toBeGreaterThan(calculateEmploymentCapacity(basic));
  });

  it('gera desemprego quando a capacidade é menor que a força de trabalho', () => {
    const population = recalculateEmployment(makeProvince({ development: 0 }));
    expect(population.unemployed).toBeGreaterThan(0);
    expect(population.employed + population.unemployed).toBeLessThanOrEqual(population.total);
  });

  it('mantém satisfação entre zero e cem', () => {
    expect(calculateSatisfaction(makeProvince(), 'taxation_high', { atWar: true, economicMultiplier: 0 })).toBeGreaterThanOrEqual(0);
    expect(calculateSatisfaction(makeProvince({ development: 10 }), 'taxation_low', { economicMultiplier: 10 })).toBeLessThanOrEqual(100);
  });

  it('desemprego reduz satisfação', () => {
    const lowJobs = makeProvince({ development: 0 });
    const highJobs = makeProvince({ development: 10, buildings: [{ type: 'market', level: 5, daysRemaining: 0 }] });
    expect(calculateSatisfaction(lowJobs, 'taxation_normal')).toBeLessThan(calculateSatisfaction(highJobs, 'taxation_normal'));
  });

  it('baixa satisfação aumenta a pressão no unrest existente', () => {
    const low = makeProvince({ population: { total: 10000, growthRate: 0, employed: 1000, unemployed: 5000, satisfaction: 10 } });
    const high = makeProvince({ population: { ...low.population, satisfaction: 90 } });
    const lowResult = processDailyUnrestDecay([low], { day: 1, month: 1, year: 1 }, []).updatedProvinces[0];
    const highResult = processDailyUnrestDecay([high], { day: 1, month: 1, year: 1 }, []).updatedProvinces[0];
    expect(lowResult.unrest).toBeGreaterThan(highResult.unrest!);
  });

  it('crescimento recalcula empregados e desempregados', () => {
    const before = makeProvince();
    const after = processProvincePopulation(before, 1, 'taxation_normal');
    expect(after.population.employed).not.toBe(before.population.employed);
    expect(after.population.employed + after.population.unemployed).toBeLessThanOrEqual(after.population.total);
  });

  it('produção é limitada pela disponibilidade de trabalhadores', () => {
    const noWorkers = makeProvince({ population: { total: 0, growthRate: 0, employed: 0, unemployed: 0, satisfaction: 50 } });
    expect(calculateProvinceGoldIncome(noWorkers)).toBe(0);
    expect(calculateProvinceGoldIncome(makeProvince())).toBeGreaterThan(0);
  });

  it('baixas militares com origem reduzem população exatamente uma vez', () => {
    const provinces = [makeProvince()];
    const once = applyMilitaryCasualties(provinces, [makeArmy(1000)], [makeArmy(700)]);
    expect(once[0].population.total).toBe(9700);
    const twice = applyMilitaryCasualties(once, [makeArmy(700)], [makeArmy(700)]);
    expect(twice[0].population.total).toBe(9700);
  });
});
