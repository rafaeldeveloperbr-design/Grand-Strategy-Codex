// Frozen pre-activation diplomacy baseline.
import { DiplomacyAIIndex } from '../../diplomacy/diplomacyAIIndex';
import { createDiplomacyAIProfiler, type DiplomacyAIProfiler } from '../../performance/diplomacyAIProfiler';
import type { ProposalKind } from '../../../types';
import { DIPLOMACY_BALANCE as B } from '../../diplomacy/diplomacyBalance';
import { getRelation, diplomacyDay, relationKey, updateRelation } from '../../diplomacy/diplomacyRelations';
import { getAllies, getCountryWars, hasMilitaryAccess, isDiplomaticCountry } from '../../diplomacy/diplomacySelectors';
import { actionBlockReason, breakAlliance, breakNonAggressionPact, guaranteeIndependence, offerAgreement, proposalAction, respondAgreement } from '../../diplomacy/diplomacyActions';
import { callAllyToWar, respondToWarCall } from '../../diplomacy/diplomacyWar';
import type { DiplomacyContext } from '../../diplomacy/diplomacyTypes';
const currentCampaigns = (ctx: DiplomacyContext,tag: string,index?: DiplomacyAIIndex): number => index ? (index.campaignsByTag.get(tag)?.size ?? 0) : new Set(getCountryWars(ctx.wars,tag).map(w => w.campaignId ?? w.id)).size;

