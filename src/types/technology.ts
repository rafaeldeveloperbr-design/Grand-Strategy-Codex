/**
 * ============================================================
 * MÓDULO 6 - Tipos de Tecnologia e Foco Nacional
 * ============================================================
 */

/**
 * Categorias de tecnologia
 */
export type TechnologyCategory = 'MILITARY' | 'ECONOMY' | 'INFRASTRUCTURE';

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
  title: string;
  description: string;
  category: TechnologyCategory;
  icon: string;
  costGold: number;
  durationDays: number;
  currentProgressDays: number;
  researched: boolean;
  prerequisites: string[]; // IDs de outras tecnologias necessárias
  rewardEffect: RewardEffect;
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
}