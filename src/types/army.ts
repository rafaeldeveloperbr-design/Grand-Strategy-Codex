import type { GameDate } from './date'


/**
 * ============================================================
 * MÓDULO 3 - Tipos Militares
 * ============================================================
 */

/**
 * Tipos de unidades militares
 */
export type UnitType = 'infantry' | 'cavalry' | 'artillery' | 'archers' | 'heavy_cavalry' | 'elite_guard' | 'siege_engine';

/**
 * Definição de um tipo de unidade militar
 */
export interface UnitDefinition {
  type: UnitType;
  name: string;
  icon: string;
  /** Custo em ouro por regimento (1000 homens) */
  cost: number;
  /** Custo em manpower por regimento */
  manpowerCost: number;
  /** Dias de treinamento */
  trainingTime: number;
  /** Poder de ataque base */
  attack: number;
  /** Poder de defesa base */
  defense: number;
  /** Mobilidade (províncias por dia) */
  mobility: number;
}

/**
 * Representa um regimento militar (unidade básica)
 */
export interface Regiment {
  type: UnitType;
  /** Número de homens no regimento (máx 1000) */
  strength: number;
  /** Moral (0-100) */
  morale: number;
}

/**
 * Representa um exército (coleção de regimentos)
 */
export interface Army {
  /** ID único do exército */
  id: string;
  /** País dono do exército */
  owner: string;
  /** Nome do exército */
  name: string;
  /** Lista de regimentos */
  regiments: Regiment[];
  /** Província atual (null se em movimento) */
  location: string | null;
  /** Próximo passo imediato da rota */
  destination: string | null;
  /** Destino final selecionado pelo jogador */
  targetDestination: string | null;
  /** Progresso do movimento (0-1, onde 1 = chegou) */
  movementProgress: number;
  /** Velocidade de movimento (baseada no regimento mais lento) */
  movementSpeed: number;
  /** Posição visual atual (para animação) */
  position: { x: number; y: number } | null;
  /** Lista de províncias a percorrer em ordem (rota completa) */
  path: string[];
  /** ID do exército alvo (Target Locking - IA mantém foco até eliminar) */
  targetArmyId?: string | null;
  /** ID da província alvo de invasão (Target Locking de invasão - IA marcha em linha reta) */
  targetProvinceId?: string | null;
  /** Indica se o exército está em combate (bloqueia movimento) */
  inCombat?: boolean;
  originalOwner?: string; // País de origem dos rebeldes (para IA separatista)
  separatistMode?: boolean; // Flag para ativar a marcha de reconquista

}

/**
 * Representa um recrutamento em andamento
 */
export interface Recruitment {
  /** ID único */
  id: string;
  /** Província onde está recrutando */
  provinceId: string;
  /** País que está recrutando */
  owner: string;
  /** Tipo de unidade sendo recrutada */
  unitType: UnitType;
  /** Dias restantes */
  daysRemaining: number;
  /** Quantidade de unidades sendo recrutadas (agrupamento) */
  count: number;
}

export interface RetreatInfo {
  retreated: boolean;
  to: string;
  toName: string;
  troops: number;
  owner: string;
}

export interface BattleParticipantDetail {
   id: string;
  side: 'attacker' | 'defender';
  final: number;
}

export interface BattleProvinceInfo {
  fortLevel?: number;
  terrain?: string;
}

/**
 * Resultado de um combate
 */
export interface CombatResult {
  attacker: Army;
  defender: Army;
  attackerOriginal: Army;
  defenderOriginal: Army;
  attackerCasualties: number;
  defenderCasualties: number;
  winner: 'attacker' | 'defender';
  provinceId: string;
  provinceName: string;
  duration: number;
  territoryChanged: boolean;
  newOwner?: string;
  territorialDefenseBonus: boolean;
  powerRatio: number;
  date: GameDate;
  isStackwipe?: boolean;
  retreatInfo?: RetreatInfo | null;
  participantDetails?: BattleParticipantDetail[];
  totalAttackerInitial?: number;
  totalDefenderInitial?: number;
  attackerCurrentTroops?: number;
  defenderCurrentTroops?: number;
  province?: BattleProvinceInfo;
}
