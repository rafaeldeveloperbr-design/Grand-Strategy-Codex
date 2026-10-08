import type { ProvinceTopology } from '../../types';
import { definitions } from './definitions';

/** Authored land borders. Islands deliberately have no maritime movement edges. */
const landConnections: readonly (readonly [string, string])[] = [
  ['prt_lisbon','prt_porto'], ['prt_lisbon','esp_andalusia'], ['prt_porto','esp_galicia'],
  ['esp_madrid','esp_galicia'], ['esp_madrid','esp_catalonia'], ['esp_madrid','esp_andalusia'],
  ['esp_catalonia','fra_aquitaine'], ['esp_catalonia','fra_provence'],
  ['fra_paris','fra_brittany'], ['fra_paris','fra_aquitaine'], ['fra_paris','fra_lyon'],
  ['fra_brittany','fra_aquitaine'], ['fra_aquitaine','fra_lyon'], ['fra_aquitaine','fra_provence'], ['fra_lyon','fra_provence'],
  ['fra_paris','bel_brussels'], ['fra_lyon','deu_rhine'], ['fra_lyon','che_bern'],
  ['fra_lyon','ita_piedmont'], ['fra_provence','ita_piedmont'],
  ['gbr_london','gbr_midlands'], ['gbr_london','gbr_wales'], ['gbr_midlands','gbr_wales'], ['gbr_midlands','gbr_scotland'],
  ['bel_brussels','nld_amsterdam'], ['bel_brussels','deu_rhine'], ['nld_amsterdam','deu_rhine'],
  ['deu_berlin','deu_hamburg'], ['deu_berlin','deu_saxony'], ['deu_rhine','deu_hamburg'],
  ['deu_rhine','deu_bavaria'], ['deu_saxony','deu_bavaria'],
  ['deu_berlin','pol_poznan'], ['deu_hamburg','dnk_jutland'], ['deu_saxony','cze_prague'],
  ['deu_bavaria','aut_vienna'], ['deu_bavaria','che_bern'], ['deu_rhine','che_bern'],
  ['nor_oslo','nor_northern_norway'], ['nor_oslo','swe_stockholm'], ['nor_northern_norway','swe_northern_sweden'],
  ['nor_northern_norway','fin_lapland'], ['swe_stockholm','swe_northern_sweden'],
  ['swe_northern_sweden','fin_lapland'], ['fin_helsinki','fin_lapland'],
  ['pol_warsaw','pol_poznan'], ['pol_warsaw','pol_krakow'], ['pol_poznan','pol_krakow'],
  ['pol_poznan','cze_prague'], ['pol_krakow','cze_prague'], ['pol_krakow','ukr_lviv'],
  ['pol_warsaw','ukr_lviv'], ['pol_warsaw','blr_minsk'], ['pol_warsaw','ltu_vilnius'],
  ['cze_prague','aut_vienna'], ['aut_vienna','che_bern'], ['aut_vienna','ita_lombardy'], ['aut_vienna','hun_budapest'],
  ['che_bern','ita_lombardy'], ['che_bern','ita_piedmont'], ['ita_lombardy','ita_piedmont'],
  ['ita_lombardy','ita_rome'], ['ita_rome','ita_southern_italy'],
  ['hun_budapest','rou_transylvania'], ['hun_budapest','srb_belgrade'], ['hun_budapest','hrv_zagreb'], ['hun_budapest','ukr_lviv'],
  ['rou_bucharest','rou_transylvania'], ['rou_bucharest','bgr_sofia'], ['rou_bucharest','ukr_kyiv'],
  ['rou_transylvania','srb_belgrade'], ['rou_transylvania','ukr_lviv'],
  ['bgr_sofia','grc_macedonia'], ['bgr_sofia','srb_belgrade'], ['grc_athens','grc_macedonia'], ['srb_belgrade','hrv_zagreb'],
  ['ukr_kyiv','ukr_lviv'], ['ukr_kyiv','ukr_eastern_ukraine'], ['ukr_kyiv','blr_minsk'], ['ukr_lviv','blr_minsk'],
  ['blr_minsk','ltu_vilnius'], ['blr_minsk','lva_riga'], ['ltu_vilnius','lva_riga'], ['lva_riga','est_tallinn'],
];

export const provinceTopology: ProvinceTopology[] = definitions.map(([id]) => ({
  id, neighbors: landConnections.flatMap(([a,b]) => `eu_${a}` === id ? [`eu_${b}`] : `eu_${b}` === id ? [`eu_${a}`] : []),
}));
