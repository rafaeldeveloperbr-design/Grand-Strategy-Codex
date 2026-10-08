import type { Country } from '../../../../types';
import { DEFAULT_LAWS } from '../../../../constants/laws';
import { definitions } from './definitions';

// Strategic gameplay starts, not historical budgets/census figures.
const countryDefinitions: readonly [tag:string,name:string,adjective:string,color:string,colorLight:string,capitalId:string,flag:string][] = [
  ["RUS", "Rússia", "Russa", "#925e72", "#b88498", "as_rus_moscow", "🇷🇺"],
  ["TUR", "Turquia", "Turca", "#a77d51", "#cda377", "as_tur_ankara", "🇹🇷"],
  ["GEO", "Geórgia", "Georgiana", "#658b67", "#8bb18d", "as_geo_tbilisi", "🇬🇪"],
  ["ARM", "Armênia", "Armênia", "#638caa", "#89b2d0", "as_arm_yerevan", "🇦🇲"],
  ["AZE", "Azerbaijão", "Azerbaijana", "#8a70a3", "#b096c9", "as_aze_baku", "🇦🇿"],
  ["IRN", "Irã", "Iraniana", "#5f9a94", "#85c0ba", "as_irn_tehran", "🇮🇷"],
  ["IRQ", "Iraque", "Iraquiana", "#9b945a", "#c1ba80", "as_irq_baghdad", "🇮🇶"],
  ["SYR", "Síria", "Síria", "#ac6b5b", "#d29181", "as_syr_damascus", "🇸🇾"],
  ["ISR", "Israel", "Israelense", "#6f7da0", "#95a3c6", "as_isr_jerusalem", "🇮🇱"],
  ["JOR", "Jordânia", "Jordaniana", "#a28864", "#c8ae8a", "as_jor_amman", "🇯🇴"],
  ["SAU", "Arábia Saudita", "Saudita", "#925e72", "#b88498", "as_sau_riyadh", "🇸🇦"],
  ["YEM", "Iêmen", "Iemenita", "#a77d51", "#cda377", "as_yem_sanaa", "🇾🇪"],
  ["OMN", "Omã", "Omanense", "#658b67", "#8bb18d", "as_omn_muscat", "🇴🇲"],
  ["KAZ", "Cazaquistão", "Cazaque", "#638caa", "#89b2d0", "as_kaz_astana", "🇰🇿"],
  ["UZB", "Uzbequistão", "Uzbeque", "#8a70a3", "#b096c9", "as_uzb_tashkent", "🇺🇿"],
  ["TKM", "Turcomenistão", "Turcomena", "#5f9a94", "#85c0ba", "as_tkm_ashgabat", "🇹🇲"],
  ["KGZ", "Quirguistão", "Quirguiz", "#9b945a", "#c1ba80", "as_kgz_bishkek", "🇰🇬"],
  ["TJK", "Tajiquistão", "Tajique", "#ac6b5b", "#d29181", "as_tjk_dushanbe", "🇹🇯"],
  ["AFG", "Afeganistão", "Afegã", "#6f7da0", "#95a3c6", "as_afg_kabul", "🇦🇫"],
  ["PAK", "Paquistão", "Paquistanesa", "#a28864", "#c8ae8a", "as_pak_islamabad", "🇵🇰"],
  ["IND", "Índia", "Indiana", "#925e72", "#b88498", "as_ind_delhi", "🇮🇳"],
  ["NPL", "Nepal", "Nepalesa", "#a77d51", "#cda377", "as_npl_kathmandu", "🇳🇵"],
  ["BGD", "Bangladesh", "Bangladeshiana", "#658b67", "#8bb18d", "as_bgd_dhaka", "🇧🇩"],
  ["LKA", "Sri Lanka", "Cingalesa", "#638caa", "#89b2d0", "as_lka_colombo", "🇱🇰"],
  ["CHN", "China", "Chinesa", "#8a70a3", "#b096c9", "as_chn_beijing", "🇨🇳"],
  ["MNG", "Mongólia", "Mongol", "#5f9a94", "#85c0ba", "as_mng_ulaanbaatar", "🇲🇳"],
  ["PRK", "Coreia do Norte", "Norte-Coreana", "#9b945a", "#c1ba80", "as_prk_pyongyang", "🇰🇵"],
  ["KOR", "Coreia do Sul", "Sul-Coreana", "#ac6b5b", "#d29181", "as_kor_seoul", "🇰🇷"],
  ["JPN", "Japão", "Japonesa", "#6f7da0", "#95a3c6", "as_jpn_kanto", "🇯🇵"],
  ["MMR", "Myanmar", "Birmanesa", "#a28864", "#c8ae8a", "as_mmr_naypyidaw", "🇲🇲"],
  ["THA", "Tailândia", "Tailandesa", "#925e72", "#b88498", "as_tha_bangkok", "🇹🇭"],
  ["LAO", "Laos", "Laosiana", "#a77d51", "#cda377", "as_lao_vientiane", "🇱🇦"],
  ["KHM", "Camboja", "Cambojana", "#658b67", "#8bb18d", "as_khm_phnom_penh", "🇰🇭"],
  ["VNM", "Vietnã", "Vietnamita", "#638caa", "#89b2d0", "as_vnm_hanoi", "🇻🇳"],
  ["MYS", "Malásia", "Malaia", "#8a70a3", "#b096c9", "as_mys_kuala_lumpur", "🇲🇾"],
  ["IDN", "Indonésia", "Indonésia", "#5f9a94", "#85c0ba", "as_idn_java", "🇮🇩"],
  ["PHL", "Filipinas", "Filipina", "#9b945a", "#c1ba80", "as_phl_luzon", "🇵🇭"],
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
