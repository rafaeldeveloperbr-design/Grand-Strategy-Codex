// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { countries, provincesData } from '../../data/map';
import type { Country, Province } from '../../types';
import { saveGame, loadGame } from '../saveSystem';
import { createInitialTechState } from '../technology';
import * as D from '../diplomacy';
import type { DiplomacyContext } from '../diplomacy';

const B = D.DIPLOMACY_BALANCE;
function onDay(ctx: DiplomacyContext,day: number): DiplomacyContext {
  const date = new Date(day*86400000);
  return {...ctx,date: {year: date.getUTCFullYear(),month: date.getUTCMonth()+1,day: date.getUTCDate()}};
}
function scenario(edges: [string,string][],opinions: [string,string,number,number][]): DiplomacyContext {
  const tags = [...new Set(edges.flat())];
  const world: Country[] = tags.map(tag => ({...structuredClone(countries[0]),tag,name: tag,capitalId: tag,provinces: [tag]}));
  const provinces: Province[] = tags.map(tag => ({...structuredClone(provincesData[0]),id: tag,owner: tag,
    neighbors: edges.flatMap(([a,b]) => a === tag ? [b] : b === tag ? [a] : [])}));
  let ctx: DiplomacyContext = {countries: world,provinces,armies: [],wars: [],relations: [],date: {year: 1444,month: 11,day: 11}};
  for (const [a,b,opinion,trust] of opinions) ctx.relations = D.setTrust(D.setOpinion(ctx.relations,a,b,opinion),a,b,trust);
  const day = D.diplomacyDay(ctx.date);
  ctx = onDay(ctx,day+((B.aiInterval-day%B.aiInterval)%B.aiInterval));
  return ctx;
}
const proposals = (ctx: DiplomacyContext) => ctx.relations.flatMap(r => r.proposals ?? []).filter(p => p.kind !== 'call');
const crowded = () => scenario(['A','B','C','D','E','F'].map(tag => [tag,'P']),['A','B','C','D','E','F'].map((tag,i) => [tag,'P',65+i*5,70]));
const next = (ctx: DiplomacyContext,r: D.DiplomacyResult): DiplomacyContext => ({...ctx,relations: r.relations,wars: r.wars});
const pair = (opinion: number,trust: number) => scenario([['A','P']], [['A','P',opinion,trust]]);

