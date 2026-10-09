import { NavalBattleReportModal } from './components/NavalBattleReportModal';
import { cancelFriendlyBeachLanding, disembarkArmiesAtProvince, friendlyBeachLandingTick, FRIENDLY_BEACH_LANDING_LABEL } from './engine/naval/friendlyBeachLanding';
import { cancelBeachExtraction, beachExtractionTick, BEACH_EXTRACTION_LABEL } from './engine/naval/beachExtraction';
import { createInitialAirState, cancelAirMission, startAirProduction, cancelAirProduction, resolveAirTarget, airZoneById } from './engine/air';
import type { AirWing, AirMission, AircraftType } from './types/air';
import type { AirState } from './types/air';
import { diplomacyDay } from './engine/diplomacy/diplomacyRelations';
import { initializePolitics } from './engine/politics';
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useGameRefs } from './hooks/useGameRefs';
import { useGameLoop } from './hooks/useGameLoop';
import { TopBar } from './components/TopBar';
import { NationalEconomyPanel } from './components/NationalEconomyPanel';
import { normalizeNationalTrade, normalizeTariffRate } from './engine/economy/tradeState';
import { GameMap } from './components/GameMap';
import { applyRebellionAction, type RebellionAction } from './engine/rebellion';
import { ProvincePanel } from './components/ProvincePanel';
import { DiplomacyPanel } from './components/DiplomacyPanel';
import { WarPanel } from './components/WarPanel';
import { BattleReportModal } from './components/BattleReportModal';
import { BattleHistoryModal } from './components/BattleHistoryModal';
import { ArmySelectionSummary } from './components/ArmySelectionSummary';
import { ArmyReorganizationPanel } from './components/ArmyReorganizationPanel';
import { ArmyMovementPlanPanel } from './components/ArmyMovementPlanPanel';
import { FocusModal } from './components/FocusModal';
import { ResearchModal } from './components/ResearchModal';
import { EndGameModal } from './components/EndGameModal';
import { SettingsModal } from './components/SettingsModal';
import { provincesData } from './data/map';
import { createInitialArmies } from './data/map/initialState';
import { countries as initialCountries } from './data/countries';
import { calculateArmySize } from './engine/combat';
import { buildLogisticsNetworks, getProvinceLogistics } from './engine/logistics';
import { getArmySupply } from './engine/military';
import { createInitialTechState } from './engine/technology';
import { ToastProvider, useToast } from './context/ToastContext';
import { AILogProvider, useAILog } from './context/AILogContext';
import { ToastContainer } from './components/ToastContainer';
import { NotificationLogModal } from './components/NotificationLogModal';
import { AILogModal } from './components/AILogModal';
import { GovernmentModal } from './components/GovernmentModal';
import type {
  Province,
  Country,
  GameDate,
  Army,
  Recruitment,
  BuildingConstruction,
  ActiveBattle,
  CombatResult,
} from './types';
import type { CountryTechState } from './types/technology';
import type { DiplomaticRelation, War } from './types/diplomacy';
import type { AIDifficulty } from './types/difficulty';
import type { EndGameType, GameStats } from './engine/gameConditions';
import { useGameSelection } from './hooks/app/useGameSelection';
import { useGameModals } from './hooks/app/useGameModals';
import { useEconomyActions } from './hooks/app/useEconomyActions';
import { useArmyActions } from './hooks/app/useArmyActions';
import { useDiplomacyActions } from './hooks/app/useDiplomacyActions';
import { createInitialDiplomacy } from './engine/diplomacy';
import { getCampaigns } from './engine/diplomacy/campaigns';
import { useTechActions } from './hooks/app/useTechActions';
import { useCheats } from './hooks/app/useCheats';
import { CheatPanel } from './components/CheatPanel';
import { UNIT_DEFINITIONS } from './data/units';
import { useSaveSystem } from './hooks/app/useSaveSystem';
import { CampaignEntry, type CampaignStart } from './components/CampaignEntry';
import { getCountryInitialView } from './engine/countrySelection';
import { ArmyTransportPanel } from './components/ArmyTransportPanel';
import { embarkArmy, disembarkArmy, planInvasion, amphibiousLandingLabel } from './engine/naval/transport';
import type { NavalState, Fleet } from './types/naval';
import { createInitialNavies, createInitialShipyards, startNavalConstruction, cancelNavalConstruction, resolveFleetIntercept, orderFleetMove, orderFleetReturn, cancelNavalOrder } from './engine/naval';


