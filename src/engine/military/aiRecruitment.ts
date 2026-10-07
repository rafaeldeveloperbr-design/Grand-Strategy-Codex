import type { Army, Country, Province, Recruitment, ModernUnitType } from '../../types';
import type { CountryTechState } from '../../types/technology';
import { RECRUITABLE_UNIT_IDS, UNIT_DEFINITIONS } from '../../data/units';
import { getEffectiveRecruitmentCost, getRecruitmentBlockReason } from './recruitmentEngine';
import { calculateArmySupplyUse } from './armyStats';
import { calculateLocalSupplyCapacity, calculateLocalSupplyBaseCapacity } from './supplyEngine';
import { getProvinceLogistics, type LogisticsSnapshot } from '../logistics';

export const MILITARY_RECRUITMENT_AI_BALANCE = {
  treasuryReserve: 150, armorTreasury: 1000, heavyMinimumSupply: .6,
  weights: { infantry: 8, motorized_infantry: 2, armor: 1, artillery: 2, reconnaissance: 1, engineers: 1, garrison: 2 } satisfies Record<ModernUnitType, number>,
  defensiveGarrisonWeight: 4,
} as const;

export function rankRecruitmentProjects(country: Country, provinces: Province[], technology: CountryTechState, armies: Army[], recruitments: Recruitment[], atWar: boolean, logistics?: LogisticsSnapshot) {
  const B = MILITARY_RECRUITMENT_AI_BALANCE;
  const counts = new Map<string, number>();
  for (const army of armies.filter(a => a.owner === country.tag)) for (const r of army.regiments) counts.set(r.type, (counts.get(r.type) ?? 0) + r.strength / (r.maxStrength ?? UNIT_DEFINITIONS[r.type].maxStrength));
  for (const r of recruitments.filter(r => r.owner === country.tag)) counts.set(r.unitType, (counts.get(r.unitType) ?? 0) + r.count);
  const projects: Array<{ province: Province; type: ModernUnitType; score: number }> = [];
  for (const province of provinces.filter(p => p.owner === country.tag)) {
    const strategic = province.id === (country.capitalId ?? country.capital) || province.neighbors.some(id => provinces.some(p => p.id === id && p.owner !== country.tag));
    const network = getProvinceLogistics(logistics, country.tag, province.id);
    const capacity = network ? calculateLocalSupplyBaseCapacity(province) * network.efficiency : calculateLocalSupplyCapacity(province);
    const demand = armies.filter(a => a.owner === country.tag && a.location === province.id).reduce((sum, a) => sum + calculateArmySupplyUse(a), 0)
      + recruitments.filter(r => r.owner === country.tag && r.provinceId === province.id).reduce((sum, r) => sum + r.count * UNIT_DEFINITIONS[r.unitType].supplyUse, 0);
    for (const type of RECRUITABLE_UNIT_IDS) {
      const ctx = { country, province, technology }, cost = getEffectiveRecruitmentCost(type, ctx);
      if (getRecruitmentBlockReason(type, ctx) || country.resources.gold - cost.gold < B.treasuryReserve) continue;
      if (type === 'armor' && (country.resources.gold < B.armorTreasury || !atWar)) continue;
      const projectedRatio = Math.min(1, capacity / Math.max(.01, demand + UNIT_DEFINITIONS[type].supplyUse));
      if ((type === 'armor' || type === 'artillery' || type === 'motorized_infantry') && projectedRatio < B.heavyMinimumSupply) continue;
      if (type === 'garrison' && !strategic) continue;
      const weight = type === 'garrison' && strategic && !atWar ? B.defensiveGarrisonWeight : B.weights[type];
      const score = weight / (1 + (counts.get(type) ?? 0)) * projectedRatio;
      projects.push({ province, type, score });
    }
  }
  return projects.sort((a, b) => b.score - a.score || a.province.id.localeCompare(b.province.id) || a.type.localeCompare(b.type));
}
