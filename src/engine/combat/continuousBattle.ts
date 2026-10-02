import { Army, Province, ActiveBattle, GameDate } from '../../types';
import { applyTroopLoss, calculateArmySize } from './combatCalculations';

// ===== TIPOS ESTENDIDOS QUE FALTAVAM =====
type ArmyWithMovement = Army & {
  movementProgress?: number;
  destination: string | null;
  targetDestination: string | null;
  path: string[];
};

type ProvinceExtras = Province & {
  fortLevel?: number;
  fort_level?: number;
  terrain?: string;
  terrainType?: string;
  neighbors?: string[];
  adjacentProvinces?: string[];
  adjacent?: string[];
  buildings?: Record<string, number>;
};

type BattleExtended = ActiveBattle & {
  reinforcementEntryDay?: Record<string, number>;
  reinforcementInitialSize?: Record<string, number>;
  participantArmyIds: string[];
  attackerInitialSnapshot?: Army;
  defenderInitialSnapshot?: Army;
  retreatInfo?: RetreatInfo | null;
};

type RetreatInfo = {
  retreated: boolean;
  to: string;
  toName: string;
  troops: number;
  owner: string;
};

/**
 * Verifica automaticamente combates em todas as províncias
 */
export function checkAllProvinceCombats(
  armies: Army[],
  provinces: Province[],
  wars: Array<{ attacker: string; defender: string }>,
  currentDate: GameDate,
  activeBattles: BattleExtended[],
  techBonusesByCountry?: Map<string, { infantry: number; cavalry: number; artillery: number }>
) {
  const updatedArmies: ArmyWithMovement[] = [...armies] as ArmyWithMovement[];
  const newBattles: BattleExtended[] = [];
  const updatedBattles: BattleExtended[] = [...activeBattles];
  const reinforcementsAdded: Array<{
    battleId: string;
    armyId: string;
    armyOwner: string;
    side: 'attacker' | 'defender';
    troops: number;
    provinceName: string;
  }> = [];

  for (const province of provinces) {
    const existingBattleIndex = updatedBattles.findIndex(b => b.provinceId === province.id);
    let existingBattle = existingBattleIndex!== -1? updatedBattles[existingBattleIndex] : null;
    const armiesInProvince = updatedArmies.filter(a => a.location === province.id &&!a.inCombat);
    if (armiesInProvince.length === 0) continue;

    if (existingBattle) {
      const currentBattle = existingBattle;
      const attackerOwner = currentBattle.attackerOwner
        ?? updatedArmies.find(a => a.id === currentBattle.attackerArmyId)?.owner
        ?? currentBattle.attackerInitialSnapshot?.owner;
      const defenderOwner = currentBattle.defenderOwner
        ?? updatedArmies.find(a => a.id === currentBattle.defenderArmyId)?.owner
        ?? currentBattle.defenderInitialSnapshot?.owner;
      if (!attackerOwner || !defenderOwner) {
        continue;
      }

      const validParticipants = currentBattle.participantArmyIds
        .map(id => updatedArmies.find(a => a.id === id))
        .filter((a): a is ArmyWithMovement => Boolean(a) && calculateArmySize(a!) > 0);
      const replacementAttacker = validParticipants.find(a => a.owner === attackerOwner);
      const replacementDefender = validParticipants.find(a => a.owner === defenderOwner);
      existingBattle = {
        ...currentBattle,
        attackerOwner,
        defenderOwner,
        attackerArmyId: replacementAttacker?.id ?? currentBattle.attackerArmyId,
        defenderArmyId: replacementDefender?.id ?? currentBattle.defenderArmyId,
      };
      updatedBattles[existingBattleIndex] = existingBattle;

      for (const army of armiesInProvince) {
        let side: 'attacker' | 'defender' | null = null;
        if (army.owner === attackerOwner) side = 'attacker';
        else if (army.owner === defenderOwner) side = 'defender';
        else {
          const isAtWarWithDefender = wars.some(
            w => (w.attacker === army.owner && w.defender === defenderOwner) ||
                 (w.defender === army.owner && w.attacker === defenderOwner)
          );
          if (isAtWarWithDefender) side = 'attacker';
        }
        if (side!== null) {
          const reinforcementTroops = calculateArmySize(army);
          const updatedBattle = addReinforcementsToBattle(existingBattle, army, side, province);
          updatedBattles[existingBattleIndex] = updatedBattle;
          reinforcementsAdded.push({
            battleId: existingBattle.id,
            armyId: army.id,
            armyOwner: army.owner,
            side,
            troops: reinforcementTroops,
            provinceName: province.name,
          });
          const idx = updatedArmies.findIndex(a => a.id === army.id);
          if (idx!== -1) updatedArmies[idx] = {...updatedArmies[idx], inCombat: true };
        }
      }
      continue;
    }

    if (armiesInProvince.length < 2) continue;
    const armiesByCountry = new Map<string, Army[]>();
    for (const army of armiesInProvince) {
      if (!armiesByCountry.has(army.owner)) armiesByCountry.set(army.owner, []);
      armiesByCountry.get(army.owner)!.push(army);
    }
    if (armiesByCountry.size < 2) continue;

    const provinceOwner = province.owner;
    let attackerCountry: string | null = null;
    let defenderCountry: string | null = null;

    for (const country of armiesByCountry.keys()) {
      if (country === provinceOwner) defenderCountry = country;
      else {
        const isAtWar = wars.some(
          w => (w.attacker === country && w.defender === provinceOwner) ||
               (w.defender === country && w.attacker === provinceOwner)
        );
        if (isAtWar) attackerCountry = country;
      }
    }
    if (!attackerCountry ||!defenderCountry) continue;
    const attackerArmies = armiesByCountry.get(attackerCountry) || [];
    const defenderArmies = armiesByCountry.get(defenderCountry) || [];
    if (attackerArmies.length === 0 || defenderArmies.length === 0) continue;

    const battleId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newBattle = startContinuousBattle(attackerArmies, defenderArmies, province, currentDate, battleId);
    newBattles.push(newBattle);

    for (const army of attackerArmies) {
      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx!== -1) updatedArmies[idx] = {...updatedArmies[idx], inCombat: true };
    }
    for (const army of defenderArmies) {
      const idx = updatedArmies.findIndex(a => a.id === army.id);
      if (idx!== -1) updatedArmies[idx] = {...updatedArmies[idx], inCombat: true };
    }
  }
  return { armies: updatedArmies, newBattles, updatedBattles, reinforcementsAdded };
}

