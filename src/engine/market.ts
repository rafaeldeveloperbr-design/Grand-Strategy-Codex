import type { GoodId, GoodMarketState, Province, ProvinceMarket } from '../types';
import { normalizePopulation, recalculateEmployment } from './population';

export const GOOD_IDS = {
  FOOD: 'food',
  WOOD: 'wood',
  IRON: 'iron',
  TOOLS: 'tools',
} as const satisfies Record<string, GoodId>;

export const GOODS: Record<GoodId, { id: GoodId; name: string; basePrice: number }> = {
  [GOOD_IDS.FOOD]: { id: GOOD_IDS.FOOD, name: 'Alimentos', basePrice: 1 },
  [GOOD_IDS.WOOD]: { id: GOOD_IDS.WOOD, name: 'Madeira', basePrice: 2 },
  [GOOD_IDS.IRON]: { id: GOOD_IDS.IRON, name: 'Ferro', basePrice: 4 },
  [GOOD_IDS.TOOLS]: { id: GOOD_IDS.TOOLS, name: 'Ferramentas', basePrice: 8 },
};

export const ALL_GOODS = Object.values(GOOD_IDS);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value * 100) / 100;

function emptyGood(id: GoodId): GoodMarketState {
  return { stock: 0, production: 0, demand: 0, consumption: 0, price: GOODS[id].basePrice, shortage: 0, imported: 0, exported: 0 };
}

export function createDefaultMarket(): ProvinceMarket {
  return {
    goods: Object.fromEntries(ALL_GOODS.map(id => [id, emptyGood(id)])) as Record<GoodId, GoodMarketState>,
    purchasingPower: 50,
  };
}

export function normalizeMarket(market?: Partial<ProvinceMarket>): ProvinceMarket {
  const defaults = createDefaultMarket();
  const goods = Object.fromEntries(ALL_GOODS.map(id => {
    const current = market?.goods?.[id];
    return [id, {
      stock: Math.max(0, current?.stock ?? defaults.goods[id].stock),
      production: Math.max(0, current?.production ?? 0),
      demand: Math.max(0, current?.demand ?? 0),
      consumption: Math.max(0, current?.consumption ?? 0),
      price: clamp(current?.price ?? GOODS[id].basePrice, GOODS[id].basePrice * 0.5, GOODS[id].basePrice * 3),
      shortage: Math.max(0, current?.shortage ?? 0),
      imported: Math.max(0, current?.imported ?? 0),
      exported: Math.max(0, current?.exported ?? 0),
    }];
  })) as Record<GoodId, GoodMarketState>;
  return { goods, purchasingPower: clamp(market?.purchasingPower ?? 50, 0, 100) };
}

export function calculateProduction(province: Province): Record<GoodId, number> {
  const population = recalculateEmployment(province);
  const workers = population.employed / 1000;
  const developmentFactor = 0.5 + clamp(province.development, 0, 10) * 0.1;
  const output: Record<GoodId, number> = {
    [GOOD_IDS.FOOD]: workers * 1.3 * developmentFactor,
    [GOOD_IDS.WOOD]: workers * 0.3 * developmentFactor,
    [GOOD_IDS.IRON]: workers * 0.13 * developmentFactor,
    [GOOD_IDS.TOOLS]: workers * 0.025 * Math.max(0.2, province.development / 5),
  };
  for (const building of province.buildings) {
    if (building.daysRemaining > 0) continue;
    if (building.type === 'farm') output[GOOD_IDS.FOOD] *= 1 + building.level * 0.4;
    if (building.type === 'workshop') output[GOOD_IDS.TOOLS] *= 1 + building.level * 0.5;
    if (building.type === 'market' || building.type === 'port') {
      for (const id of ALL_GOODS) output[id] *= 1 + building.level * 0.05;
    }
  }
  return Object.fromEntries(ALL_GOODS.map(id => [id, round(Math.max(0, output[id]))])) as Record<GoodId, number>;
}

export function calculateDemand(province: Province): Record<GoodId, number> {
  const population = normalizePopulation(province.population);
  const scale = population.total / 1000;
  const buildingLevels = province.buildings.filter(b => b.daysRemaining <= 0).reduce((sum, b) => sum + b.level, 0);
  return {
    [GOOD_IDS.FOOD]: round(scale),
    [GOOD_IDS.WOOD]: round(scale * 0.06 + buildingLevels * 0.15),
    [GOOD_IDS.IRON]: round(scale * 0.025 + buildingLevels * 0.1),
    [GOOD_IDS.TOOLS]: round(scale * 0.02 + buildingLevels * 0.12),
  };
}

export function calculateLocalPrice(id: GoodId, supply: number, demand: number): number {
  const base = GOODS[id].basePrice;
  if (demand <= 0) return base * 0.5;
  const ratio = demand / Math.max(0.01, supply);
  return round(base * clamp(Math.sqrt(ratio), 0.5, 3));
}

export function calculatePurchasingPower(province: Province, goods: Record<GoodId, GoodMarketState>): number {
  const population = recalculateEmployment(province);
  const workforce = population.employed + population.unemployed;
  const employmentRate = workforce > 0 ? population.employed / workforce : 0;
  const food = goods[GOOD_IDS.FOOD];
  const foodCost = food.price / GOODS[GOOD_IDS.FOOD].basePrice;
  const shortageRate = food.demand > 0 ? food.shortage / food.demand : 0;
  return round(clamp(45 + employmentRate * 35 + province.development * 1.5 - (foodCost - 1) * 18 - shortageRate * 35, 0, 100));
}

export function calculateMarketSatisfactionAdjustment(market: ProvinceMarket): number {
  const food = market.goods[GOOD_IDS.FOOD];
  const shortageRate = food.demand > 0 ? food.shortage / food.demand : 0;
  const affordability = 1 - food.price / GOODS[GOOD_IDS.FOOD].basePrice;
  const purchasingPowerEffect = (market.purchasingPower - 50) * 0.16;
  return clamp(affordability * 8 + purchasingPowerEffect - shortageRate * 18, -30, 8);
}

export function processProvinceMarket(province: Province): ProvinceMarket {
  const previous = normalizeMarket(province.market);
  const production = calculateProduction(province);
  const demand = calculateDemand(province);
  const goods = Object.fromEntries(ALL_GOODS.map(id => {
    const available = previous.goods[id].stock + production[id];
    const consumption = Math.min(available, demand[id]);
    const shortage = Math.max(0, demand[id] - consumption);
    const storageCapacity = Math.max(10, normalizePopulation(province.population).total / 1000 * 20 + province.development * 10);
    const stock = Math.min(storageCapacity, Math.max(0, available - consumption));
    return [id, {
      stock: round(stock), production: production[id], demand: demand[id], consumption: round(consumption),
      price: calculateLocalPrice(id, available, demand[id]), shortage: round(shortage),
      imported: 0, exported: 0,
    }];
  })) as Record<GoodId, GoodMarketState>;
  const market = { goods, purchasingPower: 50 };
  market.purchasingPower = calculatePurchasingPower(province, goods);
  return market;
}
