import type { ActiveBattle, Army, DiplomaticRelation, Province } from '../../types';
import { diplomacyDay, updateRelation } from './diplomacyRelations';
import { areAtWar, canEnterTerritory, isDiplomaticCountry } from './diplomacySelectors';
import { respondToWarCall } from './diplomacyWar';
import type { DiplomacyContext } from './diplomacyTypes';
import { DIPLOMACY_BALANCE as B } from './diplomacyBalance';

export function processDiplomacyTick(ctx: DiplomacyContext): DiplomacyContext {
  const day = diplomacyDay(ctx.date);
  let next = ctx;
  for (const p of ctx.relations.flatMap(r => r.proposals ?? []).filter(p => p.kind !== 'call' && p.aiToPlayer && p.expiresAt <= day)) {
    next = {...next,relations: updateRelation(next.relations,p.from,p.to,r => ({...r,cooldowns: {...r.cooldowns,
      [`${p.from}:aiProposalRetry:${p.kind}`]: Math.max(r.cooldowns?.[`${p.from}:aiProposalRetry:${p.kind}`] ?? -Infinity,p.expiresAt+B.aiExpiredProposalRetryDays)}}))};
  }
  // Silence is refusal; expiration applies the same trust/opinion cost once.
  for (const p of ctx.relations.flatMap(r => r.proposals ?? []).filter(p => p.kind === 'call' && p.expiresAt <= day)) {
    const refused = respondToWarCall(next,p.id,false);
    next = {...next,relations: refused.relations};
  }
  return {...next,relations: next.relations.map(r => ({...r,
    nonAggressionPact: r.nonAggressionPact && r.nonAggressionPact.expiresAt > day ? r.nonAggressionPact : undefined,
    casusBelli: r.casusBelli?.filter(cb => cb.expiresAt === undefined || cb.expiresAt > day),
    proposals: r.proposals?.filter(p => p.expiresAt > day && (!p.warId || ctx.wars.some(w => w.id === p.warId))),
    cooldowns: Object.fromEntries(Object.entries(r.cooldowns ?? {}).filter(([,until]) => until > day)),
  }))};
}
/** Called after territory/battle/rebellion transitions. */
export function cleanupDiplomacy(ctx: DiplomacyContext): DiplomacyContext {
  const valid = new Set(ctx.countries.filter(isDiplomaticCountry).map(c => c.tag));
  const factions = new Set(ctx.countries.flatMap(c => c.rebellions ?? []).filter(f => f.status === 'active').map(f => f.id));
  // A government may temporarily lose every province to an active civil war.
  // Its rebellion must still be resolved by Rebellion V2's own objectives.
  const governments = new Set(ctx.countries.filter(c => !c.isAnnexed && c.rebellions?.some(f => f.status === 'active')).map(c => c.tag));
  const militaryValid = (tag: string) => valid.has(tag) || governments.has(tag) || factions.has(tag) || tag.startsWith('rebel_') && !!ctx.armies?.some(a => a.owner === tag);
  const wars = ctx.wars.filter(w => militaryValid(w.attacker) && militaryValid(w.defender));
  let relations = ctx.relations.filter(r => valid.has(r.countryA) && valid.has(r.countryB));
  for (const war of wars) relations = updateRelation(relations,war.attacker,war.defender,r => ({...r,status: 'war',alliance: undefined,nonAggressionPact: undefined,militaryAccess: [],guarantees: [],proposals: []}));
  const warIds = new Set(wars.map(w => w.id));
  relations = relations.map(r => ({...r,
    status: wars.some(w => (w.attacker === r.countryA && w.defender === r.countryB) || (w.attacker === r.countryB && w.defender === r.countryA)) ? 'war' : 'peace',
    proposals: r.proposals?.filter(p => valid.has(p.from) && valid.has(p.to) && (!p.warId || warIds.has(p.warId)))}));
  return {...ctx,wars,relations};
}

/** White peace releases stacks; no battle result or territory is fabricated. */
export function resolvePeaceBattles(battles: ActiveBattle[],armies: Army[],relations: DiplomaticRelation[]) {
  const byId = new Map(armies.map(a => [a.id,a]));
  const kept = battles.filter(b => {
    const attackers = new Set([b.attackerCountryId,...b.participantArmyIds.filter(id => b.participantSides[id] === 'attacker').flatMap(id => byId.has(id) ? [byId.get(id)!.owner] : [])]);
    const defenders = new Set([b.defenderCountryId,...b.participantArmyIds.filter(id => b.participantSides[id] === 'defender').flatMap(id => byId.has(id) ? [byId.get(id)!.owner] : [])]);
    return [...attackers].some(a => [...defenders].some(d => areAtWar(relations,a,d)));
  });
  const engaged = new Set(kept.flatMap(b => b.participantArmyIds));
  const released = new Set(battles.filter(b => !kept.includes(b)).flatMap(b => b.participantArmyIds));
  return {battles: kept,armies: armies.map(a => released.has(a.id) && !engaged.has(a.id) ? {...a,inCombat: false,targetArmyId: null,targetProvinceId: null} : a)};
}

/** Cancels revoked transit immediately, including while simulation is paused. */
export function cancelInvalidDiplomaticRoutes(armies: Army[],provinces: Province[],relations: DiplomaticRelation[]): Army[] {
  const owners = new Map(provinces.map(p => [p.id,p.owner]));
  return armies.map(a => {
    if (!a.destination || a.inCombat || a.rebellionFactionId) return a;
    const route = a.path.length ? a.path : [a.destination];
    if (route.every(id => { const owner = owners.get(id); return owner !== undefined && canEnterTerritory(relations,a.owner,owner); })) return a;
    return {...a,destination: null,targetDestination: null,path: [],movementProgress: 0,position: null};
  });
}
