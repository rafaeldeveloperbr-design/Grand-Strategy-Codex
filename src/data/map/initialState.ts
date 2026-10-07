import { createRegiment, calculateArmySpeed } from '../../engine/military/militaryUtils';
import type { Army, Country } from '../../types';

/** Scenario initialization; military rules and unit balance remain in the engine. */
export function createInitialArmies(countries: readonly Country[]): Army[] {
  return countries.flatMap(country => {
    if (!country.capitalId) return [];
    // Larger countries start with more standard infantry regiments (max 1000 each).
    const regimentCount = Math.min(4, Math.max(1, Math.ceil(country.provinces.length / 3)));
    const regiments = Array.from({ length: regimentCount }, (_, i) => ({ ...createRegiment(regimentCount >= 3 && i === regimentCount - 1 ? 'artillery' : 'infantry', country.capitalId), morale: 85 }));
    return [{
      id: `army_init_${country.tag.toLowerCase()}`,
      owner: country.tag,
      originalOwner: country.tag,
      name: `Exército de ${country.name}`,
      location: country.capitalId,
      destination: null,
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: calculateArmySpeed({regiments}),
      position: null,
      path: [],
      inCombat: false,
      targetArmyId: null,
      targetProvinceId: null,
      regiments,
    }];
  });
}
