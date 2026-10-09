import type { Army, CombatResult, SupplyStatus, UnitType } from '../types';
import { getUnitName } from '../utils/translations';

export function armyComposition(armies: readonly Army[]) {
  const amounts = new Map<UnitType, number>();
  for (const army of armies) for (const r of army.regiments) amounts.set(r.type, (amounts.get(r.type) ?? 0) + Math.max(0, r.strength));
  return [...amounts].map(([type, troops]) => ({ type, name: getUnitName(type), troops }));
}
export const compositionText = (armies: readonly Army[]) => armyComposition(armies).map(r => `${r.name} ${Math.round(r.troops).toLocaleString('pt-BR')}`).join(' · ');
export const supplyLabel = (status: SupplyStatus) => ({ good: 'Adequado', low: 'Baixo', critical: 'Crítico' })[status];
export const armyStatus = (army: Army, supply?: SupplyStatus) => army.inCombat ? 'Em batalha' : army.destination ? 'Em movimento' : army.targetDestination && !army.path.length ? 'Sem rota' : supply === 'low' || supply === 'critical' ? 'Baixo supply' : 'Parado';
export function groupMovementFeedback(moved: number, destination: string, failures: Array<{ name: string; reason: string }>) {
  const success = `${moved} ${moved === 1 ? 'exército recebeu' : 'exércitos receberam'} ordem para ${destination}.`;
  return failures.length ? `${success} ${failures.length} falharam: ${failures.map(f => `${f.name} (${f.reason})`).join('; ')}.` : success;
}
export function battleEndFeedback(result: CombatResult, player: string, conquered = false) {
  if (result.endReason === 'hostility_ended' || result.endReason === 'territory_invalid') return `Combate encerrado em ${result.provinceName}.`;
  const side = result.participantDetails?.find(participant => participant.owner === player)?.side;
  const attacking = side ? side === 'attacker' : result.attackerOriginal.owner === player;
  const won = result.winner === (attacking ? 'attacker' : 'defender');
  const own = attacking ? result.attackerCasualties : result.defenderCasualties;
  const enemy = attacking ? result.defenderCasualties : result.attackerCasualties;
  const playerRetreated = result.participantDetails?.some(participant => participant.owner === player && result.retreatOutcomes?.[participant.id]?.reason === 'retreat');
  const retreat = result.retreatInfo?.retreated ? (playerRetreated || result.retreatInfo.owner === player ? ' Suas tropas recuaram.' : ' O inimigo recuou.') : '';
  return `${won ? 'Vitória' : 'Derrota'} em ${result.provinceName}: ${Math.round(own).toLocaleString('pt-BR')} baixas aliadas / ${Math.round(enemy).toLocaleString('pt-BR')} inimigas.${conquered ? ' Província conquistada.' : ''}${retreat}`;
}