export function startContinuousBattle(
  attackerArmies: Army[],
  defenderArmies: Army[],
  province: Province,
  currentDate: GameDate,
  battleId: string
): BattleExtended {
  const attackerTroops = attackerArmies.reduce((s, a) => s + calculateArmySize(a), 0);
  const defenderTroops = defenderArmies.reduce((s, a) => s + calculateArmySize(a), 0);
  const smallerArmyTroops = Math.min(attackerTroops, defenderTroops);

  let battleDays: number;
  if (smallerArmyTroops <= 1000) battleDays = 1;
  else if (smallerArmyTroops <= 2500) battleDays = 3;
  else battleDays = Math.max(2, Math.floor(smallerArmyTroops / 1500));

  const participantArmyIds = [
   ...attackerArmies.map(a => a.id),
   ...defenderArmies.map(a => a.id)
  ];

  console.log(`⚔️ Batalha em ${province.name}: ${battleDays} dias | Att ${attackerTroops} vs Def ${defenderTroops}`);

  const battle: BattleExtended = {
    id: battleId,
    provinceId: province.id,
    attackerArmyId: attackerArmies[0].id,
    defenderArmyId: defenderArmies[0].id,
    attackerOwner: attackerArmies[0].owner,
    defenderOwner: defenderArmies[0].owner,
    participantArmyIds,
    daysTotal: battleDays,
    daysRemaining: battleDays,
    attackerInitialTroops: attackerTroops,
    defenderInitialTroops: defenderTroops,
    attackerCurrentTroops: attackerTroops,
    defenderCurrentTroops: defenderTroops,
    attackerCasualties: 0,
    defenderCasualties: 0,
    startDate: currentDate,
    attackerInitialSnapshot: {...attackerArmies[0], regiments: attackerArmies[0].regiments.map(r => ({...r })) },
    defenderInitialSnapshot: {...defenderArmies[0], regiments: defenderArmies[0].regiments.map(r => ({...r })) },
    reinforcementEntryDay: {},
    reinforcementInitialSize: {},
  };

  return battle;
}

