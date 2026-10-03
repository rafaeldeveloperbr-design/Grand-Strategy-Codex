import { describe, expect, it } from 'vitest';
import type { Country, Province } from '../../types';
import { processDailyTick } from '../economy';
import {
  GOOD_IDS, GOODS, calculateLocalPrice, calculateMarketSatisfactionAdjustment,
  calculateProduction, createDefaultMarket, processProvinceMarket,
} from '../market';
import { processDailyUnrestDecay } from '../unrest';

const province = (overrides: Partial<Province> = {}): Province => ({
  id: 'p1', name: 'Market', owner: 'A', color: '#000', neighbors: [],
  population: { total: 10000, growthRate: 0, employed: 5000, unemployed: 1000, satisfaction: 60 },
  maxPopulation: 20000, development: 5, buildings: [], defense: 0,
  center: { x: 0, y: 0 }, path: '', unrest: 10, ...overrides,
});
const country = (): Country => ({
  tag: 'A', name: 'A', adjective: 'A', color: '#000', colorLight: '#111', provinces: ['p1'],
  resources: { gold: 100, manpower: 0, maxManpower: 10000, stability: 60, prestige: 0 },
  economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 }, flag: '',
  activeLaws: { conscription: 'conscription_peacetime', taxation: 'taxation_normal', governance: 'governance_balanced', economy: 'economy_civilian', intelligence: 'intel_disorganized' },
});

describe('Mercado V1', () => {
  it('produção aumenta com capacidade de emprego e construções', () => {
    const low = calculateProduction(province({ development: 1 }));
    const high = calculateProduction(province({ development: 8, buildings: [{ type: 'farm', level: 2, daysRemaining: 0 }, { type: 'workshop', level: 2, daysRemaining: 0 }] }));
    expect(high[GOOD_IDS.FOOD]).toBeGreaterThan(low[GOOD_IDS.FOOD]);
    expect(high[GOOD_IDS.TOOLS]).toBeGreaterThan(low[GOOD_IDS.TOOLS]);
  });

  it('produção é limitada pela disponibilidade de trabalhadores', () => {
    const noWorkers = province({ population: { total: 0, growthRate: 0, employed: 0, unemployed: 0, satisfaction: 50 } });
    expect(Object.values(calculateProduction(noWorkers)).every(value => value === 0)).toBe(true);
  });

  it('população maior aumenta demanda de FOOD', () => {
    const small = processProvinceMarket(province({ population: { total: 1000, growthRate: 0, employed: 500, unemployed: 100, satisfaction: 60 } }));
    const large = processProvinceMarket(province());
    expect(large.goods[GOOD_IDS.FOOD].demand).toBeGreaterThan(small.goods[GOOD_IDS.FOOD].demand);
  });

  it('consumo reduz estoque, sem permitir estoque negativo', () => {
    const market = createDefaultMarket();
    market.goods[GOOD_IDS.FOOD].stock = 5;
    const result = processProvinceMarket(province({ market, population: { total: 20000, growthRate: 0, employed: 0, unemployed: 12000, satisfaction: 50 }, development: 0 }));
    expect(result.goods[GOOD_IDS.FOOD].consumption).toBeGreaterThan(0);
    expect(result.goods[GOOD_IDS.FOOD].stock).toBe(0);
  });

  it('detecta escassez quando disponibilidade não cobre demanda', () => {
    const result = processProvinceMarket(province({ development: 0 }));
    expect(result.goods[GOOD_IDS.FOOD].shortage).toBeGreaterThan(0);
  });

  it('excesso reduz preço e escassez aumenta preço', () => {
    const base = GOODS[GOOD_IDS.FOOD].basePrice;
    expect(calculateLocalPrice(GOOD_IDS.FOOD, 100, 10)).toBeLessThan(base);
    expect(calculateLocalPrice(GOOD_IDS.FOOD, 1, 10)).toBeGreaterThan(base);
  });

  it('limita preços entre 50% e 300% do preço base', () => {
    const base = GOODS[GOOD_IDS.IRON].basePrice;
    expect(calculateLocalPrice(GOOD_IDS.IRON, 1e9, 1)).toBe(base * 0.5);
    expect(calculateLocalPrice(GOOD_IDS.IRON, 0, 1e9)).toBe(base * 3);
  });

  it('FOOD caro piora poder de compra e boa economia/emprego melhora', () => {
    const scarce = processProvinceMarket(province({ development: 0 }));
    const stocked = createDefaultMarket();
    stocked.goods[GOOD_IDS.FOOD].stock = 100;
    const healthy = processProvinceMarket(province({ development: 10, market: stocked, buildings: [{ type: 'market', level: 3, daysRemaining: 0 }] }));
    expect(scarce.goods[GOOD_IDS.FOOD].price).toBeGreaterThan(healthy.goods[GOOD_IDS.FOOD].price);
    expect(healthy.purchasingPower).toBeGreaterThan(scarce.purchasingPower);
  });

  it('escassez reduz satisfaction e chega ao unrest pelo fluxo existente', () => {
    const scarceProvince = province({ development: 0 });
    const stock = createDefaultMarket(); stock.goods[GOOD_IDS.FOOD].stock = 100;
    const abundantProvince = province({ development: 8, market: stock });
    const scarceTick = processDailyTick(country(), [scarceProvince]).provinces[0];
    const abundantTick = processDailyTick(country(), [abundantProvince]).provinces[0];
    expect(calculateMarketSatisfactionAdjustment(scarceTick.market!)).toBeLessThan(calculateMarketSatisfactionAdjustment(abundantTick.market!));
    expect(scarceTick.population.satisfaction).toBeLessThan(abundantTick.population.satisfaction);
    const scarceUnrest = processDailyUnrestDecay([scarceTick], { day: 1, month: 1, year: 1 }, []).updatedProvinces[0].unrest!;
    const abundantUnrest = processDailyUnrestDecay([abundantTick], { day: 1, month: 1, year: 1 }, []).updatedProvinces[0].unrest!;
    expect(scarceUnrest).toBeGreaterThan(abundantUnrest);
  });
});
