import { getTerrainDefinition } from '../terrain';
import { RECENT_DEFEAT_DAYS } from '../aiEngine/militaryRecovery';
import type { LogisticsSnapshot } from '../logistics';
import type {
  Army,
  Province,
  GameDate,
  RetreatInfo,
  BattleSideSnapshot,
  BattleEndReason,
  DiplomaticRelation,
  BattleExtended,
  UnitType,
} from '../../types';
import { applyTroopLoss, calculateArmySize } from './combatCalculations';
import { findRetreatProvince } from './combatRetreats';
import { getBuildingBonus } from '../../data/buildings';
import {
  calculateArmyCombatStats,
  calculateArmyOrganization,
  calculateArmyMorale,
  calculateArmySiege,
  getArmySupply,
  getRegimentOrganization,
  MILITARY_BALANCE
} from '../military';


import { BATTLE_V3 } from './battleConfig';
import { createBattleHostility, getBattleParticipants, getValidParticipantsBySide as participants, getReinforcementSide, type WarPair } from './battleParticipants';

function sideTotal(battle: BattleExtended, armies: Army[], side: 'attacker' | 'defender') {
  return getBattleParticipants(battle, armies).filter(a => battle.participantSides[a.id] === side).reduce((sum, army) => sum + calculateArmySize(army), 0);
}

