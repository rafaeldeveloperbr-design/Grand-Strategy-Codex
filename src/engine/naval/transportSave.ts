import type { Army, Province, ActiveBattle } from '../../types';
import type { NavalState } from '../../types/naval';
import { AMPHIBIOUS_BEACH_EXTRACTION_DAYS } from './beachExtraction';
import { portByProvince, resolveAmphibiousLandingSeaNode } from './world';
import { buildTransportIndexes, fleetTransportCapacity, fleetTransportUsed } from './transport';

/** Cross-references checked before migration at the raw save boundary. */
export function validateTransportSave(armies: Army[], naval: NavalState, provinces: Province[], battles: ActiveBattle[] = []) {
  const fleets = new Map(naval.fleets.map(f => [f.id, f])), provinceIds = new Set(provinces.map(p => p.id)), ids = new Set<string>();
  const engaged = new Set(battles.flatMap(b => b.participantArmyIds));
  for (const army of armies) {
    if (ids.has(army.id)) throw new Error('Army duplicado no save');
    ids.add(army.id);
    if (army.beachExtraction !== undefined) {
      const order = army.beachExtraction;
      if (!order || typeof order !== 'object' || typeof order.fleetId !== 'string' || typeof order.provinceId !== 'string' || typeof order.seaNodeId !== 'string' || !Number.isInteger(order.elapsedDays) || order.elapsedDays < 0 || order.elapsedDays >= AMPHIBIOUS_BEACH_EXTRACTION_DAYS) throw new Error('Beach extraction metadata invalid');
      const fleet = fleets.get(order.fleetId);
      if (!fleet || fleet.countryTag !== army.owner || fleet.status !== 'HOLDING' || fleet.locationSeaNodeId !== order.seaNodeId || fleet.portProvinceId || fleet.movementProgress !== 0 || fleet.route.length || naval.invasions?.some(o => o.fleetId === fleet.id)) throw new Error('Beach extraction Fleet invalid');
      if (!provinceIds.has(order.provinceId) || portByProvince.has(order.provinceId) || resolveAmphibiousLandingSeaNode(order.provinceId)?.id !== order.seaNodeId || army.location !== order.provinceId) throw new Error('Beach extraction coast invalid');
      if (army.embarkedFleetId !== undefined || army.inCombat || army.retreatProtectionDays || engaged.has(army.id) || army.destination || army.targetDestination || army.path.length || army.movementProgress !== 0 || army.position || army.movementPlan?.waypoints.length || !army.regiments.length || army.regiments.some(r => !Number.isFinite(r.strength) || r.strength <= 0)) throw new Error('Beach extraction Army invalid');
    }
    if (army.embarkedFleetId !== undefined) {
      const fleet = fleets.get(army.embarkedFleetId);
      if (typeof army.embarkedFleetId !== 'string' || !fleet || fleet.countryTag !== army.owner) throw new Error('Referência Army/Fleet inválida');
      if (army.location !== null || army.destination !== null || army.targetDestination !== null || army.path.length || army.movementProgress !== 0 || army.position !== null || army.movementPlan?.waypoints.length || army.inCombat || engaged.has(army.id)) throw new Error('Army embarcado possui presença/ordem terrestre');
      if (!army.regiments.length || army.regiments.some(r => !Number.isFinite(r.strength) || r.strength <= 0)) throw new Error('Tropas embarcadas inválidas');
    }
  }
  const cargo = buildTransportIndexes(armies);
  for (const [id, bucket] of cargo.byFleet) if (fleetTransportUsed(bucket) > fleetTransportCapacity(fleets.get(id)!)) throw new Error('Capacidade de transporte inválida no save');
  for (const [id, bucket] of cargo.extractionsByFleet) if (fleetTransportUsed(bucket) + fleetTransportUsed(cargo.byFleet.get(id) ?? []) > fleetTransportCapacity(fleets.get(id)!)) throw new Error('Beach extraction reservations exceed capacity');
  for (const order of naval.invasions ?? []) {
    if (!provinceIds.has(order.targetProvinceId)) throw new Error('Alvo de invasão inexistente');
    if (order.armyIds.some(id => cargo.byId.get(id)?.embarkedFleetId !== order.fleetId)) throw new Error('Army de invasão inválido');
  }
  for (const fleet of naval.fleets) if ('embarkedArmyIds' in fleet) throw new Error('Save contém associação Army/Fleet duplicada; use embarkedFleetId');
}
