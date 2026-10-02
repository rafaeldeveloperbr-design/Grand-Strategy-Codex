/**
 * useCheats.ts - CHEAT PARA TESTE RÁPIDO - 0 
 */
import { useCallback, useEffect } from 'react';
import type { Army, Province, Country, Recruitment, BuildingConstruction, } from '../../types';
import type { ToastType } from '../../types/toast';

type CheatAPI = {
  addGold: (n: number) => void;
  addManpower: (n: number) => void;
  addAllResources: () => void;
  instantRecruit: () => void;
  instantBuild: () => void;
  spawnArmy: (provinceId?: string) => void;
  killAllEnemiesInProvince: () => void;
  winBattles: () => void;
  fastForward: (days?: number) => void;
  godMode: () => void;
  togglePanel?: () => void;
}

declare global {
  interface Window {
    cheats?: CheatAPI;
    cheatPanelOpen?: boolean;
    cheatPanel?: { isOpen: boolean };
  }
}

type Params = {
  playerCountryTag: string;
  setAllCountries: React.Dispatch<React.SetStateAction<Country[]>>;
  setRecruitments: React.Dispatch<
    React.SetStateAction<Recruitment[]>
  >;
  setBuildingConstructions: React.Dispatch<
    React.SetStateAction<BuildingConstruction[]>
  >; 
  setArmies: React.Dispatch<React.SetStateAction<Army[]>>;
  provincesRef: React.MutableRefObject<Province[]>;
  armiesRef: React.MutableRefObject<Army[]>;
  addLog: (msg: string) => void;
  addToast: (message: string, type?: ToastType, title?: string, dateString?: string, duration?: number) => void; setGameSpeed: (n: number) => void;
  setDate: React.Dispatch<React.SetStateAction<{ day: number; month: number; year: number }>>;
  selectedProvince: string | null;
};

