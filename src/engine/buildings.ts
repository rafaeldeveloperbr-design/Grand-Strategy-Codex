/**
 * ============================================================
 * MÓDULO 2 - Motor de Construção (Sistema de Fila)
 * ============================================================
 * Gerencia a fila de construções, processamento diário e cancelamento
 */

import { BuildingConstruction, BuildingType, Country, GoodId, Province } from '../types';
import { canBuildBuilding, getBuildingCost, getBuildingResourceCost, getBuildingTime } from '../data/buildings';
import { normalizeMarket } from './market';

export type ProjectStartResult = {
  success: boolean;
  reason?: string;
  province: Province;
  country: Country;
  constructions: BuildingConstruction[];
};

/** Validates and pays a construction exactly once when it enters the queue. */
export function startBuildingProject(
  province: Province, country: Country, type: BuildingType, constructions: BuildingConstruction[]
): ProjectStartResult {
  const currentLevel = province.buildings.find(building => building.type === type)?.level ?? 0;
  if (!canBuildBuilding(type, currentLevel)) return { success: false, reason: 'Nível máximo', province, country, constructions };
  if (constructions.some(item => item.provinceId === province.id && item.buildingType === type))
    return { success: false, reason: 'Construção já em andamento', province, country, constructions };
  const gold = getBuildingCost(type, currentLevel);
  if (country.resources.gold < gold) return { success: false, reason: 'Dinheiro insuficiente', province, country, constructions };
  const resourceCosts = getBuildingResourceCost(type, currentLevel);
  const market = normalizeMarket(province.market);
  for (const id of ['wood', 'iron', 'tools'] as GoodId[]) {
    if (market.goods[id].stock < (resourceCosts[id] ?? 0))
      return { success: false, reason: `${id.toUpperCase()} insuficiente`, province, country, constructions };
  }
  for (const [id, amount] of Object.entries(resourceCosts) as [GoodId, number][]) {
    market.goods[id].stock -= amount;
  }
  const totalDays = getBuildingTime(type, currentLevel);
  const construction: BuildingConstruction = {
    id: `const_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, provinceId: province.id,
    owner: country.tag, buildingType: type, daysRemaining: totalDays, totalDays, cost: gold,
    targetLevel: currentLevel + 1, resourceCosts,
  };
  return {
    success: true, province: { ...province, market },
    country: { ...country, resources: { ...country.resources, gold: country.resources.gold - gold } },
    constructions: [...constructions, construction],
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
  constructionSpeedByCountry: Map<string, number> = new Map()
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

    const newDays = item.daysRemaining - (1 + (constructionSpeedByCountry.get(item.owner) ?? 0));

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
