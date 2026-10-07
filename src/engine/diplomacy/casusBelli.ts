import type { CasusBelli, DiplomaticRelation } from '../../types';
import { DIPLOMACY_BALANCE as B } from './diplomacyBalance';
import { diplomacyDay, getRelation, updateRelation } from './diplomacyRelations';
import { actionBlockReason } from './diplomacyActions';
import { result, type DiplomacyContext, type DiplomacyResult } from './diplomacyTypes';
export function getCasusBelli(rs: DiplomaticRelation[],attacker: string,target: string,day: number): CasusBelli[] {
  return (getRelation(rs,attacker,target)?.casusBelli ?? []).filter(cb => cb.attacker === attacker && cb.target === target && cb.createdAt <= day && (cb.expiresAt === undefined || cb.expiresAt > day));
}
export function generateConquestCasusBelli(ctx: DiplomacyContext,attacker: string,target: string,targetProvinceIds?: string[]): DiplomacyResult {
  const reason = actionBlockReason(ctx,attacker,target,'generateConquestCb'); if (reason) return result(ctx,false,reason);
  if (targetProvinceIds?.some(id => !ctx.countries.find(c => c.tag === target)?.provinces.includes(id))) return result(ctx,false,'Província alvo inválida');
  const day = diplomacyDay(ctx.date);
  if (getCasusBelli(ctx.relations,attacker,target,day).some(cb => cb.type === 'conquest')) return result(ctx,false,'Casus Belli de conquista já disponível');
  const cb: CasusBelli = { id: `conquest:${attacker}:${target}:${day}`,attacker,target,type: 'conquest',createdAt: day,expiresAt: day+B.cbDuration,targetProvinceIds };
  const relations = updateRelation(ctx.relations,attacker,target,r => ({...r,casusBelli: [...(r.casusBelli ?? []),cb],cooldowns: {...r.cooldowns,[`${attacker}:generateConquestCb`]: day+B.actionCooldown}}));
  return result({...ctx,relations},true,`Casus Belli de conquista criado contra ${target}.`);
}