export function diplomaticPower(ctx: DiplomacyContext,tag: string,index?: DiplomacyAIIndex): number {
  if (index) return index.power(tag);
  const troops = ctx.armies?.filter(a => a.owner === tag).reduce((sum,a) => sum+a.regiments.reduce((s,r) => s+r.strength,0),0) ?? 0;
  return Math.max(B.aiPowerFloor,troops+(ctx.countries.find(c => c.tag === tag)?.provinces.length ?? 0)*B.aiPowerFloor);
}
export function commonEnemy(ctx: DiplomacyContext,a: string,b: string,index?: DiplomacyAIIndex): boolean {
  if (index) return [...(index.enemiesByTag.get(a) ?? [])].some(enemy => index.enemiesByTag.get(b)?.has(enemy));
  const enemies = (tag: string) => getCountryWars(ctx.wars,tag).map(w => w.attacker === tag ? w.defender : w.attacker);
  return enemies(a).some(e => enemies(b).includes(e));
}
export function shouldAcceptAgreement(ctx: DiplomacyContext,from: string,to: string,kind: Exclude<ProposalKind,'call'>,index?: DiplomacyAIIndex): boolean {
  const r = index ? index.relation(from,to) : getRelation(ctx.relations,from,to),opinion = r?.opinion ?? 0,trust = r?.trust ?? 50;
  if (!isDiplomaticCountry(index ? index.countryByTag.get(to) : ctx.countries.find(c => c.tag === to)) || r?.status === 'war') return false;
  const wars = currentCampaigns(ctx,to,index);
  if (kind === 'alliance') {
    const ratio = diplomaticPower(ctx,from,index)/diplomaticPower(ctx,to,index);
    return opinion >= B.allianceMinOpinion && trust >= B.allianceMinTrust && wars < B.aiMaxWars
      && (commonEnemy(ctx,from,to,index) || ratio >= B.aiAllianceMinPowerRatio && ratio <= B.aiAllianceMaxPowerRatio);
  }
  if (kind === 'nap') return opinion >= B.napMinOpinion && trust >= B.napMinTrust;
  // Do not provide transit to an enemy of a current ally or guarantied country.
  const hostileTransit = (index ? index.relationsByCountry.get(to) ?? [] : ctx.relations).some(rel => (rel.alliance || rel.guarantees?.includes(to)) && [rel.countryA,rel.countryB].includes(to)
    && (index ? index.warsByCountry.get(from) ?? [] : getCountryWars(ctx.wars,from)).some(w => [w.attacker,w.defender].includes(rel.countryA === to ? rel.countryB : rel.countryA)));
  return opinion >= B.militaryAccessMinOpinion && trust >= B.militaryAccessMinTrust && !hostileTransit;
}
export function shouldAcceptWarCall(ctx: DiplomacyContext,proposalId: string,index?: DiplomacyAIIndex): boolean {
  const p = index ? index.proposalById.get(proposalId) : ctx.relations.flatMap(r => r.proposals ?? []).find(p => p.id === proposalId);
  const war = index ? (p?.warId === undefined ? undefined : index.warById.get(p.warId)) : ctx.wars.find(w => w.id === p?.warId); if (!p || !war) return false;
  const r = index ? index.relation(p.from,p.to) : getRelation(ctx.relations,p.from,p.to),defensive = war.defender === p.from;
  const enemy = defensive ? war.attacker : war.defender;
  if (currentCampaigns(ctx,p.to,index) >= B.aiMaxWars) return false;
  return (r?.trust ?? 0) >= (defensive ? B.aiDefensiveCallTrust : B.aiOffensiveCallTrust) && (r?.opinion ?? 0) >= B.napMinOpinion
    && (diplomaticPower(ctx,p.to,index)+diplomaticPower(ctx,p.from,index))/diplomaticPower(ctx,enemy,index) >= B.aiCallPowerRatio;
}
type ProactiveKind = Exclude<ProposalKind,'call'>;
export interface DiplomaticProposalCandidate {
  from: string; to: string; kind: ProactiveKind; score: number;
}
function areNeighbors(ctx: DiplomacyContext,a: string,b: string,index?: DiplomacyAIIndex): boolean {
  if (index) return index.neighbors(a,b);
  const owners = new Map(ctx.provinces?.map(p => [p.id,p.owner]) ?? []);
  return ctx.provinces?.some(p => p.owner === a && p.neighbors.some(id => owners.get(id) === b)) ?? false;
}
function hasPoliticalTie(ctx: DiplomacyContext,a: string,b: string,index?: DiplomacyAIIndex): boolean {
  if (index) {
    const r = index.relation(a,b), allies = new Set(index.alliesByTag.get(a) ?? []);
    return !!r?.alliance || !!r?.guarantees?.length || (index.alliesByTag.get(b) ?? []).some(tag => allies.has(tag));
  }
  const r = getRelation(ctx.relations,a,b),allies = getAllies(ctx.relations,a);
  return !!r?.alliance || !!r?.guarantees?.length || getAllies(ctx.relations,b).some(tag => allies.includes(tag));
}
function hasStrategicThreat(ctx: DiplomacyContext,a: string,b: string,index?: DiplomacyAIIndex): boolean {
  if (index) {
    const threshold = Math.max(index.power(a),index.power(b))*B.aiStrategicThreatPowerRatio;
    for (const tag of index.neighborsByTag.get(a) ?? []) {
      if (tag === a || tag === b || !index.validTags.has(tag) || !index.neighbors(b,tag) || !(index.power(tag) >= threshold)) continue;
      if ([a,b].some(owner => {
        const r = index.relation(owner,tag);
        return r?.status === 'war' || (r?.opinion ?? 0) <= B.aiThreatOpinionThreshold;
      })) return true;
    }
    return false;
  }
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
export function hasUsefulMilitaryAccessRoute(ctx: DiplomacyContext,from: string,host: string,lookup?: DiplomacyAIIndex): boolean {
  if (!ctx.provinces?.length) return false;
  const index = lookup?.provinceById ?? new Map(ctx.provinces.map(p => [p.id,p]));
  const country = lookup ? lookup.countryByTag.get(from) : ctx.countries.find(c => c.tag === from);
  const locations = lookup ? lookup.armyLocationsByOwner.get(from) ?? [] : ctx.armies?.filter(a => a.owner === from && a.location).map(a => a.location!) ?? [];
  const origins = locations.length ? locations : [country?.capitalId ?? country?.provinces[0]].filter((id): id is string => !!id);
  const reachable = (origin: string,withHost: boolean): Set<string> => {
    const visited = new Set<string>(),queue = [origin];
    if (!index.has(origin)) return visited;
    visited.add(origin);
    for (let cursor = 0; cursor < queue.length; cursor++) for (const id of index.get(queue[cursor])!.neighbors) {
      const p = index.get(id);
      if (!p || visited.has(id) || !((lookup ? lookup.access(from,p.owner) : hasMilitaryAccess(ctx.relations,from,p.owner)) || withHost && p.owner === host)) continue;
      visited.add(id); queue.push(id);
    }
    return visited;
  };
  const enemies = new Set((lookup ? lookup.warsByCountry.get(from) ?? [] : getCountryWars(ctx.wars,from)).map(w => w.attacker === from ? w.defender : w.attacker));
  for (const origin of origins) {
    const before = reachable(origin,false),after = reachable(origin,true);
    if (ctx.provinces.some(p => p.owner === from && after.has(p.id) && !before.has(p.id))) return true;
    const bordersEnemy = (reachable: Set<string>,target: string) => [...reachable].some(id => index.get(id)!.neighbors.includes(target));
    if (ctx.provinces.some(p => enemies.has(p.owner) && bordersEnemy(after,p.id) && !bordersEnemy(before,p.id))) return true;
  }
  return false;
}
/** Proactive requirements are separate from player actions and AI acceptance. */
export function collectProactiveProposalCandidates(ctx: DiplomacyContext,playerTag: string, profiler?: DiplomacyAIProfiler, suppliedIndex?: DiplomacyAIIndex): DiplomaticProposalCandidate[] {
  const index = suppliedIndex ?? (profiler ? profiler.measure('indexBuild', () => new DiplomacyAIIndex(ctx)) : new DiplomacyAIIndex(ctx));
  const day = diplomacyDay(ctx.date),valid = ctx.countries.filter(isDiplomaticCountry),candidates: DiplomaticProposalCandidate[] = [];
  const requirements = {
    alliance: [B.aiAllianceMinOpinion,B.aiAllianceMinTrust],
    nap: [B.aiNapMinOpinion,B.aiNapMinTrust],access: [B.aiAccessMinOpinion,B.aiAccessMinTrust],
  } as const;
  for (const a of valid.filter(c => c.tag !== playerTag)) for (const b of valid.filter(c => c.tag !== a.tag)) {
    profiler?.count('candidatePairs');
    const pair = { from: a.tag, to: b.tag };
    const r = profiler ? profiler.measure('relationEvaluation', () => index.relation(a.tag,b.tag), pair) : index.relation(a.tag,b.tag);
    if (!r || r.proposals?.some(p => p.kind !== 'call' && p.expiresAt > day)) continue;
    const neighbor = profiler ? profiler.measure('neighborEvaluation', () => areNeighbors(ctx,a.tag,b.tag,index), pair) : areNeighbors(ctx,a.tag,b.tag,index);
    const enemy = profiler ? profiler.measure('warEvaluation', () => commonEnemy(ctx,a.tag,b.tag,index), pair) : commonEnemy(ctx,a.tag,b.tag,index);
    const political = profiler ? profiler.measure('politicalTie', () => hasPoliticalTie(ctx,a.tag,b.tag,index), pair) : hasPoliticalTie(ctx,a.tag,b.tag,index);
    const threat = profiler ? profiler.measure('strategicThreat', () => hasStrategicThreat(ctx,a.tag,b.tag,index), pair) : hasStrategicThreat(ctx,a.tag,b.tag,index);
    for (const kind of ['alliance','nap','access'] as const) {
      let usefulRoute = false;
      const evaluateKind = () => {
        if ((r.cooldowns?.[`${a.tag}:aiProposalRetry:${kind}`] ?? -Infinity) > day) return false;
        const [opinion,trust] = requirements[kind];
        if (r.opinion < opinion || r.trust < trust || actionBlockReason(ctx,a.tag,b.tag,proposalAction[kind],index) || !shouldAcceptAgreement(ctx,a.tag,b.tag,kind,index)) return false;
        usefulRoute = kind === 'access' && hasUsefulMilitaryAccessRoute(ctx,a.tag,b.tag,index);
        if (kind === 'alliance' && !(neighbor || enemy || threat)) return false;
        if (kind === 'nap' && (r.alliance || !(neighbor || enemy || threat || political))) return false;
        if (kind === 'access' && !usefulRoute) return false;
        return true;
      };
      const phase = kind === 'alliance' ? 'allianceLogic' : kind === 'nap' ? 'nonAggressionLogic' : 'accessLogic';
      if (!(profiler ? profiler.measure(phase, evaluateKind, pair) : evaluateKind())) continue;
      const weights = B.aiProposalScore;
      candidates.push({from: a.tag,to: b.tag,kind,score: r.opinion*weights.opinion+r.trust*weights.trust+weights[kind]
        +(neighbor ? weights.neighbor : 0)+(enemy ? weights.commonEnemy : 0)+(threat ? weights.strategicThreat : 0)
        +(political ? weights.politicalTie : 0)+(usefulRoute ? weights.usefulRoute : 0)});
    }
  }
  const sort = () => candidates.sort((a,b) => b.score-a.score || a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.kind.localeCompare(b.kind));
  return profiler ? profiler.measure('candidateSorting', sort) : sort();
}
const defaultProfiler = createDiplomacyAIProfiler(import.meta.env.DEV);
/** Deterministic decisions, persisted per-action cooldowns, no daily proposal spam. */
export function processDiplomacyAI(ctx: DiplomacyContext,playerTag: string, profiler = defaultProfiler) {
  profiler.begin(ctx);
  try {
    let next = ctx; const messages: string[] = [];
    let index: DiplomacyAIIndex | undefined;
    const lookup = () => index ??= profiler.measure('indexBuild', () => new DiplomacyAIIndex(next));
    const apply = (r: ReturnType<typeof respondAgreement>, visible: boolean, pair?: { from: string; to: string }) => {
      next = {...next,relations: r.relations,wars: r.wars}; if (r.ok && visible) messages.push(r.message);
      if (index) profiler.measure('indexBuild', () => index!.refresh(next,pair), pair);
    };
    const proposals = profiler.measure('proposalCollection', () => ctx.relations.flatMap(r => r.proposals ?? []));
    profiler.count('proposals', proposals.length);
    const day = diplomacyDay(ctx.date);
    for (const p of proposals) {
      if (p.to === playerTag || p.expiresAt <= day) continue;
      profiler.count('proposalsProcessed');
      lookup();
      const pair = { from: p.from, to: p.to };
      if (p.kind === 'call') {
        const accept = profiler.measure('warEvaluation', () => shouldAcceptWarCall(next,p.id,lookup()), pair);
        // Joining a campaign can change several enemy pairs, not only the caller/ally pair.
        apply(profiler.measure('callToWar', () => respondToWarCall(next,p.id,accept), pair), true);
      } else {
        const accept = profiler.measure(p.kind === 'alliance' ? 'allianceLogic' : p.kind === 'nap' ? 'nonAggressionLogic' : 'accessLogic',
          () => shouldAcceptAgreement(next,p.from,p.to,p.kind as Exclude<ProposalKind,'call'>,lookup()), pair);
        apply(profiler.measure('proposalEvaluation', () => respondAgreement(next,p.from,p.to,p.kind as Exclude<ProposalKind,'call'>,accept,p.from === playerTag), pair), p.from === playerTag, pair);
      }
    }
    // Existing cadence and country iteration order are unchanged.
    if (day % B.aiMaintenanceInterval !== 0) return {...next,messages};
    lookup();
    const valid = ctx.countries.filter(isDiplomaticCountry);
    for (const a of valid.filter(c => c.tag !== playerTag)) {
      for (const b of valid.filter(c => c.tag !== a.tag)) {
        profiler.count('maintenancePairs');
        const pair = { from: a.tag, to: b.tag };
        const r = profiler.measure('relationEvaluation', () => lookup().relation(a.tag,b.tag), pair);
        if (r && r.opinion <= -75 && r.trust < B.napMinTrust) {
          if (r.alliance) apply(profiler.measure('allianceLogic', () => breakAlliance(next,a.tag,b.tag,b.tag === playerTag), pair), b.tag === playerTag, pair);
          if (r.nonAggressionPact) apply(profiler.measure('nonAggressionLogic', () => breakNonAggressionPact(next,a.tag,b.tag,b.tag === playerTag), pair), b.tag === playerTag, pair);
          continue;
        }
        const guarantee = profiler.measure('relationEvaluation', () => r && r.opinion >= B.guaranteeMinOpinion && r.trust >= B.guaranteeMinTrust
          && lookup().power(a.tag) > lookup().power(b.tag) && !(lookup().warsByCountry.get(a.tag)?.length), pair);
        if (guarantee) apply(profiler.measure('allianceLogic', () => guaranteeIndependence(next,a.tag,b.tag,b.tag === playerTag), pair), b.tag === playerTag, pair);
        if (r?.alliance) for (const war of lookup().warsByCountry.get(a.tag) ?? []) apply(profiler.measure('callToWar', () => callAllyToWar(next,a.tag,b.tag,war.id), pair), true, pair);
      }
    }
    if (day % B.aiInterval !== 0) return {...next,messages};
    const cycleUntil = day+B.aiInterval;
    let sent = next.relations.reduce((count,r) => count+Object.entries(r.cooldowns ?? [])
      .filter(([key,until]) => key.includes(':aiProposal:') && until === cycleUntil).length,0);
    const selectedPairs = new Set<string>();
    for (const candidate of collectProactiveProposalCandidates(next,playerTag,profiler,lookup())) {
      if (sent >= B.aiMaxProposalsPerCycle) break;
      const {from,to,kind} = candidate,key = relationKey(from,to);
      if (selectedPairs.has(key) || getRelation(next.relations,from,to)?.proposals?.some(p => p.kind !== 'call' && p.expiresAt > day)) continue;
      const offer = profiler.measure('relationUpdates', () => offerAgreement(next,from,to,kind,to === playerTag), { from, to }); if (!offer.ok) continue;
      const action = proposalAction[kind];
      offer.relations = profiler.measure('relationUpdates', () => updateRelation(offer.relations,from,to,r => ({...r,cooldowns: {...r.cooldowns,
        [`${from}:${action}`]: day+B.aiProposalCooldown,[`${from}:aiProposal:${action}`]: cycleUntil},
        proposals: r.proposals?.map(p => p.from === from && p.to === to && p.kind === kind && to === playerTag ? {...p,aiToPlayer: true} : p)})), { from, to });
      apply(offer, to === playerTag, { from, to }); selectedPairs.add(key); sent++;
    }
    return {...next,messages};
  } finally { profiler.finish(); }
}
