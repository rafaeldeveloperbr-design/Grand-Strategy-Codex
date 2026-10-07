import { getTerrainDefinition } from '../terrain';
import type { Army, Province, SupplyStatus } from '../../types';
import { getBuildingBonus } from '../../data/buildings';
import { calculateArmySupplyUse } from './armyStats';
import { MILITARY_BALANCE } from './balance';
import { getProvinceLogistics, type LogisticsInfo, type LogisticsSnapshot } from '../logistics';

export interface SupplyState { ratio: number; status: SupplyStatus; combatMultiplier: number; movementMultiplier: number }

export function calculateLocalSupplyBaseCapacity(province: Province): number {
  const base = 3 + province.development * .55 + getBuildingBonus(province, 'supplyCapacity');
  return Math.max(0, Number.isFinite(base) ? base : 0);
}
export function calculateLocalSupplyCapacity(province: Province): number {
  return calculateLocalSupplyBaseCapacity(province)*getTerrainDefinition(province).supplyModifier;
}

export function getArmySupply(army: Army, province?: Province, friendlyArmies: Army[] = [army], logistics?: LogisticsSnapshot, projected?: LogisticsInfo): SupplyState {
  if (!province) return { ratio: 0, status: 'critical', combatMultiplier: MILITARY_BALANCE.criticalSupplyCombat, movementMultiplier: MILITARY_BALANCE.criticalSupplyMovement };
  const colocated = friendlyArmies.filter(item => item.owner === army.owner && (item.id === army.id || item.location === province.id));
  if (!colocated.some(item => item.id === army.id)) colocated.push(army);
  const demand = colocated.reduce((sum, item) => sum + calculateArmySupplyUse(item), 0);
  const friendlyTerritory = province.owner === army.owner;
  const connection = projected ?? getProvinceLogistics(logistics,army.owner,province.id);
  // Logistics replaces only the supply terrain factor, never multiplies it twice.
  // Context-free calls and rebels preserve Terrain V1's local supply calculation.
  const available = connection ? calculateLocalSupplyBaseCapacity(province)*connection.efficiency : calculateLocalSupplyCapacity(province);
  const capacity = Math.max(0,Number.isFinite(available) ? available : 0) * (friendlyTerritory ? 1 : .55);
  const ratio = demand <= 0 ? 1 : Math.max(0, Math.min(1, Number.isFinite(demand) ? capacity / demand : 0));
  if (ratio < MILITARY_BALANCE.criticalSupplyThreshold) return { ratio, status: 'critical', combatMultiplier: MILITARY_BALANCE.criticalSupplyCombat, movementMultiplier: MILITARY_BALANCE.criticalSupplyMovement };
  if (ratio < MILITARY_BALANCE.lowSupplyThreshold) return { ratio, status: 'low', combatMultiplier: MILITARY_BALANCE.lowSupplyCombat, movementMultiplier: MILITARY_BALANCE.lowSupplyMovement };
  return { ratio, status: 'good', combatMultiplier: 1, movementMultiplier: 1 };
}

export const NEUTRAL_TERRAIN_MODIFIERS = { attack: 1, defense: 1, movement: 1, supply: 1 } as const;
