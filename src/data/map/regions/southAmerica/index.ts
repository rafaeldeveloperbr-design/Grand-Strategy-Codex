import type { MapRegion } from '../../types';
import { provinceGameplay } from './provinces';
import { countries } from './countries';
import { provinceTopology } from './topology';
import { provinceGeometry } from './geometry';

export const southAmerica: MapRegion = {
  id: 'southAmerica',
  provinces: provinceGameplay,
  countries,
  topology: provinceTopology,
  geometry: provinceGeometry,
  capitals: Object.fromEntries(countries.map(country => [country.tag, country.capitalId!])),
  landmasses: [{id:'american-mainland',provinceIds:provinceGameplay.map(p=>p.id)}],
};
