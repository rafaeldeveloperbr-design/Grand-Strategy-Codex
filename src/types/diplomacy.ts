/**
 * ============================================================
 * MÓDULO 4 - Tipos de Diplomacia e Guerra
 * ============================================================
 */

/**
 * Status da relação entre dois países
 */
export type DiplomaticStatus = 'peace' | 'war' | 'non_aggression_pact' | 'alliance';

/**
 * Representa a relação diplomática entre dois países
 */
export interface DiplomaticRelation {
  /** Tag do país A */
  countryA: string;
  /** Tag do país B */
  countryB: string;
  /** Nível de opinião (-100 a +100) */
  opinion: number;
  /** Status atual da relação */
  status: DiplomaticStatus;
  /** Dias restantes de pacto de não agressão (0 = expirado) */
  pactDaysRemaining: number;
}

/**
 * Representa uma guerra ativa entre países
 */
export interface War {
  /** ID único da guerra */
  id: string;
  /** País atacante */
  attacker: string;
  /** País defensor */
  defender: string;
  /** Data de início */
  startDate: { year: number; month: number; day: number };
  /** Pontuação de guerra (positivo = atacante vencendo) */
  warScore: number;
  /** Baixas do atacante */
  attackerCasualties: number;
  /** Baixas do defensor */
  defenderCasualties: number;
  /** Províncias ocupadas pelo atacante */
  occupiedByAttacker: string[];
  /** Províncias ocupadas pelo defensor */
  occupiedByDefender: string[];
  /** Dias desde o início da guerra (calculado automaticamente) */
  daysSinceStart?: number;
}

/**
 * Ação diplomática disponível
 */
export type DiplomaticAction = 
  | 'improve_relations'
  | 'offer_non_aggression'
  | 'declare_war'
  | 'make_peace';

/**
 * Custo de uma ação diplomática
 */
export interface DiplomaticActionCost {
  gold: number;
  opinionChange: number;
  daysToComplete?: number;
}
