import type { ProposalKind } from '../../types';
import { DIPLOMACY_BALANCE as B } from './diplomacyBalance';
import { getRelation, diplomacyDay, relationKey, updateRelation } from './diplomacyRelations';
import { getAllies, getCountryWars, hasMilitaryAccess, isDiplomaticCountry } from './diplomacySelectors';
import { actionBlockReason, breakAlliance, breakNonAggressionPact, guaranteeIndependence, offerAgreement, proposalAction, respondAgreement } from './diplomacyActions';
import { callAllyToWar, respondToWarCall } from './diplomacyWar';
import type { DiplomacyContext } from './diplomacyTypes';
const currentCampaigns = (ctx: DiplomacyContext,tag: string): number => new Set(getCountryWars(ctx.wars,tag).map(w => w.campaignId ?? w.id)).size;

export function diplomaticPower(ctx: DiplomacyContext,tag: string): number {
  const troops = ctx.armies?.filter(a => a.owner === tag).reduce((sum,a) => sum+a.regiments.reduce((s,r) => s+r.strength,0),0) ?? 0;
  return Math.max(B.aiPowerFloor,troops+(ctx.countries.find(c => c.tag === tag)?.provinces.length ?? 0)*B.aiPowerFloor);
}
export function commonEnemy(ctx: DiplomacyContext,a: string,b: string): boolean {
  const enemies = (tag: string) => getCountryWars(ctx.wars,tag).map(w => w.attacker === tag ? w.defender : w.attacker);
  return enemies(a).some(e => enemies(b).includes(e));
}
export function shouldAcceptAgreement(ctx: DiplomacyContext,from: string,to: string,kind: Exclude<ProposalKind,'call'>): boolean {
  const r = getRelation(ctx.relations,from,to),opinion = r?.opinion ?? 0,trust = r?.trust ?? 50;
  if (!isDiplomaticCountry(ctx.countries.find(c => c.tag === to)) || r?.status === 'war') return false;
  const wars = currentCampaigns(ctx,to);
  if (kind === 'alliance') {
    const ratio = diplomaticPower(ctx,from)/diplomaticPower(ctx,to);
    return opinion >= B.allianceMinOpinion && trust >= B.allianceMinTrust && wars < B.aiMaxWars
      && (commonEnemy(ctx,from,to) || ratio >= B.aiAllianceMinPowerRatio && ratio <= B.aiAllianceMaxPowerRatio);
  }
  if (kind === 'nap') return opinion >= B.napMinOpinion && trust >= B.napMinTrust;
  // Do not provide transit to an enemy of a current ally or guarantied country.
  const hostileTransit = ctx.relations.some(rel => (rel.alliance || rel.guarantees?.includes(to)) && [rel.countryA,rel.countryB].includes(to)
    && getCountryWars(ctx.wars,from).some(w => [w.attacker,w.defender].includes(rel.countryA === to ? rel.countryB : rel.countryA)));
  return opinion >= B.militaryAccessMinOpinion && trust >= B.militaryAccessMinTrust && !hostileTransit;
}
export function shouldAcceptWarCall(ctx: DiplomacyContext,proposalId: string): boolean {
  const p = ctx.relations.flatMap(r => r.proposals ?? []).find(p => p.id === proposalId);
  const war = ctx.wars.find(w => w.id === p?.warId); if (!p || !war) return false;
  const r = getRelation(ctx.relations,p.from,p.to),defensive = war.defender === p.from;
  const enemy = defensive ? war.attacker : war.defender;
  if (currentCampaigns(ctx,p.to) >= B.aiMaxWars) return false;
  return (r?.trust ?? 0) >= (defensive ? B.aiDefensiveCallTrust : B.aiOffensiveCallTrust) && (r?.opinion ?? 0) >= B.napMinOpinion
    && (diplomaticPower(ctx,p.to)+diplomaticPower(ctx,p.from))/diplomaticPower(ctx,enemy) >= B.aiCallPowerRatio;
}
type ProactiveKind = Exclude<ProposalKind,'call'>;
export interface DiplomaticProposalCandidate {
  from: string; to: string; kind: ProactiveKind; score: number;
}
function areNeighbors(ctx: DiplomacyContext,a: string,b: string): boolean {
  const owners = new Map(ctx.provinces?.map(p => [p.id,p.owner]) ?? []);
  return ctx.provinces?.some(p => p.owner === a && p.neighbors.some(id => owners.get(id) === b)) ?? false;
}
function hasPoliticalTie(ctx: DiplomacyContext,a: string,b: string): boolean {
  const r = getRelation(ctx.relations,a,b),allies = getAllies(ctx.relations,a);
  return !!r?.alliance || !!r?.guarantees?.length || getAllies(ctx.relations,b).some(tag => allies.includes(tag));
}
function hasStrategicThreat(ctx: DiplomacyContext,a: string,b: string): boolean {
  const threshold = Math.max(diplomaticPower(ctx,a),diplomaticPower(ctx,b))*B.aiStrategicThreatPowerRatio;
  return ctx.countries.some(c => c.tag !== a && c.tag !== b && isDiplomaticCountry(c)
    && diplomaticPower(ctx,c.tag) >= threshold && areNeighbors(ctx,a,c.tag) && areNeighbors(ctx,b,c.tag)
    && [a,b].some(tag => {
      const r = getRelation(ctx.relations,tag,c.tag);
      return r?.status === 'war' || (r?.opinion ?? 0) <= B.aiThreatOpinionThreshold;
    }));
}
/** Read-only route utility: would this host open a corridor to an actual military
 * objective or reconnect owned territory? Does not change military pathfinding. */
