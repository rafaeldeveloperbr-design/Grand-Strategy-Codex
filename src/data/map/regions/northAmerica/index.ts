import type { MapRegion } from '../../types';
import { countries } from './countries';
import { provinceGameplay } from './provinces';
import { provinceGeometry } from './geometry';
import { provinceTopology } from './topology';

const islands = new Set(['CUB','HTI','DOM','JAM']);
export const northAmerica: MapRegion = {
  id:'northAmerica',countries,provinces:provinceGameplay,geometry:provinceGeometry,topology:provinceTopology,
  capitals:Object.fromEntries(countries.map(c=>[c.tag,c.capitalId!])),
  landmasses:[
    {id:'american-mainland',provinceIds:provinceGameplay.filter(p=>!islands.has(p.owner)).map(p=>p.id)},
    {id:'cuba',provinceIds:['na_cub_cuba']},
    {id:'hispaniola',provinceIds:['na_hti_haiti','na_dom_dominican_republic']},
    {id:'jamaica',provinceIds:['na_jam_jamaica']},
  ],
};
