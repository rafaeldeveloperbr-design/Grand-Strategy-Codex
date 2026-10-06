import type { ProvinceTopology } from '../../types';

/** Reviewed land connections. Each pair is undirected and expanded both ways.
 * IDs and crossings are explicit; this module never imports SVG geometry.
 * Selected Andean crossings keep Chile a long corridor with limited exits.
 */
const landConnections: readonly (readonly [string, string])[] = [
  ['bra_roraima', 'bra_amazonas'], ['bra_roraima', 'bra_para'], ['bra_roraima', 'bra_amapa'],
  ['bra_amazonas', 'bra_acre'], ['bra_amazonas', 'bra_rondonia'], ['bra_amazonas', 'bra_para'],
  ['bra_acre', 'bra_rondonia'], ['bra_rondonia', 'bra_mato_grosso'], ['bra_rondonia', 'bra_para'],
  ['bra_para', 'bra_amapa'], ['bra_para', 'bra_maranhao'], ['bra_para', 'bra_tocantins'], ['bra_para', 'bra_mato_grosso'],
  ['bra_amapa', 'bra_maranhao'], ['bra_maranhao', 'bra_ceara'], ['bra_maranhao', 'bra_tocantins'], ['bra_maranhao', 'bra_bahia'],
  ['bra_ceara', 'bra_pernambuco'], ['bra_ceara', 'bra_bahia'], ['bra_pernambuco', 'bra_bahia'],
  ['bra_bahia', 'bra_tocantins'], ['bra_bahia', 'bra_brasilia'], ['bra_bahia', 'bra_minas_gerais'],
  ['bra_tocantins', 'bra_mato_grosso'], ['bra_tocantins', 'bra_brasilia'],
  ['bra_mato_grosso', 'bra_brasilia'], ['bra_mato_grosso', 'bra_parana'],
  ['bra_brasilia', 'bra_minas_gerais'], ['bra_brasilia', 'bra_sao_paulo'], ['bra_brasilia', 'bra_parana'],
  ['bra_minas_gerais', 'bra_sao_paulo'], ['bra_sao_paulo', 'bra_parana'], ['bra_parana', 'bra_rio_grande_do_sul'],

  ['arg_salta', 'arg_chaco'], ['arg_salta', 'arg_cordoba'], ['arg_salta', 'arg_mendoza'],
  ['arg_chaco', 'arg_cordoba'], ['arg_chaco', 'arg_buenos_aires'],
  ['arg_cordoba', 'arg_mendoza'], ['arg_cordoba', 'arg_buenos_aires'],
  ['arg_mendoza', 'arg_buenos_aires'], ['arg_mendoza', 'arg_patagonia'],
  ['arg_buenos_aires', 'arg_patagonia'], ['arg_patagonia', 'arg_santa_cruz'],

  ['chl_atacama', 'chl_coquimbo'], ['chl_coquimbo', 'chl_santiago'],
  ['chl_santiago', 'chl_araucania'], ['chl_araucania', 'chl_aysen'], ['chl_aysen', 'chl_magallanes'],

  ['per_piura', 'per_iquitos'], ['per_piura', 'per_lima'], ['per_iquitos', 'per_lima'],
  ['per_iquitos', 'per_cusco'], ['per_lima', 'per_cusco'], ['per_cusco', 'per_arequipa'],

  ['bol_la_paz', 'bol_beni'], ['bol_la_paz', 'bol_santa_cruz'], ['bol_la_paz', 'bol_tarija'],
  ['bol_beni', 'bol_santa_cruz'], ['bol_santa_cruz', 'bol_tarija'],

  ['col_caribe', 'col_bogota'], ['col_caribe', 'col_cali'], ['col_bogota', 'col_cali'],
  ['col_bogota', 'col_amazonia'], ['col_cali', 'col_amazonia'],

  ['ven_caracas', 'ven_maracaibo'], ['ven_caracas', 'ven_llanos'], ['ven_caracas', 'ven_guayana'],
  ['ven_maracaibo', 'ven_llanos'], ['ven_llanos', 'ven_guayana'],
  ['ecu_quito', 'ecu_guayaquil'], ['ecu_quito', 'ecu_oriente'], ['ecu_guayaquil', 'ecu_oriente'],
  ['pry_chaco', 'pry_assuncao'],

  // Northern Amazon and Guiana shield borders.
  ['bra_amazonas', 'col_amazonia'], ['bra_amazonas', 'ven_guayana'], ['bra_amazonas', 'per_iquitos'],
  ['bra_roraima', 'ven_guayana'], ['bra_roraima', 'guy_georgetown'],
  ['bra_roraima', 'sur_paramaribo'], ['bra_amapa', 'sur_paramaribo'], ['bra_amapa', 'guf_caiena'],
  ['guy_georgetown', 'sur_paramaribo'], ['sur_paramaribo', 'guf_caiena'], ['ven_guayana', 'guy_georgetown'],
  ['col_caribe', 'ven_maracaibo'], ['col_bogota', 'ven_llanos'], ['col_amazonia', 'ven_llanos'],
  ['col_cali', 'ecu_quito'], ['col_amazonia', 'per_iquitos'],
  ['ecu_guayaquil', 'per_piura'], ['ecu_oriente', 'per_iquitos'],

  // Andean and interior corridors.
  ['bra_acre', 'per_cusco'], ['bra_acre', 'bol_beni'], ['bra_rondonia', 'bol_beni'],
  ['bra_mato_grosso', 'bol_santa_cruz'], ['bra_mato_grosso', 'pry_chaco'],
  ['per_cusco', 'bol_la_paz'], ['per_arequipa', 'bol_la_paz'], ['per_arequipa', 'chl_atacama'],
  ['bol_la_paz', 'chl_atacama'], ['bol_tarija', 'arg_salta'], ['bol_santa_cruz', 'pry_chaco'],
  ['bol_tarija', 'pry_chaco'], ['arg_salta', 'chl_atacama'], ['arg_mendoza', 'chl_santiago'],
  ['arg_patagonia', 'chl_araucania'], ['arg_santa_cruz', 'chl_magallanes'],
  ['pry_chaco', 'arg_chaco'], ['pry_assuncao', 'arg_chaco'], ['pry_assuncao', 'bra_parana'],
  ['bra_parana', 'arg_chaco'], ['bra_rio_grande_do_sul', 'arg_chaco'],
  ['bra_rio_grande_do_sul', 'ury_montevideu'], ['arg_buenos_aires', 'ury_montevideu'],
];

