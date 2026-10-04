import { describe, expect, it } from 'vitest';
import type { Country, Province } from '../../types';
import { createInitialTechState, calculateTechBonuses } from '../technology';
import { processAIEconomicDecisions } from '../aiEngine/aiEconomy';
import {
  calculateDemand, calculateProduction, createDefaultMarket, processProvinceMarket,
} from '../market';
import { getFoodShortageStatus, processProvincePopulation } from '../population';

const built = (level: number): Province['buildings'][number] => ({ type: 'farm', level, daysRemaining: 0 });
const makeProvince = (total: number, farmLevel = 0, satisfaction = 60): Province => {
  const market = createDefaultMarket();
  market.goods.food.stock = 0;
  market.goods.wood.stock = 1_000;
  market.goods.iron.stock = 1_000;
  market.goods.tools.stock = 1_000;
  return {
    id: 'p', name: 'P', owner: 'A', color: '#000', neighbors: [], center: { x: 0, y: 0 }, path: '',
    population: { total, growthRate: 0, employed: Math.floor(total * .6), unemployed: 0, satisfaction },
    market, maxPopulation: 200_000, development: 5, buildings: farmLevel ? [built(farmLevel)] : [], defense: 0, unrest: 0,
  };
};
const country: Country = {
  tag: 'A', name: 'A', adjective: 'A', color: '#000', colorLight: '#111', flag: '', provinces: ['p'],
  resources: { gold: 10_000, manpower: 0, maxManpower: 0, stability: 50, prestige: 0 },
  economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
  activeLaws: { conscription: 'conscription_peacetime', taxation: 'taxation_normal', governance: 'governance_balanced', economy: '', intelligence: '' },
};

describe('balanceamento estrutural de FOOD', () => {
  it.each([10_000, 50_000, 100_000])('subsistência em %i habitantes é finita e não negativa', total => {
    const province = makeProvince(total);
    const production = calculateProduction(province).food;
    const demand = calculateDemand(province).food;
    expect(production).toBeGreaterThanOrEqual(0);
    expect(demand).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(production)).toBe(true);
    expect(Number.isFinite(demand)).toBe(true);
  });

  it('subsistência tem retornos decrescentes conforme a população aumenta', () => {
    const ratios = [10_000, 50_000, 100_000].map(total => {
      const province = makeProvince(total);
      return calculateProduction(province).food / calculateDemand(province).food;
    });
    expect(ratios[0]).toBeCloseTo(.75, 2);
    expect(ratios[1]).toBeLessThan(ratios[0]);
    expect(ratios[2]).toBeLessThan(ratios[1]);
    expect(ratios[2]).toBeLessThan(.4);
  });

  it.each([
    { total: 10_000, none: 7.5, levelOne: 10.47, levelFive: 22.35 },
    { total: 50_000, none: 21.35, levelOne: 24.32, levelFive: 36.2 },
    { total: 100_000, none: 33.5, levelOne: 36.47, levelFive: 48.35 },
  ])('compara produção/demanda sem Fazenda, Nv.1 e Nv.5 em $total habitantes', expected => {
    const { total } = expected;
    const none = calculateProduction(makeProvince(total)).food;
    const levelOne = calculateProduction(makeProvince(total, 1)).food;
    const levelFive = calculateProduction(makeProvince(total, 5)).food;
    const demand = calculateDemand(makeProvince(total)).food;
    expect({ none, levelOne, levelFive }).toEqual({ none: expected.none, levelOne: expected.levelOne, levelFive: expected.levelFive });
    expect(levelOne).toBeGreaterThan(none);
    expect(levelFive).toBeGreaterThan(levelOne);
    expect(levelFive / demand).toBeGreaterThan(levelOne / demand);
    expect(levelOne / demand).toBeGreaterThan(none / demand);
  });

  it('tecnologia de FOOD compõe uma vez com National Focus', () => {
    const province = makeProvince(50_000, 5);
    const state = { ...createInitialTechState('A'), completedTechnologies: ['improved_agriculture'], completedFocuses: ['focus_economic_expansion'] };
    const bonuses = calculateTechBonuses(state);
    expect(bonuses.productionMultipliers.food).toBeCloseTo(1.1);
    expect(calculateProduction(province, bonuses.productionMultipliers).food)
      .toBeCloseTo(calculateProduction(province).food * 1.1, 1);
  });

  it('satisfação altera somente a eficiência produtiva estruturada', () => {
    expect(calculateProduction(makeProvince(50_000, 5, 100)).food)
      .toBeGreaterThan(calculateProduction(makeProvince(50_000, 5, 0)).food);
  });

  it('população grande sem Fazenda entra em shortage severo sem criar estoque', () => {
    const market = processProvinceMarket(makeProvince(100_000));
    const status = getFoodShortageStatus(market.goods.food, 3, 3);
    expect(status.severity).toBe('severe');
    expect(market.goods.food.stock).toBe(0);
    expect(market.goods.food.consumption).toBeLessThanOrEqual(market.goods.food.production);
    expect(Object.values(market.goods).every(good => Number.isFinite(good.stock))).toBe(true);
  });

  it('classifica shortage moderado, crise e fome severa pelos thresholds compartilhados', () => {
    const moderate = {
      ...createDefaultMarket().goods.food,
      demand: 100,
      shortage: 20,
    };

    const crisis = {
      ...moderate,
      shortage: 50,
    };

    expect(getFoodShortageStatus(moderate).severity).toBe('moderate');

    expect(getFoodShortageStatus(crisis, 3, 2).severity).toBe('crisis');

    expect(getFoodShortageStatus(crisis, 3, 3).severity).toBe('severe');
  });

  it('persiste dias de shortage e zera a memória após recuperação', () => {
    let province = makeProvince(100_000);
    province.market = processProvinceMarket(province);
    province = processProvincePopulation(province, 1, 'taxation_normal');
    province = processProvincePopulation(province, 1, 'taxation_normal');
    province = processProvincePopulation(province, 1, 'taxation_normal');
    expect(province.population.foodShortageDays).toBe(3);
    expect(province.population.severeFoodShortageDays).toBe(3);
    province.market = createDefaultMarket();
    province.market.goods.food.demand = 100;
    province.market.goods.food.consumption = 100;
    province.market.goods.food.shortage = 0;
    province = processProvincePopulation(province, 1, 'taxation_normal');
    expect(province.population.foodShortageDays).toBe(0);
    expect(province.population.severeFoodShortageDays).toBe(0);
  });

  it('IA prioriza Fazenda antes de infraestrutura durante fome severa', () => {
    const province = makeProvince(100_000);
    province.market = processProvinceMarket(province);
    province.population.severeFoodShortageDays = 3;
    const result = processAIEconomicDecisions(country, [province], createInitialTechState('A'), [], [], '1/1/1', false);
    expect(result.buildingConstructions[0]?.buildingType).toBe('farm');
  });
});
