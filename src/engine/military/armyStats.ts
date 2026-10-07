import { UNIT_DEFINITIONS } from '../../data/units';
import type { Army, Regiment, UnitType } from '../../types';


const weightedAverage = (army: Army, read: (regiment: Regiment) => number): number => {
  const size = calculateArmySize(army);
  return size <= 0 ? 0 : army.regiments.reduce((sum, regiment) => sum + read(regiment) * regiment.strength, 0) / size;
};

export const getRegimentMaximum = (regiment: Regiment): number => regiment.maxStrength ?? UNIT_DEFINITIONS[regiment.type].maxStrength;
export const getRegimentOrganization = (regiment: Regiment): number => regiment.organization ?? UNIT_DEFINITIONS[regiment.type].maxOrganization;
export const getRegimentExperience = (regiment: Regiment): number => regiment.experience ?? 0;
export const calculateArmySize = (army: Army): number => army.regiments.reduce((sum, regiment) => sum + Math.max(0, regiment.strength), 0);
export const calculateArmyOrganization = (
  army: Army
): number =>
  weightedAverage(
    army,
    regiment => {
      const definition =
        UNIT_DEFINITIONS[regiment.type];

      const current =
        getRegimentOrganization(regiment);

      if (definition.maxOrganization <= 0) {
        return 0;
      }

      return Math.min(
        100,
        Math.max(
          0,
          current /
          definition.maxOrganization *
          100
        )
      );
    }
  );
export const calculateArmyMorale = (
  army: Army
): number =>
  weightedAverage(
    army,
    regiment => {
      const definition =
        UNIT_DEFINITIONS[regiment.type];

      if (definition.maxMorale <= 0) {
        return 0;
      }

      return Math.min(
        100,
        Math.max(
          0,
          regiment.morale /
          definition.maxMorale *
          100
        )
      );
    }
  );
export const calculateArmyExperience = (army: Army): number => weightedAverage(army, getRegimentExperience);
export const calculateArmySupplyUse = (army: Army): number => army.regiments.reduce((sum, regiment) => sum + UNIT_DEFINITIONS[regiment.type].supplyUse * regiment.strength / getRegimentMaximum(regiment), 0);
export const calculateArmySiege = (army: Army): number => army.regiments.reduce((sum, regiment) => sum + UNIT_DEFINITIONS[regiment.type].siege * regiment.strength / getRegimentMaximum(regiment), 0);
export const calculateArmyMaintenance = (army: Army): number => army.regiments.reduce((sum, regiment) => sum + UNIT_DEFINITIONS[regiment.type].maintenance * regiment.strength / getRegimentMaximum(regiment), 0);

export function calculateArmyCombatStats(army: Army, bonuses: Partial<Record<UnitType, number>> = {}) {
  let attack = 0; let defense = 0; let shock = 0;
  for (const regiment of army.regiments) {
    const definition = UNIT_DEFINITIONS[regiment.type];
    const readiness = regiment.strength / getRegimentMaximum(regiment);
    const organization = getRegimentOrganization(regiment) / definition.maxOrganization;
    const morale = regiment.morale / definition.maxMorale;
    const experience = 1 + getRegimentExperience(regiment) / 250;
    const bonus = bonuses[regiment.type] ?? 0;
    const effective = (1 + (Number.isFinite(bonus) ? bonus : 0)) * readiness * (.35 + .65 * organization) * (.6 + .4 * morale) * experience;
    attack += definition.attack * effective;
    defense += definition.defense * effective;
    shock += definition.shock * effective;
  }
  return { attack, defense, shock };
}
