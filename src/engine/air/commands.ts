import type { AirMission, AirState, AirWing } from '../../types/air';
import { AIRCRAFT_TYPES } from '../../data/aircraft';
import { airBaseByProvinceId, airZoneByProvinceId } from './world';
import { assignAirMission, canUseAirBase, isAirZoneInRange, rebaseAirWing, type AirContext } from './index';
import { airBaseOccupancy } from './production';

export type AirTargetCommand = { wingId: string; kind: 'MISSION'; mission: AirMission } | { wingId: string; kind: 'REBASE' };
export const AIR_MISSION_LABELS: Record<AirMission, string> = { AIR_SUPERIORITY: 'Air Superiority', INTERCEPTION: 'Interception', CLOSE_AIR_SUPPORT: 'Close Air Support', BOMBING: 'Bombing' };
export function canStartAirTarget(wing: AirWing, actor: string, mission?: AirMission): boolean {
  return wing.countryTag === actor && wing.status !== 'REBASING' && (!mission || AIRCRAFT_TYPES[wing.type].missions.includes(mission));
}
/** Same validation/dispatch for left/right clicks; province resolves zone only for missions. */
export function resolveAirTarget(state: AirState, command: AirTargetCommand, provinceId: string, actor: string, ctx: AirContext): { wing?: AirWing; error: string | null; message?: string } {
  const wing = state.wings.find(w => w.id === command.wingId);
  if (!wing || wing.countryTag !== actor) return { error: 'Selecione uma AirWing própria.' };
  if (wing.status === 'REBASING') return { error: 'AirWing já está em rebase.' };
  if (command.kind === 'MISSION') {
    if (!AIRCRAFT_TYPES[wing.type].missions.includes(command.mission)) return { error: 'Missão incompatível com esta AirWing.' };
    const zone = airZoneByProvinceId.get(provinceId);
    if (!zone) return { error: 'Província sem região aérea válida.' };
    if (!isAirZoneInRange(wing, zone.id, ctx.provinces)) return { error: 'AirZone fora do alcance desta AirWing.' };
    const updated = assignAirMission(wing, command.mission, zone.id, ctx);
    return updated ? { wing: updated, error: null, message: `${AIR_MISSION_LABELS[command.mission]} atribuída: ${zone.name}.` } : { error: 'AirBase atual sem acesso.' };
  }
  const base = airBaseByProvinceId.get(provinceId);
  if (!base || !ctx.provinces.some(p => p.id === provinceId)) return { error: 'Esta província não possui AirBase.' };
  if (provinceId === wing.baseProvinceId) return { error: 'AirWing já está nesta AirBase.' };
  if (!canUseAirBase(actor, provinceId, ctx)) return { error: 'Sem acesso à AirBase: requer controle, aliança ou acesso militar.' };
  if (airBaseOccupancy(state, provinceId) >= base.capacity) return { error: 'AirBase sem capacidade disponível (inclui reservas de rebase).' };
  const updated = rebaseAirWing(wing, provinceId, state, ctx);
  return updated ? { wing: updated, error: null, message: `Rebase iniciado: ${updated.rebase!.totalDays} dias.` } : { error: 'Rebase indisponível nesta AirBase.' };
}
