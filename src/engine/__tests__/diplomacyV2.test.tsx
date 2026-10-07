// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useDiplomacyActions } from '../../hooks/app/useDiplomacyActions';
import { countries, provincesData } from '../../data/map';
import { DiplomacyPanel } from '../../components/DiplomacyPanel';
import { saveGame, loadGame } from '../saveSystem';
import { createInitialTechState } from '../technology';
import { canMoveToProvince, findPath, moveArmy, processArmyMovement } from '../military';
import { transferProvince } from '../territoryTransfer';
import { startContinuousBattle } from '../combat';
import type { RebellionFaction } from '../rebellion';
import { army, war } from './helpers/southAmericaAudit';
import * as D from '../diplomacy';
import type { DiplomacyContext, DiplomacyResult } from '../diplomacy';

afterEach(cleanup);
const base = (): DiplomacyContext => ({countries: structuredClone(countries),provinces: structuredClone(provincesData),armies: [],date: {year: 1444,month: 11,day: 11},wars: [],relations: []});
const next = (ctx: DiplomacyContext,r: DiplomacyResult): DiplomacyContext => ({...ctx,relations: r.relations,wars: r.wars});
const friendly = (a = 'BRA',b = 'ARG',opinion = 60,trust = 80): DiplomacyContext => {
  const ctx = base(); ctx.relations = D.setTrust(D.setOpinion([],a,b,opinion),a,b,trust); return ctx;
};
const allied = (ctx = friendly(),a = 'BRA',b = 'ARG'): DiplomacyContext => {
  ctx = next(ctx,D.offerAlliance(ctx,a,b)); return next(ctx,D.acceptAlliance(ctx,a,b));
};
const nap = (ctx = friendly(),a = 'BRA',b = 'ARG'): DiplomacyContext => {
  ctx = next(ctx,D.offerNonAggressionPact(ctx,a,b)); return next(ctx,D.acceptNonAggressionPact(ctx,a,b));
};
const advance = (ctx: DiplomacyContext,days: number): DiplomacyContext => {
  const d = new Date((D.diplomacyDay(ctx.date)+days)*86400000);
  return {...ctx,date: {year: d.getUTCFullYear(),month: d.getUTCMonth()+1,day: d.getUTCDate()}};
};
describe('Diplomacy V2 canonical relations', () => {
  it('initializes unique scenario pairs with usable cooperation and neutral trust', () => {
    const ctx = base(),rs = D.createInitialDiplomacy(ctx.countries,ctx.provinces!);
    expect(new Set(rs.map(r => D.relationKey(r.countryA,r.countryB))).size).toBe(rs.length);
    expect(D.getOpinion(rs,'BRA','ARG')).toBe(D.DIPLOMACY_BALANCE.initialBorderOpinion);
    expect(D.getTrust(rs,'ARG','BRA')).toBe(50);
    expect(D.offerAlliance({...ctx,relations: rs},'BRA','ARG').ok).toBe(true);
  });
  it('creates a canonical neutral pair and prevents self pairs', () => {
    expect(D.createRelation('BRA','ARG')).toEqual({countryA: 'ARG',countryB: 'BRA',opinion: 0,trust: 50,status: 'peace'});
    expect(D.relationKey('BRA','ARG')).toBe(D.relationKey('ARG','BRA'));
    expect(() => D.createRelation('BRA','BRA')).toThrow();
  });
  it('clamps opinion and trust without mutating input', () => {
    const ctx = friendly(); const before = structuredClone(ctx.relations);
    let rs = D.changeOpinion(ctx.relations,'ARG','BRA',200); expect(D.getOpinion(rs,'BRA','ARG')).toBe(100);
    rs = D.changeOpinion(rs,'BRA','ARG',-400); expect(D.getOpinion(rs,'ARG','BRA')).toBe(-100);
    rs = D.changeTrust(rs,'BRA','ARG',300); expect(D.getTrust(rs,'ARG','BRA')).toBe(100);
    rs = D.changeTrust(rs,'ARG','BRA',-400); expect(D.getTrust(rs,'BRA','ARG')).toBe(0);
    expect(rs).toHaveLength(1); expect(ctx.relations).toEqual(before);
  });
  it.each([[-100,'Hostil'],[-75,'Hostil'],[-74,'Muito desconfiado'],[-40,'Muito desconfiado'],[-39,'Desconfiado'],[-10,'Desconfiado'],[-9,'Neutro'],[9,'Neutro'],[10,'Cordial'],[39,'Cordial'],[40,'Amigável'],[69,'Amigável'],[70,'Muito amigável'],[100,'Muito amigável']] as const)('labels opinion %s as %s',(n,label) => expect(D.opinionLabel(n)).toBe(label));
});
describe('Diplomacy V2 alliance and NAP', () => {
  it('offers before accepting a symmetric alliance', () => {
    const ctx = friendly(),offer = D.offerAlliance(ctx,'BRA','ARG');
    expect(offer.ok).toBe(true); expect(D.areAllied(offer.relations,'BRA','ARG')).toBe(false);
    expect(D.acceptAlliance(next(ctx,offer),'BRA','ARG').ok).toBe(true);
    expect(D.areAllied(allied().relations,'ARG','BRA')).toBe(true);
    expect(D.acceptAlliance(ctx,'BRA','ARG').ok).toBe(false);
  });
  it('rejects and prevents cooldown spam', () => {
    let ctx = friendly(); ctx = next(ctx,D.offerAlliance(ctx,'BRA','ARG'));
    ctx = next(ctx,D.rejectAlliance(ctx,'BRA','ARG'));
    expect(D.getRelation(ctx.relations,'BRA','ARG')?.proposals).toEqual([]);
    expect(D.offerAlliance(ctx,'BRA','ARG').ok).toBe(false);
    expect(D.offerAlliance(advance(ctx,D.DIPLOMACY_BALANCE.actionCooldown),'BRA','ARG').ok).toBe(true);
  });
  it('blocks low opinion/trust and war, including at acceptance time', () => {
    expect(D.offerAlliance(base(),'BRA','ARG').message).toContain('40');
    expect(D.offerAlliance(friendly('BRA','ARG',60,49),'BRA','ARG').message).toContain('50');
    let ctx = friendly(); ctx = next(ctx,D.offerAlliance(ctx,'BRA','ARG'));
    ctx.relations = D.setOpinion(ctx.relations,'BRA','ARG',0);
    expect(D.acceptAlliance(ctx,'BRA','ARG').ok).toBe(false);
    const declared = D.declareWar(base(),'BRA','ARG');
    expect(D.offerAlliance(next(base(),declared),'BRA','ARG').ok).toBe(false);
  });
  it('breaks alliance with centralized penalties and removes automatic access', () => {
    const ctx = allied(),r = D.breakAlliance(ctx,'BRA','ARG');
    expect(r.ok).toBe(true); expect(D.areAllied(r.relations,'ARG','BRA')).toBe(false);
    expect(D.getOpinion(r.relations,'BRA','ARG')).toBe(60+D.DIPLOMACY_BALANCE.breakAllianceOpinionPenalty);
    expect(D.getTrust(r.relations,'BRA','ARG')).toBe(80+D.DIPLOMACY_BALANCE.breakAllianceTrustPenalty);
    expect(D.hasMilitaryAccess(r.relations,'BRA','ARG')).toBe(false);
  });
  it('NAP requires agreement, can coexist with alliance, and blocks war', () => {
    const ctx = nap(allied());
    expect(D.areAllied(ctx.relations,'BRA','ARG')).toBe(true);
    expect(D.hasNonAggressionPact(ctx.relations,'ARG','BRA',D.diplomacyDay(ctx.date))).toBe(true);
    expect(D.declareWar(nap(),'BRA','ARG').message).toContain('Pacto');
    expect(D.offerNonAggressionPact(base(),'BRA','ARG').ok).toBe(false);
  });
  it('rejects NAP and imposes penalties on early breaking', () => {
    let ctx = friendly(); ctx = next(ctx,D.offerNonAggressionPact(ctx,'BRA','ARG'));
    expect(D.rejectNonAggressionPact(ctx,'BRA','ARG').relations[0].nonAggressionPact).toBeUndefined();
    const r = D.breakNonAggressionPact(nap(),'BRA','ARG');
    expect(D.getOpinion(r.relations,'BRA','ARG')).toBe(35); expect(D.getTrust(r.relations,'BRA','ARG')).toBe(50);
  });
  it('expires NAP without break penalties', () => {
    const ctx = nap(),ticked = D.processDiplomacyTick(advance(ctx,D.DIPLOMACY_BALANCE.napDuration));
    expect(ticked.relations[0].nonAggressionPact).toBeUndefined();
    expect(ticked.relations[0].opinion).toBe(60); expect(ticked.relations[0].trust).toBe(80);
    expect(D.declareWar(ticked,'BRA','ARG').ok).toBe(true);
  });
});
describe('Diplomacy V2 military access and guarantees', () => {
  it('grants directional transit, never by opinion alone or to enemies', () => {
    let ctx = friendly('BRA','COL',100); expect(canMoveToProvince('BRA','COL',ctx.relations)).toBe(false);
    ctx = next(ctx,D.requestMilitaryAccess(ctx,'BRA','COL'));
    ctx = next(ctx,D.grantMilitaryAccess(ctx,'COL','BRA'));
    expect(D.hasMilitaryAccess(ctx.relations,'BRA','COL')).toBe(true);
    expect(D.hasMilitaryAccess(ctx.relations,'COL','BRA')).toBe(false);
    expect(findPath('sa_bra_amazonas','sa_col_amazonia',ctx.provinces!,'BRA',ctx.relations)).toEqual(['sa_col_amazonia']);
    const declared = D.declareWar(ctx,'BRA','COL');
    expect(D.hasMilitaryAccess(declared.relations,'BRA','COL')).toBe(false);
    expect(canMoveToProvince('BRA','COL',declared.relations)).toBe(true); // hostile combat entry
  });
  it('revocation blocks pathfinding and cancels an existing route', () => {
    let ctx = friendly('BRA','COL'); ctx = next(ctx,D.requestMilitaryAccess(ctx,'BRA','COL')); ctx = next(ctx,D.grantMilitaryAccess(ctx,'COL','BRA'));
    const order = moveArmy(army('BRA','sa_bra_amazonas'),'sa_col_amazonia',ctx.provinces!,ctx.relations)!;
    expect(order).not.toBeNull(); ctx = next(ctx,D.revokeMilitaryAccess(ctx,'COL','BRA'));
    expect(findPath('sa_bra_amazonas','sa_col_amazonia',ctx.provinces!,'BRA',ctx.relations)).toEqual([]);
    expect(processArmyMovement([order],ctx.provinces!,ctx.relations).updatedArmies[0].destination).toBeNull();
    expect(D.cancelInvalidDiplomaticRoutes([order],ctx.provinces!,ctx.relations)[0].path).toEqual([]);
    expect(D.revokeMilitaryAccess(ctx,'BRA','COL').ok).toBe(false);
  });
  it('guarantees independence directionally and supports withdrawal', () => {
    let ctx = friendly('BRA','URY'); ctx = next(ctx,D.guaranteeIndependence(ctx,'BRA','URY'));
    expect(D.getGuarantors(ctx.relations,'URY')).toEqual(['BRA']); expect(D.getGuarantors(ctx.relations,'BRA')).toEqual([]);
    expect(D.guaranteeIndependence(ctx,'BRA','URY').ok).toBe(false);
    expect(D.withdrawGuarantee(ctx,'BRA','URY').relations[0].guarantees).toEqual([]);
  });
  it('attacking a guaranteed country automatically joins the guarantor to the campaign', () => {
    let ctx = friendly('BRA','URY'); ctx = next(ctx,D.guaranteeIndependence(ctx,'BRA','URY'));
    const r = D.declareWar(ctx,'ARG','URY'); expect(r.ok).toBe(true);
    expect(r.wars).toHaveLength(2); expect(new Set(r.wars.map(w => w.campaignId)).size).toBe(1);
    expect(D.areAtWar(r.relations,'ARG','BRA')).toBe(true);
    expect(r.wars.find(w => w.defender === 'BRA')?.attacker).toBe('ARG');
  });
  it('binding guarantees explicitly override conflicting agreements with penalties', () => {
    let ctx = friendly('BRA','URY'); ctx = next(ctx,D.guaranteeIndependence(ctx,'BRA','URY'));
    ctx.relations = D.setTrust(D.setOpinion(ctx.relations,'ARG','BRA',60),'ARG','BRA',80);
    ctx = nap(allied(ctx,'BRA','ARG'),'BRA','ARG');
    const r = D.declareWar(ctx,'ARG','URY');
    expect(D.areAtWar(r.relations,'BRA','ARG')).toBe(true); expect(D.areAllied(r.relations,'BRA','ARG')).toBe(false);
    expect(D.getTrust(r.relations,'BRA','ARG')).toBeLessThan(80);
  });
});
describe('Diplomacy V2 war and Casus Belli', () => {
  it('validates identities, existing war, allies and annexed/rebel countries', () => {
    expect(D.declareWar(base(),'BRA','BRA').ok).toBe(false);
    expect(D.declareWar(base(),'BRA','UNKNOWN').ok).toBe(false);
    expect(D.declareWar(base(),'rebel_v2_fake','BRA').ok).toBe(false);
    const ctx = base(); ctx.countries.find(c => c.tag === 'ARG')!.isAnnexed = true;
    expect(D.declareWar(ctx,'BRA','ARG').ok).toBe(false);
    expect(D.declareWar(allied(),'BRA','ARG').ok).toBe(false);
    const first = D.declareWar(base(),'BRA','ARG'),second = D.declareWar(next(base(),first),'ARG','BRA');
    expect(second.ok).toBe(false); expect(second.wars).toHaveLength(1);
  });
  it('declares war with CB, consumes it, and penalizes less than unjustified war', () => {
    const ctx = base(),generated = D.generateConquestCasusBelli(ctx,'BRA','ARG',['sa_arg_buenos_aires']);
    const c = next(ctx,generated),cb = D.getCasusBelli(c.relations,'BRA','ARG',D.diplomacyDay(c.date))[0];
    expect(cb.type).toBe('conquest'); const justified = D.declareWar(c,'BRA','ARG',cb.id),unjustified = D.declareWar(ctx,'BRA','ARG');
    expect(justified.ok).toBe(true); expect(justified.wars[0].casusBelliType).toBe('conquest');
    expect(D.getCasusBelli(justified.relations,'BRA','ARG',D.diplomacyDay(c.date))).toEqual([]);
    expect(D.getOpinion(unjustified.relations,'BRA','ARG')).toBeLessThan(D.getOpinion(justified.relations,'BRA','ARG'));
    expect(D.getOpinion(unjustified.relations,'BRA','CHL')).toBeLessThan(D.getOpinion(justified.relations,'BRA','CHL'));
    expect(D.getTrust(unjustified.relations,'BRA','CHL')).toBeLessThan(D.getTrust(justified.relations,'BRA','CHL'));
  });
  it('rejects expired/wrong/unsupported CB, expires it in the tick and checks province ownership', () => {
    const ctx = next(base(),D.generateConquestCasusBelli(base(),'BRA','ARG'));
    const id = ctx.relations[0].casusBelli![0].id;
    expect(D.declareWar(ctx,'ARG','BRA',id).ok).toBe(false);
    expect(D.declareWar(advance(ctx,D.DIPLOMACY_BALANCE.cbDuration),'BRA','ARG',id).ok).toBe(false);
    expect(D.processDiplomacyTick(advance(ctx,D.DIPLOMACY_BALANCE.cbDuration)).relations[0].casusBelli).toEqual([]);
    expect(D.generateConquestCasusBelli(base(),'BRA','ARG',['sa_bra_brasilia']).ok).toBe(false);
  });
  it('war cancels access, incompatible guarantees and pending agreements', () => {
    let ctx = friendly(); ctx = next(ctx,D.requestMilitaryAccess(ctx,'BRA','ARG')); ctx = next(ctx,D.grantMilitaryAccess(ctx,'ARG','BRA'));
    ctx = next(ctx,D.guaranteeIndependence(ctx,'BRA','ARG')); ctx = next(ctx,D.offerAlliance(ctx,'BRA','ARG'));
    const r = D.getRelation(D.declareWar(ctx,'BRA','ARG').relations,'BRA','ARG')!;
    expect(r.status).toBe('war'); expect(r.militaryAccess).toEqual([]); expect(r.guarantees).toEqual([]); expect(r.proposals).toEqual([]);
  });
  it('recent broken NAP causes an additional war penalty', () => {
    const ctx = next(nap(),D.breakNonAggressionPact(nap(),'BRA','ARG'));
    const fresh = D.warPenaltyPreview(ctx,'BRA','ARG',false),old = D.warPenaltyPreview(advance(ctx,D.DIPLOMACY_BALANCE.recentNapWindow),'BRA','ARG',false);
    expect(fresh.opinion).toBeLessThan(old.opinion); expect(fresh.trust).toBeLessThan(old.trust);
  });
  it('white peace ends all campaign pairs and tracks last peace date', () => {
    let ctx = friendly('BRA','URY'); ctx = next(ctx,D.guaranteeIndependence(ctx,'BRA','URY')); ctx = next(ctx,D.declareWar(ctx,'ARG','URY'));
    const r = D.makePeace(ctx,ctx.wars[0].id); expect(r.wars).toEqual([]);
    expect(r.relations.filter(r => r.status === 'war')).toEqual([]);
    expect(D.getRelation(r.relations,'ARG','BRA')?.lastWarEndedAt).toBe(D.diplomacyDay(ctx.date));
  });
  it('peace releases combat stacks without territory changes or fabricated casualties', () => {
    const ctx = next(base(),D.declareWar(base(),'BRA','ARG'));
    const attackers = [army('BRA','sa_arg_buenos_aires',2,'bra')],defenders = [army('ARG','sa_arg_buenos_aires',2,'arg')];
    const battle = startContinuousBattle(attackers,defenders,ctx.provinces!.find(p => p.id === 'sa_arg_buenos_aires')!,ctx.date,'peace-battle');
    const stacks = [...attackers,...defenders].map(a => ({...a,inCombat: true}));
    const peace = D.makePeace(ctx,ctx.wars[0].id),released = D.resolvePeaceBattles([battle],stacks,peace.relations);
    expect(released.battles).toEqual([]); expect(released.armies.every(a => !a.inCombat)).toBe(true);
    expect(released.armies.map(a => a.regiments)).toEqual(stacks.map(a => a.regiments));
    expect(ctx.provinces!.find(p => p.id === battle.provinceId)?.owner).toBe('ARG');
    expect(D.resolvePeaceBattles([battle],stacks,ctx.relations).battles).toHaveLength(1);
  });
});
describe('Diplomacy V2 calls and AI', () => {
  it('calls allied defenders automatically, accepts and never duplicates war pairs', () => {
    let ctx = allied(); ctx = next(ctx,D.declareWar(ctx,'CHL','BRA'));
    const p = ctx.relations.flatMap(r => r.proposals ?? []).find(p => p.kind === 'call')!;
    expect(p.to).toBe('ARG'); expect(D.shouldAcceptWarCall(ctx,p.id)).toBe(true);
    ctx = next(ctx,D.respondToWarCall(ctx,p.id,true));
    expect(D.areAtWar(ctx.relations,'ARG','CHL')).toBe(true); expect(ctx.wars).toHaveLength(2);
    expect(ctx.wars[0].campaignId).toBe(ctx.wars[1].campaignId);
    expect(D.respondToWarCall(ctx,p.id,true).ok).toBe(false);
    expect(D.callAllyToWar(ctx,'BRA','ARG',ctx.wars[0].id).ok).toBe(false);
  });
  it('refuses calls and reduces trust/opinion once; silent expiration is refusal', () => {
    let ctx = allied(); ctx = next(ctx,D.declareWar(ctx,'CHL','BRA'));
    const p = ctx.relations.flatMap(r => r.proposals ?? []).find(p => p.kind === 'call')!;
    const before = D.getTrust(ctx.relations,'BRA','ARG'),r = D.respondToWarCall(ctx,p.id,false);
    expect(D.getTrust(r.relations,'BRA','ARG')).toBe(before-15);
    const expired = D.processDiplomacyTick(advance(ctx,D.DIPLOMACY_BALANCE.proposalDuration));
    expect(D.getTrust(expired.relations,'BRA','ARG')).toBe(before-15);
    expect(D.processDiplomacyTick(expired).relations).toEqual(expired.relations);
  });
  it('does not force allies to violate a NAP with the enemy', () => {
    let ctx = allied(); ctx.relations = D.setTrust(D.setOpinion(ctx.relations,'ARG','CHL',60),'ARG','CHL',80);
    ctx = nap(ctx,'ARG','CHL'); ctx = next(ctx,D.declareWar(ctx,'CHL','BRA'));
    const p = ctx.relations.flatMap(r => r.proposals ?? []).find(p => p.kind === 'call')!;
    const r = D.respondToWarCall(ctx,p.id,true); expect(D.areAtWar(r.relations,'ARG','CHL')).toBe(false);
    expect(r.message).toContain('recusou');
  });
  it('AI accepts good relations and rejects poor relations or too many wars', () => {
    expect(D.shouldAcceptAgreement(friendly(),'BRA','ARG','alliance')).toBe(true);
    expect(D.shouldAcceptAgreement(friendly('BRA','ARG',-80),'BRA','ARG','alliance')).toBe(false);
    const ctx = friendly(); ctx.wars = [war('ARG','CHL'),war('ARG','BOL')];
    expect(D.shouldAcceptAgreement(ctx,'BRA','ARG','alliance')).toBe(false);
    expect(D.commonEnemy({...ctx,wars: [war('BRA','CHL'),war('ARG','CHL')]},'BRA','ARG')).toBe(true);
    expect(D.shouldAcceptAgreement(friendly(),'BRA','ARG','nap')).toBe(true);
    expect(D.shouldAcceptAgreement(friendly(),'BRA','ARG','access')).toBe(true);
  });
  it('AI considers power and offensive/defensive commitments', () => {
    let ctx = allied(friendly('BRA','ARG',60,55)); ctx = next(ctx,D.declareWar(ctx,'BRA','CHL'));
    const p = ctx.relations.flatMap(r => r.proposals ?? []).find(p => p.kind === 'call')!;
    expect(D.shouldAcceptWarCall(ctx,p.id)).toBe(false);
    ctx.relations = D.setTrust(ctx.relations,'BRA','ARG',90);
    ctx.armies = [{...army('CHL','sa_chl_santiago'),regiments: [{type: 'infantry',strength: 1000000,morale: 100}]}];
    expect(D.shouldAcceptWarCall(ctx,p.id)).toBe(false);
  });
  it('AI responds deterministically and proposal cooldown survives ticks', () => {
    let ctx = friendly(); ctx = next(ctx,D.offerAlliance(ctx,'BRA','ARG'));
    const ai = D.processDiplomacyAI(ctx,'BRA'); expect(D.areAllied(ai.relations,'BRA','ARG')).toBe(true);
    expect(D.processDiplomacyAI(ctx,'BRA').relations).toEqual(ai.relations);
    ctx = next(base(),D.offerNonAggressionPact(friendly('BRA','ARG',10,40),'BRA','ARG'));
    ctx.relations = D.setOpinion(ctx.relations,'BRA','ARG',-60);
    const refused = D.processDiplomacyAI(ctx,'BRA'); expect(D.offerNonAggressionPact(refused,'BRA','ARG').ok).toBe(false);
  });
  it('AI proposes relevant alliances/NAP, avoids useless access, guarantees friends and breaks extreme relations', () => {
    const interval = D.DIPLOMACY_BALANCE.aiInterval;
    const scheduled = (ctx: DiplomacyContext) => advance(ctx,(interval-D.diplomacyDay(ctx.date)%interval)%interval);
    let ctx = scheduled(friendly('BRA','ARG',60,80));
    ctx.countries = ctx.countries.filter(c => ['BRA','ARG'].includes(c.tag));
    const offer = D.processDiplomacyAI(ctx,'ARG');
    expect(offer.relations.flatMap(r => r.proposals ?? []).some(p => p.kind === 'alliance' && p.from === 'BRA')).toBe(true);
    expect(D.getGuarantors(offer.relations,'ARG')).toContain('BRA');
    const second = D.processDiplomacyAI({...offer,date: advance(offer,1).date},'ARG');
    expect(second.relations.flatMap(r => r.proposals ?? [])).toEqual(offer.relations.flatMap(r => r.proposals ?? []));
    ctx.relations = D.setOpinion(ctx.relations,'BRA','ARG',25);
    expect(D.processDiplomacyAI(ctx,'ARG').relations.flatMap(r => r.proposals ?? []).some(p => p.kind === 'nap')).toBe(true);
    ctx = nap({...ctx,relations: D.setOpinion(ctx.relations,'BRA','ARG',35)});
    expect(D.processDiplomacyAI(ctx,'ARG').relations.flatMap(r => r.proposals ?? []).some(p => p.kind === 'access')).toBe(false);
    ctx = allied(scheduled(friendly())); ctx.relations = D.setTrust(D.setOpinion(ctx.relations,'BRA','ARG',-80),'BRA','ARG',10);
    expect(D.areAllied(D.processDiplomacyAI(ctx,'ARG').relations,'BRA','ARG')).toBe(false);
  });
  it('joining one campaign fights all opponents without duplicating any pair', () => {
    let ctx = friendly('BRA','ARG'); ctx = allied(ctx);
    ctx.relations = D.setTrust(D.setOpinion(ctx.relations,'CHL','URY',60),'CHL','URY',80);
    ctx = next(ctx,D.guaranteeIndependence(ctx,'URY','CHL'));
    ctx = next(ctx,D.declareWar(ctx,'BRA','CHL'));
    const p = ctx.relations.flatMap(r => r.proposals ?? []).find(p => p.kind === 'call' && p.to === 'ARG')!;
    ctx = next(ctx,D.respondToWarCall(ctx,p.id,true));
    expect(D.areAtWar(ctx.relations,'ARG','CHL')).toBe(true);
    expect(D.areAtWar(ctx.relations,'ARG','URY')).toBe(true);
    expect(new Set(ctx.wars.map(w => D.relationKey(w.attacker,w.defender))).size).toBe(ctx.wars.length);
    expect(new Set(ctx.wars.map(w => w.campaignId)).size).toBe(1);
    expect(D.callAllyToWar(advance(ctx,200),'BRA','ARG',ctx.wars[0].id).message).toContain('participa');
  });
});
describe('Diplomacy V2 saves, cleanup and restored countries', () => {
  it('round trips agreements, directional fields, CBs, proposals and cooldowns', () => {
    let ctx = nap(allied()); ctx = next(ctx,D.guaranteeIndependence(ctx,'BRA','ARG'));
    ctx = next(ctx,D.generateConquestCasusBelli(ctx,'BRA','ARG'));
    ctx.relations = D.updateRelation(ctx.relations,'BRA','ARG',r => ({...r,militaryAccess: ['BRA']}));
    ctx.relations = D.setOpinion(ctx.relations,'BRA','URY',60);
    ctx = next(ctx,D.requestMilitaryAccess(ctx,'BRA','URY'));
    saveGame({dateRef: {current: ctx.date},countriesRef: {current: ctx.countries},provincesRef: {current: ctx.provinces!},armiesRef: {current: []},warsRef: {current: ctx.wars},diplomaticRelationsRef: {current: ctx.relations},
      recruitmentsRef: {current: []},buildingConstructionsRef: {current: []},activeBattlesRef: {current: []},playerTechStateRef: {current: createInitialTechState('BRA')},botTechStatesRef: {current: new Map()}},'diplomacy-v2');
    const loaded = loadGame('diplomacy-v2')!;
    expect(loaded.diplomacy.version).toBe(2);
    for (const r of ctx.relations) expect(D.getRelation(loaded.diplomacy.relations,r.countryA,r.countryB)).toMatchObject(r);
  });
  it('migrates old duplicated records, NAP countdown and military wars', () => {
    const ctx = base(),wars = [war('BRA','ARG')];
    const migrated = D.migrateDiplomacy([{countryA: 'BRA',countryB: 'ARG',opinion: 200,status: 'alliance'},
      {countryA: 'ARG',countryB: 'BRA',opinion: -100,status: 'war'},
      {countryA: 'BRA',countryB: 'URY',opinion: 10,status: 'non_aggression_pact',pactDaysRemaining: 5}],wars,ctx.date);
    expect(migrated).toHaveLength(2); expect(D.getRelation(migrated,'BRA','ARG')?.alliance).toBeUndefined();
    expect(D.areAtWar(migrated,'ARG','BRA')).toBe(true); expect(D.getTrust(migrated,'BRA','ARG')).toBe(50);
    expect(D.hasNonAggressionPact(migrated,'BRA','URY',D.diplomacyDay(ctx.date))).toBe(true);
    expect(D.migrateDiplomacy([],wars,ctx.date)[0].status).toBe('war');
    expect(D.migrateDiplomacy([{countryA: 'BRA',countryB: 'ARG',status: 'war'}],[],ctx.date)[0].status).toBe('peace');
  });
  it('load migrates a real legacy V1 save and preserves war identity', () => {
    const ctx = base(); localStorage.setItem('imperium_save_old-diplomacy',JSON.stringify({id: 'old-diplomacy',name: 'old',timestamp: 1,date: ctx.date,
      countries: ctx.countries,provinces: ctx.provinces,armies: [],wars: [war('BRA','ARG')],relations: [{countryA: 'BRA',countryB: 'ARG',opinion: -50,status: 'war',pactDaysRemaining: 0}],
      recruitments: [],constructions: [],activeBattles: [],playerTech: createInitialTechState('BRA'),botTechs: {}}));
    const loaded = loadGame('old-diplomacy')!;
    expect(loaded.military.wars[0].id).toBe('BRA-ARG'); expect(loaded.diplomacy.relations[0].trust).toBe(50);
    expect(loaded.diplomacy.relations[0]).not.toHaveProperty('pactDaysRemaining');
  });
  it('annexation removes every dangling agreement, CB and proposal', () => {
    let ctx = nap(allied()); ctx = next(ctx,D.guaranteeIndependence(ctx,'BRA','ARG')); ctx = next(ctx,D.generateConquestCasusBelli(ctx,'BRA','ARG'));
    for (const id of [...ctx.countries.find(c => c.tag === 'ARG')!.provinces]) {
      const t = transferProvince({provinces: ctx.provinces!,countries: ctx.countries,recruitments: [],constructions: []},id,'BRA');
      ctx = {...ctx,provinces: t.provinces,countries: t.countries};
    }
    const cleaned = D.cleanupDiplomacy(ctx); expect(cleaned.relations.some(r => [r.countryA,r.countryB].includes('ARG'))).toBe(false);
    expect(D.offerAlliance(cleaned,'BRA','ARG').ok).toBe(false);
    const restored = {...cleaned,countries: cleaned.countries.map(c => c.tag === 'ARG' ? {...c,isAnnexed: false,provinces: ['restored']} : c)};
    expect(D.generateConquestCasusBelli(restored,'BRA','ARG').ok).toBe(true);
  });
  it('rebels cannot receive agreements; internal conflicts still function', () => {
    const ctx = base(); ctx.countries.push({...ctx.countries[0],tag: 'rebel_v2_fake'});
    for (const action of ['offerAlliance','offerNap','requestAccess','guarantee'] as const) expect(D.actionBlockReason(ctx,'BRA','rebel_v2_fake',action)).toContain('rebelde');
    const internal = D.startInternalWar([],[],'rebel_v2_fake','BRA',ctx.date);
    expect(internal.wars).toHaveLength(1); expect(D.areAtWar(internal.relations,'BRA','rebel_v2_fake')).toBe(true);
  });
  it('cleanup preserves active civil war despite temporary total occupation of the government', () => {
    const ctx = base(),id = 'rebel_v2_fake';
    const faction = {id,owner: 'BRA',status: 'active'} as RebellionFaction;
    ctx.countries = ctx.countries.map(c => c.tag === 'BRA' ? {...c,provinces: [],rebellions: [faction]} : c);
    const internal = D.startInternalWar([],[],id,'BRA',ctx.date),cleaned = D.cleanupDiplomacy({...ctx,...internal});
    expect(cleaned.wars).toHaveLength(1); expect(D.areAtWar(cleaned.relations,id,'BRA')).toBe(true);
    expect(D.makePeace(cleaned,cleaned.wars[0].id).ok).toBe(false);
    expect(D.offerAlliance(cleaned,'BRA','ARG').ok).toBe(false);
  });
});
describe('Diplomacy V2 UI', () => {
  const panel = (ctx = base()) => {
    const onAction = vi.fn(),onProposal = vi.fn();
    render(<DiplomacyPanel context={ctx} playerCountry={ctx.countries.find(c => c.tag === 'BRA')!} targetCountry={ctx.countries.find(c => c.tag === 'ARG')!}
      onAction={onAction} onProposal={onProposal} onCall={vi.fn()} onClose={vi.fn()} />);
    return {onAction,onProposal};
  };
  it('renders neutral opinion/trust and disabled actions with reasons', () => {
    panel(); expect(screen.getByText('Paz')).toBeTruthy(); expect(screen.getByText('50/100')).toBeTruthy();
    expect((screen.getByRole('button',{name: 'Oferecer aliança'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Requer opinião +40')).toBeTruthy();
    expect((screen.getByRole('button',{name: 'Declarar guerra'}) as HTMLButtonElement).disabled).toBe(false);
  });
  it('shows ally status and blocks direct war', () => {
    panel(allied()); expect(screen.getByText('Aliado')).toBeTruthy();
    expect((screen.getByRole('button',{name: 'Declarar guerra'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Rompa a aliança primeiro')).toBeTruthy();
    expect((screen.getByRole('button',{name: 'Romper aliança'}) as HTMLButtonElement).disabled).toBe(false);
  });
  it('requires confirmation and shows penalties and CB selection', () => {
    const ctx = next(base(),D.generateConquestCasusBelli(base(),'BRA','ARG')),{onAction} = panel(ctx);
    fireEvent.click(screen.getByRole('button',{name: 'Declarar guerra'})); expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByText(/opinião global: -20/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Casus Belli'),{target: {value: ctx.relations[0].casusBelli![0].id}});
    expect(screen.getByText(/opinião global: -5/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name: 'Confirmar Declaração de Guerra'}));
    expect(onAction).toHaveBeenCalledWith('declareWar',ctx.relations[0].casusBelli![0].id);
  });
  it('renders war and disables declarations; exposes incoming accept/reject', () => {
    const ctx = next(base(),D.declareWar(base(),'BRA','ARG')); panel(ctx);
    expect(screen.getByText('Guerra')).toBeTruthy(); cleanup();
    const proposal = next(friendly(),D.offerAlliance(friendly(),'ARG','BRA')),{onProposal} = panel(proposal);
    fireEvent.click(screen.getByRole('button',{name: 'Aceitar'})); expect(onProposal).toHaveBeenCalledWith(proposal.relations[0].proposals![0].id,true);
  });
  it('action integration publishes named feedback, updates save refs immediately and prevents repeated war declarations', () => {
    const ctx = base(),relationsRef = {current: ctx.relations},warsRef = {current: ctx.wars},addToast = vi.fn();
    const {result} = renderHook(() => useDiplomacyActions({diplomacyTarget: 'ARG',playerCountryTag: 'BRA',countriesRef: {current: ctx.countries},provincesRef: {current: ctx.provinces!},
      armiesRef: {current: []},diplomaticRelationsRef: relationsRef,warsRef,dateRef: {current: ctx.date},setDiplomaticRelations: vi.fn(),setWars: vi.fn(),setArmies: vi.fn(),activeBattlesRef: {current: []},setActiveBattles: vi.fn(),addLog: vi.fn(),addToast}));
    act(() => { result.current.handleAction('declareWar'); result.current.handleAction('declareWar'); });
    expect(warsRef.current).toHaveLength(1); expect(D.areAtWar(relationsRef.current,'BRA','ARG')).toBe(true);
    expect(addToast.mock.calls[0][0]).toContain('Brasil'); expect(addToast.mock.calls[0][0]).toContain('Argentina');
  });
});
