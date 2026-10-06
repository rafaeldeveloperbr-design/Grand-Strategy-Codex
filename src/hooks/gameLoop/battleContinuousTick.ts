/**
 * battleContinuousTick.ts - FIX RECUO - TYPED
 */
import { processBattleDay, synchronizeBattle } from '../../engine/combat';
import { checkRebelTerritoryReturn } from '../../engine/rebellions';
import { applyStabilityPrestigeChanges } from '../../engine/stability';
import type {
  Army,
  Province,
  Country,
  War,
  BattleExtended,
  Recruitment,
  BuildingConstruction,
  CombatResult,
  RetreatInfo,
  BattleCombatReport,
  BattleSideReport,
  BattleSideSnapshot,
} from '../../types';
import type { GameDate } from '../../types/date';
import type { ToastType } from '../../types/toast';
import { calculateArmySize } from '../../engine/combat/combatCalculations';
import { transferProvince } from '../../engine/territoryTransfer';
import { applyMilitaryCasualties } from '../../engine/population';
import type { CountryTechState } from '../../types/technology';
import { calculateTechBonuses } from '../../engine/technology';
import { getBuildingLevel } from '../../data/buildings';



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
  playerTechState: CountryTechState;
  botTechStates: Map<string, CountryTechState>;
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

function buildBattleSideReport(
  initial: BattleSideSnapshot,
  final: BattleSideSnapshot
): BattleSideReport {
  const regimentTypes = new Set([
    ...Object.keys(initial.regimentComposition),
    ...Object.keys(final.regimentComposition),
  ] as Array<keyof typeof initial.regimentComposition>);

  const regimentComposition: BattleSideReport['regimentComposition'] = {};

  for (const type of regimentTypes) {
    regimentComposition[type] = {
      initial: initial.regimentComposition[type] ?? 0,
      final: final.regimentComposition[type] ?? 0,
    };
  }

  return {
    initialTroops: initial.troops,
    finalTroops: final.troops,
    casualties: Math.max(0, initial.troops - final.troops),

    initialOrganization: initial.organization,
    finalOrganization: final.organization,

    initialMorale: initial.morale,
    finalMorale: final.morale,

    initialSupply: initial.supply,
    finalSupply: final.supply,

    attack: initial.attack,
    defense: initial.defense,
    shock: initial.shock,
    siege: initial.siege,

    regimentComposition,
  };
}

export function processBattleContinuous(p: Params) {
  let { armies, provinces, countries, wars, currentActiveBattles, recruitments, buildingConstructions } = p;
  const { snapshot, playerCountryTag, addLog, setActiveBattles, setArmies, setBattleHistory, setBattleReport, setIsPaused, activeBattlesRef } = p;

  const finishedBattles: Array<{
    battle: BattleExtended;
    retreatInfo: RetreatInfo | null;
    winner: 'attacker' | 'defender';
  }> = [];
  const stillActiveBattles: BattleExtended[] = [];

  for (const battle of currentActiveBattles) {
    const province = provinces.find(pr => pr.id === battle.provinceId);
    if (!province) {
      armies = armies.map(a => battle.participantArmyIds.includes(a.id) ? { ...a, inCombat: false } : a);
      continue;
    }
    const repaired = synchronizeBattle(battle, armies) || battle;
    const armiesBeforeCombat = armies;
    const combatMultipliers = new Map(p.countries.map(country => {
      const state = country.tag === p.playerCountryTag ? p.playerTechState : p.botTechStates.get(country.tag);
      const bonuses = state ? calculateTechBonuses(state).combatPowerBonus : { infantry: 0, cavalry: 0, artillery: 0 };
      return [country.tag, 1 + Math.max(bonuses.infantry, bonuses.cavalry, bonuses.artillery)];
    }));
    const fortificationMultipliers = new Map(p.countries.map(country => {
      const state = country.tag === p.playerCountryTag ? p.playerTechState : p.botTechStates.get(country.tag);
      return [country.tag, state ? calculateTechBonuses(state).fortificationMultiplier : 1];
    }));
    const result = processBattleDay(repaired, armies, province, provinces, combatMultipliers, fortificationMultipliers);
    armies = result.armies;
    provinces = applyMilitaryCasualties(provinces, armiesBeforeCombat, armies);

    if (result.finished) {
      finishedBattles.push({
        battle: result.battle,
        retreatInfo: result.retreatInfo,
        winner: result.winner
      });
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

    const winner = fbWrapper.winner;

    const province = provinces.find(pr => pr.id === fb.provinceId);
    const attacker = armies.find(a => a.id === fb.attackerArmyId) || fb.attackerInitialSnapshot;
    const defender = armies.find(a => a.id === fb.defenderArmyId) || fb.defenderInitialSnapshot;
    if (!province || !attacker || !defender) continue;

    let finalResult: Omit<FinalResultEnriched, 'totalAttackerInitial' | 'totalDefenderInitial' | 'attackerReinfInitial' | 'defenderReinfInitial' | 'attackerCurrentTroops' | 'defenderCurrentTroops' | 'participantDetails' | 'reinforcementInitialSize'>;
    let rawUpdatedArmies: Army[];

    if (retreatInfo?.retreated) {
      console.log(`🏃 Processando recuo: ${retreatInfo.owner} com ${retreatInfo.troops} para ${retreatInfo.toName}`);


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

      // Combat V2 already resolved each participant's retreat separately.
    } else {

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
        territorialDefenseBonus: province.owner === defender.owner,

        powerRatio:
          Math.round(
            (
              Math.max(
                fb.attackerCurrentTroops,
                fb.defenderCurrentTroops
              ) /
              Math.max(
                1,
                Math.min(
                  fb.attackerCurrentTroops,
                  fb.defenderCurrentTroops
                )
              )
            ) * 100
          ) / 100,

        date: snapshot.date,

        retreatInfo: null,
        isStackwipe:
          fb.attackerCurrentTroops <= 0 ||
          fb.defenderCurrentTroops <= 0,
      };

      // O Combat V2 já alterou os exércitos.
      // Não aplique baixas novamente aqui.
      rawUpdatedArmies = [...armies];
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

      if (isStackwipe && isLoserArmy) {
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

    let combatReport: BattleCombatReport | undefined;

    if (
      fb.attackerCombatSnapshot &&
      fb.defenderCombatSnapshot &&
      fb.attackerFinalCombatSnapshot &&
      fb.defenderFinalCombatSnapshot
    ) {
      combatReport = {
        attacker: buildBattleSideReport(
          fb.attackerCombatSnapshot,
          fb.attackerFinalCombatSnapshot
        ),

        defender: buildBattleSideReport(
          fb.defenderCombatSnapshot,
          fb.defenderFinalCombatSnapshot
        ),

        endReason: fb.endReason ?? 'duration',

        fortLevel: getBuildingLevel(province, 'fortress'),
        fortDefenseBonus: 0,
      };
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
      combatReport,
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

    const warAllowsOccupation = wars.some(war =>
      (war.attacker === attacker.owner && war.defender === province.owner) ||
      (war.defender === attacker.owner && war.attacker === province.owner));
    const liberationAllowsOccupation = !!checkRebelTerritoryReturn(attacker) && province.owner.startsWith('rebel_');
    if (enrichedResult.winner === 'attacker' && remainingDefenders.length === 0 &&
        (warAllowsOccupation || liberationAllowsOccupation)) {
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
