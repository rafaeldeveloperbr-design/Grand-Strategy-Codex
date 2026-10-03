import type { Army, GoodMarketState, Province, ProvincePopulation } from '../types';
import { BUILDING_DEFINITIONS } from '../data/buildings';

export const POPULATION_BALANCE = {
  DEFAULT_GROWTH_RATE: 0.002,
  DEFAULT_SATISFACTION: 60,
  WORKFORCE_SHARE: 0.6,
  BASE_JOB_SHARE: 0.2,
  DEVELOPMENT_JOB_SHARE: 0.04,
  CAPACITY_PRESSURE_START: 0.8,
  CAPACITY_RATE_PENALTY: 0.01,
  MODERATE_SHORTAGE: 0.15,
  SEVERE_SHORTAGE: 0.5,
  SEVERE_SHORTAGE_GRACE_DAYS: 3,
  MAX_FOOD_RATE_PENALTY: 0.004,
  MIGRATION_ATTRACTIVENESS_THRESHOLD: 15,
  MIGRATION_DAILY_SHARE: 0.0002,
  MIGRATION_DAILY_LIMIT: 20,
} as const;

export const POPULATION_DEFAULTS = {
  GROWTH_RATE: POPULATION_BALANCE.DEFAULT_GROWTH_RATE,
  SATISFACTION: POPULATION_BALANCE.DEFAULT_SATISFACTION,
  WORKFORCE_SHARE: POPULATION_BALANCE.WORKFORCE_SHARE,
} as const;

