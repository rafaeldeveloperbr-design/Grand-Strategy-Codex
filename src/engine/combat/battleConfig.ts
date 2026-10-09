/** Land combat only; no changes to naval/air or war resolution balance. */
export const BATTLE_V3 = {
  strengthRate: .008,
  organizationDamage: 5.5,
  moraleDamageShare: .15,
  breakThreshold: 18,
  engagementDays: 2,
  engagementPressure: .55,
  retreatProtectionDays: 2,
  minimumPressureRatio: .2,
  maximumPressureRatio: 4,
  fortificationTempoScaling: 4,
  referenceTroops: 10000,
  minimumScaleTempo: .5,
  maximumScaleTempo: 3,
  terrainTempo: { plains: 1, forest: .8, jungle: .65, hills: .75, mountains: .32, desert: .85 },
} as const;
