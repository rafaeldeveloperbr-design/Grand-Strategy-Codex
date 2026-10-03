export type TechnologyCategory = 'MILITARY' | 'ECONOMY' | 'SOCIETY';

export type TechnologyEffect =
  | { type: 'GOOD_PRODUCTION'; good: 'food' | 'wood' | 'iron' | 'tools'; value: number }
  | { type: 'PRODUCTION_EFFICIENCY' | 'RECRUITMENT_TIME' | 'COMBAT_POWER' | 'MILITARY_MAINTENANCE' | 'FORTIFICATION_BONUS' | 'POPULATION_GROWTH' | 'POPULATION_CAPACITY' | 'GOLD_INCOME' | 'RESEARCH_SPEED'; value: number };

export type RewardEffectType = 'COMBAT_POWER' | 'GOLD_INCOME' | 'BUILD_COST' | 'BUILD_TIME' | 'MANPOWER' | 'STABILITY' | 'RESEARCH_SPEED' | 'DEFENSE_BONUS';
export interface RewardEffect { type: RewardEffectType; value: number; unitType?: 'infantry' | 'cavalry' | 'artillery' }
export interface NationalFocus { id: string; title: string; description: string; icon: string; durationDays: number; currentProgressDays: number; completed: boolean; rewardEffect: RewardEffect; prerequisites?: string[] }
export interface Technology { id: string; title: string; description: string; category: TechnologyCategory; icon: string; costGold: number; durationDays: number; prerequisites: string[]; effects: TechnologyEffect[] }
export interface CountryTechState { countryTag: string; activeFocusId: string | null; activeResearchId: string | null; completedFocuses: string[]; completedTechnologies: string[]; focusProgressDays: number; researchProgressDays: number }