export function addReinforcementsToBattle(
  battle: BattleExtended,
  reinforcementArmy: Army,
  side: 'attacker' | 'defender',
  province: Province
): BattleExtended {
  void province;
  const reinforcementTroops = calculateArmySize(reinforcementArmy);
  const updatedBattle: BattleExtended = {
   ...battle,
    participantArmyIds: [...battle.participantArmyIds],
    reinforcementEntryDay: {...(battle.reinforcementEntryDay?? {}) },
    reinforcementInitialSize: {...(battle.reinforcementInitialSize?? {}) },
  };

  if (side === 'attacker') updatedBattle.attackerCurrentTroops += reinforcementTroops;
  else updatedBattle.defenderCurrentTroops += reinforcementTroops;

  if (!updatedBattle.participantArmyIds.includes(reinforcementArmy.id)) {
    updatedBattle.participantArmyIds.push(reinforcementArmy.id);
  }

  updatedBattle.reinforcementEntryDay![reinforcementArmy.id] = battle.daysTotal - battle.daysRemaining;
  updatedBattle.reinforcementInitialSize![reinforcementArmy.id] = reinforcementTroops;

  return updatedBattle;
}

function getDefenseBonus(province: ProvinceExtras): number {
  let bonus = 0.05;
  bonus += (province.fortLevel?? province.fort_level?? 0) * 0.05;
  const terrain = province.terrain?? province.terrainType?? '';
  if (terrain === 'mountain') bonus += 0.15;
  if (terrain === 'hill') bonus += 0.10;
  if (terrain === 'forest') bonus += 0.05;
  bonus += (province.buildings?.barracks?? 0) * 0.03;
  bonus += (province.buildings?.walls?? 0) * 0.04;
  return Math.min(0.5, bonus);
}

export function findAutomaticRetreatProvince(
  currentProvince: Province,
  loserOwner: string,
  allProvinces: Province[]
): Province | null {
  const neighbors = currentProvince.neighbors;

  console.log(`🔍 Buscando recuo pra ${loserOwner} a partir de ${currentProvince.name}. Vizinhos:`, neighbors);

  for (const prov of allProvinces) {
    const isNeighbor = neighbors.includes(prov.id);
    if (!isNeighbor) continue;
    if (prov.owner === loserOwner) {
      console.log(`✅ Rota de recuo encontrada: ${prov.name} (${prov.owner})`);
      return prov;
    }
  }

  console.log(`❌ Sem província de ${loserOwner} vizinha pra recuar - vai lutar até morrer`);
  return null;
}

export function processDailyBattle(
  battle: BattleExtended,
  attacker: Army,
  defender: Army,
  province: Province,
  _allProvinces: Province[] = [],
  _wars: Array<{ attacker: string; defender: string }> = []
) {
  void _allProvinces;
  void _wars;
  const daysRemaining = battle.daysRemaining - 1;
  const bonus = getDefenseBonus(province as ProvinceExtras);
  const daysTotal = Math.max(1, battle.daysTotal);
  const defInitial = battle.defenderInitialTroops;

  const attackerLoss = Math.min(
    battle.attackerCurrentTroops,
    Math.floor((defInitial * (1 + bonus)) / daysTotal)
  );
  const defenderLoss = Math.min(
    battle.defenderCurrentTroops,
    Math.floor((defInitial / daysTotal) * 0.95)
  );

  const updatedAttacker: ArmyWithMovement = applyTroopLoss(attacker, attackerLoss) as ArmyWithMovement;
  const updatedDefender: ArmyWithMovement = applyTroopLoss(defender, defenderLoss) as ArmyWithMovement;

  const newAttackerTroops = Math.max(0, battle.attackerCurrentTroops - attackerLoss);
  const newDefenderTroops = Math.max(0, battle.defenderCurrentTroops - defenderLoss);

  const finished = daysRemaining <= 0 || newAttackerTroops <= 50 || newDefenderTroops <= 50;
  const retreatInfo: RetreatInfo | null = null;

  const nextBattle: BattleExtended = {
   ...battle,
    daysRemaining,
    attackerCasualties: battle.attackerCasualties + attackerLoss,
    defenderCasualties: battle.defenderCasualties + defenderLoss,
    attackerCurrentTroops: newAttackerTroops,
    defenderCurrentTroops: newDefenderTroops,
    retreatInfo,
  };

  return {
    battle: nextBattle,
    attacker: updatedAttacker,
    defender: updatedDefender,
    attackerCurrentTroops: newAttackerTroops,
    defenderCurrentTroops: newDefenderTroops,
    finished,
    retreatInfo,
  };
}

function triggerRetreat(army: ArmyWithMovement, currentProvince: Province) {
  army.inCombat = false;
  army.destination = army.owner;
  army.targetDestination = army.owner;
  army.path = [army.owner];
}
