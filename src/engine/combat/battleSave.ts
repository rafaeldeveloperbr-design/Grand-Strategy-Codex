import { BATTLE_V3 } from './battleConfig';
import type { ActiveBattle, Army, BattleExtended } from '../../types';
import { calculateArmySize } from './combatCalculations';

/** Old saves kept side totals but not every army's initial size. Keep the exact
 * side total, preserve known snapshots/reinforcements, and infer only the rest. */
function inferInitialSizes(battle: BattleExtended, ids: string[], sides: ActiveBattle['participantSides'], armyById: Map<string,Army>): Record<string,number> {
  const snapshots=new Map(Object.entries(battle.participantSnapshots ?? {}));
  for(const snapshot of [battle.attackerInitialSnapshot,battle.defenderInitialSnapshot]) if(snapshot) snapshots.set(snapshot.id,snapshot);
  const sizes: Record<string,number>={}, unknown=new Set<string>();
  for(const id of ids) {
    const reinforcement=battle.reinforcementInitialSize?.[id], snapshot=snapshots.get(id), current=armyById.get(id);
    sizes[id]=reinforcement ?? (snapshot ? calculateArmySize(snapshot) : current ? calculateArmySize(current) : 0);
    if(reinforcement===undefined&&!snapshot) unknown.add(id);
  }
  for(const side of ['attacker','defender'] as const) {
    const members=ids.filter(id=>sides[id]===side), missing=members.filter(id=>unknown.has(id));
    if(!missing.length) continue;
    const initial=side==='attacker'?battle.attackerInitialTroops:battle.defenderInitialTroops;
    const reinforcement=members.reduce((sum,id)=>sum+(battle.reinforcementInitialSize?.[id] ?? 0),0);
    const known=members.filter(id=>!unknown.has(id)).reduce((sum,id)=>sum+sizes[id],0);
    const remaining=Math.max(0,Math.floor(initial+reinforcement-known));
    const weight=missing.reduce((sum,id)=>sum+sizes[id],0);
    let remainder=remaining;
    for(const id of missing) {sizes[id]=Math.floor(remaining*(weight ? sizes[id]/weight : 1/missing.length));remainder-=sizes[id];}
    for(const id of missing) if(remainder>0) {sizes[id]++;remainder--;}
  }
  return sizes;
}

/** Additive migration: retain ongoing casualties and never trigger arrival on load. */
export function normalizeBattleSave(battles: ActiveBattle[], armies: Army[]): ActiveBattle[] {
  const armyById=new Map(armies.map(a=>[a.id,a]));
  const seenBattles=new Set<string>(), seenProvinces=new Set<string>(), seenArmies=new Set<string>();
  return [...battles].sort((a,b)=>a.id.localeCompare(b.id)).flatMap(battle=>{
    if(seenBattles.has(battle.id)||seenProvinces.has(battle.provinceId)) return [];
    seenBattles.add(battle.id);seenProvinces.add(battle.provinceId);
    const participantArmyIds=[...new Set(battle.participantArmyIds ?? [battle.attackerArmyId,battle.defenderArmyId])].sort().filter(id=>!seenArmies.has(id));
    participantArmyIds.forEach(id=>seenArmies.add(id));
    const attackerCountryId=battle.attackerCountryId ?? armyById.get(battle.attackerArmyId)?.owner ?? battle.attackerInitialSnapshot?.owner ?? '';
    const defenderCountryId=battle.defenderCountryId ?? armyById.get(battle.defenderArmyId)?.owner ?? battle.defenderInitialSnapshot?.owner ?? '';
    const participantSides={...battle.participantSides};
    for(const id of participantArmyIds) if(!participantSides[id]) {
      const owner=armyById.get(id)?.owner;
      if(owner===attackerCountryId) participantSides[id]='attacker';
      else if(owner===defenderCountryId) participantSides[id]='defender';
    }
    const durationDays=battle.durationDays ?? Math.max(0,battle.daysTotal-battle.daysRemaining);
    return [{...battle,participantArmyIds,participantSides,attackerCountryId,defenderCountryId,durationDays,
      phase:battle.phase ?? (durationDays<=BATTLE_V3.engagementDays?'ENGAGEMENT':'MAIN_COMBAT'),
      participantInitialSizes:battle.participantInitialSizes ?? inferInitialSizes(battle,participantArmyIds,participantSides,armyById),
      participantSnapshots:battle.participantSnapshots ?? Object.fromEntries(participantArmyIds.flatMap(id=>{const a=armyById.get(id);return a?[[id,{...a,regiments:a.regiments.map(r=>({...r}))}]]:[]})),
    }];
  });
}
