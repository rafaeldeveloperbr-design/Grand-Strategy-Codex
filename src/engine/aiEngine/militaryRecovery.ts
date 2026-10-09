import type { Army } from '../../types';
import { calculateArmyOrganization, calculateArmySize } from '../military/armyStats';
import { WAR_RESOLUTION_BALANCE as WB } from '../diplomacy/warResolutionBalance';

export const MIN_OFFENSIVE_ORGANIZATION = 50;
export const RECENT_DEFEAT_DAYS = 10;
export const NORMAL_ATTACK_RATIO = 1.2;
export const RECENT_DEFEAT_ATTACK_RATIO = 1.5;
export const CAUTIOUS_RECENT_DEFEAT_ATTACK_RATIO = 1.6;

export function canInitiateOffensive(army: Army): boolean {
  return !army.inCombat && !army.retreatProtectionDays && !army.embarkedFleetId
    && calculateArmySize(army) > 0 && calculateArmyOrganization(army) >= MIN_OFFENSIVE_ORGANIZATION;
}

export function getRequiredAttackRatio(army: Army, provinceId: string, cautious = false): number {
  const normal = cautious ? WB.aiCautiousAttackRatio : NORMAL_ATTACK_RATIO;
  return army.recentDefeat?.provinceId === provinceId && army.recentDefeat.daysRemaining > 0
    ? Math.max(normal, cautious ? CAUTIOUS_RECENT_DEFEAT_ATTACK_RATIO : RECENT_DEFEAT_ATTACK_RATIO)
    : normal;
}

/** Daily world maintenance, including PASSIVE countries; no AI decisions or feedback. */
export function advanceRecentDefeat(army: Army, provinceIds: ReadonlySet<string>, countryTags: ReadonlySet<string>): Army {
  const memory = army.recentDefeat;
  if (!memory) return army;
  const daysRemaining = memory.daysRemaining - 1;
  return { ...army, recentDefeat: daysRemaining > 0 && provinceIds.has(memory.provinceId)
    && countryTags.has(army.owner) && calculateArmySize(army) > 0 ? { ...memory, daysRemaining } : undefined };
}
