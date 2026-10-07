import type { DiplomacyContext } from './diplomacyTypes';
import { getCampaignId, getCampaignWars } from './campaigns';
import { diplomacyDay, relationKey, updateRelation } from './diplomacyRelations';

/** Shared formal close for white peace and surrender; settlement belongs to the caller. */
export function endCampaign(ctx: DiplomacyContext, campaignId: string) {
  const ended = getCampaignWars(ctx.wars,campaignId), ids = new Set(ended.map(w => w.id));
  const wars = ctx.wars.filter(w => getCampaignId(w) !== campaignId);
  let relations = ctx.relations;
  for (const w of ended) if (!wars.some(other => relationKey(other.attacker,other.defender) === relationKey(w.attacker,w.defender))) {
    relations = updateRelation(relations,w.attacker,w.defender,r => ({...r,status:'peace',lastWarEndedAt:diplomacyDay(ctx.date)}));
  }
  relations = relations.map(r => ({...r,proposals:r.proposals?.filter(p => !p.warId || p.warId !== campaignId && !ids.has(p.warId))}));
  return {...ctx,wars,relations};
}
