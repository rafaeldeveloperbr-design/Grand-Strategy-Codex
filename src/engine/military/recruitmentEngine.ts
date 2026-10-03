import { Army, Province, Country, Recruitment, Regiment } from '../../types';
import { UNIT_DEFINITIONS } from '../../data/units';
import { createArmy, createRegiment } from './militaryUtils';
import { getRecruitmentCost } from '../../data/units';
import { normalizeMarket } from '../market';

export function payRecruitmentCost(country: Country, province: Province, unitType: Regiment['type'], goldCost?: number):
  { success: boolean; reason?: string; country: Country; province: Province } {
  const cost = getRecruitmentCost(unitType);
  const market = normalizeMarket(province.market);
  const payableGold = goldCost ?? cost.gold;
  if (country.resources.gold < payableGold) return { success: false, reason: 'Dinheiro insuficiente', country, province };
  if (country.resources.manpower < cost.manpower) return { success: false, reason: 'Manpower insuficiente', country, province };
  if (market.goods.iron.stock < cost.iron) return { success: false, reason: 'IRON insuficiente', country, province };
  if (market.goods.tools.stock < cost.tools) return { success: false, reason: 'TOOLS insuficiente', country, province };
  market.goods.iron.stock -= cost.iron;
  market.goods.tools.stock -= cost.tools;
  return {
    success: true,
    province: { ...province, market },
    country: { ...country, resources: { ...country.resources, gold: country.resources.gold - payableGold, manpower: country.resources.manpower - cost.manpower } },
  };
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
        if (building.daysRemaining <= 0 && building.type === 'barracks') recruitmentSpeedBonus += 10 * building.level;
      }
    }

    const daysReduction = Math.floor(recruitmentSpeedBonus / 10);
    const newDays = rec.daysRemaining - 1 - daysReduction;

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
