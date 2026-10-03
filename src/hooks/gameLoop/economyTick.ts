/**
 * economyTick.ts - 148 linhas - PASSO 4.1
 * Recrutamento + Construção + Economia diária
 * Extraído do useGameLoop.ts - 100% compilável
 */
import { processRecruitments } from '../../engine/military';
import { processConstructions } from '../../engine/buildings';
import { processDailyTick } from '../../engine/economy';
import { getBuildingName, getUnitName } from '../../utils/translations';
import type { Province, Country, Army, Recruitment, BuildingConstruction, War } from '../../types';
import type { GameDate } from '../../types/date';
import type { ToastType } from '../../types/toast';
import type { AIActionType } from '../../types/aiLog';

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
  provinces = provinces.map(province => ({
    ...province,
    stationedTroops: armies.filter(army => army.location === province.id).flatMap(army => army.regiments).reduce((sum, regiment) => sum + regiment.strength, 0),
  }));
  countries = countries.map(country => {
    const countryProvinces = provinces.filter(pr => pr.owner === country.tag);
    const atWar = p.wars.some(war => war.attacker === country.tag || war.defender === country.tag);
    const { country: updatedCountry, provinces: updatedProvs } = processDailyTick(country, countryProvinces, undefined, atWar);

    for (const updatedProv of updatedProvs) {
      const idx = provinces.findIndex(pr => pr.id === updatedProv.id);
      if (idx !== -1) {
        provinces = [...provinces];
        provinces[idx] = updatedProv;
      }
    }
    return updatedCountry;
  });
 // DEBUG TEMPORÁRIO
  console.log(`[ECONOMY END] ${formatGameDate(date)}`);

  console.table(
    provinces
      .filter(province => province.owner === playerCountryTag)
      .map(province => ({
        provincia: province.name,

        food: province.market?.goods.food.stock ?? 0,
        foodProd: province.market?.goods.food.production ?? 0,
        foodDemand: province.market?.goods.food.demand ?? 0,
        foodCons: province.market?.goods.food.consumption ?? 0,
        foodImp: province.market?.goods.food.imported ?? 0,
        foodExp: province.market?.goods.food.exported ?? 0,

        wood: province.market?.goods.wood.stock ?? 0,
        woodProd: province.market?.goods.wood.production ?? 0,
        woodDemand: province.market?.goods.wood.demand ?? 0,
        woodCons: province.market?.goods.wood.consumption ?? 0,
        woodImp: province.market?.goods.wood.imported ?? 0,
        woodExp: province.market?.goods.wood.exported ?? 0,

        iron: province.market?.goods.iron.stock ?? 0,
        ironProd: province.market?.goods.iron.production ?? 0,
        ironCons: province.market?.goods.iron.consumption ?? 0,
        ironImp: province.market?.goods.iron.imported ?? 0,
        ironExp: province.market?.goods.iron.exported ?? 0,

        tools: province.market?.goods.tools.stock ?? 0,
        toolsProd: province.market?.goods.tools.production ?? 0,
        toolsCons: province.market?.goods.tools.consumption ?? 0,
        toolsImp: province.market?.goods.tools.imported ?? 0,
        toolsExp: province.market?.goods.tools.exported ?? 0,

        poderCompra: province.market?.purchasingPower ?? 0,
      }))
  );

  return { recruitments, armies, provinces, buildingConstructions, countries };
}