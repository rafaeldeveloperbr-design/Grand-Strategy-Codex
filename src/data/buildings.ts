import type { BuildingBonus, BuildingCategory, BuildingCost, BuildingDefinition, BuildingType, GoodId, Province } from '../types';

export const BUILDING_COST_GROWTH = 1.5;
export const BUILDING_TIME_GROWTH = 1.25;
export const WORKSHOP_INPUTS = { wood: 1, iron: .75 } as const;
export const BUILDING_CATEGORIES: Record<BuildingCategory, string> = {
  production: 'Produção', trade: 'Comércio', population: 'População', military: 'Militar', defense: 'Defesa', infrastructure: 'Infraestrutura',
};
const definition = (type: BuildingType, name: string, category: BuildingCategory, description: string, icon: string,
  baseCost: number, baseBuildTime: number, resourceCost: Partial<Record<GoodId, number>>, bonusPerLevel: BuildingBonus,
): BuildingDefinition => ({ type, name, category, description, icon, baseCost, costMultiplier: BUILDING_COST_GROWTH, baseBuildTime, maxLevel: 5, resourceCost, bonusPerLevel });

/** Existing type/name/baseCost/resourceCost/baseBuildTime/bonusPerLevel fields
 * remain the canonical id/label/gold/inputs/time/effects API. */
