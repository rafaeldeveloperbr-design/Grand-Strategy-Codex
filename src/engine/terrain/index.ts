export type TerrainType = 'plains' | 'forest' | 'jungle' | 'hills' | 'mountains' | 'desert';

export interface TerrainDefinition { movementCost: number; supplyModifier: number; defenseModifier: number; label: string; description: string; color: string }

export const TERRAIN_DEFINITIONS: Readonly<Record<TerrainType, TerrainDefinition>> = {
  plains: { movementCost: 1, supplyModifier: 1, defenseModifier: 1, label: 'Plan?cies', description: 'Terreno aberto, favor?vel ? marcha e ? log?stica.', color: '#a3ad62' },
  forest: { movementCost: 1.15, supplyModifier: 0.9, defenseModifier: 1.1, label: 'Floresta', description: 'Mata que dificulta a marcha e oferece cobertura.', color: '#42764b' },
  jungle: { movementCost: 1.35, supplyModifier: 0.7, defenseModifier: 1.15, label: 'Selva', description: 'Vegeta??o densa com log?stica dif?cil.', color: '#194b38' },
  hills: { movementCost: 1.2, supplyModifier: 0.9, defenseModifier: 1.15, label: 'Colinas', description: 'Relevo ondulado que favorece a defesa.', color: '#ad8548' },
  mountains: { movementCost: 1.6, supplyModifier: 0.6, defenseModifier: 1.35, label: 'Montanhas', description: 'Relevo ?ngreme, marcha lenta e forte defesa.', color: '#8e94a3' },
  desert: { movementCost: 1.25, supplyModifier: 0.65, defenseModifier: 1, label: 'Deserto', description: 'Regi?o ?rida com baixa capacidade log?stica.', color: '#dec183' },
};

export function isTerrainType(value: unknown): value is TerrainType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TERRAIN_DEFINITIONS, value);
}

/** Legacy/synthetic provinces keep the plains baseline. Saves are hydrated separately. */
export function getTerrainDefinition(province: { terrain?: TerrainType }): TerrainDefinition {
  return TERRAIN_DEFINITIONS[isTerrainType(province.terrain) ? province.terrain : 'plains'];
}

export function terrainSummary(province: { terrain?: TerrainType }): string {
  const terrain = getTerrainDefinition(province);
  const percent = (modifier: number) => { const value = Math.round((modifier - 1) * 100); return `${value > 0 ? '+' : ''}${value}%`; };
  return `Movimento: ${percent(terrain.movementCost)} ? Supply: ${percent(terrain.supplyModifier)} ? Defesa: ${percent(terrain.defenseModifier)}`;
}

