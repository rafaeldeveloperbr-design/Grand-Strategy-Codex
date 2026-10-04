import type { GoodId, GoodMarketState, Province, ProvinceMarket } from '../types';
import { normalizePopulation, recalculateEmployment } from './population';
import { getBuildingLevel } from '../data/buildings';

export const GOOD_IDS = { FOOD: 'food', WOOD: 'wood', IRON: 'iron', TOOLS: 'tools' } as const satisfies Record<string, GoodId>;
export const GOODS: Record<GoodId, { id: GoodId; name: string; basePrice: number }> = {
  food: { id: 'food', name: 'Alimentos', basePrice: 1 }, wood: { id: 'wood', name: 'Madeira', basePrice: 2 },
  iron: { id: 'iron', name: 'Ferro', basePrice: 4 }, tools: { id: 'tools', name: 'Ferramentas', basePrice: 8 },
};
export const ALL_GOODS = Object.values(GOOD_IDS);
const INITIAL_STOCK: Partial<Record<GoodId, number>> = {
  wood: 30,
  iron: 20,
  tools: 15,
};
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 100) / 100;
const emptyGood = (id: GoodId): GoodMarketState => ({ stock: 0, production: 0, demand: 0, consumption: 0, price: GOODS[id].basePrice, shortage: 0, imported: 0, exported: 0 });
export function createDefaultMarket(): ProvinceMarket {
  return {
    goods: Object.fromEntries(
      ALL_GOODS.map(id => [
        id,
        {
          ...emptyGood(id),
          stock: INITIAL_STOCK[id] ?? 0,
        },
      ])
    ) as Record<GoodId, GoodMarketState>,
    purchasingPower: 50,
  };
}


export function normalizeMarket(market?: Partial<ProvinceMarket>): ProvinceMarket {
  const defaults = createDefaultMarket();
  return {
    goods: Object.fromEntries(ALL_GOODS.map(id => { const g = market?.goods?.[id]; return [id, { stock: Math.max(0, g?.stock ?? defaults.goods[id].stock), production: Math.max(0, g?.production ?? 0), demand: Math.max(0, g?.demand ?? 0), consumption: Math.max(0, g?.consumption ?? 0), price: clamp(g?.price ?? GOODS[id].basePrice, GOODS[id].basePrice * .5, GOODS[id].basePrice * 3), shortage: Math.max(0, g?.shortage ?? 0), imported: Math.max(0, g?.imported ?? 0), exported: Math.max(0, g?.exported ?? 0) }]; })) as Record<GoodId, GoodMarketState>, purchasingPower: clamp(market?.purchasingPower ?? defaults.purchasingPower, 0, 100)
  };
}

export const WORKERS_PER_PRODUCTIVE_LEVEL = 1000;
/**
 * Subsistence keeps small settlements viable but deliberately scales below
 * population demand. Farms, trade, and technology must support large cities.
 */
export const FOOD_PRODUCTION_BALANCE = {
  SUBSISTENCE_REFERENCE_POPULATION: 10_000,
  SUBSISTENCE_AT_REFERENCE: 7.5,
  SUBSISTENCE_POPULATION_EXPONENT: 0.65,
  FARM_OUTPUT_PER_1000_WORKERS: 3,
} as const;

export function calculateSubsistenceFoodProduction(populationTotal: number): number {
  if (!Number.isFinite(populationTotal) || populationTotal <= 0) return 0;
  const populationScale = populationTotal / FOOD_PRODUCTION_BALANCE.SUBSISTENCE_REFERENCE_POPULATION;
  return round(FOOD_PRODUCTION_BALANCE.SUBSISTENCE_AT_REFERENCE
    * Math.pow(populationScale, FOOD_PRODUCTION_BALANCE.SUBSISTENCE_POPULATION_EXPONENT));
}

