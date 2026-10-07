import type { War } from '../../types';

export const getCampaignId = (war: War) => war.campaignId || war.id;
export const getCampaignWars = (wars: War[], id: string) => wars.filter(w => getCampaignId(w) === id).sort((a,b) => a.id.localeCompare(b.id));
export function getCampaign(wars: War[], id: string) {
  const pairs = getCampaignWars(wars,id);
  const root = pairs.find(w => w.id === id) ?? pairs[0];
  if (!root) return null;
  const attackerParticipants = new Set([root.attacker]), defenderParticipants = new Set(root.attacker === root.defender ? [] : [root.defender]);
  let inconsistent = root.attacker === root.defender;
  for (const pair of pairs) {
    if (defenderParticipants.has(pair.attacker) || attackerParticipants.has(pair.defender) || pair.attacker === pair.defender) { inconsistent = true; continue; }
    attackerParticipants.add(pair.attacker); defenderParticipants.add(pair.defender);
  }
  return {id, root, pairs, attackerLeader:root.attacker, defenderLeader:root.defender,
    attackerParticipants:[...attackerParticipants], defenderParticipants:[...defenderParticipants], inconsistent,
    civil: pairs.some(w => [w.attacker,w.defender].some(tag => tag.startsWith('rebel_')))};
}
export type Campaign = NonNullable<ReturnType<typeof getCampaign>>;
export const getCampaigns = (wars: War[]) => [...new Set(wars.map(getCampaignId))].sort().map(id => getCampaign(wars,id)!);

/** Each pair counter is a contribution attributed to its named country, never copied to other pairs. */
export function getCampaignCasualties(campaign: Campaign) {
  const byCountry: Record<string,number> = {};
  for (const pair of campaign.pairs) for (const [tag, raw] of [[pair.attacker,pair.attackerCasualties],[pair.defender,pair.defenderCasualties]] as const) {
    byCountry[tag] = (byCountry[tag] ?? 0) + (Number.isFinite(raw) ? Math.max(0,raw) : 0);
  }
  return {byCountry, attacker:campaign.attackerParticipants.reduce((sum,tag) => sum+(byCountry[tag] ?? 0),0),
    defender:campaign.defenderParticipants.reduce((sum,tag) => sum+(byCountry[tag] ?? 0),0)};
}
