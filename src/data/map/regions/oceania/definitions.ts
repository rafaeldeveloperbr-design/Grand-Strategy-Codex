import type { TerrainType } from '../../../../engine/terrain';

// Generated from tools/map/oceania.provinces.json; gameplay values, not census data.
export const definitions: readonly [id: string, name: string, owner: string, population: number, development: number, terrain: TerrainType][] = [
  ["oc_aus_new_south_wales", "Nova Gales do Sul (Canberra)", "AUS", 30000, 7, "hills"],
  ["oc_aus_queensland", "Queensland", "AUS", 22000, 5, "plains"],
  ["oc_aus_victoria", "Victoria", "AUS", 22000, 5, "hills"],
  ["oc_aus_south_australia", "Sul da Austrália", "AUS", 22000, 5, "desert"],
  ["oc_aus_western_australia", "Oeste da Austrália", "AUS", 22000, 5, "desert"],
  ["oc_aus_northern_territory", "Território do Norte", "AUS", 22000, 5, "desert"],
  ["oc_nzl_north_island", "Ilha Norte (Wellington)", "NZL", 30000, 7, "hills"],
  ["oc_nzl_south_island", "Ilha Sul", "NZL", 22000, 5, "mountains"],
];
