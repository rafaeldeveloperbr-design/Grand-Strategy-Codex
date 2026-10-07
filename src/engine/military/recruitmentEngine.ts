import { Army, Province, Country, Recruitment, Regiment } from '../../types';
import { UNIT_DEFINITIONS } from '../../data/units';
import { getBuildingBonus, getMilitaryEquipmentCostMultiplier } from '../../data/buildings';
import { createArmy, createRegiment, generateRecruitmentId } from './militaryUtils';
import { normalizeMarket } from '../market';
import type { UnitType } from '../../types';
import { calculateLawModifiers } from '../government';
import type { CountryTechState } from '../../types/technology';
import { calculateTechBonuses } from '../technology';

export interface RecruitmentContext { country: Country; province: Province; technology?: CountryTechState }
export interface RecruitmentCost { gold: number; manpower: number; iron: number; tools: number; days: number }

export function getEffectiveRecruitmentCost(unitType: UnitType, context: RecruitmentContext): RecruitmentCost {
  const definition = UNIT_DEFINITIONS[unitType];
  const laws = calculateLawModifiers(context.country.activeLaws);
  const technology = context.technology ? calculateTechBonuses(context.technology) : undefined;
  const equipmentMultiplier = getMilitaryEquipmentCostMultiplier(context.province);
  return {
    gold: Math.ceil(definition.cost * laws.recruitmentCostMultiplier), manpower: definition.manpowerCost,
    iron: definition.ironCost * equipmentMultiplier, tools: definition.toolsCost * equipmentMultiplier,
    days: Math.max(5, Math.ceil(definition.trainingTime * laws.recruitmentTimeMultiplier * (technology?.recruitmentTimeMultiplier ?? 1))),
  };
}

export function getRecruitmentBlockReason(unitType: UnitType, context: RecruitmentContext): string | null {
  if (context.province.owner !== context.country.tag) return 'A província não é controlada pelo país';
  const definition = UNIT_DEFINITIONS[unitType];
  if (definition.requiredTechnology && !context.technology?.completedTechnologies.includes(definition.requiredTechnology)) return `Requer tecnologia: ${definition.requiredTechnology}`;
  const cost = getEffectiveRecruitmentCost(unitType, context);
  const market = normalizeMarket(context.province.market);
  if (context.country.resources.gold < cost.gold) return 'Ouro insuficiente';
  if (context.country.resources.manpower < cost.manpower) return 'Manpower insuficiente';
  if (market.goods.iron.stock < cost.iron) return 'Ferro insuficiente';
  if (market.goods.tools.stock < cost.tools) return 'Ferramentas insuficientes';
  return null;
}

export const canRecruit = (unitType: UnitType, context: RecruitmentContext): boolean => getRecruitmentBlockReason(unitType, context) === null;

export function queueRecruitment(unitType: UnitType, context: RecruitmentContext, id = generateRecruitmentId()): { success: true; country: Country; province: Province; recruitment: Recruitment } | { success: false; reason: string } {
  const reason = getRecruitmentBlockReason(unitType, context);
  if (reason) return { success: false, reason };
  const cost = getEffectiveRecruitmentCost(unitType, context);
  const market = normalizeMarket(context.province.market);
  market.goods.iron.stock -= cost.iron; market.goods.tools.stock -= cost.tools;
  return { success: true,
    country: { ...context.country, resources: { ...context.country.resources, gold: context.country.resources.gold - cost.gold, manpower: context.country.resources.manpower - cost.manpower } },
    province: { ...context.province, market },
    recruitment: { id, provinceId: context.province.id, owner: context.country.tag, unitType, daysRemaining: cost.days, count: 1, paidCost: { gold: cost.gold, manpower: cost.manpower, iron: cost.iron, tools: cost.tools } },
  };
}

