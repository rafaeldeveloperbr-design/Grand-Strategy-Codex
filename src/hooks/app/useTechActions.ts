import { useCallback } from 'react';
import { startNationalFocus, startTechnologyResearch } from '../../engine/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../../data/technology';
import { LAWS } from '../../constants/laws';
import { enactLaw } from '../../engine/government';
import type { LawCategory } from '../../types/government';
import type { Country } from '../../types';
import type { CountryTechState } from '../../types/technology';
import type { ToastType } from '../../types/toast';
import type { AIDifficulty } from '../../types/difficulty';
import type { EndGameType, GameStats } from '../../engine/gameConditions';


export function useTechActions(params: {
  playerCountry: Country;
  playerCountryTag: string;
  playerTechState: CountryTechState;
  setPlayerTechState: React.Dispatch<
    React.SetStateAction<CountryTechState>
  >;
  allCountries: Country[];
  setAllCountries: React.Dispatch<React.SetStateAction<Country[]>>;
  addLog: (msg: string) => void;
  addToast: (message: string, type?: ToastType, title?: string, dateString?: string, duration?: number) => void;
  playerTechStateRef: React.MutableRefObject<CountryTechState>;
  setAiDifficulty: React.Dispatch<React.SetStateAction<AIDifficulty>>;
  setEndGameType: React.Dispatch<React.SetStateAction<EndGameType>>;
  setGameStats: React.Dispatch<React.SetStateAction<GameStats | null>>;
  setGameSpeed: React.Dispatch<React.SetStateAction<number>>;
  setIsPaused: React.Dispatch<React.SetStateAction<boolean>>;
  playerAtWar: boolean;
}) {
  const { playerCountry, playerCountryTag, playerTechState, setPlayerTechState, setAllCountries, addLog, addToast, playerTechStateRef, setAiDifficulty, setEndGameType, setGameSpeed, setIsPaused, playerAtWar } = params;

  const handleStartFocus = useCallback((focusId: string) => {
    if (!focusId || !playerTechState) return;
    const updated = startNationalFocus(playerTechState, focusId);
    if (updated) {
      setPlayerTechState(updated);
      if (playerTechStateRef) playerTechStateRef.current = updated;
      const focus = NATIONAL_FOCUSES.find(f => f.id === focusId);
      if (focus) addLog(`🎯 Foco iniciado: ${focus.title}`);
    }
  }, [playerTechState, addLog, setPlayerTechState, playerTechStateRef]);

  const handleStartResearch = useCallback((techId: string) => {
    if (!techId) return;

    const tech = TECHNOLOGIES.find(t => t.id === techId);
    if (!tech) return;

    if (playerCountry.resources.gold < tech.costGold) {
      addLog(`❌ Ouro insuficiente para pesquisar ${tech.title}`);
      return;
    }

    const { techState: updated, cost } = startTechnologyResearch(
      playerTechState,
      techId,
      playerCountry
    );

    if (updated) {
      setAllCountries(prev =>
        prev.map(c =>
          c.tag === playerCountryTag
            ? {
              ...c,
              resources: {
                ...c.resources,
                gold: c.resources.gold - cost,
              },
            }
            : c
        )
      );

      setPlayerTechState(updated);
      playerTechStateRef.current = updated;

      addLog(`🔬 Pesquisa iniciada: ${tech.title} (💰 ${cost})`);
    }
  }, [
    playerTechState,
    playerCountry,
    playerCountryTag,
    addLog,
    setAllCountries,
    setPlayerTechState,
    playerTechStateRef,
  ]);

  const handleEndGameContinue = useCallback(() => { setEndGameType(null); setIsPaused(false); }, [setEndGameType, setIsPaused]);
  const handleEndGameRestart = useCallback(() => window.location.reload(), []);
  const handleDifficultyChange = useCallback((newDifficulty: AIDifficulty) => { setAiDifficulty(newDifficulty); addToast(`Dificuldade: ${newDifficulty}`, 'info', 'Configuração'); }, [setAiDifficulty, addToast]);
  const handleEnactLaw = useCallback((category: LawCategory, lawId: string) => {
    const law = LAWS[lawId];
    if (!law || law.category !== category) return;
    const result = enactLaw(playerCountry.activeLaws, lawId, playerCountry.resources.gold, {atWar:playerAtWar});
    if (!result.allowed) { addToast(result.reason ?? 'Mudança bloqueada', 'error', 'Lei bloqueada'); return; }
    setAllCountries(prev => prev.map(c => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: result.gold }, activeLaws: result.activeLaws } : c));
    addToast(`Lei "${law.name}" promulgada!`, 'success', 'Nova Lei');
  }, [playerCountry, playerCountryTag, playerAtWar, addToast, setAllCountries]);
  const handleSpeedChange = useCallback((speed: number) => setGameSpeed(speed), [setGameSpeed]);

  return { handleStartFocus, handleStartResearch, handleEndGameContinue, handleEndGameRestart, handleDifficultyChange, handleEnactLaw, handleSpeedChange };
}
