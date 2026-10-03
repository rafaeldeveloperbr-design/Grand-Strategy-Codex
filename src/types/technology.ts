/**
 * ============================================================
 * MÓDULO 6 - Tipos de Tecnologia e Foco Nacional
 * ============================================================
 */

/**
 * Categorias de tecnologia
 */
export type TechnologyCategory = 'AGRICULTURE' | 'INDUSTRY' | 'INFRASTRUCTURE' | 'MILITARY';

export type TechnologyEffect =
  | { type: 'foodProduction'; value: number }
  | { type: 'woodProduction'; value: number }
  | { type: 'ironProduction'; value: number }
  | { type: 'toolProduction'; value: number }
  | { type: 'warehouseCapacity'; value: number }
  | { type: 'infrastructureProductivity'; value: number }
  | { type: 'constructionSpeed'; value: number }
  | { type: 'internalTradeEfficiency'; value: number }
  | { type: 'armyAttack'; value: number }
  | { type: 'armyDefense'; value: number }
  | { type: 'fortressDefense'; value: number };

/**
 * Tipos de efeitos de recompensa
 */
export type RewardEffectType = 
  | 'COMBAT_POWER'
  | 'GOLD_INCOME'
  | 'BUILD_COST'
  | 'BUILD_TIME'
  | 'MANPOWER'
  | 'STABILITY'
  | 'RESEARCH_SPEED'
  | 'DEFENSE_BONUS';

/**
 * Efeito de recompensa de tecnologia/foco
 */
export interface RewardEffect {
  type: RewardEffectType;
  value: number;
  unitType?: 'infantry' | 'cavalry' | 'artillery'; // Para bônus de combate
}

/**
 * Foco Nacional
 */
export interface NationalFocus {
  id: string;
  title: string;
  description: string;
  icon: string;
  durationDays: number;
  currentProgressDays: number;
  completed: boolean;
  rewardEffect: RewardEffect;
  prerequisites?: string[]; // IDs de outros focos necessários
}

/**
 * Tecnologia pesquisável
 */
export interface Technology {
  id: string;
  name: string;
  description: string;
  category: TechnologyCategory;
  icon: string;
  researchCost: number;
  goldCost: number;
  prerequisites: string[];
  effects: TechnologyEffect[];
}

/**
 * Estado de tecnologias e focos de um país
 */
export interface CountryTechState {
  countryTag: string;
  activeFocusId: string | null;
  activeResearchId: string | null;
  completedFocuses: string[];
  completedTechnologies: string[];
  // Progresso isolado por país (não compartilhado globalmente)
  focusProgressDays: number;
  researchProgressDays: number;
  researchSpeed?: number;
}

export interface TechnologyModifiers {
  foodProduction: number;
  woodProduction: number;
  ironProduction: number;
  toolProduction: number;
  warehouseCapacity: number;
  infrastructureProductivity: number;
  constructionSpeed: number;
  internalTradeEfficiency: number;
  armyAttack: number;
  armyDefense: number;
  fortressDefense: number;
}