describe('Diplomacy V2 proactive AI rebalance', () => {
  it('caps all new proposals globally at three and applies 180-day AI cooldowns', () => {
    const ctx = crowded(),day = D.diplomacyDay(ctx.date),ai = D.processDiplomacyAI(ctx,'P');
    expect(proposals(ai)).toHaveLength(B.aiMaxProposalsPerCycle);
    for (const p of proposals(ai)) expect(D.getRelation(ai.relations,p.from,p.to)?.cooldowns?.[`${p.from}:${D.proposalAction[p.kind as 'alliance' | 'nap' | 'access']}`]).toBe(day+B.aiProposalCooldown);
    // The cap is shared with proposals between bots, not reserved for the player.
    ctx.provinces!.find(p => p.id === 'A')!.neighbors.push('B');
    ctx.provinces!.find(p => p.id === 'B')!.neighbors.push('A');
    ctx.relations = D.setTrust(D.setOpinion(ctx.relations,'A','B',100),'A','B',100);
    const mixed = D.processDiplomacyAI(ctx,'P');
    expect(proposals(mixed)).toHaveLength(3);
    expect(proposals(mixed).some(p => p.to !== 'P')).toBe(true);
  });
  it('orders proposals by score instead of country iteration order and selects one per pair', () => {
    const ctx = crowded(),candidates = D.collectProactiveProposalCandidates(ctx,'P');
    expect(candidates[0]).toMatchObject({from: 'F',to: 'P',kind: 'alliance'});
    const selected = proposals(D.processDiplomacyAI(ctx,'P'));
    expect(selected.map(p => p.from)).toEqual(['F','E','D']);
    expect(new Set(selected.map(p => D.relationKey(p.from,p.to))).size).toBe(selected.length);
    const reversed = D.processDiplomacyAI({...ctx,countries: [...ctx.countries].reverse()},'P');
    expect(proposals(reversed)).toEqual(selected);
  });
  it('cannot refill the same cycle after proposals are answered or after save/load', () => {
    let ctx: DiplomacyContext = D.processDiplomacyAI(crowded(),'P');
    for (const p of proposals(ctx)) ctx = next(ctx,D.respondAgreement(ctx,p.from,p.to,p.kind as 'alliance' | 'nap' | 'access',false));
    expect(proposals(D.processDiplomacyAI(ctx,'P'))).toHaveLength(0);
    saveGame({dateRef: {current: ctx.date},countriesRef: {current: ctx.countries},provincesRef: {current: ctx.provinces!},armiesRef: {current: []},warsRef: {current: []},diplomaticRelationsRef: {current: ctx.relations},
      recruitmentsRef: {current: []},buildingConstructionsRef: {current: []},activeBattlesRef: {current: []},playerTechStateRef: {current: createInitialTechState('P')},botTechStatesRef: {current: new Map()}},'ai-proposals');
    const loaded = loadGame('ai-proposals')!;
    expect(loaded.diplomacy.relations).toEqual(D.migrateDiplomacy(ctx.relations,[],ctx.date));
    expect(proposals(D.processDiplomacyAI({...ctx,relations: loaded.diplomacy.relations},'P'))).toHaveLength(0);
  });
  it('blocks a rejected NAP for five years, then permits it at the next cycle', () => {
    let ctx: DiplomacyContext = D.processDiplomacyAI(pair(30,50),'P');
    const p = proposals(ctx)[0]; expect(p.kind).toBe('nap');
    ctx = next(ctx,D.respondAgreement(ctx,p.from,p.to,'nap',false));
    const day = D.diplomacyDay(ctx.date);
    expect(proposals(D.processDiplomacyAI(D.processDiplomacyTick(onDay(ctx,day+90)),'P'))).toHaveLength(0);
    const until = day+B.aiRejectedProposalRetryDays;
    expect(D.getRelation(ctx.relations,'A','P')?.cooldowns?.['A:aiProposalRetry:nap']).toBe(until);
    for (const offset of [180,360,1800]) expect(proposals(D.processDiplomacyAI(D.processDiplomacyTick(onDay(ctx,day+offset)),'P'))).toHaveLength(0);
    expect(D.collectProactiveProposalCandidates(onDay(ctx,until-1),'P')).toHaveLength(0);
    expect(D.collectProactiveProposalCandidates(onDay(ctx,until),'P')).toHaveLength(1);
    expect(proposals(D.processDiplomacyAI(D.processDiplomacyTick(onDay(ctx,day+1890)),'P'))).toHaveLength(1);
  });
  it('treats silence as refusal for three years from expiry, without renewing the deadline', () => {
    const offered = D.processDiplomacyAI(pair(30,50),'P'),p = proposals(offered)[0];
    const until = p.expiresAt+B.aiExpiredProposalRetryDays;
    const ctx = D.processDiplomacyTick(onDay(offered,p.expiresAt));
    expect(proposals(ctx)).toHaveLength(0);
    expect(D.getRelation(ctx.relations,'A','P')?.cooldowns?.['A:aiProposalRetry:nap']).toBe(until);
    const later = D.processDiplomacyTick(onDay(ctx,until-1));
    expect(D.collectProactiveProposalCandidates(later,'P')).toHaveLength(0);
    expect(D.getRelation(later.relations,'A','P')?.cooldowns?.['A:aiProposalRetry:nap']).toBe(until);
    expect(D.collectProactiveProposalCandidates(D.processDiplomacyTick(onDay(ctx,until)),'P')).toHaveLength(1);
    const cycle = until+((B.aiInterval-until%B.aiInterval)%B.aiInterval);
    expect(proposals(D.processDiplomacyAI(D.processDiplomacyTick(onDay(ctx,cycle)),'P'))).toHaveLength(1);
  });
  it('limits retries to the country pair and action, leaving alliance opportunities available', () => {
    let ctx: DiplomacyContext = D.processDiplomacyAI(pair(30,50),'P');
    ctx = next(ctx,D.respondAgreement(ctx,'A','P','nap',false));
    ctx.relations = D.setTrust(D.setOpinion(ctx.relations,'A','P',70),'A','P',70);
    const candidates = D.collectProactiveProposalCandidates(onDay(ctx,D.diplomacyDay(ctx.date)+180),'P');
    expect(candidates.some(p => p.kind === 'nap')).toBe(false);
    expect(candidates.some(p => p.kind === 'alliance')).toBe(true);
    const other = pair(30,50);
    other.relations = [...other.relations,...ctx.relations.map(r => ({...r,countryA: 'B'}))];
    expect(D.collectProactiveProposalCandidates(other,'P').some(p => p.from === 'A' && p.kind === 'nap')).toBe(true);
  });
  it('lets alliances and useful access outrank NAP without a fixed NAP bonus', () => {
    expect(B.aiProposalScore.nap).toBe(0);
    expect(proposals(D.processDiplomacyAI(pair(70,70),'P'))[0].kind).toBe('alliance');
    const ctx = scenario([['A','P'],['P','E']], [['A','P',70,70]]);
    ctx.wars = [{id: 'A-E',attacker: 'A',defender: 'E',startDate: ctx.date,warScore: 0,attackerCasualties: 0,defenderCasualties: 0,occupiedByAttacker: [],occupiedByDefender: []}];
    const ranked = D.collectProactiveProposalCandidates(ctx,'P');
    expect(ranked[0]).toMatchObject({from: 'A',to: 'P',kind: 'access'});
    expect(ranked.find(p => p.kind === 'access')!.score).toBeGreaterThan(ranked.find(p => p.kind === 'nap')!.score);
    expect(proposals(D.processDiplomacyAI(ctx,'P'))[0].kind).toBe('access');
  });
  it.each(['rejected','expired','pending'] as const)('preserves %s AI retry state through save/load', state => {
    let ctx: DiplomacyContext = D.processDiplomacyAI(pair(30,50),'P');
    const p = proposals(ctx)[0];
    if (state === 'rejected') ctx = next(ctx,D.respondAgreement(ctx,'A','P','nap',false));
    if (state === 'expired') ctx = D.processDiplomacyTick(onDay(ctx,p.expiresAt));
    saveGame({dateRef: {current: ctx.date},countriesRef: {current: ctx.countries},provincesRef: {current: ctx.provinces!},armiesRef: {current: []},warsRef: {current: []},diplomaticRelationsRef: {current: ctx.relations},
      recruitmentsRef: {current: []},buildingConstructionsRef: {current: []},activeBattlesRef: {current: []},playerTechStateRef: {current: createInitialTechState('P')},botTechStatesRef: {current: new Map()}},'retry-state');
    ctx = {...ctx,relations: loadGame('retry-state')!.diplomacy.relations};
    if (state === 'pending') {
      expect(proposals(ctx)[0].aiToPlayer).toBe(true);
      ctx = D.processDiplomacyTick(onDay(ctx,p.expiresAt));
    }
    const until = state === 'rejected' ? p.createdAt+B.aiRejectedProposalRetryDays : p.expiresAt+B.aiExpiredProposalRetryDays;
    expect(D.getRelation(ctx.relations,'A','P')?.cooldowns?.['A:aiProposalRetry:nap']).toBe(until);
    expect(D.collectProactiveProposalCandidates(onDay(ctx,until-1),'P')).toHaveLength(0);
    expect(D.collectProactiveProposalCandidates(onDay(ctx,until),'P')).toHaveLength(1);
  });
  it('does not attach AI retry penalties to refused or ignored player offers', () => {
    const ctx = pair(30,50),offered = next(ctx,D.offerAgreement(ctx,'P','A','nap'));
    const refused = next(offered,D.respondAgreement(offered,'P','A','nap',false));
    const expired = D.processDiplomacyTick(onDay(offered,proposals(offered)[0].expiresAt));
    for (const outcome of [refused,expired]) expect(Object.keys(D.getRelation(outcome.relations,'P','A')?.cooldowns ?? {}).some(key => key.includes('aiProposalRetry'))).toBe(false);
  });
  it('has no monthly proactive spam: only day 0 and day 90 produce proposals', () => {
    let ctx = crowded(); const start = D.diplomacyDay(ctx.date),emitted: [number,number][] = [];
    for (let offset = 0; offset <= 90; offset++) {
      ctx = D.processDiplomacyTick(onDay(ctx,start+offset));
      const ai = D.processDiplomacyAI(ctx,'P'),newProposals = proposals(ai).filter(p => p.createdAt === start+offset);
      if (newProposals.length) emitted.push([offset,newProposals.length]);
      ctx = ai;
    }
    expect(emitted).toEqual([[0,3],[90,3]]);
  });
  it.each([
    ['alliance',59,80,false],['alliance',60,59,false],['alliance',60,60,true],
    ['nap',24,80,false],['nap',25,44,false],['nap',25,45,true],
  ] as const)('uses stricter proactive %s requirements at opinion %s/trust %s',(kind,opinion,trust,eligible) => {
    expect(D.collectProactiveProposalCandidates(pair(opinion,trust),'P').some(p => p.kind === kind)).toBe(eligible);
  });
  it('retains player requirements, 90-day cooldowns and AI acceptance of player offers', () => {
    const checks = [['alliance',40,50],['nap',10,40],['access',20,40]] as const;
    for (const [kind,opinion,trust] of checks) {
      const ctx = pair(opinion,trust),offer = D.offerAgreement(ctx,'P','A',kind);
      expect(offer.ok).toBe(true);
      expect(D.getRelation(offer.relations,'P','A')?.cooldowns?.[`P:${D.proposalAction[kind]}`]).toBe(D.diplomacyDay(ctx.date)+90);
      expect(D.shouldAcceptAgreement(next(ctx,offer),'P','A',kind)).toBe(true);
      const responded = D.processDiplomacyAI(next(ctx,offer),'P');
      expect(D.getRelation(responded.relations,'P','A')?.proposals?.some(p => p.from === 'P')).toBe(false);
      expect(kind === 'alliance' ? D.areAllied(responded.relations,'P','A') : kind === 'nap' ? D.hasNonAggressionPact(responded.relations,'P','A',D.diplomacyDay(ctx.date)) : D.hasMilitaryAccess(responded.relations,'P','A')).toBe(true);
    }
  });
  it('honors existing saved cooldowns without extending them retroactively', () => {
    const ctx = pair(30,50),day = D.diplomacyDay(ctx.date);
    ctx.relations = D.updateRelation(ctx.relations,'A','P',r => ({...r,cooldowns: {'A:offerNap': day+90}}));
    const migrated = {...ctx,relations: D.migrateDiplomacy(ctx.relations,[],ctx.date)};
    expect(proposals(D.processDiplomacyAI(migrated,'P'))).toHaveLength(0);
    expect(proposals(D.processDiplomacyAI(onDay(migrated,day+90),'P'))).toHaveLength(1);
  });
  it('rejects irrelevant distant offers and favors common enemies over higher opinion alone', () => {
    const ctx = scenario([['A','X'],['X','P'],['B','P']], [['A','P',60,70],['B','P',80,70]]);
    expect(D.collectProactiveProposalCandidates(ctx,'P').some(p => p.from === 'A')).toBe(false);
    ctx.wars = ['A','P'].map(attacker => ({id: `${attacker}-X`,attacker,defender: 'X',startDate: ctx.date,warScore: 0,attackerCasualties: 0,defenderCasualties: 0,occupiedByAttacker: [],occupiedByDefender: []}));
    const ranked = D.collectProactiveProposalCandidates(ctx,'P');
    expect(ranked[0]).toMatchObject({from: 'A',to: 'P',kind: 'alliance'});
  });
  it('recognizes shared strategic threats and politically relevant distant NAPs', () => {
    const ctx = scenario([['A','X'],['X','P']], [['A','P',60,60],['A','X',-50,50]]);
    ctx.countries.find(c => c.tag === 'X')!.provinces.push('x2');
    expect(D.collectProactiveProposalCandidates(ctx,'P').some(p => p.from === 'A' && p.kind === 'alliance')).toBe(true);
    ctx.relations = D.setOpinion(ctx.relations,'A','X',0);
    ctx.relations = D.updateRelation(ctx.relations,'A','P',r => ({...r,opinion: 30,guarantees: ['A']}));
    expect(D.collectProactiveProposalCandidates(ctx,'P').some(p => p.from === 'A' && p.kind === 'nap')).toBe(true);
  });
  it('requests access only when the corridor opens a plausible military route', () => {
    const ctx = scenario([['A','P'],['P','E']], [['A','P',35,50]]);
    expect(D.hasUsefulMilitaryAccessRoute(ctx,'A','P')).toBe(false);
    expect(D.collectProactiveProposalCandidates(ctx,'P').some(p => p.kind === 'access')).toBe(false);
    ctx.wars = [{id: 'A-E',attacker: 'A',defender: 'E',startDate: ctx.date,warScore: 0,attackerCasualties: 0,defenderCasualties: 0,occupiedByAttacker: [],occupiedByDefender: []}];
    expect(D.hasUsefulMilitaryAccessRoute(ctx,'A','P')).toBe(true);
    expect(D.collectProactiveProposalCandidates(ctx,'P').some(p => p.kind === 'access')).toBe(true);
    ctx.provinces!.find(p => p.id === 'A')!.neighbors.push('E');
    expect(D.hasUsefulMilitaryAccessRoute(ctx,'A','P')).toBe(false); // an existing route makes the request unnecessary
  });
  it.each([[34,80,false],[35,49,false],[35,50,true]] as const)('uses proactive access requirements %s/%s',(opinion,trust,eligible) => {
    const ctx = scenario([['A','P'],['P','A2']], [['A','P',opinion,trust]]);
    ctx.provinces!.find(p => p.id === 'A2')!.owner = 'A';
    ctx.countries.find(c => c.tag === 'A')!.provinces.push('A2');
    ctx.countries = ctx.countries.filter(c => c.tag !== 'A2');
    expect(D.collectProactiveProposalCandidates(ctx,'P').some(p => p.kind === 'access')).toBe(eligible);
  });
  it('keeps the 30-day guarantee maintenance cycle independent of proactive limits', () => {
    const ctx = pair(35,50),day = D.diplomacyDay(ctx.date);
    ctx.countries.find(c => c.tag === 'A')!.provinces.push('A2');
    const ai = D.processDiplomacyAI(onDay(ctx,day+30),'P');
    expect(D.getGuarantors(ai.relations,'P')).toContain('A');
    expect(proposals(ai)).toHaveLength(0);
  });
  it('keeps war calls on the original maintenance cadence and cooldown', () => {
    const ctx = scenario([['A','P'],['A','E']], [['A','P',60,70]]),day = D.diplomacyDay(ctx.date);
    ctx.relations = D.updateRelation(ctx.relations,'A','P',r => ({...r,alliance: {since: day}}));
    ctx.relations = D.updateRelation(ctx.relations,'A','E',r => ({...r,status: 'war'}));
    ctx.wars = [{id: 'A-E',attacker: 'A',defender: 'E',startDate: ctx.date,warScore: 0,attackerCasualties: 0,defenderCasualties: 0,occupiedByAttacker: [],occupiedByDefender: []}];
    const ai = D.processDiplomacyAI(onDay(ctx,day+30),'P'),r = D.getRelation(ai.relations,'A','P')!;
    expect(r.proposals?.find(p => p.kind === 'call')).toMatchObject({from: 'A',to: 'P',warId: 'A-E'});
    expect(r.cooldowns?.['A:call:A-E']).toBe(day+30+B.actionCooldown);
    expect(proposals(ai)).toHaveLength(0); expect(ai.wars).toEqual(ctx.wars);
  });
  it('keeps existing pending proposals and does not stack another proactive kind on the pair', () => {
    const ctx = crowded(),pending = D.offerAgreement(ctx,'A','P','nap');
    const current = next(ctx,pending),ai = D.processDiplomacyAI(current,'P');
    expect(proposals(ai).filter(p => p.from === 'A' && p.to === 'P')).toEqual(proposals(current));
    expect(proposals(ai).filter(p => p.createdAt === D.diplomacyDay(ctx.date) && p.id !== proposals(current)[0].id)).toHaveLength(3);
  });
});
