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
  organizationRecovery: 4, strengthRecovery: 2, replacementPerLevel: .5,
  operationalReplacementMultiplier: .25,
  replacementGold: 4, replacementIron: 2, replacementTools: 1,
  superiorityModifier: .03, casMaxBonus: .05, casAircraftForMax: 60,
  bombingGoldPerAircraft: .03, bombingMaxGoldPerCountry: 5,
  wingSize: 24,
} as const;

/** Local material scale follows Naval Construction (initial stocks: 20 iron/15 tools). */
export const AIR_PRODUCTION_CONFIG: Record<AircraftType, { gold: number; iron: number; tools: number; days: number }> = {
  FIGHTER: { gold: 240, iron: 24, tools: 12, days: 120 },
  CAS: { gold: 300, iron: 30, tools: 15, days: 150 },
  BOMBER: { gold: 480, iron: 48, tools: 24, days: 240 },
  TRANSPORT_PLANE: { gold: 360, iron: 36, tools: 18, days: 180 },
};
export const AIR_QUEUE_LIMIT = 5;
export const AIR_PRODUCTION_AI = {
  reserve: 1000, dailyGoldFraction: .1, peaceCap: 6, warCap: 12,
  incomePerWing: 5, bomberCap: 2,
} as const;
