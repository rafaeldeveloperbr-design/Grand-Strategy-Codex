// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTechActions } from '../../hooks/app/useTechActions';
import { createInitialTechState } from '../technology';
import type { Country } from '../../types';

describe('player research actions', () => {
  function setup(gold = 1000) {
    const country = { tag: 'TST', resources: { gold } } as Country;
    const state = createInitialTechState('TST');
    const params = {
      playerCountry: country, playerCountryTag: 'TST', playerTechState: state,
      playerTechStateRef: { current: state }, countriesRef: { current: [country] },
      setPlayerTechState: vi.fn(), setAllCountries: vi.fn(), addLog: vi.fn(), addToast: vi.fn(),
    } as unknown as Parameters<typeof useTechActions>[0];
    return { params, ...renderHook(() => useTechActions(params)) };
  }
  it('charges exactly once even when invoked twice before a rerender', () => {
    const { result, params } = setup();
    act(() => {
      result.current.handleStartResearch('sanitation');
      result.current.handleStartResearch('sanitation');
    });
    expect(params.countriesRef.current[0].resources.gold).toBe(700);
    expect(params.setAllCountries).toHaveBeenCalledOnce();
    expect(params.playerTechStateRef.current.activeResearchId).toBe('sanitation');
  });
  it('does not debit blocked research', () => {
    const { result, params } = setup(0);
    act(() => result.current.handleStartResearch('sanitation'));
    expect(params.countriesRef.current[0].resources.gold).toBe(0);
    expect(params.setAllCountries).not.toHaveBeenCalled();
    expect(params.playerTechStateRef.current.activeResearchId).toBeNull();
  });
  it('cancels through the engine and updates the live ref without refund', () => {
    const { result, params } = setup();
    act(() => result.current.handleStartResearch('sanitation'));
    params.playerTechStateRef.current.researchProgressDays = 15;
    act(() => result.current.handleCancelResearch());
    expect(params.playerTechStateRef.current.activeResearchId).toBeNull();
    expect(params.playerTechStateRef.current.researchProgressDays).toBe(0);
    expect(params.countriesRef.current[0].resources.gold).toBe(700);
    expect(params.setPlayerTechState).toHaveBeenLastCalledWith(params.playerTechStateRef.current);
  });
});
