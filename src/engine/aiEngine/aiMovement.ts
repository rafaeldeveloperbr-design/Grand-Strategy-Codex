import { Army, Province } from '../../types';
import { DiplomaticRelation, War } from '../../types/diplomacy';
import { findPath } from '../military';
import { calculateArmyBasePower } from '../combat';
import {
  canMoveToProvince,
  isBorderProvince,
  isAtWarWithNeighbor,
  isAtWarWith,
  findNearestEnemyArmy,
  findClosestHomeProvince
} from './aiHelpers';

function createArmyWithRoute(
  army: Army,
  destinationId: string,
  provinces: Province[],
  botCountryId: string,
  diplomacy: DiplomaticRelation[]
): Army {
  const destProv = provinces.find(p => p.id === destinationId);
  if (destProv && !canMoveToProvince(botCountryId, destProv.owner, diplomacy)) {
    return army;
  }

  const currentProv = provinces.find(p => p.id === army.location);
  if (currentProv && currentProv.neighbors.includes(destinationId)) {
    return {
      ...army,
      destination: destinationId,
      targetDestination: destinationId,
      movementProgress: 0,
      path: [destinationId],
    };
  }

  const path = findPath(army.location!, destinationId, provinces, botCountryId, diplomacy);
  
  if (path.length === 0) {
    return army;
  }

  return {
    ...army,
    destination: path[0],
    targetDestination: destinationId,
    movementProgress: 0,
    path: path,
  };
}

export function processAI(
  botCountryId: string,
  armies: Army[],
  provinces: Province[],
  diplomacy: DiplomaticRelation[],
  wars: War[] = []
): Army[] {
  if (!botCountryId || !Array.isArray(armies) || !Array.isArray(provinces) || !Array.isArray(diplomacy)) {
    return armies;
  }

  return armies.map(army => {
    if (army.owner !== botCountryId || army.destination !== null) {
      return army;
    }

    const currentProv = provinces.find(p => p.id === army.location);
    if (!currentProv || !currentProv.neighbors || currentProv.neighbors.length === 0) {
      return army;
    }

    const isAtWar = isAtWarWithNeighbor(botCountryId, currentProv, provinces, diplomacy);

    if (isAtWar) {
      const enemyCountries = wars
        .filter(w => w.attacker === botCountryId || w.defender === botCountryId)
        .map(w => w.attacker === botCountryId ? w.defender : w.attacker);

      const enemyArmies = armies.filter(a => 
        enemyCountries.includes(a.owner) && a.location !== null
      );

      const aiArmyPower = calculateArmyBasePower(army);

      if (enemyArmies.length > 0) {
        const nearestEnemy = findNearestEnemyArmy(army, enemyArmies, provinces);
        
        if (nearestEnemy && nearestEnemy.location) {
          const enemyArmyPower = calculateArmyBasePower(nearestEnemy);
          
          if (aiArmyPower >= enemyArmyPower) {
            console.log(`🎯 [IA CAÇADORA] ${botCountryId} caçando exército inimigo em ${nearestEnemy.location}`);
            return createArmyWithRoute(army, nearestEnemy.location, provinces, botCountryId, diplomacy);
          } else {
            const homeProvinces = provinces.filter(p => p.owner === botCountryId);
            const defensiveProvince = findClosestHomeProvince(army.location!, homeProvinces, provinces);
            
            if (defensiveProvince && army.location !== defensiveProvince.id) {
              console.log(`🛡️ [IA DEFENSIVA] ${botCountryId} recuando para defender ${defensiveProvince.name}`);
              return createArmyWithRoute(army, defensiveProvince.id, provinces, botCountryId, diplomacy);
            }
            
            return army;
          }
        }
      }

      const validNeighbors = currentProv.neighbors.filter(neighborId => {
        const prov = provinces.find(p => p.id === neighborId);
        if (!prov) return false;
        return canMoveToProvince(botCountryId, prov.owner, diplomacy);
      });

      if (validNeighbors.length === 0) {
        return army;
      }

      const warTargets = validNeighbors.filter(neighborId => {
        const prov = provinces.find(p => p.id === neighborId);
        if (!prov) return false;
        return isAtWarWith(botCountryId, prov.owner, diplomacy);
      });

      if (warTargets.length > 0) {
        const chosenDestination = warTargets[Math.floor(Math.random() * warTargets.length)];
        return createArmyWithRoute(army, chosenDestination, provinces, botCountryId, diplomacy);
      }
    }

    if (isBorderProvince(army.location!, provinces, botCountryId)) {
      return army;
    }

    const borderNeighbors = currentProv.neighbors.filter(neighborId => {
      const prov = provinces.find(p => p.id === neighborId);
      if (!prov) return false;
      return prov.owner === botCountryId && isBorderProvince(neighborId, provinces, botCountryId);
    });

    if (borderNeighbors.length > 0) {
      const chosenDestination = borderNeighbors[Math.floor(Math.random() * borderNeighbors.length)];
      return createArmyWithRoute(army, chosenDestination, provinces, botCountryId, diplomacy);
    }

    const ownNeighbors = currentProv.neighbors.filter(neighborId => {
      const prov = provinces.find(p => p.id === neighborId);
      return prov && prov.owner === botCountryId;
    });

    if (ownNeighbors.length > 0) {
      const chosenDestination = ownNeighbors[Math.floor(Math.random() * ownNeighbors.length)];
      return createArmyWithRoute(army, chosenDestination, provinces, botCountryId, diplomacy);
    }

    return army;
  });
}