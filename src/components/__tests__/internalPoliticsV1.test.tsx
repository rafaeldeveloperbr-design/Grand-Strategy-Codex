// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, within, act } from '@testing-library/react';
import { GovernmentModal } from '../GovernmentModal';
import { TopBar } from '../TopBar';
import { countries, provincesData } from '../../data/map';
import { initializePolitics, changeGovernmentPolicy, GROUP_IDS, calculatePoliticalGroups, politicsDay, processPoliticalTick } from '../../engine/politics';
import { saveGame, loadGame } from '../../engine/saveSystem';
import { createInitialTechState } from '../../engine/technology';
import { DEFAULT_LAWS } from '../../constants/laws';
import { useTechActions } from '../../hooks/app/useTechActions';

afterEach(() => {cleanup();localStorage.clear();});
const date={year:1444,month:11,day:11};
function setup() {
  const country=initializePolitics({...structuredClone(countries[0]),activeLaws:{...DEFAULT_LAWS}});
  country.resources.gold=10000;
  const provinces=structuredClone(provincesData.filter(p => p.owner===country.tag));
  const onEnactLaw=vi.fn(),onClose=vi.fn();
  return {country,provinces,props:{playerCountry:country,provinces,armies:[],wars:[],date,atWar:false,onEnactLaw,onClose},onEnactLaw};
}
describe('Internal Politics V1 UI',() => {
  it('renders national government, legitimacy, stability, support, capital and all five groups',() => {
    const {props}=setup(),view=render(<GovernmentModal {...props}/>);
    expect(view.getByRole('dialog',{name:'Governo'})).toBeTruthy();expect(view.getByText(/Monarquia Constitucional/)).toBeTruthy();
    for(const label of ['Legitimidade','Estabilidade','Apoio ao governo','Capital político']) expect(view.getByRole('progressbar',{name:label})).toBeTruthy();
    for(const group of calculatePoliticalGroups(props.playerCountry,{provinces:props.provinces,armies:[],wars:[]})) {
      expect(view.getByRole('progressbar',{name:`Influência ${group.name}`}).getAttribute('value')).toBe(String(group.influence));
      expect(view.getByRole('progressbar',{name:`Aprovação ${group.name}`})).toBeTruthy();
    }
    expect(view.queryByRole('combobox')).toBeNull(); // no free government switch
  });
  it('shows current canonical policies and requires confirmation before sending the action',() => {
    const {props,onEnactLaw}=setup(),view=render(<GovernmentModal {...props}/>);
    expect(view.getByText('Atual: Tributação Normal')).toBeTruthy();expect(view.getByText('Atual: Gasto Militar Normal')).toBeTruthy();
    fireEvent.click(view.getByRole('button',{name:'Adotar Tributação Baixa'}));expect(onEnactLaw).not.toHaveBeenCalled();
    const dialog=view.getByRole('alertdialog',{name:'Confirmar mudança de política'});
    expect(dialog.textContent).toContain('capital político');expect(dialog.textContent).toContain('365 dias');
    fireEvent.click(within(dialog).getByRole('button',{name:'Confirmar mudança'}));expect(onEnactLaw).toHaveBeenCalledExactlyOnceWith('taxation','taxation_low');
  });
  it('canceling confirmation preserves state and sends no action',() => {
    const {props,onEnactLaw}=setup(),before=JSON.stringify(props.playerCountry),view=render(<GovernmentModal {...props}/>);
    fireEvent.click(view.getByRole('button',{name:'Adotar Gasto Militar Alto'}));fireEvent.click(view.getByRole('button',{name:'Cancelar'}));
    expect(onEnactLaw).not.toHaveBeenCalled();expect(JSON.stringify(props.playerCountry)).toBe(before);expect(view.queryByRole('alertdialog')).toBeNull();
  });
  it('shows insufficient capital and cooldown, and revalidates while confirmation is open',() => {
    const {country,props,onEnactLaw}=setup(),view=render(<GovernmentModal {...props}/>);
    fireEvent.click(view.getByRole('button',{name:'Adotar Tributação Baixa'}));
    const spent={...country,politics:{...country.politics!,politicalCapital:0}};
    view.rerender(<GovernmentModal {...props} playerCountry={spent}/>);
    expect(view.getByRole('alert')).toHaveProperty('textContent','Capital político insuficiente');
    expect(view.getByRole('button',{name:'Confirmar mudança'}).hasAttribute('disabled')).toBe(true);expect(onEnactLaw).not.toHaveBeenCalled();
    const changed=changeGovernmentPolicy(country,'taxation_low',date).country;
    view.rerender(<GovernmentModal {...props} playerCountry={changed}/>);
    expect(view.getAllByText('Cooldown: 365 dias').length).toBeGreaterThan(0);
  });
  it('opens through the explicit TopBar government button',() => {
    const {country}=setup(),open=vi.fn();const view=render(<TopBar playerCountry={country} date={date} gameSpeed={0} onSpeedChange={vi.fn()} onResearchClick={vi.fn()} onFocusClick={vi.fn()} onGovernmentClick={open}/>);
    fireEvent.click(view.getByRole('button',{name:'Abrir Governo'}));expect(open).toHaveBeenCalledOnce();
  });
});

