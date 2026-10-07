import type { Country } from '../types';
import type { CountryTechState, RewardEffect, TechnologyEffect } from '../types/technology';
import type { AIDifficulty } from '../types/difficulty';
import { DIFFICULTY_SPEED_MULTIPLIERS } from '../types/difficulty';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../data/technology';
import { calculateLawModifiers } from './government';
import { getGoodName, getUnitName } from '../utils/translations';

export interface TechnologyBonuses {
  combatPowerBonus: { infantry: number; cavalry: number; artillery: number };
  goldIncomeMultiplier: number;
  buildCostMultiplier: number;
  buildTimeMultiplier: number;
  manpowerMultiplier: number;
  productionMultipliers: Record<'food' | 'wood' | 'iron' | 'tools', number>;
  recruitmentTimeMultiplier: number;
  militaryMaintenanceMultiplier: number;
  fortificationMultiplier: number;
  populationGrowthMultiplier: number;
  populationCapacityMultiplier: number;
  researchSpeedMultiplier: number;
  satisfactionModifier: number;
  migrationAttractionMultiplier: number;
  internalTradeMultiplier: number;
  stabilityModifier: number;
}

export interface TechnologyModifierEntry { label: string; percent: number }
export interface ResearchProgress { current: number; required: number; percent: number; remainingProgress: number; estimatedDaysRemaining: number }

const createNeutralBonuses = (): TechnologyBonuses => ({
  combatPowerBonus: { infantry: 0, cavalry: 0, artillery: 0 },
  goldIncomeMultiplier: 1,
  buildCostMultiplier: 1,
  buildTimeMultiplier: 1,
  manpowerMultiplier: 1,
  productionMultipliers: { food: 1, wood: 1, iron: 1, tools: 1 },
  recruitmentTimeMultiplier: 1,
  militaryMaintenanceMultiplier: 1,
  fortificationMultiplier: 1,
  populationGrowthMultiplier: 1,
  populationCapacityMultiplier: 1,
  researchSpeedMultiplier: 1,
  satisfactionModifier: 0,
  migrationAttractionMultiplier: 1,
  internalTradeMultiplier: 1,
  stabilityModifier: 0,
});

export function normalizeTechState(value: Partial<CountryTechState> | undefined, countryTag = 'UNKNOWN'): CountryTechState {
  const activeResearchId = TECHNOLOGIES.some(technology => technology.id === value?.activeResearchId)
    ? value?.activeResearchId ?? null
    : null;
  return {
    countryTag: value?.countryTag ?? countryTag,
    activeFocusId: NATIONAL_FOCUSES.some(focus => focus.id === value?.activeFocusId) ? value?.activeFocusId ?? null : null,
    activeResearchId,
    completedFocuses: [...new Set((value?.completedFocuses ?? []).filter(id => NATIONAL_FOCUSES.some(focus => focus.id === id)))],
    completedTechnologies: [...new Set((value?.completedTechnologies ?? []).filter(id => TECHNOLOGIES.some(technology => technology.id === id)))],
    focusProgressDays: Number.isFinite(value?.focusProgressDays) ? value?.focusProgressDays ?? 0 : 0,
    researchProgressDays: activeResearchId && Number.isFinite(value?.researchProgressDays) ? Math.max(0, value?.researchProgressDays ?? 0) : 0,
  };
}

export const createInitialTechState = (countryTag: string): CountryTechState => normalizeTechState(undefined, countryTag);

export function startNationalFocus(state: CountryTechState, id: string): CountryTechState | null {
  const focus = NATIONAL_FOCUSES.find(item => item.id === id);
  if (!focus || state.activeFocusId || state.completedFocuses.includes(id)
    || !(focus.prerequisites ?? []).every(prerequisite => state.completedFocuses.includes(prerequisite))) return null;
  return { ...state, activeFocusId: id, focusProgressDays: 0 };
}

export function startTechnologyResearch(state: CountryTechState, id: string, country: Country): { techState: CountryTechState | null; cost: number } {
  const technology = TECHNOLOGIES.find(item => item.id === id);
  if (!technology) return { techState: null, cost: 0 };
  if (state.activeResearchId || state.completedTechnologies.includes(id)
    || !technology.prerequisites.every(prerequisite => state.completedTechnologies.includes(prerequisite))
    || country.resources.gold < technology.costGold) return { techState: null, cost: technology.costGold };
  return { techState: { ...state, activeResearchId: id, researchProgressDays: 0 }, cost: technology.costGold };
}

export function getResearchProgress(state: CountryTechState): ResearchProgress | null {
  const technology = TECHNOLOGIES.find(item => item.id === state.activeResearchId);
  if (!technology) return null;
  const current = Math.min(technology.durationDays, Math.max(0, state.researchProgressDays));
  const speed = calculateTechBonuses(state).researchSpeedMultiplier;
  const remainingProgress = Math.max(0, technology.durationDays - current);
  return { current, required: technology.durationDays, remainingProgress, percent: technology.durationDays ? current / technology.durationDays * 100 : 100, estimatedDaysRemaining: Math.ceil(remainingProgress / speed) };
}

