import type { Country } from '../../../../types';
import { DEFAULT_LAWS } from '../../../../constants/laws';
import { definitions } from './definitions';

// Strategic gameplay starts, not historical budgets/census figures.
const countryDefinitions: readonly [tag:string,name:string,adjective:string,color:string,colorLight:string,capitalId:string,flag:string][] = [
  ["PRT", "Portugal", "Portuguesa", "#a55f61", "#cb8587", "eu_prt_lisbon", "🇵🇹"],
  ["ESP", "Espanha", "Espanhola", "#b18b50", "#d7b176", "eu_esp_madrid", "🇪🇸"],
  ["FRA", "França", "Francesa", "#5e88b1", "#84aed7", "eu_fra_paris", "🇫🇷"],
  ["GBR", "Reino Unido", "Britânica", "#738c69", "#99b28f", "eu_gbr_london", "🇬🇧"],
  ["IRL", "Irlanda", "Irlandesa", "#8d6dab", "#b393d1", "eu_irl_dublin", "🇮🇪"],
  ["BEL", "Bélgica", "Belga", "#589b9d", "#7ec1c3", "eu_bel_brussels", "🇧🇪"],
  ["NLD", "Países Baixos", "Neerlandesa", "#b17555", "#d79b7b", "eu_nld_amsterdam", "🇳🇱"],
  ["DEU", "Alemanha", "Alemã", "#657da1", "#8ba3c7", "eu_deu_berlin", "🇩🇪"],
  ["DNK", "Dinamarca", "Dinamarquesa", "#8b9959", "#b1bf7f", "eu_dnk_copenhagen", "🇩🇰"],
  ["NOR", "Noruega", "Norueguesa", "#a66e8b", "#cc94b1", "eu_nor_oslo", "🇳🇴"],
  ["SWE", "Suécia", "Sueca", "#a55f61", "#cb8587", "eu_swe_stockholm", "🇸🇪"],
  ["FIN", "Finlândia", "Finlandesa", "#b18b50", "#d7b176", "eu_fin_helsinki", "🇫🇮"],
  ["POL", "Polônia", "Polonesa", "#5e88b1", "#84aed7", "eu_pol_warsaw", "🇵🇱"],
  ["CZE", "Tchéquia", "Tcheca", "#738c69", "#99b28f", "eu_cze_prague", "🇨🇿"],
  ["AUT", "Áustria", "Austríaca", "#8d6dab", "#b393d1", "eu_aut_vienna", "🇦🇹"],
  ["CHE", "Suíça", "Suíça", "#589b9d", "#7ec1c3", "eu_che_bern", "🇨🇭"],
  ["ITA", "Itália", "Italiana", "#b17555", "#d79b7b", "eu_ita_rome", "🇮🇹"],
  ["HUN", "Hungria", "Húngara", "#657da1", "#8ba3c7", "eu_hun_budapest", "🇭🇺"],
  ["ROU", "Romênia", "Romena", "#8b9959", "#b1bf7f", "eu_rou_bucharest", "🇷🇴"],
  ["BGR", "Bulgária", "Búlgara", "#a66e8b", "#cc94b1", "eu_bgr_sofia", "🇧🇬"],
  ["GRC", "Grécia", "Grega", "#a55f61", "#cb8587", "eu_grc_athens", "🇬🇷"],
  ["SRB", "Sérvia", "Sérvia", "#b18b50", "#d7b176", "eu_srb_belgrade", "🇷🇸"],
  ["HRV", "Croácia", "Croata", "#5e88b1", "#84aed7", "eu_hrv_zagreb", "🇭🇷"],
  ["UKR", "Ucrânia", "Ucraniana", "#738c69", "#99b28f", "eu_ukr_kyiv", "🇺🇦"],
  ["BLR", "Belarus", "Belarussa", "#8d6dab", "#b393d1", "eu_blr_minsk", "🇧🇾"],
  ["LTU", "Lituânia", "Lituana", "#589b9d", "#7ec1c3", "eu_ltu_vilnius", "🇱🇹"],
  ["LVA", "Letônia", "Letã", "#b17555", "#d79b7b", "eu_lva_riga", "🇱🇻"],
  ["EST", "Estônia", "Estoniana", "#657da1", "#8ba3c7", "eu_est_tallinn", "🇪🇪"],
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
