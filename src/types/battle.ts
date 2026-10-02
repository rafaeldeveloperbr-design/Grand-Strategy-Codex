import type { Army } from './army'
import type { GameDate } from './date'

/**
 * Representa uma batalha ativa em andamento
 */
export interface ActiveBattle {
  /** ID único da batalha */
  id: string;
  /** ID da província onde ocorre a batalha */
  provinceId: string;
  /** ID do exército atacante */
  attackerArmyId: string;
  /** ID do exército defensor */
  defenderArmyId: string;
  /** Países que definem os lados; permitem substituir um representante perdido. */
  attackerOwner?: string;
  defenderOwner?: string;
  /** Lista completa de IDs de todos os exércitos participantes (incluindo reforços) */
  participantArmyIds: string[];
  /** Duração total da batalha em dias */
  daysTotal: number;
  /** Dias restantes para o fim da batalha */
  daysRemaining: number;
  /** Tropas iniciais do atacante */
  attackerInitialTroops: number;
  /** Tropas iniciais do defensor */
  defenderInitialTroops: number;
  /** Tropas atuais do atacante */
  attackerCurrentTroops: number;
  /** Tropas atuais do defensor */
  defenderCurrentTroops: number;
  /** Baixas acumuladas do atacante */
  attackerCasualties: number;
  /** Baixas acumuladas do defensor */
  defenderCasualties: number;
  /** Data de início da batalha */
  startDate: GameDate;
  /** Snapshot inicial completo do atacante (ANTES do combate) */
  attackerInitialSnapshot?: Army;
  /** Snapshot inicial completo do defensor (ANTES do combate) */
  defenderInitialSnapshot?: Army;

  shouldRetreatAttacker?: boolean
  shouldRetreatDefender?: boolean
}


