/**
 * useGameSelection.ts - 85 linhas - PASSO 5.1
 * Seleção de província, exército, hover e painel
 */
import { useState, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import type { Province, Army } from '../../types';

const controllable = (army: Army, tag: string) => army.owner === tag && army.regiments.some(r => r.strength > 0);

export function useGameSelection(
  playerCountryTag: string,
  provincesRef: RefObject<Province[]>,
  armiesRef: RefObject<Army[]>,
  handleOpenDiplomacy: (tag: string) => void,
  armies: Army[] = armiesRef.current ?? []
) {
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedArmyIds, setSelectedArmyIds] = useState<string[]>([]);
  const selectedArmy = selectedArmyIds[0] ?? null;
  const setSelectedArmy = useCallback((value: React.SetStateAction<string | null>) => {
    setSelectedArmyIds(prev => {
      const id = typeof value === 'function' ? value(prev[0] ?? null) : value;
      return id && armiesRef.current?.some(a => a.id === id && controllable(a, playerCountryTag)) ? [id] : [];
    });
  }, [armiesRef, playerCountryTag]);
  const clearArmySelection = useCallback(() => setSelectedArmyIds([]), []);
  useEffect(() => {
    setSelectedArmyIds(prev => {
      const next = prev.filter(id => armies.some(a => a.id === id && controllable(a, playerCountryTag)));
      return next.length === prev.length ? prev : next;
    });
  }, [armies, playerCountryTag]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') clearArmySelection(); };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [clearArmySelection]);
  const toggleArmySelection = useCallback((id: string) => {
    if (!armiesRef.current?.some(a => a.id === id && controllable(a, playerCountryTag))) return;
    setSelectedArmyIds(prev => prev.includes(id) ? prev.filter(value => value !== id) : [...prev, id]);
    setSelectedProvince(null); setIsPanelOpen(false);
  }, [armiesRef, playerCountryTag]);
  const toggleStackSelection = useCallback((ids: string[]) => {
    const valid = [...new Set(ids)].filter(id =>
      armiesRef.current?.some(
        a => a.id === id && controllable(a, playerCountryTag)
      )
    );

    if (!valid.length) return;

    setSelectedArmyIds(prev =>
      valid.every(id => prev.includes(id))
        ? prev.filter(id => !valid.includes(id))
        : valid
    );

    setSelectedProvince(null);
    setIsPanelOpen(false);
  }, [armiesRef, playerCountryTag]);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitSelection, setSplitSelection] = useState<Set<number>>(new Set());

  const handleProvinceClick = useCallback((provinceId: string) => {
    const province = provincesRef.current?.find(
      p => p.id === provinceId
    );
    if (province && province.owner !== playerCountryTag) {
      handleOpenDiplomacy(province.owner);
    } else {
      setSelectedProvince(provinceId);
      setIsPanelOpen(true);
      setSelectedArmy(null);
    }
  }, [playerCountryTag, provincesRef, handleOpenDiplomacy, setSelectedArmy]);

  const handleProvinceHover = useCallback((provinceId: string | null) => setHoveredProvince(provinceId), []);
  const handleClosePanel = useCallback(() => { setIsPanelOpen(false); setSelectedProvince(null); }, []);

  const handleArmyClick = useCallback((armyId: string) => {
    const army = armiesRef.current?.find(
      a => a.id === armyId
    );
    if (army && army.owner === playerCountryTag) {
      setSelectedArmy(armyId);
      setSelectedProvince(null);
      setIsPanelOpen(false);
    }
  }, [playerCountryTag, armiesRef, setSelectedArmy]);

  const toggleSplitRegiment = useCallback((index: number) => {
    setSplitSelection(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  return {
    selectedProvince, setSelectedProvince,
    hoveredProvince, setHoveredProvince,
    isPanelOpen, setIsPanelOpen,
    selectedArmy, setSelectedArmy,
    selectedArmyIds, toggleArmySelection, toggleStackSelection, clearArmySelection,
    showSplitModal, setShowSplitModal,
    splitSelection, setSplitSelection,
    handleProvinceClick, handleProvinceHover, handleClosePanel, handleArmyClick, toggleSplitRegiment
  };
}
