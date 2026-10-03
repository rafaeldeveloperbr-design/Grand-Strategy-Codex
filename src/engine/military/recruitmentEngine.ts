import { Army, Province, Country, Recruitment, Regiment } from '../../types';
import { UNIT_DEFINITIONS } from '../../data/units';
import { BUILDING_DEFINITIONS } from '../../data/buildings';
import { createArmy, createRegiment } from './militaryUtils';
import { normalizeMarket } from '../market';
import type { UnitType } from '../../types';

export function payRecruitmentCost(province: Province, country: Country, unitType: UnitType, goldCost = UNIT_DEFINITIONS[unitType].cost) {
  const def = UNIT_DEFINITIONS[unitType]; const market = normalizeMarket(province.market);
  if (country.resources.gold < goldCost) return { success: false as const, reason: 'Dinheiro insuficiente', province, country };
  if (country.resources.manpower < def.manpowerCost) return { success: false as const, reason: 'Manpower insuficiente', province, country };
  if (market.goods.iron.stock < def.ironCost) return { success: false as const, reason: 'IRON insuficiente', province, country };
  if (market.goods.tools.stock < def.toolsCost) return { success: false as const, reason: 'TOOLS insuficiente', province, country };
  market.goods.iron.stock -= def.ironCost; market.goods.tools.stock -= def.toolsCost;
  return { success: true as const, reason: null, province: { ...province, market }, country: { ...country, resources: { ...country.resources, gold: country.resources.gold - goldCost, manpower: country.resources.manpower - def.manpowerCost } } };
}

export function processRecruitments(
  recruitments: Recruitment[],
  armies: Army[],
  countries: Country[],
  provinces: Province[] = []
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

    let recruitmentSpeedBonus = 0;
    if (province) {
      for (const building of province.buildings) {
        if (building.daysRemaining <= 0 && building.type === 'barracks') {
          const def = BUILDING_DEFINITIONS[building.type];
          if (def.bonusPerLevel.recruitmentSpeedBonus) {
            recruitmentSpeedBonus += def.bonusPerLevel.recruitmentSpeedBonus * building.level;
          }
        }
      }
    }

    const newDays = rec.daysRemaining - (1 + recruitmentSpeedBonus / 100);

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
