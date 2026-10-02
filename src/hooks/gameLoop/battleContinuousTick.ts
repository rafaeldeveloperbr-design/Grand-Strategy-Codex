/**
 * battleContinuousTick.ts - FIX RECUO - TYPED
 */
import { processDailyBattle, finalizeBattle, findAutomaticRetreatProvince } from '../../engine/combat';
import { checkRebelTerritoryReturn } from '../../engine/rebellions';
import { applyStabilityPrestigeChanges } from '../../engine/stability';
import { transferProvinceControl } from '../../engine/territory';
import type {
  Army,
  Province,
  Country,
  War,
  ActiveBattle,
  Recruitment,
  BuildingConstruction, CombatResult,
  RetreatInfo
} from '../../types';
import type { GameDate } from '../../types/date';
import type { ToastType } from '../../types/toast';
import { calculateArmySize, applyTroopLoss } from '../../engine/combat/combatCalculations';


// ===== TIPOS QUE FALTAVAM =====
type BattleExtended = ActiveBattle & {
  participantArmyIds: string[];
  reinforcementEntryDay?: Record<string, number>;
  reinforcementInitialSize?: Record<string, number>;
  attackerInitialSnapshot?: Army;
  defenderInitialSnapshot?: Army;
  retreatInfo?: RetreatInfo | null;
  attackerCurrentTroops: number;
  defenderCurrentTroops: number;
};


type FinalResultEnriched = CombatResult & {
  retreatInfo?: RetreatInfo | null;

  isStackwipe?: boolean;

  totalAttackerInitial?: number;
  totalDefenderInitial?: number;

  attackerReinfInitial?: number;
  defenderReinfInitial?: number;

  attackerCurrentTroops?: number;
  defenderCurrentTroops?: number;

  participantDetails?: Array<{
    id: string;
    name: string;
    owner: string;
    side: 'attacker' | 'defender';
    initial: number;
    final: number;
    loss: number;
  }>;

  reinforcementInitialSize?: Record<string, number>;
};

