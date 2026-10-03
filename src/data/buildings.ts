import type { BuildingCost, BuildingDefinition, BuildingType, GoodId, Province } from '../types';

const definition = (
  type: BuildingType, name: string, description: string, icon: string,
  baseCost: number, baseBuildTime: number, resourceCost: Partial<Record<GoodId, number>>,
  bonusPerLevel: BuildingDefinition['bonusPerLevel'],
): BuildingDefinition => ({ type, name, description, icon, baseCost, costMultiplier: 1.5, baseBuildTime, maxLevel: 5, resourceCost, bonusPerLevel });

/** The single balance table for prices, inputs, duration, and per-level effects. */
export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  farm: definition('farm', 'Fazenda', 'Produz FOOD usando trabalhadores.', '🌾', 220, 30, { wood: 12, tools: 2 }, {}),
  lumber_mill: definition('lumber_mill', 'Serraria', 'Produz WOOD usando trabalhadores.', '🪵', 260, 32, { wood: 8, iron: 2, tools: 3 }, {}),
  iron_mine: definition('iron_mine', 'Mina de Ferro', 'Produz IRON usando trabalhadores.', '⛏️', 340, 40, { wood: 14, iron: 2, tools: 4 }, {}),
  workshop: definition('workshop', 'Oficina', 'Transforma WOOD + IRON em TOOLS.', '🔨', 400, 45, { wood: 18, iron: 10, tools: 5 }, {}),
  market: definition('market', 'Mercado', 'Melhora moderadamente a eficiência produtiva.', '🏪', 350, 45, { wood: 12, iron: 4, tools: 4 }, { productivityBonus: 5 }),
  warehouse: definition('warehouse', 'Armazém', 'Aumenta a capacidade de estoque em 50%.', '📦', 300, 35, { wood: 24, iron: 4, tools: 3 }, { storageBonus: 50 }),
  housing: definition('housing', 'Habitação', 'Aumenta a capacidade populacional em 5.000.', '🏘️', 280, 35, { wood: 20, iron: 3, tools: 2 }, { populationCapacity: 5000 }),
  barracks: definition('barracks', 'Quartel', 'Acelera o recrutamento existente.', '⚔️', 450, 40, { wood: 16, iron: 12, tools: 8 }, { recruitmentSpeedBonus: 15 }),
  fortress: definition('fortress', 'Fortaleza', 'Adiciona +2 à defesa provincial.', '🏰', 700, 60, { wood: 20, iron: 24, tools: 12 }, { defense: 2 }),
  infrastructure: definition('infrastructure', 'Infraestrutura', 'Melhora produtividade e integração econômica.', '🛣️', 520, 55, { wood: 20, iron: 14, tools: 10 }, { productivityBonus: 4 }),
};

export const BUILDING_COST_GROWTH = 1.5;
export const BUILDING_TIME_GROWTH = 1.25;

export function getBuildingCosts(type: BuildingType, currentLevel: number): BuildingCost {
  const def = BUILDING_DEFINITIONS[type];
  const factor = Math.pow(BUILDING_COST_GROWTH, currentLevel);
  return {
    gold: Math.floor(def.baseCost * factor),
    wood: Math.ceil((def.resourceCost.wood ?? 0) * factor),
    iron: Math.ceil((def.resourceCost.iron ?? 0) * factor),
    tools: Math.ceil((def.resourceCost.tools ?? 0) * factor),
  };
}

/** Kept as the gold-only accessor for callers that render legacy totals. */
export function getBuildingCost(type: BuildingType, currentLevel: number): number {
  return getBuildingCosts(type, currentLevel).gold;
}
export function getBuildingTime(type: BuildingType, currentLevel: number): number {
  return Math.ceil(BUILDING_DEFINITIONS[type].baseBuildTime * Math.pow(BUILDING_TIME_GROWTH, currentLevel));
}
export function canBuildBuilding(type: BuildingType, currentLevel: number): boolean {
  return currentLevel < BUILDING_DEFINITIONS[type].maxLevel;
}
export function getBuildingLevel(province: Province, type: BuildingType): number {
  return province.buildings.find(building => building.type === type && building.daysRemaining <= 0)?.level ?? 0;
}
export function getBuildingEffect(type: BuildingType, level: number): string {
  if (!level) return 'Nenhum';
  switch (type) {
    case 'farm': return `Produção FOOD nível ${level}`;
    case 'lumber_mill': return `Produção WOOD nível ${level}`;
    case 'iron_mine': return `Produção IRON nível ${level}`;
    case 'workshop': return `Conversão TOOLS nível ${level}`;
    case 'warehouse': return `+${level * 50}% capacidade de estoque`;
    case 'housing': return `+${level * 5000} capacidade populacional`;
    case 'barracks': return `+${level * 15}% velocidade de recrutamento`;
    case 'fortress': return `+${level * 2} defesa`;
    case 'market': return `+${level * 5}% eficiência produtiva`;
    case 'infrastructure': return `+${level * 4}% produtividade`;
  }
}
