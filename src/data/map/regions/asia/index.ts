import type { MapRegion } from '../../types';
import { countries } from './countries';
import { provinceGameplay } from './provinces';
import { provinceGeometry } from './geometry';
import { provinceTopology } from './topology';

const islandTags = new Set(['JPN','LKA','IDN','PHL']);
export const asia: MapRegion = {
  id:'asia', countries, provinces:provinceGameplay, geometry:provinceGeometry, topology:provinceTopology,
  capitals:Object.fromEntries(countries.map(c=>[c.tag,c.capitalId!])),
  landmasses:[
    {id:'eurasian-mainland',provinceIds:provinceGameplay.filter(p=>!islandTags.has(p.owner)).map(p=>p.id)},
    {id:'japan',provinceIds:provinceGameplay.filter(p=>p.owner==='JPN').map(p=>p.id)},
    {id:'sri-lanka',provinceIds:['as_lka_colombo']},
    {id:'java',provinceIds:['as_idn_java']},
    {id:'sumatra',provinceIds:['as_idn_sumatra']},
    {id:'philippines',provinceIds:['as_phl_luzon']},
  ],
};
