import type { Army, Country, Province, War, DiplomaticRelation } from '../../types';

function group<T>(rows: T[], keys: (row: T) => (string | null)[]): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) for (const key of new Set(keys(row))) {
    if (key === null) continue;
    const bucket = result.get(key);
    if (bucket) bucket.push(row); else result.set(key, [row]);
  }
  return result;
}
function firstBy<T>(rows: T[], key: (row: T) => string) {
  const result = new Map<string, T>();
  for (const row of rows) if (!result.has(key(row))) result.set(key(row), row);
  return result;
}

/** Tick-local only. Buckets retain world order, including duplicate diplomatic rows.
 * Decisions read the input army view throughout one bot, then publish replacements.
 * Country economy replacements are published before the next military invocation.
 */
export function createMilitaryAIContext(countries: Country[], provinces: Province[], armies: Army[], relations: DiplomaticRelation[], wars: War[]) {
  const provinceById = firstBy(provinces, p => p.id);
  // findPath historically uses a last-wins Map; .find lookups use first-wins.
  const pathProvinceById = new Map(provinces.map(p => [p.id, p]));
  const countryByTag = firstBy(countries, c => c.tag);
  const provincesByOwner = group(provinces, p => [p.owner]);
  const armiesByOwner = group(armies, a => [a.owner]);
  const armiesByProvince = group(armies, a => [a.location]);
  const relationsByCountry = group(relations, r => [r.countryA, r.countryB]);
  const warsByCountry = group(wars, w => [w.attacker, w.defender]);
  const armySlotsByOwner = new Map<string, number[]>();
  armies.forEach((a, slot) => {
    const bucket = armySlotsByOwner.get(a.owner);
    if (bucket) bucket.push(slot); else armySlotsByOwner.set(a.owner, [slot]);
  });
  const borders = new Map<string, boolean>();
  return {
    provinceById, pathProvinceById, countryByTag, provincesByOwner, armiesByOwner, armiesByProvince,
    relationsByCountry, warsByCountry, armySlotsByOwner,
    isBorder(id: string, tag: string) {
      const key = JSON.stringify([id, tag]);
      if (!borders.has(key)) {
        const province = provinceById.get(id);
        borders.set(key, !!province?.neighbors?.some(n => {
          const neighbor = provinceById.get(n);
          return neighbor && neighbor.owner !== tag;
        }));
      }
      return borders.get(key)!;
    },
    publishArmies(tag: string, before: Army[], after: Army[]) {
      const own = armiesByOwner.get(tag);
      if (!own) return;
      (armySlotsByOwner.get(tag) ?? []).forEach((slot, index) => {
        const previous = before[slot], next = after[slot];
        if (previous === next) return;
        // Military decisions only replace movement fields: owner/location and ordering stay fixed.
        own[index] = next;
        if (previous.location !== null) {
          const bucket = armiesByProvince.get(previous.location)!;
          bucket[bucket.indexOf(previous)] = next;
        }
      });
    },
  };
}
export type MilitaryAIContext = ReturnType<typeof createMilitaryAIContext>;
