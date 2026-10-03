import type { Army, GoodId, GoodMarketState, Province, ProvinceMarket } from '../types';
import { normalizePopulation, recalculateEmployment } from './population';
import { getBuildingLevel } from '../data/buildings';
import { calculateArmySize } from './combat/combatCalculations';
import type { TechnologyModifiers } from '../types/technology';

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

/** Bootstrap reserves prevent legacy maps without industry from deadlocking. */
export function createStartingMarket(): ProvinceMarket {
  const market = createDefaultMarket();
  market.goods.wood.stock = 20;
  market.goods.iron.stock = 12;
  market.goods.tools.stock = 8;
  return market;
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

export function calculateProduction(province: Province, technology?: TechnologyModifiers): Record<GoodId, number> {
  const population = recalculateEmployment(province);
  const workerNeeds: Record<GoodId, number> = {
    food: getBuildingLevel(province, 'farm') * 700,
    wood: getBuildingLevel(province, 'lumber_mill') * 600,
    iron: getBuildingLevel(province, 'iron_mine') * 800,
    tools: getBuildingLevel(province, 'workshop') * 900,
  };
  const requiredWorkers = Object.values(workerNeeds).reduce((sum, value) => sum + value, 0);
  const laborRatio = requiredWorkers > 0 ? Math.min(1, population.employed / requiredWorkers) : 0;
  const developmentFactor = 0.8 + clamp(province.development, 0, 10) * 0.04;
  const productivity = developmentFactor
    * (1 + getBuildingLevel(province, 'infrastructure') * (0.05 + (technology?.infrastructureProductivity ?? 0)))
    * (1 + getBuildingLevel(province, 'market') * 0.03);
  const output: Record<GoodId, number> = {
    [GOOD_IDS.FOOD]: normalizePopulation(province.population).total / 1000 * 0.25
      + getBuildingLevel(province, 'farm') * 6 * laborRatio * productivity,
    [GOOD_IDS.WOOD]: getBuildingLevel(province, 'lumber_mill') * 4 * laborRatio * productivity,
    [GOOD_IDS.IRON]: getBuildingLevel(province, 'iron_mine') * 3 * laborRatio * productivity,
    [GOOD_IDS.TOOLS]: getBuildingLevel(province, 'workshop') * 2 * laborRatio * productivity,
  };
  output.food *= 1 + (technology?.foodProduction ?? 0);
  output.wood *= 1 + (technology?.woodProduction ?? 0);
  output.iron *= 1 + (technology?.ironProduction ?? 0);
  output.tools *= 1 + (technology?.toolProduction ?? 0);
  return Object.fromEntries(ALL_GOODS.map(id => [id, round(Math.max(0, output[id]))])) as Record<GoodId, number>;
}

export function calculateDemand(province: Province, armies: Army[] = []): Record<GoodId, number> {
  const population = normalizePopulation(province.population);
  const scale = population.total / 1000;
  const buildingLevels = province.buildings.filter(b => b.daysRemaining <= 0).reduce((sum, b) => sum + b.level, 0);
  return {
    [GOOD_IDS.FOOD]: round(scale + armies.filter(army => army.location === province.id)
      .reduce((sum, army) => sum + calculateArmySize(army), 0) / 1000 * 0.35),
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

export function processProvinceMarket(province: Province, armies: Army[] = [], technology?: TechnologyModifiers): ProvinceMarket {
  const previous = normalizeMarket(province.market);
  const production = calculateProduction(province, technology);
  const demand = calculateDemand(province, armies);
  const workshopPotential = production[GOOD_IDS.TOOLS];
  const workshopOutput = Math.min(workshopPotential, previous.goods.wood.stock, previous.goods.iron.stock / 0.75);
  production[GOOD_IDS.TOOLS] = round(workshopOutput);
  previous.goods.wood.stock = round(previous.goods.wood.stock - workshopOutput);
  previous.goods.iron.stock = round(previous.goods.iron.stock - workshopOutput * 0.75);
  const goods = Object.fromEntries(ALL_GOODS.map(id => {
    const available = previous.goods[id].stock + production[id];
    const consumption = Math.min(available, demand[id]);
    const shortage = Math.max(0, demand[id] - consumption);
    const storageCapacity = Math.max(10, normalizePopulation(province.population).total / 1000 * 20 + province.development * 10)
      * (1 + getBuildingLevel(province, 'warehouse') * (0.5 + (technology?.warehouseCapacity ?? 0)) + getBuildingLevel(province, 'market') * 0.05);
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
