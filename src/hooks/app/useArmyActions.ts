/**
 * useArmyActions.ts - CORRIGIDO - FIX EXÉRCITO TRAVADO
 * Permite re-rota e destrava exército parado
 */
import { useCallback } from 'react';

import {
  mergeArmies,
  splitArmy,
  splitArmyHalf,
  stopArmyMovement,
} from '../../engine/military';

import { calculateArmySize, retreatArmyManually } from '../../engine/combat';

import type { ActiveBattle, Army, Province } from '../../types';
import type { DiplomaticRelation } from '../../types/diplomacy';
import type { ToastType } from '../../types/toast';
import { orderArmyGroup } from './armyGroupCommands';
import { groupMovementFeedback } from '../../components/militaryPresentation';

type Params = {
  selectedArmy: string | null;
  selectedArmyIds?: string[];

  setSelectedArmy: React.Dispatch<
    React.SetStateAction<string | null>
  >;

  setSelectedProvince: React.Dispatch<
    React.SetStateAction<string | null>
  >;

  setIsPanelOpen: React.Dispatch<
    React.SetStateAction<boolean>
  >;

  provincesRef: React.RefObject<Province[]>;
  armiesRef: React.MutableRefObject<Army[]>;
  activeBattlesRef?: React.MutableRefObject<ActiveBattle[]>;
  setActiveBattles?: React.Dispatch<React.SetStateAction<ActiveBattle[]>>;

  diplomaticRelationsRef: React.RefObject<
    DiplomaticRelation[]
  >;

  playerCountryTag: string;

  setArmies: React.Dispatch<
    React.SetStateAction<Army[]>
  >;

  addLog: (msg: string) => void;

  addToast: (
    message: string,
    type?: ToastType,
    title?: string,
    dateString?: string,
    duration?: number
  ) => void;

  splitSelection: Set<number>;

  setSplitSelection: React.Dispatch<
    React.SetStateAction<Set<number>>
  >;

  setShowSplitModal: React.Dispatch<
    React.SetStateAction<boolean>
  >;
};

