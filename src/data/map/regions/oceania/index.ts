import type { MapRegion } from '../../types';
import { countries } from './countries';
import { provinceGameplay } from './provinces';
import { provinceGeometry } from './geometry';
import { provinceTopology } from './topology';

export const oceania: MapRegion = {
  id:'oceania', countries, provinces:provinceGameplay, geometry:provinceGeometry, topology:provinceTopology,
  capitals:Object.fromEntries(countries.map(c=>[c.tag,c.capitalId!])),
  landmasses:[
    {id:'australia',provinceIds:provinceGameplay.filter(p=>p.owner==='AUS').map(p=>p.id)},
    {id:'new-zealand-north',provinceIds:['oc_nzl_north_island']},
    {id:'new-zealand-south',provinceIds:['oc_nzl_south_island']},
  ],
};
