import { airCombatReportToast } from '../engine/air/reports';
import { endedPlayerNavalBattles, enqueueNavalReports } from '../engine/naval/reports';
import type { NavalBattle } from '../types/naval';
import { friendlyBeachLandingTick } from '../engine/naval/friendlyBeachLanding';
import { beachExtractionTick } from '../engine/naval/beachExtraction';
import { airAITick, airCombatTick, airMissionsTick, cleanupAirState, airCounters, airProductionAI, processAirProductionTick, cleanupAirProduction } from '../engine/air';
import type { AirState } from '../types/air';
import { processWarResolutionTick } from '../engine/diplomacy/warResolution';
import { processPoliticalTick } from '../engine/politics';
import { buildSimulationActivation } from '../engine/simulationActivation';
import { cleanupDiplomacy } from '../engine/diplomacy';
import type { NavalState } from '../types/naval';
import { amphibiousTick, amphibiousAITick, resolveTransportLosses } from '../engine/naval/transport';
import { processNavalConstructionTick, navalConstructionAI, cleanupNavalState, navalAITick, navalMovementTick, navalCombatTick, navalRecoveryTick, resetNavalPathfindCalls, getNavalPathfindCalls } from '../engine/naval';
import { diplomacyDay } from '../engine/diplomacy/diplomacyRelations';
import {
  useCallback,
  useRef,
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
import { saveGame, getSaveCompatibilityError, isAutoSaveEnabled } from '../engine/saveSystem';
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

import { SPEED_INTERVALS, useGameLoopScheduler } from './gameLoop/useGameLoopScheduler';
import { createGameLoopProfiler } from '../engine/performance/gameLoopProfiler';

type Props = {
  airStateRef?: MutableRefObject<AirState>;
  setAirState?: Dispatch<SetStateAction<AirState>>;
  navalStateRef?: MutableRefObject<NavalState>;
  setNavalState?: Dispatch<SetStateAction<NavalState>>;
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
  setNavalReports?: Dispatch<SetStateAction<NavalBattle[]>>;
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
    setNavalReports, addLog, addToast, addAILog, formatGameDate,
  } = props;

  const profilerRef = useRef<ReturnType<typeof createGameLoopProfiler> | null>(null);
  if (profilerRef.current === null) profilerRef.current = createGameLoopProfiler(import.meta.env.DEV);
  const stopSchedulerRef = useRef<() => void>(() => undefined);
  const setLoopPaused: typeof setIsPaused = value => {
    if (value === true) stopSchedulerRef.current();
    setIsPaused(value);
  };

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

  const processTick = () => {
    if (hasTriggeredEndGame) return;
    const profiler = profilerRef.current!;
    profiler.begin();
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
    let naval = props.navalStateRef?.current ?? { fleets: [], battles: [] };
    let air = props.airStateRef?.current ?? { wings: [], engagements: [] };
    resetNavalPathfindCalls();

    // 2. ECONOMY - primeiro, gera recursos e recrutamentos
    const eco = processEconomyTick({ recruitments, armies, countries, provinces, buildingConstructions, wars, relations, playerCountryTag, playerTechState: currentPlayerTechState, botTechStates: currentBotTechStates, date: snapshot.date, allCountries, addToast, addAILog, addLog, formatGameDate });
    recruitments = eco.recruitments; armies = eco.armies; provinces = eco.provinces; buildingConstructions = eco.buildingConstructions; countries = eco.countries;

    profiler.endPhase('economy');

    const politicalActivation = profiler.measureSimulationActivation(() => buildSimulationActivation({countries,provinces,armies,wars,relations,playerCountryTag,date:snapshot.date}));
    const political = processPoliticalTick(countries,{provinces,armies,wars,date:snapshot.date},playerCountryTag,false,politicalActivation.fullCountryTags);
    countries = political.countries;
    political.messages.forEach(message => {addLog(message);addAILog('Governo','government',message,formatGameDate(snapshot.date));});

    profiler.endPhase('politics');

    // 4. STABILITY - depende de economy
    const unr = processUnrestTick({ provinces, armies, countries, wars, relations, snapshot, playerCountryTag, allCountries, addLog, addToast });
    provinces = unr.provinces; armies = unr.armies; countries = unr.countries; wars = unr.wars; relations = unr.relations;

    profiler.endPhase('unrest');

    // 5/6. DIPLOMACY + TECHNOLOGY
    const dip = processDiplomacyTechTick({ countries, provinces, armies, wars, relations, playerCountryTag, snapshot, currentPlayerTechState, currentBotTechStates, aiDifficultyRef, playerTechStateRef, botTechStatesRef, addLog, addToast, addAILog, formatGameDate });
    countries = dip.countries; provinces = dip.provinces; armies = dip.armies; wars = dip.wars; relations = dip.relations; currentPlayerTechState = dip.currentPlayerTechState; currentBotTechStates = dip.currentBotTechStates;

    profiler.endPhase('diplomacyTechnology');

    // 7. AI - precisa ver economy, stability e diplomacy antes de decidir
    const ai = processAiTick({ profiler: profiler.aiProfiler, countries, provinces, armies, wars, relations, buildingConstructions, recruitments, currentBotTechStates, playerCountryTag, aiDifficultyRef, ceilingLogRef, snapshot, allCountries, addAILog, addToast, formatGameDate });
    countries = ai.countries; provinces = ai.provinces; armies = ai.armies; wars = ai.wars; relations = ai.relations; buildingConstructions = ai.buildingConstructions; recruitments = ai.recruitments; currentBotTechStates = ai.currentBotTechStates;

    profiler.endPhase('AI');

    const navalActivation = buildSimulationActivation({ countries, provinces, armies, wars, relations, playerCountryTag, date: snapshot.date });
    const navalProductionAI = props.navalStateRef ? navalConstructionAI(naval, provinces, countries, navalActivation.fullCountryTags, playerCountryTag, wars, diplomacyDay(snapshot.date)) : { naval, provinces, countries };
    naval = navalProductionAI.naval; provinces = navalProductionAI.provinces; countries = navalProductionAI.countries;
    const navalProduction = processNavalConstructionTick(naval, provinces, countries);
    naval = navalProduction.naval;
    profiler.recordNavalConstruction(navalProduction.counters);
    profiler.endPhase('navalConstruction');
    const airProductionDecision = airProductionAI(air, provinces, countries, navalActivation.fullCountryTags, playerCountryTag, wars, currentActiveBattles, relations);
    air = airProductionDecision.state; provinces = airProductionDecision.provinces; countries = airProductionDecision.countries;
    const airProduction = processAirProductionTick(air, provinces, countries);
    air = airProduction.state;
    profiler.recordAirProduction(airProduction.counters);
    for (const feedback of airProduction.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'info', 'Aircraft Production');
    profiler.endPhase('airProduction');
    // War participants already activate every country eligible for a hostile naval engagement.
    naval = amphibiousAITick({ naval, armies, provinces, wars, relations }, navalActivation.fullCountryTags, playerCountryTag);
    const navalAI = navalAITick(naval.fleets, navalActivation.fullCountryTags, playerCountryTag, provinces, relations, wars, new Set([...(naval.invasions?.map(o => o.fleetId) ?? []), ...armies.filter(a => a.friendlyBeachLanding).map(a => a.embarkedFleetId!)]));
    naval = { ...naval, fleets: navalAI.fleets };
    profiler.endPhase('navalAI');
    const airAI = airAITick(air, navalActivation.fullCountryTags, playerCountryTag, { provinces, countries, wars, relations }, currentActiveBattles);
    air = airAI.state;
    profiler.endPhase('airAI');

    // 8. MOVEMENT - IA já decidiu pra onde ir
    const mov = processMovementTick({ armies, provinces, relations, countries, wars, addLog, addToast, playerCountryTag });
    armies = mov.armies; provinces = mov.provinces; countries = mov.countries; const arrivedArmies = mov.arrivedArmies;

    profiler.endPhase('movement');

    naval = { ...naval, fleets: navalMovementTick(naval.fleets, provinces, relations, wars) };
    profiler.endPhase('navalMovement');

    const previousNavalStatus = new Map(naval.battles.map(b => [b.id, b.status]));
    const previousNavalFleets = naval.fleets;
    const previousNavalDays = new Map(naval.battles.map(b => [b.id, b.days]));
    naval = navalCombatTick(naval, wars, diplomacyDay(snapshot.date), provinces, relations);
    const engagedThisTick = new Set(naval.battles.filter(b => b.status === 'ACTIVE' || b.days > (previousNavalDays.get(b.id) ?? 0)).flatMap(b => [...b.sideA, ...b.sideB]));
    const transportLosses = resolveTransportLosses(naval, armies, provinces);
    ({ naval, armies, provinces } = transportLosses);
    const recovery = navalRecoveryTick(naval.fleets, countries, provinces, relations, wars);
    naval = { ...naval, fleets: recovery.fleets }; countries = recovery.countries;
    profiler.endPhase('navalCombat');
    air = airCombatTick(air, { provinces, countries, wars, relations }, diplomacyDay(snapshot.date), report => {
      const message = airCombatReportToast(report, playerCountryTag, wars, countries.find(c => c.tag === playerCountryTag)?.name);
      if (message) addToast(message, 'info', 'Combate aéreo', formatGameDate(snapshot.date));
    });
    profiler.endPhase('airCombat');
    const rebasing = air.wings.filter(w => w.rebase && w.countryTag === playerCountryTag);
    const airMissions = airMissionsTick(air, { provinces, countries, wars, relations });
    air = airMissions.state; countries = airMissions.countries; provinces = airMissions.provinces;
    for (const w of rebasing) { const arrived = air.wings.find(next => next.id === w.id); if (arrived && !arrived.rebase && arrived.baseProvinceId === w.rebase!.targetProvinceId) addToast(`Rebase concluído: ${w.name}.`, 'success', 'Air Warfare'); }
    profiler.endPhase('airMissions');
    const landing = amphibiousTick(naval, armies, provinces, wars, engagedThisTick);
    naval = landing.naval; armies = landing.armies; arrivedArmies.push(...landing.arrivals);
    profiler.recordAmphibious({ ...landing.counters, troopLossesAtSea: transportLosses.troopLossesAtSea });
    for (const feedback of [...transportLosses.messages, ...landing.messages]) {
      if (feedback.owner === playerCountryTag) addToast(feedback.message, 'info', 'Transporte naval');
    }
    profiler.endPhase('amphibious');

    // 9. COMBAT - só depois de mover
    const arr = processBattleArrival({ arrivedArmies, armies, provinces, countries, wars, relations, recruitments, buildingConstructions, currentActiveBattles, snapshot, playerCountryTag, allCountries, activeBattlesRef, addLog, addToast, setActiveBattles, cancelProvinceActivities });
    armies = arr.armies; provinces = arr.provinces; countries = arr.countries; currentActiveBattles = arr.currentActiveBattles; recruitments = arr.recruitments; buildingConstructions = arr.buildingConstructions;

    // Peaceful landings revalidate hostile arrivals before removing cargo status.
    const friendlyLanding = friendlyBeachLandingTick({ naval, armies, provinces, wars, relations, activeBattles: currentActiveBattles }, engagedThisTick);
    armies = friendlyLanding.armies;
    for (const feedback of friendlyLanding.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'info', 'Transporte naval');
    // Land arrivals must establish Battle V3 before extraction can complete.
    const extraction = beachExtractionTick({ naval, armies, provinces, wars, relations, activeBattles: currentActiveBattles }, engagedThisTick);
    armies = extraction.armies;
    for (const feedback of extraction.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'info', 'Transporte naval');
    profiler.endPhase('battleArrival');

    const beforeBattleStrength = armies.reduce((sum,a)=>sum+a.regiments.reduce((n,r)=>n+r.strength,0),0);
    const cont = processBattleContinuous({ air, armies, provinces, countries, wars, relations, currentActiveBattles, recruitments, buildingConstructions, snapshot, playerCountryTag, playerTechState: currentPlayerTechState, botTechStates: currentBotTechStates, allCountries, addLog, addToast, setActiveBattles, setArmies, setBattleHistory, setBattleReport, setIsPaused: setLoopPaused, activeBattlesRef, cancelProvinceActivities });
    armies = cont.armies; provinces = cont.provinces; countries = cont.countries; currentActiveBattles = cont.currentActiveBattles; wars = cont.wars; recruitments = cont.recruitments; buildingConstructions = cont.buildingConstructions;

    profiler.recordBattle({activeBattles:currentActiveBattles.length,battleParticipants:currentActiveBattles.reduce((sum,b)=>sum+b.participantArmyIds.length,0),reinforcements:arr.reinforcements,retreats:cont.retreats,annihilations:cont.annihilations,battleCasualties:Math.max(0,beforeBattleStrength-armies.reduce((sum,a)=>sum+a.regiments.reduce((n,r)=>n+r.strength,0),0))});
    profiler.endPhase('battleContinuous');

    const resolvedWars = processWarResolutionTick({provinces,countries,wars,relations,armies,activeBattles:currentActiveBattles,recruitments,constructions:buildingConstructions,date:snapshot.date});
    ({provinces,countries,wars,relations,armies,recruitments} = resolvedWars);
    buildingConstructions = resolvedWars.constructions; currentActiveBattles = resolvedWars.activeBattles;
    setActiveBattles(currentActiveBattles); activeBattlesRef.current = currentActiveBattles;
    for (const resolution of resolvedWars.resolutions) {
      addLog(resolution.message);
      if (resolution.participants.includes(playerCountryTag)) addToast(resolution.message,'warning','Fim da guerra');
      addAILog(countries.find(c => c.tag === resolution.winner)?.name ?? 'País','diplomacy',resolution.message,formatGameDate(snapshot.date));
    }

    profiler.endPhase('warResolution');

    // 10. REBELLION - por último, depende de stability + combat
    const reb = processRebelTick({ recruitments, buildingConstructions, provinces, armies, countries, wars, relations, currentActiveBattles, snapshot, playerCountryTag, hasTriggeredEndGame, battleHistory, dateRef, addLog, addToast, setActiveBattles, activeBattlesRef, setEndGameType, setGameStats, setHasTriggeredEndGame, setIsPaused: setLoopPaused });
    provinces = reb.provinces; armies = reb.armies; countries = reb.countries; wars = reb.wars; relations = reb.relations; currentActiveBattles = reb.currentActiveBattles; recruitments = reb.recruitments; buildingConstructions = reb.buildingConstructions;
    if (reb.endGameTriggered) { stopSchedulerRef.current(); setEndGameType(reb.endGameType); setGameStats(reb.gameStats); setHasTriggeredEndGame(true); setIsPaused(true); }

    profiler.endPhase('rebellion');

    ({relations,wars} = cleanupDiplomacy({relations,wars,countries,provinces,armies,date: snapshot.date}));
    naval = cleanupNavalState(naval, provinces, wars);
    const cleanupLosses = resolveTransportLosses(naval, armies, provinces);
    ({ naval, armies, provinces } = cleanupLosses);
    if (cleanupLosses.troopLossesAtSea) profiler.recordAmphibious({ embarkedArmies: 0, transportedTroops: 0, activeLandings: 0, completedLandings: 0, troopLossesAtSea: cleanupLosses.troopLossesAtSea });
    for (const feedback of cleanupLosses.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'warning', 'Transporte naval');
    const navalReports = endedPlayerNavalBattles(naval.battles, previousNavalStatus, playerCountryTag, previousNavalFleets);
    if (navalReports.length && setNavalReports) {
      setNavalReports(queue => enqueueNavalReports(queue, navalReports));
      setLoopPaused(true);
    }
    const revalidated = amphibiousTick(naval, armies, provinces, wars, new Set(), false);
    naval = revalidated.naval;
    for (const feedback of revalidated.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'warning', 'Transporte naval');
    const friendlyCleanup = friendlyBeachLandingTick({ naval, armies, provinces, wars, relations, activeBattles: currentActiveBattles }, new Set(), false);
    armies = friendlyCleanup.armies;
    for (const feedback of friendlyCleanup.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'warning', 'Transporte naval');
    const extractionCleanup = beachExtractionTick({ naval, armies, provinces, wars, relations, activeBattles: currentActiveBattles }, new Set(), false);
    armies = extractionCleanup.armies;
    for (const feedback of extractionCleanup.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'warning', 'Transporte naval');
    const productionCleanup = cleanupAirProduction(air, provinces, countries);
    for (const feedback of productionCleanup.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'warning', 'Aircraft Production');
    air = cleanupAirState(productionCleanup.state, { provinces, countries, wars, relations });
    profiler.endPhase('cleanup');

    setArmies(armies); setProvinces(provinces); setAllCountries(countries); setWars(wars);
    setDiplomaticRelations(relations); setRecruitments(recruitments); setBuildingConstructions(buildingConstructions);
    setPlayerTechState(currentPlayerTechState); setBotTechStates(currentBotTechStates); setDate((prev: GameDate) => advanceDate(prev));

    armiesRef.current = armies; provincesRef.current = provinces; countriesRef.current = countries;
    warsRef.current = wars; diplomaticRelationsRef.current = relations; recruitmentsRef.current = recruitments;
    activeBattlesRef.current = currentActiveBattles; buildingConstructionsRef.current = buildingConstructions;
    playerTechStateRef.current = currentPlayerTechState; botTechStatesRef.current = currentBotTechStates;
    if (props.navalStateRef) props.navalStateRef.current = naval;
    props.setNavalState?.(naval);
    if (props.airStateRef) props.airStateRef.current = air;
    props.setAirState?.(air);
    profiler.recordAir(airCounters(air, airAI.bots));
    profiler.recordNaval({ fleets: naval.fleets.length, movingFleets: naval.fleets.filter(f => f.status === 'MOVING' || f.status === 'RETREATING').length, navalAIBots: navalAI.bots, activeNavalBattles: naval.battles.filter(b => b.status === 'ACTIVE').length, pathfindCalls: getNavalPathfindCalls() });

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
      const saved = saveGame(
        { battleHistoryRef: {current:props.battleHistory}, provincesRef, countriesRef, armiesRef, warsRef, diplomaticRelationsRef, recruitmentsRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, activeBattlesRef, dateRef, navalStateRef: props.navalStateRef, airStateRef: props.airStateRef },
        'autosave',
        'Autosave'
      );
      if (!saved) addToast(getSaveCompatibilityError() ?? 'Não foi possível gravar o autosave.', 'warning', 'Autosave');
    }
    profiler.endPhase('statePublication');
    profiler.finish(gameSpeed, SPEED_INTERVALS[gameSpeed]);
  };

  const stopScheduler = useGameLoopScheduler(processTick, gameSpeed, isPaused, hasTriggeredEndGame, gameLoopRef);
  stopSchedulerRef.current = stopScheduler;
}
