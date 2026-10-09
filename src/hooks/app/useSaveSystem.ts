import type { AirState } from '../../types/air';
import { useState, useCallback } from 'react';
import { loadGame, saveGame, getSaveCompatibilityError, isAutoSaveEnabled, setAutoSaveEnabled, listSaves, deleteSave } from '../../engine/saveSystem';
import { isSaveCompatibleWithActiveMap } from '../../data/map/saveCompatibility';
import { mapMetadata } from '../../data/map';
import type { Province, Country, GameDate, Army, Recruitment, BuildingConstruction, ActiveBattle, CombatResult } from '../../types';
import type { CountryTechState } from '../../types/technology';
import type { DiplomaticRelation, War } from '../../types/diplomacy';
import type { NavalState } from '../../types/naval';

interface SaveRefs {
  battleHistoryRef?: {current: CombatResult[]};
  airStateRef?: { current: AirState };
  navalStateRef?: { current: NavalState };
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
  setBattleHistory?: (v: CombatResult[]) => void;
  setAirState?: (v: AirState) => void;
  setNavalState?: (v: NavalState) => void;
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
      addToast(`Este save pertence a outro mapa e não pode ser carregado em ${mapMetadata.name}.`, 'error');
      return;
    }
    const playerTag = saved.technology.player.countryTag;
    if (!saved.world.countries.some(country => country.tag === playerTag)) {
      addToast('País do jogador ausente ou inválido no save.', 'error');
      return;
    }
    setters.setPlayerCountryTag?.(playerTag);
    const air = saved.air ?? { wings: [], engagements: [] };
    if (refs.airStateRef) refs.airStateRef.current = air;
    setters.setAirState?.(air);
    const naval = saved.naval ?? { fleets: [], battles: [] };
    if (refs.navalStateRef) refs.navalStateRef.current = naval;
    setters.setNavalState?.(naval);
    // V2 PURO
    setters.setProvinces(saved.world.provinces);
    setters.setAllCountries(saved.world.countries);
    setters.setArmies(saved.military.armies);
    setters.setWars(saved.military.wars);
    setters.setActiveBattles(saved.military.activeBattles);
    const uniqueHistory = (saved.military.battleHistory ?? []).filter((battle,index,all)=>!battle.id || all.findIndex(b=>b.id===battle.id)===index);
    setters.setBattleHistory?.(uniqueHistory);
    setters.setRecruitments(saved.military.recruitments);
    setters.setDiplomaticRelations(saved.diplomacy.relations);
    setters.setBuildingConstructions(saved.economy.constructions);
    setters.setPlayerTechState(saved.technology.player);
    setters.setBotTechStates(saved.technology.bots);
    setters.setDate(saved.date);

    addToast(`📂 Save V${saved.version} carregado!`, 'success');
    setShowSettingsModal?.(false);
  }, [setters, addToast, setShowSettingsModal, refs.navalStateRef, refs.airStateRef]);

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
