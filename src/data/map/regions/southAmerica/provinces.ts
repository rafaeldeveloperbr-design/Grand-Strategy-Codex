import type { Building, ProvinceMarket } from '../../../../types';
import type { ProvinceGameplay } from '../../types';
import { countries } from './countries';

// Approximate gameplay values, not census data or official administrative regions.
const definitions: [id: string, name: string, owner: string, population: number, development: number][] = [
  ["sa_bra_roraima", "Roraima", "BRA", 12000, 2],
  ["sa_bra_amazonas", "Amazonas", "BRA", 16000, 2],
  ["sa_bra_acre", "Acre", "BRA", 12000, 2],
  ["sa_bra_rondonia", "Rondônia", "BRA", 15000, 3],
  ["sa_bra_para", "Pará", "BRA", 22000, 3],
  ["sa_bra_amapa", "Amapá", "BRA", 14000, 3],
  ["sa_bra_maranhao", "Maranhão", "BRA", 20000, 4],
  ["sa_bra_ceara", "Ceará", "BRA", 26000, 5],
  ["sa_bra_pernambuco", "Pernambuco", "BRA", 28000, 6],
  ["sa_bra_bahia", "Bahia", "BRA", 28000, 5],
  ["sa_bra_tocantins", "Tocantins", "BRA", 15000, 3],
  ["sa_bra_mato_grosso", "Mato Grosso", "BRA", 18000, 3],
  ["sa_bra_brasilia", "Brasília", "BRA", 36000, 8],
  ["sa_bra_minas_gerais", "Minas Gerais", "BRA", 30000, 6],
  ["sa_bra_sao_paulo", "São Paulo", "BRA", 40000, 8],
  ["sa_bra_parana", "Paraná", "BRA", 26000, 6],
  ["sa_bra_rio_grande_do_sul", "Rio Grande do Sul", "BRA", 24000, 5],
  ["sa_arg_salta", "Salta", "ARG", 16000, 3],
  ["sa_arg_chaco", "Chaco", "ARG", 16000, 3],
  ["sa_arg_cordoba", "Córdoba", "ARG", 26000, 6],
  ["sa_arg_mendoza", "Mendoza", "ARG", 22000, 5],
  ["sa_arg_buenos_aires", "Buenos Aires", "ARG", 36000, 8],
  ["sa_arg_patagonia", "Patagônia", "ARG", 12000, 2],
  ["sa_arg_santa_cruz", "Santa Cruz", "ARG", 10000, 2],
  ["sa_chl_atacama", "Atacama", "CHL", 14000, 3],
  ["sa_chl_coquimbo", "Coquimbo", "CHL", 16000, 4],
  ["sa_chl_santiago", "Santiago", "CHL", 32000, 8],
  ["sa_chl_araucania", "Araucanía", "CHL", 18000, 4],
  ["sa_chl_aysen", "Aysén", "CHL", 11000, 2],
  ["sa_chl_magallanes", "Magalhães", "CHL", 10000, 2],
  ["sa_per_piura", "Piura", "PER", 18000, 4],
  ["sa_per_iquitos", "Iquitos", "PER", 12000, 2],
  ["sa_per_lima", "Lima", "PER", 32000, 8],
  ["sa_per_cusco", "Cusco", "PER", 20000, 5],
  ["sa_per_arequipa", "Arequipa", "PER", 22000, 5],
  ["sa_bol_la_paz", "La Paz", "BOL", 28000, 7],
  ["sa_bol_beni", "Beni", "BOL", 14000, 2],
  ["sa_bol_santa_cruz", "Santa Cruz", "BOL", 24000, 5],
  ["sa_bol_tarija", "Tarija", "BOL", 16000, 4],
  ["sa_col_caribe", "Caribe", "COL", 22000, 5],
  ["sa_col_bogota", "Bogotá", "COL", 32000, 8],
  ["sa_col_cali", "Cali", "COL", 26000, 6],
  ["sa_col_amazonia", "Amazônia", "COL", 14000, 2],
  ["sa_ven_caracas", "Caracas", "VEN", 30000, 8],
  ["sa_ven_maracaibo", "Maracaibo", "VEN", 24000, 6],
  ["sa_ven_llanos", "Llanos", "VEN", 18000, 3],
  ["sa_ven_guayana", "Guayana", "VEN", 16000, 3],
  ["sa_ecu_quito", "Quito", "ECU", 26000, 7],
  ["sa_ecu_guayaquil", "Guayaquil", "ECU", 24000, 6],
  ["sa_ecu_oriente", "Oriente", "ECU", 12000, 2],
  ["sa_pry_chaco", "Chaco", "PRY", 12000, 2],
  ["sa_pry_assuncao", "Assunção", "PRY", 24000, 7],
  ["sa_ury_montevideu", "Montevidéu", "URY", 24000, 7],
  ["sa_guy_georgetown", "Georgetown", "GUY", 18000, 5],
  ["sa_sur_paramaribo", "Paramaribo", "SUR", 16000, 5],
  ["sa_guf_caiena", "Caiena", "GUF", 14000, 5],
];

function initialMarket(population: number): ProvinceMarket {
  const good = (stock: number, price: number) => ({ stock, price, production: 0, demand: 0, consumption: 0, shortage: 0, imported: 0, exported: 0 });
  return {
    goods: { food: good(population / 1000 * 15, 1), wood: good(100, 2), iron: good(60, 4), tools: good(45, 8) },
    purchasingPower: 50,
  };
}

export const provinceGameplay: ProvinceGameplay[] = definitions.map(([id, name, owner, total, development]) => {
  const buildings: Building[] = [
    { type: 'farm', level: total >= 24000 ? 5 : total >= 16000 ? 4 : 3, daysRemaining: 0 },
    { type: 'lumber_mill', level: 1, daysRemaining: 0 },
    { type: 'iron_mine', level: 1, daysRemaining: 0 },
    { type: 'workshop', level: 1, daysRemaining: 0 },
  ];
  if (development >= 6) buildings.push(
    { type: 'market', level: 1, daysRemaining: 0 },
    { type: 'infrastructure', level: development >= 7 ? 2 : 1, daysRemaining: 0 },
  );
  return {
    id, name, owner, originalOwner: owner, color: countries.find(country => country.tag === owner)!.color,
    population: { total, growthRate: .002, employed: Math.round(total * .5), unemployed: Math.round(total * .1), satisfaction: 65 },
    maxPopulation: total * 2, development, buildings, defense: development >= 7 ? 4 : 2,
    unrest: 0, market: initialMarket(total),
  };
});
