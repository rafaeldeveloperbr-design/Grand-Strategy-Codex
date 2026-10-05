/**
 * ============================================================
 * MÓDULO 2 - Motor Econômico (Game Engine)
 * ============================================================
 * Processa os ticks diários do jogo, atualizando:
 * - Economia (renda/despesas de ouro)
 * - Manpower (ganho/perda)
 * - Crescimento populacional
 * - Construção de edifícios
 * 
 * Este módulo é o coração do loop de tempo do jogo.
 */

import { Province, Country } from '../types';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { getStabilityModifiers, processDailyStabilityRecovery } from './stability';
import { calculateUnrestEconomicImpact } from './unrest';
import { calculatePopulationGrowthBreakdown, calculateProvincePopulationGrowth, getWorkerAvailability, normalizePopulation, processInternalMigration, processProvincePopulation, recalculateEmployment } from './population';
import type { PopulationGrowthBreakdown } from './population';
import { processProvinceMarket } from './market';
import { processInternalTrade } from './internalTrade';
import type { TechnologyBonuses } from './technology';
import { calculateLawModifiers } from './government';

/**
 * Constantes de balanceamento do jogo
 */
const BALANCE = {
  /** Imposto base por 1000 de população */
  TAX_PER_POP: 0.08,
  /** Multiplicador de imposto baseado em desenvolvimento */
  DEV_TAX_MULTIPLIER: 0.15,
  /** Manpower base por 1000 de população (fração recrutável) */
  MANPOWER_FRACTION: 0.02,
  /** Custo de manutenção por província */
  MAINTENANCE_PER_PROVINCE: 0.5,
  /** Custo de manutenção por edifício */
  MAINTENANCE_PER_BUILDING: 0.3,
  /** Fração de população que é manpower elegível */
  ELIGIBLE_POP_FRACTION: 0.3,
};

/**
 * Calcula a renda de ouro de uma província
 */
export function calculateProvinceGoldIncome(
  province: Province,
  goldIncomeMultiplier: number = 1.0
): number {
  const devMultiplier = 1 + (province.development - 1) * BALANCE.DEV_TAX_MULTIPLIER;
  const population = normalizePopulation(province.population);
  let baseIncome = (population.total / 1000) * BALANCE.TAX_PER_POP * devMultiplier;

  // Adiciona bônus de edifícios
  for (const building of province.buildings) {
    if (building.daysRemaining <= 0) {
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.bonusPerLevel.goldIncome) {
        baseIncome += def.bonusPerLevel.goldIncome * building.level;
      }
    }
  }

  // Aplica multiplicador de renda (tecnologias/focos)
  return baseIncome * goldIncomeMultiplier * getWorkerAvailability(province);
}

/**
 * Calcula o ganho de manpower de uma província
 */
export function calculateProvinceManpowerGain(province: Province): number {
  let gain = (normalizePopulation(province.population).total / 1000) * BALANCE.MANPOWER_FRACTION;

  // Adiciona bônus de edifícios (acampamentos)
  for (const building of province.buildings) {
    if (building.daysRemaining <= 0) {
      const def = BUILDING_DEFINITIONS[building.type];
      if (def.bonusPerLevel.manpowerGain) {
        gain += def.bonusPerLevel.manpowerGain * building.level;
      }
    }
  }

  return gain;
}

export function calculateProvinceDefense(province: Province): number {
  const fortressLevel = province.buildings.find(building => building.type === 'fortress' && building.daysRemaining <= 0)?.level ?? 0;
  return province.defense + fortressLevel * 2;
}

/**
 * Calcula a defesa total de uma província
 */

/**
 * Calcula o crescimento populacional de uma província
 */
export const calculatePopulationGrowth = calculateProvincePopulationGrowth;

export function calculateDailyPopulationGrowth(
  province: Province,
  country: Country,
  techBonuses?: TechnologyBonuses,
  atWar = false
): number {
  return calculateDailyPopulationGrowthBreakdown(province, country, techBonuses, atWar).finalGrowth;
}

