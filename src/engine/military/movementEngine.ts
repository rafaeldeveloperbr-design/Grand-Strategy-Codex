import { Army, Province } from '../../types';
import { DiplomaticRelation } from '../../types/diplomacy';
import { calculateArmySpeed, generateArmyId } from './militaryUtils';
import { getArmySupply } from './supplyEngine';

export function canMoveToProvince(
  armyCountryId: string,
  targetProvinceOwner: string,
  diplomacy: DiplomaticRelation[]
): boolean {
  if (targetProvinceOwner === armyCountryId) {
    return true;
  }

  if (!diplomacy || diplomacy.length === 0) {
    return false;
  }

  const relation = diplomacy.find(
    (r) =>
      (r.countryA === armyCountryId && r.countryB === targetProvinceOwner) ||
      (r.countryA === targetProvinceOwner && r.countryB === armyCountryId)
  );

  if (!relation) {
    return false;
  }

  return relation.status === 'war' || relation.opinion >= 80;
}

export function stopArmyMovement(army: Army): Army {
  if (army.inCombat) {
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
  startId: string,
  endId: string,
  provinces: Province[],
  ownerTag: string,
  diplomacy: DiplomaticRelation[]
): string[] {
  if (startId === endId) return [];

  const adjacencyMap = new Map<string, string[]>();
  for (const province of provinces) {
    adjacencyMap.set(province.id, province.neighbors || []);
  }

  const queue: string[] = [startId];
  const visited = new Set<string>([startId]);
  const parent = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current === endId) {
      const path: string[] = [];
      let node: string | undefined = endId;
      while (node && node !== startId) {
        path.unshift(node);
        node = parent.get(node);
      }
      return path;
    }

    const neighbors = adjacencyMap.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;

      const neighborProvince = provinces.find((p) => p.id === neighbor);
      if (!neighborProvince) continue;

      const isAllowed = canMoveToProvince(ownerTag, neighborProvince.owner, diplomacy);

      if (isAllowed) {
        visited.add(neighbor);
        parent.set(neighbor, current);
        queue.push(neighbor);
      }
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
  if (!army.location) return null;
  if (army.destination) return null;

  const originProvince = provinces.find((p) => p.id === army.location);
  if (!originProvince) return null;

  const destinationProvince = provinces.find((p) => p.id === destinationId);
  if (!destinationProvince) return null;

  if (!canMoveToProvince(army.owner, destinationProvince.owner, diplomacy)) {
    console.log('❌ Movimento não permitido: sem relação de guerra ou aliança com', destinationProvince.owner);
    return null;
  }

  if (originProvince.neighbors.includes(destinationId)) {
    if (!canMoveToProvince(army.owner, destinationProvince.owner, diplomacy)) {
      console.log(`❌ Movimento não permitido para vizinho ${destinationProvince.name} (${destinationProvince.owner}): sem relação de guerra ou aliança`);
      return null;
    }

    return {
      ...army,
      destination: destinationId,
      targetDestination: destinationId,
      movementProgress: 0,
      movementSpeed: calculateArmySpeed(army),
      path: [destinationId],
    };
  }

  console.log('🗺️ Calculando pathfinding:', { from: army.location, to: destinationId, owner: army.owner });
  const path = findPath(army.location, destinationId, provinces, army.owner, diplomacy);
  console.log('🗺️ Caminho encontrado:', path);
  if (path.length === 0) {
    console.log('❌ Caminho não encontrado');
    return null;
  }

  const nextDestination = path[0];

  return {
    ...army,
    destination: nextDestination,
    targetDestination: destinationId,
    movementProgress: 0,
    movementSpeed: calculateArmySpeed(army),
    path,
  };
}

export function processArmyMovement(
  armies: Army[],
  provinces: Province[],
  diplomacy: DiplomaticRelation[]
): { updatedArmies: Army[]; arrivedArmies: Army[]; updatedProvinces: Province[] } {
  void diplomacy;
  const arrivedArmies: Army[] = [];

  const updatedArmies = armies.map((army) => {
    if (army.inCombat) {
      return army;
    }

    if (!army.destination) {
      return army;
    }

    const currentProvince = provinces.find(province => province.id === army.location);
    const colocated = armies.filter(item => item.location === army.location && item.owner === army.owner);
    const nextProgress = army.movementProgress + army.movementSpeed * getArmySupply(army, currentProvince, colocated).movementMultiplier;

    if (nextProgress < 1.0) {
      const originProvince = provinces.find((p) => p.id === army.location);
      const destProvince = provinces.find((p) => p.id === army.destination);

      let position = null;
      if (originProvince && destProvince) {
        position = {
          x: originProvince.center.x + (destProvince.center.x - originProvince.center.x) * nextProgress,
          y: originProvince.center.y + (destProvince.center.y - originProvince.center.y) * nextProgress,
        };
      }

      return {
        ...army,
        movementProgress: nextProgress,
        position,
      };
    }

    const reachedProvinceId = army.destination;
    const reachedProvince = provinces.find((p) => p.id === reachedProvinceId);

    if (!reachedProvince) {
      return {
        ...army,
        location: reachedProvinceId,
        destination: null,
        targetDestination: null,
        movementProgress: 0,
        position: null,
        path: [],
      };
    }

    const enemyArmiesInProvince = armies.filter(
      (a) => a.id !== army.id && a.location === reachedProvinceId && a.owner !== army.owner
    );

    if (enemyArmiesInProvince.length > 0) {
      return {
        ...army,
        location: reachedProvinceId,
        destination: null,
        targetDestination: null,
        movementProgress: 0,
        position: null,
        path: [],
      };
    }

    if (army.path.length > 0) {
      const remainingPath = army.path.slice(1);

      if (remainingPath.length > 0) {
        return {
          ...army,
          location: reachedProvinceId,
          destination: remainingPath[0],
          movementProgress: 0,
          position: null,
          path: remainingPath,
        };
      }
    }

    const arrivedArmy: Army = {
      ...army,
      location: reachedProvinceId,
      destination: null,
      targetDestination: null,
      movementProgress: 0,
      position: null,
      path: [],
    };

    arrivedArmies.push(arrivedArmy);
    return arrivedArmy;
  });

  const movingArmies = updatedArmies.filter((army) => {
    const hasArrived = arrivedArmies.some((a) => a.id === army.id);
    return !hasArrived;
  });

  // Territory is deliberately not mutated here. Arrival processing validates
  // the war/rebel rules and delegates ownership changes to transferProvince.
  return { updatedArmies: movingArmies, arrivedArmies, updatedProvinces: provinces };
}

export function mergeArmies(army1: Army, army2: Army): Army {
  const mergedRegiments = [...army1.regiments, ...army2.regiments];

  return {
    ...army1,
    regiments: mergedRegiments,
    movementSpeed: calculateArmySpeed({ ...army1, regiments: mergedRegiments }),
  };
}

export function splitArmy(
  sourceArmy: Army,
  regimentsToTransfer: number[],
  newName: string
): Army | null {
  if (regimentsToTransfer.length === 0) return null;
  if (regimentsToTransfer.length >= sourceArmy.regiments.length) return null;

  for (const idx of regimentsToTransfer) {
    if (idx < 0 || idx >= sourceArmy.regiments.length) return null;
  }

  const transferredRegiments = regimentsToTransfer.map((idx) => ({ ...sourceArmy.regiments[idx] }));

  const newArmy: Army = {
    id: generateArmyId(),
    owner: sourceArmy.owner,
    name: newName,
    regiments: transferredRegiments,
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
