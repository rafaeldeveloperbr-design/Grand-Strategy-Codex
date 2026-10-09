import type { Army, Province, DiplomaticRelation } from '../../types';
import { issueMoveCommand, appendWaypoint, clearMovementPlan } from '../../engine/military';

/** UI command adapter: every independent army uses the existing movement API. */
export function orderArmyGroup(ids: readonly string[], armies: Army[], owner: string, destination: string, provinces: Province[], relations: DiplomaticRelation[], command: 'move' | 'append' | 'clear' = 'move') {
  const updates = new Map<string, Army>();
  const failures: Array<{ name: string; reason: string }> = [];
  for (const id of new Set(ids)) {
    const army = armies.find(a => a.id === id);
    if (!army || army.owner !== owner) continue;
    if (army.embarkedFleetId) { failures.push({ name: army.name, reason: 'Army embarcado não recebe ordem terrestre' }); continue; }
    const moved = command === 'clear' ? clearMovementPlan(army) : command === 'append' ? appendWaypoint(army, destination, provinces, relations) : issueMoveCommand(army, destination, provinces, relations);
    if (moved) updates.set(id, moved);
    else failures.push({ name: army.name, reason: !provinces.some(p => p.id === destination) ? 'destino inválido' : army.inCombat ? 'em batalha' : army.location === destination ? 'já está no destino' : 'sem rota ou acesso válido' });
  }
  return { armies: armies.map(a => updates.get(a.id) ?? a), updates, failures };
}
