import type { Army, Country, GameDate, Province, War } from '../../types';
import { normalizePopulation } from '../population';
import { REBELLION_BALANCE as B } from './balance';
import { clamp, friendlyTroops, normalizeRebellion, rebellionDay } from './rebellionUtils';
import type { UnrestExplanation, UnrestModifier } from './types';
export function calculateUnrest(p: Province, date: GameDate, armies: Army[] = [], country?: Country, wars: War[] = []): UnrestExplanation {
  const pop = normalizePopulation(p.population), state = normalizeRebellion(p.rebellion);
  const modifiers: UnrestModifier[] = [];
  const add = (source: string, value: number) => { if (value !== 0) modifiers.push({ source, value }); };
  add('dissatisfaction', Math.max(0, B.dissatisfactionBaseline - pop.satisfaction) * B.dissatisfaction);
  add('food_shortage', clamp((p.market?.goods.food.shortage ?? 0) / Math.max(1, p.market?.goods.food.demand ?? 1), 1) * B.foodPressure);
  add('poverty', Math.max(0, B.povertyBaseline - (p.market?.purchasingPower ?? B.povertyBaseline)) * B.poverty);
  add('low_development', Math.max(0, 4 - p.development) * B.developmentPressure);
  if (p.lastConquestDate !== undefined) add('recent_conquest', B.conquestPressure * Math.max(0, 1 - Math.max(0, rebellionDay(date) - p.lastConquestDate) / B.conquestDays));
  if (country) {
    add('stability', Math.max(0, B.stabilityBaseline - country.resources.stability) * B.stabilityPressure);
    add('prestige', Math.max(0, -country.resources.prestige) * B.prestigePressure);
    add('taxation', country.activeLaws.taxation === 'taxation_high' ? B.highTax : country.activeLaws.taxation === 'taxation_low' ? B.lowTax : 0);
    add('mobilization', country.activeLaws.conscription === 'conscription_total' ? B.mobilization : 0);
    add('deficit', country.resources.gold <= 0 && country.economy.goldExpense > country.economy.goldIncome ? B.deficit : 0);
    const activeWars = wars.filter(w => (w.attacker === country.tag || w.defender === country.tag) && !w.attacker.startsWith('rebel_') && !w.defender.startsWith('rebel_'));
    const longest = activeWars.reduce((max, w) => Math.max(max, rebellionDay(date) - rebellionDay(w.startDate)), 0);
    add('war_exhaustion', Math.min(1, longest / B.warDays) * B.warPressure);
    add('war_defeats', activeWars.some(w => (w.attacker === country.tag ? w.warScore : -w.warScore) < B.defeatScore) ? B.defeatPressure : 0);
    add('centralization', country.activeLaws.governance === 'governance_centralized' ? B.centralizedPressure : country.activeLaws.governance === 'governance_decentralized' ? B.decentralizedPressure : 0);
  }
  add('foreign_occupation', wars.some(w => w.occupiedByAttacker?.includes(p.id) || w.occupiedByDefender?.includes(p.id)) && p.originalOwner !== p.owner ? B.occupationPressure : 0);
  add('excessive_mobilization', Math.min(1, Math.max(0, friendlyTroops(p, armies) / Math.max(1, pop.total) - B.recruitmentPopulationRatio) / B.recruitmentPopulationRatio) * B.recruitmentPressure);
  const housing = p.buildings.filter(b => b.type === 'housing' && b.daysRemaining <= 0).reduce((sum, b) => sum + b.level, 0);
  add('housing', -Math.min(B.maxHousingRelief, housing * B.housingRelief));
  add('infrastructure', -p.buildings.filter(b => b.type === 'infrastructure' && b.daysRemaining <= 0).reduce((sum, b) => sum + b.level * B.infrastructureRelief, 0));
  add('military_presence', -Math.min(1, friendlyTroops(p, armies) / Math.max(1, pop.total * B.garrisonPopulationRatio)) * B.garrisonRelief);
  add('resentment', state.resentment);
  add('autonomy', -state.autonomy * B.autonomyPressure);
  add('concessions', state.reliefDays > 0 ? -B.reliefPressure : 0);
  add('investment', state.investmentDays > 0 ? -B.investmentPressure : 0);
  return { total: clamp(modifiers.reduce((sum, m) => sum + m.value, 0)), modifiers };
}
