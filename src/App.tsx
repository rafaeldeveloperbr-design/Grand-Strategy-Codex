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


export const GameApp: React.FC<CampaignStart> = ({ playerCountryTag: initialPlayerTag, saved }) => {
  const { addToast, notificationHistory, unreadCount, markAllAsRead } = useToast();
  const { addAILog } = useAILog();
  const [playerCountryTag, setPlayerCountryTag] = useState(initialPlayerTag);
  const [date, setDate] = useState<GameDate>(saved?.date ?? { year: 1444, month: 11, day: 11 });
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

  const { gameLoopRef, provincesRef, countriesRef, armiesRef, recruitmentsRef, warsRef, diplomaticRelationsRef, dateRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, aiDifficultyRef, activeBattlesRef, ceilingLogRef } = useGameRefs({ provinces, allCountries, armies, recruitments, wars, diplomaticRelations, date, buildingConstructions, playerTechState, botTechStates, aiDifficulty, activeBattles });

  const modals = useGameModals();
  const selection = useGameSelection(playerCountryTag, provincesRef, armiesRef, modals.handleOpenDiplomacy, armies);


  const saveSystem = useSaveSystem(
    { provincesRef, countriesRef, armiesRef, warsRef, diplomaticRelationsRef, recruitmentsRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, activeBattlesRef, dateRef },
    { setProvinces, setAllCountries, setArmies, setWars, setDiplomaticRelations, setRecruitments, setBuildingConstructions, setPlayerTechState, setBotTechStates, setActiveBattles, setDate, setPlayerCountryTag },
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

  useGameLoop({ provincesRef, countriesRef, armiesRef, recruitmentsRef, warsRef, diplomaticRelationsRef, dateRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, aiDifficultyRef, activeBattlesRef, ceilingLogRef, gameLoopRef, playerCountryTag, battleHistory, hasTriggeredEndGame, gameSpeed, isPaused: modals.isPaused, allCountries, setProvinces, setAllCountries, setArmies, setWars, setDiplomaticRelations, setRecruitments, setBuildingConstructions, setPlayerTechState, setBotTechStates, setDate, setActiveBattles, setEndGameType, setGameStats, setHasTriggeredEndGame, setIsPaused: modals.setIsPaused, setBattleHistory, setBattleReport: modals.setBattleReport, addLog, addToast, addAILog, formatGameDate });

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

  const playerCampaignCount = getCampaigns(wars).filter(c => [...c.attackerParticipants,...c.defenderParticipants].includes(playerCountryTag)).length;
  return (
    <div className="game">
      <TopBar
        playerCountry={playerCountry}
        date={date}
        gameSpeed={gameSpeed}
        onSpeedChange={tech.handleSpeedChange}
        onResearchClick={() => setShowResearchModal(true)}
        onFocusClick={() => setShowFocusModal(true)}
        onSettingsClick={() => modals.setShowSettingsModal(true)}
        onGovernmentClick={() => modals.setShowGovernmentModal(true)}
        onEconomyClick={() => setShowEconomyPanel(true)}
      />      <div className="game__main">
        <GameMap key={playerCountryTag} initialViewBox={initialMapView} logistics={logistics} provinces={provinces} countries={allCountries} armies={armies} recruitments={recruitments} buildingConstructions={buildingConstructions} activeBattles={activeBattles} wars={wars} diplomaticRelations={diplomaticRelations} selectedProvince={selection.selectedProvince} hoveredProvince={selection.hoveredProvince} selectedArmy={selection.selectedArmy} selectedArmyIds={selection.selectedArmyIds} playerCountryTag={playerCountryTag} onToggleArmy={selection.toggleArmySelection} onToggleStack={selection.toggleStackSelection} onToggleStackAdditive={selection.toggleStackAdditive} onClearSelection={selection.clearArmySelection} onProvinceHover={selection.handleProvinceHover} onProvinceClick={selection.handleProvinceClick} onArmyClick={selection.handleArmyClick} onProvinceRightClick={armyActions.handleProvinceRightClick} />
        {selection.isPanelOpen && selectedProvinceData && <ProvincePanel selectedArmyIds={selection.selectedArmyIds} onSelectArmy={selection.toggleArmySelection} logistics={logistics} onRebellionAction={handleRebellionAction} province={selectedProvinceData} provinces={provinces} countries={allCountries} playerCountry={playerCountry} playerTechState={playerTechState} botTechStates={botTechStates} armies={armies} recruitments={recruitments} buildingConstructions={buildingConstructions} onClose={selection.handleClosePanel} onProvinceClick={selection.handleProvinceClick} onBuild={economy.handleBuild} onRecruit={economy.handleRecruit} onCancelRecruitment={economy.handleCancelRecruitment} onCancelBuilding={economy.handleCancelBuilding} />}
        {selection.selectedArmyIds.length > 1 && <ArmySelectionSummary armies={armies.filter(a => selection.selectedArmyIds.includes(a.id) && a.owner === playerCountryTag)} allArmies={armies} provinces={provinces} logistics={logistics} onClear={selection.clearArmySelection} onClearRoutes={armyActions.handleClearRoutes}><ArmyReorganizationPanel selectedIds={selection.selectedArmyIds} context={{armies, provinces, playerCountryTag, activeBattles}} onConfirm={armyActions.handleReorganize} /></ArmySelectionSummary>}
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
              <ArmyMovementPlanPanel army={selectedArmyData} provinces={provinces} onClear={armyActions.handleClearRoutes} />
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
              <ArmyReorganizationPanel selectedIds={selection.selectedArmyIds} context={{armies, provinces, playerCountryTag, activeBattles}} onConfirm={armyActions.handleReorganize} onHalf={armyActions.handleSplitHalf} />

            </div>
          </div>
        )}
        {diplomacyTargetCountry && <DiplomacyPanel key={`${playerCountryTag}:${diplomacyTargetCountry.tag}`} targetCountry={diplomacyTargetCountry} playerCountry={playerCountry} context={{ relations: diplomaticRelations, wars, countries: allCountries, provinces, armies, date }} onClose={modals.handleCloseDiplomacy} onAction={diplomacy.handleAction} onProposal={diplomacy.handleProposal} onCall={diplomacy.handleCall} feedback={diplomacy.feedback} />}
        {modals.showWarPanel && <WarPanel provinces={provinces} armies={armies} date={date} wars={wars} playerCountry={playerCountry} allCountries={allCountries} onClose={() => modals.setShowWarPanel(false)} onMakePeace={diplomacy.handleMakePeace} />}
        {modals.battleReport && <BattleReportModal battleResult={modals.battleReport} playerCountry={playerCountry} allCountries={allCountries} onClose={() => { modals.setBattleReport(null); modals.setIsPaused(false); }} />}
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
