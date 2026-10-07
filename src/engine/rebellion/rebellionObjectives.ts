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
  if (militaryStrength <= 0 && !provinces.some(p => p.owner === faction.id)) return { ...faction, militaryStrength, status: 'defeated' };
  if (day !== undefined && faction.lastObjectiveDay === day) return { ...faction, militaryStrength };
  const holds = holdsObjectives(faction, provinces, armies);
  const heldDays = holds ? faction.objective.heldDays + 1 : 0;
  return { ...faction, militaryStrength, lastObjectiveDay: day, objective: { ...faction.objective, heldDays }, status: holds && heldDays >= faction.objective.requiredDays ? 'victorious' : 'active' };
}
/** Restoration uses existing country records; unsupported dynamic nations receive autonomy. */
export function resolveRebellion(faction: RebellionFaction, provinces: Province[], countries: Country[], armies: Army[]) {
  // Cleanup is never a substitute for proving a terminal condition.
  if (faction.status === 'active'
    || faction.status === 'defeated' && (armies.some(a => belongsToRebellion(a, faction.id) && troopCount(a) > 0) || provinces.some(p => p.owner === faction.id))
    || faction.status === 'victorious' && (!holdsObjectives(faction, provinces, armies) || faction.objective.heldDays < faction.objective.requiredDays)) return { provinces, countries, armies };
  const victory = faction.status === 'victorious';
  const restored = victory && faction.objective.kind === 'independence' && faction.restorationCountry && countries.some(c => c.tag === faction.restorationCountry);
  const recipient = restored ? faction.restorationCountry! : faction.owner;
  let territory: TerritoryTransferState = { provinces, countries, recruitments: [], constructions: [] };
  for (const p of provinces.filter(p => p.owner === faction.id)) territory = transferProvince(territory, p.id, recipient, { liberation: true });
  const affected = new Set([...faction.involvedProvinces, ...provinces.filter(p => p.owner === faction.id).map(p => p.id)]);
  return { provinces: territory.provinces.map(p => affected.has(p.id) ? { ...p, unrest: Math.min(p.unrest ?? 0, victory ? B.resolvedUnrest.victory : B.resolvedUnrest.defeat), rebellion: {
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
