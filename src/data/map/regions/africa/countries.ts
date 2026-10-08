import type { Country } from '../../../../types';
import { DEFAULT_LAWS } from '../../../../constants/laws';
import { definitions } from './definitions';

// Strategic gameplay starts, not historical budgets/census figures.
const countryDefinitions: readonly [tag:string,name:string,adjective:string,color:string,colorLight:string,capitalId:string,flag:string][] = [
  ["MAR", "Marrocos", "Marroquina", "#a55f61", "#cb8587", "af_mar_rabat", "🇲🇦"],
  ["DZA", "Argélia", "Argelina", "#b18b50", "#d7b176", "af_dza_algiers", "🇩🇿"],
  ["TUN", "Tunísia", "Tunisiana", "#5e88b1", "#84aed7", "af_tun_tunis", "🇹🇳"],
  ["LBY", "Líbia", "Líbia", "#738c69", "#99b28f", "af_lby_tripoli", "🇱🇾"],
  ["EGY", "Egito", "Egípcia", "#8d6dab", "#b393d1", "af_egy_cairo", "🇪🇬"],
  ["MRT", "Mauritânia", "Mauritana", "#589b9d", "#7ec1c3", "af_mrt_nouakchott", "🇲🇷"],
  ["MLI", "Mali", "Malinesa", "#b17555", "#d79b7b", "af_mli_bamako", "🇲🇱"],
  ["SEN", "Senegal", "Senegalesa", "#657da1", "#8ba3c7", "af_sen_dakar", "🇸🇳"],
  ["GIN", "Guiné", "Guineense", "#8b9959", "#b1bf7f", "af_gin_conakry", "🇬🇳"],
  ["CIV", "Costa do Marfim", "Marfinense", "#a66e8b", "#cc94b1", "af_civ_yamoussoukro", "🇨🇮"],
  ["GHA", "Gana", "Ganesa", "#a55f61", "#cb8587", "af_gha_accra", "🇬🇭"],
  ["BFA", "Burkina Faso", "Burquinense", "#b18b50", "#d7b176", "af_bfa_ouagadougou", "🇧🇫"],
  ["NER", "Níger", "Nigerina", "#5e88b1", "#84aed7", "af_ner_niamey", "🇳🇪"],
  ["NGA", "Nigéria", "Nigeriana", "#738c69", "#99b28f", "af_nga_abuja", "🇳🇬"],
  ["CMR", "Camarões", "Camaronesa", "#8d6dab", "#b393d1", "af_cmr_yaounde", "🇨🇲"],
  ["TCD", "Chade", "Chadiana", "#589b9d", "#7ec1c3", "af_tcd_ndjamena", "🇹🇩"],
  ["CAF", "República Centro-Africana", "Centro-Africana", "#b17555", "#d79b7b", "af_caf_bangui", "🇨🇫"],
  ["SDN", "Sudão", "Sudanesa", "#657da1", "#8ba3c7", "af_sdn_khartoum", "🇸🇩"],
  ["ETH", "Etiópia", "Etíope", "#8b9959", "#b1bf7f", "af_eth_addis_ababa", "🇪🇹"],
  ["ERI", "Eritreia", "Eritreia", "#a66e8b", "#cc94b1", "af_eri_asmara", "🇪🇷"],
  ["SOM", "Somália", "Somali", "#a55f61", "#cb8587", "af_som_mogadishu", "🇸🇴"],
  ["KEN", "Quênia", "Queniana", "#b18b50", "#d7b176", "af_ken_nairobi", "🇰🇪"],
  ["UGA", "Uganda", "Ugandesa", "#5e88b1", "#84aed7", "af_uga_kampala", "🇺🇬"],
  ["TZA", "Tanzânia", "Tanzaniana", "#738c69", "#99b28f", "af_tza_dodoma", "🇹🇿"],
  ["COD", "República Democrática do Congo", "Congolesa", "#8d6dab", "#b393d1", "af_cod_kinshasa", "🇨🇩"],
  ["COG", "República do Congo", "Congolesa", "#589b9d", "#7ec1c3", "af_cog_brazzaville", "🇨🇬"],
  ["AGO", "Angola", "Angolana", "#b17555", "#d79b7b", "af_ago_luanda", "🇦🇴"],
  ["ZMB", "Zâmbia", "Zambiana", "#657da1", "#8ba3c7", "af_zmb_lusaka", "🇿🇲"],
  ["ZWE", "Zimbábue", "Zimbabuana", "#8b9959", "#b1bf7f", "af_zwe_harare", "🇿🇼"],
  ["MOZ", "Moçambique", "Moçambicana", "#a66e8b", "#cc94b1", "af_moz_maputo", "🇲🇿"],
  ["NAM", "Namíbia", "Namibiana", "#a55f61", "#cb8587", "af_nam_windhoek", "🇳🇦"],
  ["BWA", "Botsuana", "Botsuanesa", "#b18b50", "#d7b176", "af_bwa_gaborone", "🇧🇼"],
  ["ZAF", "África do Sul", "Sul-Africana", "#5e88b1", "#84aed7", "af_zaf_pretoria", "🇿🇦"],
  ["MDG", "Madagascar", "Malgaxe", "#738c69", "#99b28f", "af_mdg_antananarivo", "🇲🇬"],
];

export const countries: Country[] = countryDefinitions.map(([tag,name,adjective,color,colorLight,capitalId,flag]) => {
  const holdings = definitions.filter(d => d[2] === tag);
  const population = holdings.reduce((sum,d) => sum+d[3],0);
  const development = holdings.reduce((sum,d) => sum+d[4],0);
  const manpower = Math.round(population*.09);
  return {
    tag,name,adjective,color,colorLight,capitalId,flag,provinces:holdings.map(d=>d[0]),
    resources:{gold:Math.round(1200+development*85),manpower,maxManpower:manpower*3,stability:80,prestige:40+Math.min(20,holdings.length)},
    economy:{goldIncome:0,goldExpense:0,manpowerGain:0,manpowerExpense:0},
    activeLaws:{...DEFAULT_LAWS},
  };
});
