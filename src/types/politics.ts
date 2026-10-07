export type GovernmentType = 'absolute_monarchy' | 'constitutional_monarchy' | 'republic' | 'oligarchy' | 'military_government';
export type PoliticalGroupId = 'landowners' | 'merchants' | 'workers' | 'military' | 'reformists';
/** Influence/support/targets are derived; approval retains gradual history. */
export interface PoliticsState {
  governmentType: GovernmentType;
  legitimacy: number;
  politicalCapital: number;
  approval: Record<PoliticalGroupId,number>;
  lastTickDay?: number;
  lastPolicyChangeDay?: number;
}
