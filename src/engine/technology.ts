import { INITIAL_RESEARCH_SLOTS, MAX_RESEARCH_SLOTS } from '../constants/research';
import { UNIT_DEFINITIONS } from '../data/units';
import type { UnitType } from '../types';
import type { Country } from '../types';
import type { CountryTechState, RewardEffect, TechnologyEffect } from '../types/technology';
import type { AIDifficulty } from '../types/difficulty';
import { DIFFICULTY_SPEED_MULTIPLIERS } from '../types/difficulty';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../data/technology';
import { calculateLawModifiers } from './government';
import { getGoodName, getUnitName } from '../utils/translations';

export interface TechnologyBonuses {
  combatPowerBonus: Record<UnitType, number>;
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
  researchSlotBonus: number;
  satisfactionModifier: number;
  migrationAttractionMultiplier: number;
  internalTradeMultiplier: number;
  stabilityModifier: number;
}

export interface TechnologyModifierEntry { label: string; percent: number }
export interface ResearchProgress { current: number; required: number; percent: number; remainingProgress: number; estimatedDaysRemaining: number }

const createNeutralBonuses = (): TechnologyBonuses => ({
  combatPowerBonus: Object.fromEntries(Object.keys(UNIT_DEFINITIONS).map(id => [id, 0])) as Record<UnitType, number>,
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
  researchSlotBonus: 0,
  satisfactionModifier: 0,
  migrationAttractionMultiplier: 1,
  internalTradeMultiplier: 1,
  stabilityModifier: 0,
});

/** Capacity is derived from accumulated bonuses; slots are the only research state. */
export function getResearchSlotCount(state: CountryTechState): number {
  return Math.min(MAX_RESEARCH_SLOTS, Math.max(INITIAL_RESEARCH_SLOTS,
    INITIAL_RESEARCH_SLOTS + Math.floor(calculateTechBonuses(state).researchSlotBonus)));
}

/** Accept unknown save content at the boundary; canonical slot data wins over legacy fields. */
export function normalizeTechState(value: unknown, countryTag = 'UNKNOWN'): CountryTechState {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const validIds = (input: unknown, ids: Set<string>) => Array.isArray(input)
    ? [...new Set(input.filter((id): id is string => typeof id === 'string' && ids.has(id)))] : [];
  const completedFocuses = validIds(raw.completedFocuses, new Set(NATIONAL_FOCUSES.map(item => item.id)));
  const completedTechnologies = validIds(raw.completedTechnologies, new Set(TECHNOLOGIES.map(item => item.id)));
  const activeFocusId = NATIONAL_FOCUSES.some(item => item.id === raw.activeFocusId) ? raw.activeFocusId as string : null;
  const progress = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0,v) : 0;
  const next: CountryTechState = {
    countryTag: typeof raw.countryTag === 'string' ? raw.countryTag : countryTag,
    activeFocusId, completedFocuses, completedTechnologies,
    focusProgressDays: activeFocusId ? progress(raw.focusProgressDays) : 0,
    researchSlots: [],
  };
  const count = getResearchSlotCount(next);
  const candidates: unknown[] = Array.isArray(raw.researchSlots) ? raw.researchSlots
    : [{id:0,technologyId:raw.activeResearchId,progressDays:raw.researchProgressDays}];
  const seen = new Set<string>();
  for (let id = 0; id < count; id++) {
    // First entry with a valid matching ID wins; malformed/locked IDs are discarded.
    const slot = candidates.find(item => item && typeof item === 'object' && (item as Record<string,unknown>).id === id) as Record<string,unknown> | undefined;
    const technologyId = typeof slot?.technologyId === 'string' && TECHNOLOGIES.some(item => item.id === slot.technologyId)
      && !completedTechnologies.includes(slot.technologyId) && !seen.has(slot.technologyId) ? slot.technologyId : null;
    if (technologyId) seen.add(technologyId);
    next.researchSlots.push({id,technologyId,progressDays:technologyId ? progress(slot?.progressDays) : 0});
  }
  return next;
}

