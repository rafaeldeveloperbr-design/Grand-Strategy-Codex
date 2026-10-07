import { canEnterTerritory, areAtWar } from '../diplomacy';
import { Army, Province } from '../../types';
import { DiplomaticRelation } from '../../types/diplomacy';

export function canMoveToProvince(
  botCountryId: string,
  targetProvinceOwner: string,
  diplomacy: DiplomaticRelation[]
): boolean {
  return canEnterTerritory(diplomacy, botCountryId, targetProvinceOwner);
}

export function isBorderProvince(
  provinceId: string,
  provinces: Province[],
  botCountryId: string
): boolean {
  const currentProv = provinces.find(p => p.id === provinceId);
  if (!currentProv || !currentProv.neighbors) return false;

  return currentProv.neighbors.some(neighborId => {
    const neighborProv = provinces.find(p => p.id === neighborId);
    return neighborProv && neighborProv.owner !== botCountryId;
  });
}

export function isAtWarWithNeighbor(
  botCountryId: string,
  currentProv: Province,
  provinces: Province[],
  diplomacy: DiplomaticRelation[]
): boolean {
  return currentProv.neighbors.some(neighborId => {
    const neighborProv = provinces.find(p => p.id === neighborId);
    if (!neighborProv || neighborProv.owner === botCountryId) return false;

    return areAtWar(diplomacy,botCountryId,neighborProv.owner);
  });
}

export function isAtWarWith(
  countryA: string,
  countryB: string,
  diplomacy: DiplomaticRelation[]
): boolean {
  return areAtWar(diplomacy, countryA, countryB);
}

export function calculateDistance(
  fromId: string,
  toId: string,
  provinces: Province[]
): number {
  if (fromId === toId) return 0;

  const visited = new Set<string>();
  const queue: Array<{ id: string; distance: number }> = [{ id: fromId, distance: 0 }];
  visited.add(fromId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.id === toId) {
      return current.distance;
    }

    const province = provinces.find(p => p.id === current.id);
    if (!province) continue;

    for (const neighborId of province.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ id: neighborId, distance: current.distance + 1 });
      }
    }
  }

  return Infinity;
}

export function findNearestEnemyArmy(
  aiArmy: Army,
  enemyArmies: Army[],
  provinces: Province[]
): Army | null {
  if (enemyArmies.length === 0 || !aiArmy.location) return null;

  let nearestEnemy: Army | null = null;
  let minDistance = Infinity;

  for (const enemyArmy of enemyArmies) {
    if (!enemyArmy.location) continue;

    const distance = calculateDistance(aiArmy.location, enemyArmy.location, provinces);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestEnemy = enemyArmy;
    }
  }

  return nearestEnemy;
}

export function findClosestHomeProvince(
  currentLocation: string,
  homeProvinces: Province[],
  allProvinces: Province[]
): Province | null {
  if (homeProvinces.length === 0) return null;

  let closestProvince: Province | null = null;
  let minDistance = Infinity;

  for (const homeProv of homeProvinces) {
    const isBorder = isBorderProvince(homeProv.id, allProvinces, homeProv.owner);
    const distance = calculateDistance(currentLocation, homeProv.id, allProvinces);
    const adjustedDistance = isBorder ? distance * 0.8 : distance;
    
    if (adjustedDistance < minDistance) {
      minDistance = adjustedDistance;
      closestProvince = homeProv;
    }
  }

  return closestProvince;
}