export const GameApp: React.FC<CampaignStart> = ({ playerCountryTag: initialPlayerTag, saved }) => {
  const { addToast, notificationHistory, unreadCount, markAllAsRead } = useToast();
  const { addAILog } = useAILog();
  const [playerCountryTag, setPlayerCountryTag] = useState(initialPlayerTag);
  const [date, setDate] = useState<GameDate>(saved?.date ?? { year: 2020, month: 1, day: 1 });
  const [gameSpeed, setGameSpeed] = useState(0);
  const [provinces, setProvinces] = useState<Province[]>(() => saved?.world.provinces ?? structuredClone(provincesData));
  const [allCountries, setAllCountries] = useState<Country[]>(() =>
    saved?.world.countries ?? initialCountries.map((c): Country => initializePolitics({
      ...c,
      provinces: [...c.provinces],
      activeLaws: { ...c.activeLaws },
      resources: { ...c.resources },
      economy: { ...c.economy },
    }))
  );
  const [armies, setArmies] = useState<Army[]>(() => saved?.military.armies ?? createInitialArmies(initialCountries));
  const [navalState, setNavalState] = useState<NavalState>(() => saved ? saved.naval ?? { fleets: [], battles: [] } : { fleets: createInitialNavies(initialCountries, provincesData), battles: [], construction: createInitialShipyards(initialCountries, provincesData) });
  const [airState, setAirState] = useState<AirState>(() => saved ? saved.air ?? { wings: [], engagements: [] } : createInitialAirState(initialCountries, provincesData));
  const [selectedAirWingId, setSelectedAirWingId] = useState<string | null>(null);
  useEffect(() => { if (selectedAirWingId && !airState.wings.some(w => w.id === selectedAirWingId)) setSelectedAirWingId(null); }, [airState, selectedAirWingId]);
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null);
  useEffect(() => { if (selectedFleetId && !navalState.fleets.some(f => f.id === selectedFleetId)) setSelectedFleetId(null); }, [navalState, selectedFleetId]);
  const [recruitments, setRecruitments] = useState<Recruitment[]>(saved?.military.recruitments ?? []);
  const [buildingConstructions, setBuildingConstructions] = useState<BuildingConstruction[]>(saved?.economy.constructions ?? []);
  const [diplomaticRelations, setDiplomaticRelations] = useState<DiplomaticRelation[]>(() => saved?.diplomacy.relations ?? createInitialDiplomacy(initialCountries, provincesData));
  const [wars, setWars] = useState<War[]>(saved?.military.wars ?? []);
  const [playerTechState, setPlayerTechState] = useState<CountryTechState>(() => saved?.technology.player ?? createInitialTechState(playerCountryTag));
  const [botTechStates, setBotTechStates] = useState<Map<string, CountryTechState>>(() => { if (saved) return saved.technology.bots; const m = new Map<string, CountryTechState>(); initialCountries.forEach(c => { if (c.tag !== playerCountryTag) m.set(c.tag, createInitialTechState(c.tag)); }); return m; });
  const [endGameType, setEndGameType] = useState<EndGameType>(null);
  const [hasTriggeredEndGame, setHasTriggeredEndGame] = useState(false);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [activeBattles, setActiveBattles] = useState<ActiveBattle[]>(saved?.military.activeBattles ?? []);
  const [battleHistory, setBattleHistory] = useState<CombatResult[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [showCheatPanel, setShowCheatPanel] = useState(false);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [showEconomyPanel, setShowEconomyPanel] = useState(false);
  const closeEconomyPanel = useCallback(() => setShowEconomyPanel(false), []);


  const addLog = useCallback((msg: string) => console.log(msg), []);
  const formatGameDate = useCallback((d: GameDate) => `${d.day} de ${d.month}, ${d.year}`, []);

  const { airStateRef, navalStateRef, gameLoopRef, provincesRef, countriesRef, armiesRef, recruitmentsRef, warsRef, diplomaticRelationsRef, dateRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, aiDifficultyRef, activeBattlesRef, ceilingLogRef } = useGameRefs({ airState, navalState, provinces, allCountries, armies, recruitments, wars, diplomaticRelations, date, buildingConstructions, playerTechState, botTechStates, aiDifficulty, activeBattles });

  const modals = useGameModals();
  const selection = useGameSelection(playerCountryTag, provincesRef, armiesRef, modals.handleOpenDiplomacy, armies);
  const selectFleet = (id: string | null) => { setSelectedAirWingId(null); setSelectedFleetId(id); if (id) { selection.clearArmySelection(); selection.handleClosePanel(); } };
  const selectAirWing = (id: string | null) => { setSelectedAirWingId(id); if (id) { setSelectedFleetId(null); selection.clearArmySelection(); selection.handleClosePanel(); } };
  const airCommand = (command: (wing: AirWing) => AirWing | null) => {
    const wing = airStateRef.current.wings.find(w => w.id === selectedAirWingId);
    if (!wing || wing.countryTag !== playerCountryTag) return;
    const updated = command(wing);
    if (!updated) { addToast('Ordem aérea inválida: verifique alcance, acesso, capacidade e missão.', 'warning'); return; }
    const next = { ...airStateRef.current, wings: airStateRef.current.wings.map(w => w.id === wing.id ? updated : w) };
    airStateRef.current = next; setAirState(next);
    addToast(updated.rebase ? `Rebase iniciado: ${updated.rebase.totalDays} dias.` : updated.mission ? `Missão ${updated.mission} atribuída.` : 'Missão aérea cancelada; recuperação iniciada.', 'success', 'Air Warfare');
  };
  const airContext = () => ({ provinces: provincesRef.current, countries: countriesRef.current, wars: warsRef.current, relations: diplomaticRelationsRef.current });
  const airMission = (mission: AirMission, zone: string) => {
    const provinceId = airZoneById.get(zone)?.provinceIds[0] ?? '';
    const result = resolveAirTarget(airStateRef.current, { kind: 'MISSION', wingId: selectedAirWingId ?? '', mission }, provinceId, playerCountryTag, airContext());
    if (result.error) { addToast(result.error, 'warning', 'Air Warfare'); return; }
    airCommand(() => result.wing!);
  };
  const airRebase = (provinceId: string) => {
    const result = resolveAirTarget(airStateRef.current, { kind: 'REBASE', wingId: selectedAirWingId ?? '' }, provinceId, playerCountryTag, airContext());
    if (result.error) { addToast(result.error, 'warning', 'Air Warfare'); return; }
    airCommand(() => result.wing!);
  };
  const buildAir = (provinceId: string, type: AircraftType) => {
    const result = startAirProduction(airStateRef.current, provincesRef.current, countriesRef.current, playerCountryTag, provinceId, type);
    if (result.error) { addToast(result.error, 'warning', 'Aircraft Production'); return; }
    airStateRef.current = result.state; provincesRef.current = result.provinces; countriesRef.current = result.countries;
    setAirState(result.state); setProvinces(result.provinces); setAllCountries(result.countries);
    addToast(`${type} Wing: produção iniciada.`, 'success', 'Aircraft Production');
  };
  const cancelAirBuild = (id: string) => { const next = cancelAirProduction(airStateRef.current, id, playerCountryTag); airStateRef.current = next; setAirState(next); addToast('Produção aérea cancelada sem reembolso.', 'info'); };
  const fleetCommand = (command: (fleet: Fleet) => Fleet | null, cancelInvasion = false) => {
    const fleet = navalStateRef.current.fleets.find(f => f.id === selectedFleetId);
    if (!fleet || fleet.countryTag !== playerCountryTag) { addToast('Selecione uma frota própria.', 'warning'); return; }
    if (!cancelInvasion && navalStateRef.current.invasions?.some(o => o.fleetId === fleet.id)) { addToast('Fleet comprometida: cancele a invasão antes de mover.', 'warning'); return; }
    const updated = command(fleet);
    if (!updated) { addToast('Ordem naval inválida: verifique destino, acesso ao porto e status da frota.', 'warning'); return; }
    const next = { ...navalStateRef.current, ...(cancelInvasion ? { invasions: navalStateRef.current.invasions?.filter(o => o.fleetId !== fleet.id) } : {}), fleets: navalStateRef.current.fleets.map(f => f.id === fleet.id ? updated : f) };
    navalStateRef.current = next; setNavalState(next);
    const pending = cancelInvasion ? cancelFriendlyBeachLanding(armiesRef.current, armiesRef.current.filter(a => a.embarkedFleetId === fleet.id).map(a => a.id), playerCountryTag) : armiesRef.current;
    const friendly = friendlyBeachLandingTick({ armies: pending, naval: next, provinces: provincesRef.current, wars: warsRef.current, relations: diplomaticRelationsRef.current, activeBattles: activeBattlesRef.current }, new Set(), false);
    for (const feedback of friendly.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'warning', 'Transporte naval');
    const extraction = beachExtractionTick({ armies: friendly.armies, naval: next, provinces: provincesRef.current, wars: warsRef.current, relations: diplomaticRelationsRef.current, activeBattles: activeBattlesRef.current }, new Set(), false);
    armiesRef.current = extraction.armies; setArmies(extraction.armies);
    for (const feedback of extraction.messages) if (feedback.owner === playerCountryTag) addToast(feedback.message, 'warning', 'Transporte naval');
  };
  const transportContext = () => ({ armies: armiesRef.current, naval: navalStateRef.current, provinces: provincesRef.current, wars: warsRef.current, relations: diplomaticRelationsRef.current, actor: playerCountryTag, activeBattles: activeBattlesRef.current });
  const transportArmy = (armyId: string, fleetId?: string) => {
    const result = fleetId ? embarkArmy(transportContext(), armyId, fleetId) : disembarkArmy(transportContext(), armyId);
    if (result.error) { addToast(result.error, 'warning', 'Transporte naval'); return; }
    armiesRef.current = result.armies; setArmies(result.armies);
    addToast(result.armies.find(a => a.id === armyId)?.beachExtraction ? BEACH_EXTRACTION_LABEL : fleetId ? 'Army embarcado; ordem terrestre cancelada.' : 'Desembarque concluído.', 'success', 'Transporte naval');
  };
  const friendlyDisembark = (
    armyIds: string[],
    provinceId: string
  ) => {
    const result =
      disembarkArmiesAtProvince(
        transportContext(),
        armyIds,
        provinceId
      );

    if (result.error) {
      addToast(
        result.error,
        'warning',
        'Desembarque amigável'
      );
      return;
    }

    navalStateRef.current = result.naval;
    setNavalState(result.naval);

    armiesRef.current = result.armies;
    setArmies(result.armies);

    const army = result.armies.find(
      a => armyIds.includes(a.id)
    );

    const landing =
      army?.friendlyBeachLanding;

    const fleet = landing
      ? result.naval.fleets.find(
        f => f.id === army?.embarkedFleetId
      )
      : undefined;

    const traveling =
      landing &&
      fleet?.status === 'MOVING' &&
      fleet.destinationSeaNodeId ===
      landing.seaNodeId;

    addToast(
      traveling
        ? 'Frota navegando até a costa; o desembarque começará ao chegar.'
        : landing
          ? FRIENDLY_BEACH_LANDING_LABEL
          : 'Desembarcar pelo porto: concluído.',
      'success',
      'Transporte naval'
    );
  };
  const cancelFriendly = (armyId: string) => { const updated = cancelFriendlyBeachLanding(armiesRef.current, [armyId], playerCountryTag); armiesRef.current = updated; setArmies(updated); addToast('Desembarque amig\u00e1vel cancelado.', 'info', 'Transporte naval'); };
  const invade = (armyIds: string[], provinceId: string) => {
    const result = planInvasion(transportContext(), selectedFleetId ?? '', armyIds, provinceId);
    if (result.error) { addToast(result.error, 'warning', 'Amphibious Invasion'); return; }
    navalStateRef.current = result.naval; setNavalState(result.naval);
    addToast(amphibiousLandingLabel(result.naval.invasions?.find(o => o.fleetId === selectedFleetId)?.landingType), 'info', 'Amphibious Invasion');
  };
  const interceptFleet = (targetId: string) => {
    const own = navalStateRef.current.fleets.find(f => f.id === selectedFleetId);
    const target = navalStateRef.current.fleets.find(f => f.id === targetId);
    const destination = resolveFleetIntercept(own, target, playerCountryTag, warsRef.current);
    if (destination.error) { addToast(destination.error, 'warning'); return; }
    const moved = orderFleetMove(own!, destination.nodeId!, playerCountryTag);
    if (!moved) { addToast('Sem rota naval at? a frota alvo.', 'warning'); return; }
    fleetCommand(() => moved);
    addToast(`Interceptando ${target!.name}`, 'info');
  };
  const buildNaval = (provinceId: string, type: import('./types/naval').NavalUnitType | 'UPGRADE', targetFleetId?: string) => {
    const next = startNavalConstruction(navalStateRef.current, provincesRef.current, countriesRef.current, playerCountryTag, provinceId, type, diplomacyDay(dateRef.current), targetFleetId);
    if (next.error) { addToast(next.error, 'warning'); return; }
    navalStateRef.current = next.naval; provincesRef.current = next.provinces; countriesRef.current = next.countries;
    setNavalState(next.naval); setProvinces(next.provinces); setAllCountries(next.countries);
  };
  const cancelNavalBuild = (id: string) => { const next = cancelNavalConstruction(navalStateRef.current, id, playerCountryTag); navalStateRef.current = next; setNavalState(next); };
  const returnFleet = (portId?: string) => fleetCommand(f => orderFleetReturn(f, provincesRef.current, diplomaticRelationsRef.current, warsRef.current, playerCountryTag, portId));


  const saveSystem = useSaveSystem(
    { battleHistoryRef: { current: battleHistory }, airStateRef, navalStateRef, provincesRef, countriesRef, armiesRef, warsRef, diplomaticRelationsRef, recruitmentsRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, activeBattlesRef, dateRef },
    { setBattleHistory, setAirState, setNavalState, setProvinces, setAllCountries, setArmies, setWars, setDiplomaticRelations, setRecruitments, setBuildingConstructions, setPlayerTechState, setBotTechStates, setActiveBattles, setDate, setPlayerCountryTag },
    addToast,
    modals.setShowSettingsModal
  );


  const playerCountry = useMemo(() => allCountries.find(c => c.tag === playerCountryTag)!, [allCountries, playerCountryTag]);
  const initialMapView = useMemo(() => getCountryInitialView(playerCountry, provinces), [playerCountry, provinces]);
  const selectedProvinceData = useMemo(() => provinces.find(p => p.id === selection.selectedProvince) ?? null, [provinces, selection.selectedProvince]);
  const selectedArmyData = useMemo(() => armies.find(a => a.id === selection.selectedArmy) ?? null, [armies, selection.selectedArmy]);
  const logistics = useMemo(() => buildLogisticsNetworks({ provinces, countries: allCountries, relations: diplomaticRelations, wars }), [provinces, allCountries, diplomaticRelations, wars]);
  const selectedArmyProvince = selectedArmyData ? provinces.find(p => p.id === selectedArmyData.location) : undefined;
  const selectedArmyLogistics = selectedArmyData && selectedArmyProvince ? getProvinceLogistics(logistics, selectedArmyData.owner, selectedArmyProvince.id) : undefined;
  const selectedArmySupply = selectedArmyData && selectedArmyProvince ? getArmySupply(selectedArmyData, selectedArmyProvince, armies, logistics) : undefined;
  const diplomacyTargetCountry = useMemo(() => allCountries.find(c => c.tag === modals.diplomacyTarget) ?? null, [allCountries, modals.diplomacyTarget]);

  useGameLoop({ airStateRef, setAirState, navalStateRef, setNavalState, provincesRef, countriesRef, armiesRef, recruitmentsRef, warsRef, diplomaticRelationsRef, dateRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, aiDifficultyRef, activeBattlesRef, ceilingLogRef, gameLoopRef, playerCountryTag, battleHistory, hasTriggeredEndGame, gameSpeed, isPaused: modals.isPaused, allCountries, setProvinces, setAllCountries, setArmies, setWars, setDiplomaticRelations, setRecruitments, setBuildingConstructions, setPlayerTechState, setBotTechStates, setDate, setActiveBattles, setEndGameType, setGameStats, setHasTriggeredEndGame, setIsPaused: modals.setIsPaused, setBattleHistory, setNavalReports: modals.setNavalReports, setBattleReport: modals.setBattleReport, addLog, addToast, addAILog, formatGameDate });

  const economy = useEconomyActions({ provinces, playerCountry, playerCountryTag, playerTechState, buildingConstructions, setBuildingConstructions, setProvinces, setAllCountries, recruitments, setRecruitments, addLog, addToast, formatGameDate, dateRef });
  const handleTariffChange = (rate: number) => {
    const countries = countriesRef.current.map(c => c.tag === playerCountryTag ? { ...c, trade: { ...normalizeNationalTrade(c.trade), tariffRate: normalizeTariffRate(rate) } } : c);
    countriesRef.current = countries;
    setAllCountries(countries);
  };
  const handleRebellionAction = (provinceId: string, action: RebellionAction) => {
    const result = applyRebellionAction(provincesRef.current, countriesRef.current, armiesRef.current, playerCountryTag, provinceId, action, dateRef.current);
    if (result.accepted) {
      provincesRef.current = result.provinces; countriesRef.current = result.countries; armiesRef.current = result.armies;
      setProvinces(result.provinces); setAllCountries(result.countries); setArmies(result.armies);
      addLog(result.reason);
    }
    addToast(result.reason, result.accepted ? 'success' : 'warning', 'Resposta à rebelião');
  };
  const armyActions = useArmyActions({ activeBattlesRef, setActiveBattles, selectedArmy: selection.selectedArmy, selectedArmyIds: selection.selectedArmyIds, setSelectedArmy: selection.setSelectedArmy, setSelectedProvince: selection.setSelectedProvince, setIsPanelOpen: selection.setIsPanelOpen, provincesRef, armiesRef, diplomaticRelationsRef, playerCountryTag, setArmies, addLog, addToast, splitSelection: selection.splitSelection, setSplitSelection: selection.setSplitSelection, setShowSplitModal: selection.setShowSplitModal });
  const diplomacy = useDiplomacyActions({ diplomacyTarget: modals.diplomacyTarget, playerCountryTag, countriesRef, provincesRef, armiesRef, diplomaticRelationsRef, warsRef, dateRef, setDiplomaticRelations, setWars, setArmies, activeBattlesRef, setActiveBattles, addLog, addToast });
  const playerAtWar = wars.some(war => war.attacker === playerCountryTag || war.defender === playerCountryTag);
  const tech = useTechActions({ playerCountry, playerCountryTag, playerTechState, setPlayerTechState, allCountries, setAllCountries, addLog, addToast, playerTechStateRef, setAiDifficulty, setEndGameType, setGameStats, setGameSpeed, setIsPaused: modals.setIsPaused, countriesRef, dateRef, warsRef });

  const handleEndGameRestart = useCallback(() => {
    // força novo jogo via URL pra não carregar save no reload
    window.location.href = window.location.pathname + '?newgame=1';
  }, []);

  const handleEndGameContinue = useCallback(() => {
    setEndGameType(null);
    // IMPORTANTE: mantém hasTriggeredEndGame = true pra não disparar de novo
    // mas despausa
    modals.setIsPaused(false);
    setGameSpeed(1);
    // limpa o save do momento da derrota pra não voltar pra ela
    addToast('Continuando mesmo assim...', 'info');
  }, [addToast, modals]);

  const cheats = useCheats({
    playerCountryTag, setAllCountries, setRecruitments, setBuildingConstructions,
    setArmies, provincesRef, armiesRef, setProvinces, addLog, addToast, setGameSpeed, setDate,
    selectedProvince: selection.selectedProvince
  });

  useEffect(() => {
    window.cheatPanelOpen = showCheatPanel;

    window.cheats = {
      ...cheats,
      togglePanel: () => setShowCheatPanel(p => !p),
    };
  }, [showCheatPanel, cheats]);

  const playerCampaignCount = getCampaigns(wars).filter(c => [...c.attackerParticipants, ...c.defenderParticipants].includes(playerCountryTag)).length;
  return (
    <div className="game">
      <TopBar
        playerCountry={playerCountry}
        provinces={provinces}
        date={date}
        gameSpeed={gameSpeed}
        onSpeedChange={tech.handleSpeedChange}
        onResearchClick={() => setShowResearchModal(true)}
        onFocusClick={() => setShowFocusModal(true)}
        onSettingsClick={() => modals.setShowSettingsModal(true)}
        onGovernmentClick={() => modals.setShowGovernmentModal(true)}
        onEconomyClick={() => setShowEconomyPanel(true)}
      />      <div className="game__main">
        <GameMap onAirFeedback={(message, error) => { if (error) addToast(message, 'warning', 'Air Warfare'); }} airState={airState} selectedAirWingId={selectedAirWingId} onAirWingSelect={selectAirWing} onAirMission={airMission} onAirRebase={airRebase} onAirCancel={() => airCommand(cancelAirMission)} onFriendlyLanding={friendlyDisembark} onDisembark={id => transportArmy(id)} onInvasion={invade} navalState={navalState} selectedFleetId={selectedFleetId} onFleetSelect={selectFleet} onFleetOrder={id => fleetCommand(f => orderFleetMove(f, id, playerCountryTag))} onFleetIntercept={interceptFleet} onFleetReturn={returnFleet} onFleetCancel={() => { fleetCommand(cancelNavalOrder, true); addToast('Ordem naval/landing cancelado.', 'info'); }} key={playerCountryTag} initialViewBox={initialMapView} logistics={logistics} provinces={provinces} countries={allCountries} armies={armies} recruitments={recruitments} buildingConstructions={buildingConstructions} activeBattles={activeBattles} wars={wars} diplomaticRelations={diplomaticRelations} selectedProvince={selection.selectedProvince} hoveredProvince={selection.hoveredProvince} selectedArmy={selection.selectedArmy} selectedArmyIds={selection.selectedArmyIds} playerCountryTag={playerCountryTag} onToggleArmy={value => { setSelectedAirWingId(null); setSelectedFleetId(null); selection.toggleArmySelection(value); }} onToggleStack={value => { setSelectedAirWingId(null); setSelectedFleetId(null); selection.toggleStackSelection(value); }} onToggleStackAdditive={value => { setSelectedAirWingId(null); setSelectedFleetId(null); selection.toggleStackAdditive(value); }} onClearSelection={() => { setSelectedAirWingId(null); setSelectedFleetId(null); selection.clearArmySelection(); selection.handleClosePanel(); }} onProvinceHover={selection.handleProvinceHover} onProvinceClick={id => { setSelectedAirWingId(null); setSelectedFleetId(null); selection.handleProvinceClick(id); }} onArmyClick={id => { setSelectedAirWingId(null); setSelectedFleetId(null); selection.handleArmyClick(id); }} onProvinceRightClick={armyActions.handleProvinceRightClick} />
        {selection.isPanelOpen && selectedProvinceData && <ProvincePanel onAirBuild={buildAir} onAirBuildCancel={cancelAirBuild} airState={airState} onSelectAirWing={selectAirWing} navalState={navalState} onNavalBuild={buildNaval} onNavalCancel={cancelNavalBuild} fleets={navalState.fleets} onSelectFleet={selectFleet} selectedArmyIds={selection.selectedArmyIds} onSelectArmy={id => { setSelectedAirWingId(null); setSelectedFleetId(null); selection.toggleArmySelection(id); }} logistics={logistics} onRebellionAction={handleRebellionAction} province={selectedProvinceData} provinces={provinces} countries={allCountries} playerCountry={playerCountry} playerTechState={playerTechState} botTechStates={botTechStates} armies={armies} recruitments={recruitments} buildingConstructions={buildingConstructions} onClose={selection.handleClosePanel} onProvinceClick={selection.handleProvinceClick} onBuild={economy.handleBuild} onRecruit={economy.handleRecruit} onCancelRecruitment={economy.handleCancelRecruitment} onCancelBuilding={economy.handleCancelBuilding} />}
        {selection.selectedArmyIds.length > 1 && <ArmySelectionSummary armies={armies.filter(a => selection.selectedArmyIds.includes(a.id) && a.owner === playerCountryTag)} allArmies={armies} provinces={provinces} logistics={logistics} onClear={selection.clearArmySelection} onClearRoutes={armyActions.handleClearRoutes}><ArmyReorganizationPanel selectedIds={selection.selectedArmyIds} context={{ armies, provinces, playerCountryTag, activeBattles }} onConfirm={armyActions.handleReorganize} /></ArmySelectionSummary>}
        {selection.selectedArmyIds.length === 1 && selectedArmyData && (
          <div className="army-info-panel">
            <div className="army-info-panel__header"><h3>{selectedArmyData.name}</h3><button onClick={() => selection.setSelectedArmy(null)}>✕</button></div>
            <div className="army-info-panel__content">
              <div className="army-info-panel__stat"><span>Total:</span><span>{calculateArmySize(selectedArmyData).toLocaleString()} homens</span></div>
              <div className="army-info-panel__stat"><span>Local:</span><span>{provinces.find(p => p.id === selectedArmyData.location)?.name ?? 'Em movimento'}</span></div>
              {selectedArmySupply && <div className="army-info-panel__stat"><span>Supply:</span><span>{Math.round(selectedArmySupply.ratio * 100)}%</span></div>}
              {selectedArmyLogistics && <div className="army-info-panel__stat"><span>Logística:</span><span>{selectedArmyLogistics.connected ? 'Conectada' : 'Desconectada'} · Distância {selectedArmyLogistics.distance ?? '—'}</span></div>}
              {selectedArmyData.destination && <div className="army-info-panel__stat"><span>Destino:</span><span>{provinces.find(p => p.id === selectedArmyData.destination)?.name} ({Math.round(selectedArmyData.movementProgress * 100)}%)</span></div>}
              {selectedArmyData.path.length > 0 && <div className="army-info-panel__stat"><span>Rota:</span><span className="army-info-panel__path">{selectedArmyData.path.map(pid => provinces.find(p => p.id === pid)?.name).join(' → ')}</span></div>}
              <ArmyTransportPanel onCancelFriendlyLanding={() => cancelFriendly(selectedArmyData.id)} army={selectedArmyData} armies={armies} fleets={navalState.fleets} provinces={provinces} owner={selectedArmyData.owner === playerCountryTag} onEmbark={id => transportArmy(selectedArmyData.id, id)} onDisembark={() => transportArmy(selectedArmyData.id)} wars={wars} relations={diplomaticRelations} activeBattles={activeBattles} onCancelExtraction={() => { const updated = cancelBeachExtraction(armiesRef.current, selectedArmyData.id, playerCountryTag); armiesRef.current = updated; setArmies(updated); addToast('Extra\u00e7\u00e3o pela praia cancelada.', 'info', 'Transporte naval'); }} navalState={navalState} /><ArmyMovementPlanPanel army={selectedArmyData} provinces={provinces} onClear={armyActions.handleClearRoutes} />
              <div className="army-info-panel__regiments">
                <strong>Regimentos:</strong>

                {selectedArmyData.regiments.map((reg, i) => {
                  const def = UNIT_DEFINITIONS[reg.type];
                  return (
                    <div key={i} className="army-info-panel__regiment">
                      <span>
                        {def.icon} {def.name}
                      </span>

                      <span>{Math.floor(reg.strength)}</span>

                      <span>❤️ {Math.round(reg.morale)}%</span>
                    </div>
                  );
                })}
              </div>    {selectedArmyData.destination && selectedArmyData.owner === playerCountryTag && !selectedArmyData.inCombat && <div className="army-info-panel__actions-section">
                <button className="army-info-panel__action-btn army-info-panel__action-btn--stop" onClick={() => armyActions.handleStopMovement(selectedArmyData.id)}>🛑 Parar Marcha</button></div>}
              <ArmyReorganizationPanel selectedIds={selection.selectedArmyIds} context={{ armies, provinces, playerCountryTag, activeBattles }} onConfirm={armyActions.handleReorganize} onHalf={armyActions.handleSplitHalf} />

            </div>
          </div>
        )}
        {diplomacyTargetCountry && <DiplomacyPanel key={`${playerCountryTag}:${diplomacyTargetCountry.tag}`} targetCountry={diplomacyTargetCountry} playerCountry={playerCountry} context={{ relations: diplomaticRelations, wars, countries: allCountries, provinces, armies, date }} onClose={modals.handleCloseDiplomacy} onAction={diplomacy.handleAction} onProposal={diplomacy.handleProposal} onCall={diplomacy.handleCall} feedback={diplomacy.feedback} />}
        {modals.showWarPanel && <WarPanel provinces={provinces} armies={armies} date={date} wars={wars} playerCountry={playerCountry} allCountries={allCountries} onClose={() => modals.setShowWarPanel(false)} onMakePeace={diplomacy.handleMakePeace} />}
        {modals.battleReport && <BattleReportModal battleResult={modals.battleReport} playerCountry={playerCountry} allCountries={allCountries} onClose={() => { modals.setBattleReport(null); if (!modals.navalReports.length) modals.setIsPaused(false); }} />}
        {!modals.battleReport && modals.navalReports[0] && <NavalBattleReportModal key={modals.navalReports[0].id} battle={modals.navalReports[0]} playerCountryTag={playerCountryTag} countries={allCountries} fleets={navalState.fleets} onClose={() => { modals.setNavalReports(queue => queue.slice(1)); if (modals.navalReports.length === 1) modals.setIsPaused(false); }} />}
        {modals.showBattleHistory && <BattleHistoryModal playerCountryTag={playerCountryTag} battleHistory={battleHistory} allCountries={allCountries} onClose={() => modals.setShowBattleHistory(false)} onViewBattle={(b) => { modals.setShowBattleHistory(false); modals.setBattleReport(b); modals.setIsPaused(true); }} />}
        {showEconomyPanel && <NationalEconomyPanel country={playerCountry} countries={allCountries} provinces={provinces} onTariffChange={handleTariffChange} onClose={closeEconomyPanel} />}
        {showFocusModal &&
          <FocusModal
            techState={playerTechState}
            onStartFocus={tech.handleStartFocus}
            onCancelFocus={tech.handleCancelFocus}
            onClose={() => setShowFocusModal(false)}
          />}

        {showResearchModal &&
          <ResearchModal
            playerCountry={playerCountry}
            techState={playerTechState}
            onStartResearch={tech.handleStartResearch}
            onCancelResearch={tech.handleCancelResearch}
            onClose={() => setShowResearchModal(false)}
          />}        {endGameType && gameStats && <EndGameModal
            endGameType={endGameType}
            stats={gameStats}
            onContinue={handleEndGameContinue}
            onRestart={handleEndGameRestart}
          />}
        <NotificationLogModal isOpen={modals.showNotificationModal} onClose={() => modals.setShowNotificationModal(false)} />
        <AILogModal isOpen={modals.showAILogModal} onClose={() => modals.setShowAILogModal(false)} />
        <SettingsModal
          isOpen={modals.showSettingsModal}
          onClose={() => modals.setShowSettingsModal(false)}
          aiDifficulty={aiDifficulty}
          onDifficultyChange={tech.handleDifficultyChange}
          saves={saveSystem.saves}
          autoSaveEnabled={saveSystem.autoSaveEnabled}
          onToggleAutoSave={saveSystem.handleToggleAutoSave}
          onSaveNew={saveSystem.handleManualSave}
          onLoad={saveSystem.handleLoad}
          onDelete={saveSystem.handleDelete}
        />
        {modals.showGovernmentModal && <GovernmentModal provinces={provinces} armies={armies} wars={wars} date={date} playerCountry={playerCountry} atWar={playerAtWar} onEnactLaw={tech.handleEnactLaw} onClose={() => modals.setShowGovernmentModal(false)} />}
      </div>
      <div className="game__bottom-bar">
        <div className="game__bottom-info"><span className="game__bottom-label">Províncias:</span><span className="game__bottom-value">{playerCountry.provinces.length}</span></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Exércitos:</span><span className="game__bottom-value">{armies.filter(a => a.owner === playerCountryTag).length}</span></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Tropas:</span><span className="game__bottom-value">{armies.filter(a => a.owner === playerCountryTag).reduce((s, a) => s + calculateArmySize(a), 0).toLocaleString()}</span></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Histórico:</span><button className="game__bottom-history-btn" aria-label="Abrir histórico de batalhas" onClick={() => modals.setShowBattleHistory(true)}>📜 Batalhas ({battleHistory.length})</button></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Avisos:</span><button className="game__bottom-notifications-btn" onClick={() => { modals.setShowNotificationModal(true); markAllAsRead(); }}>🔔 {unreadCount > 0 ? <span className="game__bottom-notifications-badge">{unreadCount}</span> : notificationHistory.length}</button></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Log IA:</span><button className="game__bottom-ai-log-btn" onClick={() => modals.setShowAILogModal(true)}>🤖 IA</button></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Guerras:</span><button className="game__bottom-war-btn" onClick={() => modals.setShowWarPanel(true)}>{playerCampaignCount > 0 ? `⚔️ ${playerCampaignCount}` : '🕊️ Paz'}</button></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Velocidade:</span><span className="game__bottom-value game__bottom-value--highlight">{gameSpeed === 0 ? '⏸ Pausado' : `▶ x${gameSpeed}`}</span></div>
      </div>
      <button onClick={() => setShowCheatPanel(!showCheatPanel)} style={{ position: 'fixed', top: '100px', right: '1600px', zIndex: 9998, background: '#f39c12', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🎮 CHEAT</button>
      <CheatPanel cheats={cheats} isOpen={showCheatPanel} onClose={() => setShowCheatPanel(false)} />
      <ToastContainer />
    </div>
  );
};

const AppWithProviders: React.FC = () => <ToastProvider><AILogProvider><CampaignEntry renderGame={campaign => <GameApp {...campaign} />} /></AILogProvider></ToastProvider>;
export default AppWithProviders;
