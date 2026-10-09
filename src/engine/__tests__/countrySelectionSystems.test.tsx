// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import * as aiEngine from '../aiEngine';
import { useTechActions } from '../../hooks/app/useTechActions';
import { useDiplomacyActions } from '../../hooks/app/useDiplomacyActions';
import { countries, provincesData } from '../../data/map';
import { createInitialTechState } from '../technology';
import { NATIONAL_FOCUSES } from '../../data/technology';

vi.mock('../../components/GameMap', () => ({ GameMap: () => <div aria-label="Mapa" /> }));
const country = (tag: string) => structuredClone(countries.find(c => c.tag === tag)!);
const ignore = () => undefined;
beforeEach(() => { localStorage.clear(); window.history.replaceState({}, '', '/?newgame=1'); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('selected country uses existing player systems', () => {
  it('real game loop stays absent before confirmation, then advances date and excludes the selected player from military and economic AI', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(ignore);
    const military = vi.spyOn(aiEngine, 'processAI').mockImplementation((_tag, armies) => armies);
    const economic = vi.spyOn(aiEngine, 'processAIEconomicDecisions');
    render(<App />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(military).not.toHaveBeenCalled();
    expect(economic).not.toHaveBeenCalled();
    expect(localStorage.getItem('imperium_save_autosave')).toBeNull();
    fireEvent.click(within(screen.getByLabelText('Países disponíveis')).getByRole('button', { name: 'Andorra' }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(military).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Jogar como Andorra' }));
    expect(screen.getByText('11 de Novembro, 1444')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Velocidade 1'));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('12 de Novembro, 1444')).toBeTruthy();
    expect(military.mock.calls.length).toBeGreaterThanOrEqual(24);
    expect(military.mock.calls.length).toBeLessThan(200);
    expect(military.mock.calls.map(call => call[0])).not.toContain('AND');
    expect(military.mock.calls.map(call => call[0])).toContain('BRA');
    expect(military.mock.calls.map(call => call[0])).toContain('FRA');
    expect(military.mock.calls.map(call => call[0])).toContain('ESP');
    expect(military.mock.calls.map(call => call[0])).not.toContain('TUV');
    expect(economic.mock.calls.map(call => call[0].tag)).toEqual(military.mock.calls.map(call => call[0]));
    expect(economic.mock.calls.map(call => call[0].tag)).not.toContain('AND');
    fireEvent.click(screen.getByTitle('Pausar'));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('12 de Novembro, 1444')).toBeTruthy();
  }, 30_000);

  it('research charges the selected country and national focus keeps its countryTag', () => {
    const player = country('AND'), formerDefault = country('BRA');
    player.resources.gold = 1000;
    const state = createInitialTechState(player.tag);
    const params: Parameters<typeof useTechActions>[0] = {
      playerCountry: player, playerCountryTag: player.tag, playerTechState: state,
      playerTechStateRef: { current: state }, countriesRef: { current: [player, formerDefault] }, allCountries: [player, formerDefault],
      setPlayerTechState: vi.fn(), setAllCountries: vi.fn(), addLog: vi.fn(), addToast: vi.fn(),
      dateRef: { current: { year: 1444, month: 11, day: 11 } }, warsRef: { current: [] },
      setAiDifficulty: vi.fn(), setEndGameType: vi.fn(), setGameStats: vi.fn(), setGameSpeed: vi.fn(), setIsPaused: vi.fn(),
    };
    const { result } = renderHook(() => useTechActions(params));
    act(() => result.current.handleStartResearch('sanitation'));
    expect(params.playerTechStateRef.current.countryTag).toBe('AND');
    expect(params.playerTechStateRef.current.researchSlots[0].technologyId).toBe('sanitation');
    expect(params.countriesRef.current.find(c => c.tag === 'AND')!.resources.gold).toBe(700);
    expect(params.countriesRef.current.find(c => c.tag === 'BRA')).toEqual(formerDefault);
    const focus = NATIONAL_FOCUSES.find(f => !f.prerequisites?.length)!;
    act(() => result.current.handleStartFocus(focus.id));
    expect(params.playerTechStateRef.current.countryTag).toBe('AND');
    expect(params.playerTechStateRef.current.activeFocusId).toBe(focus.id);
  });

  it('diplomacy acts as selected country and translates feedback to friendly names', () => {
    const player = country('AND'), target = country('BRA');
    const params: Parameters<typeof useDiplomacyActions>[0] = {
      playerCountryTag: player.tag, diplomacyTarget: target.tag,
      countriesRef: { current: [player, target] }, provincesRef: { current: provincesData.filter(p => ['AND', 'BRA'].includes(p.owner)) },
      armiesRef: { current: [] }, diplomaticRelationsRef: { current: [{ countryA: 'AND', countryB: 'BRA', opinion: 80, trust: 80, status: 'peace' }] }, warsRef: { current: [] }, activeBattlesRef: { current: [] },
      dateRef: { current: { year: 1444, month: 11, day: 11 } }, setDiplomaticRelations: vi.fn(), setWars: vi.fn(),
      setArmies: vi.fn(), setActiveBattles: vi.fn(), addLog: vi.fn(), addToast: vi.fn(),
    };
    const { result } = renderHook(() => useDiplomacyActions(params));
    act(() => result.current.handleAction('guarantee'));
    expect(params.diplomaticRelationsRef.current.some(r => r.countryA === 'AND' || r.countryB === 'AND')).toBe(true);
    expect(result.current.feedback).toContain('Andorra');
    expect(result.current.feedback).toContain('Brasil');
    expect(result.current.feedback).not.toMatch(/\bAND\b|\bBRA\b/);
    expect(params.addToast).toHaveBeenCalledWith(result.current.feedback, 'success', 'Diplomacia');
  });

  it('economy UI displays the chosen country after confirming', () => {
    render(<App />);
    fireEvent.click(within(screen.getByLabelText('Países disponíveis')).getByRole('button', { name: 'Andorra' }));
    fireEvent.click(screen.getByRole('button', { name: 'Jogar como Andorra' }));
    fireEvent.click(screen.getByLabelText('Abrir economia nacional'));
    expect(screen.getAllByText(/Andorra/).length).toBeGreaterThan(1);
    expect(screen.queryByLabelText('Seleção de país')).toBeNull();
  });
});