export const createInitialTechState = (countryTag: string): CountryTechState => normalizeTechState(undefined, countryTag);

/** Canonical start validation. An already active focus cannot be restarted. */
export function getFocusBlockReason(state: CountryTechState, id: string): string | null {
  const focus = NATIONAL_FOCUSES.find(item => item.id === id);
  if (!focus) return 'Foco inexistente';
  if (state.completedFocuses.includes(id)) return 'Foco já concluído';
  if (state.activeFocusId) return state.activeFocusId === id ? 'Foco já ativo' : 'Outro foco já ativo';
  if (!(focus.prerequisites ?? []).every(prerequisite => state.completedFocuses.includes(prerequisite))) return 'Pré-requisitos incompletos';
  // Check both directions so an asymmetric definition still blocks the choice.
  if (NATIONAL_FOCUSES.some(other => state.completedFocuses.includes(other.id)
    && ((focus.mutuallyExclusive ?? []).includes(other.id) || (other.mutuallyExclusive ?? []).includes(id)))) return 'Escolha mutuamente exclusiva já concluída';
  return null;
}

export function startNationalFocus(state: CountryTechState, id: string): CountryTechState | null {
  if (getFocusBlockReason(state, id)) return null;
  return { ...state, activeFocusId: id, focusProgressDays: 0 };
}

export function cancelNationalFocus(state: CountryTechState): CountryTechState {
  return { ...state, activeFocusId: null, focusProgressDays: 0 };
}

/** Without a target, inspect availability in the first empty unlocked slot. */
export function getTechnologyBlockReason(state: CountryTechState, id: string, country: Country, slotId?: number): string | null {
  const technology = TECHNOLOGIES.find(item => item.id === id);
  if (!technology) return 'Tecnologia inexistente';
  if (state.completedTechnologies.includes(id)) return 'Tecnologia já concluída';
  if (state.researchSlots.some(slot => slot.technologyId === id)) return 'Tecnologia já sendo pesquisada';
  const target = slotId ?? state.researchSlots.find(slot => !slot.technologyId && slot.id < getResearchSlotCount(state))?.id;
  if (target === undefined) return 'Nenhum slot de pesquisa livre';
  if (!Number.isInteger(target) || target < 0 || target >= MAX_RESEARCH_SLOTS) return 'Slot de pesquisa inexistente';
  if (target >= getResearchSlotCount(state)) return 'Slot de pesquisa bloqueado';
  const slot = state.researchSlots.find(item => item.id === target);
  if (!slot) return 'Slot de pesquisa inexistente';
  if (slot.technologyId) return 'Slot de pesquisa ocupado';
  if (!technology.prerequisites.every(prerequisite => state.completedTechnologies.includes(prerequisite))) return 'Pré-requisitos incompletos';
  if (country.resources.gold < technology.costGold) return 'Ouro insuficiente';
  return null;
}

export function startTechnologyResearch(state: CountryTechState, id: string, country: Country, slotId = 0): { techState: CountryTechState | null; cost: number } {
  if (getTechnologyBlockReason(state, id, country, slotId)) return { techState: null, cost: 0 };
  const technology = TECHNOLOGIES.find(item => item.id === id)!;
  return { techState: { ...state, researchSlots: state.researchSlots.map(slot => slot.id === slotId ? {...slot, technologyId:id, progressDays:0} : slot) }, cost: technology.costGold };
}

export function cancelTechnologyResearch(state: CountryTechState, slotId = 0): CountryTechState {
  return { ...state, researchSlots: state.researchSlots.map(slot => slot.id === slotId ? {...slot,technologyId:null,progressDays:0} : slot) };
}

export function getResearchProgress(state: CountryTechState, slotId = 0): ResearchProgress | null {
  const slot = state.researchSlots.find(item => item.id === slotId);
  const technology = TECHNOLOGIES.find(item => item.id === slot?.technologyId);
  if (!technology || !slot) return null;
  const current = Math.min(technology.durationDays, Math.max(0, slot.progressDays));
  const speed = calculateTechBonuses(state).researchSpeedMultiplier;
  const remainingProgress = Math.max(0, technology.durationDays - current);
  return { current, required: technology.durationDays, remainingProgress, percent: technology.durationDays ? current / technology.durationDays * 100 : 100, estimatedDaysRemaining: Math.ceil(remainingProgress / speed) };
}

