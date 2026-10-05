import type { ActiveBattle, Army, GameDate, Province, RetreatInfo } from '../../types';
import { applyTroopLoss, calculateArmySize } from './combatCalculations';
import { findRetreatProvince } from './combatRetreats';
import { getBuildingLevel } from '../../data/buildings';
import { calculateArmyCombatStats, calculateArmyOrganization, calculateArmySiege, getArmySupply, getRegimentOrganization, MILITARY_BALANCE } from '../military';

export type BattleExtended = ActiveBattle & {
  reinforcementEntryDay?: Record<string, number>;
  reinforcementInitialSize?: Record<string, number>;
  attackerInitialSnapshot?: Army;
  defenderInitialSnapshot?: Army;
  retreatInfo?: RetreatInfo | null;
};

type WarPair = { attacker: string; defender: string };

const atWar = (a: string, b: string, wars: WarPair[]) => wars.some(w =>
  (w.attacker === a && w.defender === b) || (w.attacker === b && w.defender === a));

function participants(battle: BattleExtended, armies: Army[], side: 'attacker' | 'defender') {
  const attackerCountry = battle.attackerCountryId || armies.find(a => a.id === battle.attackerArmyId)?.owner;
  const defenderCountry = battle.defenderCountryId || armies.find(a => a.id === battle.defenderArmyId)?.owner;
  return armies.filter(army => battle.participantArmyIds.includes(army.id)
    && ((battle.participantSides?.[army.id] ??
      (army.owner === attackerCountry ? 'attacker' : army.owner === defenderCountry ? 'defender' : undefined)) === side)
    && calculateArmySize(army) > 0);
}

function sideTotal(battle: BattleExtended, armies: Army[], side: 'attacker' | 'defender') {
  return participants(battle, armies, side).reduce((sum, army) => sum + calculateArmySize(army), 0);
}

function applySideLoss(armies: Army[], sideArmies: Army[], loss: number, organizationDamage: number): Army[] {
  let remaining = Math.min(loss, sideArmies.reduce((sum, army) => sum + calculateArmySize(army), 0));
  return armies.map(army => {
    if (!sideArmies.some(item => item.id === army.id) || remaining <= 0) return army;
    const armyLoss = Math.min(calculateArmySize(army), remaining);
    remaining -= armyLoss;
    const damaged = applyTroopLoss(army, armyLoss);
    return { ...damaged, regiments: damaged.regiments.map(regiment => ({ ...regiment,
      organization: Math.max(0, getRegimentOrganization(regiment) - organizationDamage),
      morale: Math.max(0, regiment.morale - organizationDamage * .35),
      experience: Math.min(100, (regiment.experience ?? 0) + MILITARY_BALANCE.experienceGainPerDay),
    })) };
  });
}

/** Replaces missing representatives and derives troop totals from regiments. */
export function synchronizeBattle(battle: BattleExtended, armies: Army[]): BattleExtended | null {
  const attackerArmies = participants(battle, armies, 'attacker');
  const defenderArmies = participants(battle, armies, 'defender');
  if (attackerArmies.length === 0 || defenderArmies.length === 0) return null;
  return {
    ...battle,
    attackerArmyId: attackerArmies.some(a => a.id === battle.attackerArmyId)
      ? battle.attackerArmyId : attackerArmies[0].id,
    defenderArmyId: defenderArmies.some(a => a.id === battle.defenderArmyId)
      ? battle.defenderArmyId : defenderArmies[0].id,
    attackerCurrentTroops: attackerArmies.reduce((sum, army) => sum + calculateArmySize(army), 0),
    defenderCurrentTroops: defenderArmies.reduce((sum, army) => sum + calculateArmySize(army), 0),
  };
}

