/**
 * ============================================================
 * DICIONÁRIOS DE TRADUÇÃO
 * ============================================================
 * Mapeia IDs técnicos para nomes legíveis em português
 */

export const BUILDING_NAMES: Record<string, string> = {
  farm: 'Fazenda',
  market: 'Mercado',
  lumber_mill: 'Serraria',
  iron_mine: 'Mina de Ferro',
  warehouse: 'Armazém',
  housing: 'Habitação',
  barracks: 'Quartel',
  fortress: 'Fortaleza',
  infrastructure: 'Infraestrutura',
  workshop: 'Oficina',
};

export const UNIT_NAMES: Record<string, string> = {
  infantry: 'Infantaria',
  cavalry: 'Cavalaria',
  artillery: 'Artilharia',
  archers: 'Arqueiros',
  heavy_cavalry: 'Cavalaria Pesada',
  elite_guard: 'Guarda Real',
  siege_engine: 'Armas de Cerco',
};

export const FOCUS_NAMES: Record<string, string> = {
  // Focos existentes
  focus_military_modernization: 'Modernização Militar',
  focus_economic_expansion: 'Expansão Econômica',
  focus_fortification_program: 'Programa de Fortificação',
  focus_cavalry_traditions: 'Tradições de Cavalaria',
  focus_industrial_revolution: 'Revolução Industrial',
  focus_national_unity: 'Unidade Nacional',
  // Novos focos militares
  focus_army_modernization: 'Modernização do Exército',
  focus_border_fortification: 'Fortalecimento das Fronteiras',
  // Novos focos econômicos
  focus_agrarian_reform: 'Reforma Agrária',
  focus_commercial_expansion: 'Expansão Comercial',
  focus_manufacturing_incentive: 'Incentivo à Manufatura',
  // Novos focos políticos
  focus_kingdom_centralization: 'Centralização do Reino',
  focus_scientific_patronage: 'Patronato Científico',
};

export function getBuildingName(type: string): string {
  return BUILDING_NAMES[type.toLowerCase()] || type;
}

export function getUnitName(type: string): string {
  return UNIT_NAMES[type.toLowerCase()] || type;
}



export const DIFFICULTY_NAMES: Record<string, string> = {
  easy: 'Fácil (10% Velocidade IA)',
  medium: 'Médio (40% Velocidade IA)',
  hard: 'Difícil (60% Velocidade IA)',
  impossible: 'Impossível (100% Velocidade IA)',
};

export function getDifficultyName(difficulty: string): string {
  return DIFFICULTY_NAMES[difficulty] || difficulty;
}
