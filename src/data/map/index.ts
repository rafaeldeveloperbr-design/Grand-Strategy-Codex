import type { Country, Province } from '../../types';
import type { MapRegion, Landmass, MapValidationOptions, TopologyProvince, TopologyCountry } from './types';
import { southAmerica } from './regions/southAmerica';
import { northAmerica } from './regions/northAmerica';
import { europe } from './regions/europe';
import { africa } from './regions/africa';
import { asia } from './regions/asia';
import { oceania } from './regions/oceania';
import { worldMapMetadata } from './worldMetadata';
import { crossRegionConnections } from './crossRegionConnections';
import { validateMapTopology as auditTopology } from './validation';

export const mapRegions: readonly MapRegion[] = [southAmerica,northAmerica,europe,africa,asia,oceania];
export const mapMetadata = worldMapMetadata;
const landmassIds = [...new Set(mapRegions.flatMap(r => r.landmasses?.map(l => l.id) ?? []))];
export const mapLandmasses: readonly Landmass[] = landmassIds.map(id => ({
  id,provinceIds:mapRegions.flatMap(r => r.landmasses?.filter(l => l.id === id).flatMap(l => l.provinceIds) ?? []),
}));

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

export function assembleMap(regions: readonly MapRegion[], connections: readonly (readonly [string,string])[] = []): { provincesData: Province[]; countries: Country[] } {
  const gameplay = regions.flatMap(region => region.provinces);
  const topology = indexById(regions.flatMap(region => region.topology));
  const geometry = indexById(regions.flatMap(region => region.geometry));
  const gameplayIndex = indexById(gameplay);
  const countries = regions.flatMap(region => region.countries);
  const tags = new Set<string>();
  for (const country of countries) {
    if (tags.has(country.tag)) throw new Error(`Duplicate country definition: ${country.tag}`);
    tags.add(country.tag);
  }
  for (const id of [...topology.keys(), ...geometry.keys()]) {
    if (!gameplayIndex.has(id)) throw new Error(`Missing gameplay definition: ${id}`);
  }
  const provincesData = gameplay.map(province => {
    const edges = topology.get(province.id);
    const shape = geometry.get(province.id);
    if (!edges || !shape) throw new Error(`Missing topology or geometry: ${province.id}`);
    return { ...province, neighbors: [...edges.neighbors], center: { ...shape.center }, path: shape.path };
  });
  const byId = new Map(provincesData.map(p => [p.id,p]));
  for (const [a,b] of connections) {
    if (a === b || !byId.has(a) || !byId.has(b)) throw new Error(`Invalid cross-region connection: ${a} / ${b}`);
    byId.get(a)!.neighbors = [...new Set([...byId.get(a)!.neighbors,b])];
    byId.get(b)!.neighbors = [...new Set([...byId.get(b)!.neighbors,a])];
  }
  return { provincesData, countries };
}

export const { provincesData, countries } = assembleMap(mapRegions,crossRegionConnections);
export const mapCapitals: Readonly<Record<string, string>> = Object.assign({}, ...mapRegions.map(region => region.capitals));

export function getCountryByTag(tag: string): Country | undefined {
  return countries.find(country => country.tag === tag);
}

/** Active-world defaults; pass explicit options for a different authored scenario. */
export function validateMapTopology(provinces: readonly TopologyProvince[], countries: readonly TopologyCountry[], options: MapValidationOptions = {expectedLandmasses:mapLandmasses}) {
  return auditTopology(provinces,countries,options);
}
export type * from './types';
