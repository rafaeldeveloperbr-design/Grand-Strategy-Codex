import { DEFAULT_LAWS, LAWS, LAW_CATEGORIES } from '../constants/laws';
import type { ActiveLaws, EnactLawResult, Law, LawContext, LawModifiers } from '../types/government';
import type { Country, Province } from '../types';
import { calculateWorkforce, getFoodShortageStatus, normalizePopulation } from './population';
import { normalizeMarket } from './market';
import { getGoodName } from '../utils/translations';


export const createNeutralLawModifiers = (): LawModifiers => ({
  goldIncomeMultiplier:1, manpowerMultiplier:1, populationGrowthMultiplier:1, populationCapacityMultiplier:1,
  constructionSpeedMultiplier:1, recruitmentTimeMultiplier:1, recruitmentCostMultiplier:1, militaryMaintenanceMultiplier:1,
  researchSpeedMultiplier:1, focusSpeedMultiplier:1, productionMultipliers:{food:1,wood:1,iron:1,tools:1},
  satisfactionModifier:0, purchasingPowerMultiplier:1, migrationAttractionMultiplier:1, internalTradeMultiplier:1, stabilityModifier:0,
});

export function normalizeActiveLaws(value: Partial<ActiveLaws> | undefined): ActiveLaws {
  const normalized: ActiveLaws = { ...DEFAULT_LAWS };
  for (const category of LAW_CATEGORIES) {
    const candidate = value?.[category];
    if (candidate && LAWS[candidate]?.category === category) normalized[category] = candidate;
  }
  return normalized;
}

export function calculateLawModifiers(active: Partial<ActiveLaws> | undefined): LawModifiers {
  const result = createNeutralLawModifiers();
  const normalized = normalizeActiveLaws(active);
  for (const category of LAW_CATEGORIES) {
    const lawId = normalized[category] ?? DEFAULT_LAWS[category];
    const modifiers = lawId ? LAWS[lawId]?.modifiers : undefined;
    if (!modifiers) continue;
    for (const key of ['goldIncomeMultiplier','manpowerMultiplier','populationGrowthMultiplier','populationCapacityMultiplier','constructionSpeedMultiplier','recruitmentTimeMultiplier','recruitmentCostMultiplier','militaryMaintenanceMultiplier','researchSpeedMultiplier','focusSpeedMultiplier','purchasingPowerMultiplier','migrationAttractionMultiplier','internalTradeMultiplier'] as const) result[key] *= modifiers[key] ?? 1;
    for (const key of ['satisfactionModifier','stabilityModifier'] as const) result[key] += modifiers[key] ?? 0;
    for (const good of ['food','wood','iron','tools'] as const) result.productionMultipliers[good] *= modifiers.productionMultipliers?.[good] ?? 1;
  }
  return result;
}

export function getLawBlockReason(law: Law, context: LawContext): string | null {
  if (law.requirements?.atWar && !context.atWar) return 'Disponível somente durante uma guerra';
  return null;
}

export function canEnactLaw(active: Partial<ActiveLaws>, lawId: string, gold: number, context: LawContext): EnactLawResult {
  const law = LAWS[lawId];
  if (!law) return {allowed:false,reason:'Lei inexistente',cost:0};
  if (normalizeActiveLaws(active)[law.category] === law.id) return {allowed:false,reason:'Esta lei já está ativa',cost:law.costGold};
  const requirement = getLawBlockReason(law, context);
  if (requirement) return {allowed:false,reason:requirement,cost:law.costGold};
  if (gold < law.costGold) return {allowed:false,reason:'Ouro insuficiente',cost:law.costGold};
  return {allowed:true,reason:null,cost:law.costGold};
}

export function enactLaw(active: Partial<ActiveLaws>, lawId: string, gold: number, context: LawContext) {
  const validation = canEnactLaw(active, lawId, gold, context);
  const law = LAWS[lawId];
  if (!validation.allowed || !law) return { ...validation, activeLaws:normalizeActiveLaws(active), gold };
  return { ...validation, activeLaws:{...normalizeActiveLaws(active),[law.category]:law.id}, gold:gold-law.costGold };
}

