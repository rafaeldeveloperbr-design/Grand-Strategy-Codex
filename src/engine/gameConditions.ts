/**
 * ============================================================
 * MÓDULO 7 - Motor de Condições de Vitória/Derrota
 * ============================================================
 * Verifica as condições de fim de jogo a cada tick diário
 */

import { Country, Province, CombatResult } from '../types';

/**
 * Tipo de fim de jogo
 */
export type EndGameType = 'victory' | 'defeat' | null;

/**
 * Estatísticas da partida
 */
export interface GameStats {
  totalDays: number;
  battlesWon: number;
  battlesLost: number;
  enemyCasualties: number;
  ownCasualties: number;
  provincesControlled: number;
  totalProvinces: number;
}

/**
 * Verifica as condições de fim de jogo
 * @param playerCountry - País do jogador
 * @param allProvinces - Todas as províncias do mapa
 * @returns 'victory' | 'defeat' | null
 */
export function checkEndGameConditions(
  playerCountry: Country,
  allProvinces: Province[]
): EndGameType {
  const playerProvinces = allProvinces.filter(p => p.owner === playerCountry.tag);
  const totalProvinces = allProvinces.length;

  // VITÓRIA: Jogador controla 100% das províncias
  if (playerProvinces.length === totalProvinces) {
    return 'victory';
  }

  // DERROTA: Jogador perdeu todas as províncias
  if (playerProvinces.length === 0) {
    return 'defeat';
  }

  return null;
}

/**
 * Calcula estatísticas da partida
 * @param startDate - Data de início do jogo
 * @param currentDate - Data atual
 * @param battleHistory - Histórico de batalhas
 * @param playerCountryTag - Tag do país do jogador
 * @param allProvinces - Todas as províncias
 * @returns Estatísticas da partida
 */
export function calculateGameStats(
  startDate: GameDate,
  currentDate: GameDate,
  battleHistory: CombatResult[],
  playerCountryTag: string,
  allProvinces: Province[]
): GameStats {
  // Calcula total de dias
  const totalDays = calculateDaysBetween(startDate, currentDate);

  // Calcula batalhas vencidas/perdidas
  const battlesWon = battleHistory.filter(battle => 
    (battle.winner === 'attacker' && battle.attackerOriginal.owner === playerCountryTag) ||
    (battle.winner === 'defender' && battle.defenderOriginal.owner === playerCountryTag)
  ).length;

  const battlesLost = battleHistory.filter(battle => 
    (battle.winner === 'defender' && battle.attackerOriginal.owner === playerCountryTag) ||
    (battle.winner === 'attacker' && battle.defenderOriginal.owner === playerCountryTag)
  ).length;

  // Calcula baixas
  let enemyCasualties = 0;
  let ownCasualties = 0;

  battleHistory.forEach(battle => {
    const playerIsAttacker = battle.attackerOriginal.owner === playerCountryTag;
    
    if (playerIsAttacker) {
      ownCasualties += battle.attackerCasualties;
      enemyCasualties += battle.defenderCasualties;
    } else {
      ownCasualties += battle.defenderCasualties;
      enemyCasualties += battle.attackerCasualties;
    }
  });

  // Calcula províncias controladas
  const provincesControlled = allProvinces.filter(p => p.owner === playerCountryTag).length;
  const totalProvinces = allProvinces.length;

  return {
    totalDays,
    battlesWon,
    battlesLost,
    enemyCasualties,
    ownCasualties,
    provincesControlled,
    totalProvinces
  };
}

/**
 * Calcula dias entre duas datas
 */
function calculateDaysBetween(start: GameDate, end: GameDate): number {
  // Simplificação: cada mês tem 30 dias, cada ano tem 360 dias
  const startDays = start.year * 360 + start.month * 30 + start.day;
  const endDays = end.year * 360 + end.month * 30 + end.day;
  return endDays - startDays;
}

/**
 * Formata dias em anos/meses/dias
 */
export function formatDuration(totalDays: number): string {
  const years = Math.floor(totalDays / 360);
  const remainingDays = totalDays % 360;
  const months = Math.floor(remainingDays / 30);
  const days = remainingDays % 30;

  const parts = [];
  if (years > 0) parts.push(`${years} ano${years > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} mês${months > 1 ? 'es' : ''}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} dia${days !== 1 ? 's' : ''}`);

  return parts.join(', ');
}

/**
 * Interface para data do jogo
 */
interface GameDate {
  year: number;
  month: number;
  day: number;
}