export function calculateDailyPopulationGrowthBreakdown(
  province: Province,
  country: Country,
  techBonuses?: TechnologyBonuses,
  atWar = false
): PopulationGrowthBreakdown {
  const unrestImpact = calculateUnrestEconomicImpact(province.unrest ?? 0, province.rebellion?.progress, province.rebellion?.autonomy, province.rebellion?.reliefDays);
  const lawModifiers = calculateLawModifiers(country.activeLaws);
  const effectiveStability = Math.min(100, country.resources.stability + (techBonuses?.stabilityModifier ?? 0) * 100);
  return calculatePopulationGrowthBreakdown(province, effectiveStability, {
    growthMultiplier: lawModifiers.populationGrowthMultiplier * unrestImpact.growthMultiplier
      * (techBonuses?.populationGrowthMultiplier ?? 1),
    capacityMultiplier: (techBonuses?.populationCapacityMultiplier ?? 1) * lawModifiers.populationCapacityMultiplier,
    atWar,
  });
}

/**
 * Calcula o manpower máximo de um país baseado em suas províncias
 */
export function calculateMaxManpower(provinces: Province[], conscriptionMultiplier = 1): number {
  const totalPop = provinces.reduce((sum, p) => sum + normalizePopulation(p.population).total, 0);
  return Math.floor(totalPop * BALANCE.ELIGIBLE_POP_FRACTION * conscriptionMultiplier);
}

/**
 * Calcula as despesas de manutenção de um país
 */
export function calculateCountryExpenses(country: Country, provinces: Province[]): number {
  let expenses = country.provinces.length * BALANCE.MAINTENANCE_PER_PROVINCE;

  // Custo de manutenção por edifício
  for (const province of provinces) {
    expenses += province.buildings.length * BALANCE.MAINTENANCE_PER_BUILDING;
  }

  return expenses;
}

/**
 * Processa um tick diário para um país e suas províncias.
 * Retorna as províncias atualizadas e o país atualizado.
 */
