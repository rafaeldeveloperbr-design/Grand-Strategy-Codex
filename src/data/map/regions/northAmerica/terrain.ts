import type { TerrainType } from '../../../../engine/terrain';
import { definitions } from './definitions';

/** Coarse strategic terrain; all values use the existing Terrain V1 catalog. */
export const NORTH_AMERICA_TERRAIN: Readonly<Record<string,TerrainType>> = Object.fromEntries(
  definitions.map(([id,,,,,terrain]) => [id,terrain]),
);
