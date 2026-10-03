import { describe, expect, it } from 'vitest';
import type { Country, Province, ProvinceMarket } from '../../types';
import { calculateDailyPopulationGrowthBreakdown, processDailyTick } from '../economy';
import { calculateTechBonuses, createInitialTechState } from '../technology';
import { createDefaultMarket } from '../market';
import {
  calculateSatisfaction, calculateWorkforce, getFoodShortageStatus, getPopulationCapacity,
  processInternalMigration, processProvincePopulation,
} from '../population';

const country = (): Country => ({
  tag: 'A', name: 'A', adjective: 'A', color: '#000', colorLight: '#111', flag: '', provinces: ['p'],
  resources: { gold: 10_000, manpower: 0, maxManpower: 0, stability: 50, prestige: 0 },
  economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
  activeLaws: { conscription: 'conscription_peacetime', taxation: 'taxation_normal', governance: 'governance_balanced', economy: '', intelligence: '' },
});
const province = (id = 'p', total = 10_000, farmLevel = 0): Province => ({
  id, name: id, owner: 'A', color: '#000', neighbors: [], center: { x: 0, y: 0 }, path: '',
  population: { total, growthRate: .002, employed: Math.floor(total * .4), unemployed: Math.floor(total * .2), satisfaction: 60 },
  market: createDefaultMarket(), maxPopulation: 200_000, development: 5,
  buildings: farmLevel ? [{ type: 'farm', level: farmLevel, daysRemaining: 0 }] : [], defense: 0, unrest: 0,
});
const shortageMarket = (ratio: number): ProvinceMarket => {
  const market = createDefaultMarket();
  market.goods.food = { ...market.goods.food, stock: 0, production: 100 * (1 - ratio), demand: 100,
    consumption: 100 * (1 - ratio), shortage: 100 * ratio, price: 1 + ratio, imported: 0, exported: 0 };
  return market;
};

function simulateProvince(initial: Province, days: number): Province {
  let currentProvince = initial;
  let currentCountry = country();
  for (let day = 0; day < days; day += 1) {
    const result = processDailyTick(currentCountry, [currentProvince]);
    currentCountry = result.country;
    currentProvince = result.provinces[0];
  }
  return currentProvince;
}