type Params = {
  armies: Army[];
  provinces: Province[];
  countries: Country[];
  wars: War[];
  currentActiveBattles: BattleExtended[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  snapshot: { date: GameDate };
  playerCountryTag: string;
  allCountries: Country[];
  addLog: (msg: string) => void;
  addToast: (
    message: string,
    type?: ToastType,
    title?: string,
    dateString?: string,
    duration?: number
  ) => void;
  setActiveBattles: (b: BattleExtended[]) => void;
  setArmies: (a: Army[]) => void;
  setBattleHistory: React.Dispatch<
    React.SetStateAction<CombatResult[]>
  >;

  setBattleReport: React.Dispatch<
    React.SetStateAction<CombatResult | null>
  >;
  setIsPaused: (p: boolean) => void;
  activeBattlesRef: React.MutableRefObject<BattleExtended[]>;
};

export function processBattleContinuous(p: Params) {
  let { armies, provinces, countries, wars, currentActiveBattles, recruitments, buildingConstructions } = p;
  const { snapshot, playerCountryTag, addLog, setActiveBattles, setArmies, setBattleHistory, setBattleReport, setIsPaused, activeBattlesRef } = p;

  const finishedBattles: Array<{ battle: BattleExtended; retreatInfo: RetreatInfo | null; attacker: Army; defender: Army }> = [];
  const stillActiveBattles: BattleExtended[] = [];

  for (const battle of currentActiveBattles) {
    const province = provinces.find(pr => pr.id === battle.provinceId);
    if (!province) {
      armies = armies.map(a => battle.participantArmyIds.includes(a.id) ? { ...a, inCombat: false } : a);
      continue;
    }

    const attackerOwner = battle.attackerOwner
      ?? armies.find(a => a.id === battle.attackerArmyId)?.owner
      ?? battle.attackerInitialSnapshot?.owner;
    const defenderOwner = battle.defenderOwner
      ?? armies.find(a => a.id === battle.defenderArmyId)?.owner
      ?? battle.defenderInitialSnapshot?.owner;
    if (!attackerOwner || !defenderOwner) {
      armies = armies.map(a => battle.participantArmyIds.includes(a.id) ? { ...a, inCombat: false } : a);
      continue;
    }

    const participantArmies = battle.participantArmyIds
      .map(id => armies.find(a => a.id === id))
      .filter((a): a is Army => Boolean(a) && calculateArmySize(a!) > 0);
    const attackerParticipants = participantArmies.filter(a => a.owner === attackerOwner);
    const defenderParticipants = participantArmies.filter(a => a.owner === defenderOwner);
    const attacker = attackerParticipants.find(a => a.id === battle.attackerArmyId)
      ?? attackerParticipants[0]
      ?? battle.attackerInitialSnapshot;
    const defender = defenderParticipants.find(a => a.id === battle.defenderArmyId)
      ?? defenderParticipants[0]
      ?? battle.defenderInitialSnapshot;
    if (!attacker || !defender) {
      armies = armies.map(a => battle.participantArmyIds.includes(a.id) ? { ...a, inCombat: false } : a);
      continue;
    }

    let normalizedBattle: BattleExtended = {
      ...battle,
      attackerOwner,
      defenderOwner,
      attackerArmyId: attackerParticipants[0]?.id ?? battle.attackerArmyId,
      defenderArmyId: defenderParticipants[0]?.id ?? battle.defenderArmyId,
      participantArmyIds: participantArmies.map(a => a.id),
      attackerCurrentTroops: attackerParticipants.reduce((sum, a) => sum + calculateArmySize(a), 0),
      defenderCurrentTroops: defenderParticipants.reduce((sum, a) => sum + calculateArmySize(a), 0),
    };

    // Se um lado já desapareceu, a batalha termina neste tick sem ficar órfã.
    if (attackerParticipants.length === 0 || defenderParticipants.length === 0) {
      normalizedBattle = { ...normalizedBattle, daysRemaining: 0 };
      finishedBattles.push({ battle: normalizedBattle, retreatInfo: null, attacker, defender });
      continue;
    }

    const result = processDailyBattle(normalizedBattle, attacker, defender, province, provinces, wars) as {
      battle: BattleExtended;
      attacker: Army;
      defender: Army;
      finished: boolean;
      retreatInfo: RetreatInfo | null;
    };

    armies = armies.map(a => {
      if (a.id === attacker.id) return result.attacker;
      if (a.id === defender.id) return result.defender;
      if (normalizedBattle.participantArmyIds.includes(a.id)) {
        const entryDay = normalizedBattle.reinforcementEntryDay?.[a.id];
        const daysSinceEntry = entryDay !== undefined ? (normalizedBattle.daysTotal - normalizedBattle.daysRemaining - entryDay) : 10;
        const isFresh = daysSinceEntry < 2;
        const lossRate = isFresh ? 0.02 : 0.04;
        const dailyLoss = Math.floor(calculateArmySize(a) * lossRate);
        return applyTroopLoss(a, dailyLoss);
      }
      return a;
    });

    const livingParticipants = normalizedBattle.participantArmyIds
      .map(id => armies.find(a => a.id === id))
      .filter((a): a is Army => Boolean(a) && calculateArmySize(a!) > 0);
    let attackerTotal = livingParticipants
      .filter(a => a.owner === attackerOwner)
      .reduce((sum, a) => sum + calculateArmySize(a), 0);
    let defenderTotal = livingParticipants
      .filter(a => a.owner === defenderOwner)
      .reduce((sum, a) => sum + calculateArmySize(a), 0);
    const reinforcementSizes = result.battle.reinforcementInitialSize ?? {};
    const attackerReinforcements = Object.entries(reinforcementSizes)
      .filter(([id]) => p.armies.find(a => a.id === id)?.owner === attackerOwner)
      .reduce((sum, [, size]) => sum + size, 0);
    const defenderReinforcements = Object.entries(reinforcementSizes)
      .filter(([id]) => p.armies.find(a => a.id === id)?.owner === defenderOwner)
      .reduce((sum, [, size]) => sum + size, 0);

    let syncedBattle: BattleExtended = {
      ...result.battle,
      attackerArmyId: attacker.id,
      defenderArmyId: defender.id,
      attackerCurrentTroops: attackerTotal,
      defenderCurrentTroops: defenderTotal,
      attackerCasualties: Math.max(0, result.battle.attackerInitialTroops + attackerReinforcements - attackerTotal),
      defenderCasualties: Math.max(0, result.battle.defenderInitialTroops + defenderReinforcements - defenderTotal),
    };
    const finished = result.finished || attackerTotal <= 50 || defenderTotal <= 50;

    let retreatInfo: RetreatInfo | null = null;
    if (finished && attackerTotal > 0 && defenderTotal > 0) {
      const loserOwner = attackerTotal <= defenderTotal ? attackerOwner : defenderOwner;
      const loserTotal = loserOwner === attackerOwner ? attackerTotal : defenderTotal;
      if (loserTotal <= 1500) {
        let retreatedTroops = 0;
        let firstDestinationId: string | null = null;
        let firstDestinationName = '';
        armies = armies.map(army => {
          if (!syncedBattle.participantArmyIds.includes(army.id) || army.owner !== loserOwner || calculateArmySize(army) <= 0) return army;
          const retreatProvince = findAutomaticRetreatProvince(province, army.owner, provinces);
          if (!retreatProvince) {
            return { ...army, regiments: [], inCombat: false, destination: null, targetDestination: null, path: [] };
          }
          if (!firstDestinationId) {
            firstDestinationId = retreatProvince.id;
            firstDestinationName = retreatProvince.name;
          }
          retreatedTroops += calculateArmySize(army);
          return { ...army, location: retreatProvince.id, inCombat: false, destination: null, targetDestination: null, path: [], movementProgress: 0, position: null };
        });
        if (firstDestinationId && retreatedTroops > 0) {
          retreatInfo = { retreated: true, to: firstDestinationId, toName: firstDestinationName, troops: retreatedTroops, owner: loserOwner };
        }
        attackerTotal = syncedBattle.participantArmyIds
          .map(id => armies.find(a => a.id === id))
          .filter((a): a is Army => Boolean(a) && a!.owner === attackerOwner)
          .reduce((sum, a) => sum + calculateArmySize(a), 0);
        defenderTotal = syncedBattle.participantArmyIds
          .map(id => armies.find(a => a.id === id))
          .filter((a): a is Army => Boolean(a) && a!.owner === defenderOwner)
          .reduce((sum, a) => sum + calculateArmySize(a), 0);
        syncedBattle = { ...syncedBattle, attackerCurrentTroops: attackerTotal, defenderCurrentTroops: defenderTotal, retreatInfo };
      }
    }

    if (finished) {
      finishedBattles.push({ battle: syncedBattle, retreatInfo, attacker: result.attacker, defender: result.defender });
    } else {
      stillActiveBattles.push(syncedBattle);
    }
  }

  currentActiveBattles = stillActiveBattles;
  activeBattlesRef.current = currentActiveBattles;
  setActiveBattles(currentActiveBattles);

  for (const fbWrapper of finishedBattles) {
    const fb = fbWrapper.battle;
    const retreatInfo = fbWrapper.retreatInfo || fb.retreatInfo || null;

    const province = provinces.find(pr => pr.id === fb.provinceId);
    const attacker = armies.find(a => a.id === fb.attackerArmyId) ?? fbWrapper.attacker;
    const defender = armies.find(a => a.id === fb.defenderArmyId) ?? fbWrapper.defender;
    if (!province) continue;

    let finalResult: Omit<FinalResultEnriched, 'totalAttackerInitial' | 'totalDefenderInitial' | 'attackerReinfInitial' | 'defenderReinfInitial' | 'attackerCurrentTroops' | 'defenderCurrentTroops' | 'participantDetails' | 'reinforcementInitialSize'>;
    let rawUpdatedArmies: Army[];

    if (retreatInfo?.retreated) {
      console.log(`🏃 Processando recuo: ${retreatInfo.owner} com ${retreatInfo.troops} para ${retreatInfo.toName}`);

      const winner = fb.attackerCurrentTroops > fb.defenderCurrentTroops ? 'attacker' as const : 'defender' as const;
      finalResult = {
        attacker,
        defender,
        attackerOriginal: fb.attackerInitialSnapshot || attacker,
        defenderOriginal: fb.defenderInitialSnapshot || defender,

        attackerCasualties: Math.max(
          0,
          fb.attackerInitialTroops - fb.attackerCurrentTroops
        ),

        defenderCasualties: Math.max(
          0,
          fb.defenderInitialTroops - fb.defenderCurrentTroops
        ),

        winner,

        provinceId: province.id,
        provinceName: province.name,
        duration: fb.daysTotal,

        territoryChanged: false,
        territorialDefenseBonus: false,

        powerRatio: 1,
        date: snapshot.date,

        retreatInfo,
        isStackwipe: false,
      };
      rawUpdatedArmies = armies.map(a => fb.participantArmyIds.includes(a.id) ? { ...a, inCombat: false } : a);
    } else {
      const res = finalizeBattle(fb, attacker, defender, province, snapshot.date, armies, provinces, countries);
      finalResult = res.result as typeof finalResult;
      rawUpdatedArmies = res.updatedArmies;
    }

    const reinfSizes = fb.reinforcementInitialSize || {};
    let attackerReinfInitial = 0;
    let defenderReinfInitial = 0;
    Object.keys(reinfSizes).forEach((id: string) => {
      const size = reinfSizes[id];
      const originalArmy = p.armies.find(a => a.id === id);
      const armyNow = armies.find(a => a.id === id);
      const owner = originalArmy?.owner || armyNow?.owner || '';
      if (owner === attacker.owner) attackerReinfInitial += size;
      else if (owner === defender.owner) defenderReinfInitial += size;
    });

    const totalAttackerInitial = fb.attackerInitialTroops + attackerReinfInitial;
    const totalDefenderInitial = fb.defenderInitialTroops + defenderReinfInitial;

    const allPartIds = fb.participantArmyIds || [fb.attackerArmyId, fb.defenderArmyId];
    const isStackwipe = finalResult.isStackwipe && !retreatInfo?.retreated;

    let realAttackerFinal = 0;
    let realDefenderFinal = 0;
    const participantDetails: FinalResultEnriched['participantDetails'] = [];

    allPartIds.forEach((id: string) => {
      const finalArmy = rawUpdatedArmies.find(a => a.id === id);
      if (!finalArmy) return;
      const initial = reinfSizes[id] || (id === fb.attackerArmyId ? fb.attackerInitialTroops : id === fb.defenderArmyId ? fb.defenderInitialTroops : 0);
      let finalSize = calculateArmySize(finalArmy);
      const isLoserArmy = finalArmy.owner === (finalResult.winner === 'attacker' ? defender.owner : attacker.owner);

      if (retreatInfo?.retreated && isLoserArmy && finalArmy.owner === retreatInfo.owner) {
        finalSize = retreatInfo.troops;
      } else if (isStackwipe && isLoserArmy) {
        finalSize = 0;
      }

      participantDetails.push({
        id,
        name: finalArmy.name,
        owner: finalArmy.owner,
        side: finalArmy.owner === attacker.owner ? 'attacker' : 'defender',
        initial,
        final: finalSize,
        loss: Math.max(0, initial - finalSize)
      });
      if (finalArmy.owner === attacker.owner) realAttackerFinal += finalSize;
      else realDefenderFinal += finalSize;
    });

    if (retreatInfo?.retreated) {
      if (retreatInfo.owner === defender.owner) realDefenderFinal = retreatInfo.troops;
      else realAttackerFinal = retreatInfo.troops;
    }

    const enrichedResult: FinalResultEnriched = {
      ...finalResult,
      totalAttackerInitial,
      totalDefenderInitial,
      attackerReinfInitial,
      defenderReinfInitial,
      attackerCurrentTroops: realAttackerFinal,
      defenderCurrentTroops: realDefenderFinal,
      participantDetails,
      reinforcementInitialSize: reinfSizes,
      retreatInfo,
    };

    const updatedArmies = rawUpdatedArmies.filter(a => {
      if (!allPartIds.includes(a.id)) return true;
      if (retreatInfo?.retreated && a.owner === retreatInfo.owner) return true;
      const detail = participantDetails.find(d => d.id === a.id);
      return detail ? detail.final > 0 : calculateArmySize(a) > 0;
    });

    armies = updatedArmies;

    const remainingDefenders = armies.filter(a => a.location === province.id && a.owner === defender.owner && !a.inCombat && calculateArmySize(a) > 0);

    if (enrichedResult.winner === 'attacker' && remainingDefenders.length === 0) {
      const oldOwner = province.owner;
      const rebelReturnOwner = checkRebelTerritoryReturn(attacker);
      const newProvinceOwner = rebelReturnOwner || attacker.owner;
      const transfer = transferProvinceControl({ provinceId: province.id, newOwner: newProvinceOwner, provinces, countries, recruitments, constructions: buildingConstructions, date: snapshot.date, liberation: !!rebelReturnOwner });
      provinces = transfer.provinces;
      countries = transfer.countries;
      recruitments = transfer.recruitments;
      buildingConstructions = transfer.constructions;
      const updatedFinalResult: FinalResultEnriched = { ...enrichedResult, territoryChanged: true, newOwner: newProvinceOwner };
      addLog(`⚔️ ${attacker.owner} conquistou ${province.name} de ${oldOwner}! ${retreatInfo?.retreated ? `Inimigo recuou para ${retreatInfo.toName} com ${retreatInfo.troops}` : ''}`);
      setBattleHistory((prev) => [updatedFinalResult, ...prev]);
      if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
        setBattleReport(updatedFinalResult);
        setIsPaused(true);
      }
    } else {
      if (enrichedResult.winner === 'defender') addLog(`🛡️ ${defender.owner} defendeu ${province.name}!`);
      else addLog(`🛡️ ${attacker.owner} venceu, mas ${defender.owner} ainda tem tropas em ${province.name}!`);
      setBattleHistory((prev) => [enrichedResult, ...prev]);
      if (attacker.owner === playerCountryTag || defender.owner === playerCountryTag) {
        setBattleReport(enrichedResult);
        setIsPaused(true);
      }
    }

    const winnerCountry = enrichedResult.winner === 'attacker' ? attacker.owner : defender.owner;
    const loserCountry = enrichedResult.winner === 'attacker' ? defender.owner : attacker.owner;
    countries = countries.map(c => {
      if (c.tag === winnerCountry) return applyStabilityPrestigeChanges(c, 0, 2);
      if (c.tag === loserCountry) return applyStabilityPrestigeChanges(c, 0, -3);
      return c;
    });
  }

  setArmies(armies);
  setActiveBattles(currentActiveBattles);
  activeBattlesRef.current = currentActiveBattles;

  return { armies, provinces, countries, currentActiveBattles, wars, recruitments, buildingConstructions };
}
