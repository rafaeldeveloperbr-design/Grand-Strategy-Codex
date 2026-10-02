/**
 * ============================================================
 * TIPOS DE GOVERNO E LEIS
 * ============================================================
 */

export type LawCategory = 'conscription' | 'taxation' | 'governance' | 'economy' | 'intelligence';

export interface Law {
  id: string;
  category: LawCategory;
  name: string;
  description: string;
  costGold: number;
  bonuses: {
    goldMultiplier?: number;
    manpowerMultiplier?: number;
    popGrowthMultiplier?: number;
    buildTimeMultiplier?: number;
    armyCostMultiplier?: number;
    civilianBuildTimeMultiplier?: number;
    militaryFactoryCostMultiplier?: number;
    researchSpeedMultiplier?: number;
    focusTimeMultiplier?: number;
  };
}

export interface ActiveLaws {
  conscription: string;
  taxation: string;
  governance: string;
  economy: string;
  intelligence: string;
}