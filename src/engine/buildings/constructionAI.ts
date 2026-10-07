import type { BuildingConstruction, BuildingType, Country, Province, Recruitment } from '../../types';
import { BUILDING_DEFINITIONS, getBuildingCosts, getBuildingLevel } from '../../data/buildings';
import { canUpgradeBuilding } from '../buildings';
import { getStorageCapacity, normalizeMarket } from '../market';
import { calculateWorkforce, getFoodShortageStatus, getPopulationCapacity, normalizePopulation } from '../population';
import { getProvinceLogistics, type LogisticsSnapshot } from '../logistics';

export const CONSTRUCTION_AI_BALANCE = {
  minimumTreasuryReserve: 150, minimumScore: 10, shortageWeight: 100, severeFoodScore: 200,
  stockDays: 2, storageThreshold: .9, storageScore: 70, populationThreshold: .9, populationScore: 90,
  logisticsThreshold: .9, logisticsScore: 80, recruitmentScore: 60, arsenalScore: 65,
  threatenedBorderScore: 75, unemploymentThreshold: .2, employmentScore: 45,
  marketScore: 25, levelPenalty: .3, costPenalty: .05,
} as const;

/** Scores every owned province, with stable ties and no unconditional project. */
export function rankBuildingProjects(country: Country, provinces: Province[], constructions: BuildingConstruction[], recruitments: Recruitment[], atWar: boolean, populationCapacityMultiplier = 1, logistics?: LogisticsSnapshot) {
  const B = CONSTRUCTION_AI_BALANCE;
  const candidates: Array<{ province: Province; type: BuildingType; score: number }> = [];
  const goodsBuildings = { food: 'farm', wood: 'lumber_mill', iron: 'iron_mine', tools: 'workshop' } as const;
  for (const province of provinces.filter(p => p.owner === country.tag)) {
    const market = normalizeMarket(province.market), population = normalizePopulation(province.population);
    const workforce = calculateWorkforce(population), unemployment = workforce ? population.unemployed / workforce : 0;
    const scores: Partial<Record<BuildingType, number>> = {};
    for (const good of ['food', 'wood', 'iron', 'tools'] as const) {
      const g = market.goods[good];
      const shortage = g.demand > 0 ? Math.max(g.shortage / g.demand, 1 - g.stock / (g.demand * B.stockDays)) : 0;
      if (shortage > 0) scores[goodsBuildings[good]] = shortage * B.shortageWeight;
    }
    if (getFoodShortageStatus(market.goods.food, population.foodShortageDays, population.severeFoodShortageDays).severity === 'severe') scores.farm = B.severeFoodScore;
    if (Object.values(market.goods).some(g => g.stock >= getStorageCapacity(province) * B.storageThreshold)) scores.warehouse = B.storageScore;
    const cap = getPopulationCapacity(province, populationCapacityMultiplier);
    if (cap > 0 && population.total >= cap * B.populationThreshold) scores.housing = B.populationScore;
    const connection = getProvinceLogistics(logistics, country.tag, province.id);
    // Infrastructure improves a valid network; it cannot reconnect an enclave.
    if (connection?.connected && connection.efficiency < B.logisticsThreshold) scores.infrastructure = B.logisticsScore * (1 - connection.efficiency);
    const recruiting = recruitments.some(r => r.owner === country.tag && r.provinceId === province.id);
    if (recruiting) scores.barracks = B.recruitmentScore;
    if ((atWar || recruiting) && (recruiting || (province.stationedTroops ?? 0) > 0 || province.id === (country.capitalId ?? country.capital))) {
      scores.military_arsenal = B.arsenalScore;
      if (!getBuildingLevel(province, 'barracks') && !getBuildingLevel(province, 'infrastructure')) scores.barracks = B.recruitmentScore;
    }
    const foreignBorder = province.neighbors.some(id => {
      const neighbor = provinces.find(p => p.id === id);
      return neighbor && neighbor.owner !== country.tag;
    });
    if (atWar && foreignBorder) scores.fortress = B.threatenedBorderScore;
    if (unemployment > B.unemploymentThreshold && market.goods.wood.stock > market.goods.wood.demand * B.stockDays && market.goods.iron.stock > market.goods.iron.demand * B.stockDays) scores.workshop = Math.max(scores.workshop ?? 0, unemployment * B.employmentScore);
    if (market.purchasingPower < 50 && unemployment > B.unemploymentThreshold) scores.market = B.marketScore;
    for (const type of Object.keys(BUILDING_DEFINITIONS) as BuildingType[]) {
      const level = getBuildingLevel(province, type), cost = getBuildingCosts(type, level);
      const score = (scores[type] ?? 0) / (1 + level * B.levelPenalty) - cost.gold * B.costPenalty / Math.max(1, country.resources.gold);
      if (score < B.minimumScore || !canUpgradeBuilding(province, provinces, type, country.resources.gold - B.minimumTreasuryReserve, constructions)) continue;
      candidates.push({ province, type, score });
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.province.id.localeCompare(b.province.id) || a.type.localeCompare(b.type));
}
