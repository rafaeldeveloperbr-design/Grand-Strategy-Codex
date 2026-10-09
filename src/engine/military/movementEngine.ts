import { canEnterTerritory } from '../diplomacy';
import { getTerrainDefinition } from '../terrain';
import { Army, Province } from '../../types';
import { DiplomaticRelation } from '../../types/diplomacy';
import { calculateArmySpeed, generateArmyId } from './militaryUtils';
import { getArmySupply } from './supplyEngine';
import type { LogisticsSnapshot } from '../logistics';

export function canMoveToProvince(
  armyCountryId: string,
  targetProvinceOwner: string,
  diplomacy: DiplomaticRelation[]
): boolean {
  return canEnterTerritory(diplomacy, armyCountryId, targetProvinceOwner);
}

export function stopArmyMovement(army: Army): Army {
  if ((army.inCombat || !!army.retreatProtectionDays)) {
    console.log(`⚠️ Exército ${army.id} está em combate - não pode cancelar movimento`);
    return army;
  }

  if (!army.destination || army.path.length === 0) {
    return army;
  }

  console.log(`🛑 Cancelando movimento do exército ${army.id} em ${army.location}`);

  return {
    ...army,
    destination: null,
    targetDestination: null,
    path: [],
    movementProgress: 0,
    position: null,
  };
}

export function findPath(
  startId: string, endId: string, provinces: Province[], ownerTag: string,
  diplomacy: DiplomaticRelation[]
): string[] {
  const index = new Map(provinces.map(province => [province.id, province]));
  if (startId === endId || !index.has(startId) || !index.has(endId)) return [];
  const queue = [startId], visited = new Set([startId]);
  const parent = new Map<string, string>();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    if (current === endId) {
      const path: string[] = [];
      for (let node = endId; node !== startId; node = parent.get(node)!) path.push(node);
      return path.reverse();
    }
    for (const neighbor of index.get(current)!.neighbors) {
      const province = index.get(neighbor);
      if (!province || visited.has(neighbor) || !canMoveToProvince(ownerTag, province.owner, diplomacy)) continue;
      visited.add(neighbor); parent.set(neighbor, current); queue.push(neighbor);
    }
  }
  return [];
}

export function moveArmy(
  army: Army,
  destinationId: string,
  provinces: Province[],
  diplomacy: DiplomaticRelation[]
): Army | null {
  if (army.embarkedFleetId || !army.location || (army.inCombat || !!army.retreatProtectionDays) || army.location === destinationId) return null;
  if (army.destination) return null;

  const originProvince = provinces.find((p) => p.id === army.location);
  if (!originProvince) return null;

  const destinationProvince = provinces.find((p) => p.id === destinationId);
  if (!destinationProvince) return null;

  if (!canMoveToProvince(army.owner, destinationProvince.owner, diplomacy)) {
    return null;
  }

  if (originProvince.neighbors.includes(destinationId)) {
    if (!canMoveToProvince(army.owner, destinationProvince.owner, diplomacy)) {
      return null;
    }

    return {
      ...army,
      beachExtraction: undefined,
      destination: destinationId,
      targetDestination: destinationId,
      movementProgress: 0,
      movementSpeed: calculateArmySpeed(army),
      path: [destinationId],
    };
  }

  const path = findPath(army.location, destinationId, provinces, army.owner, diplomacy);
  if (path.length === 0) {
    return null;
  }

  const nextDestination = path[0];

  return {
    ...army,
    beachExtraction: undefined,
    destination: nextDestination,
    targetDestination: destinationId,
    movementProgress: 0,
    movementSpeed: calculateArmySpeed(army),
    path,
  };
}