export function checkAllProvinceCombats(
  armies: Army[], provinces: Province[], wars: WarPair[], currentDate: GameDate,
  activeBattles: BattleExtended[],
  _techBonusesByCountry?: Map<string, { infantry: number; cavalry: number; artillery: number }>
) {
  void _techBonusesByCountry;
  let updatedArmies = [...armies];
  const updatedBattles: BattleExtended[] = [];
  const newBattles: BattleExtended[] = [];
  const reinforcementsAdded: Array<{ battleId: string; armyId: string; armyOwner: string; side: 'attacker' | 'defender'; troops: number; provinceName: string }> = [];

  for (const original of activeBattles) {
    let battle = synchronizeBattle(original, updatedArmies);
    if (!battle) {
      updatedArmies = updatedArmies.map(a => original.participantArmyIds.includes(a.id) ? { ...a, inCombat: false } : a);
      continue;
    }
    const province = provinces.find(p => p.id === battle!.provinceId);
    if (!province) continue;
    for (const army of updatedArmies.filter(a => a.location === province.id && !a.inCombat)) {
      const side = army.owner === battle.attackerCountryId ? 'attacker'
        : army.owner === battle.defenderCountryId ? 'defender'
        : atWar(army.owner, battle.defenderCountryId, wars) ? 'attacker'
        : atWar(army.owner, battle.attackerCountryId, wars) ? 'defender' : null;
      if (!side) continue;
      battle = addReinforcementsToBattle(battle, army, side, province);
      updatedArmies = updatedArmies.map(a => a.id === army.id ? { ...a, inCombat: true } : a);
      reinforcementsAdded.push({ battleId: battle.id, armyId: army.id, armyOwner: army.owner, side, troops: calculateArmySize(army), provinceName: province.name });
    }
    updatedBattles.push(synchronizeBattle(battle, updatedArmies) ?? battle);
  }

  for (const province of provinces) {
    if (updatedBattles.some(b => b.provinceId === province.id)) continue;
    const available = updatedArmies.filter(a => a.location === province.id && !a.inCombat && calculateArmySize(a) > 0);
    const defenders = available.filter(a => a.owner === province.owner);
    const attackers = available.filter(a => a.owner !== province.owner && atWar(a.owner, province.owner, wars));
    if (!attackers.length || !defenders.length) continue;
    const battle = startContinuousBattle(attackers, defenders, province, currentDate,
      `battle_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`);
    newBattles.push(battle);
    updatedArmies = updatedArmies.map(a => battle.participantArmyIds.includes(a.id) ? { ...a, inCombat: true } : a);
  }
  return { armies: updatedArmies, newBattles, updatedBattles, reinforcementsAdded };
}

export function startContinuousBattle(attackerArmies: Army[], defenderArmies: Army[], province: Province, currentDate: GameDate, battleId: string): BattleExtended {
  const attackerTroops = attackerArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  const defenderTroops = defenderArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  const smaller = Math.min(attackerTroops, defenderTroops);
  const daysTotal = smaller <= 1000 ? 1 : smaller <= 2500 ? 3 : Math.max(2, Math.floor(smaller / 1500));
  const participantSides: Record<string, 'attacker' | 'defender'> = {};
  attackerArmies.forEach(a => { participantSides[a.id] = 'attacker'; });
  defenderArmies.forEach(a => { participantSides[a.id] = 'defender'; });
  return {
    id: battleId, provinceId: province.id,
    attackerArmyId: attackerArmies[0].id, defenderArmyId: defenderArmies[0].id,
    attackerCountryId: attackerArmies[0].owner, defenderCountryId: defenderArmies[0].owner,
    participantArmyIds: [...attackerArmies, ...defenderArmies].map(a => a.id), participantSides,
    daysTotal, daysRemaining: daysTotal,
    attackerInitialTroops: attackerTroops, defenderInitialTroops: defenderTroops,
    attackerCurrentTroops: attackerTroops, defenderCurrentTroops: defenderTroops,
    attackerCasualties: 0, defenderCasualties: 0, startDate: currentDate,
    attackerInitialSnapshot: { ...attackerArmies[0], regiments: attackerArmies[0].regiments.map(r => ({ ...r })) },
    defenderInitialSnapshot: { ...defenderArmies[0], regiments: defenderArmies[0].regiments.map(r => ({ ...r })) },
    reinforcementEntryDay: {}, reinforcementInitialSize: {},
  };
}

