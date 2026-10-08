import type { MapRegion } from '../../types';
import { countries } from './countries';
import { provinceGameplay } from './provinces';
import { provinceGeometry } from './geometry';
import { provinceTopology } from './topology';

export const africa: MapRegion = {
  id: 'africa', countries, provinces: provinceGameplay, geometry: provinceGeometry, topology: provinceTopology,
  capitals: Object.fromEntries(countries.map(c => [c.tag, c.capitalId!])),
  landmasses: [
    {id: 'eurasian-mainland', provinceIds: provinceGameplay.filter(p => p.owner !== 'MDG').map(p => p.id)},
    {id: 'madagascar', provinceIds: ['af_mdg_antananarivo']},
  ],
};
