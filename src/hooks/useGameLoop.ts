import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Province, Country, GameDate, Army, Recruitment, CombatResult, BuildingConstruction, ActiveBattle } from '../types';
import type { CountryTechState } from '../types/technology';
import type { DiplomaticRelation, War } from '../types/diplomacy';
import type { AIDifficulty } from '../types/difficulty';
import type { EndGameType, GameStats } from '../engine/gameConditions';
import type { ToastType } from '../types/toast';

import { processEconomyTick } from './gameLoop/economyTick';
import { processMovementTick } from './gameLoop/movementTick';
import { processBattleArrival } from './gameLoop/battleArrivalTick';
import { processBattleContinuous } from './gameLoop/battleContinuousTick';
import { processUnrestTick } from './gameLoop/unrestTick';
import { processDiplomacyTechTick } from './gameLoop/diplomacyTechTick';
import { processAiTick } from './gameLoop/aiTick';
import { processRebelTick } from './gameLoop/rebelTick';
import { saveGame, isAutoSaveEnabled } from '../engine/saveSystem';
import { collectRebellionFormationFeedback, collectRebellionResolutionFeedback } from '../engine/rebellion';

/**
 * ORDEM OFICIAL DO GAME LOOP - src/engine/gameLoop/order.ts
 * 1. production (futuro)
 * 2. economy -> economyTick
 * 3. population (futuro)
 * 4. stability -> unrestTick
 * 5. diplomacy -> diplomacyTechTick
 * 6. technology -> diplomacyTechTick (separar depois)
 * 7. ai -> aiTick (PRECISA de economy/diplomacy prontos)
 * 8. movement -> movementTick (PRECISA de ai)
 * 9. combat -> battleArrivalTick + battleContinuousTick (PRECISA de movement)
 * 10. rebellion -> rebelTick (PRECISA de stability + combat)
 * 11. events (futuro)
 */

const SPEED_INTERVALS: Record<number, number> = { 0: 0, 1: 1000, 2: 500, 3: 250, 4: 125, 5: 60 };

type Props = {
  // Refs principais do jogo
  provincesRef: MutableRefObject<Province[]>;
  countriesRef: MutableRefObject<Country[]>;
  armiesRef: MutableRefObject<Army[]>;
  recruitmentsRef: MutableRefObject<Recruitment[]>;
  warsRef: MutableRefObject<War[]>;
  diplomaticRelationsRef: MutableRefObject<DiplomaticRelation[]>;
  dateRef: MutableRefObject<GameDate>;
  buildingConstructionsRef: MutableRefObject<BuildingConstruction[]>;

  // Tecnologia / IA
  playerTechStateRef: MutableRefObject<CountryTechState>;
  botTechStatesRef: MutableRefObject<Map<string, CountryTechState>>;
  aiDifficultyRef: MutableRefObject<AIDifficulty>;

  // Batalhas / loop
  activeBattlesRef: MutableRefObject<ActiveBattle[]>;
  ceilingLogRef: MutableRefObject<Set<string>>;
  gameLoopRef: MutableRefObject<number | null>;

  // Estado geral
  playerCountryTag: string;
  battleHistory: CombatResult[];
  hasTriggeredEndGame: boolean;
  gameSpeed: number;
  isPaused: boolean;
  allCountries: Country[];

  // Setters principais
  setProvinces: Dispatch<SetStateAction<Province[]>>;
  setAllCountries: Dispatch<SetStateAction<Country[]>>;
  setArmies: Dispatch<SetStateAction<Army[]>>;
  setWars: Dispatch<SetStateAction<War[]>>;
  setDiplomaticRelations: Dispatch<
    SetStateAction<DiplomaticRelation[]>
  >;
  setRecruitments: Dispatch<SetStateAction<Recruitment[]>>;
  setBuildingConstructions: Dispatch<
    SetStateAction<BuildingConstruction[]>
  >;

  // Tecnologia
  setPlayerTechState: Dispatch<SetStateAction<CountryTechState>>;
  setBotTechStates: Dispatch<
    SetStateAction<Map<string, CountryTechState>>
  >;

  // Data / batalha
  setDate: Dispatch<SetStateAction<GameDate>>;
  setActiveBattles: Dispatch<SetStateAction<ActiveBattle[]>>;

  // Fim de jogo
  setEndGameType: Dispatch<SetStateAction<EndGameType | null>>;
  setGameStats: Dispatch<SetStateAction<GameStats | null>>;
  setHasTriggeredEndGame: Dispatch<SetStateAction<boolean>>;
  setIsPaused: Dispatch<SetStateAction<boolean>>;

  // Histórico / relatório
  setBattleHistory: Dispatch<SetStateAction<CombatResult[]>>;
  setBattleReport: Dispatch<SetStateAction<CombatResult | null>>;

  // Logs
  addLog: (msg: string) => void;

  addToast: (
    message: string,
    type?: ToastType,
    title?: string,
    dateString?: string,
    duration?: number
  ) => void;

  addAILog: (
    countryName: string,
    actionType: import('../types/aiLog').AIActionType,
    message: string,
    dateString: string,
    countryColor?: string
  ) => void;

  formatGameDate: (date: GameDate) => string;
};

