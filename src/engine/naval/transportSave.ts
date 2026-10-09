import type { Army, Province, ActiveBattle } from '../../types';
import type { NavalState } from '../../types/naval';
import { buildTransportIndexes, fleetTransportCapacity, fleetTransportUsed } from './transport';

/** Cross-references checked before migration at the raw save boundary. */
export function validateTransportSave(armies: Army[], naval: NavalState, provinces: Province[], battles: ActiveBattle[] = []) {
  const fleets = new Map(naval.fleets.map(f => [f.id, f])), provinceIds = new Set(provinces.map(p => p.id)), ids = new Set<string>();
  const engaged = new Set(battles.flatMap(b => b.participantArmyIds));
  for (const army of armies) {
    if (ids.has(army.id)) throw new Error('Army duplicado no save');
    ids.add(army.id);
    if (army.embarkedFleetId !== undefined) {
      const fleet = fleets.get(army.embarkedFleetId);
      if (typeof army.embarkedFleetId !== 'string' || !fleet || fleet.countryTag !== army.owner) throw new Error('Referência Army/Fleet inválida');
      if (army.location !== null || army.destination !== null || army.targetDestination !== null || army.path.length || army.movementProgress !== 0 || army.position !== null || army.movementPlan?.waypoints.length || army.inCombat || engaged.has(army.id)) throw new Error('Army embarcado possui presença/ordem terrestre');
      if (!army.regiments.length || army.regiments.some(r => !Number.isFinite(r.strength) || r.strength <= 0)) throw new Error('Tropas embarcadas inválidas');
    }
  }
  const cargo = buildTransportIndexes(armies);
  for (const [id, bucket] of cargo.byFleet) if (fleetTransportUsed(bucket) > fleetTransportCapacity(fleets.get(id)!)) throw new Error('Capacidade de transporte inválida no save');
  for (const order of naval.invasions ?? []) {
    if (!provinceIds.has(order.targetProvinceId)) throw new Error('Alvo de invasão inexistente');
    if (order.armyIds.some(id => cargo.byId.get(id)?.embarkedFleetId !== order.fleetId)) throw new Error('Army de invasão inválido');
  }
  for (const fleet of naval.fleets) if ('embarkedArmyIds' in fleet) throw new Error('Save contém associação Army/Fleet duplicada; use embarkedFleetId');
}
