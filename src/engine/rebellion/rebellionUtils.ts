import type { Army, Country, GameDate, Province } from '../../types';
import type { ProvincialRebellion, RebellionFaction } from './types';
export const clamp = (n: number, max = 100): number => Math.min(max, Math.max(0, Number.isFinite(n) ? n : 0));
export const rebellionDay = (d: GameDate): number => d.year * 360 + d.month * 30 + d.day;
export const troopCount = (a: Army): number => a.regiments.reduce((sum, r) => sum + r.strength, 0);
export function normalizeRebellion(value?: Partial<ProvincialRebellion>): ProvincialRebellion {
  return { progress: clamp(value?.progress ?? 0), resentment: clamp(value?.resentment ?? 0),
    autonomy: clamp(value?.autonomy ?? 0), reliefDays: clamp(value?.reliefDays ?? 0, 10000),
    investmentDays: clamp(value?.investmentDays ?? 0, 10000), suppressionDays: clamp(value?.suppressionDays ?? 0, 10000),
    lastActionDay: Number.isFinite(value?.lastActionDay) ? value!.lastActionDay! : -100000,
    lastLogDay: Number.isFinite(value?.lastLogDay) ? value!.lastLogDay! : -100000,
    lastBand: clamp(value?.lastBand ?? 0, 4), factionId: typeof value?.factionId === 'string' ? value.factionId : undefined };
}
export function friendlyTroops(p: Province, armies: Army[]): number {
  return armies.filter(a => a.owner === p.owner && a.location === p.id && !a.destination && !a.inCombat).reduce((sum, a) => sum + troopCount(a), 0);
}

/** Membership belongs to the faction, even when reconquest clears local progress. */
export function getProvinceRebellion(province: Province, countries: Country[]): RebellionFaction | undefined {
  const active = countries.flatMap(country => country.rebellions ?? []).filter(f => f.status === 'active');
  return active.find(f => f.id === province.rebellion?.factionId || f.id === province.owner)
    ?? active.find(f => f.involvedProvinces.includes(province.id));
}