type ProductiveWorkerAllocation = Record<'farm' | 'lumber_mill' | 'iron_mine' | 'workshop', number>;
export function allocateProductiveWorkers(province: Province): ProductiveWorkerAllocation {
  const levels = { farm: getBuildingLevel(province, 'farm'), lumber_mill: getBuildingLevel(province, 'lumber_mill'), iron_mine: getBuildingLevel(province, 'iron_mine'), workshop: getBuildingLevel(province, 'workshop') };
  const required = Object.values(levels).reduce((sum, level) => sum + level * WORKERS_PER_PRODUCTIVE_LEVEL, 0);
  const available = recalculateEmployment(province).employed;
  const ratio = required ? Math.min(1, available / required) : 0;
  return Object.fromEntries(Object.entries(levels).map(([key, level]) => [key, level * WORKERS_PER_PRODUCTIVE_LEVEL * ratio])) as ProductiveWorkerAllocation;
}
export function calculateProduction(province: Province, multipliers: Partial<Record<GoodId, number>> = {}): Record<GoodId, number> {
  const population = normalizePopulation(province.population);
  const workers = allocateProductiveWorkers(province);
  const development = .5 + clamp(province.development, 0, 10) * .1;
  const satisfactionEfficiency = clamp(0.9 + population.satisfaction / 100 * 0.15, 0.9, 1.05);
  const efficiency = (1 + getBuildingLevel(province, 'market') * .05 + getBuildingLevel(province, 'infrastructure') * .04) * satisfactionEfficiency;
  const subsistenceFood = calculateSubsistenceFoodProduction(population.total);
  const farmFood = workers.farm / WORKERS_PER_PRODUCTIVE_LEVEL
    * FOOD_PRODUCTION_BALANCE.FARM_OUTPUT_PER_1000_WORKERS
    * development
    * efficiency;
  return {
    food: round((subsistenceFood + farmFood) * (multipliers.food ?? 1)),
    wood: round(workers.lumber_mill / 1000 * 2 * development * efficiency * (multipliers.wood ?? 1)),
    iron: round(workers.iron_mine / 1000 * 1.25 * development * efficiency * (multipliers.iron ?? 1)),
    tools: round(workers.workshop / 1000 * 1 * development * efficiency * (multipliers.tools ?? 1)),
  };
}
export function calculateDemand(province: Province): Record<GoodId, number> {
  const scale = normalizePopulation(province.population).total / 1000;
  const levels = province.buildings.filter(b => b.daysRemaining <= 0).reduce((sum, b) => sum + b.level, 0);
  return { food: round(scale + (province.stationedTroops ?? 0) / 1000 * .35), wood: round(scale * .06 + levels * .15), iron: round(scale * .025 + levels * .1), tools: round(scale * .02 + levels * .12) };
}
export function getStorageCapacity(province: Province): number {
  const base = Math.max(10, normalizePopulation(province.population).total / 1000 * 20 + province.development * 10);
  return round(base * (1 + getBuildingLevel(province, 'warehouse') * .5));
}
export function calculateLocalPrice(id: GoodId, supply: number, demand: number): number { const base = GOODS[id].basePrice; if (demand <= 0) return base * .5; return round(base * clamp(Math.sqrt(demand / Math.max(.01, supply)), .5, 3)); }
export function calculatePurchasingPower(province: Province, goods: Record<GoodId, GoodMarketState>): number { const p = recalculateEmployment(province); const workforce = p.employed + p.unemployed; const employment = workforce ? p.employed / workforce : 0; const food = goods.food; return round(clamp(45 + employment * 35 + province.development * 1.5 - (food.price - 1) * 18 - (food.demand ? food.shortage / food.demand : 0) * 35, 0, 100)); }
export function calculateMarketSatisfactionAdjustment(market: ProvinceMarket): number { const food = market.goods.food; return clamp((1 - food.price) * 8 + (market.purchasingPower - 50) * .16 - (food.demand ? food.shortage / food.demand : 0) * 18, -30, 8); }
export function processProvinceMarket(province: Province, multipliers: Partial<Record<GoodId, number>> = {}, purchasingPowerMultiplier = 1): ProvinceMarket {
  const previous = normalizeMarket(province.market); const production = calculateProduction(province, multipliers); const demand = calculateDemand(province);
  // Workshops use conserved provincial stocks; output scales proportionally with either missing input.
  const plannedTools = production.tools;
  const toolRatio = plannedTools ? Math.min(1, previous.goods.wood.stock / plannedTools, previous.goods.iron.stock / (plannedTools * .75)) : 0;
  production.tools = round(plannedTools * toolRatio);
  const inputUse = { wood: production.tools, iron: production.tools * .75 };
  const capacity = getStorageCapacity(province);
  const goods = Object.fromEntries(ALL_GOODS.map(id => {
    const input = id === 'wood' ? inputUse.wood : id === 'iron' ? inputUse.iron : 0;
    const available = Math.max(0, previous.goods[id].stock - input) + production[id];
    const consumption =
      id === 'food'
        ? Math.min(available, demand[id])
        : 0; const shortage = Math.max(0, demand[id] - consumption);
    return [id, { stock: round(Math.min(capacity, Math.max(0, available - consumption))), production: production[id], demand: demand[id], consumption: round(consumption), price: calculateLocalPrice(id, available, demand[id]), shortage: round(shortage), imported: 0, exported: 0 }];
  })) as Record<GoodId, GoodMarketState>;
  const market = { goods, purchasingPower: 50 };
market.purchasingPower = Math.max(0, Math.min(100, calculatePurchasingPower(province, goods) * purchasingPowerMultiplier));

if (province.name === 'Mons Ferrum') {
  console.log(`[MARKET] ${province.name}`, {
    population: normalizePopulation(province.population).total,
    purchasingPower: market.purchasingPower,

    food: {
      stock: goods.food.stock,
      production: goods.food.production,
      demand: goods.food.demand,
      consumption: goods.food.consumption,
      shortage: goods.food.shortage,
      price: goods.food.price,
    },

    wood: {
      stock: goods.wood.stock,
      production: goods.wood.production,
      demand: goods.wood.demand,
      consumption: goods.wood.consumption,
      shortage: goods.wood.shortage,
      price: goods.wood.price,
    },

    iron: {
      stock: goods.iron.stock,
      production: goods.iron.production,
      demand: goods.iron.demand,
      consumption: goods.iron.consumption,
      shortage: goods.iron.shortage,
      price: goods.iron.price,
    },

    tools: {
      stock: goods.tools.stock,
      production: goods.tools.production,
      demand: goods.tools.demand,
      consumption: goods.tools.consumption,
      shortage: goods.tools.shortage,
      price: goods.tools.price,
    },
  });
}

return market;
}
