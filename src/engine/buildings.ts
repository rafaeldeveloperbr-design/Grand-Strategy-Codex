/**
 * ============================================================
 * MÓDULO 2 - Motor de Construção (Sistema de Fila)
 * ============================================================
 * Gerencia a fila de construções, processamento diário e cancelamento
 */

import { BuildingConstruction, BuildingType, Province } from '../types';
import { getBuildingCosts, getBuildingTime, BUILDING_DEFINITIONS } from '../data/buildings';
import {
  getAvailableDomesticStock,
  consumeDomesticStock,
} from './internalTrade';

export type BuildingBlockReason = 'Nível máximo' | 'Dinheiro insuficiente' | 'WOOD insuficiente' | 'IRON insuficiente' | 'TOOLS insuficiente';

export function getBuildingBlockReason(
  province: Province,
  provinces: Province[],
  type: BuildingType,
  gold: number,
  constructions: BuildingConstruction[],
): BuildingBlockReason | null {
  const currentLevel =
    province.buildings.find(building => building.type === type)?.level ?? 0;

  const queuedLevels = constructions.filter(
    construction =>
      construction.provinceId === province.id &&
      construction.buildingType === type
  ).length;

  const level = currentLevel + queuedLevels;

  const costs = getBuildingCosts(type, level);

  if (level >= BUILDING_DEFINITIONS[type].maxLevel) {
    return 'Nível máximo';
  }

  if (gold < costs.gold) {
    return 'Dinheiro insuficiente';
  }

  if (
    getAvailableDomesticStock(province, 'wood', provinces) <
    costs.wood
  ) {
    return 'WOOD insuficiente';
  }

  if (
    getAvailableDomesticStock(province, 'iron', provinces) <
    costs.iron
  ) {
    return 'IRON insuficiente';
  }

  if (
    getAvailableDomesticStock(province, 'tools', provinces) <
    costs.tools
  ) {
    return 'TOOLS insuficiente';
  }


  return null;
}

/** Atomically validates and pays a construction order exactly once. */
export function startBuilding(
  province: Province,
  provinces: Province[],
  owner: string,
  type: BuildingType,
  gold: number,
  constructions: BuildingConstruction[],
) {
  const reason = getBuildingBlockReason(
    province,
    provinces,
    type,
    gold,
    constructions,
  );

  if (reason) {
    return {
      success: false as const,
      reason,
      provinces,
      gold,
      constructions,
    };
  }

  const currentLevel =
    province.buildings.find(building => building.type === type)?.level ?? 0;

  const queuedLevels = constructions.filter(
    construction =>
      construction.provinceId === province.id &&
      construction.buildingType === type
  ).length;

  const level = currentLevel + queuedLevels;

  const costs = getBuildingCosts(type, level);
  const totalDays = getBuildingTime(type, level);

  // Trabalhamos sobre o resultado de cada consumo.
  // Como a disponibilidade foi validada acima,
  // os três consumos devem conseguir concluir.
  let updatedProvinces = provinces;

  const woodResult = consumeDomesticStock(
    province.id,
    'wood',
    costs.wood,
    updatedProvinces,
  );

  updatedProvinces = woodResult.provinces;

  const ironResult = consumeDomesticStock(
    province.id,
    'iron',
    costs.iron,
    updatedProvinces,
  );

  updatedProvinces = ironResult.provinces;

  const toolsResult = consumeDomesticStock(
    province.id,
    'tools',
    costs.tools,
    updatedProvinces,
  );

  updatedProvinces = toolsResult.provinces;

  // Proteção adicional.
  // Em condições normais não deve acontecer porque
  // getBuildingBlockReason já validou a disponibilidade.
  if (
    !woodResult.success ||
    !ironResult.success ||
    !toolsResult.success
  ) {
    return {
      success: false as const,
      reason: 'Recursos insuficientes' as const,
      provinces,
      gold,
      constructions,
    };
  }

  if (
    !woodResult.success ||
    !ironResult.success ||
    !toolsResult.success
  ) {
    return {
      success: false as const,
      reason: 'WOOD insuficiente' as BuildingBlockReason,
      provinces,
      gold,
      constructions,
    };
  }

  const construction: BuildingConstruction = {
    id: `const_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    provinceId: province.id,
    owner,
    buildingType: type,
    daysRemaining: totalDays,
    totalDays,
    cost: costs.gold,
    resourceCost: {
      wood: costs.wood,
      iron: costs.iron,
      tools: costs.tools,
    },
  };

  return {
    success: true as const,
    reason: null,
    provinces: updatedProvinces,
    gold: gold - costs.gold,
    constructions: [...constructions, construction],
  };
}

/**
 * Adiciona uma construção à fila se o jogador tiver ouro suficiente
 */
export function queueBuilding(
  provinceId: string,
  owner: string,
  buildingType: BuildingType,
  totalDays: number,
  cost: number,
  constructions: BuildingConstruction[],
  currentGold: number
): { updatedConstructions: BuildingConstruction[]; newGold: number; success: boolean } {
  // Verifica se o jogador tem ouro suficiente
  if (currentGold < cost) {
    return { updatedConstructions: constructions, newGold: currentGold, success: false };
  }

  const newConstruction: BuildingConstruction = {
    id: `const_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    provinceId,
    owner,
    buildingType,
    daysRemaining: totalDays,
    totalDays,
    cost,
  };

  return {
    updatedConstructions: [...constructions, newConstruction],
    newGold: currentGold - cost,
    success: true,
  };
}

/**
 * Processa a passagem de tempo para as construções.
 * APENAS a primeira construção de cada província avança os dias.
 * Valida propriedade da província a cada dia para cancelar construções em províncias perdidas
 */
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

    // Se a província não existe mais ou mudou de dono:
    // Nota: Como não temos o país que ordenou a construção no BuildingConstruction,
    // verificamos se a província ainda existe. O cancelamento por mudança de dono
    // é feito pela função cancelProvinceActivities no App.tsx
    if (!province) {
      console.log(`❌ Construção cancelada: província ${item.provinceId} não existe mais`);
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
    const progressRatio = target.daysRemaining / target.totalDays;
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
