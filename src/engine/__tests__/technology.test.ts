import { describe, it, expect, vi } from 'vitest';
import {
  createInitialTechState,
  startNationalFocus,
  startTechnologyResearch,
  processDailyTechProgress,
  calculateTechBonuses
} from '../technology';
import type { Country } from '../../types';
import type { AIDifficulty } from '../../types/difficulty';

// Mock de um foco e tech básico do seu data/technology
// Se seu TECHNOLOGIES estiver vazio, esses testes de start vão retornar null e tudo bem
vi.mock('../../data/technology', () => ({
  NATIONAL_FOCUSES: [
    { id: 'focus_1', title: 'Foco 1', durationDays: 10, prerequisites: [], rewardEffect: { type: 'GOLD_INCOME', value: 0.1 } },
    { id: 'focus_2', title: 'Foco 2', durationDays: 10, prerequisites: ['focus_1'], rewardEffect: { type: 'GOLD_INCOME', value: 0.1 } },
  ],
  TECHNOLOGIES: [
    { id: 'tech_1', title: 'Tech 1', durationDays: 30, costGold: 100, prerequisites: [], rewardEffect: { type: 'GOLD_INCOME', value: 0.05 } },
    { id: 'tech_2', title: 'Tech 2', durationDays: 30, costGold: 200, prerequisites: ['tech_1'], rewardEffect: { type: 'COMBAT_POWER', unitType: 'infantry', value: 5 } },
  ]
}));

const baseCountry = {
  tag: 'BRA',
  resources: { gold: 1000 },
} as Country;

describe('TECNOLOGIA', () => {
  it('initial state - cria estado zerado', () => {
    const state = createInitialTechState('BRA');
    expect(state.countryTag).toBe('BRA');
    expect(state.activeFocusId).toBeNull();
    expect(state.completedFocuses.length).toBe(0);
    expect(state.focusProgressDays).toBe(0);
  });

  it('startFocus - inicia foco sem pré-requisito', () => {
    const state = createInitialTechState('BRA');
    const next = startNationalFocus(state, 'focus_1');
    expect(next).not.toBeNull();
    expect(next!.activeFocusId).toBe('focus_1');
    expect(next!.focusProgressDays).toBe(0);
  });

  it('startFocus - bloqueia se já completou', () => {
    const state = { ...createInitialTechState('BRA'), completedFocuses: ['focus_1'] };
    const next = startNationalFocus(state, 'focus_1');
    expect(next).toBeNull();
  });

  it('startFocus - bloqueia se falta pré-requisito', () => {
    const state = createInitialTechState('BRA');
    const next = startNationalFocus(state, 'focus_2'); // precisa de focus_1
    expect(next).toBeNull();
  });

  it('startResearch - bloqueia se ouro insuficiente', () => {
    const state = createInitialTechState('BRA');
    const poor = {
      tag: 'BRA',
      resources: { gold: 10 },
    } as Country;
    const result = startTechnologyResearch(state, 'tech_1', poor);
    expect(result.techState).toBeNull();
    expect(result.cost).toBe(100);
  });

  it('startResearch - inicia com ouro suficiente', () => {
    const state = createInitialTechState('BRA');
    const result = startTechnologyResearch(state, 'tech_1', baseCountry);
    expect(result.techState).not.toBeNull();
    expect(result.techState!.activeResearchId).toBe('tech_1');
  });

  it('daily progress - foco avança 1 dia por tick', () => {
    let state = createInitialTechState('BRA');
    state = startNationalFocus(state, 'focus_1')!;

    const result = processDailyTechProgress(state, baseCountry, 'medium', true);
    expect(result.techState.focusProgressDays).toBe(1);
  });

  it('daily progress - foco completa em 10 dias', () => {
    let state = createInitialTechState('BRA');
    state = startNationalFocus(state, 'focus_1')!;
    state.focusProgressDays = 9;
    const result = processDailyTechProgress(state, baseCountry, 'medium', true);
    expect(result.techState.completedFocuses).toContain('focus_1');
    expect(result.techState.activeFocusId).toBeNull();
    expect(result.notifications[0]).toContain('Foco concluído');
  });

  it('daily progress - IA easy avança mais devagar', () => {
    let state = createInitialTechState('ARG');
    state = startNationalFocus(state, 'focus_1')!;

    const player = processDailyTechProgress(state, baseCountry, 'medium', true);
    const aiEasy = processDailyTechProgress(
      state,
      baseCountry,
      'easy' as AIDifficulty,
      false
    );

    // easy = multiplicador menor que 1.0 no seu DIFFICULTY_SPEED_MULTIPLIERS
    expect(player.techState.focusProgressDays).not.toEqual(aiEasy.techState.focusProgressDays);
  });

  it('bonuses - focos completados geram bônus de ouro', () => {
    const state = { ...createInitialTechState('BRA'), completedFocuses: ['focus_1'] };
    const bonuses = calculateTechBonuses(state);
    expect(bonuses.goldIncomeMultiplier).toBeGreaterThan(1.0);
  });
});