// Explicit province roster also lets validation detect accidentally isolated nodes.
const provinceIds = [
  'bra_roraima', 'bra_amazonas', 'bra_acre', 'bra_rondonia', 'bra_para', 'bra_amapa',
  'bra_maranhao', 'bra_ceara', 'bra_pernambuco', 'bra_bahia', 'bra_tocantins', 'bra_mato_grosso',
  'bra_brasilia', 'bra_minas_gerais', 'bra_sao_paulo', 'bra_parana', 'bra_rio_grande_do_sul',
  'arg_salta', 'arg_chaco', 'arg_cordoba', 'arg_mendoza', 'arg_buenos_aires', 'arg_patagonia', 'arg_santa_cruz',
  'chl_atacama', 'chl_coquimbo', 'chl_santiago', 'chl_araucania', 'chl_aysen', 'chl_magallanes',
  'per_piura', 'per_iquitos', 'per_lima', 'per_cusco', 'per_arequipa',
  'bol_la_paz', 'bol_beni', 'bol_santa_cruz', 'bol_tarija',
  'col_caribe', 'col_bogota', 'col_cali', 'col_amazonia',
  'ven_caracas', 'ven_maracaibo', 'ven_llanos', 'ven_guayana',
  'ecu_quito', 'ecu_guayaquil', 'ecu_oriente', 'pry_chaco', 'pry_assuncao',
  'ury_montevideu', 'guy_georgetown', 'sur_paramaribo', 'guf_caiena',
];

export const provinceTopology: ProvinceTopology[] = provinceIds.map(id => ({
  id: `sa_${id}`,
  neighbors: landConnections.flatMap(([a, b]) => a === id ? [`sa_${b}`] : b === id ? [`sa_${a}`] : []),
}));
