import type { ActiveBattle, Army, CombatResult, Country, GameDate, Province, War, DiplomaticRelation } from '../../types';
import { transferProvince, type TerritoryTransferState } from '../territoryTransfer';
import { getCampaign, getCampaignCasualties, getCampaigns, type Campaign } from './campaigns';
import { endCampaign } from './campaignEnd';
import { cancelInvalidDiplomaticRoutes, resolvePeaceBattles } from './diplomacyLifecycle';
import { diplomacyDay } from './diplomacyRelations';
import { WAR_RESOLUTION_BALANCE as B } from './warResolutionBalance';

const clamp = (value: number, min = 0, max: number = B.percent) => Math.min(max,Math.max(min,value));
export const militaryStrength = (armies: Army[], tags: string[]) => armies.filter(a => tags.includes(a.owner)).reduce((sum,a) => sum+a.regiments.reduce((n,r) => n+(Number.isFinite(r.strength) ? Math.max(0,r.strength) : 0),0),0);
export function isCapitalOccupied(country: Country | undefined, provinces: Province[]) {
  const capital = provinces.find(p => p.id === (country?.capitalId ?? country?.capital));
  return !!country && !!capital && capital.owner !== country.tag;
}
export function getTerritorialControl(tag: string, provinces: Province[]) {
  const relevant = provinces.filter(p => (p.originalOwner || p.owner) === tag);
  const lost = relevant.filter(p => p.owner !== tag).length;
  return {total:relevant.length, lost, controlled:relevant.length-lost, lossRatio:relevant.length ? lost/relevant.length : 0};
}
export function calculateSurrenderProgress(tag: string, campaign: Campaign, provinces: Province[], countries: Country[], armies: Army[]) {
  const territory = getTerritorialControl(tag,provinces), country = countries.find(c => c.tag === tag);
  // Territorial elimination must be settled before diplomacy cleanup, even if an army survives abroad.
  if (country && !provinces.some(p => p.owner === tag)) return B.surrenderThreshold;
  const casualties = getCampaignCasualties(campaign).byCountry[tag] ?? 0, remaining = militaryStrength(armies,[tag]);
  const attrition = casualties+remaining ? casualties/(casualties+remaining) : 0;
  const militaryDestroyed = casualties+remaining ? casualties/(casualties+remaining) : 1;
  return clamp(territory.lossRatio*B.surrenderTerritory + Number(isCapitalOccupied(country,provinces))*B.surrenderCapital
    + attrition*B.surrenderCasualties + militaryDestroyed*B.surrenderMilitary);
}
export function calculateCampaignWarScore(campaign: Campaign, provinces: Province[], countries: Country[]) {
  const a = getTerritorialControl(campaign.attackerLeader,provinces).lossRatio;
  const d = getTerritorialControl(campaign.defenderLeader,provinces).lossRatio;
  const losses = getCampaignCasualties(campaign), total = losses.attacker+losses.defender;
  return clamp((d-a)*B.scoreTerritory
    + (Number(isCapitalOccupied(countries.find(c => c.tag === campaign.defenderLeader),provinces))-Number(isCapitalOccupied(countries.find(c => c.tag === campaign.attackerLeader),provinces)))*B.scoreCapital
    + (total ? (losses.defender-losses.attacker)/total : 0)*B.scoreMilitary,B.scoreMin,B.scoreMax);
}

export function shouldUseDefensiveWarPosture(tag: string, wars: War[], provinces: Province[], countries: Country[], armies: Army[]) {
  return getCampaigns(wars).some(c => {
    if (c.civil || c.inconsistent || ![...c.attackerParticipants,...c.defenderParticipants].includes(tag)) return false;
    const attacking = c.attackerParticipants.includes(tag);
    const score = calculateCampaignWarScore(c,provinces,countries)*(attacking ? 1 : -1);
    const leader = attacking ? c.attackerLeader : c.defenderLeader;
    return score <= B.aiDefensiveScore || calculateSurrenderProgress(leader,c,provinces,countries,armies) >= B.aiDefensiveSurrender;
  });
}

/** Statistics only. Battle IDs persist on the root so replay/load cannot count a finished result twice. */
export function recordBattleWarCasualties(wars: War[], battleId: string, result: Pick<CombatResult,'attacker'|'defender'|'attackerCasualties'|'defenderCasualties'|'participantDetails'> & {countryCasualties?:Record<string,number>}) {
  const candidates = getCampaigns(wars).filter(c => !c.civil && !c.inconsistent &&
    (c.attackerParticipants.includes(result.attacker.owner) && c.defenderParticipants.includes(result.defender.owner)
      || c.defenderParticipants.includes(result.attacker.owner) && c.attackerParticipants.includes(result.defender.owner)));
  const campaign = candidates[0];
  const recorded = Array.isArray(campaign?.root.recordedBattleIds) ? campaign.root.recordedBattleIds : [];
  if (!campaign || recorded.includes(battleId)) return wars;
  const losses = new Map<string,number>();
  if (result.countryCasualties) {
    for (const [tag,loss] of Object.entries(result.countryCasualties)) losses.set(tag,Number.isFinite(loss) ? Math.max(0,loss) : 0);
  } else if (result.participantDetails?.some(d => d.owner && Number.isFinite(d.loss))) {
    const seen = new Set<string>();
    for (const detail of result.participantDetails) {
      if (seen.has(detail.id)) continue; seen.add(detail.id);
      if (!detail.owner) continue;
      losses.set(detail.owner,(losses.get(detail.owner) ?? 0)+(typeof detail.loss === 'number' && Number.isFinite(detail.loss) ? Math.max(0,detail.loss) : 0));
    }
  } else {
    losses.set(result.attacker.owner,Math.max(0,result.attackerCasualties));
    losses.set(result.defender.owner,Math.max(0,result.defenderCasualties));
  }
  const updated = new Map(campaign.pairs.map(w => [w.id,{...w}]));
  for (const [tag,loss] of losses) {
    const side = campaign.attackerParticipants.includes(tag) ? 'attacker' : campaign.defenderParticipants.includes(tag) ? 'defender' : null;
    if (!side) continue;
    const pair = campaign.pairs.find(w => w[side] === tag)!;
    const record = updated.get(pair.id)!;
    const key = side === 'attacker' ? 'attackerCasualties' : 'defenderCasualties';
    record[key] = (Number.isFinite(record[key]) ? Math.max(0,record[key]) : 0)+loss;
  }
  updated.get(campaign.root.id)!.recordedBattleIds = [...recorded,battleId];
  return wars.map(w => updated.get(w.id) ?? w);
}

