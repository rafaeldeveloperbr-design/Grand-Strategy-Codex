import type { ActiveBattle, Country, Province, War } from '../../types';
import type { AirProductionState, AirState, AircraftType } from '../../types/air';
import { AIR_BALANCE, AIR_PRODUCTION_CONFIG, AIR_QUEUE_LIMIT, AIR_PRODUCTION_AI as AI } from '../../data/aircraft';
import { payLocalProductionCost } from '../naval/construction';
import { airBaseByProvinceId, airBases } from './world';
import { getAirZoneControl, airZoneByProvinceId, type AirContext } from './index';

export const emptyAirProduction = (): AirProductionState => ({ queues: {}, nextId: 1 });
export function buildAirBaseOccupancy(state: AirState): Map<string, number> {
  const occupied = new Map<string, number>();
  for (const wing of state.wings) for (const base of [wing.baseProvinceId, ...(wing.rebase ? [wing.rebase.targetProvinceId] : [])]) occupied.set(base, (occupied.get(base) ?? 0) + 1);
  return occupied;
}
export function airBaseOccupancy(state: AirState, provinceId: string): number {
  return state.wings.filter(w => w.baseProvinceId === provinceId || w.rebase?.targetProvinceId === provinceId).length;
}
export function airProductionBlockReason(state: AirState, province: Province, country: Country, actor: string, type: AircraftType): string | null {
  if (!airBaseByProvinceId.has(province.id)) return 'Esta província não possui AirBase.';
  if (province.owner !== actor || country.tag !== actor || country.isAnnexed) return 'Produção requer controle próprio da AirBase.';
  if ((state.production?.queues[province.id]?.length ?? 0) >= AIR_QUEUE_LIMIT) return 'Fila aérea cheia (5).';
  const cost = AIR_PRODUCTION_CONFIG[type];
  if (!cost) return 'Tipo de aeronave inválido.';
  if (country.resources.gold < cost.gold) return 'Ouro insuficiente.';
  if ((province.market?.goods.iron.stock ?? 0) < cost.iron) return 'IRON local insuficiente.';
  if ((province.market?.goods.tools.stock ?? 0) < cost.tools) return 'TOOLS local insuficiente.';
  return null;
}
export function startAirProduction(state: AirState, provinces: Province[], countries: Country[], actor: string, provinceId: string, type: AircraftType) {
  const province = provinces.find(p => p.id === provinceId), country = countries.find(c => c.tag === actor);
  const error = !province || !country ? 'AirBase ou país inexistente.' : airProductionBlockReason(state, province, country, actor, type);
  if (error || !province || !country) return { state, provinces, countries, error };
  const production = state.production ?? emptyAirProduction();
  const order = { id: `air-build-${production.nextId}`, countryTag: actor, provinceId, type, progress: 0, requiredProgress: AIR_PRODUCTION_CONFIG[type].days };
  return {
    state: { ...state, production: { nextId: production.nextId + 1, queues: { ...production.queues, [provinceId]: [...(production.queues[provinceId] ?? []), order] } } },
    ...payLocalProductionCost(provinces, countries, provinceId, actor, AIR_PRODUCTION_CONFIG[type]), error: null,
  };
}
export function cancelAirProduction(state: AirState, id: string, actor: string): AirState {
  if (!state.production) return state;
  const queues = Object.fromEntries(Object.entries(state.production.queues).map(([base, orders]) => [base, orders.filter(o => o.id !== id || o.countryTag !== actor)]).filter(([, orders]) => orders.length));
  return { ...state, production: { ...state.production, queues } };
}
export interface AirProductionFeedback { owner: string; message: string }
/** Capture cleanup is also run after territory changes, without advancing progress twice. */
export function cleanupAirProduction(state: AirState, provinces: readonly Province[], countries: readonly Country[]) {
  const messages: AirProductionFeedback[] = [];
  if (!state.production || !Object.keys(state.production.queues).length) return { state, messages };
  const owners = new Map(provinces.map(p => [p.id, p.owner]));
  const alive = new Set(countries.filter(c => !c.isAnnexed).map(c => c.tag));
  const queues: AirProductionState['queues'] = {};
  for (const [base, orders] of Object.entries(state.production.queues)) {
    const valid = orders.filter(o => owners.get(base) === o.countryTag && alive.has(o.countryTag) && airBaseByProvinceId.has(base));
    for (const owner of new Set(orders.filter(o => !valid.includes(o)).map(o => o.countryTag))) messages.push({ owner, message: `Produção aérea cancelada: AirBase ${base} capturada ou indisponível. Sem reembolso.` });
    if (valid.length) queues[base] = valid;
  }
  return { state: { ...state, production: { ...state.production, queues } }, messages };
}
/** Only the FIFO head advances; completed heads wait safely for a free slot. */
export function processAirProductionTick(state: AirState, provinces: readonly Province[], countries: readonly Country[]) {
  const cleaned = cleanupAirProduction(state, provinces, countries);
  state = cleaned.state;
  const counters = { activeAirBuilds: 0, queuedAirBuilds: 0, completedAirWings: 0, waitingAirBuilds: 0 };
  if (!state.production || !Object.keys(state.production.queues).length) return { state, messages: cleaned.messages, counters };
  const occupied = buildAirBaseOccupancy(state);
  const wings = [...state.wings], queues: AirProductionState['queues'] = {};
  for (const [base, orders] of Object.entries(state.production.queues)) {
    const head = orders[0];
    counters.activeAirBuilds++; counters.queuedAirBuilds += orders.length - 1;
    const progress = Math.min(head.requiredProgress, head.progress + 1);
    if (progress < head.requiredProgress || (occupied.get(base) ?? 0) >= airBaseByProvinceId.get(base)!.capacity) {
      queues[base] = [{ ...head, progress }, ...orders.slice(1)];
      if (progress === head.requiredProgress) counters.waitingAirBuilds++;
      continue;
    }
    wings.push({ id: `wing-${head.id}`, countryTag: head.countryTag, name: `${head.countryTag} ${head.type} Wing ${head.id.slice('air-build-'.length)}`, type: head.type,
      aircraftCount: AIR_BALANCE.wingSize, maxAircraft: AIR_BALANCE.wingSize, strength: 100, organization: 100, baseProvinceId: base, status: 'READY' });
    occupied.set(base, (occupied.get(base) ?? 0) + 1);
    if (orders.length > 1) queues[base] = orders.slice(1);
    counters.completedAirWings++;
    cleaned.messages.push({ owner: head.countryTag, message: `${head.type} Wing concluída: 24 aeronaves na AirBase ${base}.` });
  }
  return { state: { ...state, wings, production: { ...state.production, queues } }, messages: cleaned.messages, counters };
}
/** One order per FULL nation per day; paid orders and existing wings both count. */
export function airProductionAI(state: AirState, provinces: Province[], countries: Country[], full: ReadonlySet<string>, player: string, wars: readonly War[], battles: readonly ActiveBattle[], relations: AirContext['relations'] = []) {
  let result = { state, provinces, countries };
  const byProvince = new Map(provinces.map(p => [p.id, p]));
  const occupied = buildAirBaseOccupancy(state);
  const basesByCountry = new Map<string, typeof airBases>();
  const counts = new Map<string, Record<AircraftType, number>>();
  for (const w of [...state.wings, ...Object.values(state.production?.queues ?? {}).flat()]) {
    const count = counts.get(w.countryTag) ?? { FIGHTER: 0, CAS: 0, BOMBER: 0, TRANSPORT_PLANE: 0 };
    count[w.type]++; counts.set(w.countryTag, count);
  }
  for (const base of airBases) { const owner = byProvince.get(base.provinceId)?.owner; if (owner) { const list = basesByCountry.get(owner) ?? []; list.push(base); basesByCountry.set(owner, list); } }
  const atWar = new Set(wars.flatMap(w => [w.attacker, w.defender]));
  const fighting = new Set(battles.flatMap(b => [b.attackerCountryId, b.defenderCountryId]));
  const ctx = { provinces, countries, wars, relations };
  for (const country of [...countries].sort((a,b)=>a.tag.localeCompare(b.tag))) {
    const tag = country.tag;
    if (tag === player || !full.has(tag) || country.isAnnexed || country.resources.gold < AI.reserve || country.economy.goldIncome <= country.economy.goldExpense) continue;
    const bases = basesByCountry.get(tag) ?? [];
    const count = counts.get(tag) ?? { FIGHTER: 0, CAS: 0, BOMBER: 0, TRANSPORT_PLANE: 0 };
    const total = Object.values(count).reduce((a, b) => a + b, 0);
    const cap = Math.min(atWar.has(tag) ? AI.warCap : AI.peaceCap, bases.reduce((sum, b) => sum + b.capacity, 0), Math.max(1, Math.floor(country.economy.goldIncome / AI.incomePerWing)));
    if (total >= cap) continue;
    const losing = atWar.has(tag) && bases.some(b => getAirZoneControl(state, airZoneByProvinceId.get(b.provinceId)?.id ?? '', tag, ctx).superiority < 0);
    const type: AircraftType = !count.FIGHTER || losing || count.FIGHTER <= count.CAS ? 'FIGHTER' : fighting.has(tag) || !count.CAS ? 'CAS' : count.BOMBER < Math.min(AI.bomberCap, atWar.has(tag) ? 2 : 1) ? 'BOMBER' : 'FIGHTER';
    const budget = Math.min(country.resources.gold * AI.dailyGoldFraction, country.resources.gold - AI.reserve);
    if (AIR_PRODUCTION_CONFIG[type].gold > budget) continue;
    for (const base of bases) {
      if (state.production?.queues[base.provinceId]?.length || (occupied.get(base.provinceId) ?? 0) >= base.capacity) continue;
      const next = startAirProduction(result.state, result.provinces, result.countries, tag, base.provinceId, type);
      if (!next.error) { result = next; break; }
    }
  }
  return result;
}
