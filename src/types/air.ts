export type AircraftType = 'FIGHTER' | 'CAS' | 'BOMBER' | 'TRANSPORT_PLANE';
export type AirMission = 'AIR_SUPERIORITY' | 'INTERCEPTION' | 'CLOSE_AIR_SUPPORT' | 'BOMBING';
export interface AircraftTypeConfig {
  airAttack: number; airDefense: number; speed: number; range: number;
  missionEfficiency: number; maintenance: number; missions: readonly AirMission[];
}
export interface AirWing {
  id: string; countryTag: string; name: string; type: AircraftType;
  aircraftCount: number; maxAircraft: number; strength: number; organization: number;
  baseProvinceId: string; assignedAirZoneId?: string; mission?: AirMission;
  status: 'READY' | 'MISSION' | 'REBASING';
  rebase?: { targetProvinceId: string; daysRemaining: number; totalDays: number };
}
export interface AirBase { provinceId: string; level: 1 | 2 | 3; capacity: number }
export interface AirZone { id: string; name: string; provinceIds: string[]; center: { x: number; y: number }; neighbors: string[] }
export interface AirEngagement { zoneId: string; wingIds: string[]; losses: Record<string, number> }
export interface AirCombatParticipantSnapshot {
  wingId: string;
  wingName: string;
  countryTag: string;
  type: AircraftType;
  mission?: AirMission;

  initialAircraft: number;
  finalAircraft: number;
  aircraftLost: number;

  aircraftReplacements?: number;
}
export interface AirCombatReport {
  status: 'ACTIVE' | 'ENDED'; startedAt: number; lastCombatDay: number; endedAt?: number;
  /** First combat day, retained for V1 consumers. */
  id: string; zoneId: string; day: number; participants: AirCombatParticipantSnapshot[];
  /** Hostilities observed during combat, retained after peace for the final summary. */
  hostileCountryPairs?: [string, string][];
  lossesByCountry: Record<string, number>; lossesByType: Partial<Record<AircraftType, number>>;
  totalAircraftLost: number;
}
export const AIR_COMBAT_HISTORY_LIMIT = 100;
export const AIR_COMBAT_INACTIVITY_DAYS = 3;
export interface AirProductionOrder {
  id: string; countryTag: string; provinceId: string; type: AircraftType;
  progress: number; requiredProgress: number;
}
/** Every queued order is already paid. Absence is the V1 save contract. */
export interface AirProductionState { queues: Record<string, AirProductionOrder[]>; nextId: number }
export interface AirState { wings: AirWing[]; engagements: AirEngagement[]; production?: AirProductionState; reports?: AirCombatReport[] }
export interface AirCounters {
  airWings: number; activeAirMissions: number; airAIBots: number; airEngagements: number;
  aircraftLost: number; casMissions: number; bombingMissions: number;
}
