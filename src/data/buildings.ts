/**
 * ============================================================
 * MÓDULO 2 - Definições de Edifícios
 * ============================================================
 * Define os templates de todos os edifícios disponíveis no jogo.
 * Cada edifício tem custo, tempo de construção, nível máximo e bônus.
 */

import { BuildingDefinition, BuildingType } from '../types';

/**
 * Definições de todos os edifícios disponíveis.
 * Usado como referência para custos e bônus.
 */
export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  farm: {
    type: 'farm',
    name: 'Fazenda',
    description: '+Crescimento Populacional e +Renda de Ouro. Aumenta a produção de alimentos da província.',
    icon: '🌾',
    baseCost: 250,
    costMultiplier: 1.5,
    baseBuildTime: 30,
    maxLevel: 5,
    bonusPerLevel: {
      goldIncome: 3.5,
      growthBonus: 0.5,
    },
  },
  market: {
    type: 'market',
    name: 'Mercado',
    description: '+Renda Diária de Ouro. Aumenta significativamente o comércio e impostos da província.',
    icon: '🏪',
    baseCost: 350,
    costMultiplier: 1.6,
    baseBuildTime: 45,
    maxLevel: 5,
    bonusPerLevel: {
      goldIncome: 6.0,
    },
  },
  barracks: {
    type: 'barracks',
    name: 'Acampamento',
    description: '-15% Tempo de Recrutamento e +Manpower. Treina tropas mais rapidamente e aumenta o limite de recrutamento.',
    icon: '⚔️',
    baseCost: 450,
    costMultiplier: 1.5,
    baseBuildTime: 40,
    maxLevel: 5,
    bonusPerLevel: {
      manpowerGain: 50,
      recruitmentSpeedBonus: 15,
    },
  },
  fortification: {
    type: 'fortification',
    name: 'Fortificação',
    description: '+Defesa da Província. Aumenta a resistência a cercos e dificulta conquistas inimigas.',
    icon: '🏰',
    baseCost: 700,
    costMultiplier: 1.8,
    baseBuildTime: 60,
    maxLevel: 5,
    bonusPerLevel: {
      defense: 3,
    },
  },
  workshop: {
    type: 'workshop',
    name: 'Oficina',
    description: '+15% Velocidade de Construção. Acelera a construção de todos os edifícios na província.',
    icon: '🔨',
    baseCost: 400,
    costMultiplier: 1.6,
    baseBuildTime: 45,
    maxLevel: 5,
    bonusPerLevel: {
      buildSpeedBonus: 15,
    },
  },
  temple: {
    type: 'temple',
    name: 'Templo',
    description: '+0.05 Estabilidade/mês. Aumenta a estabilidade do país e a lealdade da população.',
    icon: '⛪',
    baseCost: 350,
    costMultiplier: 1.5,
    baseBuildTime: 40,
    maxLevel: 5,
    bonusPerLevel: {
      stabilityBonus: 0.05,
    },
  },
  port: {
    type: 'port',
    name: 'Porto',
    description: '+15 Renda de Ouro. Aumenta o comércio marítimo e a renda da província (apenas litoral).',
    icon: '⚓',
    baseCost: 500,
    costMultiplier: 1.7,
    baseBuildTime: 60,
    maxLevel: 5,
    bonusPerLevel: {
      goldIncome: 15,
    },
  },
  university: {
    type: 'university',
    name: 'Universidade',
    description: '+20% Velocidade de Pesquisa. Acelera o desenvolvimento de novas tecnologias.',
    icon: '📚',
    baseCost: 600,
    costMultiplier: 1.8,
    baseBuildTime: 75,
    maxLevel: 5,
    bonusPerLevel: {
      researchSpeedBonus: 20,
    },
  },
};

/**
 * Calcula o custo de construção de um edifício em um determinado nível
 */
export function getBuildingCost(type: BuildingType, currentLevel: number): number {
  const def = BUILDING_DEFINITIONS[type];
  return Math.floor(def.baseCost * Math.pow(def.costMultiplier, currentLevel));
}

/**
 * Calcula o tempo de construção em dias para um determinado nível
 */
export function getBuildingTime(type: BuildingType, currentLevel: number): number {
  const def = BUILDING_DEFINITIONS[type];
  return Math.floor(def.baseBuildTime * (1 + currentLevel * 0.3));
}

/**
 * Verifica se é possível construir um edifício (nível máximo não atingido)
 */
export function canBuildBuilding(
  type: BuildingType,
  currentLevel: number
): boolean {
  const def = BUILDING_DEFINITIONS[type];
  return currentLevel < def.maxLevel;
}
