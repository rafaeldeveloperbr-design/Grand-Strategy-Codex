import type { Army, Country, GameDate, Province } from '../../types';
import { UNIT_DEFINITIONS } from '../../data/units';
import type { ProvincialRebellion, RebellionFaction } from './types';
import { clamp, normalizeRebellion, rebellionDay, troopCount } from './rebellionUtils';
import { createObjective } from './rebellionSpawner';

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(item => typeof item === 'string');
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export function normalizeSavedRebellion(v: unknown): ProvincialRebellion {
  if (!record(v)) return normalizeRebellion();
  return normalizeRebellion({ progress: finite(v.progress) ? v.progress : 0, resentment: finite(v.resentment) ? v.resentment : 0,
    autonomy: finite(v.autonomy) ? v.autonomy : 0, reliefDays: finite(v.reliefDays) ? v.reliefDays : 0,
    investmentDays: finite(v.investmentDays) ? v.investmentDays : 0, suppressionDays: finite(v.suppressionDays) ? v.suppressionDays : 0,
    lastActionDay: finite(v.lastActionDay) ? v.lastActionDay : undefined, lastLogDay: finite(v.lastLogDay) ? v.lastLogDay : undefined,
    lastBand: finite(v.lastBand) ? v.lastBand : 0, factionId: typeof v.factionId === 'string' ? v.factionId : undefined });
}
export function isRebellionFaction(v: unknown): v is RebellionFaction {
  if (!record(v) || !record(v.objective)) return false;
  const objective = v.objective;
  return typeof v.id === 'string' && v.id.startsWith('rebel_v2_') && typeof v.owner === 'string' && typeof v.originalCountry === 'string'
    && typeof v.originProvince === 'string' && (v.restorationCountry === undefined || typeof v.restorationCountry === 'string')
    && strings(v.involvedProvinces) && finite(v.support) && finite(v.militaryStrength) && finite(v.formedDay)
    && ['peasants','separatists','pretenders','religious','revolutionaries','nationalists'].some(type => type === v.type)
    && ['active','defeated','victorious','negotiated'].some(status => status === v.status)
    && ['tax_relief','independence','replace_government','reform'].some(kind => kind === objective.kind)
    && strings(objective.targets) && finite(objective.heldDays) && objective.heldDays >= 0
    && finite(objective.requiredDays) && objective.requiredDays > 0;
}
export function normalizeSavedFactions(value: unknown): RebellionFaction[] {
  return Array.isArray(value) ? value.filter(isRebellionFaction).map(f => ({ ...f, support: clamp(f.support), militaryStrength: clamp(f.militaryStrength, 1000000),
    lastReinforcementDay: finite(f.lastReinforcementDay) ? f.lastReinforcementDay : undefined,
    reinforcementRate: finite(f.reinforcementRate) ? clamp(f.reinforcementRate, 1000000) : 0,
    recruitedTroops: finite(f.recruitedTroops) ? clamp(f.recruitedTroops, 1000000) : 0, objective: { ...f.objective } })) : [];
}
/** Convert legacy armies without losing troops, or violating regiment maximums. */
export function migrateLegacyRebels(provinces: Province[], countries: Country[], armies: Army[], date: GameDate) {
  const factions = countries.flatMap(c => c.rebellions ?? []);
  const migratedOwners = new Map<string, RebellionFaction>();
  armies = armies.map(army => {
    if (typeof army.owner !== 'string' || !army.owner.startsWith('rebel_')) return army;
    const faction = factions.find(f => f.id === army.owner);
    if (faction) return { ...army, rebellionFactionId: faction.id, originalOwner: faction.owner, separatistMode: false };
    const shared = migratedOwners.get(army.owner);
    if (shared) {
      countries = countries.map(c => ({ ...c, rebellions: c.rebellions?.map(f => f.id === shared.id ? { ...f, militaryStrength: f.militaryStrength + troopCount(army) } : f) }));
      return { ...army, owner: shared.id, originalOwner: shared.owner, rebellionFactionId: shared.id, separatistMode: false, regiments: normalizeRebelRegiments(army.regiments) };
    }
    const origin = provinces.find(p => p.id === army.location) ?? provinces.find(p => p.originalOwner === army.originalOwner);
    const country = countries.find(c => c.tag === origin?.owner && !c.tag.startsWith('rebel_')) ?? countries.find(c => c.tag === army.originalOwner);
    if (!origin || !country) return army; // Unsupported orphan remains on the compatibility path.
    const id = `rebel_v2_migrated_${army.id}`;
    const involved = provinces.filter(p => p.owner === army.owner || p.id === origin.id);
    const type = army.originalOwner && army.originalOwner !== country.tag ? 'separatists' : 'peasants';
    const migrated: RebellionFaction = { id, type, owner: country.tag, originalCountry: country.tag,
      restorationCountry: type === 'separatists' ? army.originalOwner : undefined,
      originProvince: origin.id, involvedProvinces: involved.map(p => p.id), support: clamp(origin.unrest ?? 50),
      militaryStrength: troopCount(army), formedDay: rebellionDay(date), status: 'active', objective: createObjective(type, involved, country, provinces) };
    factions.push(migrated);
    migratedOwners.set(army.owner, migrated);
    countries = countries.map(c => c.tag === country.tag ? { ...c, rebellions: [...(c.rebellions ?? []), migrated] } : c);
    provinces = provinces.map(p => involved.some(i => i.id === p.id) ? { ...p, owner: p.owner === army.owner ? id : p.owner, rebellion: { ...normalizeRebellion(p.rebellion), factionId: id } } : p);
    return { ...army, owner: id, originalOwner: country.tag, rebellionFactionId: id, separatistMode: false,
      regiments: normalizeRebelRegiments(army.regiments) };

  });
  const ids = new Set(countries.flatMap(c => c.rebellions ?? []).filter(f => f.status === 'active').map(f => f.id));
  provinces = provinces.map(p => p.rebellion?.factionId && !ids.has(p.rebellion.factionId) ? { ...p, rebellion: { ...normalizeRebellion(p.rebellion), factionId: undefined } } : p);
  // Synchronize indexes after migrating rebel occupation.
  countries = countries.map(c => {
    const controlled = provinces.filter(p => p.owner === c.tag).map(p => p.id);
    return { ...c, provinces: Array.from(new Set([...c.provinces.filter(id => controlled.includes(id)), ...controlled])) };
  });
  return { provinces, countries, armies };
}

function normalizeRebelRegiments(regiments: Army['regiments']): Army['regiments'] {
  return regiments.flatMap(regiment => {
    const definition = UNIT_DEFINITIONS[regiment.type], result: Army['regiments'] = [];
    for (let remaining = clamp(regiment.strength, 1000000); remaining > 0; remaining -= definition.maxStrength) {
      result.push({ ...regiment, strength: Math.min(remaining, definition.maxStrength), maxStrength: definition.maxStrength,
        organization: clamp(regiment.organization ?? definition.maxOrganization, definition.maxOrganization),
        morale: clamp(regiment.morale, definition.maxMorale), experience: clamp(regiment.experience ?? 0) });
    }
    return result;
  });
}
