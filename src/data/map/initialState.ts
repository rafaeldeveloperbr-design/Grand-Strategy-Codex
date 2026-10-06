import type { Army, Country } from '../../types';

/** Scenario initialization; military rules and unit balance remain in the engine. */
export function createInitialArmies(countries: readonly Country[]): Army[] {
  return countries.flatMap(country => {
    if (!country.capitalId) return [];
    // Larger countries start with more standard infantry regiments (max 1000 each).
    const regimentCount = Math.min(4, Math.max(1, Math.ceil(country.provinces.length / 3)));
    return [{
      id: `army_init_${country.tag.toLowerCase()}`,
      owner: country.tag,
      originalOwner: country.tag,
      name: `Exército de ${country.name}`,
      location: country.capitalId,
      destination: null,
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: 1,
      position: null,
      path: [],
      inCombat: false,
      targetArmyId: null,
      targetProvinceId: null,
      regiments: Array.from({ length: regimentCount }, () => ({
        type: 'infantry' as const, strength: 1000, morale: 85,
        originProvinceId: country.capitalId,
      })),
    }];
  });
}
