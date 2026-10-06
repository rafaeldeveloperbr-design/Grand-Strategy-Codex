import { getTerrainDefinition } from '../terrain';
import type { Army, Province, SupplyStatus } from '../../types';
import { getBuildingLevel } from '../../data/buildings';
import { calculateArmySupplyUse } from './armyStats';
import { MILITARY_BALANCE } from './balance';

export interface SupplyState { ratio: number; status: SupplyStatus; combatMultiplier: number; movementMultiplier: number }

export function calculateLocalSupplyCapacity(province: Province): number {
  const base = 3 + province.development * .55 + getBuildingLevel(province, 'infrastructure') * 2 + getBuildingLevel(province, 'barracks');
  return Math.max(0, Number.isFinite(base) ? base : 0) * getTerrainDefinition(province).supplyModifier;
}

export function getArmySupply(army: Army, province?: Province, friendlyArmies: Army[] = [army]): SupplyState {
  if (!province) return { ratio: 0, status: 'critical', combatMultiplier: MILITARY_BALANCE.criticalSupplyCombat, movementMultiplier: MILITARY_BALANCE.criticalSupplyMovement };
  const demand = friendlyArmies.filter(item => item.owner === army.owner).reduce((sum, item) => sum + calculateArmySupplyUse(item), 0);
  const friendlyTerritory = province.owner === army.owner;
  const capacity = calculateLocalSupplyCapacity(province) * (friendlyTerritory ? 1 : .55);
  const ratio = demand <= 0 ? 1 : Math.max(0, Math.min(1, Number.isFinite(demand) ? capacity / demand : 0));
  if (ratio < MILITARY_BALANCE.criticalSupplyThreshold) return { ratio, status: 'critical', combatMultiplier: MILITARY_BALANCE.criticalSupplyCombat, movementMultiplier: MILITARY_BALANCE.criticalSupplyMovement };
  if (ratio < MILITARY_BALANCE.lowSupplyThreshold) return { ratio, status: 'low', combatMultiplier: MILITARY_BALANCE.lowSupplyCombat, movementMultiplier: MILITARY_BALANCE.lowSupplyMovement };
  return { ratio, status: 'good', combatMultiplier: 1, movementMultiplier: 1 };
}

export const NEUTRAL_TERRAIN_MODIFIERS = { attack: 1, defense: 1, movement: 1, supply: 1 } as const;
