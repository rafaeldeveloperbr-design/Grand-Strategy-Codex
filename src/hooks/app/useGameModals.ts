import type { NavalBattle } from '../../types/naval';
import type { AirCombatReport } from '../../types/air';
/**
 * useGameModals.ts - 95 linhas - PASSO 5.2
 * Todos os booleans de modal e handlers de open/close
 */
import { useState, useCallback } from 'react';
import type { CombatResult } from '../../types';

export function useGameModals() {
  const [showWarPanel, setShowWarPanel] = useState(false);
  const [navalReports, setNavalReports] = useState<NavalBattle[]>([]);
  const [airReport, setAirReport] = useState<AirCombatReport | null>(null);
  const [battleReport, setBattleReport] = useState<CombatResult | null>(null);
  const [showBattleHistory, setShowBattleHistory] = useState(false);
  const [showTechModal, setShowTechModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showAILogModal, setShowAILogModal] = useState(false);
  const [showGovernmentModal, setShowGovernmentModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [diplomacyTarget, setDiplomacyTarget] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const handleOpenDiplomacy = useCallback((countryTag: string) => setDiplomacyTarget(countryTag), []);
  const handleCloseDiplomacy = useCallback(() => setDiplomacyTarget(null), []);

  return {
    showWarPanel, setShowWarPanel,
    battleReport, setBattleReport,
    navalReports, setNavalReports,
    airReport, setAirReport,
    showBattleHistory, setShowBattleHistory,
    showTechModal, setShowTechModal,
    showNotificationModal, setShowNotificationModal,
    showAILogModal, setShowAILogModal,
    showGovernmentModal, setShowGovernmentModal,
    showSettingsModal, setShowSettingsModal,
    diplomacyTarget, setDiplomacyTarget,
    isPaused, setIsPaused,
    handleOpenDiplomacy, handleCloseDiplomacy
  };
}
