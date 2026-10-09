export type NavalUnitType = 'DESTROYER' | 'CRUISER' | 'BATTLESHIP' | 'TRANSPORT';
export interface NavalUnit {
  id: string; type: NavalUnitType; strength: number; maxStrength: number;
  organization: number; maxOrganization: number; attack: number; defense: number; speed: number;
}
export interface Fleet {
  id: string; countryTag: string; name: string; units: NavalUnit[];
  locationSeaNodeId?: string; portProvinceId?: string;
  route: string[]; destinationSeaNodeId?: string; destinationPortId?: string;
  movementProgress: number;
  status: 'DOCKED' | 'HOLDING' | 'MOVING' | 'COMBAT' | 'RETREATING';
  retreatUntil?: number;
}
export interface SeaNode { id: string; x: number; y: number; neighbors: string[]; ocean: string; inland?: boolean; lake?: boolean }
export interface NavalPort { provinceId: string; level: number; seaNodeId: string; x: number; y: number }
export interface SeaEdge { a: string; b: string; distance: number; logical?: boolean }
export interface NavalBattle {
  embarkedTroopLosses?: number;
  id: string; seaNodeId: string; sideA: string[]; sideB: string[]; startedAt: number;
  days: number; status: 'ACTIVE' | 'ENDED'; lossesA: number; lossesB: number;
  winner?: 'A' | 'B' | 'DRAW';
}
export interface NavalShipyard { provinceId: string; level: number }
export interface NavalBuildOrder { id: string; countryTag: string; provinceId: string; unitType: NavalUnitType; progress: number; requiredProgress: number; startedAt: number; targetFleetId?: string }
export interface NavalShipyardUpgrade { id: string; countryTag: string; provinceId: string; targetLevel: number; progress: number; requiredProgress: number; startedAt: number }
export interface NavalConstructionState { shipyards: NavalShipyard[]; builds: NavalBuildOrder[]; upgrades: NavalShipyardUpgrade[]; nextId: number }
export interface InvasionOrder { landingType?: 'PORT' | 'BEACH'; fleetId: string; armyIds: string[]; targetProvinceId: string; targetOwner: string; seaNodeId: string; status: 'SAILING' | 'LANDING'; landingDays: number }
export interface AmphibiousCounters { embarkedArmies: number; transportedTroops: number; activeLandings: number; completedLandings: number; troopLossesAtSea: number }
export interface NavalState { fleets: Fleet[]; battles: NavalBattle[]; construction?: NavalConstructionState; invasions?: InvasionOrder[] }
export interface NavalCounters { fleets: number; movingFleets: number; navalAIBots: number; activeNavalBattles: number; pathfindCalls: number }