export function processDailyTechProgress(state: CountryTechState, country: Country, difficulty: AIDifficulty = 'medium', isPlayer = false) {
  const normalized = normalizeTechState(state, country.tag);
  const notifications: string[] = [];
  const next = { ...normalized, completedFocuses: [...normalized.completedFocuses], completedTechnologies: [...normalized.completedTechnologies] };
  const difficultySpeed = isPlayer ? 1 : DIFFICULTY_SPEED_MULTIPLIERS[difficulty];
  const lawModifiers = calculateLawModifiers(country.activeLaws);
  if (next.activeFocusId) {
    const focus = NATIONAL_FOCUSES.find(item => item.id === next.activeFocusId);
    if (focus) {
      next.focusProgressDays += difficultySpeed * lawModifiers.focusSpeedMultiplier;
      if (next.focusProgressDays >= focus.durationDays) {
        next.completedFocuses.push(focus.id); next.activeFocusId = null; next.focusProgressDays = 0;
        notifications.push(`✅ Foco concluído: ${focus.title}`);
      }
    }
  }
  if (next.activeResearchId) {
    const technology = TECHNOLOGIES.find(item => item.id === next.activeResearchId);
    if (technology) {
      next.researchProgressDays += difficultySpeed * calculateTechBonuses(next).researchSpeedMultiplier * lawModifiers.researchSpeedMultiplier;
      if (next.researchProgressDays >= technology.durationDays) {
        next.completedTechnologies.push(technology.id); next.activeResearchId = null; next.researchProgressDays = 0;
        notifications.push(`🔬 Pesquisa concluída: ${technology.title}`);
      }
    }
  }
  return { techState: next, notifications };
}

function applyTechnologyEffect(effect: TechnologyEffect, bonuses: TechnologyBonuses) {
  switch (effect.type) {
    case 'GOOD_PRODUCTION': bonuses.productionMultipliers[effect.good] += effect.value; break;
    case 'PRODUCTION_EFFICIENCY': for (const good of ['food', 'wood', 'iron', 'tools'] as const) bonuses.productionMultipliers[good] += effect.value; break;
    case 'RECRUITMENT_TIME': bonuses.recruitmentTimeMultiplier += effect.value; break;
    case 'COMBAT_POWER': for (const unit of ['infantry', 'cavalry', 'artillery'] as const) bonuses.combatPowerBonus[unit] += effect.value; break;
    case 'MILITARY_MAINTENANCE': bonuses.militaryMaintenanceMultiplier += effect.value; break;
    case 'FORTIFICATION_BONUS': bonuses.fortificationMultiplier += effect.value; break;
    case 'POPULATION_GROWTH': bonuses.populationGrowthMultiplier += effect.value; break;
    case 'POPULATION_CAPACITY': bonuses.populationCapacityMultiplier += effect.value; break;
    case 'GOLD_INCOME': bonuses.goldIncomeMultiplier += effect.value; break;
    case 'RESEARCH_SPEED': bonuses.researchSpeedMultiplier += effect.value; break;
  }
}

function applyFocusEffect(effect: RewardEffect, bonuses: TechnologyBonuses) {
  switch (effect.type) {
    case 'COMBAT_POWER': bonuses.combatPowerBonus[effect.unitType] += effect.value; break;
    case 'GOOD_PRODUCTION': bonuses.productionMultipliers[effect.good] += effect.value; break;
    case 'GOLD_INCOME': bonuses.goldIncomeMultiplier += effect.value; break;
    case 'BUILD_COST': bonuses.buildCostMultiplier += effect.value; break;
    case 'BUILD_TIME': bonuses.buildTimeMultiplier += effect.value; break;
    case 'MANPOWER': bonuses.manpowerMultiplier += effect.value; break;
    case 'RESEARCH_SPEED': bonuses.researchSpeedMultiplier += effect.value; break;
    case 'DEFENSE_BONUS': bonuses.fortificationMultiplier += effect.value; break;
    case 'RECRUITMENT_TIME': bonuses.recruitmentTimeMultiplier += effect.value; break;
    case 'MILITARY_MAINTENANCE': bonuses.militaryMaintenanceMultiplier += effect.value; break;
    case 'POPULATION_GROWTH': bonuses.populationGrowthMultiplier += effect.value; break;
    case 'POPULATION_CAPACITY': bonuses.populationCapacityMultiplier += effect.value; break;
    case 'SATISFACTION': bonuses.satisfactionModifier += effect.value; break;
    case 'MIGRATION_ATTRACTION': bonuses.migrationAttractionMultiplier += effect.value; break;
    case 'INTERNAL_TRADE': bonuses.internalTradeMultiplier += effect.value; break;
    case 'STABILITY': bonuses.stabilityModifier += effect.value; break;
  }
}

