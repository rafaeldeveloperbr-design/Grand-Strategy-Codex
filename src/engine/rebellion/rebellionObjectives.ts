import type { Army, Country, Province } from '../../types';
import { transferProvince, type TerritoryTransferState } from '../territoryTransfer';
import { forcedGovernmentChange } from '../politics';
import { REBELLION_BALANCE as B } from './balance';
import { normalizeRebellion, troopCount } from './rebellionUtils';
import type { RebellionFaction } from './types';

/** Ownership is authoritative, including split armies whose optional link was lost. */
export const belongsToRebellion = (army: Army, id: string) => army.owner === id;

const holdsObjectives = (faction: RebellionFaction, provinces: Province[], armies: Army[]) => faction.objective.targets.length > 0
  && faction.objective.targets.every(id => provinces.some(p => p.id === id && p.owner === faction.id)
    && !armies.some(a => a.location === id && a.owner === faction.owner && troopCount(a) > 0));

export function advanceObjective(faction: RebellionFaction, provinces: Province[], armies: Army[], day?: number): RebellionFaction {
  const militaryStrength = armies.filter(a => belongsToRebellion(a, faction.id)).reduce((sum, a) => sum + troopCount(a), 0);
  if (faction.status !== 'active') return faction;
  const territory = provinces.filter(p => p.owner === faction.id).map(p => p.id).sort();
  const base = provinces.find(p => p.id === (faction.baseProvince ?? faction.originProvince));
  const forming = !faction.territoryEstablished && !faction.cleanupPending && base?.rebellion?.factionId === faction.id
    && armies.some(a => a.owner === faction.id && a.location === base.id && troopCount(a) > 0 && (a.inCombat || day === undefined || day === faction.formedDay));
  if (faction.cleanupPending || (!territory.length && !forming)) return { ...faction, baseProvince: undefined, cleanupPending: true, reinforcementRate: 0, militaryStrength: 0, objective: { ...faction.objective, heldDays: 0 }, status: 'defeated' };
  if (territory.length) faction = { ...faction, territoryEstablished: true,
    baseProvince: territory.includes(faction.baseProvince ?? faction.originProvince) ? (faction.baseProvince ?? faction.originProvince) : territory[0] };
  if (day !== undefined && faction.lastObjectiveDay === day) return { ...faction, militaryStrength };
  const holds = holdsObjectives(faction, provinces, armies);
  const heldDays = holds ? faction.objective.heldDays + 1 : 0;
  return { ...faction, militaryStrength, lastObjectiveDay: day, objective: { ...faction.objective, heldDays }, status: holds && heldDays >= faction.objective.requiredDays ? 'victorious' : 'active' };
}
/** Restoration uses existing country records; unsupported dynamic nations receive autonomy. */
export function resolveRebellion(faction: RebellionFaction, provinces: Province[], countries: Country[], armies: Army[]) {
  // Cleanup is never a substitute for proving a terminal condition.
  if (faction.status === 'active'
    || faction.status === 'defeated' && (provinces.some(p => p.owner === faction.id) || !faction.cleanupPending && armies.some(a => belongsToRebellion(a, faction.id) && troopCount(a) > 0))
    || faction.status === 'victorious' && (!holdsObjectives(faction, provinces, armies) || faction.objective.heldDays < faction.objective.requiredDays)) return { provinces, countries, armies };
  const victory = faction.status === 'victorious';
  const restored = victory && faction.objective.kind === 'independence' && faction.restorationCountry && countries.some(c => c.tag === faction.restorationCountry);
  const recipient = restored ? faction.restorationCountry! : faction.owner;
  let territory: TerritoryTransferState = { provinces, countries, recruitments: [], constructions: [] };
  for (const p of provinces.filter(p => p.owner === faction.id)) territory = transferProvince(territory, p.id, recipient, { liberation: true });
  const affected = new Set([...faction.involvedProvinces, ...provinces.filter(p => p.owner === faction.id).map(p => p.id)]);
  return { provinces: territory.provinces.map(p => affected.has(p.id) ? { ...p, unrest: victory ? Math.min(p.unrest ?? 0, B.resolvedUnrest.victory) : p.unrest, rebellion: {
    ...normalizeRebellion(p.rebellion), factionId: undefined, progress: victory ? B.victoryProgress : B.defeatProgress,
    reliefDays: victory ? B.reliefDays : 0,
    autonomy: victory && faction.objective.kind === 'independence' && !restored ? B.autonomyGrant : normalizeRebellion(p.rebellion).autonomy,
  } } : p),
    armies: armies.filter(a => !belongsToRebellion(a, faction.id)),
    countries: territory.countries.map(c => {
      if (c.tag === recipient && restored) return { ...c, isAnnexed: false };
      if (c.tag !== faction.owner || !victory) return c;
      const kind = faction.objective.kind;
      const government = kind === 'replace_government' || kind === 'reform' ? forcedGovernmentChange(c,kind) : c;
      return { ...government, resources: { ...government.resources, prestige: c.resources.prestige - B.repressionPrestige },
        activeLaws: { ...c.activeLaws, taxation: kind === 'tax_relief' ? 'taxation_low' : c.activeLaws.taxation,
          governance: kind === 'replace_government' ? 'governance_balanced' : kind === 'reform' ? 'governance_decentralized' : c.activeLaws.governance } };
    }) };
}
