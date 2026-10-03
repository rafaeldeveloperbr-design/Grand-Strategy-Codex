import type { Country, Province } from '../types';
import type { CountryTechState, TechnologyCategory, TechnologyEffect, TechnologyModifiers } from '../types/technology';
import type { AIDifficulty } from '../types/difficulty';
import { DIFFICULTY_SPEED_MULTIPLIERS } from '../types/difficulty';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../data/technology';
import { getBuildingLevel } from '../data/buildings';

export const EMPTY_TECH_MODIFIERS: TechnologyModifiers = {
  foodProduction: 0, woodProduction: 0, ironProduction: 0, toolProduction: 0,
  warehouseCapacity: 0, infrastructureProductivity: 0, constructionSpeed: 0,
  internalTradeEfficiency: 0, armyAttack: 0, armyDefense: 0, fortressDefense: 0,
};

export const LEGACY_TECHNOLOGY_MIGRATION: Record<string, string> = {
  tech_improved_weapons: 'military_training', tech_cavalry_tactics: 'military_metallurgy',
  tech_artillery_development: 'military_metallurgy', tech_fortification_design: 'modern_fortifications',
  tech_construction_techniques: 'civil_engineering', tech_engineering_corps: 'civil_engineering',
  tech_banking_system: 'improved_tools', tech_trade_routes: 'trade_networks',
  tech_mercantilism: 'trade_networks', tech_pre_industrial_manufacturing: 'organized_production',
};

export function migrateTechnologyState(state: CountryTechState): CountryTechState {
  const migrate = (id: string) => LEGACY_TECHNOLOGY_MIGRATION[id] ?? id;
  const completed = [...new Set((state.completedTechnologies ?? []).map(migrate))]
    .filter(id => TECHNOLOGIES.some(tech => tech.id === id));
  const active = state.activeResearchId ? migrate(state.activeResearchId) : null;
  return {
    ...state,
    activeResearchId: active && TECHNOLOGIES.some(tech => tech.id === active) && !completed.includes(active) ? active : null,
    completedTechnologies: completed,
    researchProgressDays: Math.max(0, state.researchProgressDays ?? 0),
    researchSpeed: Math.max(0.1, state.researchSpeed ?? 1),
  };
}

export function getTechnologyModifiers(state?: CountryTechState): TechnologyModifiers {
  const modifiers = { ...EMPTY_TECH_MODIFIERS };
  if (!state) return modifiers;
  for (const id of state.completedTechnologies) {
    const technology = TECHNOLOGIES.find(item => item.id === id);
    for (const effect of technology?.effects ?? []) modifiers[effect.type] += effect.value;
  }
  return modifiers;
}

export function calculateResearchSpeed(provinces: Province[]): number {
  if (!provinces.length) return 1;
  const development = provinces.reduce((sum, province) => sum + province.development, 0) / provinces.length;
  const infrastructure = provinces.reduce((sum, province) => sum + getBuildingLevel(province, 'infrastructure'), 0);
  return Math.round((1 + development * 0.02 + infrastructure * 0.03) * 100) / 100;
}

export function canResearchTechnology(state: CountryTechState, technologyId: string): boolean {
  const technology = TECHNOLOGIES.find(item => item.id === technologyId);
  return !!technology && !state.activeResearchId && !state.completedTechnologies.includes(technologyId)
    && technology.prerequisites.every(id => state.completedTechnologies.includes(id));
}

export function startTechnologyResearch(state: CountryTechState, technologyId: string, country: Country) {
  const technology = TECHNOLOGIES.find(item => item.id === technologyId);
  if (!technology || !canResearchTechnology(state, technologyId) || country.resources.gold < technology.goldCost)
    return { techState: null, cost: technology?.goldCost ?? 0 };
  return { techState: { ...state, activeResearchId: technologyId, researchProgressDays: 0 }, cost: technology.goldCost };
}

