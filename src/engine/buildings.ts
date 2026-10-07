import type { BuildingConstruction, BuildingType, Province } from '../types';
import { BUILDING_DEFINITIONS, getBuildingCosts, getBuildingLevel, getBuildingTime, meetsBuildingRequirement } from '../data/buildings';
import { consumeDomesticStock, getAvailableDomesticStock } from './internalTrade';

export type BuildingBlockCode = 'maximum_level' | 'gold' | 'wood' | 'iron' | 'tools' | 'construction_pending' | 'prerequisite';
export const BUILDING_BLOCK_MESSAGES: Record<BuildingBlockCode, string> = {
  maximum_level: 'Nível máximo', gold: 'Dinheiro insuficiente', wood: 'WOOD insuficiente', iron: 'IRON insuficiente', tools: 'TOOLS insuficiente',
  construction_pending: 'Já existe construção em andamento', prerequisite: 'Requer Quartel ou Infraestrutura nível 1',
};
export type BuildingBlockReason = typeof BUILDING_BLOCK_MESSAGES[BuildingBlockCode];
/** Full list is shared by engine, AI and UI. Legacy queues still finish serially. */
export function getBuildingBlockReasons(province: Province, provinces: Province[], type: BuildingType, gold: number, constructions: BuildingConstruction[]): BuildingBlockCode[] {
  const level = getBuildingLevel(province, type), definition = BUILDING_DEFINITIONS[type], costs = getBuildingCosts(type, level);
  const reasons: BuildingBlockCode[] = [];
  if (level >= definition.maxLevel) reasons.push('maximum_level');
  if (constructions.some(c => c.provinceId === province.id) || province.buildings.some(b => b.daysRemaining > 0)) reasons.push('construction_pending');
  if (definition.prerequisites && !definition.prerequisites.some(r => meetsBuildingRequirement(province, r.type, r.level))) reasons.push('prerequisite');
  if (!Number.isFinite(gold) || gold < costs.gold) reasons.push('gold');
  for (const good of ['wood', 'iron', 'tools'] as const) {
    if (getAvailableDomesticStock(province, good, provinces) < costs[good]) reasons.push(good);
  }
  return reasons;
}
export function getBuildingBlockReason(province: Province, provinces: Province[], type: BuildingType, gold: number, constructions: BuildingConstruction[]): BuildingBlockReason | null {
  const first = getBuildingBlockReasons(province, provinces, type, gold, constructions)[0];
  return first ? BUILDING_BLOCK_MESSAGES[first] : null;
}
export const canUpgradeBuilding = (province: Province, provinces: Province[], type: BuildingType, gold: number, constructions: BuildingConstruction[]): boolean => getBuildingBlockReasons(province, provinces, type, gold, constructions).length === 0;

/** Validates and pays once. Failed orders return the original state. */
export function startBuilding(province: Province, provinces: Province[], owner: string, type: BuildingType, gold: number, constructions: BuildingConstruction[]) {
  const reason = province.owner !== owner ? 'A província não é controlada pelo país' : getBuildingBlockReason(province, provinces, type, gold, constructions);
  if (reason) return { success: false as const, reason, provinces, gold, constructions };
  const level = getBuildingLevel(province, type), costs = getBuildingCosts(type, level), totalDays = getBuildingTime(type, level);
  let updatedProvinces = provinces;
  for (const good of ['wood', 'iron', 'tools'] as const) {
    const result = consumeDomesticStock(province.id, good, costs[good], updatedProvinces);
    if (!result.success) return { success: false as const, reason: BUILDING_BLOCK_MESSAGES[good], provinces, gold, constructions };
    updatedProvinces = result.provinces;
  }
  // Deterministic within the persistent queue; no random choice or wall clock.
  const prefix = `const_${owner}_${province.id}_${type}_${level + 1}`;
  let id = prefix, suffix = 1;
  while (constructions.some(c => c.id === id)) id = `${prefix}_${suffix++}`;
  const construction: BuildingConstruction = { id, provinceId: province.id, owner, buildingType: type, daysRemaining: totalDays, totalDays, cost: costs.gold, resourceCost: { wood: costs.wood, iron: costs.iron, tools: costs.tools } };
  return { success: true as const, reason: null, provinces: updatedProvinces, gold: gold - costs.gold, constructions: [...constructions, construction] };
}