export function useCheats(params: Params) {
  const {
    playerCountryTag, setAllCountries, setRecruitments, setBuildingConstructions,
    setArmies, provincesRef, addLog, addToast, setGameSpeed, setDate,
    selectedProvince
  } = params;

  const addGold = useCallback((amount: number) => {
    setAllCountries((prev) => prev.map((c) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: c.resources.gold + amount } } : c));
    addToast(`💰 +${amount} Ouro (CHEAT)`, 'success', 'Cheat');
    addLog(`💰 CHEAT: +${amount} ouro`);
  }, [playerCountryTag, setAllCountries, addToast, addLog]);

  const addManpower = useCallback((amount: number) => {
    setAllCountries((prev) => prev.map((c) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, manpower: c.resources.manpower + amount } } : c));
    addToast(`👥 +${amount} Manpower (CHEAT)`, 'success', 'Cheat');
  }, [playerCountryTag, setAllCountries, addToast]);

  const addAllResources = useCallback(() => {
    setAllCountries((prev) => prev.map((c) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: c.resources.gold + 10000, manpower: c.resources.manpower + 10000, prestige: (c.resources.prestige || 0) + 100, stability: 100 } } : c));
    addToast(`💎 Recursos infinitos! (CHEAT)`, 'success', 'Cheat');
  }, [playerCountryTag, setAllCountries, addToast]);

  const instantRecruit = useCallback(() => {
    setRecruitments((prev) => prev.map((r) => ({ ...r, daysRemaining: 0 })));
    addToast(`⚡ Recrutamentos instantâneos! (CHEAT)`, 'success', 'Cheat');
  }, [setRecruitments, addToast]);

  const instantBuild = useCallback(() => {
    setBuildingConstructions((prev) => prev.map((b) => ({ ...b, daysRemaining: 0 })));
    addToast(`🏗️ Construções instantâneas! (CHEAT)`, 'success', 'Cheat');
  }, [setBuildingConstructions, addToast]);

  const spawnArmy = useCallback((provinceId?: string) => {
    const targetProvince = provinceId || selectedProvince || provincesRef.current[0]?.id;
    if (!targetProvince) return;
    const newArmy: Army = {
      id: `cheat_army_${Date.now()}`,
      owner: playerCountryTag,
      name: `Exército CHEAT`,
      regiments: [
        { type: 'infantry', strength: 5000, morale: 100 },
        { type: 'cavalry', strength: 5000, morale: 100 },
        { type: 'artillery', strength: 5000, morale: 100 },
      ],
      location: targetProvince,
      destination: null,
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: 1.0,
      position: null,
      path: [],
      targetArmyId: null,
      targetProvinceId: null,
    } as unknown as Army;
    setArmies((prev) => [...prev, newArmy]);
    addToast(`🪖 Exército spawnado em ${provincesRef.current.find((p) => p.id === targetProvince)?.name} (CHEAT)`, 'success', 'Cheat');
  }, [playerCountryTag, selectedProvince, provincesRef, setArmies, addToast]);

  const killAllEnemiesInProvince = useCallback(() => {
    if (!selectedProvince) return;
    setArmies((prev) => prev.filter((a) => !(a.location === selectedProvince && a.owner !== playerCountryTag)));
    addToast(`💀 Inimigos em ${selectedProvince} eliminados! (CHEAT)`, 'success', 'Cheat');
  }, [selectedProvince, setArmies, addToast, playerCountryTag]);

  const winBattles = useCallback(() => {
    addToast(`🏆 Todas batalhas vencidas! (CHEAT)`, 'success', 'Cheat');
  }, [addToast]);

  const fastForward = useCallback((days: number = 30) => {
    setDate((prev) => {
      let { day, month, year } = prev;
      day += days;
      while (day > 30) { day -= 30; month++; }
      while (month > 12) { month -= 12; year++; }
      return { day, month, year };
    });
    setGameSpeed(5);
    addToast(`⏩ Avançou ${days} dias (CHEAT)`, 'success', 'Cheat');
  }, [setDate, setGameSpeed, addToast]);

  const godMode = useCallback(() => {
    setAllCountries((prev) => prev.map((c) => c.tag === playerCountryTag ? {
      ...c,
      resources: { ...c.resources, gold: 999999, manpower: 999999, prestige: 999, stability: 100 },
      economy: { ...c.economy, gdp: 99999 }
    } : c));
    setArmies((prev) => prev.map((a) => a.owner === playerCountryTag ? {
      ...a,
      regiments: a.regiments.map((r) => ({ ...r, strength: r.strength, morale: 100 }))
    } : a));
    addToast(`👑 GOD MODE ATIVADO! (CHEAT)`, 'success', 'Cheat');
  }, [playerCountryTag, setAllCountries, setArmies, addToast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        window.cheats?.togglePanel?.();
      }
      if (window.cheatPanelOpen) {
        if (e.key === '1') addAllResources();
        if (e.key === '2') instantRecruit();
        if (e.key === '3') instantBuild();
        if (e.key === '4') spawnArmy();
        if (e.key === '5') fastForward(30);
        if (e.key === '6') godMode();
        if (e.key === '7') killAllEnemiesInProvince();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addAllResources, instantRecruit, instantBuild, spawnArmy, fastForward, godMode, killAllEnemiesInProvince]);

  useEffect(() => {
    window.cheats = {
      addGold, addManpower, addAllResources, instantRecruit, instantBuild,
      spawnArmy, killAllEnemiesInProvince, fastForward, godMode, winBattles
    };
    console.log('🎮 CHEATS ATIVADOS! Digite: cheats.addGold(10000), cheats.godMode() | Ctrl+Shift+C');
  }, [addGold, addManpower, addAllResources, instantRecruit, instantBuild, spawnArmy, killAllEnemiesInProvince, fastForward, godMode, winBattles]);

  return {
    addGold, addManpower, addAllResources, instantRecruit, instantBuild,
    spawnArmy, killAllEnemiesInProvince, winBattles, fastForward, godMode
  };
}