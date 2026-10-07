import { BUILDING_DEFINITIONS } from '../data/buildings';
/**
 * ============================================================
 * DICIONÁRIOS DE TRADUÇÃO
 * ============================================================
 * Mapeia IDs técnicos para nomes legíveis em português
 */

export const BUILDING_NAMES: Record<string, string> = Object.fromEntries(Object.values(BUILDING_DEFINITIONS).map(def => [def.type, def.name]));

export const UNIT_NAMES: Record<string, string> = {
  infantry: 'Infantaria',
  cavalry: 'Cavalaria',
  artillery: 'Artilharia',
  archers: 'Arqueiros',
  heavy_cavalry: 'Cavalaria Pesada',
  elite_guard: 'Guarda Real',
  siege_engine: 'Armas de Cerco',
};

export const TECH_NAMES: Record<string, string> = {
  // Tecnologias existentes
  tech_improved_weapons: 'Armas Melhoradas',
  tech_cavalry_tactics: 'Táticas de Cavalaria',
  tech_artillery_development: 'Desenvolvimento de Artilharia',
  tech_banking_system: 'Sistema Bancário',
  tech_trade_routes: 'Rotas Comerciais',
  tech_tax_reform: 'Reforma Tributária',
  tech_construction_techniques: 'Técnicas de Construção',
  tech_engineering_corps: 'Corpo de Engenheiros',
  tech_fortification_design: 'Design de Fortificações',
  // Novas tecnologias militares
  tech_siege_artillery: 'Artilharia de Cerco Avançada',
  tech_line_infantry_doctrine: 'Doutrina de Infantaria em Linha',
  tech_heavy_cavalry_tactics: 'Táticas de Cavalaria Pesada',
  tech_military_logistics: 'Logística Militar',
  // Novas tecnologias econômicas
  tech_mercantilism: 'Mercantilismo',
  tech_pre_industrial_manufacturing: 'Manufatura Pré-Industrial',
  // Novas tecnologias políticas
  tech_centralized_admin: 'Administração Centralizada',
  tech_science_academy: 'Academia de Ciências',
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
