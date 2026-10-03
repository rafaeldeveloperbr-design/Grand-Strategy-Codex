import type { BuildingDefinition, BuildingType, GoodId, Province } from '../types';

export const MAX_BUILDING_LEVEL = 5;

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  farm: { type: 'farm', name: 'Fazenda', description: 'Produz FOOD e sustenta o crescimento.', icon: '🌾', baseCost: 220, costPerLevel: 90, baseBuildTime: 24, maxLevel: 5, resourceCost: { wood: 8 }, workersPerLevel: 700, effectPerLevel: '+6 FOOD/dia' },
  lumber_mill: { type: 'lumber_mill', name: 'Serraria', description: 'Produz WOOD para obras e indústria.', icon: '🪵', baseCost: 280, costPerLevel: 110, baseBuildTime: 30, maxLevel: 5, resourceCost: { wood: 5, tools: 2 }, workersPerLevel: 600, effectPerLevel: '+4 WOOD/dia' },
  iron_mine: { type: 'iron_mine', name: 'Mina de Ferro', description: 'Produz IRON para indústria e exércitos.', icon: '⛏️', baseCost: 360, costPerLevel: 140, baseBuildTime: 38, maxLevel: 5, resourceCost: { wood: 8, tools: 3 }, workersPerLevel: 800, effectPerLevel: '+3 IRON/dia' },
  workshop: { type: 'workshop', name: 'Oficina', description: 'Transforma WOOD + IRON em TOOLS.', icon: '🔨', baseCost: 440, costPerLevel: 170, baseBuildTime: 42, maxLevel: 5, resourceCost: { wood: 10, iron: 6, tools: 4 }, workersPerLevel: 900, effectPerLevel: '+2 TOOLS/dia; consome insumos' },
  market: { type: 'market', name: 'Mercado', description: 'Melhora eficiência e armazenamento local.', icon: '🏪', baseCost: 320, costPerLevel: 120, baseBuildTime: 30, maxLevel: 5, resourceCost: { wood: 8, tools: 2 }, workersPerLevel: 150, effectPerLevel: '+3% produtividade e +5% armazenamento' },
  warehouse: { type: 'warehouse', name: 'Armazém', description: 'Amplia o limite de estoque provincial.', icon: '📦', baseCost: 300, costPerLevel: 100, baseBuildTime: 28, maxLevel: 5, resourceCost: { wood: 12, tools: 2 }, workersPerLevel: 100, effectPerLevel: '+50% armazenamento' },
  housing: { type: 'housing', name: 'Habitação', description: 'Amplia a capacidade populacional.', icon: '🏘️', baseCost: 350, costPerLevel: 130, baseBuildTime: 35, maxLevel: 5, resourceCost: { wood: 12, tools: 3 }, workersPerLevel: 200, effectPerLevel: '+5.000 população máxima' },
  barracks: { type: 'barracks', name: 'Quartel', description: 'Acelera recrutamento e organiza reservas.', icon: '⚔️', baseCost: 450, costPerLevel: 160, baseBuildTime: 40, maxLevel: 5, resourceCost: { wood: 8, iron: 6, tools: 4 }, workersPerLevel: 250, effectPerLevel: '-10% tempo de recrutamento' },
  fortress: { type: 'fortress', name: 'Fortaleza', description: 'Aumenta a defesa provincial.', icon: '🏰', baseCost: 600, costPerLevel: 220, baseBuildTime: 50, maxLevel: 5, resourceCost: { wood: 10, iron: 12, tools: 5 }, workersPerLevel: 200, effectPerLevel: '+2 defesa' },
  infrastructure: { type: 'infrastructure', name: 'Infraestrutura', description: 'Estradas e serviços elevam produtividade.', icon: '🛣️', baseCost: 500, costPerLevel: 180, baseBuildTime: 45, maxLevel: 5, resourceCost: { wood: 10, iron: 6, tools: 5 }, workersPerLevel: 400, effectPerLevel: '+5% produtividade' },
};

export function getBuildingCost(type: BuildingType, currentLevel: number): number {
  const def = BUILDING_DEFINITIONS[type];
  return def.baseCost + def.costPerLevel * currentLevel;
}

export function getBuildingResourceCost(type: BuildingType, currentLevel: number): Partial<Record<GoodId, number>> {
  const multiplier = 1 + currentLevel * 0.5;
  return Object.fromEntries(Object.entries(BUILDING_DEFINITIONS[type].resourceCost)
    .map(([id, amount]) => [id, Math.ceil((amount ?? 0) * multiplier)])) as Partial<Record<GoodId, number>>;
}

export function getBuildingTime(type: BuildingType, currentLevel: number): number {
  return Math.ceil(BUILDING_DEFINITIONS[type].baseBuildTime * (1 + currentLevel * 0.25));
}

export function canBuildBuilding(type: BuildingType, currentLevel: number): boolean {
  return currentLevel < BUILDING_DEFINITIONS[type].maxLevel;
}

export function getBuildingLevel(province: Province, type: BuildingType): number {
  return province.buildings.find(building => building.type === type)?.level ?? 0;
}

export function getPopulationCapacity(province: Province): number {
  const base = province.baseMaxPopulation ?? province.maxPopulation;
  return base + getBuildingLevel(province, 'housing') * 5000;
}

export function getProvinceDefense(province: Province): number {
  return province.defense + getBuildingLevel(province, 'fortress') * 2;
}
