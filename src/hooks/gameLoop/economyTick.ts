/**
 * economyTick.ts - 148 linhas - PASSO 4.1
 * Recrutamento + Construção + Economia diária
 * Extraído do useGameLoop.ts - 100% compilável
 */
import { processRecruitments } from '../../engine/military';
import { processConstructions } from '../../engine/buildings';
import { processDailyTick } from '../../engine/economy';
import { getBuildingName, getUnitName } from '../../utils/translations';
import type { Province, Country, Army, Recruitment, BuildingConstruction } from '../../types';
import type { GameDate } from '../../types/date';
import type { ToastType } from '../../types/toast';
import type { AIActionType } from '../../types/aiLog';

type Params = {
  recruitments: Recruitment[];
  armies: Army[];
  countries: Country[];
  provinces: Province[];
  buildingConstructions: BuildingConstruction[];
  playerCountryTag: string;
  date: GameDate;
  allCountries: Country[];
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
  const recruitResult = processRecruitments(recruitments, armies, countries, provinces);
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
  const constructionResult = processConstructions(buildingConstructions, provinces);
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
  countries = countries.map(country => {
    const countryProvinces = provinces.filter(pr => pr.owner === country.tag);
    const { country: updatedCountry, provinces: updatedProvs } = processDailyTick(country, countryProvinces);

    for (const updatedProv of updatedProvs) {
      const idx = provinces.findIndex(pr => pr.id === updatedProv.id);
      if (idx !== -1) {
        provinces = [...provinces];
        provinces[idx] = updatedProv;
      }
    }
    return updatedCountry;
  });

  return { recruitments, armies, provinces, buildingConstructions, countries };
}
