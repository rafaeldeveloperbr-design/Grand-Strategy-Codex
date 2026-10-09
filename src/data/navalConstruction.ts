import type { NavalUnitType } from '../types/naval';
export interface NavalConstructionCost { gold: number; iron: number; tools: number }
export const NAVAL_BUILD_CONFIG: Record<NavalUnitType, NavalConstructionCost & { days: number; level: number; label: string }> = {
  DESTROYER: { gold: 180, iron: 18, tools: 8, days: 120, level: 1, label: 'Destroyer' },
  TRANSPORT: { gold: 120, iron: 12, tools: 5, days: 90, level: 1, label: 'Transport' },
  CRUISER: { gold: 420, iron: 40, tools: 18, days: 240, level: 2, label: 'Cruiser' },
  BATTLESHIP: { gold: 900, iron: 90, tools: 40, days: 480, level: 3, label: 'Battleship' },
};
export const SHIPYARD_SPEED = [0, 1, 1.5, 2] as const;
export const SHIPYARD_UPGRADES = [
  { gold: 200, iron: 15, tools: 8, days: 90 },
  { gold: 400, iron: 50, tools: 25, days: 180 },
  { gold: 800, iron: 100, tools: 50, days: 300 },
] as const;
export const NAVAL_QUEUE_LIMIT = 5;
export const NAVAL_AI_CONSTRUCTION = { dailyGoldFraction: .1, reserve: 1000, peaceShips: 12, warShips: 24 } as const;
