import { Country, Province, BuildingType, UnitType, Recruitment, BuildingConstruction } from '../../types';
import { CountryTechState } from '../../types/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../../data/technology';
import { LAWS } from '../../constants/laws';

import { startBuilding } from '../buildings';
import { calculateWorkforce, getFoodShortageStatus, getPopulationCapacity, normalizePopulation } from '../population';
import { getStorageCapacity, normalizeMarket } from '../market';
import { UNIT_DEFINITIONS } from '../../data/units';
import { getBuildingName, getUnitName } from '../../utils/translations';
import { calculateTechBonuses, startTechnologyResearch } from '../technology';
import { chooseAILaw, enactLaw } from '../government';
import { getRecruitmentBlockReason, queueRecruitment } from '../military/recruitmentEngine';

const ALL_FINITE = (market: ReturnType<typeof normalizeMarket>) => Object.values(market.goods).every(g => Number.isFinite(g.stock));

export function processAIEconomicDecisions(
  country: Country,
  provinces: Province[],
  techState: CountryTechState,
  buildingConstructions: BuildingConstruction[],
  recruitments: Recruitment[],
  dateString: string,
  canRecruitMilitary: boolean = true,
  atWar: boolean = false,
): {
  techState: CountryTechState;
  buildingConstructions: BuildingConstruction[];
  recruitments: Recruitment[];
  country: Country;
  provinces: Province[],
  logs: Array<{ actionType: 'building' | 'military' | 'tech' | 'focus' | 'government'; message: string }>;
} {
  const logs: Array<{ actionType: 'building' | 'military' | 'tech' | 'focus' | 'government'; message: string }> = [];
  let updatedTechState = { ...techState };
  let updatedConstructions = [...buildingConstructions];
  let updatedRecruitments = [...recruitments];
  let updatedCountry = { ...country };
  let updatedProvinces = [...provinces];

  // 1. SELEÇÃO DE FOCO NACIONAL
  if (!updatedTechState.activeFocusId) {
    const availableFocuses = NATIONAL_FOCUSES.filter(focus => {
      if (updatedTechState.completedFocuses.includes(focus.id)) return false;

      if (focus.prerequisites && focus.prerequisites.length > 0) {
        return focus.prerequisites.every(prereqId =>
          updatedTechState.completedFocuses.includes(prereqId)
        );
      }
      return true;
    });

    if (availableFocuses.length > 0) {
      const ownedProvinces = provinces.filter(province => province.owner === country.tag);
      const famine = ownedProvinces.some(province => getFoodShortageStatus(normalizeMarket(province.market).goods.food).ratio > 0);
      const workforce = ownedProvinces.reduce((sum, province) => sum + calculateWorkforce(normalizePopulation(province.population)), 0);
      const unemployed = ownedProvinces.reduce((sum, province) => sum + normalizePopulation(province.population).unemployed, 0);
      const categoryPriority = famine ? 'ECONOMY' : atWar ? 'MILITARY' : country.resources.stability < 40 ? 'POLITICS' : workforce > 0 && unemployed / workforce > .2 ? 'ECONOMY' : 'POLITICS';
      const selectedFocus = [...availableFocuses].sort((a, b) => Number(b.category === categoryPriority) - Number(a.category === categoryPriority))[0];
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
      if (updatedTechState.completedTechnologies.includes(tech.id)) return false;

      if (tech.prerequisites && tech.prerequisites.length > 0) {
        return tech.prerequisites.every(prereqId =>
          updatedTechState.completedTechnologies.includes(prereqId)
        );
      }
      return true;
    });

    const hasShortage = provinces.filter(p => p.owner === country.tag).some(p => Object.values(normalizeMarket(p.market).goods).some(g => g.shortage > 0));
    const prioritizedTechs = [...availableTechs].sort((a, b) => {
      const rank = (category: typeof a.category) => hasShortage
        ? (category === 'ECONOMY' ? 0 : category === 'MILITARY' ? 1 : 2)
        : (category === 'SOCIETY' ? 0 : category === 'ECONOMY' ? 1 : 2);
      return rank(a.category) - rank(b.category);
    });
    const affordableTech = prioritizedTechs.find(t => updatedCountry.resources.gold >= t.costGold);

    if (affordableTech) {
      const research = startTechnologyResearch(updatedTechState, affordableTech.id, updatedCountry);
      updatedCountry = {
        ...updatedCountry,
        resources: {
          ...updatedCountry.resources,
          gold: updatedCountry.resources.gold - affordableTech.costGold,
        },
      };

      if (research.techState) updatedTechState = research.techState;

      logs.push({
        actionType: 'tech',
        message: `Iniciou a pesquisa tecnológica: ${affordableTech.title} (💰 ${affordableTech.costGold})`,
      });
    }
  }

  // Laws are considered after research so policy churn cannot starve Technology V2.
  const selectedLaw = updatedCountry.politics ? null : chooseAILaw(updatedCountry, updatedProvinces, { atWar });

  if (selectedLaw) {
    const result = enactLaw(
      updatedCountry.activeLaws,
      selectedLaw,
      updatedCountry.resources.gold,
      { atWar }
    );

    if (result.allowed) {
      const law = LAWS[selectedLaw];

      updatedCountry = {
        ...updatedCountry,
        activeLaws: result.activeLaws,
        resources: {
          ...updatedCountry.resources,
          gold: result.gold,
        },
      };

      logs.push({
        actionType: 'government',
        message: `Promulgou a lei "${law.name}" (💰 ${result.cost})`,
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
    const populationState = normalizePopulation(targetProvince.population);
    const foodStatus = getFoodShortageStatus(
      market.goods.food,
      populationState.foodShortageDays,
      populationState.severeFoodShortageDays,
    );
    // Severe hunger always outranks infrastructure and other productive projects.
    if (foodStatus.severity === 'severe') priorities.push('farm');
    if (market.goods.wood.stock < market.goods.wood.demand * 2) priorities.push('lumber_mill');
    if (market.goods.iron.stock < market.goods.iron.demand * 2) priorities.push('iron_mine');
    if (market.goods.tools.stock < market.goods.tools.demand * 2) priorities.push('workshop');
    // Moderate and emerging shortages still trigger a farm, after immediate
    // input shortages but before generic development projects.
    if (foodStatus.severity !== 'severe' && foodStatus.ratio > 0) priorities.push('farm');
    if (ALL_FINITE(market) && Object.values(market.goods).some(g => g.stock >= getStorageCapacity(targetProvince) * .9)) priorities.push('warehouse');
    const capacityMultiplier = calculateTechBonuses(updatedTechState).populationCapacityMultiplier;
    if (populationTotal >= getPopulationCapacity(targetProvince, capacityMultiplier) * .9) priorities.push('housing');
    const population = normalizePopulation(targetProvince.population);
    const workforce = calculateWorkforce(population);
    if (workforce > 0 && population.unemployed / workforce >= 0.3) priorities.push('workshop', 'market');
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
        const targetProvince = [...aiProvinces].sort((a, b) => b.development - a.development || a.id.localeCompare(b.id))[0];
        const unitTypes = Object.keys(UNIT_DEFINITIONS) as UnitType[];
        const existingCounts = new Map<UnitType, number>();
        for (const recruitment of updatedRecruitments.filter(item => item.owner === country.tag)) existingCounts.set(recruitment.unitType, (existingCounts.get(recruitment.unitType) ?? 0) + recruitment.count);
        const desiredWeight: Record<UnitType, number> = { infantry: 6, archers: 2, cavalry: 2, artillery: atWar ? 2 : 1, heavy_cavalry: 1, elite_guard: 1, siege_engine: atWar ? 1 : 0 };
        const available = unitTypes.filter(type => desiredWeight[type] > 0 && getRecruitmentBlockReason(type, { country: updatedCountry, province: targetProvince, technology: updatedTechState }) === null);
        const chosenUnit = available.sort((a, b) => ((existingCounts.get(a) ?? 0) + 1) / desiredWeight[a] - ((existingCounts.get(b) ?? 0) + 1) / desiredWeight[b] || a.localeCompare(b))[0];
        if (chosenUnit) {
          const result = queueRecruitment(chosenUnit, { country: updatedCountry, province: targetProvince, technology: updatedTechState }, `ai_rec_${country.tag}_${dateString}_${updatedRecruitments.length}`);
          if (result.success) {
            updatedCountry = result.country;
            updatedProvinces = updatedProvinces.map(province => province.id === result.province.id ? result.province : province);
            updatedRecruitments = [...updatedRecruitments, result.recruitment];
            const def = UNIT_DEFINITIONS[chosenUnit];
            const translatedUnit = getUnitName(chosenUnit);
            logs.push({ actionType: 'military', message: `Iniciou treinamento de ${translatedUnit} em ${targetProvince.name} (💰 ${def.cost})` });
          }
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