export function useGameLoop(props: Props) {
  const {
    provincesRef, countriesRef, armiesRef, recruitmentsRef, warsRef, diplomaticRelationsRef,
    dateRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, aiDifficultyRef,
    activeBattlesRef, ceilingLogRef, gameLoopRef, playerCountryTag, battleHistory,
    hasTriggeredEndGame, gameSpeed, isPaused, allCountries, setProvinces, setAllCountries,
    setArmies, setWars, setDiplomaticRelations, setRecruitments, setBuildingConstructions,
    setPlayerTechState, setBotTechStates, setDate, setActiveBattles, setEndGameType,
    setGameStats, setHasTriggeredEndGame, setIsPaused, setBattleHistory, setBattleReport,
    addLog, addToast, addAILog, formatGameDate,
  } = props;

  const cancelProvinceActivities = useCallback((
    provinceId: string,
    oldOwner: string,
    _newOwner: string,
    rec: Recruitment[],
    cons: BuildingConstruction[],
    provs: Province[]
  ): {
    recruitments: Recruitment[];
    constructions: BuildingConstruction[];
    provinces: Province[];
  } => {
    return {
      recruitments: rec.filter(
        r => r.provinceId !== provinceId
      ),

      constructions: cons.filter(
        c => c.provinceId !== provinceId
      ),

      provinces: provs.map(p =>
        p.id === provinceId
          ? {
            ...p,
            originalOwner: p.originalOwner || oldOwner,
          }
          : p
      ),
    };
  }, []);

  const advanceDate = useCallback((d: GameDate): GameDate => {
    let { day, month, year } = d; day++; if (day > 30) { day = 1; month++; } if (month > 12) { month = 1; year++; } return { day, month, year };
  }, []);

  const processTick = useCallback(() => {
    if (hasTriggeredEndGame) return;
    const snapshot = {
      provinces: provincesRef.current, countries: countriesRef.current, armies: armiesRef.current,
      recruitments: recruitmentsRef.current, wars: warsRef.current, relations: diplomaticRelationsRef.current,
      date: dateRef.current, buildingConstructions: buildingConstructionsRef.current,
    };

    let armies = [...snapshot.armies], provinces = [...snapshot.provinces], countries = [...snapshot.countries];
    let wars = [...snapshot.wars], relations = [...snapshot.relations], recruitments = [...snapshot.recruitments];
    let buildingConstructions = [...snapshot.buildingConstructions];
    let currentActiveBattles = [...activeBattlesRef.current];
    let currentPlayerTechState = playerTechStateRef.current;
    let currentBotTechStates = new Map<string, CountryTechState>(botTechStatesRef.current);

    // 2. ECONOMY - primeiro, gera recursos e recrutamentos
    const eco = processEconomyTick({ recruitments, armies, countries, provinces, buildingConstructions, wars, playerCountryTag, playerTechState: currentPlayerTechState, botTechStates: currentBotTechStates, date: snapshot.date, allCountries, addToast, addAILog, addLog, formatGameDate });
    recruitments = eco.recruitments; armies = eco.armies; provinces = eco.provinces; buildingConstructions = eco.buildingConstructions; countries = eco.countries;

    // 4. STABILITY - depende de economy
    const unr = processUnrestTick({ provinces, armies, countries, wars, relations, snapshot, playerCountryTag, allCountries, addLog, addToast });
    provinces = unr.provinces; armies = unr.armies; countries = unr.countries; wars = unr.wars; relations = unr.relations;

    // 5/6. DIPLOMACY + TECHNOLOGY
    const dip = processDiplomacyTechTick({ countries, provinces, armies, wars, relations, playerCountryTag, snapshot, currentPlayerTechState, currentBotTechStates, aiDifficultyRef, playerTechStateRef, botTechStatesRef, addLog, addToast, addAILog, formatGameDate });
    countries = dip.countries; provinces = dip.provinces; armies = dip.armies; wars = dip.wars; relations = dip.relations; currentPlayerTechState = dip.currentPlayerTechState; currentBotTechStates = dip.currentBotTechStates;

    // 7. AI - precisa ver economy, stability e diplomacy antes de decidir
    const ai = processAiTick({ countries, provinces, armies, wars, relations, buildingConstructions, recruitments, currentBotTechStates, playerCountryTag, aiDifficultyRef, ceilingLogRef, snapshot, allCountries, addAILog, formatGameDate });
    countries = ai.countries; provinces = ai.provinces; armies = ai.armies; wars = ai.wars; relations = ai.relations; buildingConstructions = ai.buildingConstructions; recruitments = ai.recruitments; currentBotTechStates = ai.currentBotTechStates;

    // 8. MOVEMENT - IA já decidiu pra onde ir
    const mov = processMovementTick({ armies, provinces, relations, countries, addLog });
    armies = mov.armies; provinces = mov.provinces; countries = mov.countries; const arrivedArmies = mov.arrivedArmies;

    // 9. COMBAT - só depois de mover
    const arr = processBattleArrival({ arrivedArmies, armies, provinces, countries, wars, recruitments, buildingConstructions, currentActiveBattles, snapshot, playerCountryTag, allCountries, activeBattlesRef, addLog, addToast, setActiveBattles, cancelProvinceActivities });
    armies = arr.armies; provinces = arr.provinces; countries = arr.countries; currentActiveBattles = arr.currentActiveBattles; recruitments = arr.recruitments; buildingConstructions = arr.buildingConstructions;

    const cont = processBattleContinuous({ armies, provinces, countries, wars, currentActiveBattles, recruitments, buildingConstructions, snapshot, playerCountryTag, playerTechState: currentPlayerTechState, botTechStates: currentBotTechStates, allCountries, addLog, addToast, setActiveBattles, setArmies, setBattleHistory, setBattleReport, setIsPaused, activeBattlesRef, cancelProvinceActivities });
    armies = cont.armies; provinces = cont.provinces; countries = cont.countries; currentActiveBattles = cont.currentActiveBattles; wars = cont.wars; recruitments = cont.recruitments; buildingConstructions = cont.buildingConstructions;

    // 10. REBELLION - por último, depende de stability + combat
    const reb = processRebelTick({ recruitments, buildingConstructions, provinces, armies, countries, wars, relations, currentActiveBattles, snapshot, playerCountryTag, hasTriggeredEndGame, battleHistory, dateRef, addLog, addToast, setActiveBattles, activeBattlesRef, setEndGameType, setGameStats, setHasTriggeredEndGame, setIsPaused });
    provinces = reb.provinces; armies = reb.armies; countries = reb.countries; wars = reb.wars; relations = reb.relations; currentActiveBattles = reb.currentActiveBattles; recruitments = reb.recruitments; buildingConstructions = reb.buildingConstructions;
    if (reb.endGameTriggered) { setEndGameType(reb.endGameType); setGameStats(reb.gameStats); setHasTriggeredEndGame(true); setIsPaused(true); }

    setArmies(armies); setProvinces(provinces); setAllCountries(countries); setWars(wars);
    setDiplomaticRelations(relations); setRecruitments(recruitments); setBuildingConstructions(buildingConstructions);
    setPlayerTechState(currentPlayerTechState); setBotTechStates(currentBotTechStates); setDate((prev: GameDate) => advanceDate(prev));

    armiesRef.current = armies; provincesRef.current = provinces; countriesRef.current = countries;
    warsRef.current = wars; diplomaticRelationsRef.current = relations; recruitmentsRef.current = recruitments;
    activeBattlesRef.current = currentActiveBattles; buildingConstructionsRef.current = buildingConstructions;
    playerTechStateRef.current = currentPlayerTechState; botTechStatesRef.current = currentBotTechStates;

    // Announcements observe the same final state as the UI and save system.
    for (const feedback of collectRebellionResolutionFeedback(snapshot.countries, countries, provinces)) {
      // Objective resolution already writes the military/victory log. AI negotiation needs a public log too.
      if (feedback.status === 'negotiated') addLog(feedback.message);
      if (feedback.owner === playerCountryTag) addToast(feedback.message, feedback.status === 'victorious' ? 'warning' : 'info', 'Rebelião resolvida', formatGameDate(snapshot.date));
    }
    for (const feedback of collectRebellionFormationFeedback(unr.createdFactionIds, provincesRef.current, countriesRef.current, armiesRef.current)) {
      if (feedback.log) addLog(feedback.log);
      if (feedback.owner === playerCountryTag) addToast(feedback.message, feedback.type, feedback.title, formatGameDate(snapshot.date));
    }

    // AUTOSAVE - todo dia 1 - FIX: agora com slotId
    if (dateRef.current.day === 1 && isAutoSaveEnabled()) {
      saveGame(
        { provincesRef, countriesRef, armiesRef, warsRef, diplomaticRelationsRef, recruitmentsRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, activeBattlesRef, dateRef },
        'autosave',
        'Autosave'
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, playerCountryTag, advanceDate, cancelProvinceActivities, hasTriggeredEndGame]);

  useEffect(() => {
    if (gameLoopRef.current) { clearInterval(gameLoopRef.current); gameLoopRef.current = null; }
    if (gameSpeed > 0 && !isPaused) {
      gameLoopRef.current = window.setInterval(processTick, SPEED_INTERVALS[gameSpeed]);
    }
    return () => { if (gameLoopRef.current) clearInterval(gameLoopRef.current); };
  }, [gameSpeed, processTick, isPaused, gameLoopRef]);
}