export function addReinforcementsToBattle(battle: BattleExtended, army: Army, side: 'attacker' | 'defender', _province: Province): BattleExtended {
  void _province;
  if (battle.participantArmyIds.includes(army.id)) return battle;
  return {
    ...battle,
    participantArmyIds: [...battle.participantArmyIds, army.id],
    participantSides: { ...(battle.participantSides ?? {}), [army.id]: side },
    reinforcementEntryDay: { ...battle.reinforcementEntryDay, [army.id]: battle.daysTotal - battle.daysRemaining },
    reinforcementInitialSize: { ...battle.reinforcementInitialSize, [army.id]: calculateArmySize(army) },
  };
}

/** Processes every participant, including collective retreat/annihilation. */
export function processBattleDay(battle: BattleExtended, armies: Army[], province: Province, allProvinces: Province[], combatMultipliers: ReadonlyMap<string, number> = new Map(), fortificationMultipliers: ReadonlyMap<string, number> = new Map()) {
  const synced = synchronizeBattle(battle, armies);
  if (!synced) {
    const attackerAlive = sideTotal(battle, armies, 'attacker') > 0;
    const released = armies.map(a => battle.participantArmyIds.includes(a.id) ? { ...a, inCombat: false } : a);
    return { battle: { ...battle, attackerCurrentTroops: sideTotal(battle, armies, 'attacker'), defenderCurrentTroops: sideTotal(battle, armies, 'defender') }, armies: released, finished: true, winner: attackerAlive ? 'attacker' as const : 'defender' as const, retreatInfo: null };
  }
  const daysRemaining = synced.daysRemaining - 1;
  const attackerBefore = synced.attackerCurrentTroops;
  const defenderBefore = synced.defenderCurrentTroops;
  const attackerOwner = participants(synced, armies, 'attacker')[0]?.owner ?? '';
  const defenderOwner = participants(synced, armies, 'defender')[0]?.owner ?? '';
  const attackerPower = combatMultipliers.get(attackerOwner) ?? 1;
  const defenderPower = combatMultipliers.get(defenderOwner) ?? 1;
  const effectiveDefense = province.defense + getBuildingLevel(province, 'fortress') * 2;
  const fortificationMultiplier = fortificationMultipliers.get(defenderOwner) ?? 1;
  const attackerArmies = participants(synced, armies, 'attacker');
  const defenderArmies = participants(synced, armies, 'defender');
  const attackerStats = attackerArmies.reduce((total, army) => { const stats = calculateArmyCombatStats(army); return { attack: total.attack + stats.attack, defense: total.defense + stats.defense, shock: total.shock + stats.shock }; }, { attack: 0, defense: 0, shock: 0 });
  const defenderStats = defenderArmies.reduce((total, army) => { const stats = calculateArmyCombatStats(army); return { attack: total.attack + stats.attack, defense: total.defense + stats.defense, shock: total.shock + stats.shock }; }, { attack: 0, defense: 0, shock: 0 });
  const attackerSupply = attackerArmies.reduce((sum, army) => sum + getArmySupply(army, province, attackerArmies).combatMultiplier, 0) / attackerArmies.length;
  const defenderSupply = defenderArmies.reduce((sum, army) => sum + getArmySupply(army, province, defenderArmies).combatMultiplier, 0) / defenderArmies.length;
  const siege = attackerArmies.reduce((sum, army) => sum + calculateArmySiege(army), 0);
  const fortBonus = Math.min(MILITARY_BALANCE.maximumFortDefense, effectiveDefense * MILITARY_BALANCE.fortDefensePerLevel / (1 + siege / 20)) * fortificationMultiplier;
  const attackerPressure = (attackerStats.attack + attackerStats.shock * .45) * attackerPower * attackerSupply;
  const defenderPressure = (defenderStats.attack + defenderStats.defense * .35) * defenderPower * defenderSupply * (1 + fortBonus);
  const attackerLoss = Math.min(attackerBefore, Math.max(1, Math.floor(attackerBefore * MILITARY_BALANCE.dailyBaseCasualtyRate * defenderPressure / Math.max(1, attackerPressure))));
  const defenderLoss = Math.min(defenderBefore, Math.max(1, Math.floor(defenderBefore * MILITARY_BALANCE.dailyBaseCasualtyRate * attackerPressure / Math.max(1, defenderPressure))));
  let updatedArmies = applySideLoss(armies, attackerArmies, attackerLoss, MILITARY_BALANCE.dailyBaseOrganizationDamage * defenderPressure / Math.max(1, attackerPressure));
  updatedArmies = applySideLoss(updatedArmies, participants(synced, updatedArmies, 'defender'), defenderLoss, MILITARY_BALANCE.dailyBaseOrganizationDamage * attackerPressure / Math.max(1, defenderPressure));
  let next = synchronizeBattle(synced, updatedArmies);
  const attackerAfter = next?.attackerCurrentTroops ?? sideTotal(synced, updatedArmies, 'attacker');
  const defenderAfter = next?.defenderCurrentTroops ?? sideTotal(synced, updatedArmies, 'defender');
  const attackerOrganization = participants(synced, updatedArmies, 'attacker').reduce((sum, army) => sum + calculateArmyOrganization(army), 0) / Math.max(1, participants(synced, updatedArmies, 'attacker').length);
  const defenderOrganization = participants(synced, updatedArmies, 'defender').reduce((sum, army) => sum + calculateArmyOrganization(army), 0) / Math.max(1, participants(synced, updatedArmies, 'defender').length);
  const finished = daysRemaining <= 0 || attackerOrganization <= MILITARY_BALANCE.organizationRetreatThreshold || defenderOrganization <= MILITARY_BALANCE.organizationRetreatThreshold || attackerAfter <= 50 || defenderAfter <= 50 || !next;
  const loserSide: 'attacker' | 'defender' = attackerOrganization <= defenderOrganization ? 'attacker' : 'defender';
  let retreatInfo: RetreatInfo | null = null;

  if (finished) {
    const loserTroops = loserSide === 'attacker' ? attackerAfter : defenderAfter;
    if (loserTroops > 0 && loserTroops <= 1500) {
      const losers = participants(synced, updatedArmies, loserSide);
      let retreatedTroops = 0;
      let firstDestination: Province | null = null;
      updatedArmies = updatedArmies.map(army => {
        if (!losers.some(loser => loser.id === army.id)) return army;
        const destination = findRetreatProvince(army.owner, province, allProvinces);
        if (!destination) return { ...army, regiments: [], inCombat: false, destination: null, targetDestination: null, path: [] };
        firstDestination ??= destination;
        retreatedTroops += calculateArmySize(army);
        return { ...army, location: destination.id, inCombat: false, destination: null, targetDestination: null, path: [], movementProgress: 0 };
      });
      const retreatDestination = firstDestination as Province | null;
      if (retreatDestination) retreatInfo = { retreated: true, to: retreatDestination.id, toName: retreatDestination.name, troops: retreatedTroops, owner: losers[0]?.owner ?? '' };
    }
    updatedArmies = updatedArmies.map(a => synced.participantArmyIds.includes(a.id) ? { ...a, inCombat: false } : a);
  }
  const finalAttacker = sideTotal(synced, updatedArmies, 'attacker');
  const finalDefender = sideTotal(synced, updatedArmies, 'defender');
  const finalBattle: BattleExtended = {
    ...(next ?? synced), daysRemaining,
    attackerCurrentTroops: finalAttacker, defenderCurrentTroops: finalDefender,
    attackerCasualties: synced.attackerCasualties + attackerLoss,
    defenderCasualties: synced.defenderCasualties + defenderLoss, retreatInfo,
  };
  return { battle: finalBattle, armies: updatedArmies, finished, winner: finalAttacker > finalDefender ? 'attacker' as const : 'defender' as const, retreatInfo };
}

// Compatibility wrapper for older direct callers.
export function processDailyBattle(battle: BattleExtended, attacker: Army, defender: Army, province: Province, allProvinces: Province[] = []) {
  const result = processBattleDay(battle, [attacker, defender], province, allProvinces);
  return { ...result, attacker: result.armies.find(a => a.id === attacker.id) ?? attacker, defender: result.armies.find(a => a.id === defender.id) ?? defender,
    attackerCurrentTroops: result.battle.attackerCurrentTroops, defenderCurrentTroops: result.battle.defenderCurrentTroops };
}