export function processDailyTechProgress(
  state: CountryTechState, country: Country, aiDifficulty: AIDifficulty = 'medium', isPlayer = false,
  provinces: Province[] = []
): { techState: CountryTechState; notifications: string[] } {
  const updated = migrateTechnologyState(state);
  const notifications: string[] = [];
  if (updated.activeFocusId) {
    const focus = NATIONAL_FOCUSES.find(item => item.id === updated.activeFocusId);
    if (focus) {
      updated.focusProgressDays += isPlayer ? 1 : DIFFICULTY_SPEED_MULTIPLIERS[aiDifficulty];
      if (updated.focusProgressDays >= focus.durationDays) {
        updated.completedFocuses = [...new Set([...updated.completedFocuses, focus.id])];
        updated.activeFocusId = null; updated.focusProgressDays = 0;
        notifications.push(`✅ Foco concluído: ${focus.title}`);
      }
    }
  }
  const technology = TECHNOLOGIES.find(item => item.id === updated.activeResearchId);
  const researchSpeed = calculateResearchSpeed(provinces.filter(province => province.owner === country.tag));
  updated.researchSpeed = researchSpeed;
  if (technology) {
    const difficulty = isPlayer ? 1 : DIFFICULTY_SPEED_MULTIPLIERS[aiDifficulty];
    updated.researchProgressDays += researchSpeed * difficulty;
    if (updated.researchProgressDays >= technology.researchCost) {
      updated.completedTechnologies = [...new Set([...updated.completedTechnologies, technology.id])];
      updated.activeResearchId = null; updated.researchProgressDays = 0;
      notifications.push(`🔬 Pesquisa concluída: ${technology.name}`);
    }
  }
  return { techState: updated, notifications };
}

export function startNationalFocus(state: CountryTechState, focusId: string): CountryTechState | null {
  const focus = NATIONAL_FOCUSES.find(item => item.id === focusId);
  if (!focus || state.activeFocusId || state.completedFocuses.includes(focusId)
    || !(focus.prerequisites ?? []).every(id => state.completedFocuses.includes(id))) return null;
  return { ...state, activeFocusId: focusId, focusProgressDays: 0 };
}

export function createInitialTechState(countryTag: string): CountryTechState {
  return { countryTag, activeFocusId: null, activeResearchId: null, completedFocuses: [], completedTechnologies: [], focusProgressDays: 0, researchProgressDays: 0, researchSpeed: 1 };
}

export function chooseAITechnology(state: CountryTechState, provinces: Province[], atWar: boolean): string | null {
  const owned = provinces.filter(province => province.owner === state.countryTag);
  const shortage = (good: 'food' | 'iron' | 'tools') => owned.reduce((sum, province) => sum + (province.market?.goods[good].shortage ?? 0), 0);
  const preferred: TechnologyCategory = atWar ? 'MILITARY' : shortage('food') > 0 ? 'AGRICULTURE'
    : shortage('iron') + shortage('tools') > 0 ? 'INDUSTRY' : 'INFRASTRUCTURE';
  return TECHNOLOGIES.filter(technology => technology.category === preferred && canResearchTechnology(state, technology.id))
    .sort((a, b) => a.researchCost - b.researchCost || a.id.localeCompare(b.id))[0]?.id
    ?? TECHNOLOGIES.find(technology => canResearchTechnology(state, technology.id))?.id ?? null;
}

// Compatibility for focus consumers and old call sites.
export function calculateTechBonuses(state: CountryTechState) {
  const modifiers = getTechnologyModifiers(state);
  const bonuses = {
    combatPowerBonus: { infantry: modifiers.armyAttack, cavalry: modifiers.armyAttack, artillery: modifiers.armyAttack },
    goldIncomeMultiplier: 1, buildCostMultiplier: 1,
    buildTimeMultiplier: 1 + modifiers.constructionSpeed,
    manpowerMultiplier: 1,
  };
  for (const id of state.completedFocuses) {
    const effect = NATIONAL_FOCUSES.find(focus => focus.id === id)?.rewardEffect;
    if (effect?.type === 'GOLD_INCOME') bonuses.goldIncomeMultiplier += effect.value;
    if (effect?.type === 'BUILD_COST') bonuses.buildCostMultiplier += effect.value;
    if (effect?.type === 'BUILD_TIME') bonuses.buildTimeMultiplier += effect.value;
    if (effect?.type === 'MANPOWER') bonuses.manpowerMultiplier += effect.value;
    if (effect?.type === 'COMBAT_POWER' && effect.unitType) bonuses.combatPowerBonus[effect.unitType] += effect.value;
  }
  return bonuses;
}

export function formatTechnologyEffect(effect: TechnologyEffect): string {
  const labels: Record<TechnologyEffect['type'], string> = {
    foodProduction: 'produção de FOOD', woodProduction: 'produção de WOOD', ironProduction: 'produção de IRON',
    toolProduction: 'produção de TOOLS', warehouseCapacity: 'capacidade dos Armazéns',
    infrastructureProductivity: 'produtividade de Infraestrutura', constructionSpeed: 'velocidade de construção',
    internalTradeEfficiency: 'eficiência do comércio interno', armyAttack: 'ataque militar', armyDefense: 'defesa militar',
    fortressDefense: 'efeito das Fortalezas',
  };
  return `+${Math.round(effect.value * 100)}% ${labels[effect.type]}`;
}
