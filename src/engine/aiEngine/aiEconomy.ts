import { Country, Province, BuildingType, UnitType, Recruitment, BuildingConstruction } from '../../types';
import { CountryTechState } from '../../types/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../../data/technology';
import { BUILDING_DEFINITIONS } from '../../data/buildings';
import { UNIT_DEFINITIONS } from '../../data/units';
import { getBuildingName, getUnitName } from '../../utils/translations';
import { startBuildingProject } from '../buildings';
import { payRecruitmentCost } from '../military';
import { GOOD_IDS, normalizeMarket } from '../market';

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
  provinces: Province[];
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

  // 3. CONSTRUÇÃO EM PROVÍNCIAS
  if (updatedCountry.resources.gold >= 300) {
    const aiProvinces = provinces.filter(p => p.owner === country.tag);
    
    if (aiProvinces.length > 0) {
      const targetProvince = [...aiProvinces].sort((a, b) => a.id.localeCompare(b.id))[0];
      const hasConstruction = updatedConstructions.some(c => c.provinceId === targetProvince.id);
      
      if (!hasConstruction) {
        const market = normalizeMarket(targetProvince.market);
        const chosenBuilding: BuildingType = market.goods[GOOD_IDS.FOOD].shortage > 0 ? 'farm'
          : market.goods[GOOD_IDS.WOOD].stock < 8 ? 'lumber_mill'
          : market.goods[GOOD_IDS.IRON].stock < 6 ? 'iron_mine'
          : market.goods[GOOD_IDS.TOOLS].stock < 4 ? 'workshop'
          : targetProvince.population.total > targetProvince.maxPopulation * 0.9 ? 'housing' : 'warehouse';
        const def = BUILDING_DEFINITIONS[chosenBuilding];
        
        const existingBuilding = targetProvince.buildings.find(b => b.type === chosenBuilding);
        const currentLevel = existingBuilding?.level ?? 0;
        
        if (currentLevel < def.maxLevel) {
          const started = startBuildingProject(targetProvince, updatedCountry, chosenBuilding, updatedConstructions);
          if (started.success) {
            updatedCountry = started.country;
            updatedConstructions = started.constructions;
            updatedProvinces = updatedProvinces.map(p => p.id === targetProvince.id ? started.province : p);

            const translatedName = getBuildingName(chosenBuilding);
            logs.push({
              actionType: 'building',
              message: `Iniciou obra de ${translatedName} em ${targetProvince.name}`,
            });
          }
        }
      }
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
        
        const payment = payRecruitmentCost(updatedCountry, targetProvince, chosenUnit);
        if (payment.success) {
          updatedCountry = payment.country;
          updatedProvinces = updatedProvinces.map(p => p.id === targetProvince.id ? payment.province : p);

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