export function processDailyFocusProgress(state: CountryTechState, country: Country, difficulty: AIDifficulty = 'medium', isPlayer = false) {
  const normalized = normalizeTechState(state, country.tag);
  const notifications: string[] = [];
  const next = { ...normalized, completedFocuses: [...normalized.completedFocuses] };
  const difficultySpeed = isPlayer ? 1 : DIFFICULTY_SPEED_MULTIPLIERS[difficulty];
  const lawModifiers = calculateLawModifiers(country.activeLaws);
  if (next.activeFocusId) {
    const focus = NATIONAL_FOCUSES.find(item => item.id === next.activeFocusId);
    if (focus) {
      next.focusProgressDays += difficultySpeed * lawModifiers.focusSpeedMultiplier;
      if (next.focusProgressDays >= focus.durationDays) {
        if (!next.completedFocuses.includes(focus.id)) next.completedFocuses.push(focus.id);
        next.activeFocusId = null;
        next.focusProgressDays = 0;
        notifications.push(`✅ Foco concluído: ${focus.title}`);
      }
    }
  }
  return { techState: normalizeTechState(next, country.tag), notifications };
}

export function processDailyTechProgress(state: CountryTechState, country: Country, difficulty: AIDifficulty = 'medium', isPlayer = false) {
  const { techState: focusState, notifications } = processDailyFocusProgress(state, country, difficulty, isPlayer);
  const research = processDailyResearchProgress(focusState, country, difficulty, isPlayer);
  return { techState: research.techState, notifications: [...notifications, ...research.notifications] };
}

export function processDailyResearchProgress(state: CountryTechState, country: Country, difficulty: AIDifficulty = 'medium', isPlayer = false) {
  const normalized = normalizeTechState(state, country.tag);
  const notifications: string[] = [];
  const next = { ...normalized, completedTechnologies: [...normalized.completedTechnologies] };
  const difficultySpeed = isPlayer ? 1 : DIFFICULTY_SPEED_MULTIPLIERS[difficulty];
  const lawModifiers = calculateLawModifiers(country.activeLaws);
  // Normalization sorts IDs and clones slots. Recalculate bonuses after each completion.
  for (const slot of next.researchSlots) {
    const technology = TECHNOLOGIES.find(item => item.id === slot.technologyId);
    if (!technology) continue;
    slot.progressDays += difficultySpeed * calculateTechBonuses(next).researchSpeedMultiplier * lawModifiers.researchSpeedMultiplier;
    if (slot.progressDays >= technology.durationDays) {
      if (!next.completedTechnologies.includes(technology.id)) next.completedTechnologies.push(technology.id);
      slot.technologyId = null; slot.progressDays = 0;
      notifications.push(`🔬 Pesquisa concluída: ${technology.title}`);
    }
  }
  return { techState: next, notifications };
}

function applyTechnologyEffect(effect: TechnologyEffect, bonuses: TechnologyBonuses) {
  switch (effect.type) {
    case 'GOOD_PRODUCTION': bonuses.productionMultipliers[effect.good] += effect.value; break;
    case 'PRODUCTION_EFFICIENCY': for (const good of ['food', 'wood', 'iron', 'tools'] as const) bonuses.productionMultipliers[good] += effect.value; break;
    case 'RECRUITMENT_TIME': bonuses.recruitmentTimeMultiplier += effect.value; break;
    case 'COMBAT_POWER': for (const unit of Object.keys(UNIT_DEFINITIONS) as UnitType[]) bonuses.combatPowerBonus[unit] += effect.value; break;
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
    case 'RESEARCH_SLOTS': bonuses.researchSlotBonus += effect.value; break;
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
    case 'RESEARCH_SLOTS': return `Slots de pesquisa: +${effect.value}`;
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
