import type { Army, BattleExtended } from '../../types';
import { calculateArmySize } from './combatCalculations';

export type BattleSide = 'attacker' | 'defender';
export type WarPair = { attacker: string; defender: string; campaignId?: string };
export type BattleHostility = (a: Pick<Army,'owner'|'originalOwner'>, b: Pick<Army,'owner'|'originalOwner'>) => boolean;
/** Ephemeral campaign lookup, built once per arrival/continuous tick. */
export function createBattleHostility(wars: readonly WarPair[]): BattleHostility {
  const enemies=new Map<string,Set<string>>();
  const add=(a:string,b:string)=>{const set=enemies.get(a) ?? new Set<string>();set.add(b);enemies.set(a,set);};
  const campaigns=new Map<string,{attackers:Set<string>;defenders:Set<string>}>();
  for(const war of wars) {
    add(war.attacker,war.defender);add(war.defender,war.attacker);
    if(war.campaignId) {const group=campaigns.get(war.campaignId) ?? {attackers:new Set<string>(),defenders:new Set<string>()};group.attackers.add(war.attacker);group.defenders.add(war.defender);campaigns.set(war.campaignId,group);}
  }
  for(const group of campaigns.values()) {
    if([...group.attackers].some(tag=>group.defenders.has(tag))) continue;
    for(const a of group.attackers) for(const b of group.defenders) {add(a,b);add(b,a);}
  }
  return (a,b)=> a.owner.startsWith('rebel_') || b.owner.startsWith('rebel_') ? areBattleEnemies(a,b,wars) : a.owner!==b.owner && !!enemies.get(a.owner)?.has(b.owner);
}
export function areBattleEnemies(a: Pick<Army, 'owner' | 'originalOwner'>, b: Pick<Army, 'owner' | 'originalOwner'>, wars: readonly WarPair[]): boolean {
  if (a.owner === b.owner) return false;
  const ar = a.owner.startsWith('rebel_'), br = b.owner.startsWith('rebel_');
  if (ar && br) return false;
  if (ar) return a.owner.startsWith('rebel_v2_') ? b.owner === a.originalOwner : b.owner !== (a.originalOwner ?? '');
  if (br) return areBattleEnemies(b, a, wars);
  return wars.some(w => (w.attacker === a.owner && w.defender === b.owner) || (w.defender === a.owner && w.attacker === b.owner));
}
export function getBattleParticipants(battle: BattleExtended, armies: readonly Army[]): Army[] {
  const ids = new Set(battle.participantArmyIds);
  return armies.filter(a => ids.has(a.id)).sort((a,b) => a.id.localeCompare(b.id));
}
export function getValidParticipantsBySide(battle: BattleExtended, armies: readonly Army[], side: BattleSide): Army[] {
  return getBattleParticipants(battle, armies).filter(a => !a.embarkedFleetId && !a.retreatProtectionDays && a.location === battle.provinceId && calculateArmySize(a) > 0
    && (battle.participantSides?.[a.id] ?? (a.owner === battle.attackerCountryId ? 'attacker' : a.owner === battle.defenderCountryId ? 'defender' : undefined)) === side);
}
export function isArmyInActiveBattle(id: string, battles: readonly BattleExtended[]): boolean {
  return battles.some(b => b.participantArmyIds.includes(id));
}
/** Refuse contradictory membership (hostile to both sides) and neutral arrivals. */
export function getReinforcementSide(army: Army, battle: BattleExtended, armies: readonly Army[], wars: readonly WarPair[], hostility: BattleHostility = createBattleHostility(wars)): BattleSide | null {
  const attackers = getValidParticipantsBySide(battle, armies, 'attacker');
  const defenders = getValidParticipantsBySide(battle, armies, 'defender');
  const hostileA = attackers.some(a => hostility(army,a));
  const hostileD = defenders.some(a => hostility(army,a));
  return hostileD && !hostileA ? 'attacker' : hostileA && !hostileD ? 'defender' : null;
}