export function processDailyTick(
  country: Country,
  provinces: Province[],
  techBonuses?: TechnologyBonuses,
  atWar: boolean = false
): { country: Country; provinces: Province[] } {
  // Calcula economia total do país
  let totalGoldIncome = 0;
  let totalManpowerGain = 0;

  // Obtém bônus das leis ativas
  const lawModifiers = calculateLawModifiers(country.activeLaws);
  const effectiveStability = Math.min(100, country.resources.stability + ((techBonuses?.stabilityModifier ?? 0) + lawModifiers.stabilityModifier) * 100);

  // Obtém modificadores de estabilidade
  const stabilityModifiers = getStabilityModifiers(effectiveStability);

  // Combina multiplicadores de tecnologia, leis e estabilidade
  const goldIncomeMultiplier = (techBonuses?.goldIncomeMultiplier ?? 1.0) * lawModifiers.goldIncomeMultiplier * stabilityModifiers.goldIncome;
  const manpowerMultiplier = (techBonuses?.manpowerMultiplier ?? 1.0) * lawModifiers.manpowerMultiplier * stabilityModifiers.manpowerGrowth;
  const buildTimeMultiplier = (techBonuses?.buildTimeMultiplier ?? 1.0) * lawModifiers.constructionSpeedMultiplier * stabilityModifiers.constructionSpeed;
  const productionMultipliers = Object.fromEntries((['food','wood','iron','tools'] as const).map(good => [good, (techBonuses?.productionMultipliers[good] ?? 1) * lawModifiers.productionMultipliers[good]]));
  const capacityMultiplier = (techBonuses?.populationCapacityMultiplier ?? 1) * lawModifiers.populationCapacityMultiplier;

  // Employment limits production; the resulting real market then informs
  // satisfaction and the following demographic change.
  let updatedProvinces: Province[] = provinces.map((province) => {
    // Avança construções (com multiplicadores de tecnologia e leis)
    const updatedBuildings = province.buildings.map((b) => ({
      ...b,
      daysRemaining: Math.max(0, b.daysRemaining - buildTimeMultiplier),
    }));

    return {
      ...province,
      population: recalculateEmployment(province),
      market: processProvinceMarket({ ...province, population: recalculateEmployment(province) }, Object.fromEntries(Object.entries(productionMultipliers).map(([good, multiplier]) => [good, multiplier * calculateUnrestEconomicImpact(province.unrest ?? 0, province.rebellion?.progress).productionMultiplier])), lawModifiers.purchasingPowerMultiplier),
      buildings: updatedBuildings,
    };
  });

  // Local production/consumption is followed by deterministic domestic
  // redistribution, then market-sensitive satisfaction is finalized.
  updatedProvinces = processInternalTrade(updatedProvinces, (techBonuses?.internalTradeMultiplier ?? 1) * lawModifiers.internalTradeMultiplier, lawModifiers.purchasingPowerMultiplier).map(province => {
    const unrestImpact = calculateUnrestEconomicImpact(province.unrest ?? 0, province.rebellion?.progress, province.rebellion?.autonomy, province.rebellion?.reliefDays);
    const growth = calculateDailyPopulationGrowth(province, country, techBonuses, atWar);
    return processProvincePopulation(province, 1, country.activeLaws?.taxation || 'taxation_normal', {
      atWar,
      countryStability: effectiveStability,
      economicMultiplier: goldIncomeMultiplier * unrestImpact.goldMultiplier,
      growthAmount: growth,
      capacityMultiplier,
      flatModifier: (techBonuses?.satisfactionModifier ?? 0) + lawModifiers.satisfactionModifier,
    });
  });
  updatedProvinces = processInternalMigration(updatedProvinces, capacityMultiplier, atWar, (techBonuses?.migrationAttractionMultiplier ?? 1) * lawModifiers.migrationAttractionMultiplier);

  for (const province of updatedProvinces) {
    const unrestImpact = calculateUnrestEconomicImpact(province.unrest ?? 0, province.rebellion?.progress, province.rebellion?.autonomy, province.rebellion?.reliefDays);
    totalGoldIncome += calculateProvinceGoldIncome(province, goldIncomeMultiplier * unrestImpact.goldMultiplier);
    totalManpowerGain += calculateProvinceManpowerGain(province) * manpowerMultiplier * unrestImpact.manpowerMultiplier;
  }

  // Calcula despesas
  const baseExpenses = calculateCountryExpenses(country, updatedProvinces);
  const militaryMaintenance = updatedProvinces.reduce((sum, province) => sum + (province.stationedMilitaryMaintenance ?? (province.stationedTroops ?? 0) / 1000 * 0.1), 0)
    * (techBonuses?.militaryMaintenanceMultiplier ?? 1) * lawModifiers.militaryMaintenanceMultiplier;
  const expenses = baseExpenses + militaryMaintenance;
  const goldBalance = totalGoldIncome - expenses;

  // Atualiza manpower
  // Recalcula maxManpower com população atualizada
  const newMaxManpower = calculateMaxManpower(updatedProvinces, lawModifiers.manpowerMultiplier * (techBonuses?.manpowerMultiplier ?? 1));
  const newManpower = Math.min(country.resources.manpower + totalManpowerGain, newMaxManpower);

  // Atualiza país
  let updatedCountry: Country = {
    ...country,
    resources: {
      ...country.resources,
      gold: Math.max(0, country.resources.gold + goldBalance),
      manpower: Math.floor(newManpower),
      maxManpower: newMaxManpower,
    },
    economy: {
      goldIncome: Math.round(totalGoldIncome * 10) / 10,
      goldExpense: Math.round(expenses * 10) / 10,
      manpowerGain: Math.floor(totalManpowerGain),
      manpowerExpense: 0,
    },
  };

  // Aplica recuperação diária de estabilidade
  updatedCountry = processDailyStabilityRecovery(updatedCountry);

  return { country: updatedCountry, provinces: updatedProvinces };
}