function applySideLoss(armies: Army[], sideArmies: Army[], loss: number, organizationDamage: number): Army[] {
  const total = sideArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  const requested = Math.min(Math.floor(loss), total);
  const allocations = new Map<string, number>();
  let remaining = requested;
  for (const army of sideArmies) {
    const share = Math.floor(requested * calculateArmySize(army) / Math.max(1,total));
    allocations.set(army.id, share); remaining -= share;
  }
  for (const army of sideArmies) {
    if (remaining > 0 && (allocations.get(army.id) ?? 0) < calculateArmySize(army)) {
      allocations.set(army.id, (allocations.get(army.id) ?? 0) + 1); remaining--;
    }
  }
  return armies.map(army => {
    if (!allocations.has(army.id)) return army;
    const damaged = applyTroopLoss(army, allocations.get(army.id)!);
    return { ...damaged, regiments: damaged.regiments.map(regiment => ({
      ...regiment,
      organization: Math.max(0, getRegimentOrganization(regiment) - organizationDamage),
      morale: Math.max(0, regiment.morale - organizationDamage * BATTLE_V3.moraleDamageShare),
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
  techBonusesByCountry?: Map<string, Partial<Record<UnitType, number>>>,
  logistics?: LogisticsSnapshot
) {

  const hostility = createBattleHostility(wars);
  let updatedArmies = [...armies].sort((a,b) => a.id.localeCompare(b.id));
  const armyById = new Map(updatedArmies.map(a => [a.id,a]));
  const armiesByProvince = new Map<string, Army[]>();
  for (const army of updatedArmies) {
    if (army.location) { const group = armiesByProvince.get(army.location) ?? []; group.push(army); armiesByProvince.set(army.location,group); }
  }
  const provinceById = new Map(provinces.map(p => [p.id,p]));
  const battleByProvince = new Map<string, BattleExtended>();
  const battleByArmy = new Map<string, string>();
  const updatedBattles: BattleExtended[] = [];
  const newBattles: BattleExtended[] = [];
  const reinforcementsAdded: Array<{ battleId: string; armyId: string; armyOwner: string; side: 'attacker' | 'defender'; troops: number; provinceName: string }> = [];
  for (const original of [...activeBattles].sort((a,b) => a.id.localeCompare(b.id))) {
    if (battleByProvince.has(original.provinceId)) continue;
    const ids = original.participantArmyIds.filter(id => !battleByArmy.has(id));
    let battle = {...original, participantArmyIds: ids};
    for (const id of ids) battleByArmy.set(id,battle.id);
    const local = ids.map(id => armyById.get(id)).filter((a): a is Army => !!a);
    battle = synchronizeBattle(battle, local) ?? battle;
    const province = provinceById.get(battle.provinceId);
    // Stale sides remain queued for the finalizer, never silently dropped.
    if (province && synchronizeBattle(battle,local)) {
      for (const army of armiesByProvince.get(province.id) ?? []) {
        if (army.embarkedFleetId || army.retreatProtectionDays || battleByArmy.has(army.id) || calculateArmySize(army) <= 0) continue;
        const side = getReinforcementSide(army,battle,local,wars,hostility);
        if (!side) continue;
        battle = addReinforcementsToBattle(battle,army,side,province);
        battleByArmy.set(army.id,battle.id); local.push(army);
        reinforcementsAdded.push({battleId:battle.id,armyId:army.id,armyOwner:army.owner,side,troops:calculateArmySize(army),provinceName:province.name});
      }
    }
    updatedBattles.push(synchronizeBattle(battle,local) ?? battle);
    battleByProvince.set(battle.provinceId,battle);
  }
  for (const [provinceId, local] of [...armiesByProvince].sort(([a],[b]) => a.localeCompare(b))) {
    if (battleByProvince.has(provinceId)) continue;
    const province = provinceById.get(provinceId);
    if (!province) continue;
    const available = local.filter(a => !a.embarkedFleetId && !a.retreatProtectionDays && !battleByArmy.has(a.id) && calculateArmySize(a) > 0);
    // Hostility is between armies, even when a third country owns the province.
    let defender = available.find(a => a.owner === province.owner);
    let attacker = defender && available.find(a => hostility(a,defender!));
    if (!attacker) {
      attacker = available.find(a => available.some(b => hostility(a,b)));
      defender = attacker && available.find(a => hostility(a,attacker!));
    }
    if (!attacker || !defender) continue;
    let battle = startContinuousBattle([attacker],[defender],province,currentDate,
      `battle_${currentDate.year}_${currentDate.month}_${currentDate.day}_${province.id}_${attacker.id}_${defender.id}`, logistics, techBonusesByCountry);
    for (const army of available) {
      if (army.id === attacker.id || army.id === defender.id) continue;
      const side = getReinforcementSide(army,battle,available,wars,hostility);
      if (side) battle = addReinforcementsToBattle(battle,army,side,province);
    }
    // Starting armies are initial participants, not reinforcements.
    const initialAttackers = available.filter(a => battle.participantSides[a.id] === 'attacker');
    const initialDefenders = available.filter(a => battle.participantSides[a.id] === 'defender');
    battle = startContinuousBattle(initialAttackers,initialDefenders,province,currentDate,battle.id,logistics,techBonusesByCountry);
    newBattles.push(battle);
    for (const id of battle.participantArmyIds) battleByArmy.set(id,battle.id);
  }
  updatedArmies = updatedArmies.map(a => battleByArmy.has(a.id) ? {...a,inCombat:true} : a.inCombat ? {...a,inCombat:false} : a);

  return { armies: updatedArmies, newBattles, updatedBattles, reinforcementsAdded };
}

function getRegimentComposition(
  armies: Army[]
): Partial<Record<UnitType, number>> {
  const composition: Partial<Record<UnitType, number>> = {};

  for (const army of armies) {
    for (const regiment of army.regiments) {
      composition[regiment.type] =
        (composition[regiment.type] ?? 0) + regiment.strength;
    }
  }

  return composition;
}

function createBattleSideSnapshot(
  armies: Army[],
  province: Province,
  logistics?: LogisticsSnapshot, unitBonuses: ReadonlyMap<string, Partial<Record<UnitType, number>>> = new Map()
): BattleSideSnapshot {
  const troops = armies.reduce(
    (sum, army) => sum + calculateArmySize(army),
    0
  );

  const organization =
    armies.reduce((sum,army) => sum + calculateArmyOrganization(army) * calculateArmySize(army),0) / Math.max(1,troops);

  const morale =
    armies.reduce((sum,army) => sum + calculateArmyMorale(army) * calculateArmySize(army),0) / Math.max(1,troops);

  const stats = armies.reduce(
    (total, army) => {
      const armyStats = calculateArmyCombatStats(army, unitBonuses.get(army.owner));

      return {
        attack: total.attack + armyStats.attack,
        defense: total.defense + armyStats.defense,
        shock: total.shock + armyStats.shock,
      };
    },
    { attack: 0, defense: 0, shock: 0 }
  );

  const siege = armies.reduce(
    (sum, army) => sum + calculateArmySiege(army),
    0
  );

  const supply =
    armies.length > 0
      ? getArmySupply(armies[0], province, armies, logistics).status
      : 'good';

  return {
    troops,
    organization,
    morale,
    supply,
    attack: stats.attack,
    defense: stats.defense,
    shock: stats.shock,
    siege,
    regimentComposition: getRegimentComposition(armies),
  };
}

export function startContinuousBattle(attackerArmies: Army[], defenderArmies: Army[], province: Province, currentDate: GameDate, battleId: string, logistics?: LogisticsSnapshot, unitBonuses: ReadonlyMap<string, Partial<Record<UnitType, number>>> = new Map()): BattleExtended {
  const attackerTroops = attackerArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  const defenderTroops = defenderArmies.reduce((sum, army) => sum + calculateArmySize(army), 0);
  attackerArmies = [...attackerArmies].sort((a,b) => a.id.localeCompare(b.id));
  defenderArmies = [...defenderArmies].sort((a,b) => a.id.localeCompare(b.id));
  // Legacy fields are elapsed counters, never an end condition in V3.
  const daysTotal = 0;
  const participantSides: Record<string, 'attacker' | 'defender'> = {};
  attackerArmies.forEach(a => { participantSides[a.id] = 'attacker'; });
  defenderArmies.forEach(a => { participantSides[a.id] = 'defender'; });
  return {
    id: battleId, provinceId: province.id, phase: 'ENGAGEMENT', durationDays: 0,
    participantInitialSizes: Object.fromEntries([...attackerArmies,...defenderArmies].map(a => [a.id, calculateArmySize(a)])),
    participantSnapshots: Object.fromEntries([...attackerArmies,...defenderArmies].map(a => [a.id, { ...a, regiments: a.regiments.map(r => ({...r})) }])),
    attackerArmyId: attackerArmies[0].id, defenderArmyId: defenderArmies[0].id,
    attackerCountryId: attackerArmies[0].owner, defenderCountryId: defenderArmies[0].owner,
    participantArmyIds: [...attackerArmies, ...defenderArmies].map(a => a.id), participantSides,
    daysTotal, daysRemaining: daysTotal,
    attackerInitialTroops: attackerTroops, defenderInitialTroops: defenderTroops,
    attackerCurrentTroops: attackerTroops, defenderCurrentTroops: defenderTroops,
    attackerCasualties: 0, defenderCasualties: 0, startDate: currentDate,
    attackerInitialSnapshot: { ...attackerArmies[0], regiments: attackerArmies[0].regiments.map(r => ({ ...r })) },
    defenderInitialSnapshot: { ...defenderArmies[0], regiments: defenderArmies[0].regiments.map(r => ({ ...r })) },

    attackerCombatSnapshot: createBattleSideSnapshot(
      attackerArmies,
      province, logistics, unitBonuses
    ),

    defenderCombatSnapshot: createBattleSideSnapshot(
      defenderArmies,
      province, logistics, unitBonuses
    ),
    reinforcementEntryDay: {}, reinforcementInitialSize: {},
  };

}

export function addReinforcementsToBattle(battle: BattleExtended, army: Army, side: 'attacker' | 'defender', _province: Province): BattleExtended {
  void _province;
  if (battle.participantArmyIds.includes(army.id)) return battle;
  return {
    ...battle,
    participantArmyIds: [...battle.participantArmyIds, army.id].sort(),
    participantInitialSizes: {...battle.participantInitialSizes, [army.id]: calculateArmySize(army)},
    participantSnapshots: {...battle.participantSnapshots, [army.id]: {...army, regiments: army.regiments.map(r => ({...r}))}},
    participantSides: { ...(battle.participantSides ?? {}), [army.id]: side },
    reinforcementEntryDay: { ...battle.reinforcementEntryDay, [army.id]: battle.durationDays ?? battle.daysTotal - battle.daysRemaining },
    reinforcementInitialSize: { ...battle.reinforcementInitialSize, [army.id]: calculateArmySize(army) },
  };
}

/** Processes every participant, including collective retreat/annihilation. */
function processParticipantBattleDay(battle: BattleExtended, armies: Army[], province: Province, allProvinces: Province[], combatMultipliers: ReadonlyMap<string, number> = new Map(), fortificationMultipliers: ReadonlyMap<string, number> = new Map(), logistics?: LogisticsSnapshot, unitBonuses: ReadonlyMap<string, Partial<Record<UnitType, number>>> = new Map(), retreatContext?: {wars: WarPair[]; relations: DiplomaticRelation[]}, surroundingArmies: Army[] = armies) {
  const synced = synchronizeBattle(battle, armies);
  if (!synced) {
    const attackerAlive = participants(battle, armies, 'attacker').length > 0;
    const released = armies.map(a => battle.participantArmyIds.includes(a.id) ? { ...a, inCombat: false, destination:null,targetDestination:null,path:[],targetArmyId:null,targetProvinceId:null } : a);
    return { battle: { ...battle, phase: 'BREAK_RETREAT' as const, endReason: battle.endReason ?? 'side_empty' as const, attackerFinalCombatSnapshot:createBattleSideSnapshot(getBattleParticipants(battle,armies).filter(a=>battle.participantSides[a.id]==='attacker'),province,logistics,unitBonuses),defenderFinalCombatSnapshot:createBattleSideSnapshot(getBattleParticipants(battle,armies).filter(a=>battle.participantSides[a.id]==='defender'),province,logistics,unitBonuses), attackerCurrentTroops: sideTotal(battle, armies, 'attacker'), defenderCurrentTroops: sideTotal(battle, armies, 'defender') }, armies: released, finished: true, winner: attackerAlive ? 'attacker' as const : 'defender' as const, retreatInfo: null };
  }
  const durationDays = (synced.durationDays ?? Math.max(0, synced.daysTotal - synced.daysRemaining)) + 1;
  const daysRemaining = 0;
  const attackerBefore = synced.attackerCurrentTroops;
  const defenderBefore = synced.defenderCurrentTroops;
  const defenderOwner = synced.defenderCountryId;
  const effectiveDefense = province.defense + getBuildingBonus(province, 'defense');
  const fortificationMultiplier = fortificationMultipliers.get(defenderOwner) ?? 1;
  const attackerArmies = participants(synced, armies, 'attacker');
  const defenderArmies = participants(synced, armies, 'defender');
  const attackerStats = attackerArmies.reduce((total, army) => { if (calculateArmyOrganization(army) <= BATTLE_V3.breakThreshold) return total; const base = calculateArmyCombatStats(army, unitBonuses.get(army.owner)); const power = combatMultipliers.get(army.owner) ?? 1; const stats = {attack: base.attack * power, defense: base.defense * power, shock: base.shock * power}; return { attack: total.attack + stats.attack, defense: total.defense + stats.defense, shock: total.shock + stats.shock }; }, { attack: 0, defense: 0, shock: 0 });
  const defenderStats = defenderArmies.reduce((total, army) => { if (calculateArmyOrganization(army) <= BATTLE_V3.breakThreshold) return total; const base = calculateArmyCombatStats(army, unitBonuses.get(army.owner)); const power = combatMultipliers.get(army.owner) ?? 1; const stats = {attack: base.attack * power, defense: base.defense * power, shock: base.shock * power}; return { attack: total.attack + stats.attack, defense: total.defense + stats.defense, shock: total.shock + stats.shock }; }, { attack: 0, defense: 0, shock: 0 });
  const attackerSupply = attackerArmies.reduce((sum, army) => sum + getArmySupply(army, province, surroundingArmies, logistics).combatMultiplier, 0) / attackerArmies.length;
  const defenderSupply = defenderArmies.reduce((sum, army) => sum + getArmySupply(army, province, surroundingArmies, logistics).combatMultiplier, 0) / defenderArmies.length;
  const siege = attackerArmies.reduce((sum, army) => sum + calculateArmySiege(army), 0);
  const fortBonus = Math.min(MILITARY_BALANCE.maximumFortDefense, effectiveDefense * MILITARY_BALANCE.fortDefensePerLevel / (1 + siege / 20)) * fortificationMultiplier;
  const attackerPressure = (attackerStats.attack + attackerStats.shock * .45) * attackerSupply;
  const defenderPressure = (defenderStats.attack + defenderStats.defense * .35) * defenderSupply * (1 + fortBonus) * getTerrainDefinition(province).defenseModifier;
  const terrainTempo = BATTLE_V3.terrainTempo[province.terrain ?? 'plains'];
  const scaleTempo = Math.max(BATTLE_V3.minimumScaleTempo, Math.min(BATTLE_V3.maximumScaleTempo, Math.sqrt(BATTLE_V3.referenceTroops / Math.max(1,Math.min(attackerBefore,defenderBefore)))));
  const tempo = scaleTempo * terrainTempo / (1 + fortBonus * BATTLE_V3.fortificationTempoScaling) * (durationDays <= BATTLE_V3.engagementDays ? BATTLE_V3.engagementPressure : 1);
  const ratio = (value: number) => value <= 0 ? 0 : Math.max(BATTLE_V3.minimumPressureRatio, Math.min(BATTLE_V3.maximumPressureRatio, value));
  const attackRatio = ratio(defenderPressure / Math.max(1, attackerPressure));
  const defendRatio = ratio(attackerPressure / Math.max(1, defenderPressure));
  const attackerLoss = Math.min(attackerBefore, Math.floor(attackerBefore * BATTLE_V3.strengthRate * tempo * attackRatio));
  const defenderLoss = Math.min(defenderBefore, Math.floor(defenderBefore * BATTLE_V3.strengthRate * tempo * defendRatio));
  // Both damage allocations use the same pre-round snapshot.
  let updatedArmies = applySideLoss(armies, attackerArmies, attackerLoss, BATTLE_V3.organizationDamage * tempo * attackRatio);
  updatedArmies = applySideLoss(updatedArmies, defenderArmies, defenderLoss, BATTLE_V3.organizationDamage * tempo * defendRatio);
  let next = synchronizeBattle(synced, updatedArmies);
  const attackerAfter = next?.attackerCurrentTroops ?? sideTotal(synced, updatedArmies, 'attacker');
  const defenderAfter = next?.defenderCurrentTroops ?? sideTotal(synced, updatedArmies, 'defender');
  const attackerParticipants = participants(synced, updatedArmies, 'attacker');
  const defenderParticipants = participants(synced, updatedArmies, 'defender');

  const attackerOrganization =
    attackerParticipants.reduce(
      (sum, army) => sum + calculateArmyOrganization(army),
      0,
    ) / Math.max(1, attackerParticipants.length);

  const defenderOrganization =
    defenderParticipants.reduce(
      (sum, army) => sum + calculateArmyOrganization(army),
      0,
    ) / Math.max(1, defenderParticipants.length);

  const attackerMorale =
    attackerParticipants.reduce(
      (sum, army) => sum + calculateArmyMorale(army),
      0,
    ) / Math.max(1, attackerParticipants.length);

  const defenderMorale =
    defenderParticipants.reduce(
      (sum, army) => sum + calculateArmyMorale(army),
      0,
    ) / Math.max(1, defenderParticipants.length);

  const attackerDestroyed = attackerAfter <= 0;
  const defenderDestroyed = defenderAfter <= 0;

  const attackerOrganizationBroken =
    attackerParticipants.every(a => calculateArmyOrganization(a) <= BATTLE_V3.breakThreshold);

  const defenderOrganizationBroken =
    defenderParticipants.every(a => calculateArmyOrganization(a) <= BATTLE_V3.breakThreshold);

  const attackerMoraleBroken =
    attackerMorale <= MILITARY_BALANCE.moraleRetreatThreshold;

  const defenderMoraleBroken =
    defenderMorale <= MILITARY_BALANCE.moraleRetreatThreshold;

  const attackerBroken =
    attackerDestroyed ||
    attackerOrganizationBroken;

  const defenderBroken =
    defenderDestroyed ||
    defenderOrganizationBroken;

  const finished =
    !next ||
    attackerBroken ||
    defenderBroken;

  let endReason: BattleEndReason | undefined;

  if (finished) {
    if (attackerDestroyed || defenderDestroyed || !next) {
      endReason = 'annihilation';
    } else if (
      attackerOrganizationBroken ||
      defenderOrganizationBroken
    ) {
      endReason = 'organization';
    } else if (
      attackerMoraleBroken ||
      defenderMoraleBroken
    ) {
      endReason = 'morale';
    } else {
      endReason = 'duration';
    }
  }

  let winner: 'attacker' | 'defender';

  // Um único lado colapsou.
  if (attackerBroken && !defenderBroken) {
    winner = 'defender';
  } else if (defenderBroken && !attackerBroken) {
    winner = 'attacker';
  } else {
    // Ambos colapsaram no mesmo dia ou a duração terminou.
    // Decide pela condição militar restante.
    const attackerStrengthRatio =
      attackerAfter / Math.max(1, synced.attackerInitialTroops);

    const defenderStrengthRatio =
      defenderAfter / Math.max(1, synced.defenderInitialTroops);

    const totalRemaining =
      attackerAfter + defenderAfter;

    const attackerTroopShare =
      totalRemaining > 0
        ? attackerAfter / totalRemaining
        : 0;

    const defenderTroopShare =
      totalRemaining > 0
        ? defenderAfter / totalRemaining
        : 0;

    const attackerCondition =
      attackerOrganization * 0.35 +
      attackerMorale * 0.20 +
      attackerStrengthRatio * 100 * 0.15 +
      attackerTroopShare * 100 * 0.30;

    const defenderCondition =
      defenderOrganization * 0.35 +
      defenderMorale * 0.20 +
      defenderStrengthRatio * 100 * 0.15 +
      defenderTroopShare * 100 * 0.30;

    winner =
      attackerCondition > defenderCondition
        ? 'attacker'
        : 'defender';
  }

  const loserSide: 'attacker' | 'defender' =
    winner === 'attacker' ? 'defender' : 'attacker';

  let retreatInfo: RetreatInfo | null = null;
  const retreatOutcomes = {...synced.retreatOutcomes};

  if (finished) {
    const loserTroops =
      loserSide === 'attacker'
        ? attackerAfter
        : defenderAfter;

    // Qualquer força derrotada que ainda possua homens tenta recuar.
    if (loserTroops > 0) {
      const losers = participants(synced, updatedArmies, loserSide);

      let retreatedTroops = 0;

      const loserIds = new Set(losers.map(army => army.id));

      const retreatDestinations = new Map<string, Province>();

      for (const loser of losers) {
        const destination = findRetreatProvince(
          loser.owner,
          province,
          allProvinces,
          [...surroundingArmies.filter(a => !synced.participantArmyIds.includes(a.id)),...updatedArmies], retreatContext,
        );

        if (destination) {
          retreatDestinations.set(loser.id, destination);
        }
      }

      updatedArmies = updatedArmies.map(army => {
        if (!loserIds.has(army.id)) {
          return army;
        }

        const destination = retreatDestinations.get(army.id);

        // Sem rota válida: exército destruído.
        if (!destination) {
          retreatOutcomes[army.id] = {reason: 'no_retreat'};
          endReason = 'no_retreat';
          return {
            ...army,
            regiments: [],
            recentDefeat: undefined,
            inCombat: false,
            destination: null,
            targetDestination: null,
            path: [],
            position: null,
            movementProgress: 0,
          };
        }

        retreatOutcomes[army.id] = {reason: 'retreat', destinationId: destination.id, destinationName: destination.name};
        retreatedTroops += calculateArmySize(army);

        return {
          ...army,
          location: destination.id,
          retreatProtectionDays: BATTLE_V3.retreatProtectionDays,
          retreatFromBattleId: synced.id,
          recentDefeat: { provinceId: province.id, battleId: synced.id, daysRemaining: RECENT_DEFEAT_DAYS },
          movementPlan: undefined,
          inCombat: false,
          destination: null,
          targetDestination: null,
          path: [],
          movementProgress: 0,
          position: null,
        };
      });

      const firstRetreatDestination =
        retreatDestinations.values().next().value;

      if (firstRetreatDestination) {
        retreatInfo = {
          retreated: true,
          to: firstRetreatDestination.id,
          toName: firstRetreatDestination.name,
          troops: retreatedTroops,
          owner: losers[0]?.owner ?? '',
        };
      }
    }

    updatedArmies = updatedArmies.map(army =>
      synced.participantArmyIds.includes(army.id)
        ? { ...army, inCombat: false, destination: null, targetDestination: null, path: [], targetArmyId: null, targetProvinceId: null }
        : army,
    );
  }

  const finalAttacker = sideTotal(
    synced,
    updatedArmies,
    'attacker',
  );

  const finalDefender = sideTotal(
    synced,
    updatedArmies,
    'defender',
  );

  const finalAttackerArmies = getBattleParticipants(synced,updatedArmies).filter(a => synced.participantSides[a.id] === 'attacker');

  const finalDefenderArmies = getBattleParticipants(synced,updatedArmies).filter(a => synced.participantSides[a.id] === 'defender');

  const attackerFinalCombatSnapshot =
    createBattleSideSnapshot(
      finalAttackerArmies,
      province, logistics, unitBonuses
    );

  const defenderFinalCombatSnapshot =
    createBattleSideSnapshot(
      finalDefenderArmies,
      province, logistics, unitBonuses
    );

  const finalBattle: BattleExtended = {
    ...(next ?? synced),

    daysRemaining, durationDays, daysTotal: durationDays,
    phase: finished ? 'BREAK_RETREAT' : durationDays <= BATTLE_V3.engagementDays ? 'ENGAGEMENT' : 'MAIN_COMBAT',
    retreatOutcomes,

    attackerCurrentTroops: finalAttacker,
    defenderCurrentTroops: finalDefender,

    attackerCasualties:
      synced.attackerCasualties + attackerBefore - finalAttacker,

    defenderCasualties:
      synced.defenderCasualties + defenderBefore - finalDefender,

    retreatInfo,
    endReason,

    attackerFinalCombatSnapshot,
    defenderFinalCombatSnapshot,
  };

  return {
    battle: finalBattle,
    armies: updatedArmies,
    finished,
    winner,
    retreatInfo,
  };
}

/** The round works only on participants; merge once into the world army list. */
export function processBattleDay(battle: BattleExtended, armies: Army[], province: Province, allProvinces: Province[], combatMultipliers: ReadonlyMap<string, number> = new Map(), fortificationMultipliers: ReadonlyMap<string, number> = new Map(), logistics?: LogisticsSnapshot, unitBonuses: ReadonlyMap<string, Partial<Record<UnitType, number>>> = new Map(), retreatContext?: {wars: WarPair[]; relations: DiplomaticRelation[]}) {
  const local = getBattleParticipants(battle,armies);
  const result = processParticipantBattleDay(battle,local,province,allProvinces,combatMultipliers,fortificationMultipliers,logistics,unitBonuses,retreatContext,armies);
  const updated = new Map(result.armies.map(a => [a.id,a]));
  return {...result,armies:armies.map(a => updated.get(a.id) ?? a)};
}

// Compatibility wrapper for older direct callers.
export function processDailyBattle(battle: BattleExtended, attacker: Army, defender: Army, province: Province, allProvinces: Province[] = []) {
  const result = processBattleDay(battle, [attacker, defender], province, allProvinces);
  return {
    ...result, attacker: result.armies.find(a => a.id === attacker.id) ?? attacker, defender: result.armies.find(a => a.id === defender.id) ?? defender,
    attackerCurrentTroops: result.battle.attackerCurrentTroops, defenderCurrentTroops: result.battle.defenderCurrentTroops
  };
}