export function getConstructionTargetLevel(construction: BuildingConstruction, province: Province, constructions: BuildingConstruction[]): number {
  const index = constructions.findIndex(c => c.id === construction.id);
  const prior = constructions.slice(0, Math.max(0, index)).filter(c => c.provinceId === province.id && c.buildingType === construction.buildingType).length;
  return Math.min(BUILDING_DEFINITIONS[construction.buildingType].maxLevel, getBuildingLevel(province, construction.buildingType) + prior + 1);
}
export function processConstructions(
  constructions: BuildingConstruction[],
  provinces: Province[] = [],
  constructionSpeedMultipliers: ReadonlyMap<string, number> = new Map(),
): { updatedConstructions: BuildingConstruction[]; completedConstructions: BuildingConstruction[] } {
  const completedConstructions: BuildingConstruction[] = [];

  // Rastreia quais províncias já tiveram sua obra ativa processada hoje
  const processedProvinces = new Set<string>();

  const updatedConstructions = constructions.map(item => {
    // VALIDAÇÃO DE PROPRIEDADE: Verifica se o dono da província ainda possui a província
    const province = provinces.find(p => p.id === item.provinceId);

    // Lost territory cannot finish orders for its former owner.
    if (!province || province.owner !== item.owner) {
      return null; // Descarta a construção
    }

    // Se esta província já teve sua obra ativa processada hoje, as demais continuam na fila (sem decrementar)
    if (processedProvinces.has(item.provinceId)) {
      return item;
    }

    // Marca que a obra ativa desta província está sendo processada
    processedProvinces.add(item.provinceId);

    const newDays = item.daysRemaining - (constructionSpeedMultipliers.get(item.owner) ?? 1);

    if (newDays <= 0) {
      completedConstructions.push(item);
      return null; // Será removido da lista pois concluiu
    }

    return {
      ...item,
      daysRemaining: newDays,
    };
  }).filter(Boolean) as BuildingConstruction[];

  return {
    updatedConstructions,
    completedConstructions,
  };
}

/**
 * Cancela uma construção e calcula o reembolso.
 * - Se for a 1ª da fila (ativa): Reembolso proporcional aos dias restantes.
 * - Se for 2ª+ da fila (aguardando): Reembolso de 100%.
 */
export function cancelBuilding(
  constructionId: string,
  constructions: BuildingConstruction[],
  currentGold: number
): { updatedConstructions: BuildingConstruction[]; newGold: number; refundedGold: number } {
  const index = constructions.findIndex(c => c.id === constructionId);
  if (index === -1) {
    return { updatedConstructions: constructions, newGold: currentGold, refundedGold: 0 };
  }

  const target = constructions[index];

  // Encontra todas as construções da MESMA província antes desta
  const priorConstructionsInSameProvince = constructions
    .slice(0, index)
    .filter(c => c.provinceId === target.provinceId);

  const isCurrentlyActive = priorConstructionsInSameProvince.length === 0;

  let refundedGold = 0;

  if (isCurrentlyActive) {
    // Obra ATIVA: Reembolso proporcional com mínimo de 10%
    const progressRatio = target.totalDays > 0 ? Math.max(0, Math.min(1, target.daysRemaining / target.totalDays)) : 0;
    const refundFactor = Math.max(0.10, progressRatio);
    refundedGold = Math.floor(target.cost * refundFactor);
  } else {
    // Obra EM ESPERA (FILA): Reembolso de 100% do valor pago
    refundedGold = target.cost;
  }

  // Remove a construção da fila
  const updatedConstructions = constructions.filter(c => c.id !== constructionId);

  return {
    updatedConstructions,
    newGold: currentGold + refundedGold,
    refundedGold,
  };
}

/**
 * Verifica se uma construção é a ativa (primeira da fila) em sua província
 */
