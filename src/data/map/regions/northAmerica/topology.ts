import type { ProvinceTopology } from '../../types';
import { definitions } from './definitions';

/** Explicit reviewed LAND borders. No geometry imports and no maritime crossings. */
const landConnections: readonly (readonly [string,string])[] = [
  ['can_british_columbia','can_prairies'],['can_british_columbia','can_northern_canada'],
  ['can_prairies','can_northern_canada'],['can_prairies','can_ontario'],
  ['can_ontario','can_quebec'],['can_quebec','can_atlantic'],
  ['can_british_columbia','usa_pacific_northwest'],['can_prairies','usa_pacific_northwest'],
  ['can_prairies','usa_mountain_west'],['can_prairies','usa_great_plains'],
  ['can_ontario','usa_great_lakes'],['can_ontario','usa_new_england'],
  ['can_quebec','usa_new_england'],['can_atlantic','usa_new_england'],
  ['usa_pacific_northwest','usa_california'],['usa_pacific_northwest','usa_mountain_west'],
  ['usa_california','usa_mountain_west'],['usa_california','usa_southwest'],
  ['usa_mountain_west','usa_southwest'],['usa_mountain_west','usa_great_plains'],
  ['usa_southwest','usa_great_plains'],['usa_southwest','usa_texas'],
  ['usa_texas','usa_great_plains'],['usa_texas','usa_midwest'],['usa_texas','usa_deep_south'],
  ['usa_great_plains','usa_midwest'],['usa_great_plains','usa_great_lakes'],
  ['usa_midwest','usa_great_lakes'],['usa_midwest','usa_deep_south'],
  ['usa_great_lakes','usa_deep_south'],['usa_great_lakes','usa_washington'],
  ['usa_deep_south','usa_florida'],['usa_deep_south','usa_washington'],
  ['usa_florida','usa_washington'],['usa_washington','usa_new_england'],
  ['usa_california','mex_baja_california'],['usa_southwest','mex_northern_mexico'],
  ['usa_texas','mex_northern_mexico'],['usa_texas','mex_gulf_coast'],
  ['mex_baja_california','mex_northern_mexico'],['mex_northern_mexico','mex_central_mexico'],
  ['mex_northern_mexico','mex_gulf_coast'],['mex_central_mexico','mex_gulf_coast'],
  ['mex_central_mexico','mex_southern_mexico'],['mex_southern_mexico','mex_yucatan'],
  ['mex_southern_mexico','gtm_guatemala'],['mex_yucatan','gtm_guatemala'],['mex_yucatan','blz_belize'],
  ['gtm_guatemala','blz_belize'],['gtm_guatemala','hnd_honduras'],['gtm_guatemala','slv_el_salvador'],
  ['hnd_honduras','slv_el_salvador'],['hnd_honduras','nic_nicaragua'],
  ['nic_nicaragua','cri_costa_rica'],['cri_costa_rica','pan_panama'],
  ['hti_haiti','dom_dominican_republic'],
];

// Islands are included in the roster even when they have no land neighbors.
const provinceIds = definitions.map(([id]) => id);
export const provinceTopology: ProvinceTopology[] = provinceIds.map(id => ({
  id,neighbors:landConnections.flatMap(([a,b]) => `na_${a}` === id ? [`na_${b}`] : `na_${b}` === id ? [`na_${a}`] : []),
}));
