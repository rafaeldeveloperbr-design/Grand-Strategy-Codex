export type TechnologyCategory = 'MILITARY' | 'INDUSTRY' | 'ECONOMY' | 'SOCIETY';
export type FocusCategory = 'POLITICS' | 'ECONOMY' | 'INDUSTRY' | 'MILITARY' | 'DIPLOMACY' | 'RESEARCH';
export type UnitKind = import('./army').UnitType;

export type TechnologyEffect =
  | { type: 'GOOD_PRODUCTION'; good: 'food' | 'wood' | 'iron' | 'tools'; value: number }
  | { type: 'PRODUCTION_EFFICIENCY' | 'RECRUITMENT_TIME' | 'COMBAT_POWER' | 'MILITARY_MAINTENANCE' | 'FORTIFICATION_BONUS' | 'POPULATION_GROWTH' | 'POPULATION_CAPACITY' | 'GOLD_INCOME' | 'RESEARCH_SPEED'; value: number };

export type RewardEffect =
  | { type: 'COMBAT_POWER'; value: number; unitType: UnitKind }
  | { type: 'GOOD_PRODUCTION'; value: number; good: 'food' | 'wood' | 'iron' | 'tools' }
  | { type: 'GOLD_INCOME' | 'BUILD_COST' | 'BUILD_TIME' | 'MANPOWER' | 'STABILITY' | 'RESEARCH_SPEED' | 'DEFENSE_BONUS' | 'RECRUITMENT_TIME' | 'MILITARY_MAINTENANCE' | 'POPULATION_GROWTH' | 'POPULATION_CAPACITY' | 'SATISFACTION' | 'MIGRATION_ATTRACTION' | 'INTERNAL_TRADE'; value: number };

export interface NationalFocus {
  id: string;
  title: string;
  description: string;
  category: FocusCategory;
  icon: string;
  durationDays: number;
  rewardEffects: RewardEffect[];
  prerequisites?: string[];
  mutuallyExclusive?: string[];
  position: { column: number; row: number };
}
export interface Technology { position: { column: number; row: number }; id: string; title: string; description: string; category: TechnologyCategory; icon: string; costGold: number; durationDays: number; prerequisites: string[]; effects: TechnologyEffect[] }
export interface CountryTechState { countryTag: string; activeFocusId: string | null; activeResearchId: string | null; completedFocuses: string[]; completedTechnologies: string[]; focusProgressDays: number; researchProgressDays: number }
