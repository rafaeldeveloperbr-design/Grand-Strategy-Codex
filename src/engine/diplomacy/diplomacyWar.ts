import type { DiplomaticRelation, GameDate, War } from '../../types';
import { DIPLOMACY_BALANCE as B } from './diplomacyBalance';
import { changeOpinion, changeTrust, diplomacyDay, getRelation, relationKey, updateRelation } from './diplomacyRelations';
import { actionBlockReason, pairBlockReason } from './diplomacyActions';
import { areAtWar, getAllies, getGuarantors } from './diplomacySelectors';
import { getCasusBelli } from './casusBelli';
import { result, type DiplomacyContext, type DiplomacyResult } from './diplomacyTypes';

/** Single transition creating a military pair record and diplomatic war status. */
function startWarPair(ctx: Pick<DiplomacyContext,'relations' | 'wars' | 'date'>,attacker: string,defender: string,campaignId?: string): Pick<DiplomacyContext,'relations' | 'wars'> {
  if (attacker === defender || ctx.wars.some(w => relationKey(w.attacker,w.defender) === relationKey(attacker,defender))) return ctx;
  const baseId = `war:${attacker}:${defender}:${diplomacyDay(ctx.date)}`;
  let id = baseId, n = 1; while (ctx.wars.some(w => w.id === id)) id = `${baseId}:${n++}`;
  const war: War = { id,campaignId: campaignId ?? id,attacker,defender,startDate: {...ctx.date},warScore: 0,attackerCasualties: 0,defenderCasualties: 0,occupiedByAttacker: [],occupiedByDefender: [] };
  const relations = updateRelation(ctx.relations,attacker,defender,r => ({...r,status: 'war',alliance: undefined,nonAggressionPact: undefined,militaryAccess: [],guarantees: [],proposals: []}));
  return {relations,wars: [...ctx.wars,war]};
}
/** Rebellion integration only: civil conflicts are not diplomatic declarations. */
export function startInternalWar(relations: DiplomaticRelation[],wars: War[],attacker: string,defender: string,date: GameDate) {
  return startWarPair({relations,wars,date},attacker,defender);
}
export function warPenaltyPreview(ctx: DiplomacyContext,attacker: string,defender: string,withCb: boolean) {
  const broken = getRelation(ctx.relations,attacker,defender)?.lastNapBroken;
  const napPenalty = broken?.by === attacker && diplomacyDay(ctx.date)-broken.at < B.recentNapWindow ? B.brokenNapWarPenalty : 0;
  return { opinion: B.declareWarOpinionPenalty+(withCb ? 0 : B.declareWarWithoutCbAdditional)+napPenalty,
    globalOpinion: withCb ? B.globalWarOpinionPenalty : B.globalWarWithoutCbPenalty,
    trust: (withCb ? B.warTrustPenalty : B.warWithoutCbTrustPenalty)+napPenalty };
}
export function declareWar(ctx: DiplomacyContext,attacker: string,defender: string,cbId?: string): DiplomacyResult {
  const reason = actionBlockReason(ctx,attacker,defender,'declareWar'); if (reason) return result(ctx,false,reason);
  if (ctx.wars.some(w => relationKey(w.attacker,w.defender) === relationKey(attacker,defender))) return result(ctx,false,'Já está em guerra');
  const cb = cbId ? getCasusBelli(ctx.relations,attacker,defender,diplomacyDay(ctx.date)).find(c => c.id === cbId && c.type === 'conquest') : undefined;
  if (cbId && !cb) return result(ctx,false,'Casus Belli inválido ou expirado');
  const penalty = warPenaltyPreview(ctx,attacker,defender,!!cb);
  let next = {...ctx,...startWarPair(ctx,attacker,defender)};
  next.relations = changeOpinion(next.relations,attacker,defender,penalty.opinion);
  next.relations = changeTrust(next.relations,attacker,defender,penalty.trust);
  next.relations = updateRelation(next.relations,attacker,defender,r => ({...r,casusBelli: r.casusBelli?.filter(c => c.id !== cbId)}));
  const root = next.wars[next.wars.length-1];
  next.wars = next.wars.map(w => w.id === root.id ? {...w,casusBelliType: cb?.type} : w);
  for (const country of ctx.countries.filter(c => c.tag !== attacker && c.tag !== defender && !c.isAnnexed && !c.tag.startsWith('rebel_') && c.provinces.length)) {
    next.relations = changeOpinion(next.relations,attacker,country.tag,penalty.globalOpinion);
    next.relations = changeTrust(next.relations,attacker,country.tag,penalty.trust);
  }
  const messages = [`${attacker} declarou guerra contra ${defender}${cb ? ' com Casus Belli de conquista' : ' sem Casus Belli'}.`];
  // Guarantees are binding defensive commitments. Existing hostile agreements are
  // explicitly broken with penalties; guarantees never create a second campaign.
  for (const guarantor of getGuarantors(ctx.relations,defender)) {
    if (guarantor === attacker || pairBlockReason(next,guarantor,attacker)) continue;
    const joined = joinCampaign(next,root,guarantor,'defender',true);
    next = {...next,...joined}; if (joined.ok) messages.push(`${guarantor} honrou a garantia de ${defender}.`);
  }
  for (const caller of [attacker,defender]) for (const ally of getAllies(next.relations,caller)) {
    const called = callAllyToWar(next,caller,ally,root.id);
    next = {...next,...called};
  }
  return result(next,true,messages.join(' '));
}

