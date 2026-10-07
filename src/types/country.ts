/**
 * Representa uma nação/país jogável ou não-jogável.
 */
import type { ActiveLaws } from './government';

export interface Country {
  /** Explicit capital province. Optional for legacy saves and synthetic countries. */
  capitalId?: string;
  /** Legacy explicit alias supported at the load boundary. */
  capital?: string;
  rebellions?: import('../engine/rebellion/types').RebellionFaction[];
  /** Tag única do país (ex: "BRA", "FRA", "GER") */
  tag: string;
  /** Nome completo do país */
  name: string;
  /** Nome curto/adietivo */
  adjective: string;
  /** Cor principal no mapa (hex) */
  color: string;
  /** Cor secundária para destaques */
  colorLight: string;
  /** Lista de IDs de províncias controladas */
  provinces: string[];
  /** Recursos do país */
  resources: CountryResources;
  /** Taxas econômicas (renda/despesas por dia) */
  economy: CountryEconomy;
  /** Bandeira (emoji ou ícone) */
  flag: string;
  /** Leis ativas do país */
  activeLaws: ActiveLaws;
  /** Indica se o país já foi totalmente anexado (para evitar processamento repetido) */
  isAnnexed?: boolean;
  /** Tariff and external flows; national market aggregates remain derived. */
  trade?: import('./economy').NationalTradeState;
}

/**
 * Recursos globais de um país
 */
export interface CountryResources {
  /** Ouro/moeda do país */
  gold: number;
  /** Mão de obra disponível (recrutável) */
  manpower: number;
  /** Mão de obra máxima (baseada na população elegível) */
  maxManpower: number;
  /** Estabilidade política (0-100) */
  stability: number;
  /** Prestígio militar */
  prestige: number;
}

/**
 * Taxas econômicas do país (calculadas a cada tick)
 */
export interface CountryEconomy {
  /** Renda bruta de ouro por dia */
  goldIncome: number;
  /** Despesas de manutenção por dia */
  goldExpense: number;
  /** Ganho de manpower por dia */
  manpowerGain: number;
  /** Custo de manutenção de tropas por dia */
  manpowerExpense: number;
}