export function formatLawModifierEntries(law: Law): Array<{text:string;positive:boolean}> {
  const result: Array<{text:string;positive:boolean}> = [];
  const percent = (value:number, positiveWhenHigh=true) => ({amount:`${value >= 1 ? '+' : ''}${Math.round((value-1)*100)}%`,positive:positiveWhenHigh ? value>=1 : value<=1});
  const add = (label:string,value:number|undefined,positiveWhenHigh=true) => { if (value === undefined || value === 1) return; const formatted=percent(value,positiveWhenHigh); result.push({text:`${label}: ${formatted.amount}`,positive:formatted.positive}); };
  add('Renda',law.modifiers.goldIncomeMultiplier); add('Manpower máximo e recuperação',law.modifiers.manpowerMultiplier); add('Crescimento populacional',law.modifiers.populationGrowthMultiplier); add('Capacidade populacional',law.modifiers.populationCapacityMultiplier); add('Velocidade de construção',law.modifiers.constructionSpeedMultiplier); add('Tempo de recrutamento',law.modifiers.recruitmentTimeMultiplier,false); add('Custo de recrutamento',law.modifiers.recruitmentCostMultiplier,false); add('Manutenção militar',law.modifiers.militaryMaintenanceMultiplier,false); add('Pesquisa',law.modifiers.researchSpeedMultiplier); add('Progresso de focos',law.modifiers.focusSpeedMultiplier); add('Poder de compra',law.modifiers.purchasingPowerMultiplier); add('Atração migratória',law.modifiers.migrationAttractionMultiplier); add('Comércio interno',law.modifiers.internalTradeMultiplier);
  for (const good of ['food','wood','iron','tools'] as const) add(`Produção de ${getGoodName(good)}`, law.modifiers.productionMultipliers?.[good]);
  if (law.modifiers.satisfactionModifier) result.push({text:`Satisfação: ${law.modifiers.satisfactionModifier>0?'+':''}${law.modifiers.satisfactionModifier} pontos`,positive:law.modifiers.satisfactionModifier>0});
  if (law.modifiers.stabilityModifier) result.push({text:`Estabilidade administrativa: ${law.modifiers.stabilityModifier>0?'+':''}${Math.round(law.modifiers.stabilityModifier*100)}%`,positive:law.modifiers.stabilityModifier>0});
  return result;
}

/** Selects one affordable policy correction from observable simulation state. */
export function chooseAILaw(country: Country, provinces: Province[], context: LawContext): string | null {
  const owned = provinces.filter(province => province.owner === country.tag);
  const population = owned.reduce((sum, province) => sum + normalizePopulation(province.population).total, 0);
  const workforce = owned.reduce((sum, province) => sum + calculateWorkforce(normalizePopulation(province.population)), 0);
  const unemployed = owned.reduce((sum, province) => sum + normalizePopulation(province.population).unemployed, 0);
  const satisfaction = population ? owned.reduce((sum, province) => sum + normalizePopulation(province.population).satisfaction * normalizePopulation(province.population).total, 0) / population : 60;
  const famine = owned.some(province => getFoodShortageStatus(normalizeMarket(province.market).goods.food).ratio > 0);
  const manpowerRatio = country.resources.maxManpower ? country.resources.manpower / country.resources.maxManpower : 1;
  const candidates = context.atWar && manpowerRatio < .25
    ? ['conscription_total','economy_war_total']
    : context.atWar
      ? ['economy_war_early','conscription_limited']
      : famine
        ? ['agrarian_incentives','taxation_low']
        : satisfaction < 45
          ? ['taxation_low','governance_decentralized']
          : country.resources.stability < 35
            ? ['governance_centralized','trade_controlled']
            : workforce > 0 && unemployed / workforce > .2
              ? ['trade_integrated','agrarian_incentives']
              : ['conscription_peacetime','economy_civilian','intel_agency','trade_integrated'];
  return candidates.find(id => canEnactLaw(country.activeLaws,id,country.resources.gold,context).allowed) ?? null;
}
