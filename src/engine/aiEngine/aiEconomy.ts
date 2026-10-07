import { Army, Country, Province, Recruitment, BuildingConstruction } from '../../types';
import { CountryTechState } from '../../types/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../../data/technology';
import { LAWS } from '../../constants/laws';

import { rankRecruitmentProjects } from '../military/aiRecruitment';
import { startBuilding } from '../buildings';
import { calculateWorkforce, getFoodShortageStatus, normalizePopulation } from '../population';
import { normalizeMarket } from '../market';
import { UNIT_DEFINITIONS } from '../../data/units';
import { getBuildingName, getUnitName } from '../../utils/translations';
import { normalizeTechState, calculateTechBonuses, getTechnologyBlockReason, getFocusBlockReason, startNationalFocus, startTechnologyResearch } from '../technology';
import { chooseAILaw, enactLaw } from '../government';
import { queueRecruitment } from '../military/recruitmentEngine';

import { rankBuildingProjects } from '../buildings/constructionAI';
import type { LogisticsSnapshot } from '../logistics';

export function processAIEconomicDecisions(
  country: Country,
  provinces: Province[],
  techState: CountryTechState,
  buildingConstructions: BuildingConstruction[],
  recruitments: Recruitment[],
  dateString: string,
  canRecruitMilitary: boolean = true,
  atWar: boolean = false,
  logistics?: LogisticsSnapshot,
  armies: Army[] = [],
): {
  techState: CountryTechState;
  buildingConstructions: BuildingConstruction[];
  recruitments: Recruitment[];
  country: Country;
  provinces: Province[],
  logs: Array<{ actionType: 'building' | 'military' | 'tech' | 'focus' | 'government'; message: string }>;
} {
  const logs: Array<{ actionType: 'building' | 'military' | 'tech' | 'focus' | 'government'; message: string }> = [];
  let updatedTechState = normalizeTechState(techState, country.tag);
  let updatedConstructions = [...buildingConstructions];
  let updatedRecruitments = [...recruitments];
  let updatedCountry = { ...country };
  let updatedProvinces = [...provinces];

  // 1. SELEÇÃO DE FOCO NACIONAL
  if (!updatedTechState.activeFocusId) {
    const availableFocuses = NATIONAL_FOCUSES.filter(focus => getFocusBlockReason(updatedTechState, focus.id) === null);

    if (availableFocuses.length > 0) {
      const ownedProvinces = provinces.filter(province => province.owner === country.tag);
      const famine = ownedProvinces.some(province => getFoodShortageStatus(normalizeMarket(province.market).goods.food).ratio > 0);
      const workforce = ownedProvinces.reduce((sum, province) => sum + calculateWorkforce(normalizePopulation(province.population)), 0);
      const unemployed = ownedProvinces.reduce((sum, province) => sum + normalizePopulation(province.population).unemployed, 0);
      const socialProblems = ownedProvinces.some(province => normalizePopulation(province.population).satisfaction < 40);
      const lowCapacity = ownedProvinces.some(province => (province.buildings ?? []).filter(building => ['workshop', 'iron_mine', 'lumber_mill'].includes(building.type)).length < 2);
      const isolated = (country.trade?.partners.length ?? 0) === 0;
      const behindInResearch = updatedTechState.completedTechnologies.length < Math.ceil(TECHNOLOGIES.length / 3);
      const categoryPriority = famine ? 'ECONOMY'
        : atWar ? 'MILITARY'
        : country.resources.stability < 40 || socialProblems ? 'POLITICS'
        : (country.economy && country.economy.goldIncome < country.economy.goldExpense) || country.resources.gold < 100 || workforce > 0 && unemployed / workforce > .2 ? 'ECONOMY'
        : lowCapacity ? 'INDUSTRY'
        : behindInResearch ? 'RESEARCH'
        : isolated ? 'DIPLOMACY' : 'POLITICS';
      // Stable array order breaks ties deterministically; unavailable categories fall back.
      const selectedFocus = [...availableFocuses].sort((a, b) => Number(b.category === categoryPriority) - Number(a.category === categoryPriority))[0];
      const started = startNationalFocus(updatedTechState, selectedFocus.id);
      if (started) updatedTechState = started;

      logs.push({
        actionType: 'focus',
        message: `Selecionou o Foco Nacional: ${selectedFocus.title}`,
      });
    }
  }

  // 2. PESQUISA TECNOLÓGICA
  for (const slot of updatedTechState.researchSlots) {
    if (slot.technologyId) continue;
    const availableTechs = TECHNOLOGIES.filter(tech => getTechnologyBlockReason(updatedTechState, tech.id, updatedCountry, slot.id) === null);
    const owned = provinces.filter(province => province.owner === country.tag);
    const shortage = owned.some(province => Object.values(normalizeMarket(province.market).goods).some(good => good.shortage > 0));
    const lowCapacity = owned.some(province => (province.buildings ?? []).filter(building => ['farm', 'workshop', 'iron_mine', 'lumber_mill'].includes(building.type)).length < 2);
    const weakEconomy = country.economy && (country.economy.goldIncome < country.economy.goldExpense || country.economy.goldIncome < 5);
    const priority = atWar ? 'MILITARY' : shortage || lowCapacity ? 'INDUSTRY' : weakEconomy ? 'ECONOMY' : 'SOCIETY';
    const activeCategories = new Set(updatedTechState.researchSlots.map(slot =>
      TECHNOLOGIES.find(tech => tech.id === slot.technologyId)?.category));
    // Prefer a different category for additional slots, then the existing priority.
    // Definition order breaks ties deterministically.
    const selected = [...availableTechs].sort((a, b) =>
      Number(activeCategories.has(a.category)) - Number(activeCategories.has(b.category))
      || Number(b.category === priority) - Number(a.category === priority))[0];
    if (selected) {
      const research = startTechnologyResearch(updatedTechState, selected.id, updatedCountry, slot.id);
      if (research.techState) {
        updatedTechState = research.techState;
        updatedCountry = { ...updatedCountry, resources: { ...updatedCountry.resources, gold: updatedCountry.resources.gold - research.cost } };
        logs.push({ actionType: 'tech', message: `Iniciou a pesquisa tecnológica: ${selected.title} (💰 ${research.cost})` });
      }
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
  const project = rankBuildingProjects(updatedCountry, updatedProvinces, updatedConstructions, updatedRecruitments, atWar, calculateTechBonuses(updatedTechState).populationCapacityMultiplier, logistics)[0];
  if (project) {
    const result = startBuilding(project.province, updatedProvinces, country.tag, project.type, updatedCountry.resources.gold, updatedConstructions);
    if (result.success) {
      updatedProvinces = result.provinces;
      updatedConstructions = result.constructions;
      updatedCountry = { ...updatedCountry, resources: { ...updatedCountry.resources, gold: result.gold } };
      logs.push({ actionType: 'building', message: getBuildingName(project.type) + ' - ' + project.province.name });
    }
  }

  // 4. RECRUTAMENTO DE TROPAS MILITARES
  if (updatedCountry.resources.gold > 0 && updatedCountry.resources.manpower > 0) {
    if (canRecruitMilitary) {
      const aiProvinces = updatedProvinces.filter(p => p.owner === country.tag);

      if (aiProvinces.length > 0) {
        const project = rankRecruitmentProjects(updatedCountry, updatedProvinces, updatedTechState, armies, updatedRecruitments, atWar, logistics)[0];
        if (project) {
          const targetProvince = project.province, chosenUnit = project.type;
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
