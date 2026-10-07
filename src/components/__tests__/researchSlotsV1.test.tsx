// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResearchModal } from '../ResearchModal';
import { FocusModal } from '../FocusModal';
import { createInitialTechState, normalizeTechState } from '../../engine/technology';
import { useTechActions } from '../../hooks/app/useTechActions';
import type { Country } from '../../types';
import type { CountryTechState } from '../../types/technology';

afterEach(cleanup);
const initial = () => createInitialTechState('TST');
const unlocked = () => normalizeTechState({...initial(),completedFocuses:['focus_national_academies']});
const country = {tag:'TST',resources:{gold:10000}} as Country;
const setup = (techState = initial()) => {
  const props = {techState,playerCountry:country,onStartResearch:vi.fn(),onCancelResearch:vi.fn(),onClose:vi.fn()};
  return {...render(<ResearchModal {...props} />),...props};
};
const inspect = (title: string) => fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${title} —`)}));
const active = (): CountryTechState => ({...unlocked(),researchSlots:[{id:0,technologyId:'sanitation',progressDays:15},{id:1,technologyId:'improved_agriculture',progressDays:3}]});

describe('Research slots UI', () => {
  it('shows both slot summaries, with slot 2 locked initially', () => {
    setup(); const section = screen.getByRole('region',{name:'Slots de pesquisa'});
    expect(within(section).getByRole('status',{name:'Slot 1'}).textContent).toContain('Disponível');
    expect(within(section).getByRole('status',{name:'Slot 2'}).textContent).toContain('Bloqueado');
  });
  it('shows slot 2 available after unlock', () => {
    setup(unlocked()); expect(screen.getByRole('status',{name:'Slot 2'}).textContent).toContain('Disponível');
    expect(screen.queryByText('🔒 Bloqueado')).toBeNull();
  });
  it('shows independent progress for both header summaries and nodes', () => {
    setup(active());
    expect(screen.getByRole('progressbar',{name:'Progresso do Slot 1'}).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByRole('progressbar',{name:'Progresso do Slot 2'}).getAttribute('aria-valuenow')).toBe('10');
    expect(screen.getByRole('progressbar',{name:'Progresso de Saneamento'}).getAttribute('aria-valuenow')).toBe('50');
    expect(screen.getByRole('progressbar',{name:'Progresso de Agricultura Melhorada'}).getAttribute('aria-valuenow')).toBe('10');
  });
  it.each([['Saneamento',0],['Agricultura Melhorada',1]] as const)('identifies and cancels the slot for %s', (title,slotId) => {
    const view = setup(active()); inspect(title);
    const popup = screen.getByRole('dialog',{name:`Detalhes de ${title}`});
    expect(within(popup).getByText(`Pesquisando — Slot ${slotId+1}`)).toBeTruthy();
    fireEvent.click(within(popup).getByRole('button',{name:'Cancelar pesquisa'}));
    expect(view.onCancelResearch).toHaveBeenCalledExactlyOnceWith(slotId);
  });
  it('starts directly in the sole initial empty slot', () => {
    const view = setup(); inspect('Saneamento');
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Iniciar pesquisa'}));
    expect(view.onStartResearch).toHaveBeenCalledExactlyOnceWith('sanitation',0);
  });
  it('starts in the sole remaining empty slot without offering the occupied one', () => {
    const state = {...unlocked(),researchSlots:[{id:0,technologyId:'improved_agriculture',progressDays:3},{id:1,technologyId:null,progressDays:0}]};
    const view = setup(state); inspect('Saneamento');
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Iniciar pesquisa'}));
    expect(view.onStartResearch).toHaveBeenCalledExactlyOnceWith('sanitation',1);
  });
  it('allows choosing among two empty slots in the existing popover', () => {
    const view = setup(unlocked()); inspect('Saneamento');
    const choice = screen.getByRole('combobox',{name:'Slot de pesquisa'});
    expect(within(choice).getAllByRole('option').map(option => option.textContent)).toEqual(['Slot 1','Slot 2']);
    fireEvent.change(choice,{target:{value:'1'}});
    fireEvent.click(screen.getByRole('button',{name:'Iniciar pesquisa'}));
    expect(view.onStartResearch).toHaveBeenCalledExactlyOnceWith('sanitation',1);
  });
  it('falls back to the remaining empty slot when selection becomes occupied', () => {
    const view = setup(unlocked()); inspect('Saneamento');
    fireEvent.change(screen.getByRole('combobox'),{target:{value:'1'}});
    view.rerender(<ResearchModal {...view} techState={{...unlocked(),researchSlots:[{id:0,technologyId:null,progressDays:0},{id:1,technologyId:'improved_agriculture',progressDays:0}]}} />);
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Iniciar pesquisa'}));
    expect(view.onStartResearch).toHaveBeenCalledExactlyOnceWith('sanitation',0);
  });
  it('does not show raw technology or focus ids', () => {
    const view = setup(active()); inspect('Saneamento');
    expect(view.container.textContent).not.toMatch(/sanitation|improved_agriculture|focus_national_academies/);
  });
  it('automatically shows the real slot reward in the unchanged Focus tooltip', () => {
    render(<FocusModal techState={initial()} onStartFocus={vi.fn()} onCancelFocus={vi.fn()} onClose={vi.fn()} />);
    inspect('Academias Nacionais');
    const popup = screen.getByRole('dialog',{name:'Detalhes de Academias Nacionais'});
    expect(within(popup).getByText('Slots de pesquisa: +1')).toBeTruthy();
    expect(within(popup).getByText('Velocidade de pesquisa: +10%')).toBeTruthy();
  });
});

describe('Player slot actions and costs', () => {
  function actions(gold = 10000) {
    const state = unlocked();
    const params = {playerCountry:country,playerCountryTag:'TST',playerTechState:state,playerTechStateRef:{current:state},countriesRef:{current:[{...country,resources:{...country.resources,gold}}]},setPlayerTechState:vi.fn(),setAllCountries:vi.fn(),addLog:vi.fn(),addToast:vi.fn()} as unknown as Parameters<typeof useTechActions>[0];
    return {params,...renderHook(() => useTechActions(params))};
  }
  it('charges each slot once even before React rerenders and does not refund cancellation', () => {
    const {result,params} = actions();
    act(() => {
      result.current.handleStartResearch('sanitation',0);
      result.current.handleStartResearch('sanitation',1);
      result.current.handleStartResearch('improved_agriculture',1);
      result.current.handleStartResearch('improved_agriculture',1);
    });
    expect(params.countriesRef.current[0].resources.gold).toBe(9400);
    expect(params.setAllCountries).toHaveBeenCalledTimes(2);
    params.playerTechStateRef.current.researchSlots[1].progressDays = 9;
    act(() => result.current.handleCancelResearch(0));
    expect(params.playerTechStateRef.current.researchSlots[1]).toEqual({id:1,technologyId:'improved_agriculture',progressDays:9});
    expect(params.playerTechStateRef.current.researchSlots[0].technologyId).toBeNull();
    expect(params.countriesRef.current[0].resources.gold).toBe(9400);
  });
  it('rejects insufficient remaining gold in the other slot without a debit', () => {
    const {result,params} = actions(350);
    act(() => { result.current.handleStartResearch('sanitation',0); result.current.handleStartResearch('improved_agriculture',1); });
    expect(params.countriesRef.current[0].resources.gold).toBe(50);
    expect(params.setAllCountries).toHaveBeenCalledOnce();
    expect(params.playerTechStateRef.current.researchSlots[1].technologyId).toBeNull();
  });
});
