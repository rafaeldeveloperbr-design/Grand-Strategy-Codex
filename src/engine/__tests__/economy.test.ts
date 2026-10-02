import { describe, it, expect } from 'vitest';
import {
  calculateProvinceGoldIncome,
  calculatePopulationGrowth,
  calculateCountryExpenses,
  processDailyTick,
  calculateProvinceManpowerGain
} from '../economy';
import { processConstructions } from '../buildings';

import type {
  Province,
  Country,
  BuildingConstruction,
} from '../../types';


const baseProvince: Province = {
  id: 'p1',
  name: 'Província Teste',
  owner: 'BRA',
  color: '#00ff00',
  neighbors: [],
  population: { total: 10000, growthRate: 0.002, employed: 5000, unemployed: 1000, satisfaction: 60 },
  maxPopulation: 50000,
  development: 1,
  buildings: [],
  defense: 0,
  center: { x: 0, y: 0 },
  path: '',
  unrest: 0,
};


const baseCountry = {
  tag: 'BRA',
  provinces: ['p1'],
  resources: {
    gold: 100,
    manpower: 500,
    maxManpower: 10000,
    stability: 60,
  },
  activeLaws: {},
} as Country;

describe('ECONOMIA', () => {
  it('renda - população maior gera mais ouro', () => {
    const small = calculateProvinceGoldIncome({ ...baseProvince, population: { total: 1000, growthRate: 0.002, employed: 500, unemployed: 100, satisfaction: 60 } });
    const big = calculateProvinceGoldIncome({ ...baseProvince, population: { total: 10000, growthRate: 0.002, employed: 5000, unemployed: 1000, satisfaction: 60 } });
    expect(big).toBeGreaterThan(small);
    expect(big).toBeGreaterThan(0);
  });

  it('manutenção - mais províncias = mais despesa', () => {
    const cheap = calculateCountryExpenses({ ...baseCountry, provinces: ['p1'] }, [baseProvince]);
    const expensive = calculateCountryExpenses({ ...baseCountry, provinces: ['p1', 'p2', 'p3'] }, [baseProvince, baseProvince, baseProvince]);
    expect(expensive).toBeGreaterThan(cheap);
  });

  it('crescimento - população cresce com estabilidade alta', () => {
    const growthLowStab = calculatePopulationGrowth(baseProvince, 20);
    const growthHighStab = calculatePopulationGrowth(baseProvince, 90);
    expect(growthHighStab).toBeGreaterThan(growthLowStab);
  });

  it('crescimento - trava no maxPopulation', () => {
    const almostFull = { ...baseProvince, population: { total: 49900, growthRate: 0.002, employed: 24950, unemployed: 4990, satisfaction: 60 }, maxPopulation: 50000 };
    const growth = calculatePopulationGrowth(almostFull, 60);
    expect(almostFull.population.total + growth).toBeLessThanOrEqual(50000);
  });

  it('manpower - província gera manpower', () => {
    const gain = calculateProvinceManpowerGain(baseProvince);
    expect(gain).toBeGreaterThan(0);
  });

  it('processDailyTick - tick completo não quebra e gera renda', () => {
    const result = processDailyTick(baseCountry, [baseProvince]);
    expect(result.country.resources.gold).toBeDefined();
    expect(result.provinces[0].population.total).toBeGreaterThanOrEqual(baseProvince.population.total);
    expect(result.country.economy.goldIncome).toBeGreaterThan(0);
  });

  it('construção - finaliza obra', () => {
    const constructions = [{ id: 'c1', daysRemaining: 0, provinceId: 'p1', buildingType: 'farm' } as BuildingConstruction];
    const result = processConstructions(constructions, [baseProvince]);
    expect(result.completedConstructions.length).toBe(1);
  });
});
