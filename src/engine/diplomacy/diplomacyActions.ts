import type { DiplomacyAction, DiplomaticProposal, ProposalKind } from '../../types/diplomacy';
import { DIPLOMACY_BALANCE as B } from './diplomacyBalance';
import { diplomacyDay, getRelation, updateRelation, changeOpinion, changeTrust } from './diplomacyRelations';
import { hasMilitaryAccess, hasNonAggressionPact, isDiplomaticCountry } from './diplomacySelectors';
import { result, type DiplomacyContext, type DiplomacyResult } from './diplomacyTypes';

export function pairBlockReason(ctx: DiplomacyContext, a: string, b: string): string | undefined {
  if (a === b) return 'Escolha outro país';
  if (![a,b].every(tag => isDiplomaticCountry(ctx.countries.find(c => c.tag === tag)))) return 'País inexistente, rebelde ou anexado';
}
export function actionBlockReason(ctx: DiplomacyContext, a: string, b: string, action: DiplomacyAction): string | undefined {
  const invalid = pairBlockReason(ctx,a,b); if (invalid) return invalid;
  const r = getRelation(ctx.relations,a,b), day = diplomacyDay(ctx.date);
  const nap = hasNonAggressionPact(ctx.relations,a,b,day);
  if (action === 'breakAlliance') return r?.alliance ? undefined : 'Não existe aliança';
  if (action === 'breakNap') return nap ? undefined : 'Não existe pacto ativo';
  if (action === 'revokeAccess') return r?.militaryAccess?.includes(a) ? undefined : 'Você não concedeu acesso';
  if (action === 'withdrawGuarantee') return r?.guarantees?.includes(a) ? undefined : 'Você não garante este país';
  if (r?.status === 'war') return 'Já está em guerra';
  if (action === 'declareWar') {
    if (r?.alliance) return 'Rompa a aliança primeiro';
    if (nap) return 'Pacto de Não Agressão ativo';
    return;
  }
  if ((r?.cooldowns?.[`${a}:${action}`] ?? -Infinity) > day) return 'Ação em cooldown';
  const requirements: Partial<Record<DiplomacyAction, [number,number]>> = {
    offerAlliance: [B.allianceMinOpinion,B.allianceMinTrust], offerNap: [B.napMinOpinion,B.napMinTrust],
    requestAccess: [B.militaryAccessMinOpinion,B.militaryAccessMinTrust], guarantee: [B.guaranteeMinOpinion,B.guaranteeMinTrust],
  };
  if (action === 'offerAlliance' && r?.alliance) return 'Já são aliados';
  if (action === 'offerNap' && nap) return 'Pacto de Não Agressão ativo';
  if (action === 'requestAccess' && hasMilitaryAccess(ctx.relations,a,b)) return 'Acesso já concedido';
  if (action === 'guarantee' && r?.guarantees?.includes(a)) return 'Garantia já ativa';
  const req = requirements[action];
  if (req && (r?.opinion ?? 0) < req[0]) return `Requer opinião +${req[0]}`;
  if (req && (r?.trust ?? 50) < req[1]) return `Requer confiança ${req[1]}`;
}
export const proposalAction: Record<Exclude<ProposalKind,'call'>, DiplomacyAction> = { alliance: 'offerAlliance',nap: 'offerNap',access: 'requestAccess' };
export function offerAgreement(ctx: DiplomacyContext, from: string,to: string,kind: Exclude<ProposalKind,'call'>): DiplomacyResult {
  const action = proposalAction[kind], reason = actionBlockReason(ctx,from,to,action);
  if (reason) return result(ctx,false,reason);
  const day = diplomacyDay(ctx.date);
  const r = getRelation(ctx.relations,from,to);
  if (r?.proposals?.some(p => p.kind === kind && p.expiresAt > day)) return result(ctx,false,'Proposta já pendente');
  const proposal: DiplomaticProposal = { id: `${kind}:${from}:${to}:${day}`,kind,from,to,createdAt: day,expiresAt: day+B.proposalDuration };
  const relations = updateRelation(ctx.relations,from,to,r => ({...r,
    proposals: [...(r.proposals ?? []),proposal],cooldowns: {...r.cooldowns,[`${from}:${action}`]: day+B.actionCooldown} }));
  return result({...ctx,relations},true,`Proposta enviada a ${to}.`);
}
/** Shared response checks; proposals and UI use the same agreement rules. */
export function agreementResponseBlockReason(ctx: DiplomacyContext,from: string,to: string,kind: Exclude<ProposalKind,'call'>): string | undefined {
  const invalid = pairBlockReason(ctx,from,to); if (invalid) return invalid;
  const day = diplomacyDay(ctx.date);
  const relations = updateRelation(ctx.relations,from,to,r => ({...r,cooldowns: {...r.cooldowns,[`${from}:${proposalAction[kind]}`]: day}}));
  return actionBlockReason({...ctx,relations},from,to,proposalAction[kind]);
}
export function respondAgreement(ctx: DiplomacyContext, from: string,to: string,kind: Exclude<ProposalKind,'call'>,accept: boolean): DiplomacyResult {
  const r = getRelation(ctx.relations,from,to),day = diplomacyDay(ctx.date);
  if (!r?.proposals?.some(p => p.from === from && p.to === to && p.kind === kind && p.expiresAt > day)) return result(ctx,false,'Proposta não existe ou expirou');
  const aiRefusal = !accept && r.proposals?.some(p => p.from === from && p.to === to && p.kind === kind && p.aiToPlayer);
  const clean = updateRelation(ctx.relations,from,to,r => ({...r,
    ...(aiRefusal ? {cooldowns: {...r.cooldowns,[`${from}:aiProposalRetry:${kind}`]: day+B.aiRejectedProposalRetryDays}} : {}),
    proposals: r.proposals?.filter(p => !(p.kind === kind && p.from === from && p.to === to))}));
  if (!accept) return result({...ctx,relations: clean},true,`${to} recusou a proposta de ${kind === 'alliance' ? 'aliança' : kind === 'nap' ? 'pacto' : 'acesso'}.`);
  // Revalidate conditions, excluding the sender's offer cooldown.
  const reason = agreementResponseBlockReason({...ctx,relations: clean},from,to,kind);
  if (reason) return result({...ctx,relations: clean},false,reason);
  const relations = updateRelation(clean,from,to,r => ({...r,
    ...(kind === 'alliance' ? {alliance: {since: day}} : kind === 'nap' ? {nonAggressionPact: {since: day,expiresAt: day+B.napDuration}}
      : {militaryAccess: [...new Set([...(r.militaryAccess ?? []),to])]}),
  }));
  return result({...ctx,relations},true,`${to} aceitou sua proposta de ${kind === 'alliance' ? 'aliança' : kind === 'nap' ? 'pacto de não agressão' : 'acesso militar'}.`);
}
export const offerAlliance = (c: DiplomacyContext,a: string,b: string) => offerAgreement(c,a,b,'alliance');
export const acceptAlliance = (c: DiplomacyContext,a: string,b: string) => respondAgreement(c,a,b,'alliance',true);
export const rejectAlliance = (c: DiplomacyContext,a: string,b: string) => respondAgreement(c,a,b,'alliance',false);
export const offerNonAggressionPact = (c: DiplomacyContext,a: string,b: string) => offerAgreement(c,a,b,'nap');
export const acceptNonAggressionPact = (c: DiplomacyContext,a: string,b: string) => respondAgreement(c,a,b,'nap',true);
export const rejectNonAggressionPact = (c: DiplomacyContext,a: string,b: string) => respondAgreement(c,a,b,'nap',false);
export const requestMilitaryAccess = (c: DiplomacyContext,a: string,b: string) => offerAgreement(c,a,b,'access');
export const grantMilitaryAccess = (c: DiplomacyContext,grantor: string,visitor: string) => respondAgreement(c,visitor,grantor,'access',true);
export function breakAgreement(ctx: DiplomacyContext,a: string,b: string,kind: 'alliance' | 'nap'): DiplomacyResult {
  const reason = actionBlockReason(ctx,a,b,kind === 'alliance' ? 'breakAlliance' : 'breakNap'); if (reason) return result(ctx,false,reason);
  let relations = updateRelation(ctx.relations,a,b,r => ({...r,...(kind === 'alliance' ? {alliance: undefined} : {nonAggressionPact: undefined,lastNapBroken: {by: a,at: diplomacyDay(ctx.date)}})}));
  relations = changeOpinion(relations,a,b,kind === 'alliance' ? B.breakAllianceOpinionPenalty : B.breakNapOpinionPenalty);
  relations = changeTrust(relations,a,b,kind === 'alliance' ? B.breakAllianceTrustPenalty : B.breakNapTrustPenalty);
  return result({...ctx,relations},true,`${a} rompeu ${kind === 'alliance' ? 'a aliança' : 'o pacto'} com ${b}.`);
}
export const breakAlliance = (c: DiplomacyContext,a: string,b: string) => breakAgreement(c,a,b,'alliance');
export const breakNonAggressionPact = (c: DiplomacyContext,a: string,b: string) => breakAgreement(c,a,b,'nap');
export function revokeMilitaryAccess(ctx: DiplomacyContext,grantor: string,visitor: string): DiplomacyResult {
  const reason = actionBlockReason(ctx,grantor,visitor,'revokeAccess'); if (reason) return result(ctx,false,reason);
  const relations = updateRelation(ctx.relations,grantor,visitor,r => ({...r,militaryAccess: r.militaryAccess?.filter(t => t !== grantor)}));
  return result({...ctx,relations},true,`${grantor} revogou o acesso de ${visitor}.`);
}
export function guaranteeIndependence(ctx: DiplomacyContext,a: string,b: string): DiplomacyResult {
  const reason = actionBlockReason(ctx,a,b,'guarantee'); if (reason) return result(ctx,false,reason);
  const relations = updateRelation(ctx.relations,a,b,r => ({...r,guarantees: [...new Set([...(r.guarantees ?? []),a])]}));
  return result({...ctx,relations},true,`${b} está garantido por ${a}.`);
}
export function withdrawGuarantee(ctx: DiplomacyContext,a: string,b: string): DiplomacyResult {
  const reason = actionBlockReason(ctx,a,b,'withdrawGuarantee'); if (reason) return result(ctx,false,reason);
  const relations = updateRelation(ctx.relations,a,b,r => ({...r,guarantees: r.guarantees?.filter(t => t !== a)}));
  return result({...ctx,relations},true,`${a} retirou a garantia de ${b}.`);
}
