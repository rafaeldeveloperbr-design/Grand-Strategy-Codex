import type { MapRegion } from '../../types';
import { countries } from './countries';
import { provinceGameplay } from './provinces';
import { provinceGeometry } from './geometry';
import { provinceTopology } from './topology';

const islandIds = new Set(['eu_dnk_copenhagen', 'eu_irl_dublin']);
export const europe: MapRegion = {
  id: 'europe', countries, provinces: provinceGameplay, geometry: provinceGeometry, topology: provinceTopology,
  capitals: Object.fromEntries(countries.map(c => [c.tag, c.capitalId!])),
  landmasses: [
    // Joined through the real Russian land bridge; Egypt joins Africa to this component.
    {id: 'eurasian-mainland', provinceIds: provinceGameplay.filter(p => p.owner !== 'GBR' && !islandIds.has(p.id)).map(p => p.id)},
    {id: 'great-britain', provinceIds: provinceGameplay.filter(p => p.owner === 'GBR').map(p => p.id)},
    // Northern Ireland is not modeled; no Ireland–Great Britain land crossing.
    {id: 'ireland', provinceIds: ['eu_irl_dublin']},
    {id: 'zealand', provinceIds: ['eu_dnk_copenhagen']},
  ],
};
