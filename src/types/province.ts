/**
 * Tipos de edifícios disponíveis para construção
 */
export type BuildingType = 'farm' | 'market' | 'barracks' | 'fortification' | 'workshop' | 'temple' | 'port' | 'university';

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
}

/**
 * Representa uma província/região no mapa do jogo.
 * Cada província é uma entidade territorial básica.
 */
export interface Province {
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
  population: number;
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
  /** Nível de agitação/instabilidade local (0-100, onde 100 = revolta iminente) */
  unrest?: number;
  /** Data da última conquista (para calcular decaimento de unrest) */
  lastConquestDate?: number;
  originalOwner?: string; // Rastreia o país que perdeu a província originalmente
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
}