export function hasUsefulMilitaryAccessRoute(ctx: DiplomacyContext,from: string,host: string): boolean {
  if (!ctx.provinces?.length) return false;
  const index = new Map(ctx.provinces.map(p => [p.id,p]));
  const country = ctx.countries.find(c => c.tag === from);
  const locations = ctx.armies?.filter(a => a.owner === from && a.location).map(a => a.location!) ?? [];
  const origins = locations.length ? locations : [country?.capitalId ?? country?.provinces[0]].filter((id): id is string => !!id);
  const reachable = (origin: string,withHost: boolean): Set<string> => {
    const visited = new Set<string>(),queue = [origin];
    if (!index.has(origin)) return visited;
    visited.add(origin);
    for (let cursor = 0; cursor < queue.length; cursor++) for (const id of index.get(queue[cursor])!.neighbors) {
      const p = index.get(id);
      if (!p || visited.has(id) || !(hasMilitaryAccess(ctx.relations,from,p.owner) || withHost && p.owner === host)) continue;
      visited.add(id); queue.push(id);
    }
    return visited;
  };
  const enemies = new Set(getCountryWars(ctx.wars,from).map(w => w.attacker === from ? w.defender : w.attacker));
  for (const origin of origins) {
    const before = reachable(origin,false),after = reachable(origin,true);
    if (ctx.provinces.some(p => p.owner === from && after.has(p.id) && !before.has(p.id))) return true;
    const bordersEnemy = (reachable: Set<string>,target: string) => [...reachable].some(id => index.get(id)!.neighbors.includes(target));
    if (ctx.provinces.some(p => enemies.has(p.owner) && bordersEnemy(after,p.id) && !bordersEnemy(before,p.id))) return true;
  }
  return false;
}
/** Proactive requirements are separate from player actions and AI acceptance. */
export function collectProactiveProposalCandidates(ctx: DiplomacyContext,playerTag: string): DiplomaticProposalCandidate[] {
  const day = diplomacyDay(ctx.date),valid = ctx.countries.filter(isDiplomaticCountry),candidates: DiplomaticProposalCandidate[] = [];
  const requirements = {
    alliance: [B.aiAllianceMinOpinion,B.aiAllianceMinTrust],
    nap: [B.aiNapMinOpinion,B.aiNapMinTrust],access: [B.aiAccessMinOpinion,B.aiAccessMinTrust],
  } as const;
  for (const a of valid.filter(c => c.tag !== playerTag)) for (const b of valid.filter(c => c.tag !== a.tag)) {
    const r = getRelation(ctx.relations,a.tag,b.tag);
    if (!r || r.proposals?.some(p => p.kind !== 'call' && p.expiresAt > day)) continue;
    const neighbor = areNeighbors(ctx,a.tag,b.tag),enemy = commonEnemy(ctx,a.tag,b.tag),political = hasPoliticalTie(ctx,a.tag,b.tag);
    const threat = hasStrategicThreat(ctx,a.tag,b.tag);
    for (const kind of ['alliance','nap','access'] as const) {
      if ((r.cooldowns?.[`${a.tag}:aiProposalRetry:${kind}`] ?? -Infinity) > day) continue;
      const [opinion,trust] = requirements[kind];
      if (r.opinion < opinion || r.trust < trust || actionBlockReason(ctx,a.tag,b.tag,proposalAction[kind]) || !shouldAcceptAgreement(ctx,a.tag,b.tag,kind)) continue;
      const usefulRoute = kind === 'access' && hasUsefulMilitaryAccessRoute(ctx,a.tag,b.tag);
      if (kind === 'alliance' && !(neighbor || enemy || threat)) continue;
      if (kind === 'nap' && (r.alliance || !(neighbor || enemy || threat || political))) continue;
      if (kind === 'access' && !usefulRoute) continue;
      const weights = B.aiProposalScore;
      candidates.push({from: a.tag,to: b.tag,kind,score: r.opinion*weights.opinion+r.trust*weights.trust+weights[kind]
        +(neighbor ? weights.neighbor : 0)+(enemy ? weights.commonEnemy : 0)+(threat ? weights.strategicThreat : 0)
        +(political ? weights.politicalTie : 0)+(usefulRoute ? weights.usefulRoute : 0)});
    }
  }
  return candidates.sort((a,b) => b.score-a.score || a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
}
/** Deterministic decisions, persisted per-action cooldowns, no daily proposal spam. */
export function processDiplomacyAI(ctx: DiplomacyContext,playerTag: string) {
  let next = ctx; const messages: string[] = [];
  const apply = (r: ReturnType<typeof respondAgreement>) => { next = {...next,relations: r.relations,wars: r.wars}; if (r.ok) messages.push(r.message); };
  for (const p of ctx.relations.flatMap(r => r.proposals ?? [])) {
    if (p.to === playerTag || p.expiresAt <= diplomacyDay(ctx.date)) continue;
    apply(p.kind === 'call' ? respondToWarCall(next,p.id,shouldAcceptWarCall(next,p.id)) : respondAgreement(next,p.from,p.to,p.kind,shouldAcceptAgreement(next,p.from,p.to,p.kind)));
  }
  const day = diplomacyDay(ctx.date);
  // Keep the existing cadence of guarantees, calls and extreme-agreement breaks.
  if (day % B.aiMaintenanceInterval !== 0) return {...next,messages};
  const valid = ctx.countries.filter(isDiplomaticCountry);
  for (const a of valid.filter(c => c.tag !== playerTag)) {
    for (const b of valid.filter(c => c.tag !== a.tag)) {
      const r = getRelation(next.relations,a.tag,b.tag);
      if (r && r.opinion <= -75 && r.trust < B.napMinTrust) {
        if (r.alliance) apply(breakAlliance(next,a.tag,b.tag));
        if (r.nonAggressionPact) apply(breakNonAggressionPact(next,a.tag,b.tag));
        continue;
      }
      if (r && r.opinion >= B.guaranteeMinOpinion && r.trust >= B.guaranteeMinTrust
        && diplomaticPower(next,a.tag) > diplomaticPower(next,b.tag) && getCountryWars(next.wars,a.tag).length === 0) apply(guaranteeIndependence(next,a.tag,b.tag));
      if (r?.alliance) for (const war of getCountryWars(next.wars,a.tag)) apply(callAllyToWar(next,a.tag,b.tag,war.id));
    }
  }
  if (day % B.aiInterval !== 0) return {...next,messages};
  // A small marker in the existing cooldown map preserves this cycle's budget
  // even when proposals are accepted/declined or a save is reloaded the same day.
  const cycleUntil = day+B.aiInterval;
  let sent = next.relations.reduce((count,r) => count+Object.entries(r.cooldowns ?? [])
    .filter(([key,until]) => key.includes(':aiProposal:') && until === cycleUntil).length,0);
  const selectedPairs = new Set<string>();
  for (const candidate of collectProactiveProposalCandidates(next,playerTag)) {
    if (sent >= B.aiMaxProposalsPerCycle) break;
    const {from,to,kind} = candidate,key = relationKey(from,to);
    if (selectedPairs.has(key) || getRelation(next.relations,from,to)?.proposals?.some(p => p.kind !== 'call' && p.expiresAt > day)) continue;
    const offer = offerAgreement(next,from,to,kind); if (!offer.ok) continue;
    const action = proposalAction[kind];
    offer.relations = updateRelation(offer.relations,from,to,r => ({...r,cooldowns: {...r.cooldowns,
      [`${from}:${action}`]: day+B.aiProposalCooldown,[`${from}:aiProposal:${action}`]: cycleUntil},
      proposals: r.proposals?.map(p => p.from === from && p.to === to && p.kind === kind && to === playerTag ? {...p,aiToPlayer: true} : p)}));
    apply(offer); selectedPairs.add(key); sent++;
  }
  return {...next,messages};
}