function joinCampaign(ctx: DiplomacyContext,war: War,ally: string,side: 'attacker' | 'defender',binding = false): DiplomacyResult {
  const campaign = war.campaignId ?? war.id;
  const pairs = ctx.wars.filter(w => (w.campaignId ?? w.id) === campaign);
  const friends = new Set(pairs.map(w => side === 'attacker' ? w.attacker : w.defender));
  const enemies = new Set(pairs.map(w => side === 'attacker' ? w.defender : w.attacker));
  if (enemies.has(ally)) return result(ctx,false,'Aliado já está do lado inimigo');
  if ([...friends].some(friend => areAtWar(ctx.relations,ally,friend))) return result(ctx,false,'Aliado está em guerra com este lado');
  let next = ctx;
  for (const enemy of enemies) {
    if (areAtWar(next.relations,ally,enemy)) continue;
    const reason = actionBlockReason(next,ally,enemy,'declareWar');
    if (reason && !binding) return result(ctx,false,reason);
    if (pairBlockReason(next,ally,enemy)) return result(ctx,false,'Participante inválido');
    let relations = next.relations;
    if (binding && getRelation(relations,ally,enemy)?.alliance) {
      relations = changeOpinion(relations,ally,enemy,B.breakAllianceOpinionPenalty);
      relations = changeTrust(relations,ally,enemy,B.breakAllianceTrustPenalty);
    }
    if (binding && (getRelation(relations,ally,enemy)?.nonAggressionPact?.expiresAt ?? -Infinity) > diplomacyDay(ctx.date)) {
      relations = changeOpinion(relations,ally,enemy,B.breakNapOpinionPenalty);
      relations = changeTrust(relations,ally,enemy,B.breakNapTrustPenalty);
    }
    next = {...next,...startWarPair({...next,relations},side === 'attacker' ? ally : enemy,side === 'attacker' ? enemy : ally,campaign)};
    next.relations = changeOpinion(next.relations,ally,enemy,B.declareWarOpinionPenalty);
  }
  return result(next,true,`${ally} entrou na guerra.`);
}
export function warCallBlockReason(ctx: DiplomacyContext,caller: string,ally: string,warId: string): string | undefined {
  const reason = pairBlockReason(ctx,caller,ally); if (reason) return reason;
  const r = getRelation(ctx.relations,caller,ally),war = ctx.wars.find(w => w.id === warId);
  if (!r?.alliance || !war || ![war.attacker,war.defender].includes(caller)) return 'Aliança ou guerra inválida';
  if (ctx.wars.some(w => (w.campaignId ?? w.id) === (war.campaignId ?? war.id) && [w.attacker,w.defender].includes(ally))) return 'Aliado já participa desta guerra';
  const day = diplomacyDay(ctx.date),key = `${caller}:call:${war.campaignId ?? war.id}`;
  if ((r.cooldowns?.[key] ?? -Infinity) > day || r.proposals?.some(p => p.kind === 'call' && p.warId === warId && p.to === ally)) return 'Chamada já enviada';
}
export function callAllyToWar(ctx: DiplomacyContext,caller: string,ally: string,warId: string): DiplomacyResult {
  const reason = warCallBlockReason(ctx,caller,ally,warId); if (reason) return result(ctx,false,reason);
  const war = ctx.wars.find(w => w.id === warId)!;
  const day = diplomacyDay(ctx.date),key = `${caller}:call:${war.campaignId ?? war.id}`;
  const relations = updateRelation(ctx.relations,caller,ally,r => ({...r,cooldowns: {...r.cooldowns,[key]: day+B.actionCooldown},proposals: [...(r.proposals ?? []),
    {id: `call:${caller}:${ally}:${warId}:${day}`,kind: 'call',from: caller,to: ally,createdAt: day,expiresAt: day+B.proposalDuration,warId}]}));
  return result({...ctx,relations},true,`${ally} foi chamado à guerra.`);
}
export function respondToWarCall(ctx: DiplomacyContext,proposalId: string,accept: boolean): DiplomacyResult {
  const r = ctx.relations.find(r => r.proposals?.some(p => p.id === proposalId));
  const p = r?.proposals?.find(p => p.id === proposalId && p.kind === 'call');
  const war = ctx.wars.find(w => w.id === p?.warId);
  if (!r || !p || !war || accept && p.expiresAt <= diplomacyDay(ctx.date)) return result(ctx,false,'Chamada inválida ou expirada');
  let next = {...ctx,relations: updateRelation(ctx.relations,p.from,p.to,r => ({...r,proposals: r.proposals?.filter(q => q.id !== proposalId)}))};
  if (accept && getRelation(next.relations,p.from,p.to)?.alliance && !pairBlockReason(next,p.from,p.to)) {
    const joined = joinCampaign(next,war,p.to,war.attacker === p.from ? 'attacker' : 'defender');
    if (joined.ok) return joined;
  }
  next = {...next,relations: changeOpinion(next.relations,p.from,p.to,B.callToWarRefusalOpinionPenalty)};
  next.relations = changeTrust(next.relations,p.from,p.to,B.callToWarRefusalTrustPenalty);
  return result(next,true,`${p.to} recusou a chamada à guerra de ${p.from}.`);
}
/** Minimal white peace resolves every pair in this campaign. */
export function makePeace(ctx: DiplomacyContext,warId: string): DiplomacyResult {
  const war = ctx.wars.find(w => w.id === warId); if (!war) return result(ctx,false,'Guerra não encontrada');
  if ([war.attacker,war.defender].some(tag => tag.startsWith('rebel_'))) return result(ctx,false,'Guerra civil é resolvida pelos objetivos da rebelião');
  const ended = ctx.wars.filter(w => (w.campaignId ?? w.id) === (war.campaignId ?? war.id));
  const ids = new Set(ended.map(w => w.id));
  const wars = ctx.wars.filter(w => !ids.has(w.id));
  let relations = ctx.relations;
  for (const w of ended) if (!wars.some(other => relationKey(other.attacker,other.defender) === relationKey(w.attacker,w.defender))) {
    relations = updateRelation(relations,w.attacker,w.defender,r => ({...r,status: 'peace',lastWarEndedAt: diplomacyDay(ctx.date)}));
  }
  relations = relations.map(r => ({...r,proposals: r.proposals?.filter(p => !p.warId || !ids.has(p.warId))}));
  return result({...ctx,relations,wars},true,'Paz branca assinada por todos os participantes da guerra.');
}