export function calculateTechnologyBonuses(state: CountryTechState): TechnologyBonuses {
  const bonuses = createNeutralBonuses();
  for (const id of state.completedTechnologies) TECHNOLOGIES.find(technology => technology.id === id)?.effects.forEach(effect => applyTechnologyEffect(effect, bonuses));
  return bonuses;
}

export function calculateTechBonuses(state: CountryTechState): TechnologyBonuses {
  const bonuses = calculateTechnologyBonuses(state);
  for (const id of state.completedFocuses) {
    const focus = NATIONAL_FOCUSES.find(item => item.id === id);
    if (focus) focus.rewardEffects.forEach(effect => applyFocusEffect(effect, bonuses));
  }
  return bonuses;
}

export function getMilitaryCombatBonuses(state: CountryTechState) {
  const bonuses = calculateTechBonuses(state);
  return { ...bonuses.combatPowerBonus, fortificationMultiplier: bonuses.fortificationMultiplier };
}

const signedPercent = (value: number) => Math.round(value * 100);
export function formatTechnologyEffect(effect: TechnologyEffect): string {
  const amount = `${effect.value >= 0 ? '+' : ''}${signedPercent(effect.value)}%`;
  switch (effect.type) {
    case 'GOOD_PRODUCTION': return `Produção de ${getGoodName(effect.good)}: ${amount}`;
    case 'PRODUCTION_EFFICIENCY': return `Eficiência produtiva geral: ${amount}`;
    case 'RECRUITMENT_TIME': return `Tempo de recrutamento: ${amount}`;
    case 'COMBAT_POWER': return `Poder de combate: ${amount}`;
    case 'MILITARY_MAINTENANCE': return `Manutenção militar: ${amount}`;
    case 'FORTIFICATION_BONUS': return `Bônus de fortificações: ${amount}`;
    case 'POPULATION_GROWTH': return `Crescimento populacional: ${amount}`;
    case 'POPULATION_CAPACITY': return `Capacidade populacional: ${amount}`;
    case 'GOLD_INCOME': return `Renda: ${amount}`;
    case 'RESEARCH_SPEED': return `Velocidade de pesquisa: ${amount}`;
  }
}

export function formatFocusEffect(effect: RewardEffect): string {
  const percent = `${effect.value >= 0 ? '+' : ''}${signedPercent(effect.value)}%`;
  switch (effect.type) {
    case 'COMBAT_POWER': return `Poder de ${getUnitName(effect.unitType)}: ${percent}`;
    case 'GOOD_PRODUCTION': return `Produção de ${getGoodName(effect.good)}: ${percent}`;
    case 'GOLD_INCOME': return `Renda nacional: ${percent}`;
    case 'BUILD_COST': return `Custo de construção: ${percent}`;
    case 'BUILD_TIME': return `Velocidade de construção: ${percent}`;
    case 'MANPOWER': return `Manpower: ${percent}`;
    case 'STABILITY': return `Estabilidade administrativa: ${percent}`;
    case 'RESEARCH_SPEED': return `Velocidade de pesquisa: ${percent}`;
    case 'DEFENSE_BONUS': return `Defesa por fortificações: ${percent}`;
    case 'RECRUITMENT_TIME': return `Tempo de recrutamento: ${percent}`;
    case 'MILITARY_MAINTENANCE': return `Manutenção militar: ${percent}`;
    case 'POPULATION_GROWTH': return `Crescimento populacional: ${percent}`;
    case 'POPULATION_CAPACITY': return `Capacidade populacional: ${percent}`;
    case 'SATISFACTION': return `Satisfação: +${effect.value} pontos`;
    case 'MIGRATION_ATTRACTION': return `Atração migratória: ${percent}`;
    case 'INTERNAL_TRADE': return `Eficiência do comércio interno: ${percent}`;
  }
}

export function getActiveTechnologyModifierEntries(state: CountryTechState): TechnologyModifierEntry[] {
  const bonuses = calculateTechnologyBonuses(state);
  const entries: TechnologyModifierEntry[] = [];
  const add = (label: string, value: number, neutral = 1) => { if (Math.abs(value - neutral) > Number.EPSILON) entries.push({ label, percent: signedPercent(value - neutral) }); };
  for (const good of ['food', 'wood', 'iron', 'tools'] as const) add(`Produção de ${getGoodName(good)}`, bonuses.productionMultipliers[good]);
  add('Renda', bonuses.goldIncomeMultiplier);
  add('Crescimento populacional', bonuses.populationGrowthMultiplier);
  add('Capacidade populacional', bonuses.populationCapacityMultiplier);
  add('Velocidade de recrutamento', 2 - bonuses.recruitmentTimeMultiplier);
  add('Poder de combate', 1 + Math.max(...Object.values(bonuses.combatPowerBonus)));
  add('Manutenção militar', 2 - bonuses.militaryMaintenanceMultiplier);
  add('Fortificações', bonuses.fortificationMultiplier);
  add('Velocidade de pesquisa', bonuses.researchSpeedMultiplier);
  return entries;
}
