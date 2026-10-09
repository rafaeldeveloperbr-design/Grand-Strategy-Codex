/**
 * useArmyActions.ts - CORRIGIDO - FIX EXÉRCITO TRAVADO
 * Permite re-rota e destrava exército parado
 */
import { useCallback } from 'react';

import {
  splitArmyByRegiments,
  splitArmyByHalf,
  transferRegiments,
  mergeArmyGroup,
  type ReorganizationResult,
  stopArmyMovement,
  clearMovementPlan,
} from '../../engine/military';

import { retreatArmyManually } from '../../engine/combat';

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
  const { activeBattlesRef, setActiveBattles, selectedArmy, setSelectedArmy, provincesRef, armiesRef, diplomaticRelationsRef, playerCountryTag, setArmies, addLog, addToast, splitSelection, setSplitSelection, setShowSplitModal } = params;

  const handleProvinceRightClick = useCallback((provinceId: string, append = false) => {
    const ids = params.selectedArmyIds ?? (selectedArmy ? [selectedArmy] : []);
    if (!ids.length) return;
    const provinces = provincesRef.current ?? [];
    const current = armiesRef.current ?? [];
    const single = ids.length === 1 ? current.find(a => a.id === ids[0] && a.owner === playerCountryTag) : undefined;
    if (!append && single?.destination && single.location === provinceId && !single.inCombat) {
      const stopped = clearMovementPlan(single);
      if (stopped !== single) {
        armiesRef.current = current.map(a => a.id === single.id ? stopped : a);
        setArmies(armiesRef.current);
        const message = `${single.name} parou em ${provinces.find(p => p.id === provinceId)?.name ?? provinceId}.`;
        addLog(message); addToast(message, 'info', 'Movimento cancelado');
      }
      return;
    }
    const result = orderArmyGroup(ids, current, playerCountryTag, provinceId, provinces, diplomaticRelationsRef.current ?? [], append ? 'append' : 'move');
    if (!result.updates.size && !result.failures.length) return;
    if (result.updates.size) {
      armiesRef.current = result.armies;
      setArmies(prev => prev.map(a => result.updates.get(a.id) ?? a));
    }
    const destination = provinces.find(p => p.id === provinceId)?.name ?? provinceId;
    const message = append ? `Waypoint ${destination} adicionado para ${result.updates.size} exércitos.${result.failures.length ? ` ${result.failures.length} falharam: ${result.failures.map(f => `${f.name} (${f.reason})`).join('; ')}.` : ''}` : groupMovementFeedback(result.updates.size, destination, result.failures);
    addLog(message); addToast(message, result.failures.length ? 'warning' : 'info', 'Movimento');
  }, [params.selectedArmyIds, selectedArmy, playerCountryTag, addLog, addToast, armiesRef, diplomaticRelationsRef, provincesRef, setArmies]);

  const handleClearRoutes = useCallback(() => {
    const ids = params.selectedArmyIds ?? (selectedArmy ? [selectedArmy] : []);
    const result = orderArmyGroup(ids, armiesRef.current ?? [], playerCountryTag, '', provincesRef.current ?? [], diplomaticRelationsRef.current ?? [], 'clear');
    if (!result.updates.size) return;
    armiesRef.current = result.armies;
    setArmies(prev => prev.map(a => result.updates.get(a.id) ?? a));
    addToast(`Rotas limpas para ${result.updates.size} exércitos.`, 'info', 'Movimento');
  }, [params.selectedArmyIds, selectedArmy, playerCountryTag, armiesRef, provincesRef, diplomaticRelationsRef, setArmies, addToast]);

  const applyReorganization = useCallback((result: ReorganizationResult) => {
    if (!result.success) { addToast(result.reason, 'warning', 'Reorganizar'); return false; }
    armiesRef.current = result.armies;
    setArmies(result.armies);
    setSelectedArmy(result.selectedArmyId);
    setShowSplitModal(false); setSplitSelection(new Set());
    addLog('Regimentos reorganizados.'); addToast('Regimentos reorganizados.', 'success', 'Reorganizar');
    return true;
  }, [addToast, addLog, armiesRef, setArmies, setSelectedArmy, setShowSplitModal, setSplitSelection]);

  const handleReorganize = useCallback((mode: 'split' | 'transfer' | 'merge', indices: number[] = [], targetId?: string, expected?: string) => {
    const ctx = { armies: armiesRef.current ?? [], provinces: provincesRef.current ?? [], playerCountryTag, activeBattles: activeBattlesRef?.current };
    if (mode === 'merge') return applyReorganization(mergeArmyGroup(targetId && selectedArmy ? [selectedArmy, targetId] : params.selectedArmyIds ?? [], ctx));
    if (!selectedArmy) return false;
    return applyReorganization(mode === 'split' ? splitArmyByRegiments(selectedArmy, indices, ctx, expected) : transferRegiments(selectedArmy, targetId ?? '', indices, ctx, expected));
  }, [armiesRef, provincesRef, playerCountryTag, activeBattlesRef, selectedArmy, params.selectedArmyIds, applyReorganization]);

  const handleMergeArmies = useCallback((targetArmyId: string) => handleReorganize('merge', [], targetArmyId), [handleReorganize]);
  const handleSplitHalf = useCallback(() => {
    if (!selectedArmy) return;
    applyReorganization(splitArmyByHalf(selectedArmy, { armies: armiesRef.current ?? [], provinces: provincesRef.current ?? [], playerCountryTag, activeBattles: activeBattlesRef?.current }));
  }, [selectedArmy, applyReorganization, armiesRef, provincesRef, playerCountryTag, activeBattlesRef]);
  const handleSplitCustom = useCallback(() => handleReorganize('split', [...splitSelection]), [handleReorganize, splitSelection]);

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
      activeBattlesRef.current = result.completedBattle ? [...result.activeBattles,result.completedBattle] : result.activeBattles;
      setArmies(result.armies);
      setActiveBattles(activeBattlesRef.current);
      addLog(`Ex?rcito ${army.name} recuou da batalha ${battleId}`);
    },
    [armiesRef, provincesRef, activeBattlesRef, setActiveBattles, playerCountryTag, setArmies, addLog, addToast]
  );

  const handleStopMovement = useCallback((armyId: string) => {
    const army = armiesRef.current?.find(
      a => a.id === armyId
    );

    if (!army) return;

    if (army.owner !== playerCountryTag || army.inCombat) return;
    const stopped = clearMovementPlan(stopArmyMovement(army));

    setArmies(prev =>
      prev.map(a =>
        a.id === armyId ? stopped : a
      )
    );
  }, [armiesRef, setArmies, playerCountryTag]);

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

  return { handleReorganize, handleProvinceRightClick, handleClearRoutes, handleMergeArmies, handleSplitHalf, handleSplitCustom, handleRetreatArmy, handleStopMovement, handleUnstuckAll };
}
