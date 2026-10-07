import { BUILDING_DEFINITIONS } from '../../data/buildings';
import type { TerrainType } from '../terrain';

export const LOGISTICS_BALANCE = {
  disconnectedSupplyModifier: 0.25,
  infrastructureBonusPerLevel: BUILDING_DEFINITIONS.infrastructure.bonusPerLevel.logisticsBonus! / 100,
  maximumInfrastructureModifier: 1.4,
  distanceBands: [
    {maxDistance: 2,modifier: 1},
    {maxDistance: 5,modifier: 0.9},
    {maxDistance: 8,modifier: 0.8},
    {maxDistance: 12,modifier: 0.7},
    {maxDistance: Infinity,modifier: 0.6},
  ],
  terrainLogisticsModifiers: {
    plains: 1,forest: 0.95,jungle: 0.8,hills: 0.9,mountains: 0.75,desert: 0.8,
  } satisfies Record<TerrainType,number>,
  occupiedSupplyModifier: 0.8,
  minimumLogisticsEfficiency: 0.1,
  maximumLogisticsEfficiency: 1.4,
  aiMinimumOffensiveSupplyRatio: 0.2,
  aiRetreatSupplyRatio: 0.2,
  aiLogisticsScoreWeight: 30,
  aiDefenseSupplyWeight: 40,
  aiDisconnectedEnemyBonus: 15,
  aiCorridorDefenseBonus: 25,
  aiCorridorReferenceProvinces: 3,
} as const;
