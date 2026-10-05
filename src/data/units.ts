/**
 * ============================================================
 * MÓDULO 3 - Definições de Unidades Militares
 * ============================================================
 * Define os tipos de unidades disponíveis para recrutamento.
 */

import { UnitDefinition, UnitType } from '../types';

/**
 * Definições de todos os tipos de unidades militares
 */
export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  infantry: {
    type: 'infantry',
    name: 'Infantaria',
    icon: '🗡️',
    cost: 50,
    manpowerCost: 1000,
    ironCost: 4, toolsCost: 3,
    trainingTime: 30,
    attack: 10,
    defense: 12,
    mobility: 1.0,
    role: 'Linha versátil, eficiente para sustentar a frente.', maxStrength: 1000, maxMorale: 100, maxOrganization: 100, shock: 4, siege: 1, supplyUse: 1, maintenance: .1,
  },
  cavalry: {
    type: 'cavalry',
    name: 'Cavalaria',
    icon: '🐎',
    cost: 80,
    manpowerCost: 1000,
    ironCost: 6, toolsCost: 4,
    trainingTime: 45,
    attack: 15,
    defense: 8,
    mobility: 1.5,
    role: 'Mobilidade e choque para explorar forças desorganizadas.', maxStrength: 1000, maxMorale: 105, maxOrganization: 90, shock: 18, siege: 0, supplyUse: 1.4, maintenance: .18,
  },
  artillery: {
    type: 'artillery',
    name: 'Artilharia',
    icon: '💣',
    cost: 120,
    manpowerCost: 1000,
    ironCost: 12, toolsCost: 8,
    trainingTime: 60,
    attack: 20,
    defense: 5,
    mobility: 0.5,
    role: 'Apoio de fogo e redução de fortificações.', maxStrength: 600, maxMorale: 85, maxOrganization: 80, shock: 6, siege: 18, supplyUse: 1.8, maintenance: .28, requiredTechnology: 'improved_weapons',
  },
  archers: {
    type: 'archers',
    name: 'Arqueiros',
    icon: '🏹',
    cost: 40,
    manpowerCost: 800,
    ironCost: 3, toolsCost: 3,
    trainingTime: 20,
    attack: 8,
    defense: 14,
    mobility: 1.0,
    role: 'Apoio defensivo econômico.', maxStrength: 800, maxMorale: 90, maxOrganization: 95, shock: 2, siege: 0, supplyUse: .8, maintenance: .08,
  },
  heavy_cavalry: {
    type: 'heavy_cavalry',
    name: 'Cavalaria Pesada',
    icon: '🐴',
    cost: 140,
    manpowerCost: 1000,
    ironCost: 10, toolsCost: 6,
    trainingTime: 45,
    attack: 22,
    defense: 12,
    mobility: 1.2,
    role: 'Choque caro para romper linhas organizadas.', maxStrength: 800, maxMorale: 110, maxOrganization: 90, shock: 25, siege: 0, supplyUse: 1.8, maintenance: .25, requiredTechnology: 'improved_weapons',
  },
  elite_guard: {
    type: 'elite_guard',
    name: 'Guarda Real',
    icon: '👑',
    cost: 200,
    manpowerCost: 1000,
    ironCost: 12, toolsCost: 10,
    trainingTime: 60,
    attack: 25,
    defense: 25,
    mobility: 1.0,
    role: 'Infantaria profissional de alta resistência.', maxStrength: 800, maxMorale: 120, maxOrganization: 115, shock: 12, siege: 2, supplyUse: 1.5, maintenance: .32, requiredTechnology: 'professional_army',
  },
  siege_engine: {
    type: 'siege_engine',
    name: 'Armas de Cerco',
    icon: '🏗️',
    cost: 180,
    manpowerCost: 500,
    ironCost: 16, toolsCost: 8,
    trainingTime: 50,
    attack: 30,
    defense: 3,
    mobility: 0.3,
    role: 'Especialista em neutralizar fortalezas; frágil em campo.', maxStrength: 400, maxMorale: 75, maxOrganization: 70, shock: 2, siege: 35, supplyUse: 2.2, maintenance: .3, requiredTechnology: 'fortifications',
  },
};

/**
 * Calcula o custo total para recrutar uma unidade
 */
export function getRecruitmentCost(unitType: UnitType): { gold: number; manpower: number; iron: number; tools: number; days: number } {
  const def = UNIT_DEFINITIONS[unitType];
  return {
    gold: def.cost,
    manpower: def.manpowerCost,
    iron: def.ironCost,
    tools: def.toolsCost,
    days: def.trainingTime,
  };
}
