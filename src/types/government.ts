export type LawCategory = 'conscription' | 'taxation' | 'governance' | 'economy' | 'intelligence' | 'agrarian' | 'trade';
export type CoreLawCategory = Exclude<LawCategory, 'agrarian' | 'trade'>;

export interface LawModifiers {
  goldIncomeMultiplier: number;
  manpowerMultiplier: number;
  populationGrowthMultiplier: number;
  populationCapacityMultiplier: number;
  constructionSpeedMultiplier: number;
  recruitmentTimeMultiplier: number;
  recruitmentCostMultiplier: number;
  militaryMaintenanceMultiplier: number;
  researchSpeedMultiplier: number;
  focusSpeedMultiplier: number;
  productionMultipliers: Record<'food' | 'wood' | 'iron' | 'tools', number>;
  satisfactionModifier: number;
  purchasingPowerMultiplier: number;
  migrationAttractionMultiplier: number;
  internalTradeMultiplier: number;
  stabilityModifier: number;
}

export interface LawRequirement { atWar?: boolean }
export interface Law {
  id: string;
  category: LawCategory;
  name: string;
  description: string;
  costGold: number;
  modifiers: Partial<Omit<LawModifiers, 'productionMultipliers'>> & { productionMultipliers?: Partial<LawModifiers['productionMultipliers']> };
  requirements?: LawRequirement;
}

export interface ActiveLaws {
  conscription: string;
  taxation: string;
  governance: string;
  economy: string;
  intelligence: string;
  agrarian?: string;
  trade?: string;
}

export interface LawContext { atWar: boolean }
export interface EnactLawResult { allowed: boolean; reason: string | null; cost: number }