export interface WarResolutionState extends TerritoryTransferState {
  wars: War[]; relations: DiplomaticRelation[]; armies: Army[]; activeBattles: ActiveBattle[]; date: GameDate;
}
export interface CampaignResolution {campaignId:string; winner:string; loser:string; participants:string[]; transferredProvinceIds:string[]; message:string}
export function resolveCampaign(state: WarResolutionState, campaignId: string, winnerSide: 'attacker'|'defender') {
  const campaign = getCampaign(state.wars,campaignId);
  if (!campaign || campaign.civil || campaign.inconsistent) return {state,result:null};
  if ([campaign.attackerLeader,campaign.defenderLeader].some(tag => {
    const country = state.countries.find(c => c.tag === tag);
    return !country || country.rebellions?.some(f => f.status === 'active');
  })) return {state,result:null};
  const winner = winnerSide === 'attacker' ? campaign.attackerLeader : campaign.defenderLeader;
  const loser = winnerSide === 'attacker' ? campaign.defenderLeader : campaign.attackerLeader;
  const winners = winnerSide === 'attacker' ? campaign.attackerParticipants : campaign.defenderParticipants;
  const losers = winnerSide === 'attacker' ? campaign.defenderParticipants : campaign.attackerParticipants;
  let territory: TerritoryTransferState = state;
  const transferredProvinceIds: string[] = [];
  for (const province of state.provinces) {
    const original = province.originalOwner || province.owner;
    const restored = winners.includes(original) && losers.includes(province.owner) && state.countries.some(c => c.tag === original && !c.tag.startsWith('rebel_'));
    const recipient = restored ? original : province.owner === loser ? winner : null;
    if (!recipient || recipient === province.owner) continue;
    territory = transferProvince(territory,province.id,recipient,{date:state.date});
    transferredProvinceIds.push(province.id);
  }
  territory.countries = territory.countries.map(c => c.tag === loser && !territory.provinces.some(p => p.owner === loser) && !c.rebellions?.some(f => f.status === 'active')
    ? {...c,isAnnexed:true} : winners.includes(c.tag) && territory.provinces.some(p => p.owner === c.tag) ? {...c,isAnnexed:false} : c);
  const closed = endCampaign({...state,...territory},campaignId);
  const released = resolvePeaceBattles(state.activeBattles,state.armies,closed.relations);
  const next = {...state,...territory,...closed,activeBattles:released.battles,armies:cancelInvalidDiplomaticRoutes(released.armies,territory.provinces,closed.relations)};
  const name = (tag:string) => state.countries.find(c => c.tag === tag)?.name ?? 'País desconhecido';
  const result: CampaignResolution = {campaignId,winner,loser,participants:[...winners,...losers],transferredProvinceIds,message:`${name(loser)} se rendeu. ${name(winner)} venceu a campanha.`};
  return {state:next,result};
}
export function processWarResolutionTick(state: WarResolutionState) {
  let next = state; const resolutions: CampaignResolution[] = [];
  for (const campaign of getCampaigns(state.wars)) {
    if (campaign.civil || campaign.inconsistent) continue;
    const score = calculateCampaignWarScore(campaign,next.provinces,next.countries);
    next = {...next,wars:next.wars.map(w => campaign.pairs.some(p => p.id === w.id) ? {...w,warScore:score,
      daysSinceStart:Math.max(0,diplomacyDay(state.date)-diplomacyDay(campaign.root.startDate)),
      occupiedByAttacker:next.provinces.filter(p => campaign.attackerParticipants.includes(p.owner) && campaign.defenderParticipants.includes(p.originalOwner || p.owner)).map(p => p.id),
      occupiedByDefender:next.provinces.filter(p => campaign.defenderParticipants.includes(p.owner) && campaign.attackerParticipants.includes(p.originalOwner || p.owner)).map(p => p.id)} : w)};
    // Active civil objectives retain ownership of their government's lifecycle.
    if (next.countries.some(c => [campaign.attackerLeader,campaign.defenderLeader].includes(c.tag) && c.rebellions?.some(f => f.status === 'active'))) continue;
    const defender = calculateSurrenderProgress(campaign.defenderLeader,campaign,next.provinces,next.countries,next.armies);
    const attacker = calculateSurrenderProgress(campaign.attackerLeader,campaign,next.provinces,next.countries,next.armies);
    // If both reach threshold, score breaks the tie; zero favors the defending side.
    const side = defender >= B.surrenderThreshold && (attacker < B.surrenderThreshold || score > 0) ? 'attacker' : attacker >= B.surrenderThreshold ? 'defender' : null;
    if (side) { const resolved = resolveCampaign(next,campaign.id,side); next = resolved.state; if (resolved.result) resolutions.push(resolved.result); }
  }
  return {...next,resolutions};
}
