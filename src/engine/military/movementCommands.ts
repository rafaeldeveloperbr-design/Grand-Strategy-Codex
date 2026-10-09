import type { Army, Province, DiplomaticRelation } from '../../types';
import { moveArmy } from './movementEngine';

/** O(1), preserves the existing route/progress for equivalent orders. */
export function hasEquivalentMovementOrder(army: Army, destination: string): boolean {
  return army.destination === destination || army.targetDestination === destination
    || army.path[army.path.length - 1] === destination || army.targetProvinceId === destination;
}

/** Clearing a plan never changes location, troops, battle or retreat state. */
export function clearMovementPlan(army: Army): Army {
  return { ...army, beachExtraction: undefined, movementPlan: undefined, destination: null, targetDestination: null, path: [], movementProgress: 0, position: null };
}

export function issueMoveCommand(army: Army, destination: string, provinces: Province[], relations: DiplomaticRelation[]): Army | null {
  if ((army.inCombat || !!army.retreatProtectionDays)) return null;
  if (hasEquivalentMovementOrder(army, destination)) return army;
  return moveArmy(clearMovementPlan(army), destination, provinces, relations);
}

export function appendWaypoint(army: Army, waypoint: string, provinces: Province[], relations: DiplomaticRelation[]): Army | null {
  if ((army.inCombat || !!army.retreatProtectionDays) || !army.location || !army.regiments.some(r => r.strength > 0)) return null;
  const pending = army.movementPlan?.waypoints ?? [];
  const active = army.targetDestination ?? army.destination;
  const start = pending[pending.length - 1] ?? active ?? army.location;
  // Validate just this planned segment with the same API as an ordinary order.
  const probe = moveArmy({ ...clearMovementPlan(army), location: start }, waypoint, provinces, relations);
  if (!probe) return null;
  const waypoints = [...(pending.length ? pending : active ? [active] : []), waypoint];
  if (army.destination || pending.length) return { ...army, beachExtraction: undefined, movementPlan: { waypoints } };
  const moved = moveArmy(army, waypoint, provinces, relations);
  return moved ? { ...moved, movementPlan: { waypoints } } : null;
}

export interface MovementPlanInterruption { armyId: string; owner: string; name: string; waypoint: string }

/** Called before ordinary movement: arrivals/battles were resolved on the preceding tick. */
export function advanceMovementPlans(armies: Army[], provinces: Province[], relations: DiplomaticRelation[]) {
  const interruptions: MovementPlanInterruption[] = [];
  const updatedArmies = armies.map(army => {
    if (!army.movementPlan?.waypoints.length) return army;
    if (!army.regiments.some(r => r.strength > 0)) return clearMovementPlan(army);
    if ((army.inCombat || !!army.retreatProtectionDays) || army.destination) return army;
    const waypoints = [...army.movementPlan.waypoints];
    while (waypoints.length && waypoints[0] === army.location) waypoints.shift();
    if (!waypoints.length) return { ...army, movementPlan: undefined };
    const moved = moveArmy(clearMovementPlan(army), waypoints[0], provinces, relations);
    if (moved) return { ...moved, movementPlan: { waypoints } };
    interruptions.push({ armyId: army.id, owner: army.owner, name: army.name, waypoint: waypoints[0] });
    return clearMovementPlan(army);
  });
  return { armies: updatedArmies, interruptions };
}
