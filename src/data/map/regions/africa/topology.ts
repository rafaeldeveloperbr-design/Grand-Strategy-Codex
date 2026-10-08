import type { ProvinceTopology } from '../../types';
import { definitions } from './definitions';

/** Explicit continental borders, including simplified inland lake borders; no sea edges. */
const landConnections: readonly (readonly [string, string])[] = [
  ['mar_rabat','mar_atlas'], ['mar_rabat','dza_algiers'], ['mar_atlas','dza_western_sahara'],
  ['dza_algiers','dza_western_sahara'], ['dza_algiers','dza_eastern_sahara'], ['dza_western_sahara','dza_eastern_sahara'],
  ['dza_algiers','tun_tunis'], ['dza_eastern_sahara','tun_tunis'], ['dza_eastern_sahara','lby_tripoli'],
  ['dza_western_sahara','mrt_nouakchott'], ['dza_western_sahara','mli_timbuktu'], ['dza_eastern_sahara','mli_timbuktu'], ['dza_eastern_sahara','ner_niamey'],
  ['tun_tunis','lby_tripoli'], ['lby_tripoli','lby_cyrenaica'], ['lby_tripoli','ner_niamey'],
  ['lby_cyrenaica','egy_cairo'], ['lby_cyrenaica','egy_upper_egypt'], ['lby_cyrenaica','ner_niamey'], ['lby_cyrenaica','tcd_ndjamena'], ['lby_cyrenaica','sdn_darfur'],
  ['egy_cairo','egy_upper_egypt'], ['egy_upper_egypt','sdn_khartoum'], ['egy_upper_egypt','sdn_darfur'],
  ['mrt_nouakchott','mli_bamako'], ['mrt_nouakchott','mli_timbuktu'], ['mrt_nouakchott','sen_dakar'],
  ['mli_bamako','mli_timbuktu'], ['mli_bamako','sen_dakar'], ['mli_bamako','gin_conakry'], ['mli_bamako','civ_yamoussoukro'], ['mli_bamako','bfa_ouagadougou'],
  ['mli_timbuktu','bfa_ouagadougou'], ['mli_timbuktu','ner_niamey'], ['sen_dakar','gin_conakry'], ['gin_conakry','civ_yamoussoukro'],
  ['civ_yamoussoukro','gha_accra'], ['civ_yamoussoukro','bfa_ouagadougou'], ['gha_accra','bfa_ouagadougou'], ['bfa_ouagadougou','ner_niamey'],
  ['ner_niamey','nga_abuja'], ['ner_niamey','cmr_yaounde'], ['ner_niamey','tcd_ndjamena'], ['nga_abuja','nga_lagos'], ['nga_abuja','cmr_yaounde'],
  ['cmr_yaounde','tcd_ndjamena'], ['cmr_yaounde','caf_bangui'], ['cmr_yaounde','cog_brazzaville'],
  ['tcd_ndjamena','caf_bangui'], ['tcd_ndjamena','sdn_darfur'], ['caf_bangui','sdn_darfur'], ['caf_bangui','cod_congo_basin'], ['caf_bangui','cog_brazzaville'],
  ['sdn_khartoum','sdn_darfur'], ['sdn_khartoum','eth_addis_ababa'], ['sdn_khartoum','eri_asmara'],
  ['eth_addis_ababa','eth_eastern_ethiopia'], ['eth_addis_ababa','eri_asmara'], ['eth_addis_ababa','ken_nairobi'], ['eth_eastern_ethiopia','som_mogadishu'], ['eth_eastern_ethiopia','ken_nairobi'],
  ['som_mogadishu','ken_nairobi'], ['ken_nairobi','uga_kampala'], ['ken_nairobi','tza_dodoma'], ['ken_nairobi','tza_northern_tanzania'],
  ['uga_kampala','tza_northern_tanzania'], ['uga_kampala','cod_congo_basin'], ['tza_dodoma','tza_northern_tanzania'],
  ['tza_dodoma','zmb_lusaka'], ['tza_dodoma','moz_maputo'], ['tza_northern_tanzania','cod_katanga'],
  ['cod_kinshasa','cod_congo_basin'], ['cod_kinshasa','cod_katanga'], ['cod_congo_basin','cod_katanga'],
  ['cod_kinshasa','cog_brazzaville'], ['cod_congo_basin','cog_brazzaville'], ['cod_kinshasa','ago_luanda'],
  ['cod_katanga','ago_luanda'], ['cod_katanga','ago_southern_angola'], ['cod_katanga','zmb_lusaka'],
  ['ago_luanda','ago_southern_angola'], ['ago_southern_angola','zmb_lusaka'], ['ago_southern_angola','nam_windhoek'],
  ['zmb_lusaka','zwe_harare'], ['zmb_lusaka','moz_maputo'], ['zmb_lusaka','nam_windhoek'], ['zmb_lusaka','bwa_gaborone'],
  ['zwe_harare','moz_maputo'], ['zwe_harare','bwa_gaborone'], ['zwe_harare','zaf_pretoria'], ['moz_maputo','zaf_pretoria'],
  ['nam_windhoek','bwa_gaborone'], ['nam_windhoek','zaf_cape'], ['bwa_gaborone','zaf_pretoria'], ['bwa_gaborone','zaf_cape'],
  ['zaf_pretoria','zaf_cape'], ['zaf_pretoria','zaf_eastern_cape'], ['zaf_cape','zaf_eastern_cape'],
];

export const provinceTopology: ProvinceTopology[] = definitions.map(([id]) => ({
  id, neighbors: landConnections.flatMap(([a,b]) => `af_${a}` === id ? [`af_${b}`] : `af_${b}` === id ? [`af_${a}`] : []),
}));