export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  farm: definition('farm', 'Fazenda', 'production', 'Produz alimentos com trabalhadores disponíveis.', '🌾', 220, 30, { wood: 12, tools: 2 }, { output: 3, jobShare: .025, politicalInfluence: { landowners: 4 } }),
  lumber_mill: definition('lumber_mill', 'Serraria', 'production', 'Produz madeira com trabalhadores disponíveis.', '🪵', 260, 32, { wood: 8, iron: 2, tools: 3 }, { output: 2, jobShare: .025 }),
  iron_mine: definition('iron_mine', 'Mina de Ferro', 'production', 'Produz ferro com trabalhadores disponíveis.', '⛏️', 340, 40, { wood: 14, iron: 2, tools: 4 }, { output: 1.25, jobShare: .025 }),
  workshop: definition('workshop', 'Oficina', 'production', 'Cada ferramenta requer 1 madeira e 0,75 ferro.', '🔨', 400, 45, { wood: 18, iron: 10, tools: 5 }, { output: 1, jobShare: .035, politicalInfluence: { workers: 4 } }),
  market: definition('market', 'Mercado', 'trade', 'Melhora a produtividade; renda e oferta sustentam o poder de compra.', '🏪', 350, 45, { wood: 12, iron: 4, tools: 4 }, { productivityBonus: 5, jobShare: .035, politicalInfluence: { merchants: 5 } }),
  warehouse: definition('warehouse', 'Armazém', 'trade', 'Amplia os estoques provinciais e as reservas comerciais.', '📦', 300, 35, { wood: 24, iron: 4, tools: 3 }, { storageBonus: 50, jobShare: .01 }),
  housing: definition('housing', 'Habitação', 'population', 'Amplia a população máxima da província.', '🏘️', 280, 35, { wood: 20, iron: 3, tools: 2 }, { populationCapacity: 5000, jobShare: .01 }),
  barracks: definition('barracks', 'Quartel', 'military', 'Acelera o treinamento e amplia o abastecimento local.', '⚔️', 450, 40, { wood: 16, iron: 12, tools: 8 }, { recruitmentSpeedBonus: 15, supplyCapacity: 1, jobShare: .01, politicalInfluence: { military: 4 } }),
  military_arsenal: { ...definition('military_arsenal', 'Arsenal Militar', 'military', 'Reduz ferro e ferramentas no recrutamento e nas reposições. Requer Quartel ou Infraestrutura nível 1.', '🛠️', 600, 60, { wood: 24, iron: 20, tools: 12 }, { equipmentDiscount: 3, jobShare: .025, politicalInfluence: { military: 4, workers: 3 } }), prerequisites: [{ type: 'barracks', level: 1 }, { type: 'infrastructure', level: 1 }] },
  fortress: definition('fortress', 'Fortaleza', 'defense', 'Melhora a defesa provincial sem aumentar o ataque.', '🏰', 700, 60, { wood: 20, iron: 24, tools: 12 }, { defense: 2, jobShare: .01, politicalInfluence: { military: 2 } }),
  infrastructure: definition('infrastructure', 'Infraestrutura', 'infrastructure', 'Melhora produtividade, abastecimento local e eficiência logística.', '🛣️', 520, 55, { wood: 20, iron: 14, tools: 10 }, { productivityBonus: 4, logisticsBonus: 8, supplyCapacity: 2, jobShare: .035, politicalInfluence: { reformists: 2 } }),
};
export const normalizeBuildingLevel = (level: number): number => Number.isFinite(level) ? Math.max(0, Math.min(5, Math.floor(level))) : 0;
export function getBuildingCosts(type: BuildingType, currentLevel: number): BuildingCost {
  const def = BUILDING_DEFINITIONS[type], factor = def.costMultiplier ** normalizeBuildingLevel(currentLevel);
  return { gold: Math.floor(def.baseCost * factor), wood: Math.ceil((def.resourceCost.wood ?? 0) * factor), iron: Math.ceil((def.resourceCost.iron ?? 0) * factor), tools: Math.ceil((def.resourceCost.tools ?? 0) * factor) };
}
export const getBuildingUpgradeCost = getBuildingCosts;
export const getBuildingCost = (type: BuildingType, level: number) => getBuildingCosts(type, level).gold;
export const getBuildingTime = (type: BuildingType, level: number) => Math.ceil(BUILDING_DEFINITIONS[type].baseBuildTime * BUILDING_TIME_GROWTH ** normalizeBuildingLevel(level));
export const getBuildingBuildTime = getBuildingTime;
export const canBuildBuilding = (type: BuildingType, level: number) => normalizeBuildingLevel(level) < BUILDING_DEFINITIONS[type].maxLevel;
export const getBuildingLevel = (province: Province, type: BuildingType): number => Math.max(0, ...province.buildings.filter(b => b.type === type && b.daysRemaining <= 0).map(b => normalizeBuildingLevel(b.level)));
export const meetsBuildingRequirement = (province: Province, type: BuildingType, level: number): boolean => getBuildingLevel(province, type) >= level;
export function getBuildingBonus(province: Province, key: keyof Omit<BuildingBonus, 'politicalInfluence'>): number {
  return (Object.keys(BUILDING_DEFINITIONS) as BuildingType[]).reduce((sum, type) => sum + getBuildingLevel(province, type) * (BUILDING_DEFINITIONS[type].bonusPerLevel[key] ?? 0), 0);
}
export function getBuildingPoliticalInfluence(province: Province, group: import('../types').PoliticalGroupId): number {
  return (Object.keys(BUILDING_DEFINITIONS) as BuildingType[]).reduce((sum, type) => sum + getBuildingLevel(province, type) * (BUILDING_DEFINITIONS[type].bonusPerLevel.politicalInfluence?.[group] ?? 0), 0);
}
export const getMilitaryEquipmentCostMultiplier = (province: Province): number => 1 - getBuildingBonus(province, 'equipmentDiscount') / 100;
export function getBuildingEffect(type: BuildingType, rawLevel: number): string {
  const level = normalizeBuildingLevel(rawLevel), effects = BUILDING_DEFINITIONS[type].bonusPerLevel;
  if (!level) return 'Nenhum';
  const parts: string[] = [];
  if (effects.output) {
    const goods: Partial<Record<BuildingType, string>> = { farm: 'FOOD', lumber_mill: 'WOOD', iron_mine: 'IRON', workshop: 'TOOLS' };
    parts.push(`${level * effects.output} ${goods[type]}/dia de base (1.000 trabalhadores por nível; desenvolvimento e produtividade ajustam o total)`);
  }
  if (effects.storageBonus) parts.push(`+${level * effects.storageBonus}% capacidade de estoque`);
  if (effects.populationCapacity) parts.push(`+${level * effects.populationCapacity} população máxima`);
  if (effects.recruitmentSpeedBonus) parts.push(`+${level * effects.recruitmentSpeedBonus}% velocidade de recrutamento`);
  if (effects.equipmentDiscount) parts.push(`−${level * effects.equipmentDiscount}% ferro e ferramentas militares`);
  if (effects.defense) parts.push(`+${level * effects.defense} defesa`);
  if (effects.productivityBonus) parts.push(`+${level * effects.productivityBonus}% produtividade`);
  if (effects.logisticsBonus) parts.push(`+${level * effects.logisticsBonus}% eficiência logística`);
  if (effects.supplyCapacity) parts.push(`+${level * effects.supplyCapacity} capacidade de abastecimento local`);
  return parts.join('; ');
}
export const BUILDING_ALIASES: Record<string, BuildingType> = { lumber: 'lumber_mill', ironMine: 'iron_mine', fortification: 'fortress', temple: 'housing', port: 'market', university: 'infrastructure' };
export function resolveBuildingType(raw: string): BuildingType | undefined {
  return Object.prototype.hasOwnProperty.call(BUILDING_DEFINITIONS, raw) ? raw as BuildingType : BUILDING_ALIASES[raw];
}
