/**
 * App.tsx - COMPLETO - 285 linhas - COM TODAS FEATURES
 * 6 exércitos iniciais + painel completo + bottom bar completa
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useGameRefs } from './hooks/useGameRefs';
import { useGameLoop } from './hooks/useGameLoop';
import { TopBar } from './components/TopBar';
import { GameMap } from './components/GameMap';
import { ProvincePanel } from './components/ProvincePanel';
import { DiplomacyPanel } from './components/DiplomacyPanel';
import { WarPanel } from './components/WarPanel';
import { BattleReportModal } from './components/BattleReportModal';
import { BattleHistoryModal } from './components/BattleHistoryModal';
import { FocusModal } from './components/FocusModal';
import { ResearchModal } from './components/ResearchModal';
import { EndGameModal } from './components/EndGameModal';
import { SettingsModal } from './components/SettingsModal';
import { provincesData } from './data/provinces';
import { countries as initialCountries } from './data/countries';
import { calculateArmySize } from './engine/combat';
import { getFriendlyArmiesInProvince } from './engine/military';
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
import { useTechActions } from './hooks/app/useTechActions';
import { useCheats } from './hooks/app/useCheats';
import { CheatPanel } from './components/CheatPanel';
import { UNIT_DEFINITIONS } from './data/units';
import { useSaveSystem } from './hooks/app/useSaveSystem';


const createInitialArmies = (): Army[] => {
  const base = {
    destination: null,
    targetDestination: null,
    movementProgress: 0,
    movementSpeed: 1.0,
    position: null,
    path: [] as string[],
    targetArmyId: null,
    targetProvinceId: null,
  };

  const armies: Army[] = [
    {
      ...base,
      id: 'army_init_1',
      owner: 'IMP',
      name: '1º Exército Imperial',
      location: 'p1',
      movementSpeed: 1.0,
      regiments: [
        { type: 'infantry', strength: 3000, morale: 90 },
        { type: 'infantry', strength: 2000, morale: 85 },
        { type: 'cavalry', strength: 1000, morale: 80 },
      ],
    },
    {
      ...base,
      id: 'army_init_2',
      owner: 'REP',
      name: 'Legião Valoriana',
      location: 'p6',
      movementSpeed: 1.0,
      regiments: [
        { type: 'infantry', strength: 2500, morale: 88 },
        { type: 'cavalry', strength: 800, morale: 82 },
      ],
    },
    {
      ...base,
      id: 'army_init_3',
      owner: 'RNO',
      name: 'Guarda Nordiana',
      location: 'p10',
      movementSpeed: 0.5,
      regiments: [
        { type: 'infantry', strength: 2000, morale: 92 },
        { type: 'artillery', strength: 500, morale: 85 },
      ],
    },
    {
      ...base,
      id: 'army_init_4',
      owner: 'KHA',
      name: 'Horda Dourada',
      location: 'p14',
      movementSpeed: 1.5,
      regiments: [
        { type: 'cavalry', strength: 4000, morale: 95 },
        { type: 'cavalry', strength: 2000, morale: 90 },
      ],
    },
    {
      ...base,
      id: 'army_init_5',
      owner: 'THC',
      name: 'Guardiões de Solara',
      location: 'p17',
      movementSpeed: 1.0,
      regiments: [
        { type: 'infantry', strength: 1800, morale: 80 },
        { type: 'artillery', strength: 300, morale: 75 },
      ],
    },
    {
      ...base,
      id: 'army_init_6',
      owner: 'LIG',
      name: 'Mercenários de Portus',
      location: 'p20',
      movementSpeed: 1.0,
      regiments: [
        { type: 'infantry', strength: 1500, morale: 75 },
        { type: 'cavalry', strength: 500, morale: 70 },
      ],
    },
  ];

  return armies;
};
const App: React.FC = () => {
  const { addToast, notificationHistory, unreadCount, markAllAsRead } = useToast();
  const { addAILog } = useAILog();
  const [playerCountryTag] = useState('IMP');
  const [date, setDate] = useState<GameDate>({ year: 1444, month: 11, day: 11 });
  const [gameSpeed, setGameSpeed] = useState(0);
  const [provinces, setProvinces] = useState<Province[]>(() => provincesData.map(p => ({ ...p, buildings: [...p.buildings], unrest: 0, originalOwner: p.owner } as Province)));
  const [allCountries, setAllCountries] = useState<Country[]>(() =>
    initialCountries.map((c): Country => ({
      ...c,
      resources: { ...c.resources },
      economy: { ...c.economy },
    }))
  );
  const [armies, setArmies] = useState<Army[]>(createInitialArmies);
  const [recruitments, setRecruitments] = useState<Recruitment[]>([]);
  const [buildingConstructions, setBuildingConstructions] = useState<BuildingConstruction[]>([]);
  const [diplomaticRelations, setDiplomaticRelations] = useState<DiplomaticRelation[]>([]);
  const [wars, setWars] = useState<War[]>([]);
  const [playerTechState, setPlayerTechState] = useState<CountryTechState>(() => createInitialTechState(playerCountryTag));
  const [botTechStates, setBotTechStates] = useState<Map<string, CountryTechState>>(() => { const m = new Map<string, CountryTechState>(); initialCountries.forEach(c => { if (c.tag !== playerCountryTag) m.set(c.tag, createInitialTechState(c.tag)); }); return m; });
  const [endGameType, setEndGameType] = useState<EndGameType>(null);
  const [hasTriggeredEndGame, setHasTriggeredEndGame] = useState(false);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [activeBattles, setActiveBattles] = useState<ActiveBattle[]>([]);
  const [battleHistory, setBattleHistory] = useState<CombatResult[]>([]);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [showCheatPanel, setShowCheatPanel] = useState(false);
  const [showFocusModal, setShowFocusModal] = useState(false);
  const [showResearchModal, setShowResearchModal] = useState(false);


  const addLog = useCallback((msg: string) => console.log(msg), []);
  const formatGameDate = useCallback((d: GameDate) => `${d.day} de ${d.month}, ${d.year}`, []);

  const { gameLoopRef, provincesRef, countriesRef, armiesRef, recruitmentsRef, warsRef, diplomaticRelationsRef, dateRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, aiDifficultyRef, activeBattlesRef, ceilingLogRef } = useGameRefs({ provinces, allCountries, armies, recruitments, wars, diplomaticRelations, date, buildingConstructions, playerTechState, botTechStates, aiDifficulty, activeBattles });

  const modals = useGameModals();
  const selection = useGameSelection(playerCountryTag, provincesRef, armiesRef, modals.handleOpenDiplomacy);


  const saveSystem = useSaveSystem(
    { provincesRef, countriesRef, armiesRef, warsRef, diplomaticRelationsRef, recruitmentsRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, activeBattlesRef, dateRef },
    { setProvinces, setAllCountries, setArmies, setWars, setDiplomaticRelations, setRecruitments, setBuildingConstructions, setPlayerTechState, setBotTechStates, setActiveBattles, setDate },
    addToast,
    modals.setShowSettingsModal
  );


  const playerCountry = useMemo(() => allCountries.find(c => c.tag === playerCountryTag)!, [allCountries, playerCountryTag]);
  const selectedProvinceData = useMemo(() => provinces.find(p => p.id === selection.selectedProvince) ?? null, [provinces, selection.selectedProvince]);
  const selectedArmyData = useMemo(() => armies.find(a => a.id === selection.selectedArmy) ?? null, [armies, selection.selectedArmy]);
  const diplomacyTargetCountry = useMemo(() => allCountries.find(c => c.tag === modals.diplomacyTarget) ?? null, [allCountries, modals.diplomacyTarget]);
  const diplomacyRelation = useMemo(() => diplomaticRelations.find(r => (r.countryA === playerCountryTag && r.countryB === modals.diplomacyTarget) || (r.countryB === playerCountryTag && r.countryA === modals.diplomacyTarget)) || null, [diplomaticRelations, playerCountryTag, modals.diplomacyTarget]);

  useGameLoop({ provincesRef, countriesRef, armiesRef, recruitmentsRef, warsRef, diplomaticRelationsRef, dateRef, buildingConstructionsRef, playerTechStateRef, botTechStatesRef, aiDifficultyRef, activeBattlesRef, ceilingLogRef, gameLoopRef, playerCountryTag, battleHistory, hasTriggeredEndGame, gameSpeed, isPaused: modals.isPaused, allCountries, setProvinces, setAllCountries, setArmies, setWars, setDiplomaticRelations, setRecruitments, setBuildingConstructions, setPlayerTechState, setBotTechStates, setDate, setActiveBattles, setEndGameType, setGameStats, setHasTriggeredEndGame, setIsPaused: modals.setIsPaused, setBattleHistory, setBattleReport: modals.setBattleReport, addLog, addToast, addAILog, formatGameDate });

  const economy = useEconomyActions({ provinces, playerCountry, playerCountryTag, buildingConstructions, setBuildingConstructions, setAllCountries, recruitments, setRecruitments, addLog, addToast, formatGameDate, dateRef });
  const armyActions = useArmyActions({ selectedArmy: selection.selectedArmy, setSelectedArmy: selection.setSelectedArmy, setSelectedProvince: selection.setSelectedProvince, setIsPanelOpen: selection.setIsPanelOpen, provincesRef, armiesRef, diplomaticRelationsRef, playerCountryTag, setArmies, addLog, addToast, splitSelection: selection.splitSelection, setSplitSelection: selection.setSplitSelection, setShowSplitModal: selection.setShowSplitModal });
  const diplomacy = useDiplomacyActions({ diplomacyTarget: modals.diplomacyTarget, setDiplomacyTarget: modals.setDiplomacyTarget, playerCountry, playerCountryTag, allCountries, setAllCountries, diplomaticRelations, setDiplomaticRelations, wars, setWars, date, addLog });
  const tech = useTechActions({ playerCountry, playerCountryTag, playerTechState, setPlayerTechState, allCountries, setAllCountries, addLog, addToast, playerTechStateRef, setAiDifficulty, setEndGameType, setGameStats, setGameSpeed, setIsPaused: modals.setIsPaused });

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

  const handleCancelResearch = useCallback(() => {
    setPlayerTechState(prev => ({
      ...prev,
      activeResearchId: null,
      researchProgressDays: 0
    }));
    addToast('🔬 Pesquisa cancelada', 'info');
    addLog('Pesquisa cancelada pelo jogador');
  }, [addToast, addLog]);

  const handleCancelFocus = useCallback(() => {
    setPlayerTechState(prev => ({
      ...prev,
      activeFocusId: null,
      focusProgressDays: 0,
    }));

    addToast('🎯 Foco cancelado', 'info');
    addLog('Foco nacional cancelado');
  }, [addToast, addLog]);

  const cheats = useCheats({
    playerCountryTag, setAllCountries, setRecruitments, setBuildingConstructions,
    setArmies, provincesRef, armiesRef, addLog, addToast, setGameSpeed, setDate,
    selectedProvince: selection.selectedProvince
  });

  useEffect(() => {
    window.cheatPanelOpen = showCheatPanel;

    window.cheats = {
      ...cheats,
      togglePanel: () => setShowCheatPanel(p => !p),
    };
  }, [showCheatPanel, cheats]);

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
      />      <div className="game__main">
        <GameMap provinces={provinces} countries={allCountries} armies={armies} recruitments={recruitments} buildingConstructions={buildingConstructions} activeBattles={activeBattles} selectedProvince={selection.selectedProvince} hoveredProvince={selection.hoveredProvince} selectedArmy={selection.selectedArmy} onProvinceHover={selection.handleProvinceHover} onProvinceClick={selection.handleProvinceClick} onArmyClick={selection.handleArmyClick} onProvinceRightClick={armyActions.handleProvinceRightClick} />
        {selection.isPanelOpen && selectedProvinceData && <ProvincePanel province={selectedProvinceData} countries={allCountries} playerCountry={playerCountry} armies={armies} recruitments={recruitments} buildingConstructions={buildingConstructions} onClose={selection.handleClosePanel} onProvinceClick={selection.handleProvinceClick} onBuild={economy.handleBuild} onRecruit={economy.handleRecruit} onCancelRecruitment={economy.handleCancelRecruitment} onCancelBuilding={economy.handleCancelBuilding} />}
        {selectedArmyData && (
          <div className="army-info-panel">
            <div className="army-info-panel__header"><h3>{selectedArmyData.name}</h3><button onClick={() => selection.setSelectedArmy(null)}>✕</button></div>
            <div className="army-info-panel__content">
              <div className="army-info-panel__stat"><span>Total:</span><span>{calculateArmySize(selectedArmyData).toLocaleString()} homens</span></div>
              <div className="army-info-panel__stat"><span>Local:</span><span>{provinces.find(p => p.id === selectedArmyData.location)?.name ?? 'Em movimento'}</span></div>
              {selectedArmyData.destination && <div className="army-info-panel__stat"><span>Destino:</span><span>{provinces.find(p => p.id === selectedArmyData.destination)?.name} ({Math.round(selectedArmyData.movementProgress * 100)}%)</span></div>}
              {selectedArmyData.path.length > 0 && <div className="army-info-panel__stat"><span>Rota:</span><span className="army-info-panel__path">{selectedArmyData.path.map(pid => provinces.find(p => p.id === pid)?.name).join(' → ')}</span></div>}
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
              {selectedArmyData.location &&
                !selectedArmyData.destination &&
                (() => {
                  const friends = getFriendlyArmiesInProvince(
                    armies,
                    selectedArmyData.location!,
                    playerCountryTag
                  ).filter(a => a.id !== selectedArmyData.id);

                  if (friends.length === 0) return null;

                  return (
                    <div className="army-info-panel__actions-section">
                      <strong>🤝 Fundir:</strong>

                      {friends.map(fa => (
                        <button
                          key={fa.id}
                          className="army-info-panel__action-btn"
                          onClick={() => armyActions.handleMergeArmies(fa.id)}
                        >
                          {fa.name}
                        </button>
                      ))}
                    </div>
                  );
                })()}
            </div>
          </div>
        )}
        {diplomacyTargetCountry && <DiplomacyPanel targetCountry={diplomacyTargetCountry} playerCountry={playerCountry} relation={diplomacyRelation} onClose={modals.handleCloseDiplomacy} onImproveRelations={diplomacy.handleImproveRelations} onOfferNonAggression={diplomacy.handleOfferNonAggression} onDeclareWar={diplomacy.handleDeclareWar} />}
        {modals.showWarPanel && <WarPanel wars={wars} playerCountry={playerCountry} allCountries={allCountries} onClose={() => modals.setShowWarPanel(false)} onMakePeace={diplomacy.handleMakePeace} />}
        {modals.battleReport && <BattleReportModal battleResult={modals.battleReport} playerCountry={playerCountry} allCountries={allCountries} onClose={() => { modals.setBattleReport(null); modals.setIsPaused(false); }} />}
        {modals.showBattleHistory && <BattleHistoryModal battleHistory={battleHistory} allCountries={allCountries} onClose={() => modals.setShowBattleHistory(false)} onViewBattle={(b) => { modals.setShowBattleHistory(false); modals.setBattleReport(b); modals.setIsPaused(true); }} />}
        {showFocusModal &&
          <FocusModal
            techState={playerTechState}
            onStartFocus={tech.handleStartFocus}
            onCancelFocus={handleCancelFocus}
            onClose={() => setShowFocusModal(false)}
          />}

        {showResearchModal &&
          <ResearchModal
            playerCountry={playerCountry}
            techState={playerTechState}
            onStartResearch={tech.handleStartResearch}
            onCancelResearch={handleCancelResearch}
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
        {modals.showGovernmentModal && <GovernmentModal playerCountry={playerCountry} onEnactLaw={tech.handleEnactLaw} onClose={() => modals.setShowGovernmentModal(false)} />}
      </div>
      <div className="game__bottom-bar">
        <div className="game__bottom-info"><span className="game__bottom-label">Províncias:</span><span className="game__bottom-value">{playerCountry.provinces.length}</span></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Exércitos:</span><span className="game__bottom-value">{armies.filter(a => a.owner === playerCountryTag).length}</span></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Tropas:</span><span className="game__bottom-value">{armies.filter(a => a.owner === playerCountryTag).reduce((s, a) => s + calculateArmySize(a), 0).toLocaleString()}</span></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Histórico:</span><button className="game__bottom-history-btn" onClick={() => modals.setShowBattleHistory(true)}>📜 {battleHistory.length}</button></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Avisos:</span><button className="game__bottom-notifications-btn" onClick={() => { modals.setShowNotificationModal(true); markAllAsRead(); }}>🔔 {unreadCount > 0 ? <span className="game__bottom-notifications-badge">{unreadCount}</span> : notificationHistory.length}</button></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Log IA:</span><button className="game__bottom-ai-log-btn" onClick={() => modals.setShowAILogModal(true)}>🤖 IA</button></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Guerras:</span><button className="game__bottom-war-btn" onClick={() => modals.setShowWarPanel(true)}>{wars.filter(w => w.attacker === playerCountryTag || w.defender === playerCountryTag).length > 0 ? `⚔️ ${wars.filter(w => w.attacker === playerCountryTag || w.defender === playerCountryTag).length}` : '🕊️ Paz'}</button></div>
        <div className="game__bottom-info"><span className="game__bottom-label">Velocidade:</span><span className="game__bottom-value game__bottom-value--highlight">{gameSpeed === 0 ? '⏸ Pausado' : `▶ x${gameSpeed}`}</span></div>
      </div>
      <button onClick={() => setShowCheatPanel(!showCheatPanel)} style={{ position: 'fixed', top: '100px', right: '1600px', zIndex: 9998, background: '#f39c12', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🎮 CHEAT</button>
      <CheatPanel cheats={cheats} isOpen={showCheatPanel} onClose={() => setShowCheatPanel(false)} />
      <ToastContainer />
    </div>
  );
};

const AppWithProviders: React.FC = () => <ToastProvider><AILogProvider><App /></AILogProvider></ToastProvider>;
export default AppWithProviders;