export type FoodShortageSeverity = 'healthy' | 'moderate' | 'severe';
export interface FoodShortageStatus {
  ratio: number;
  percent: number;
  severity: FoodShortageSeverity;
  consecutiveDays: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Shared interpretation of the market shortage used by population, AI, and UI. */
export function getFoodShortageStatus(food: GoodMarketState | undefined, consecutiveDays = 0): FoodShortageStatus {
  const ratio = food && food.demand > 0 ? clamp(food.shortage / food.demand, 0, 1) : 0;
  return {
    ratio,
    percent: Math.round(ratio * 100),
    severity: ratio >= POPULATION_BALANCE.SEVERE_SHORTAGE ? 'severe'
      : ratio >= POPULATION_BALANCE.MODERATE_SHORTAGE ? 'moderate' : 'healthy',
    consecutiveDays: Math.max(0, Math.floor(consecutiveDays)),
  };
}

/** Normalizes both current and legacy numeric population values at load boundaries. */
export function normalizePopulation(value: ProvincePopulation | number): ProvincePopulation {
  const total = Math.max(0, Math.floor(typeof value === 'number' ? value : value.total || 0));
  const raw = typeof value === 'number' ? undefined : value;
  const employed = clamp(Math.floor(raw?.employed ?? total * 0.5), 0, total);
  const unemployed = clamp(Math.floor(raw?.unemployed ?? total * 0.1), 0, total - employed);
  return {
    total,
    growthRate: Math.max(-0.99, raw?.growthRate ?? POPULATION_DEFAULTS.GROWTH_RATE),
    employed,
    unemployed,
    satisfaction: clamp(raw?.satisfaction ?? POPULATION_DEFAULTS.SATISFACTION, 0, 100),
    foodShortageDays: Math.max(0, Math.floor(raw?.foodShortageDays ?? 0)),
    migrationNet: Math.trunc(raw?.migrationNet ?? 0),
  };
}

const JOB_SHARE_BY_BUILDING = {
  market: 0.035, workshop: 0.035, infrastructure: 0.035,
  farm: 0.025, lumber_mill: 0.025, iron_mine: 0.025,
  housing: 0.01, warehouse: 0.01, barracks: 0.01, fortress: 0.01,
} as const;

export function calculateWorkforce(population: ProvincePopulation | number): number {
  return Math.floor(normalizePopulation(population).total * POPULATION_BALANCE.WORKFORCE_SHARE);
}

export function calculateEmploymentCapacity(province: Province): number {
  const population = normalizePopulation(province.population);
  let capacityRatio = POPULATION_BALANCE.BASE_JOB_SHARE
    + clamp(province.development, 0, 10) * POPULATION_BALANCE.DEVELOPMENT_JOB_SHARE;
  for (const building of province.buildings) {
    if (building.daysRemaining > 0) continue;
    capacityRatio += JOB_SHARE_BY_BUILDING[building.type] * building.level;
  }
  return Math.floor(population.total * clamp(capacityRatio, 0, POPULATION_BALANCE.WORKFORCE_SHARE));
}

export function recalculateEmployment(province: Province, population = normalizePopulation(province.population)): ProvincePopulation {
  const workforce = calculateWorkforce(population);
  const employed = Math.min(workforce, calculateEmploymentCapacity({ ...province, population }));
  return { ...population, employed, unemployed: workforce - employed };
}

export interface SatisfactionBreakdown {
  base: number;
  unemployment: number;
  food: number;
  taxation: number;
  economy: number;
  stability: number;
  war: number;
  final: number;
}

export interface SatisfactionOptions {
  atWar?: boolean;
  economicMultiplier?: number;
  countryStability?: number;
}

export function calculateSatisfactionBreakdown(
  province: Province,
  taxationId: string,
  options: SatisfactionOptions = {}
): SatisfactionBreakdown {
  const population = recalculateEmployment(province);
  const workforce = population.employed + population.unemployed;
  const unemploymentRate = workforce > 0 ? population.unemployed / workforce : 0;
  const market = province.market;
  const food = market?.goods.food;
  const foodShortageRatio = getFoodShortageStatus(food).ratio;
  const parts = {
    base: 65,
    unemployment: -unemploymentRate * 45,
    food: -foodShortageRatio * 25 + ((food?.price ?? 1) - 1) * -5,
    taxation: taxationId === 'taxation_high' ? -12 : taxationId === 'taxation_low' ? 8 : 0,
    economy: (clamp(options.economicMultiplier ?? 1, 0, 1.5) - 1) * 15,
    stability: (clamp(options.countryStability ?? 50, 0, 100) - 50) * 0.12,
    war: options.atWar ? -5 : 0,
  };
  return { ...parts, final: clamp(Object.values(parts).reduce((sum, value) => sum + value, 0), 0, 100) };
}

export function calculateSatisfaction(province: Province, taxationId: string, options: SatisfactionOptions = {}): number {
  return calculateSatisfactionBreakdown(province, taxationId, options).final;
}

export function getPopulationCapacity(province: Province, multiplier = 1): number {
  const housing = province.buildings.find(building => building.type === 'housing' && building.daysRemaining <= 0)?.level ?? 0;
  return Math.max(0, (province.maxPopulation + housing * 5000) * multiplier);
}

export interface PopulationGrowthOptions {
  growthMultiplier?: number;
  capacityMultiplier?: number;
  atWar?: boolean;
}

export interface PopulationGrowthBreakdown {
  baseRate: number;
  foodRate: number;
  capacityRate: number;
  satisfactionRate: number;
  stabilityRate: number;
  warRate: number;
  technologyAndLawMultiplier: number;
  finalRate: number;
  capacity: number;
  finalGrowth: number;
}

/** Canonical growth calculation shared by simulation and UI. */
export function calculatePopulationGrowthBreakdown(
  province: Province,
  countryStability: number,
  options: PopulationGrowthOptions = {}
): PopulationGrowthBreakdown {
  const population = normalizePopulation(province.population);
  const capacity = getPopulationCapacity(province, options.capacityMultiplier);
  const capacityRatio = capacity > 0 ? population.total / capacity : 1;
  const market = province.market;
  const food = market?.goods.food;
  const shortageRatio = getFoodShortageStatus(food, population.foodShortageDays).ratio;
  let foodRate = 0;
  if (shortageRatio >= POPULATION_BALANCE.MODERATE_SHORTAGE) {
    foodRate = -0.0015 * Math.min(1, shortageRatio / POPULATION_BALANCE.SEVERE_SHORTAGE);
  }
  if (shortageRatio >= POPULATION_BALANCE.SEVERE_SHORTAGE
      && (population.foodShortageDays ?? 0) >= POPULATION_BALANCE.SEVERE_SHORTAGE_GRACE_DAYS) {
    const severeProgress = (shortageRatio - POPULATION_BALANCE.SEVERE_SHORTAGE) / (1 - POPULATION_BALANCE.SEVERE_SHORTAGE);
    foodRate -= 0.0015 + severeProgress * 0.001;
  }
  foodRate = Math.max(-POPULATION_BALANCE.MAX_FOOD_RATE_PENALTY, foodRate);
  const capacityRate = capacityRatio > POPULATION_BALANCE.CAPACITY_PRESSURE_START
    ? -POPULATION_BALANCE.CAPACITY_RATE_PENALTY * (capacityRatio - POPULATION_BALANCE.CAPACITY_PRESSURE_START) * 5
    : 0;
  const satisfactionRate = (population.satisfaction - 60) * 0.000015;
  const stabilityRate = countryStability > 50 ? 0.001 * ((countryStability - 50) / 50) : 0;
  const warRate = options.atWar ? -0.00025 : 0;
  let buildingRate = 0;
  for (const building of province.buildings) {
    if (building.daysRemaining > 0) continue;
    const bonus = BUILDING_DEFINITIONS[building.type].bonusPerLevel.growthBonus;
    if (bonus) buildingRate += bonus / 100 * building.level;
  }
  const baseRate = population.growthRate + buildingRate;
  const multiplier = Math.max(0, options.growthMultiplier ?? 1);
  const finalRate = (baseRate + foodRate + capacityRate + satisfactionRate + stabilityRate + warRate) * multiplier;
  const requestedGrowth = population.total * finalRate;
  const nextTotal = clamp(population.total + requestedGrowth, 0, capacity);
  return { baseRate, foodRate, capacityRate, satisfactionRate, stabilityRate, warRate,
    technologyAndLawMultiplier: multiplier, finalRate, capacity, finalGrowth: nextTotal - population.total };
}

export function calculateProvincePopulationGrowth(province: Province, countryStability: number, options: PopulationGrowthOptions = {}): number {
  return calculatePopulationGrowthBreakdown(province, countryStability, options).finalGrowth;
}

export function processProvincePopulation(
  province: Province,
  growthMultiplier: number,
  taxationId: string,
  options: SatisfactionOptions & { growthAmount?: number; capacityMultiplier?: number; countryStability?: number } = {}
): Province {
  const current = normalizePopulation(province.population);
  const requestedGrowth = options.growthAmount ?? calculateProvincePopulationGrowth(province, options.countryStability ?? 50, {
    growthMultiplier, capacityMultiplier: options.capacityMultiplier, atWar: options.atWar,
  });
  const total = clamp(Math.floor(current.total + requestedGrowth), 0, getPopulationCapacity(province, options.capacityMultiplier));
  const food = province.market?.goods.food;
  const shortageRatio = getFoodShortageStatus(food, current.foodShortageDays).ratio;
  const foodShortageDays = shortageRatio >= POPULATION_BALANCE.MODERATE_SHORTAGE ? (current.foodShortageDays ?? 0) + 1 : 0;
  let population = recalculateEmployment({ ...province, population: { ...current, total } }, { ...current, total, foodShortageDays, migrationNet: 0 });
  population = { ...population, satisfaction: calculateSatisfaction({ ...province, population }, taxationId, options) };
  return { ...province, population };
}

export function getWorkerAvailability(province: Province): number {
  const population = recalculateEmployment(province);
  const workforce = calculateWorkforce(population);
  return workforce === 0 ? 0 : clamp(population.employed / workforce, 0, 1);
}

export function calculateMigrationAttractiveness(province: Province, capacityMultiplier = 1, atWar = false): number {
  const population = recalculateEmployment(province);
  const workforce = population.employed + population.unemployed;
  const employmentRate = workforce ? population.employed / workforce : 1;
  const capacity = getPopulationCapacity(province, capacityMultiplier);
  const freeCapacity = capacity ? clamp(1 - population.total / capacity, 0, 1) : 0;
  const food = province.market?.goods.food;
  const shortage = getFoodShortageStatus(food, population.foodShortageDays).ratio;
  return employmentRate * 35 + population.satisfaction * 0.35 + freeCapacity * 20 - shortage * 30 - (atWar ? 10 : 0);
}

/** Deterministic, internal-only migration. Each country should call this with its own provinces. */
export function processInternalMigration(provinces: Province[], capacityMultiplier = 1, atWar = false): Province[] {
  if (provinces.length < 2) return provinces.map(p => ({ ...p, population: { ...normalizePopulation(p.population), migrationNet: 0 } }));
  const ranked = [...provinces].sort((a, b) => calculateMigrationAttractiveness(a, capacityMultiplier, atWar)
    - calculateMigrationAttractiveness(b, capacityMultiplier, atWar) || a.id.localeCompare(b.id));
  const origin = ranked[0];
  const destination = ranked[ranked.length - 1];
  const difference = calculateMigrationAttractiveness(destination, capacityMultiplier, atWar)
    - calculateMigrationAttractiveness(origin, capacityMultiplier, atWar);
  const originPopulation = normalizePopulation(origin.population);
  const destinationPopulation = normalizePopulation(destination.population);
  const room = Math.max(0, Math.floor(getPopulationCapacity(destination, capacityMultiplier) - destinationPopulation.total));
  const amount = difference >= POPULATION_BALANCE.MIGRATION_ATTRACTIVENESS_THRESHOLD
    ? Math.min(room, Math.floor(originPopulation.total * POPULATION_BALANCE.MIGRATION_DAILY_SHARE), POPULATION_BALANCE.MIGRATION_DAILY_LIMIT)
    : 0;
  return provinces.map(province => {
    const current = normalizePopulation(province.population);
    const delta = province.id === origin.id ? -amount : province.id === destination.id ? amount : 0;
    return { ...province, population: recalculateEmployment(province, { ...current, total: Math.max(0, current.total + delta), migrationNet: delta }) };
  });
}

/** Applies only newly observed regiment strength losses with a known origin. */
export function applyMilitaryCasualties(provinces: Province[], before: Army[], after: Army[]): Province[] {
  const losses = new Map<string, number>();
  for (const oldArmy of before) {
    const newArmy = after.find(army => army.id === oldArmy.id);
    const remainingByOrigin = new Map<string, number>();
    for (const regiment of newArmy?.regiments ?? []) if (regiment.originProvinceId) {
      remainingByOrigin.set(regiment.originProvinceId, (remainingByOrigin.get(regiment.originProvinceId) ?? 0) + regiment.strength);
    }
    for (const regiment of oldArmy.regiments) {
      if (!regiment.originProvinceId) continue;
      const remaining = remainingByOrigin.get(regiment.originProvinceId) ?? 0;
      const survived = Math.min(regiment.strength, remaining);
      remainingByOrigin.set(regiment.originProvinceId, Math.max(0, remaining - survived));
      losses.set(regiment.originProvinceId, (losses.get(regiment.originProvinceId) ?? 0) + regiment.strength - survived);
    }
  }
  return provinces.map(province => {
    const loss = losses.get(province.id) ?? 0;
    if (!loss) return province;
    const population = normalizePopulation(province.population);
    return { ...province, population: recalculateEmployment(province, { ...population, total: Math.max(0, population.total - loss) }) };
  });
}
