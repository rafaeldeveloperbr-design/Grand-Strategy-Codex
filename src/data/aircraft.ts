import type { AircraftType, AircraftTypeConfig } from '../types/air';
/** Range/speed use the world's existing projection units; no naval range coupling. */
export const AIRCRAFT_TYPES: Record<AircraftType, AircraftTypeConfig> = {
  FIGHTER: { airAttack: 8, airDefense: 7, speed: 450, range: 650, missionEfficiency: 1, maintenance: .025, missions: ['AIR_SUPERIORITY', 'INTERCEPTION'] },
  CAS: { airAttack: 2, airDefense: 4, speed: 300, range: 500, missionEfficiency: .9, maintenance: .03, missions: ['CLOSE_AIR_SUPPORT'] },
  BOMBER: { airAttack: 1, airDefense: 5, speed: 350, range: 1100, missionEfficiency: .8, maintenance: .05, missions: ['BOMBING'] },
  TRANSPORT_PLANE: { airAttack: 0, airDefense: 3, speed: 350, range: 900, missionEfficiency: 0, maintenance: .02, missions: [] },
};
export const AIR_BALANCE = {
  minOrganization: 20, minStrength: 20, minimumEfficiency: .1,
  combatLossRate: .025, combatOrganizationLoss: 8, missionOrganizationLoss: 2,
  organizationRecovery: 4, strengthRecovery: 2, replacementPerLevel: 1,
  replacementGold: 4, replacementIron: 2, replacementTools: 1,
  superiorityModifier: .03, casMaxBonus: .05, casAircraftForMax: 60,
  bombingGoldPerAircraft: .03, bombingMaxGoldPerCountry: 5,
  wingSize: 24,
} as const;
