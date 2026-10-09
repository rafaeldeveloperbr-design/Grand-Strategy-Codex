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
export interface SeaNode { id: string; x: number; y: number; neighbors: string[]; ocean: string }
export interface NavalPort { provinceId: string; level: number; seaNodeId: string; x: number; y: number }
export interface SeaEdge { a: string; b: string; distance: number; logical?: boolean }
export interface NavalBattle {
  id: string; seaNodeId: string; sideA: string[]; sideB: string[]; startedAt: number;
  days: number; status: 'ACTIVE' | 'ENDED'; lossesA: number; lossesB: number;
  winner?: 'A' | 'B' | 'DRAW';
}
export interface NavalState { fleets: Fleet[]; battles: NavalBattle[] }
export interface NavalCounters { fleets: number; movingFleets: number; navalAIBots: number; activeNavalBattles: number; pathfindCalls: number }
