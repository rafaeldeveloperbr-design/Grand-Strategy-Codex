/**
 * useArmyActions.ts - CORRIGIDO - FIX EXÉRCITO TRAVADO
 * Permite re-rota e destrava exército parado
 */
import { useCallback } from 'react';

import {
  moveArmy,
  mergeArmies,
  splitArmy,
  splitArmyHalf,
  stopArmyMovement,
} from '../../engine/military';

import { calculateArmySize } from '../../engine/combat';

import type { Army, Province } from '../../types';
import type { DiplomaticRelation } from '../../types/diplomacy';
import type { ToastType } from '../../types/toast';

type Params = {
  selectedArmy: string | null;

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
  armiesRef: React.RefObject<Army[]>;

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
  const { selectedArmy, setSelectedArmy, setSelectedProvince, setIsPanelOpen, provincesRef, armiesRef, diplomaticRelationsRef, playerCountryTag, setArmies, addLog, addToast, splitSelection, setSplitSelection, setShowSplitModal } = params;

  const handleProvinceRightClick = useCallback((provinceId: string) => {
    if (!selectedArmy) return;
    const army = armiesRef.current?.find(
      a => a.id === selectedArmy
    );
    if (!army || army.owner !== playerCountryTag) return;

    // Se clica na mesma província onde já está indo, para
    if (army.destination && army.location === provinceId) {
      const updatedArmy = stopArmyMovement(army);
      if (updatedArmy !== army) {
        setArmies(prev =>
          prev.map(a =>
            a.id === army.id ? updatedArmy : a
          )
        );
        const currentProvince = provincesRef.current?.find(
          p => p.id === provinceId
        );
        addLog(`🛑 ${army.name} parou em ${currentProvince?.name ?? provinceId}`);
        addToast(`Exército parou em ${currentProvince?.name ?? provinceId}`, 'info', 'Movimento Cancelado');
      }
      return;
    }

    // CORREÇÃO TRAVAMENTO: Se já tem destino, permite trocar destino (para e move)
    let armyToMove = army;
    if (army.destination) {
      armyToMove = stopArmyMovement(army);
      console.log(`🔧 Exército ${army.name} tinha destino ${army.destination}, parando para re-rota para ${provinceId}`);
    }
    const provinces = provincesRef.current;
    const relations = diplomaticRelationsRef.current;

    if (!provinces || !relations) return;

    const moved = moveArmy(
      armyToMove,
      provinceId,
      provinces,
      relations
    );
    const destinationProvince = provinces.find(
      p => p.id === provinceId
    );
    if (moved) {
      setArmies(prev =>
        prev.map(a => a.id === army.id ? moved : a)
      );

      addLog(
        `🚶 ${army.name} marchando para ${destinationProvince?.name ?? provinceId}`
      );
    } else {
      // Tenta forçar movimento mesmo sem guerra (para teste) - log mais detalhado
      console.warn(
        `❌ Movimento bloqueado: ${army.name} de ${army.location} para ${provinceId}`,
        {
          owner: army.owner,
          destinationOwner: destinationProvince?.owner,

          relations: relations.filter(r =>
            (
              r.countryA === army.owner &&
              r.countryB === destinationProvince?.owner
            ) ||
            (
              r.countryB === army.owner &&
              r.countryA === destinationProvince?.owner
            )
          ),
        }
      );
      addLog(`❌ Movimento não permitido: sem relação de guerra com o destino`);
    }
  }, [selectedArmy, playerCountryTag, addLog, addToast, armiesRef, diplomaticRelationsRef, provincesRef, setArmies]);

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
      setArmies(prev =>
        prev.map(a =>
          a.id === armyId
            ? { ...a, isRetreating: true }
            : a
        )
      );

      addLog(
        `🏃 Exército ${armyId} recuando da batalha ${battleId}`
      );
    },
    [setArmies, addLog]
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
        console.log(`🔧 Destrancando exército ${a.name} travado em ${a.location} -> ${a.destination}`);
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
