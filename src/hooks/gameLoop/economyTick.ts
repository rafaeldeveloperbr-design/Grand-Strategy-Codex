/**
 * economyTick.ts - 148 linhas - PASSO 4.1
 * Recrutamento + Construção + Economia diária
 * Extraído do useGameLoop.ts - 100% compilável
 */
import { calculateArmyMaintenance, processRecruitments, recoverArmy } from '../../engine/military';
import { processConstructions } from '../../engine/buildings';
import { processDailyTick } from '../../engine/economy';
import { getBuildingName, getUnitName } from '../../utils/translations';
import type { Province, Country, Army, Recruitment, BuildingConstruction, War } from '../../types';
import type { GameDate } from '../../types/date';
import type { ToastType } from '../../types/toast';
import type { AIActionType } from '../../types/aiLog';
import type { CountryTechState } from '../../types/technology';
import { calculateTechBonuses } from '../../engine/technology';
import { calculateLawModifiers } from '../../engine/government';
import { getStabilityModifiers } from '../../engine/stability';

type Params = {
  recruitments: Recruitment[];
  armies: Army[];
  countries: Country[];
  provinces: Province[];
  buildingConstructions: BuildingConstruction[];
  wars: War[];
  playerCountryTag: string;
  date: GameDate;
  allCountries: Country[];
  playerTechState: CountryTechState;
  botTechStates: Map<string, CountryTechState>;
  addToast: (
    msg: string,
    type?: ToastType,
    title?: string,
    date?: string
  ) => void;

  addAILog: (
    countryName: string,
    type: AIActionType,
    message: string,
    date: string,
    color?: string
  ) => void;
  addLog: (msg: string) => void;
  formatGameDate: (date: GameDate) => string;
};

export function processEconomyTick(p: Params) {
  let { recruitments, armies, countries, provinces, buildingConstructions } = p;
  const { playerCountryTag, date, addToast, addAILog, formatGameDate } = p;

  // PASSO A: RECRUTAMENTO
  const stateFor = (tag: string) => tag === p.playerCountryTag ? p.playerTechState : p.botTechStates.get(tag);
  const recruitmentMultipliers = new Map(countries.map(c => [c.tag, (stateFor(c.tag) ? calculateTechBonuses(stateFor(c.tag)!).recruitmentTimeMultiplier : 1) * calculateLawModifiers(c.activeLaws).recruitmentTimeMultiplier]));
  const recruitResult = processRecruitments(recruitments, armies, countries, provinces, recruitmentMultipliers);
  armies = recruitResult.armies;
  recruitments = recruitResult.recruitments;

  for (const completed of recruitResult.completedRecruitments) {
    const unitName = getUnitName(completed.unitType);
    const province = provinces.find(pr => pr.id === completed.provinceId);
    const provinceName = province?.name || 'província';
    const dateString = formatGameDate(date);

    if (completed.owner === playerCountryTag) {
      if (completed.count > 1) {
        addToast(`Treinamento de ${completed.count}x ${unitName} concluído em ${provinceName}!`, 'success', 'Tropas Recrutadas', dateString);
      } else {
        addToast(`Treinamento de ${unitName} concluído em ${provinceName}!`, 'success', 'Tropa Recrutada', dateString);
      }
    }

    if (completed.owner !== playerCountryTag) {
      const country = countries.find(c => c.tag === completed.owner);
      if (country && province) {
        addAILog(country.name, 'military', `Recrutamento de ${unitName} concluído em ${provinceName}`, dateString, country.color);
      }
    }
  }

  // PASSO A.5: CONSTRUÇÕES
  const constructionSpeeds = new Map(countries.map(country => [country.tag,
    (stateFor(country.tag) ? calculateTechBonuses(stateFor(country.tag)!).buildTimeMultiplier : 1)
    * calculateLawModifiers(country.activeLaws).constructionSpeedMultiplier
    * getStabilityModifiers(country.resources.stability).constructionSpeed
  ]));
  const constructionResult = processConstructions(buildingConstructions, provinces, constructionSpeeds);
  buildingConstructions = constructionResult.updatedConstructions;

  for (const completed of constructionResult.completedConstructions) {
    const province = provinces.find(pr => pr.id === completed.provinceId);
    if (province) {
      provinces = provinces.map(pr => {
        if (pr.id === completed.provinceId) {
          const existingBuilding = pr.buildings.find(b => b.type === completed.buildingType);
          if (existingBuilding) {
            return {
              ...pr,
              buildings: pr.buildings.map(b => b.type === completed.buildingType ? { ...b, level: b.level + 1, daysRemaining: 0 } : b)
            };
          } else {
            return {
              ...pr,
              buildings: [...pr.buildings, { type: completed.buildingType, level: 1, daysRemaining: 0 }]
            };
          }
        }
        return pr;
      });

      const buildingName = getBuildingName(completed.buildingType);
      const dateString = formatGameDate(date);

      if (province.owner === playerCountryTag) {
        addToast(`Construção de ${buildingName} finalizada em ${province.name}!`, 'success', 'Obra Concluída', dateString);
      }

      if (province.owner !== playerCountryTag) {
        const country = countries.find(c => c.tag === province.owner);
        if (country) {
          addAILog(country.name, 'building', `Construção de ${buildingName} concluída em ${province.name}`, dateString, country.color);
        }
      }
    }
  }

  // PASSO D: ECONOMIA/POPULAÇÃO
  provinces = provinces.map(province => ({
    ...province,
    stationedTroops: armies.filter(army => army.location === province.id).flatMap(army => army.regiments).reduce((sum, regiment) => sum + regiment.strength, 0),
    stationedMilitaryMaintenance: armies.filter(army => army.location === province.id).reduce((sum, army) => sum + calculateArmyMaintenance(army), 0),
  }));
  countries = countries.map(country => {
    const countryProvinces = provinces.filter(pr => pr.owner === country.tag);
    const atWar = p.wars.some(war => war.attacker === country.tag || war.defender === country.tag);
    const state = stateFor(country.tag);
    const { country: updatedCountry, provinces: updatedProvs } = processDailyTick(country, countryProvinces, state ? calculateTechBonuses(state) : undefined, atWar);

    for (const updatedProv of updatedProvs) {
      const idx = provinces.findIndex(pr => pr.id === updatedProv.id);
      if (idx !== -1) {
        provinces = [...provinces];
        provinces[idx] = updatedProv;
      }
    }
    return updatedCountry;
  });
  // Recovery happens once, after production/trade, and consumes canonical
  // manpower, gold and the local iron/tools stocks.
  for (const originalArmy of armies) {
    const armyIndex = armies.findIndex(army => army.id === originalArmy.id);
    const countryIndex = countries.findIndex(country => country.tag === originalArmy.owner);
    const provinceIndex = provinces.findIndex(province => province.id === originalArmy.location);
    if (armyIndex < 0 || countryIndex < 0 || provinceIndex < 0) continue;
    const result = recoverArmy(armies[armyIndex], countries[countryIndex], provinces[provinceIndex],
      armies.filter(army => army.location === provinces[provinceIndex].id));
    armies = armies.map((army, index) => index === armyIndex ? result.army : army);
    countries = countries.map((country, index) => index === countryIndex ? result.country : country);
    provinces = provinces.map((province, index) => index === provinceIndex ? result.province : province);
  }

  return { recruitments, armies, provinces, buildingConstructions, countries };
}
