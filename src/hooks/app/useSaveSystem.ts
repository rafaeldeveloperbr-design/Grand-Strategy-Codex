import { useState, useCallback, useEffect } from 'react';
import { loadGame, saveGame, getSaveCompatibilityError, isAutoSaveEnabled, setAutoSaveEnabled, listSaves, deleteSave } from '../../engine/saveSystem';
import { isSaveCompatibleWithActiveMap } from '../../data/map/saveCompatibility';
import { mapMetadata } from '../../data/map';
import type { Province, Country, GameDate, Army, Recruitment, BuildingConstruction, ActiveBattle } from '../../types';
import type { CountryTechState } from '../../types/technology';
import type { DiplomaticRelation, War } from '../../types/diplomacy';

interface SaveRefs {
  provincesRef: { current: Province[] };
  countriesRef: { current: Country[] };
  armiesRef: { current: Army[] };
  warsRef: { current: War[] };
  diplomaticRelationsRef: { current: DiplomaticRelation[] };
  recruitmentsRef: { current: Recruitment[] };
  buildingConstructionsRef: { current: BuildingConstruction[] };
  playerTechStateRef: { current: CountryTechState };
  botTechStatesRef: { current: Map<string, CountryTechState> };
  activeBattlesRef: { current: ActiveBattle[] };
  dateRef: { current: GameDate };
}

interface SaveSetters {
  setPlayerCountryTag?: (tag: string) => void;
  setProvinces: (v: Province[]) => void;
  setAllCountries: (v: Country[]) => void;
  setArmies: (v: Army[]) => void;
  setWars: (v: War[]) => void;
  setDiplomaticRelations: (v: DiplomaticRelation[]) => void;
  setRecruitments: (v: Recruitment[]) => void;
  setBuildingConstructions: (v: BuildingConstruction[]) => void;
  setPlayerTechState: (v: CountryTechState) => void;
  setBotTechStates: (v: Map<string, CountryTechState>) => void;
  setActiveBattles: (v: ActiveBattle[]) => void;
  setDate: (v: GameDate) => void;
}

export function useSaveSystem(
  refs: SaveRefs,
  setters: SaveSetters,
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void,
  setShowSettingsModal?: (v: boolean) => void
) {
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState(() => isAutoSaveEnabled());
  const [saves, setSaves] = useState(() => listSaves());
  const refreshSaves = useCallback(() => setSaves(listSaves()), []);

  // Load autosave - já usando V2
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('newgame') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    const saved = loadGame('autosave');
    if (!saved && getSaveCompatibilityError()) addToast(getSaveCompatibilityError()!, 'error');
    if (saved) {
      if (!isSaveCompatibleWithActiveMap(saved)) {
        addToast('Autosave de outro mapa. South America V1 iniciou uma nova partida.', 'info');
        return;
      }
      setters.setPlayerCountryTag?.(saved.world.countries.some(country => country.tag === saved.technology.player.countryTag)
        ? saved.technology.player.countryTag : mapMetadata.defaultPlayerCountry);
      // V2 PURO - agrupado por domínio
      setters.setProvinces(saved.world.provinces);
      setters.setAllCountries(saved.world.countries);
      setters.setArmies(saved.military.armies);
      setters.setWars(saved.military.wars);
      setters.setActiveBattles(saved.military.activeBattles);
      setters.setRecruitments(saved.military.recruitments);
      setters.setDiplomaticRelations(saved.diplomacy.relations);
      setters.setBuildingConstructions(saved.economy.constructions);
      setters.setPlayerTechState(saved.technology.player);
      setters.setBotTechStates(saved.technology.bots);
      setters.setDate(saved.date);
      addToast('💾 Autosave V2 carregado!', 'success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSave = useCallback((customName: string) => {
    const slot = Date.now().toString();
    if (!saveGame(refs, slot, customName)) { addToast(getSaveCompatibilityError() ?? 'Save incompatível', 'error'); return; }
    refreshSaves();
    addToast(`💾 Save "${customName}" criado!`, 'success');
  }, [refs, refreshSaves, addToast]);

  const handleLoad = useCallback((slotId: string) => {
    const saved = loadGame(slotId);
    if (!saved) {
      addToast(getSaveCompatibilityError() ?? 'Save não encontrado', 'error');
      return;
    }
    if (!isSaveCompatibleWithActiveMap(saved)) {
      addToast('Este save pertence a outro mapa e não pode ser carregado na South America V1.', 'error');
      return;
    }
    setters.setPlayerCountryTag?.(saved.world.countries.some(country => country.tag === saved.technology.player.countryTag)
      ? saved.technology.player.countryTag : mapMetadata.defaultPlayerCountry);
    // V2 PURO
    setters.setProvinces(saved.world.provinces);
    setters.setAllCountries(saved.world.countries);
    setters.setArmies(saved.military.armies);
    setters.setWars(saved.military.wars);
    setters.setActiveBattles(saved.military.activeBattles);
    setters.setRecruitments(saved.military.recruitments);
    setters.setDiplomaticRelations(saved.diplomacy.relations);
    setters.setBuildingConstructions(saved.economy.constructions);
    setters.setPlayerTechState(saved.technology.player);
    setters.setBotTechStates(saved.technology.bots);
    setters.setDate(saved.date);

    addToast(`📂 Save V${saved.version} carregado!`, 'success');
    setShowSettingsModal?.(false);
  }, [setters, addToast, setShowSettingsModal]);

  const handleDelete = useCallback((slotId: string) => {
    if (!confirm(`Apagar save?`)) return;
    deleteSave(slotId);
    refreshSaves();
    addToast('🗑️ Save apagado', 'info');
  }, [refreshSaves, addToast]);

  const handleToggleAutoSave = useCallback((v: boolean) => {
    setAutoSaveEnabled(v);
    setAutoSaveEnabledState(v);
    addToast(v? 'Autosave ligado' : 'Autosave desligado', 'info');
  }, [addToast]);

  return { saves, autoSaveEnabled, refreshSaves, handleManualSave, handleLoad, handleDelete, handleToggleAutoSave };
}