export function payRecruitmentCost(province: Province, country: Country, unitType: UnitType, goldCost = UNIT_DEFINITIONS[unitType].cost) {
  const def = UNIT_DEFINITIONS[unitType]; const market = normalizeMarket(province.market);
  const equipment = getMilitaryEquipmentCostMultiplier(province);
  const iron = def.ironCost * equipment, tools = def.toolsCost * equipment;
  if (country.resources.gold < goldCost) return { success: false as const, reason: 'Dinheiro insuficiente', province, country };
  if (country.resources.manpower < def.manpowerCost) return { success: false as const, reason: 'Manpower insuficiente', province, country };
  if (market.goods.iron.stock < iron) return { success: false as const, reason: 'IRON insuficiente', province, country };
  if (market.goods.tools.stock < tools) return { success: false as const, reason: 'TOOLS insuficiente', province, country };
  market.goods.iron.stock -= iron; market.goods.tools.stock -= tools;
  return { success: true as const, reason: null, province: { ...province, market }, country: { ...country, resources: { ...country.resources, gold: country.resources.gold - goldCost, manpower: country.resources.manpower - def.manpowerCost } } };
}

export function processRecruitments(
  recruitments: Recruitment[],
  armies: Army[],
  countries: Country[],
  provinces: Province[] = [], recruitmentTimeMultipliers: ReadonlyMap<string, number> = new Map()
): { recruitments: Recruitment[]; armies: Army[]; countries: Country[]; completedRecruitments: Recruitment[] } {
  const updatedRecruitments: Recruitment[] = [];
  const completedRecruitments: Recruitment[] = [];
  let updatedArmies = [...armies];
  const updatedCountries = [...countries];

  for (const rec of recruitments) {
    const province = provinces.find((p) => p.id === rec.provinceId);

    if (!province || province.owner !== rec.owner) {
      console.log(`❌ Recrutamento cancelado: ${rec.owner} não é mais dono de ${rec.provinceId}`);
      continue;
    }

    const recruitmentSpeedBonus = getBuildingBonus(province, 'recruitmentSpeedBonus');

    const timeMultiplier = recruitmentTimeMultipliers.get(rec.owner) ?? 1;
    const newDays = rec.daysRemaining - (1 + recruitmentSpeedBonus / 100) / timeMultiplier;

    if (newDays <= 0) {
      const regiments: Regiment[] = [];
      for (let i = 0; i < rec.count; i++) {
        regiments.push(createRegiment(rec.unitType, rec.provinceId));
      }

      const existingArmy = updatedArmies.find(
        (a) => a.owner === rec.owner && a.location === rec.provinceId
      );

      if (existingArmy) {
        updatedArmies = updatedArmies.map((a) =>
          a.id === existingArmy.id
            ? { ...a, regiments: [...a.regiments, ...regiments] }
            : a
        );
      } else {
        const newArmy = createArmy(rec.owner, `Exército ${rec.provinceId}`, rec.provinceId);
        newArmy.regiments = regiments;
        updatedArmies.push(newArmy);
      }

      completedRecruitments.push(rec);
    } else {
      updatedRecruitments.push({ ...rec, daysRemaining: newDays });
    }
  }

  return {
    recruitments: updatedRecruitments,
    armies: updatedArmies,
    countries: updatedCountries,
    completedRecruitments,
  };
}

export function cancelRecruitment(
  recruitmentId: string,
  recruitments: Recruitment[],
  currentGold: number
): { updatedRecruitments: Recruitment[]; newGold: number; refundedGold: number } {
  const rec = recruitments.find((r) => r.id === recruitmentId);
  if (!rec) {
    return { updatedRecruitments: recruitments, newGold: currentGold, refundedGold: 0 };
  }

  const unitDef = UNIT_DEFINITIONS[rec.unitType];
  const totalCost = unitDef.cost;
  const totalDays = unitDef.trainingTime;
  const daysRemaining = rec.daysRemaining;

  const progressRatio = daysRemaining / totalDays;
  const refundFactor = Math.max(0.1, progressRatio);
  const refundedGold = Math.floor(totalCost * refundFactor);

  let updatedRecruitments: Recruitment[];

  if (rec.count > 1) {
    updatedRecruitments = recruitments.map((r) => {
      if (r.id === recruitmentId) {
        return {
          ...r,
          count: r.count - 1,
        };
      }
      return r;
    });
  } else {
    updatedRecruitments = recruitments.filter((r) => r.id !== recruitmentId);
  }

  return {
    updatedRecruitments,
    newGold: currentGold + refundedGold,
    refundedGold,
  };
}
