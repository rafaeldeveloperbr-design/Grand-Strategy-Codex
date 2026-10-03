import type { Army, Province, ProvincePopulation } from '../types';

export const POPULATION_DEFAULTS = {
  GROWTH_RATE: 0.002,
  SATISFACTION: 60,
  WORKFORCE_SHARE: 0.6,
} as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
  };
}

export function calculateEmploymentCapacity(province: Province): number {
  const population = normalizePopulation(province.population);
  let capacityRatio = 0.2 + clamp(province.development, 0, 10) * 0.04;
  for (const building of province.buildings) {
    if (building.daysRemaining > 0) continue;
    const jobsPerLevel = building.type === 'market' || building.type === 'workshop' || building.type === 'infrastructure'
      ? 0.035 : building.type === 'farm' || building.type === 'lumber_mill' || building.type === 'iron_mine' ? 0.025 : 0.01;
    capacityRatio += jobsPerLevel * building.level;
  }
  return Math.floor(population.total * clamp(capacityRatio, 0, POPULATION_DEFAULTS.WORKFORCE_SHARE));
}

export function recalculateEmployment(province: Province, population = normalizePopulation(province.population)): ProvincePopulation {
  const workforce = Math.floor(population.total * POPULATION_DEFAULTS.WORKFORCE_SHARE);
  const employed = Math.min(workforce, calculateEmploymentCapacity({ ...province, population }));
  return { ...population, employed, unemployed: Math.max(0, workforce - employed) };
}

export function calculateSatisfaction(
  province: Province,
  taxationId: string,
  options: { atWar?: boolean; economicMultiplier?: number; marketAdjustment?: number } = {}
): number {
  const population = recalculateEmployment(province);
  const workforce = population.employed + population.unemployed;
  const unemploymentRate = workforce > 0 ? population.unemployed / workforce : 0;
  const taxEffect = taxationId === 'taxation_high' ? -12 : taxationId === 'taxation_low' ? 8 : 0;
  const economyEffect = (clamp(options.economicMultiplier ?? 1, 0, 1.5) - 1) * 20;
  const warEffect = options.atWar ? -5 : 0;
  return clamp(65 - unemploymentRate * 55 + taxEffect + economyEffect + warEffect + (options.marketAdjustment ?? 0), 0, 100);
}

export function getPopulationCapacity(province: Province): number {
  const housing = province.buildings.find(building => building.type === 'housing' && building.daysRemaining <= 0)?.level ?? 0;
  return Math.max(0, province.maxPopulation + housing * 5000);
}

export function processProvincePopulation(
  province: Province,
  growthMultiplier: number,
  taxationId: string,
  options: { atWar?: boolean; economicMultiplier?: number; growthAmount?: number } = {}
): Province {
  const current = normalizePopulation(province.population);
  const requestedGrowth = options.growthAmount ?? current.total * current.growthRate * Math.max(0, growthMultiplier);
  const total = clamp(Math.floor(current.total + requestedGrowth), 0, getPopulationCapacity(province));
  let population = recalculateEmployment({ ...province, population: { ...current, total } }, { ...current, total });
  population = { ...population, satisfaction: calculateSatisfaction({ ...province, population }, taxationId, options) };
  return { ...province, population };
}

export function getWorkerAvailability(province: Province): number {
  const population = recalculateEmployment(province);
  const workforce = Math.floor(population.total * POPULATION_DEFAULTS.WORKFORCE_SHARE);
  return workforce === 0 ? 0 : clamp(population.employed / workforce, 0, 1);
}

/** Applies only newly observed regiment strength losses with a known origin. */
export function applyMilitaryCasualties(provinces: Province[], before: Army[], after: Army[]): Province[] {
  const losses = new Map<string, number>();
  for (const oldArmy of before) {
    const newArmy = after.find(army => army.id === oldArmy.id);
    const remainingByOrigin = new Map<string, number>();
    for (const regiment of newArmy?.regiments ?? []) {
      if (regiment.originProvinceId) remainingByOrigin.set(regiment.originProvinceId,
        (remainingByOrigin.get(regiment.originProvinceId) ?? 0) + regiment.strength);
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
