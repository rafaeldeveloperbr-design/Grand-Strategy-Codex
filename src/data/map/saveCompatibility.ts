import type { SaveGameV2, SaveGameV3 } from '../../engine/saveSystem';
import { mapMetadata, provincesData } from './index';

/** A saved world is retained as-is; there is no fictitious-to-real ID mapping. */
export function isSaveCompatibleWithActiveMap(save: SaveGameV2 | SaveGameV3): boolean {
  if (save.mapId && save.mapId !== mapMetadata.id) return false;
  const expected = new Set(provincesData.map(province => province.id));
  const actual = new Set(save.world.provinces.map(province => province.id));
  return actual.size === expected.size && save.world.provinces.length === expected.size &&
    [...actual].every(id => expected.has(id)) &&
    save.world.countries.some(country => country.tag === mapMetadata.defaultPlayerCountry);
}
