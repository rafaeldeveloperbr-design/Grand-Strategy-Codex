import { UNIT_DEFINITIONS } from '../../data/units';
import type { Army, Regiment } from '../../types';


const weightedAverage = (army: Army, read: (regiment: Regiment) => number): number => {
  const size = calculateArmySize(army);
  return size <= 0 ? 0 : army.regiments.reduce((sum, regiment) => sum + read(regiment) * regiment.strength, 0) / size;
};

export const getRegimentMaximum = (regiment: Regiment): number => regiment.maxStrength ?? UNIT_DEFINITIONS[regiment.type].maxStrength;
export const getRegimentOrganization = (regiment: Regiment): number => regiment.organization ?? UNIT_DEFINITIONS[regiment.type].maxOrganization;
export const getRegimentExperience = (regiment: Regiment): number => regiment.experience ?? 0;
export const calculateArmySize = (army: Army): number => army.regiments.reduce((sum, regiment) => sum + Math.max(0, regiment.strength), 0);
export const calculateArmyOrganization = (army: Army): number => weightedAverage(army, getRegimentOrganization);
export const calculateArmyMorale = (army: Army): number => weightedAverage(army, regiment => regiment.morale);
export const calculateArmyExperience = (army: Army): number => weightedAverage(army, getRegimentExperience);
export const calculateArmySupplyUse = (army: Army): number => army.regiments.reduce((sum, regiment) => sum + UNIT_DEFINITIONS[regiment.type].supplyUse * regiment.strength / getRegimentMaximum(regiment), 0);
export const calculateArmySiege = (army: Army): number => army.regiments.reduce((sum, regiment) => sum + UNIT_DEFINITIONS[regiment.type].siege * regiment.strength / getRegimentMaximum(regiment), 0);
export const calculateArmyMaintenance = (army: Army): number => army.regiments.reduce((sum, regiment) => sum + UNIT_DEFINITIONS[regiment.type].maintenance * regiment.strength / getRegimentMaximum(regiment), 0);

export function calculateArmyCombatStats(army: Army) {
  let attack = 0; let defense = 0; let shock = 0;
  for (const regiment of army.regiments) {
    const definition = UNIT_DEFINITIONS[regiment.type];
    const readiness = regiment.strength / getRegimentMaximum(regiment);
    const organization = getRegimentOrganization(regiment) / definition.maxOrganization;
    const morale = regiment.morale / definition.maxMorale;
    const experience = 1 + getRegimentExperience(regiment) / 250;
    const effective = readiness * (.35 + .65 * organization) * (.6 + .4 * morale) * experience;
    attack += definition.attack * effective;
    defense += definition.defense * effective;
    shock += definition.shock * effective;
  }
  return { attack, defense, shock };
}
