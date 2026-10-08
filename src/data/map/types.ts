import type { Country, Province } from '../../types';

export type ProvinceGameplay = Omit<Province, 'neighbors' | 'center' | 'path'>;
export type ProvinceGeometry = Pick<Province, 'id' | 'center' | 'path'>;
export type ProvinceTopology = Pick<Province, 'id' | 'neighbors'>;

export interface MapViewBox { x: number; y: number; w: number; h: number }
export interface MapMetadata {
  id: string;
  name: string;
  bounds: MapViewBox;
  initialViewBox: MapViewBox;
  defaultPlayerCountry: string;
}

export interface MapRegion {
  id: string;
  provinces: readonly ProvinceGameplay[];
  countries: readonly Country[];
  topology: readonly ProvinceTopology[];
  geometry: readonly ProvinceGeometry[];
  /** Initial visual capitals; separate from mutable country ownership. */
  capitals: Readonly<Record<string, string>>;
  metadata?: MapMetadata;
  /** Explicit expected land components; matching IDs merge across regions. */
  landmasses?: readonly Landmass[];
  /** Explicit holdings of globally defined countries, including overseas territories. */
  additionalHoldings?: Readonly<Record<string, readonly string[]>>;
}

export interface Landmass { id: string; provinceIds: readonly string[] }
export interface MapValidationOptions { expectedLandmasses?: readonly Landmass[] }

export interface TopologyProvince {
  id: string;
  owner: string;
  neighbors: readonly string[];
}

export interface TopologyCountry {
  tag: string;
  provinces: readonly string[];
  capital?: string;
  capitalId?: string;
}

export type MapValidationIssueType =
  | 'duplicate-province-id' | 'duplicate-country-id'
  | 'missing-neighbor' | 'asymmetric-neighbor' | 'self-neighbor'
  | 'duplicate-neighbor' | 'isolated-province' | 'disconnected-components'
  | 'unexpected-landmass-connection'
  | 'invalid-owner' | 'owner-mismatch' | 'missing-country-province'
  | 'unlisted-owned-province' | 'invalid-capital';

export interface MapValidationIssue {
  type: MapValidationIssueType;
  message: string;
  provinceId?: string;
  neighborId?: string;
  countryTag?: string;
}

export interface MapValidationResult {
  valid: boolean;
  issues: MapValidationIssue[];
  /** Weak components of existing land edges, even when edges are asymmetric. */
  components: string[][];
}
