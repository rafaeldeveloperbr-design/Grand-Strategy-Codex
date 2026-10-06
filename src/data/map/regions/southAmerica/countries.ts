import type { Country } from '../../../../types';
import { DEFAULT_LAWS } from '../../../../constants/laws';

export const countries: Country[] = [
  {
    "tag": "BRA",
    "name": "Brasil",
    "adjective": "Brasileira",
    "color": "#397548",
    "colorLight": "#5c986b",
    "capitalId": "sa_bra_brasilia",
    "provinces": [
      "sa_bra_roraima",
      "sa_bra_amazonas",
      "sa_bra_acre",
      "sa_bra_rondonia",
      "sa_bra_para",
      "sa_bra_amapa",
      "sa_bra_maranhao",
      "sa_bra_ceara",
      "sa_bra_pernambuco",
      "sa_bra_bahia",
      "sa_bra_tocantins",
      "sa_bra_mato_grosso",
      "sa_bra_brasilia",
      "sa_bra_minas_gerais",
      "sa_bra_sao_paulo",
      "sa_bra_parana",
      "sa_bra_rio_grande_do_sul"
    ],
    "resources": {
      "gold": 7450,
      "manpower": 34380,
      "maxManpower": 103140,
      "stability": 80,
      "prestige": 57
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇧🇷",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "ARG",
    "name": "Argentina",
    "adjective": "Argentina",
    "color": "#5796bd",
    "colorLight": "#7ab9e0",
    "capitalId": "sa_arg_buenos_aires",
    "provinces": [
      "sa_arg_salta",
      "sa_arg_chaco",
      "sa_arg_cordoba",
      "sa_arg_mendoza",
      "sa_arg_buenos_aires",
      "sa_arg_patagonia",
      "sa_arg_santa_cruz"
    ],
    "resources": {
      "gold": 3950,
      "manpower": 12420,
      "maxManpower": 37260,
      "stability": 80,
      "prestige": 47
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇦🇷",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "CHL",
    "name": "Chile",
    "adjective": "Chilena",
    "color": "#b7474c",
    "colorLight": "#da6a6f",
    "capitalId": "sa_chl_santiago",
    "provinces": [
      "sa_chl_atacama",
      "sa_chl_coquimbo",
      "sa_chl_santiago",
      "sa_chl_araucania",
      "sa_chl_aysen",
      "sa_chl_magallanes"
    ],
    "resources": {
      "gold": 3600,
      "manpower": 9090,
      "maxManpower": 27270,
      "stability": 80,
      "prestige": 46
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇨🇱",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "PER",
    "name": "Peru",
    "adjective": "Peruana",
    "color": "#ba7045",
    "colorLight": "#dd9368",
    "capitalId": "sa_per_lima",
    "provinces": [
      "sa_per_piura",
      "sa_per_iquitos",
      "sa_per_lima",
      "sa_per_cusco",
      "sa_per_arequipa"
    ],
    "resources": {
      "gold": 3250,
      "manpower": 9360,
      "maxManpower": 28080,
      "stability": 80,
      "prestige": 45
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇵🇪",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "BOL",
    "name": "Bolívia",
    "adjective": "Boliviana",
    "color": "#b59b45",
    "colorLight": "#d8be68",
    "capitalId": "sa_bol_la_paz",
    "provinces": [
      "sa_bol_la_paz",
      "sa_bol_beni",
      "sa_bol_santa_cruz",
      "sa_bol_tarija"
    ],
    "resources": {
      "gold": 2900,
      "manpower": 7380,
      "maxManpower": 22140,
      "stability": 80,
      "prestige": 44
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇧🇴",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "PRY",
    "name": "Paraguai",
    "adjective": "Paraguaia",
    "color": "#8261a7",
    "colorLight": "#a584ca",
    "capitalId": "sa_pry_assuncao",
    "provinces": [
      "sa_pry_chaco",
      "sa_pry_assuncao"
    ],
    "resources": {
      "gold": 2200,
      "manpower": 3240,
      "maxManpower": 9720,
      "stability": 80,
      "prestige": 42
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇵🇾",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "URY",
    "name": "Uruguai",
    "adjective": "Uruguaia",
    "color": "#469eaa",
    "colorLight": "#69c1cd",
    "capitalId": "sa_ury_montevideu",
    "provinces": [
      "sa_ury_montevideu"
    ],
    "resources": {
      "gold": 1850,
      "manpower": 2160,
      "maxManpower": 6480,
      "stability": 80,
      "prestige": 41
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇺🇾",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "COL",
    "name": "Colômbia",
    "adjective": "Colombiana",
    "color": "#c8a844",
    "colorLight": "#ebcb67",
    "capitalId": "sa_col_bogota",
    "provinces": [
      "sa_col_caribe",
      "sa_col_bogota",
      "sa_col_cali",
      "sa_col_amazonia"
    ],
    "resources": {
      "gold": 2900,
      "manpower": 8460,
      "maxManpower": 25380,
      "stability": 80,
      "prestige": 44
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇨🇴",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "VEN",
    "name": "Venezuela",
    "adjective": "Venezuelana",
    "color": "#bb793d",
    "colorLight": "#de9c60",
    "capitalId": "sa_ven_caracas",
    "provinces": [
      "sa_ven_caracas",
      "sa_ven_maracaibo",
      "sa_ven_llanos",
      "sa_ven_guayana"
    ],
    "resources": {
      "gold": 2900,
      "manpower": 7920,
      "maxManpower": 23760,
      "stability": 80,
      "prestige": 44
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇻🇪",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "ECU",
    "name": "Equador",
    "adjective": "Equatoriana",
    "color": "#679653",
    "colorLight": "#8ab976",
    "capitalId": "sa_ecu_quito",
    "provinces": [
      "sa_ecu_quito",
      "sa_ecu_guayaquil",
      "sa_ecu_oriente"
    ],
    "resources": {
      "gold": 2550,
      "manpower": 5580,
      "maxManpower": 16740,
      "stability": 80,
      "prestige": 43
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇪🇨",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "GUY",
    "name": "Guiana",
    "adjective": "Guianense",
    "color": "#478a79",
    "colorLight": "#6aad9c",
    "capitalId": "sa_guy_georgetown",
    "provinces": [
      "sa_guy_georgetown"
    ],
    "resources": {
      "gold": 1850,
      "manpower": 1620,
      "maxManpower": 4860,
      "stability": 80,
      "prestige": 41
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇬🇾",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "SUR",
    "name": "Suriname",
    "adjective": "Surinamesa",
    "color": "#98727d",
    "colorLight": "#bb95a0",
    "capitalId": "sa_sur_paramaribo",
    "provinces": [
      "sa_sur_paramaribo"
    ],
    "resources": {
      "gold": 1850,
      "manpower": 1440,
      "maxManpower": 4320,
      "stability": 80,
      "prestige": 41
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇸🇷",
    "activeLaws": { ...DEFAULT_LAWS }
  },
  {
    "tag": "GUF",
    "name": "Guiana Francesa",
    "adjective": "Guianense Francesa",
    "color": "#637fc4",
    "colorLight": "#86a2e7",
    "capitalId": "sa_guf_caiena",
    "provinces": [
      "sa_guf_caiena"
    ],
    "resources": {
      "gold": 1850,
      "manpower": 1260,
      "maxManpower": 3780,
      "stability": 80,
      "prestige": 41
    },
    "economy": {
      "goldIncome": 0,
      "goldExpense": 0,
      "manpowerGain": 0,
      "manpowerExpense": 0
    },
    "flag": "🇬🇫",
    "activeLaws": { ...DEFAULT_LAWS }
  },
];
