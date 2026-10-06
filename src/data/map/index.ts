import type { Country, Province } from '../../types';
import type { MapRegion } from './types';
import { southAmerica, southAmericaMetadata } from './regions/southAmerica';

export const mapRegions: readonly MapRegion[] = [southAmerica];
export const mapMetadata = southAmericaMetadata;

// Join all regions globally so future cross-region edges use the same IDs.
// Fail on missing/duplicate definitions instead of silently dropping map data.
function indexById<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    if (index.has(item.id)) throw new Error(`Duplicate map definition: ${item.id}`);
    index.set(item.id, item);
  }
  return index;
}

export function assembleMap(regions: readonly MapRegion[]): { provincesData: Province[]; countries: Country[] } {
  const gameplay = regions.flatMap(region => region.provinces);
  const topology = indexById(regions.flatMap(region => region.topology));
  const geometry = indexById(regions.flatMap(region => region.geometry));
  const gameplayIndex = indexById(gameplay);
  for (const id of [...topology.keys(), ...geometry.keys()]) {
    if (!gameplayIndex.has(id)) throw new Error(`Missing gameplay definition: ${id}`);
  }
  const provincesData = gameplay.map(province => {
    const edges = topology.get(province.id);
    const shape = geometry.get(province.id);
    if (!edges || !shape) throw new Error(`Missing topology or geometry: ${province.id}`);
    return { ...province, neighbors: [...edges.neighbors], center: { ...shape.center }, path: shape.path };
  });
  return { provincesData, countries: regions.flatMap(region => region.countries) };
}

export const { provincesData, countries } = assembleMap(mapRegions);
export const mapCapitals: Readonly<Record<string, string>> = Object.assign({}, ...mapRegions.map(region => region.capitals));

export function getCountryByTag(tag: string): Country | undefined {
  return countries.find(country => country.tag === tag);
}

export { validateMapTopology } from './validation';
export type * from './types';