function actionHook() {
  const {country}=setup(),technology=createInitialTechState(country.tag),countriesRef={current:[country]},setAllCountries=vi.fn(),addToast=vi.fn();
  const hook=renderHook(() => useTechActions({playerCountry:country,playerCountryTag:country.tag,playerTechState:technology,setPlayerTechState:vi.fn(),allCountries:[country],setAllCountries,addLog:vi.fn(),addToast,playerTechStateRef:{current:technology},setAiDifficulty:vi.fn(),setEndGameType:vi.fn(),setGameStats:vi.fn(),setGameSpeed:vi.fn(),setIsPaused:vi.fn(),countriesRef,dateRef:{current:date},warsRef:{current:[]}}));
  return {country,countriesRef,setAllCountries,addToast,...hook};
}
describe('Internal Politics V1 live policy transaction',() => {
  it('revalidates the latest treasury rather than the country captured when opening the panel',() => {
    const hook=actionHook();hook.countriesRef.current=[{...hook.country,resources:{...hook.country.resources,gold:50,prestige:123}}];
    act(() => hook.result.current.handleEnactLaw('taxation','taxation_low'));
    expect(hook.setAllCountries).not.toHaveBeenCalled();expect(hook.countriesRef.current[0].resources.gold).toBe(50);expect(hook.countriesRef.current[0].resources.prestige).toBe(123);
    expect(hook.addToast).toHaveBeenCalledWith('Ouro insuficiente','error','Lei bloqueada');
  });
  it('updates authoritative state immediately so a second action cannot bypass cost/cooldown',() => {
    const hook=actionHook();act(() => {hook.result.current.handleEnactLaw('taxation','taxation_low');hook.result.current.handleEnactLaw('social','social_supportive');});
    expect(hook.setAllCountries).toHaveBeenCalledOnce();expect(hook.countriesRef.current[0].activeLaws.taxation).toBe('taxation_low');expect(hook.countriesRef.current[0].activeLaws.social).toBe('social_balanced');
    expect(hook.countriesRef.current[0].resources.gold).toBe(hook.country.resources.gold-300);
  });
});

function refs(country:ReturnType<typeof setup>['country'],provinces:ReturnType<typeof setup>['provinces']) {
  return {dateRef:{current:date},countriesRef:{current:[country]},provincesRef:{current:provinces},armiesRef:{current:[]},warsRef:{current:[]},diplomaticRelationsRef:{current:[]},recruitmentsRef:{current:[]},buildingConstructionsRef:{current:[]},playerTechStateRef:{current:createInitialTechState(country.tag)},botTechStatesRef:{current:new Map()},activeBattlesRef:{current:[]}};
}
describe('Internal Politics V1 save migration',() => {
  it('round-trips political history, government, capital, policies and cooldown without derived caches',() => {
    const {country,provinces}=setup();country.politics!.lastTickDay=politicsDay(date);
    const changed=changeGovernmentPolicy(country,'military_spending_high',date).country;changed.politics!.approval.workers=-55;
    saveGame(refs(changed,provinces),'politics');const loaded=loadGame('politics')!;
    expect(loaded.world.countries[0].politics).toEqual(changed.politics);expect(loaded.world.countries[0].resources.stability).toBe(changed.resources.stability);
    expect(loaded.world.countries[0].activeLaws).toEqual(changed.activeLaws);
    const raw=JSON.parse(localStorage.getItem('imperium_save_politics')!);expect(raw.version).toBe(2);
    expect(raw.world.countries[0].politics).not.toHaveProperty('influence');expect(raw.world.countries[0].politics).not.toHaveProperty('governmentSupport');
    const before=processPoliticalTick([changed],{provinces,armies:[],wars:[],date:{...date,month:12}}).countries;
    const after=processPoliticalTick(loaded.world.countries,{provinces:loaded.world.provinces,armies:[],wars:[],date:{...date,month:12}}).countries;
    expect(after[0].politics).toEqual(before[0].politics);
  });
  it('migrates old V2 fields with safe defaults while retaining taxes, governance and stability',() => {
    const {country,provinces}=setup();saveGame(refs(country,provinces),'legacy-v2');
    const raw=JSON.parse(localStorage.getItem('imperium_save_legacy-v2')!);delete raw.world.countries[0].politics;delete raw.world.countries[0].activeLaws.social;delete raw.world.countries[0].activeLaws.militarySpending;
    raw.world.countries[0].activeLaws.taxation='taxation_high';raw.world.countries[0].activeLaws.governance='governance_decentralized';
    localStorage.setItem('imperium_save_legacy-v2',JSON.stringify(raw));const loaded=loadGame('legacy-v2')!.world.countries[0];
    expect(loaded.politics!.politicalCapital).toBe(40);expect(loaded.resources.stability).toBe(country.resources.stability);
    expect(loaded.activeLaws.taxation).toBe('taxation_high');expect(loaded.activeLaws.governance).toBe('governance_decentralized');expect(loaded.activeLaws.social).toBe('social_balanced');
  });
  it('migrates V1 and clamps malformed political state',() => {
    const {country,provinces}=setup();country.politics!.legitimacy=500;country.politics!.politicalCapital=-10;country.resources.stability=200;
    localStorage.setItem('imperium_save_legacy-v1',JSON.stringify({version:1,id:'legacy-v1',name:'Legacy',timestamp:0,date,provinces,countries:[country],armies:[],wars:[],relations:[],recruitments:[],constructions:[],activeBattles:[],playerTech:createInitialTechState(country.tag),botTechs:{}}));
    const loaded=loadGame('legacy-v1')!.world.countries[0];expect(loaded.politics!.legitimacy).toBe(100);expect(loaded.politics!.politicalCapital).toBe(0);expect(loaded.resources.stability).toBe(100);
    for(const id of GROUP_IDS) expect(Number.isFinite(loaded.politics!.approval[id])).toBe(true);
  });
});
