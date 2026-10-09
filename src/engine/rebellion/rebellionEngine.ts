import type { Army, Country, GameDate, Province, War } from '../../types';
import type { DiplomaticRelation } from '../../types/diplomacy';
import { startInternalWar } from '../diplomacy';
import { normalizePopulation } from '../population';
import { REBELLION_NOTIFICATION_MILESTONES, REBELLION_BALANCE as B } from './balance';
import { politicalRebellionPressure } from '../politics';
import { calculateUnrest } from './unrestEngine';
import { advanceRebellionProgress } from './rebellionProgress';
import { clamp, friendlyTroops, normalizeRebellion, rebellionDay, troopCount } from './rebellionUtils';
import { calculateRebellionStrength, createObjective, createRebelArmy, groupRebellion, nationalMilitaryStrength, selectRebelType } from './rebellionSpawner';
import { advanceObjective, resolveRebellion } from './rebellionObjectives';
import type { RebellionFaction } from './types';
import { transferProvince } from '../territoryTransfer';
import type { Recruitment, BuildingConstruction } from '../../types';
import { REBEL_TYPE_LABELS, OBJECTIVE_LABELS } from './feedback';

export function processProvincialPressure(provinces: Province[], date: GameDate, armies: Army[], countries: Country[] = [], wars: War[] = []) {
  const logs: string[] = [], day = rebellionDay(date);
  const politicalPressure = new Map(countries.map(c => [c.tag,politicalRebellionPressure(c,{provinces,armies,wars})]));
  const updatedProvinces = provinces.map(p => {
    // Rebel occupation remains attached to the original faction and country.
    const state = normalizeRebellion(p.rebellion);
    if (p.owner.startsWith('rebel_')) return { ...p, rebellion: state };
    const explanation = calculateUnrest(p, date, armies, countries.find(c => c.tag === p.owner), wars, politicalPressure.get(p.owner));
    const unrest = clamp((p.unrest ?? 0) + (explanation.total - (p.unrest ?? 0)) * B.pressureRate);
    const ratio = friendlyTroops(p, armies) / Math.max(1, normalizePopulation(p.population).total * B.garrisonPopulationRatio);
    const progress = state.factionId ? state.progress : advanceRebellionProgress(state.progress, unrest, ratio, state.suppressionDays);
    const band = REBELLION_NOTIFICATION_MILESTONES.filter(t => progress >= t).length;
    const milestone = REBELLION_NOTIFICATION_MILESTONES[band - 1] ?? 0;
    const log = state.progress < milestone && (milestone > (state.notifiedMilestone ?? 0) || day - state.lastLogDay >= B.logDays);
    if (log) logs.push(`${['', 'Tensão crescente', 'Agitação severa', 'Rebelião iminente', 'Situação crítica'][band]} em ${p.name} (organização ${Math.round(progress)}%).`);
    return { ...p, unrest, unrestExplanation: explanation, rebellion: { ...state, progress,
      resentment: clamp(state.resentment - B.resentmentDecay), autonomy: clamp(state.autonomy - B.autonomyDecay),
      reliefDays: Math.max(0, state.reliefDays - 1), investmentDays: Math.max(0, state.investmentDays - 1), suppressionDays: Math.max(0, state.suppressionDays - 1),
      notifiedMilestone: log ? Math.max(milestone, state.notifiedMilestone ?? 0) : state.notifiedMilestone, lastBand: band, lastLogDay: log ? day : state.lastLogDay } };
  });
  return { updatedProvinces, revoltedProvinces: updatedProvinces.filter(p => !p.owner.startsWith('rebel_') && !p.rebellion.factionId && p.rebellion.progress >= B.progressLimit), logs };
}
export function spawnRebellions(provinces: Province[], countries: Country[], armies: Army[], wars: War[], relations: DiplomaticRelation[], date: GameDate) {
  const logs: string[] = [];
  const createdFactionIds: string[] = [];
  for (const faction of countries.flatMap(c => c.rebellions ?? []).filter(f => f.status === 'active')) {
    if (!wars.some(w => (w.attacker === faction.id && w.defender === faction.owner) || (w.defender === faction.id && w.attacker === faction.owner))) ({ wars, relations } = startInternalWar(relations, wars, faction.id, faction.owner, date));
  }
  for (const origin of provinces) {
    const p = provinces.find(p => p.id === origin.id)!;
    if (p.owner.startsWith('rebel_') || p.rebellion?.factionId || (p.rebellion?.progress ?? 0) < B.progressLimit) continue;
    const country = countries.find(c => c.tag === p.owner);
    if (!country) continue;
    const group = groupRebellion(p, provinces, country, armies), type = selectRebelType(p, country, provinces, armies);
    const day = rebellionDay(date), id = `rebel_v2_${country.tag}_${p.id}_${day}`;
    const faction: RebellionFaction = { id, type, originProvince: p.id, baseProvince: p.id, involvedProvinces: group.map(p => p.id), owner: country.tag,
      originalCountry: country.tag, restorationCountry: type === 'separatists' ? p.originalOwner : undefined,
      support: group.reduce((sum, p) => sum + (p.unrest ?? 0), 0) / group.length,
      militaryStrength: calculateRebellionStrength(group, type, nationalMilitaryStrength(country, armies)),
      objective: createObjective(type, group, country, provinces), status: 'active', formedDay: day };
    armies = [...armies, createRebelArmy(faction, p)];
    provinces = provinces.map(pr => faction.involvedProvinces.includes(pr.id) ? { ...pr, rebellion: { ...normalizeRebellion(pr.rebellion), factionId: id } } : pr);
    countries = countries.map(c => c.tag === country.tag ? { ...c, rebellions: [...(c.rebellions ?? []), faction] } : c);
    ({ wars, relations } = startInternalWar(relations, wars, id, country.tag, date));
    createdFactionIds.push(id);
    logs.push(`Facção de ${REBEL_TYPE_LABELS[type]} formada em ${p.name}: ${faction.militaryStrength} tropas, ${group.length} província(s).`);
  }
  return { provinces, countries, armies, wars, relations, logs, createdFactionIds };
}
export function processRebellionObjectives(provinces: Province[], countries: Country[], armies: Army[], wars: War[], relations: DiplomaticRelation[], date: GameDate = { day: 1, month: 1, year: 1 }, recruitments: Recruitment[] = [], constructions: BuildingConstruction[] = []) {
  const logs: string[] = [];
  const active = new Map(countries.flatMap(c => c.rebellions ?? []).filter(f => f.status === 'active').map(f => [f.id, f]));
  armies = armies.map(a => active.has(a.owner) ? { ...a, rebellionFactionId: a.owner, originalOwner: active.get(a.owner)!.owner, separatistMode: false } : a);
  // A newly raised, unopposed army establishes control through the same transfer
  // operation as military arrival. Defended provinces are resolved by combat.
  for (const army of armies.filter(a => a.rebellionFactionId && a.location && !a.inCombat && !a.destination && troopCount(a) > 0)) {
    const faction = countries.flatMap(c => c.rebellions ?? []).find(f => f.id === army.rebellionFactionId && f.status === 'active');
    const province = provinces.find(p => p.id === army.location);
    if (!province || !faction || faction.cleanupPending || (faction.territoryEstablished && !provinces.some(p => p.owner === faction.id)) || (!faction.territoryEstablished && (province.id !== (faction.baseProvince ?? faction.originProvince) || faction.formedDay !== rebellionDay(date))) || province.owner !== faction.owner || armies.some(a => a.owner === faction.owner && a.location === province.id && troopCount(a) > 0)) continue;
    const transferred = transferProvince({ provinces, countries, recruitments, constructions }, province.id, faction.id, { date });
    ({ provinces, countries, recruitments, constructions } = transferred);
    logs.push(`Rebeldes tomaram ${province.name}.`);
  }
  for (const country of countries) for (const faction of country.rebellions ?? []) {
    if (faction.status !== 'active') continue;
    let next = advanceObjective(faction, provinces, armies, rebellionDay(date));
    if (next.status !== 'active') {
      next = { ...next, resolution: { reason: next.status === 'defeated' ? 'military_defeat' : 'objective_completed', day: rebellionDay(date) } };
      ({ provinces, countries, armies } = resolveRebellion(next, provinces, countries, armies));
      wars = wars.filter(w => w.attacker !== faction.id && w.defender !== faction.id);
      relations = relations.filter(r => r.countryA !== faction.id && r.countryB !== faction.id);
      logs.push(next.status === 'defeated' ? `Rebelião derrotada em ${provinces.find(p => p.id === faction.originProvince)?.name}.` : `Rebelião de ${REBEL_TYPE_LABELS[faction.type]} venceu: ${OBJECTIVE_LABELS[faction.objective.kind]}.`);
    } else if (next.objective.heldDays === 1 && faction.objective.heldDays !== 1) logs.push(`Rebeldes controlam os objetivos da facção de ${REBEL_TYPE_LABELS[faction.type]}.`);
    countries = countries.map(c => c.tag === country.tag ? { ...c, rebellions: c.rebellions?.map(f => f.id === next.id ? next : f) } : c);
  }
  // Negotiation can be invoked through the public action API between ticks.
  const ended = new Set(countries.flatMap(c => c.rebellions ?? []).filter(f => f.status !== 'active').map(f => f.id));
  const knownActive = new Set(countries.flatMap(c => c.rebellions ?? []).filter(f => f.status === 'active').map(f => f.id));
  // Repair terminal/missing faction occupations in old or inconsistent saves.
  const records = new Map(countries.flatMap(c => c.rebellions ?? []).map(f => [f.id, f]));
  const countriesByTag = new Set(countries.map(c => c.tag));
  const historicalOwners = new Map(armies.filter(a => a.originalOwner).map(a => [a.owner, a.originalOwner!]));
  for (const p of provinces) {
    if (!p.owner.startsWith('rebel_v2_') || knownActive.has(p.owner)) continue;
    const recipient = records.get(p.owner)?.owner ?? historicalOwners.get(p.owner) ?? p.originalOwner;
    if (!recipient || recipient.startsWith('rebel_') || !countriesByTag.has(recipient)) continue;
    ({ provinces, countries, recruitments, constructions } = transferProvince({ provinces, countries, recruitments, constructions }, p.id, recipient, { date }));
  }
  armies = armies.filter(a => !ended.has(a.owner) && (!a.owner.startsWith('rebel_v2_') || knownActive.has(a.owner)));
  provinces = provinces.map(p => p.rebellion?.factionId && !knownActive.has(p.rebellion.factionId) ? { ...p, rebellion: { ...normalizeRebellion(p.rebellion), factionId: undefined, progress: B.defeatProgress } } : p);
  return { provinces, countries, armies, recruitments, constructions, wars: wars.filter(w => !ended.has(w.attacker) && !ended.has(w.defender)), relations: relations.filter(r => !ended.has(r.countryA) && !ended.has(r.countryB)), logs };
}

