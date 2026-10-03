import { Country, Province, BuildingType, UnitType, Recruitment, BuildingConstruction } from '../../types';
import { CountryTechState } from '../../types/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../../data/technology';

import { startBuilding } from '../buildings';
import { getPopulationCapacity } from '../population';
import { getStorageCapacity, normalizeMarket } from '../market';
import { UNIT_DEFINITIONS } from '../../data/units';
import { getBuildingName, getUnitName } from '../../utils/translations';

const ALL_FINITE = (market: ReturnType<typeof normalizeMarket>) => Object.values(market.goods).every(g => Number.isFinite(g.stock));

export function processAIEconomicDecisions(
  country: Country,
  provinces: Province[],
  techState: CountryTechState,
  buildingConstructions: BuildingConstruction[],
  recruitments: Recruitment[],
  dateString: string,
  canRecruitMilitary: boolean = true
): {
  techState: CountryTechState;
  buildingConstructions: BuildingConstruction[];
  recruitments: Recruitment[];
  country: Country;
  provinces: Province[],
  logs: Array<{ actionType: 'building' | 'military' | 'tech' | 'focus'; message: string }>;
} {
  const logs: Array<{ actionType: 'building' | 'military' | 'tech' | 'focus'; message: string }> = [];
  let updatedTechState = { ...techState };
  let updatedConstructions = [...buildingConstructions];
  let updatedRecruitments = [...recruitments];
  let updatedCountry = { ...country };
  let updatedProvinces = [...provinces];

  // 1. SELEÇÃO DE FOCO NACIONAL
  if (!updatedTechState.activeFocusId) {
    const availableFocuses = NATIONAL_FOCUSES.filter(focus => {
      if (focus.completed) return false;
      if (updatedTechState.completedFocuses.includes(focus.id)) return false;

      if (focus.prerequisites && focus.prerequisites.length > 0) {
        return focus.prerequisites.every(prereqId =>
          updatedTechState.completedFocuses.includes(prereqId)
        );
      }
      return true;
    });

    if (availableFocuses.length > 0) {
      const selectedFocus = availableFocuses[0];
      updatedTechState = {
        ...updatedTechState,
        activeFocusId: selectedFocus.id,
        focusProgressDays: 0,
      };

      logs.push({
        actionType: 'focus',
        message: `Selecionou o Foco Nacional: ${selectedFocus.title}`,
      });
    }
  }

  // 2. PESQUISA TECNOLÓGICA
  if (!updatedTechState.activeResearchId) {
    const availableTechs = TECHNOLOGIES.filter(tech => {
      if (tech.researched) return false;
      if (updatedTechState.completedTechnologies.includes(tech.id)) return false;

      if (tech.prerequisites && tech.prerequisites.length > 0) {
        return tech.prerequisites.every(prereqId =>
          updatedTechState.completedTechnologies.includes(prereqId)
        );
      }
      return true;
    });

    const affordableTech = availableTechs.find(t => updatedCountry.resources.gold >= t.costGold);

    if (affordableTech) {
      updatedCountry = {
        ...updatedCountry,
        resources: {
          ...updatedCountry.resources,
          gold: updatedCountry.resources.gold - affordableTech.costGold,
        },
      };

      updatedTechState = {
        ...updatedTechState,
        activeResearchId: affordableTech.id,
        researchProgressDays: 0,
      };

      logs.push({
        actionType: 'tech',
        message: `Iniciou a pesquisa tecnológica: ${affordableTech.title} (💰 ${affordableTech.costGold})`,
      });
    }
  }

  // 3. CONSTRUÇÃO EM PROVÍNCIAS: shortages and real capacity drive the choice.
  const aiProvinces = provinces.filter(p => p.owner === country.tag);
  const targetProvince = aiProvinces.find(p => !updatedConstructions.some(c => c.provinceId === p.id));
  if (targetProvince) {
    const market = normalizeMarket(targetProvince.market);
    const populationTotal = typeof targetProvince.population === 'number' ? targetProvince.population : targetProvince.population.total;
    const priorities: BuildingType[] = [];
    if (market.goods.food.shortage > 0 || market.goods.food.stock < market.goods.food.demand) priorities.push('farm');
    if (market.goods.wood.stock < market.goods.wood.demand * 2) priorities.push('lumber_mill');
    if (market.goods.iron.stock < market.goods.iron.demand * 2) priorities.push('iron_mine');
    if (market.goods.tools.stock < market.goods.tools.demand * 2) priorities.push('workshop');
    if (ALL_FINITE(market) && Object.values(market.goods).some(g => g.stock >= getStorageCapacity(targetProvince) * .9)) priorities.push('warehouse');
    if (populationTotal >= getPopulationCapacity(targetProvince) * .9) priorities.push('housing');
    priorities.push('infrastructure', 'market', 'barracks', 'fortress');
    for (const chosenBuilding of priorities) {
      const result = startBuilding(
        targetProvince,
        updatedProvinces,
        country.tag,
        chosenBuilding,
        updatedCountry.resources.gold,
        updatedConstructions
      );

      if (!result.success) continue;

      updatedProvinces = result.provinces;
      updatedConstructions = result.constructions;

      updatedCountry = {
        ...updatedCountry,
        resources: {
          ...updatedCountry.resources,
          gold: result.gold,
        },
      };

      logs.push({
        actionType: 'building',
        message: `Iniciou obra de ${getBuildingName(chosenBuilding)} em ${targetProvince.name}`,
      });

      break;
    }
  }

  // 4. RECRUTAMENTO DE TROPAS MILITARES
  if (updatedCountry.resources.gold >= 250 && updatedCountry.resources.manpower >= 1000) {
    if (canRecruitMilitary) {
      const aiProvinces = provinces.filter(p => p.owner === country.tag);

      if (aiProvinces.length > 0) {
        const targetProvince = aiProvinces[Math.floor(Math.random() * aiProvinces.length)];
        const unitTypes = Object.keys(UNIT_DEFINITIONS) as UnitType[];
        const chosenUnit = unitTypes[Math.floor(Math.random() * unitTypes.length)];
        const def = UNIT_DEFINITIONS[chosenUnit];
        const recruitmentMarket = normalizeMarket(targetProvince.market);
        if (updatedCountry.resources.gold >= def.cost && updatedCountry.resources.manpower >= def.manpowerCost
          && recruitmentMarket.goods.iron.stock >= def.ironCost && recruitmentMarket.goods.tools.stock >= def.toolsCost) {
          recruitmentMarket.goods.iron.stock -= def.ironCost;
          recruitmentMarket.goods.tools.stock -= def.toolsCost;
          targetProvince.market = recruitmentMarket;
          updatedCountry = {
            ...updatedCountry,
            resources: {
              ...updatedCountry.resources,
              gold: updatedCountry.resources.gold - def.cost,
              manpower: updatedCountry.resources.manpower - def.manpowerCost,
            },
          };

          const existingRecruitment = updatedRecruitments.find(
            r => r.owner === country.tag &&
              r.provinceId === targetProvince.id &&
              r.unitType === chosenUnit &&
              r.daysRemaining === def.trainingTime
          );

          if (existingRecruitment) {
            updatedRecruitments = updatedRecruitments.map(r =>
              r.id === existingRecruitment.id ? { ...r, count: r.count + 1 } : r
            );
          } else {
            const newRecruitment: Recruitment = {
              id: `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              provinceId: targetProvince.id,
              owner: country.tag,
              unitType: chosenUnit,
              daysRemaining: def.trainingTime,
              count: 1,
            };
            updatedRecruitments = [...updatedRecruitments, newRecruitment];
          }

          const translatedUnit = getUnitName(chosenUnit);
          logs.push({
            actionType: 'military',
            message: `Iniciou treinamento de ${translatedUnit} em ${targetProvince.name} (💰 ${def.cost})`,
          });
        }
      }
    }
  }

  return {
    techState: updatedTechState,
    buildingConstructions: updatedConstructions,
    recruitments: updatedRecruitments,
    country: updatedCountry,
    provinces: updatedProvinces,
    logs,
  };
}
