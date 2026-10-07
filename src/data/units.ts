/**
 * ============================================================
 * MÓDULO 3 - Definições de Unidades Militares
 * ============================================================
 * Define os tipos de unidades disponíveis para recrutamento.
 */

import { UnitDefinition, UnitType } from '../types';
import { TECHNOLOGIES } from './technology';

/**
 * Definições de todos os tipos de unidades militares
 */
export const UNIT_DEFINITIONS: Record<UnitType, UnitDefinition> = {
  motorized_infantry: { type: 'motorized_infantry', name: 'Infantaria Motorizada', icon: '🚚', role: 'Infantaria móvel, com equipamento e abastecimento mais caros.', cost: 100, manpowerCost: 1000, ironCost: 10, toolsCost: 8, trainingTime: 40, maxStrength: 1000, maxMorale: 100, maxOrganization: 100, attack: 16, defense: 11, shock: 8, siege: 1, mobility: 1.6, supplyUse: 1.6, maintenance: .2, requiredArsenalLevel: 1 },
  armor: { type: 'armor', name: 'Blindados', icon: '🛡️', role: 'Choque ofensivo pesado; exige indústria e boa logística.', cost: 240, manpowerCost: 500, ironCost: 24, toolsCost: 18, trainingTime: 70, maxStrength: 500, maxMorale: 100, maxOrganization: 90, attack: 32, defense: 18, shock: 28, siege: 4, mobility: 1.3, supplyUse: 3, maintenance: .5, requiredArsenalLevel: 2 },
  reconnaissance: { type: 'reconnaissance', name: 'Reconhecimento', icon: '🔭', role: 'Força leve de elevada mobilidade e combate limitado.', cost: 70, manpowerCost: 500, ironCost: 5, toolsCost: 5, trainingTime: 25, maxStrength: 500, maxMorale: 90, maxOrganization: 95, attack: 7, defense: 6, shock: 5, siege: 0, mobility: 2, supplyUse: .7, maintenance: .14, requiredArsenalLevel: 1 },
  engineers: { type: 'engineers', name: 'Engenheiros', icon: '🛠️', role: 'Apoio defensivo e cerco, com ataque limitado.', cost: 90, manpowerCost: 600, ironCost: 8, toolsCost: 10, trainingTime: 35, maxStrength: 600, maxMorale: 95, maxOrganization: 100, attack: 9, defense: 17, shock: 2, siege: 12, mobility: .9, supplyUse: 1.1, maintenance: .15, requiredArsenalLevel: 1 },
  garrison: { type: 'garrison', name: 'Guarnição', icon: '🏰', role: 'Defesa territorial econômica; inadequada para ofensivas longas.', cost: 35, manpowerCost: 1000, ironCost: 2, toolsCost: 2, trainingTime: 20, maxStrength: 1000, maxMorale: 90, maxOrganization: 95, attack: 5, defense: 15, shock: 1, siege: 0, mobility: .4, supplyUse: .6, maintenance: .06 },
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
    requiredArsenalLevel: 1,
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

export const RECRUITABLE_UNIT_IDS = ['infantry', 'motorized_infantry', 'armor', 'artillery', 'reconnaissance', 'engineers', 'garrison'] as const;
export function isRecognizedUnitType(value: unknown): value is UnitType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(UNIT_DEFINITIONS, value);
}
export const isRecruitableUnitType = (value: UnitType): boolean => RECRUITABLE_UNIT_IDS.some(id => id === value);
export const getUnitTechnologyName = (id: string): string => TECHNOLOGIES.find(t => t.id === id)?.title ?? 'Tecnologia indisponível';

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
