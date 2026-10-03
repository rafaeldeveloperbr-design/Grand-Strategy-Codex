/**
 * battleContinuousTick.ts - FIX RECUO - TYPED
 */
import { processBattleDay, finalizeBattle, synchronizeBattle } from '../../engine/combat';
import { checkRebelTerritoryReturn } from '../../engine/rebellions';
import { applyStabilityPrestigeChanges } from '../../engine/stability';
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
import { calculateArmySize } from '../../engine/combat/combatCalculations';
import { transferProvince } from '../../engine/territoryTransfer';
import { applyMilitaryCasualties } from '../../engine/population';


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


type ArmyWithMovement = Army & {
  movementProgress?: number;
  destination: string | null;
  path: string[];
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
  cancelProvinceActivities: (provinceId: string, oldOwner: string, newOwner: string, rec: Recruitment[], cons: BuildingConstruction[], provs: Province[]) => { recruitments: Recruitment[]; constructions: BuildingConstruction[]; provinces: Province[] };
};

export function processBattleContinuous(p: Params) {
  let { armies, provinces, countries, wars, currentActiveBattles, recruitments, buildingConstructions } = p;
  const { snapshot, playerCountryTag, addLog, setActiveBattles, setArmies, setBattleHistory, setBattleReport, setIsPaused, activeBattlesRef } = p;

  const finishedBattles: Array<{ battle: BattleExtended; retreatInfo: RetreatInfo | null }> = [];
  const stillActiveBattles: BattleExtended[] = [];

  for (const battle of currentActiveBattles) {
    const province = provinces.find(pr => pr.id === battle.provinceId);
    if (!province) {
      armies = armies.map(a => battle.participantArmyIds.includes(a.id) ? { ...a, inCombat: false } : a);
      continue;
    }
    const repaired = synchronizeBattle(battle, armies) || battle;
    const armiesBeforeCombat = armies;
    const result = processBattleDay(repaired, armies, province, provinces);
    armies = result.armies;
    provinces = applyMilitaryCasualties(provinces, armiesBeforeCombat, armies);

    if (result.finished) {
      finishedBattles.push({ battle: result.battle, retreatInfo: result.retreatInfo });
    } else {
      stillActiveBattles.push(result.battle);
    }
  }

  currentActiveBattles = stillActiveBattles;
  activeBattlesRef.current = currentActiveBattles;
  setActiveBattles(currentActiveBattles);

  for (const fbWrapper of finishedBattles) {
    const fb = fbWrapper.battle;
    const retreatInfo = fbWrapper.retreatInfo || fb.retreatInfo || null;

    const province = provinces.find(pr => pr.id === fb.provinceId);
    const attacker = armies.find(a => a.id === fb.attackerArmyId) || fb.attackerInitialSnapshot;
    const defender = armies.find(a => a.id === fb.defenderArmyId) || fb.defenderInitialSnapshot;
    if (!province || !attacker || !defender) continue;

    let finalResult: Omit<FinalResultEnriched, 'totalAttackerInitial' | 'totalDefenderInitial' | 'attackerReinfInitial' | 'defenderReinfInitial' | 'attackerCurrentTroops' | 'defenderCurrentTroops' | 'participantDetails' | 'reinforcementInitialSize'>;
    let rawUpdatedArmies: Army[];
    const armiesBeforeFinalization = armies;

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
      rawUpdatedArmies = [...armies];

      rawUpdatedArmies = rawUpdatedArmies.map(a => {
        if (a.owner === retreatInfo.owner && (a.id === fb.attackerArmyId || a.id === fb.defenderArmyId || fb.participantArmyIds.includes(a.id))) {
          if (calculateArmySize(a) === retreatInfo.troops || a.id === (retreatInfo.owner === attacker.owner ? fb.attackerArmyId : fb.defenderArmyId)) {
            const moved: ArmyWithMovement = { ...a as ArmyWithMovement, location: retreatInfo.to, inCombat: false, destination: null, path: [], movementProgress: 0 };
            return moved;
          }
        }
        if (fb.participantArmyIds.includes(a.id)) {
          return { ...a, inCombat: false };
        }
        return a;
      });
    } else {
      const res = finalizeBattle(fb, attacker, defender, province, snapshot.date, armies, provinces, countries);
      finalResult = res.result as typeof finalResult;
      rawUpdatedArmies = res.updatedArmies;
    }
    provinces = applyMilitaryCasualties(provinces, armiesBeforeFinalization, rawUpdatedArmies);

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

    const remainingDefenders = armies.filter(a => a.location === province.id
      && fb.participantSides?.[a.id] === 'defender' && calculateArmySize(a) > 0);

    if (enrichedResult.winner === 'attacker' && remainingDefenders.length === 0) {
      const oldOwner = province.owner;
      const rebelReturnOwner = checkRebelTerritoryReturn(attacker);
      const newProvinceOwner = rebelReturnOwner || attacker.owner;
      const transferred = transferProvince(
        { provinces, countries, recruitments, constructions: buildingConstructions },
        province.id, newProvinceOwner, { date: snapshot.date, liberation: !!rebelReturnOwner }
      );
      provinces = transferred.provinces;
      countries = transferred.countries;
      recruitments = transferred.recruitments;
      buildingConstructions = transferred.constructions;
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
