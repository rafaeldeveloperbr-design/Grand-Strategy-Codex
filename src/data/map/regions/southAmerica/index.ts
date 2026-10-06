import type { MapMetadata, MapRegion } from '../../types';
import { provinceGameplay } from './provinces';
import { countries } from './countries';
import { provinceTopology } from './topology';
import { provinceGeometry } from './geometry';

export const southAmericaMetadata: MapMetadata = {
  id: 'south-america-v1',
  name: 'South America V1',
  bounds: { x: 0, y: 0, w: 740, h: 1000 },
  initialViewBox: { x: -25, y: -20, w: 790, h: 1040 },
  defaultPlayerCountry: 'BRA',
};

export const southAmerica: MapRegion = {
  id: 'southAmerica',
  provinces: provinceGameplay,
  countries,
  topology: provinceTopology,
  geometry: provinceGeometry,
  capitals: Object.fromEntries(countries.map(country => [country.tag, country.capitalId!])),
  metadata: southAmericaMetadata,
};