describe('Population V2 - simulação prolongada', () => {
  it('A: província pequena com FOOD suficiente cresce por centenas de ticks', () => {
    const initial = province('p', 10_000, 5);
    const result = simulateProvince(initial, 200);
    expect(result.population.total).toBeGreaterThan(initial.population.total);
    expect(getFoodShortageStatus(result.market?.goods.food, result.population.foodShortageDays, result.population.severeFoodShortageDays).severity).toBe('healthy');
  });

  it('B: subsistência não acompanha linearmente crescimento prolongado', () => {
    const initial = province('p', 10_000);
    const result = simulateProvince(initial, 300);
    const food = result.market!.goods.food;
    expect(food.production / food.demand).toBeLessThan(.75);
    expect(result.population.total).toBeLessThan(simulateProvince(province('p', 10_000, 5), 300).population.total);
  });

  it('C: fome entra após tolerância e permanece enquanto shortage severo persiste', () => {
    let current: Province = { ...province('p', 25_000), market: shortageMarket(.52) };
    const totals: number[] = [];
    for (let day = 0; day < 30; day += 1) {
      current.market = shortageMarket(day < 3 ? .52 : day % 2 === 0 ? .5 : .499);
      current = processProvincePopulation(current, 1, 'taxation_normal');
      totals.push(current.population.total);
      if (day >= 2) {
        expect(getFoodShortageStatus(current.market!.goods.food, current.population.foodShortageDays, current.population.severeFoodShortageDays).severity).toBe('severe');
      }
    }
    expect(totals[totals.length - 1]).toBeLessThan(totals[2]);
  });

  it('regressão: shortage ~50% com mais de 1800 dias não alterna fome e escassez', () => {
    let current = province('p', 25_000);
    current.population.foodShortageDays = 1800;
    current.population.severeFoodShortageDays = 1800;
    for (const ratio of [.5, .499, .501, .498, .5, .499]) {
      current.market = shortageMarket(ratio);
      current = processProvincePopulation(current, 1, 'taxation_normal');
      expect(getFoodShortageStatus(current.market!.goods.food, current.population.foodShortageDays, current.population.severeFoodShortageDays).severity).toBe('severe');
      expect(calculateDailyPopulationGrowthBreakdown(current, country()).foodRate).toBeLessThan(-.002);
    }
  });

  it('D: FOOD suficiente encerra fome e restaura crescimento normal', () => {
    let current = province('p', 25_000);
    current.population.foodShortageDays = 100;
    current.population.severeFoodShortageDays = 100;
    current.market = shortageMarket(.7);
    current = processProvincePopulation(current, 1, 'taxation_normal');
    current.market = shortageMarket(0);
    current = processProvincePopulation(current, 1, 'taxation_normal');
    const status = getFoodShortageStatus(current.market!.goods.food, current.population.foodShortageDays, current.population.severeFoodShortageDays);
    expect(status.severity).toBe('healthy');
    expect(current.population.foodShortageDays).toBe(0);
    expect(current.population.severeFoodShortageDays).toBe(0);
    expect(calculateDailyPopulationGrowthBreakdown(current, country()).foodRate).toBe(0);
  });

  it('E: Housing e capacidade tecnológica não produzem FOOD', () => {
    const crowded = province('p', 100_000);
    crowded.buildings = [{ type: 'housing', level: 5, daysRemaining: 0 }];
    crowded.market = shortageMarket(.7);
    const bonuses = calculateTechBonuses({ ...createInitialTechState('A'), completedTechnologies: ['medicine', 'urbanization'] });
    expect(getPopulationCapacity(crowded, bonuses.populationCapacityMultiplier)).toBeGreaterThan(getPopulationCapacity(crowded));
    expect(getFoodShortageStatus(crowded.market.goods.food, 10, 10).severity).toBe('severe');
  });

  it('F/G: migração favorece província saudável e conserva população', () => {
    const hungry = province('hungry', 25_000);
    hungry.population = { ...hungry.population, satisfaction: 45, foodShortageDays: 20, severeFoodShortageDays: 20 };
    hungry.market = shortageMarket(.6);
    const healthy = province('healthy', 20_000, 5);
    healthy.population = { ...healthy.population, satisfaction: 75 };
    healthy.market = shortageMarket(0);
    const before = hungry.population.total + healthy.population.total;
    const result = processInternalMigration([hungry, healthy]);
    expect(result.find(item => item.id === 'hungry')!.population.migrationNet).toBeLessThan(0);
    expect(result.find(item => item.id === 'healthy')!.population.migrationNet).toBeGreaterThan(0);
    expect(result.reduce((sum, item) => sum + item.population.total, 0)).toBe(before);
  });

  it('H: fome severa e desemprego derrubam satisfação sem sair de 0..100', () => {
    const hungry = province('p', 25_000);
    hungry.development = 0;
    hungry.market = shortageMarket(.7);
    hungry.population.foodShortageDays = 20;
    hungry.population.severeFoodShortageDays = 20;
    const value = calculateSatisfaction(hungry, 'taxation_high', { atWar: true, economicMultiplier: .5, countryStability: 20 });
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(30);
    expect(value).toBeLessThanOrEqual(100);
  });

  it('I: tecnologias sociais alteram exatamente crescimento e capacidade', () => {
    const base = createInitialTechState('A');
    const sanitation = calculateTechBonuses({ ...base, completedTechnologies: ['sanitation'] });
    const capacity = calculateTechBonuses({ ...base, completedTechnologies: ['medicine', 'urbanization'] });
    expect(sanitation.populationGrowthMultiplier).toBeCloseTo(1.1);
    expect(capacity.populationCapacityMultiplier).toBeCloseTo(1.2);
  });

  it('mantém invariantes de população e emprego após simulação longa', () => {
    const result = simulateProvince(province('p', 30_000), 500);
    const workforce = calculateWorkforce(result.population);
    expect(result.population.total).toBeGreaterThanOrEqual(0);
    expect(result.population.employed).toBeGreaterThanOrEqual(0);
    expect(result.population.employed).toBeLessThanOrEqual(workforce);
    expect(result.population.unemployed).toBeGreaterThanOrEqual(0);
    expect(result.population.unemployed).toBeLessThanOrEqual(workforce);
    expect(result.population.employed + result.population.unemployed).toBe(workforce);
    expect(result.population.satisfaction).toBeGreaterThanOrEqual(0);
    expect(result.population.satisfaction).toBeLessThanOrEqual(100);
  });
});
