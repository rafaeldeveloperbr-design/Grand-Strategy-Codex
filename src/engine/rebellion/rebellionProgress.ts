import { MAX_DAILY_REBELLION_PROGRESS, REBELLION_BALANCE as B } from './balance';
import { clamp } from './rebellionUtils';
export function unrestBand(unrest: number): number { return B.bands.filter(threshold => unrest >= threshold).length; }
export function advanceRebellionProgress(progress: number, unrest: number, militaryRatio = 0, suppressionDays = 0): number {
  return clamp(progress + Math.min(MAX_DAILY_REBELLION_PROGRESS, B.progressRates[unrestBand(unrest)]) - Math.min(1, militaryRatio) * B.garrisonProgress - (suppressionDays > 0 ? Math.min(1, militaryRatio) * B.suppressionRate : 0));
}
export function rebellionEconomicImpact(unrest: number, progress = 0, autonomy = 0, reliefDays = 0) {
  const pressure = clamp(unrest) / 100, organization = clamp(progress) / 100 * B.penalties.progress;
  return { goldMultiplier: Math.max(0.1, (1 - pressure * B.penalties.gold - organization) * (1 - clamp(autonomy) * B.autonomyRevenue) * (reliefDays > 0 ? B.reliefRevenue : 1)),
    manpowerMultiplier: Math.max(0.1, (1 - pressure * B.penalties.manpower - organization) * (1 - clamp(autonomy) * B.autonomyRevenue)),
    growthMultiplier: Math.max(0.1, 1 - pressure * B.penalties.growth - organization),
    productionMultiplier: Math.max(0.1, 1 - pressure * B.penalties.production - organization) };
}
