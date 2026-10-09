import type { NavalUnit, NavalUnitType } from '../types/naval';
export const NAVAL_UNIT_STATS: Readonly<Record<NavalUnitType, { attack: number; defense: number; speed: number; maintenance: number }>> = {
  DESTROYER: { attack: 8, defense: 14, speed: 32, maintenance: .12 },
  CRUISER: { attack: 18, defense: 20, speed: 25, maintenance: .25 },
  BATTLESHIP: { attack: 38, defense: 32, speed: 18, maintenance: .55 },
  TRANSPORT: { attack: 1, defense: 5, speed: 22, maintenance: .08 },
};
export const NAVAL_BALANCE = { strength: 100, organization: 100, speedToMapUnits: 2,
  damage: 3, organizationDamage: 1.5, retreatOrganization: 20, retreatDays: 3,
  repairStrength: .5, repairGoldPerStrength: .04, recoveryOrganization: 4, historyLimit: 100 } as const;
export function createNavalUnit(id: string, type: NavalUnitType): NavalUnit {
  const { attack, defense, speed } = NAVAL_UNIT_STATS[type];
  return { id, type, attack, defense, speed, strength: NAVAL_BALANCE.strength,
    maxStrength: NAVAL_BALANCE.strength, organization: NAVAL_BALANCE.organization, maxOrganization: NAVAL_BALANCE.organization };
}
