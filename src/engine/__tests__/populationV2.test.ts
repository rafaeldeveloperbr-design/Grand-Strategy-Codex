import { describe, expect, it } from 'vitest';
import type { Country, Province, ProvinceMarket } from '../../types';
import { calculateMaxManpower, processDailyTick } from '../economy';
import { calculateProduction, createDefaultMarket } from '../market';
import {
  calculatePopulationGrowthBreakdown, calculateSatisfaction, getPopulationCapacity,
  processInternalMigration, recalculateEmployment,
} from '../population';

const marketWithFoodShortage = (ratio: number): ProvinceMarket => {
  const market = createDefaultMarket();
  market.goods.food = { ...market.goods.food, demand: 100, consumption: 100 * (1 - ratio), shortage: 100 * ratio, price: 1 + ratio };
  return market;
};
const province = (overrides: Partial<Province> = {}): Province => ({
  id: 'p', name: 'P', owner: 'TST', color: '#000', neighbors: [], center: { x: 0, y: 0 }, path: '',
  population: { total: 10_000, growthRate: 0.002, employed: 4_000, unemployed: 2_000, satisfaction: 60 },
  maxPopulation: 20_000, development: 5, buildings: [], defense: 0, unrest: 0, ...overrides,
});
const country = (conscription = 'conscription_peacetime'): Country => ({
  tag: 'TST', name: 'Test', adjective: 'Test', color: '#000', colorLight: '#111', flag: '', provinces: ['p'],
  resources: { gold: 100, manpower: 0, maxManpower: 0, stability: 50, prestige: 0 },
  economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
  activeLaws: { conscription, taxation: 'taxation_normal', governance: 'governance_balanced', economy: '', intelligence: '' },
});

describe('Population / Society V2', () => {
  it('mantém crescimento base com FOOD saudável', () => {
    const result = calculatePopulationGrowthBreakdown(province({ market: marketWithFoodShortage(0) }), 50);
    expect(result.foodRate).toBe(0);
    expect(result.finalGrowth).toBe(20);
  });
  it('shortage moderado reduz crescimento sem devastar a província', () => {
    const healthy = calculatePopulationGrowthBreakdown(province({ market: marketWithFoodShortage(0) }), 50);
    const moderate = calculatePopulationGrowthBreakdown(province({ market: marketWithFoodShortage(0.3) }), 50);
    expect(moderate.finalGrowth).toBeLessThan(healthy.finalGrowth);
    expect(moderate.finalGrowth).toBeGreaterThan(-10);
  });
  it('shortage severo persistente pode causar crescimento negativo', () => {
    const crisis = province({ market: marketWithFoodShortage(1), population: { total: 10_000, growthRate: .002, employed: 4_000, unemployed: 2_000, satisfaction: 20, foodShortageDays: 4 } });
    expect(calculatePopulationGrowthBreakdown(crisis, 50).finalGrowth).toBeLessThan(0);
  });
  it('shortage de FOOD e desemprego reduzem satisfação', () => {
    const healthy = province({ development: 10, market: marketWithFoodShortage(0) });
    const hungry = province({ development: 0, market: marketWithFoodShortage(.8) });
    expect(calculateSatisfaction(hungry, 'taxation_normal')).toBeLessThan(calculateSatisfaction(healthy, 'taxation_normal'));
  });
  it('satisfação afeta crescimento moderadamente', () => {
    const low = calculatePopulationGrowthBreakdown(province({ population: { total: 10_000, growthRate: .002, employed: 4_000, unemployed: 2_000, satisfaction: 20 } }), 50);
    const high = calculatePopulationGrowthBreakdown(province({ population: { total: 10_000, growthRate: .002, employed: 4_000, unemployed: 2_000, satisfaction: 90 } }), 50);
    expect(high.finalGrowth).toBeGreaterThan(low.finalGrowth);
  });
  it('Housing aumenta capacidade e pressão de capacidade limita crescimento', () => {
    const housing = province({ buildings: [{ type: 'housing', level: 2, daysRemaining: 0 }] });
    expect(getPopulationCapacity(housing)).toBe(30_000);
    const full = province({ population: { total: 19_900, growthRate: .002, employed: 0, unemployed: 0, satisfaction: 60 } });
    expect(calculatePopulationGrowthBreakdown(full, 50).capacityRate).toBeLessThan(0);
  });
  it('emprego nunca excede workforce e desemprego é o restante exato', () => {
    const population = recalculateEmployment(province({ development: 10, buildings: [{ type: 'market', level: 5, daysRemaining: 0 }] }));
    expect(population.employed).toBeLessThanOrEqual(6_000);
    expect(population.unemployed).toBe(6_000 - population.employed);
  });
  it('falta de trabalhadores limita produção e satisfação afeta produtividade', () => {
    const productive = province({ buildings: [{ type: 'farm', level: 3, daysRemaining: 0 }] });
    const tiny = province({ buildings: productive.buildings, population: { total: 100, growthRate: 0, employed: 0, unemployed: 60, satisfaction: 60 } });
    expect(calculateProduction(tiny).food).toBeLessThan(calculateProduction(productive).food);
    const unhappy = province({ buildings: productive.buildings, population: { ...productive.population, satisfaction: 0 } });
    expect(calculateProduction(unhappy).food).toBeLessThan(calculateProduction(productive).food);
  });
  it('manpower máximo é fração da população e preserva leis de conscrição', () => {
    expect(calculateMaxManpower([province()])).toBe(3_000);
    const peace = processDailyTick(country(), [province()]).country.resources.maxManpower;
    const total = processDailyTick(country('conscription_total'), [province()]).country.resources.maxManpower;
    expect(total).toBeGreaterThan(peace);
    expect(total).toBeLessThan(10_000);
  });
  it('migração conserva população e respeita capacidade', () => {
    const origin = province({ id: 'a', development: 0, market: marketWithFoodShortage(1), population: { total: 10_000, growthRate: 0, employed: 0, unemployed: 6_000, satisfaction: 10 } });
    const destination = province({ id: 'b', development: 10, maxPopulation: 10_001, market: marketWithFoodShortage(0), population: { total: 10_000, growthRate: 0, employed: 6_000, unemployed: 0, satisfaction: 90 } });
    const result = processInternalMigration([origin, destination]);
    expect(result.reduce((sum, p) => sum + p.population.total, 0)).toBe(20_000);
    expect(result[1].population.total).toBe(10_001);
  });
  it('migração não ocorre sem diferença mínima de atratividade', () => {
    const result = processInternalMigration([province({ id: 'a' }), province({ id: 'b' })]);
    expect(result.map(p => p.population.total)).toEqual([10_000, 10_000]);
  });
});
