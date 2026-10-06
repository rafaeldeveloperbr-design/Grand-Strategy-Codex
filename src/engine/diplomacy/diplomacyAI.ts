import type { ProposalKind } from '../../types';
import { DIPLOMACY_BALANCE as B } from './diplomacyBalance';
import { getRelation, diplomacyDay } from './diplomacyRelations';
import { getCountryWars, isDiplomaticCountry } from './diplomacySelectors';
import { breakAlliance, breakNonAggressionPact, guaranteeIndependence, offerAgreement, respondAgreement } from './diplomacyActions';
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
/** Deterministic decisions, persisted per-action cooldowns, no daily proposal spam. */
export function processDiplomacyAI(ctx: DiplomacyContext,playerTag: string) {
  let next = ctx; const messages: string[] = [];
  const apply = (r: ReturnType<typeof respondAgreement>) => { next = {...next,relations: r.relations,wars: r.wars}; if (r.ok) messages.push(r.message); };
  for (const p of ctx.relations.flatMap(r => r.proposals ?? [])) {
    if (p.to === playerTag || p.expiresAt <= diplomacyDay(ctx.date)) continue;
    apply(p.kind === 'call' ? respondToWarCall(next,p.id,shouldAcceptWarCall(next,p.id)) : respondAgreement(next,p.from,p.to,p.kind,shouldAcceptAgreement(next,p.from,p.to,p.kind)));
  }
  if (diplomacyDay(ctx.date) % B.aiInterval !== 0) return {...next,messages};
  const valid = ctx.countries.filter(isDiplomaticCountry);
  for (const a of valid.filter(c => c.tag !== playerTag)) {
    for (const b of valid.filter(c => c.tag !== a.tag)) {
      const r = getRelation(next.relations,a.tag,b.tag);
      if (r && r.opinion <= -75 && r.trust < B.napMinTrust) {
        if (r.alliance) apply(breakAlliance(next,a.tag,b.tag));
        if (r.nonAggressionPact) apply(breakNonAggressionPact(next,a.tag,b.tag));
        continue;
      }
      for (const kind of ['alliance','nap','access'] as const) {
        if (shouldAcceptAgreement(next,a.tag,b.tag,kind)) {
          const offer = offerAgreement(next,a.tag,b.tag,kind);
          if (offer.ok) { apply(offer); break; }
        }
      }
      if (r && r.opinion >= B.guaranteeMinOpinion && r.trust >= B.guaranteeMinTrust
        && diplomaticPower(next,a.tag) > diplomaticPower(next,b.tag) && getCountryWars(next.wars,a.tag).length === 0) apply(guaranteeIndependence(next,a.tag,b.tag));
      if (r?.alliance) for (const war of getCountryWars(next.wars,a.tag)) apply(callAllyToWar(next,a.tag,b.tag,war.id));
    }
  }
  return {...next,messages};
}
