import type { Army, Country, Province, War } from '../types';
import type { DiplomaticRelation } from '../types/diplomacy';
import type { GameDate } from '../types/date';
import { diplomacyDay } from './diplomacy/diplomacyRelations';

export type SimulationTier = 'FULL' | 'PASSIVE';
export type ActivationReason = 'player' | 'strategicPowers' | 'warCountries' | 'neighborCountries' | 'relationCountries' | 'rebellionCountries';
export const DEFAULT_STRATEGIC_POWERS = 24;
export type SimulationActivationInput = {
  countries: Country[]; provinces: Province[]; armies: Army[]; wars: War[];
  relations: DiplomaticRelation[]; playerCountryTag: string; strategicPowerCount?: number; date?: GameDate;
};

/** Derived, read-only state. Rebuild after diplomacy and territory changes; never save it. */
export function buildSimulationActivation(input: SimulationActivationInput) {
  const { countries, provinces, armies, wars, relations, playerCountryTag } = input;
  const countryByTag = new Map(countries.map(c => [c.tag, c]));
  const provinceById = new Map(provinces.map(p => [p.id, p]));
  const day = input.date ? diplomacyDay(input.date) : undefined;
  const population = new Map<string, number>(), holdings = new Map<string, number>(), troops = new Map<string, number>();
  const fullCountryTags = new Set<string>();
  const reasonsByCountry = new Map<string, Set<ActivationReason>>();
  const counts: Record<ActivationReason, number> = { player: 0, strategicPowers: 0, warCountries: 0, neighborCountries: 0, relationCountries: 0, rebellionCountries: 0 };
  const activate = (tag: string, reason: ActivationReason) => {
    if (!countryByTag.has(tag)) return;
    const reasons = reasonsByCountry.get(tag) ?? new Set<ActivationReason>();
    if (!reasons.has(reason)) counts[reason]++;
    reasons.add(reason); reasonsByCountry.set(tag, reasons); fullCountryTags.add(tag);
  };
  activate(playerCountryTag, 'player');
  for (const p of provinces) {
    if (p.owner.startsWith('rebel_') && p.originalOwner) activate(p.originalOwner, 'rebellionCountries');
    population.set(p.owner, (population.get(p.owner) ?? 0) + p.population.total);
    holdings.set(p.owner, (holdings.get(p.owner) ?? 0) + 1);
    if (p.owner === playerCountryTag) for (const id of p.neighbors) {
      const owner = provinceById.get(id)?.owner;
      if (owner && owner !== playerCountryTag) activate(owner, 'neighborCountries');
    }
  }
  for (const a of armies) {
    troops.set(a.owner, (troops.get(a.owner) ?? 0) + a.regiments.reduce((sum, r) => sum + r.strength, 0));
    if (a.rebellionFactionId || a.separatistMode || a.owner.startsWith('rebel_')) {
      activate(a.owner, 'rebellionCountries');
      if (a.originalOwner) activate(a.originalOwner, 'rebellionCountries');
      const host = a.location ? provinceById.get(a.location)?.owner : undefined;
      if (host) activate(host, 'rebellionCountries');
    }
  }
  for (const c of countries) for (const faction of c.rebellions ?? []) if (faction.status === 'active') {
    activate(c.tag, 'rebellionCountries'); activate(faction.originalCountry, 'rebellionCountries'); activate(faction.owner, 'rebellionCountries');
  }
  for (const w of wars) { activate(w.attacker, 'warCountries'); activate(w.defender, 'warCountries'); }
  for (const r of relations) {
    const playerPair = r.countryA === playerCountryTag || r.countryB === playerCountryTag;
    if (playerPair && (r.status === 'war' || r.alliance || r.nonAggressionPact && (day === undefined || r.nonAggressionPact.expiresAt > day) || r.militaryAccess?.length || r.guarantees?.length)) {
      activate(r.countryA, 'relationCountries'); activate(r.countryB, 'relationCountries');
    }
    // External proposals activate recipients before strategic responses, including war calls.
    for (const p of r.proposals ?? []) {
      if (day !== undefined && p.expiresAt <= day) continue;
      activate(p.to, 'relationCountries');
      if (p.to === playerCountryTag || p.from === playerCountryTag || p.kind === 'call') activate(p.from, 'relationCountries');
    }
  }
  // Activation score only: population/100k + daily gross income + manpower/1k
  // + army strength/1k + 10 per currently owned province. Tag breaks ties.
  const strategicRanking = countries.filter(c => c.tag !== playerCountryTag && !c.isAnnexed).map(c => ({ tag: c.tag,
    score: (population.get(c.tag) ?? 0) / 100000 + Math.max(0, c.economy.goldIncome)
      + Math.max(0, c.resources.manpower) / 1000 + (troops.get(c.tag) ?? 0) / 1000 + (holdings.get(c.tag) ?? 0) * 10,
  })).sort((a, b) => b.score - a.score || (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  for (const c of strategicRanking.slice(0, Math.max(0, input.strategicPowerCount ?? DEFAULT_STRATEGIC_POWERS))) activate(c.tag, 'strategicPowers');
  const tierByCountry = new Map<string, SimulationTier>(countries.map(c => [c.tag, fullCountryTags.has(c.tag) ? 'FULL' : 'PASSIVE']));
  return { fullCountryTags, tierByCountry, reasonsByCountry, strategicRanking,
    summary: { totalCountries: countries.length, fullCountries: fullCountryTags.size, passiveCountries: countries.length - fullCountryTags.size, ...counts } };
}
export type SimulationActivation = ReturnType<typeof buildSimulationActivation>;
