/**
 * Tipos de edifícios disponíveis para construção
 */
export type BuildingType = 'farm' | 'lumber_mill' | 'iron_mine' | 'workshop' | 'market' | 'warehouse' | 'housing' | 'barracks' | 'fortress' | 'infrastructure';

/**
 * Representa um edifício em construção ou já construído
 */
export interface Building {
  /** Tipo do edifício */
  type: BuildingType;
  /** Nível do edifício (1-5) */
  level: number;
  /** Dias restantes para conclusão (0 = pronto) */
  daysRemaining: number;
}

/**
 * Representa uma construção na fila (sistema de fila de construções)
 */
export interface BuildingConstruction {
  /** ID único da construção */
  id: string;
  /** ID da província onde está sendo construída */
  provinceId: string;
  /** País dono da construção */
  owner: string;
  /** Tipo do edifício sendo construído */
  buildingType: BuildingType;
  /** Dias restantes para conclusão */
  daysRemaining: number;
  /** Total de dias necessários para construção */
  totalDays: number;
  /** Custo em ouro da construção */
  cost: number;
  /** Provincial goods paid once when the order is placed. */
  resourceCost?: Partial<Record<GoodId, number>>;
}

/**
 * Representa uma província/região no mapa do jogo.
 * Cada província é uma entidade territorial básica.
 */
export interface Province {
  rebellion?: import('../engine/rebellion/types').ProvincialRebellion;
  unrestExplanation?: import('../engine/rebellion/types').UnrestExplanation;
  /** Identificador único da província */
  id: string;
  /** Nome exibido da província */
  name: string;
  /** ID do país que controla esta província */
  owner: string;
  /** Cor de renderização (herdada do país, mas pode ser sobrescrita) */
  color: string;
  /** Lista de IDs de províncias vizinhas (conexões de fronteira) */
  neighbors: string[];
  /** População atual da província */
  population: ProvincePopulation;
  /** Local market state. Optional only at the legacy-save boundary. */
  market?: ProvinceMarket;
  /** População máxima suportada */
  maxPopulation: number;
  /** Nível de desenvolvimento base (1-10) */
  development: number;
  /** Lista de edifícios na província */
  buildings: Building[];
  /** Valor defensivo (base + fortificações) */
  defense: number;
  /** Coordenadas do centro da província para tooltip */
  center: { x: number; y: number };
  /** Path SVG da província */
  path: string;
  /** Nível de agitação/instabilidade local (0-100; organização rebelde é armazenada separadamente) */
  unrest?: number;
  /** Data da última conquista (para calcular decaimento de unrest) */
  lastConquestDate?: number;
  originalOwner?: string; // Rastreia o país que perdeu a província originalmente
  /** Transient total used by the market tick for garrison food demand. */
  stationedTroops?: number;
  /** Custo diário derivado da composição, preenchido pelo loop militar. */
  stationedMilitaryMaintenance?: number;
}

/**
 * Definição de um tipo de edifício (template)
 */
export interface BuildingDefinition {
  /** Tipo do edifício */
  type: BuildingType;
  /** Nome exibido */
  name: string;
  /** Descrição */
  description: string;
  /** Ícone visual */
  icon: string;
  /** Custo base em ouro */
  baseCost: number;
  /** Multiplicador de custo por nível */
  costMultiplier: number;
  /** Dias de construção base */
  baseBuildTime: number;
  /** Nível máximo */
  maxLevel: number;
  resourceCost: Partial<Record<GoodId, number>>;
  /** Bônus por nível */
  bonusPerLevel: BuildingBonus;
}

/**
 * Bônus concedidos por um edifício
 */
export interface BuildingBonus {
  /** Bônus de renda de ouro */
  goldIncome?: number;
  /** Bônus de manpower */
  manpowerGain?: number;
  /** Bônus de defesa */
  defense?: number;
  /** Bônus de crescimento populacional (%) */
  growthBonus?: number;
  /** Redução de tempo de recrutamento militar (%) */
  recruitmentSpeedBonus?: number;
  /** Bônus de velocidade de construção (%) */
  buildSpeedBonus?: number;
  /** Bônus de estabilidade por mês */
  stabilityBonus?: number;
  /** Bônus de velocidade de pesquisa (%) */
  researchSpeedBonus?: number;
  productivityBonus?: number;
  storageBonus?: number;
  populationCapacity?: number;
}

/** Canonical demographic state for a province. */
export interface ProvincePopulation {
  total: number;
  /** Daily fractional growth rate (0.002 = 0.2%). */
  growthRate: number;
  employed: number;
  unemployed: number;
  /** Population satisfaction, clamped to 0..100. */
  satisfaction: number;
  /** Consecutive days with a meaningful food shortage. */
  foodShortageDays?: number;
  /** Consecutive severe-food days; required for famine entry and hysteresis. */
  severeFoodShortageDays?: number;
  /** Net internal migration during the latest daily tick. */
  migrationNet?: number;
}

export type GoodId = 'food' | 'wood' | 'iron' | 'tools';

export interface GoodMarketState {
  stock: number;
  production: number;
  demand: number;
  consumption: number;
  price: number;
  shortage: number;
  /** Transient flow metrics for the latest economic tick. */
  imported: number;
  exported: number;
}

export interface ProvinceMarket {
  goods: Record<GoodId, GoodMarketState>;
  /** Aggregate index clamped to 0..100. */
  purchasingPower: number;
}

export interface BuildingCost {
  gold: number;
  wood: number;
  iron: number;
  tools: number;
}
