import type { Fleet, NavalBattle, NavalBattleParticipantSnapshot, NavalShipComposition, NavalUnitType } from '../../types/naval';

export function shipComposition(fleet?: Fleet): NavalShipComposition {
  const counts: NavalShipComposition = {};
  for (const unit of fleet?.units ?? []) if (unit.strength > 0) counts[unit.type] = (counts[unit.type] ?? 0) + 1;
  return counts;
}

export function captureNavalParticipants(battle: NavalBattle, fleets: ReadonlyMap<string, Fleet>) {
  battle.participantSnapshots ??= { A: [], B: [] };
  for (const side of ['A', 'B'] as const) {
    const snapshots = battle.participantSnapshots[side];
    for (const id of side === 'A' ? battle.sideA : battle.sideB) {
      const fleet = fleets.get(id);
      if (!fleet || snapshots.some(p => p.fleetId === id)) continue;
      const initialShips = shipComposition(fleet);
      snapshots.push({ fleetId: id, fleetName: fleet.name, countryTag: fleet.countryTag, initialShips, finalShips: { ...initialShips }, lostShips: Object.fromEntries(Object.keys(initialShips).map(type => [type, 0])) });
    }
    snapshots.sort((a, b) => a.fleetId.localeCompare(b.fleetId));
  }
}

export function updateNavalParticipants(battle: NavalBattle, fleets: ReadonlyMap<string, Fleet>) {
  for (const participant of [...(battle.participantSnapshots?.A ?? []), ...(battle.participantSnapshots?.B ?? [])]) {
    participant.finalShips = shipComposition(fleets.get(participant.fleetId));
    for (const type of Object.keys(participant.initialShips) as NavalUnitType[]) participant.lostShips[type] = Math.max(0, (participant.initialShips[type] ?? 0) - (participant.finalShips[type] ?? 0));
  }
}

export function navalParticipants(battle: NavalBattle, side: 'A' | 'B', fleets: readonly Fleet[] = []): NavalBattleParticipantSnapshot[] {
  const snapshots = battle.participantSnapshots?.[side];
  const ids = [...new Set([...(snapshots?.map(p => p.fleetId) ?? []), ...(side === 'A' ? battle.sideA : battle.sideB)])];
  return ids.map(id => {
    const snapshot = snapshots?.find(p => p.fleetId === id);
    if (snapshot) return snapshot;
    const fleet = fleets.find(f => f.id === id);
    return { fleetId: id, fleetName: fleet?.name ?? `${id} · destruída`, countryTag: fleet?.countryTag ?? '', initialShips: {}, finalShips: shipComposition(fleet), lostShips: {} };
  });
}

export function endedPlayerNavalBattles(battles: readonly NavalBattle[], previous: ReadonlyMap<string, NavalBattle['status']>, player: string, fleets: readonly Fleet[]) {
  return battles.filter(b => b.status === 'ENDED' && previous.get(b.id) !== 'ENDED' && (['A', 'B'] as const).some(side => navalParticipants(b, side, fleets).some(p => p.countryTag === player)));
}

export function enqueueNavalReports(queue: NavalBattle[], reports: NavalBattle[]) {
  const ids = new Set(queue.map(b => b.id));
  return [...queue, ...reports.filter(b => { if (ids.has(b.id)) return false; ids.add(b.id); return true; })];
}
