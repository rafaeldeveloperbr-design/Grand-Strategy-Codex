/**
 * useEconomyActions.ts - 0 
 */
import { useCallback } from 'react';
import { startBuilding, cancelBuilding } from '../../engine/buildings';
import { cancelRecruitment, queueRecruitment } from '../../engine/military';
import type { BuildingType, UnitType, Recruitment, Province, Country, BuildingConstruction, GameDate } from '../../types';

import type { ToastType } from '../../types/toast';
import type { CountryTechState } from '../../types/technology';

export function useEconomyActions(params: {
  provinces: Province[];
  playerCountry: Country & { activeLaws?: { conscription?: string } };
  playerCountryTag: string;
  buildingConstructions: BuildingConstruction[];

  setBuildingConstructions: React.Dispatch<
    React.SetStateAction<BuildingConstruction[]>
  >;
  setProvinces: React.Dispatch<React.SetStateAction<Province[]>>;
  setAllCountries: React.Dispatch<React.SetStateAction<Country[]>>;
  setRecruitments: React.Dispatch<React.SetStateAction<Recruitment[]>>;
  addLog: (msg: string) => void;
  addToast: (message: string, type?: ToastType, title?: string, dateString?: string, duration?: number) => void; formatGameDate: (d: GameDate) => string;
  dateRef: React.MutableRefObject<GameDate>;
  recruitments: Recruitment[];
  playerTechState: CountryTechState;
}) {
  const { provinces, playerCountry, playerCountryTag, buildingConstructions, setBuildingConstructions, setProvinces, setAllCountries, setRecruitments, addLog, addToast, formatGameDate, dateRef } = params;

  const handleBuild = useCallback((provinceId: string, buildingType: BuildingType) => {
    const province = provinces.find((p) => p.id === provinceId);
    if (!province || province.owner !== playerCountryTag) return;
    const result = startBuilding(
  province,
  provinces,
  playerCountryTag,
  buildingType,
  playerCountry.resources.gold,
  buildingConstructions
);

if (result.success) {
  setBuildingConstructions(result.constructions);
  setProvinces(result.provinces);

  setAllCountries(prev =>
    prev.map(c =>
      c.tag === playerCountryTag
        ? {
            ...c,
            resources: {
              ...c.resources,
              gold: result.gold,
            },
          }
        : c
    )
  );
} else {
      addToast(result.reason, 'error', 'Construção bloqueada');
    }
  }, [provinces, playerCountryTag, playerCountry.resources.gold, buildingConstructions, addToast, setAllCountries, setBuildingConstructions, setProvinces]);

  const handleCancelBuilding = useCallback((constructionId: string) => {
    const result = cancelBuilding(constructionId, buildingConstructions, playerCountry.resources.gold);
    setBuildingConstructions(result.updatedConstructions);
    setAllCountries((prev) => prev.map((c) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: result.newGold } } : c));
    if (result.refundedGold > 0) {
      addToast(`Construção cancelada. +${result.refundedGold} Ouro reembolsado!`, 'success', 'Reembolso', formatGameDate(dateRef.current));
    }
  }, [buildingConstructions, playerCountry.resources.gold, playerCountryTag, addToast, formatGameDate, dateRef, setAllCountries, setBuildingConstructions]);

  const handleRecruit = useCallback((provinceId: string, unitType: UnitType) => {
    const province = provinces.find((p) => p.id === provinceId);
    if (!province || province.owner !== playerCountryTag) return;
    const result = queueRecruitment(unitType, { country: playerCountry, province, technology: params.playerTechState });
    if (!result.success) { addLog(`❌ ${result.reason}`); return; }
    setProvinces(prev => prev.map(item => item.id === provinceId ? result.province : item));
    setAllCountries(prev => prev.map(country => country.tag === playerCountryTag ? result.country : country));
    setRecruitments(prev => [...prev, result.recruitment]);
  }, [provinces, playerCountryTag, playerCountry, params.playerTechState, addLog, setAllCountries, setRecruitments, setProvinces]);

  const handleCancelRecruitment = useCallback((recruitmentId: string) => {
    const rec = params.recruitments.find((r) => r.id === recruitmentId);
    if (!rec) return;
    const result = cancelRecruitment(recruitmentId, params.recruitments, playerCountry.resources.gold);
    setRecruitments(result.updatedRecruitments);
    setAllCountries((prev) => prev.map((c) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: result.newGold } } : c));
    if (result.refundedGold > 0) addToast(`Recrutamento cancelado. +${result.refundedGold} Ouro reembolsado!`, 'success', 'Reembolso', formatGameDate(dateRef.current));
  }, [params.recruitments, playerCountry, playerCountryTag, addToast, formatGameDate, dateRef, setAllCountries, setRecruitments]);

  return { handleBuild, handleCancelBuilding, handleRecruit, handleCancelRecruitment };
}