export function processArmyMovement(
  armies: Army[], provinces: Province[], diplomacy: DiplomaticRelation[], logistics?: LogisticsSnapshot
): { updatedArmies: Army[]; arrivedArmies: Army[]; updatedProvinces: Province[] } {
  const index = new Map(provinces.map(province => [province.id, province]));
  const colocated = new Map<string, Army[]>();
  for (const army of armies) {
    if (!army.location) continue;
    const group = colocated.get(army.location) ?? [];
    group.push(army); colocated.set(army.location, group);
  }
  const arrivedArmies: Army[] = [], updatedArmies: Army[] = [];
  const cancel = (army: Army): Army => ({ ...army, destination: null, targetDestination: null, path: [], movementProgress: 0, position: null });
  for (const army of armies) {
    if (army.embarkedFleetId || (army.inCombat || !!army.retreatProtectionDays) || !army.destination) { updatedArmies.push(army); continue; }
    const origin = army.location ? index.get(army.location) : undefined;
    const next = index.get(army.destination);
    const route = army.path.length ? army.path : [army.destination];
    let previous = origin;
    const validRoute = route[0] === army.destination && route.every(id => {
      const province = index.get(id);
      // Civil-war access is locally synthesized by rebel planning; preserve it at execution.
      const rebelAccess = province && army.rebellionFactionId && army.originalOwner &&
        (province.owner === army.originalOwner || (province.owner.startsWith('rebel_v2_') && province.originalOwner === army.originalOwner));
      const allowed = previous && province && previous.neighbors.includes(id) &&
        (rebelAccess || canMoveToProvince(army.owner, province.owner, diplomacy));
      previous = province;
      return !!allowed;
    });
    if (!origin || !next || !validRoute) {
      updatedArmies.push(cancel(army)); continue;
    }
    const progress = army.movementProgress + army.movementSpeed *
      getArmySupply(army, origin, colocated.get(origin.id), logistics).movementMultiplier / getTerrainDefinition(next).movementCost;
    if (progress < 1) {
      updatedArmies.push({ ...army, movementProgress: progress, position: {
        x: origin.center.x + (next.center.x - origin.center.x) * progress,
        y: origin.center.y + (next.center.y - origin.center.y) * progress,
      } });
      continue;
    }
    const remaining = army.path[0] === next.id ? army.path.slice(1) : [];
    // Every crossing is an arrival, so occupation and combat run before continuing.
    arrivedArmies.push({ ...army, location: next.id, destination: remaining[0] ?? null,
      targetDestination: remaining.length ? army.targetDestination : null,
      path: remaining, movementProgress: 0, position: null });
  }
  return { updatedArmies, arrivedArmies, updatedProvinces: provinces };
}

export function mergeArmies(army1: Army, army2: Army): Army {
  const mergedRegiments = [...army1.regiments, ...army2.regiments];

  return {
    ...army1,
    regiments: mergedRegiments,
    recentDefeat: (army2.recentDefeat?.daysRemaining ?? 0) > (army1.recentDefeat?.daysRemaining ?? 0) ? army2.recentDefeat : army1.recentDefeat,
    movementSpeed: calculateArmySpeed({ ...army1, regiments: mergedRegiments }),
  };
}

export function splitArmy(
  sourceArmy: Army,
  regimentsToTransfer: number[],
  newName: string,
  existingIds: readonly string[] = []
): Army | null {
  if (new Set(regimentsToTransfer).size !== regimentsToTransfer.length || regimentsToTransfer.some(index => !Number.isInteger(index))) return null;
  if (regimentsToTransfer.length === 0) return null;
  if (regimentsToTransfer.length >= sourceArmy.regiments.length) return null;

  for (const idx of regimentsToTransfer) {
    if (idx < 0 || idx >= sourceArmy.regiments.length) return null;
  }

  const transferredRegiments = sourceArmy.regiments.filter((_, index) => regimentsToTransfer.includes(index)).map(regiment => ({ ...regiment }));

  const newArmy: Army = {
    id: generateArmyId(existingIds),
    owner: sourceArmy.owner,
    recentDefeat: sourceArmy.recentDefeat ? { ...sourceArmy.recentDefeat } : undefined,
    rebellionFactionId: sourceArmy.rebellionFactionId,
    originalOwner: sourceArmy.originalOwner,
    separatistMode: sourceArmy.separatistMode,
    name: newName,
    regiments: transferredRegiments,
    inCombat: false,
    location: sourceArmy.location,
    destination: null,
    targetDestination: null,
    movementProgress: 0,
    movementSpeed: calculateArmySpeed({ ...sourceArmy, regiments: transferredRegiments }),
    position: null,
    path: [],
  };

  return newArmy;
}

export function splitArmyHalf(sourceArmy: Army, newName: string): Army | null {
  if (sourceArmy.regiments.length < 2) return null;

  const halfIndex = Math.floor(sourceArmy.regiments.length / 2);
  const indicesToTransfer = Array.from({ length: halfIndex }, (_, i) => i);

  return splitArmy(sourceArmy, indicesToTransfer, newName);
}
