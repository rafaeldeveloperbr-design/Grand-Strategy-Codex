import type { ProvinceTopology } from '../../types';
import { definitions } from './definitions';

/** Mainland Australia only; Cook Strait is not a land connection. */
const landConnections: readonly (readonly [string,string])[] = [
  ['aus_new_south_wales','aus_queensland'], ['aus_new_south_wales','aus_victoria'],
  ['aus_queensland','aus_south_australia'], ['aus_queensland','aus_northern_territory'], ['aus_victoria','aus_south_australia'],
  ['aus_south_australia','aus_western_australia'], ['aus_south_australia','aus_northern_territory'], ['aus_western_australia','aus_northern_territory'],
];
export const provinceTopology: ProvinceTopology[] = definitions.map(([id]) => ({
  id, neighbors: landConnections.flatMap(([a,b]) => `oc_${a}` === id ? [`oc_${b}`] : `oc_${b}` === id ? [`oc_${a}`] : []),
}));
