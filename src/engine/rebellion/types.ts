export type RebelType = 'peasants' | 'separatists' | 'pretenders' | 'religious' | 'revolutionaries' | 'nationalists';
export type RebellionStatus = 'active' | 'defeated' | 'victorious' | 'negotiated';
export interface UnrestModifier { source: string; value: number }
export interface UnrestExplanation { total: number; modifiers: UnrestModifier[] }
export interface ProvincialRebellion {
  progress: number;
  resentment: number;
  autonomy: number;
  reliefDays: number;
  investmentDays: number;
  suppressionDays: number;
  lastActionDay: number;
  lastLogDay: number;
  lastBand: number;
  factionId?: string;
}
export interface RebellionObjective {
  kind: 'tax_relief' | 'independence' | 'replace_government' | 'reform';
  targets: string[];
  requiredDays: number;
  heldDays: number;
}
export interface RebellionFaction {
  id: string;
  type: RebelType;
  originProvince: string;
  involvedProvinces: string[];
  owner: string;
  originalCountry: string;
  restorationCountry?: string;
  support: number;
  militaryStrength: number;
  objective: RebellionObjective;
  status: RebellionStatus;
  formedDay: number;
  lastObjectiveDay?: number;
  resolution?: { reason: 'military_defeat' | 'objective_completed' | 'negotiation'; day: number };
}
export type RebellionAction = 'repression' | 'tax_relief' | 'concessions' | 'autonomy' | 'investment' | 'negotiate';