export function useArmyActions(params: Params) {
  const { activeBattlesRef, setActiveBattles, selectedArmy, provincesRef, armiesRef, diplomaticRelationsRef, playerCountryTag, setArmies, addLog, addToast, splitSelection, setSplitSelection, setShowSplitModal } = params;

  const handleProvinceRightClick = useCallback((provinceId: string) => {
    const ids = params.selectedArmyIds ?? (selectedArmy ? [selectedArmy] : []);
    if (!ids.length) return;
    const provinces = provincesRef.current ?? [];
    const current = armiesRef.current ?? [];
    const single = ids.length === 1 ? current.find(a => a.id === ids[0] && a.owner === playerCountryTag) : undefined;
    if (single?.destination && single.location === provinceId) {
      const stopped = stopArmyMovement(single);
      if (stopped !== single) {
        armiesRef.current = current.map(a => a.id === single.id ? stopped : a);
        setArmies(armiesRef.current);
        const message = `${single.name} parou em ${provinces.find(p => p.id === provinceId)?.name ?? provinceId}.`;
        addLog(message); addToast(message, 'info', 'Movimento cancelado');
      }
      return;
    }
    const result = orderArmyGroup(ids, current, playerCountryTag, provinceId, provinces, diplomaticRelationsRef.current ?? []);
    if (!result.updates.size && !result.failures.length) return;
    if (result.updates.size) {
      armiesRef.current = result.armies;
      setArmies(prev => prev.map(a => result.updates.get(a.id) ?? a));
    }
    const message = groupMovementFeedback(result.updates.size, provinces.find(p => p.id === provinceId)?.name ?? provinceId, result.failures);
    addLog(message); addToast(message, result.failures.length ? 'warning' : 'info', 'Movimento');
  }, [params.selectedArmyIds, selectedArmy, playerCountryTag, addLog, addToast, armiesRef, diplomaticRelationsRef, provincesRef, setArmies]);

  const handleMergeArmies = useCallback((targetArmyId: string) => {
    if (!selectedArmy) return;
    const army1 = armiesRef.current?.find(
      a => a.id === selectedArmy
    );

    const army2 = armiesRef.current?.find(
      a => a.id === targetArmyId
    );
    if (!army1 || !army2) return;
    if (army1.owner !== playerCountryTag || army2.owner !== playerCountryTag) return;
    if (army1.location !== army2.location) return;
    if (army1.destination || army2.destination) return;
    const merged = mergeArmies(army1, army2);
    setArmies(prev => { const filtered = prev.filter(a => a.id !== army1.id && a.id !== army2.id); return [...filtered, merged]; });
    addLog(`🤝 ${army1.name} + ${army2.name} fundidos (${calculateArmySize(merged).toLocaleString()} homens)`);
  }, [selectedArmy, playerCountryTag, addLog, armiesRef, setArmies]);

  const handleSplitHalf = useCallback(() => {
    if (!selectedArmy) return;
    const army = armiesRef.current?.find(
      a => a.id === selectedArmy
    );
    if (!army || army.owner !== playerCountryTag || army.destination) return;
    const newArmy = splitArmyHalf(army, `${army.name} (Destacamento)`);
    if (!newArmy) return;
    const halfIndex = Math.floor(army.regiments.length / 2);
    const remainingRegiments = army.regiments.slice(halfIndex);
    setArmies(prev => { const filtered = prev.filter(a => a.id !== army.id); return [...filtered, { ...army, regiments: remainingRegiments }, newArmy]; });
    addLog(`✂️ ${army.name} dividido. Novo: ${newArmy.name} (${calculateArmySize(newArmy).toLocaleString()} homens)`);
  }, [selectedArmy, playerCountryTag, addLog, armiesRef, setArmies]);

  const handleSplitCustom = useCallback(() => {
    if (!selectedArmy || splitSelection.size === 0) return;
    const army = armiesRef.current?.find(
      a => a.id === selectedArmy
    );
    if (!army || army.owner !== playerCountryTag || army.destination) return;
    const indices = Array.from(splitSelection);
    const newArmy = splitArmy(army, indices, `${army.name} (Destacamento)`);
    if (!newArmy) return;
    const remainingRegiments = army.regiments.filter(
      (_, idx) => !splitSelection.has(idx)
    );
    setArmies(prev => {
      const filtered = prev.filter(
        a => a.id !== army.id
      );

      return [
        ...filtered,
        {
          ...army,
          regiments: remainingRegiments,
        },
        newArmy,
      ];
    });
    setShowSplitModal(false); setSplitSelection(new Set());
    addLog(`✂️ ${army.name} dividido. Novo: ${newArmy.name} (${calculateArmySize(newArmy).toLocaleString()} homens)`);
  }, [selectedArmy, splitSelection, playerCountryTag, addLog, armiesRef, setArmies, setShowSplitModal, setSplitSelection]);

  const handleRetreatArmy = useCallback(
    (armyId: string, battleId: string) => {
      const army = armiesRef.current?.find(a => a.id === armyId);
      if (!army || army.owner !== playerCountryTag || !army.inCombat || !activeBattlesRef || !setActiveBattles) return;
      const result = retreatArmyManually(armyId, battleId, armiesRef.current ?? [],
        activeBattlesRef.current, provincesRef.current ?? []);
      if (!result.retreatSuccess) {
        addToast('Nenhuma prov?ncia pr?pria segura para retirada.', 'warning', 'Retirada bloqueada');
        return;
      }
      armiesRef.current = result.armies;
      activeBattlesRef.current = result.activeBattles;
      setArmies(result.armies);
      setActiveBattles(result.activeBattles);
      addLog(`Ex?rcito ${army.name} recuou da batalha ${battleId}`);
    },
    [armiesRef, provincesRef, activeBattlesRef, setActiveBattles, playerCountryTag, setArmies, addLog, addToast]
  );

  const handleStopMovement = useCallback((armyId: string) => {
    const army = armiesRef.current?.find(
      a => a.id === armyId
    );

    if (!army) return;

    const stopped = stopArmyMovement(army);

    setArmies(prev =>
      prev.map(a =>
        a.id === armyId ? stopped : a
      )
    );
  }, [armiesRef, setArmies]);

  // NOVA FUNÇÃO: Destrava todos exércitos travados
  const handleUnstuckAll = useCallback(() => {
    setArmies(prev => prev.map(a => {
      if (a.destination && a.movementProgress === 0) {
        return {
          ...a,
          location: a.destination,
          destination: null,
          targetDestination: null,
          movementProgress: 0,
          path: [],
          position: null
        };
      }
      return a;
    }));
    addLog('🔧 Todos exércitos destravados!');
    addToast('Exércitos destravados!', 'success', 'Cheat');
  }, [setArmies, addLog, addToast]);

  return { handleProvinceRightClick, handleMergeArmies, handleSplitHalf, handleSplitCustom, handleRetreatArmy, handleStopMovement, handleUnstuckAll };
}
