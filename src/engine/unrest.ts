/** Compatibility entry points; all Rebellion V2 rules live in rebellion/. */
import type { Army, GameDate, Province } from '../types';
import { REBELLION_BALANCE, calculateRebellionStrength, normalizeRebellion, processProvincialPressure, rebellionDay, rebellionEconomicImpact, unrestBand } from './rebellion';
export const UNREST_BALANCE = {
  INITIAL_UNREST_ON_CONQUEST: REBELLION_BALANCE.conquestInitial,
  MIN_REBEL_SIZE: REBELLION_BALANCE.minTroops,
  MAX_REBEL_SIZE: REBELLION_BALANCE.maxTroops,
};
export function calculateRebelArmySize(province: Province): number { return calculateRebellionStrength([province], 'peasants'); }
export function processDailyUnrestDecay(provinces: Province[], date: GameDate, armies: Army[]) { return processProvincialPressure(provinces, date, armies); }
export function applyConquestUnrest(province: Province, date: GameDate): Province {
  // Rebel occupation must not restart conquest timers or overwrite historical pressure.
  if (province.owner.startsWith('rebel_')) return province;
  return { ...province, unrest: Math.max(province.unrest ?? 0, REBELLION_BALANCE.conquestInitial), lastConquestDate: rebellionDay(date),
    rebellion: { ...normalizeRebellion(province.rebellion), progress: 0, factionId: undefined } };
}
export function isProvincePacified(province: Province): boolean { return (province.unrest ?? 0) < REBELLION_BALANCE.bands[0] && (province.rebellion?.progress ?? 0) === 0 && !province.rebellion?.factionId; }
export function getUnrestDescription(unrest: number): string { return ['Estável', 'Tensão', 'Agitação', 'Revolta iminente', 'Crítico'][unrestBand(unrest)]; }
export function getUnrestColor(unrest: number): string { return ['#2ecc71', '#95a5a6', '#f39c12', '#e67e22', '#e74c3c'][unrestBand(unrest)]; }
export const calculateUnrestEconomicImpact = rebellionEconomicImpact;
