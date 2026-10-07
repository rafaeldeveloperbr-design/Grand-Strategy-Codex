// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { countries, provincesData } from '../../../data/map';
import { buildLogisticsNetworks, getProvinceLogistics, logisticsCategory } from '../../../engine/logistics';
import { army } from '../../../engine/__tests__/helpers/southAmericaAudit';
import { getArmySupply } from '../../../engine/military';
import { GameMap } from '../GameMap';
import { GameMapTooltip } from '../GameMapTooltip';
import { buildArmyPresentation, buildWarPresentation } from '../mapPresentation';
import { saveGame, loadGame } from '../../../engine/saveSystem';
import { createInitialTechState } from '../../../engine/technology';
import { ProvinceMilitaryTab } from '../../ProvincePanel/ProvinceMilitaryTab';

afterEach(() => {cleanup();localStorage.clear();});
const capital=structuredClone(provincesData.find(p => p.id==='sa_bra_brasilia')!);
const province={...structuredClone(provincesData.find(p => p.owner==='BRA' && p.id!==capital.id)!),neighbors:[],buildings:[],terrain:'plains' as const};
const provinces=[{...capital,neighbors:[]},province];
const network=() => buildLogisticsNetworks({provinces,countries,relations:[],wars:[]});
const props = () => ({provinces,countries,armies:[],recruitments:[],buildingConstructions:[],activeBattles:[],selectedProvince:null,hoveredProvince:null,selectedArmy:null,onProvinceHover:vi.fn(),onProvinceClick:vi.fn(),onArmyClick:vi.fn(),onProvinceRightClick:vi.fn()});

describe('Logistics V2 map and tooltips',() => {
  it('renders independent logistics colors and highlights Brasília, preserving Supply mode',() => {
    const view=render(<GameMap {...props()} />);
    fireEvent.click(view.getByRole('button',{name:'Modo Logística'}));
    expect(view.getByLabelText('Legenda Logística')).toBeTruthy();
    expect(view.getByLabelText('Origem logística: Brasília')).toBeTruthy();
    expect(view.container.querySelector(`[data-province-id="${capital.id}"]`)?.getAttribute('fill')).toBe(logisticsCategory(getProvinceLogistics(network(),'BRA',capital.id)).color);
    expect(view.container.querySelector(`[data-province-id="${province.id}"]`)?.getAttribute('fill')).toBe('#d64545');
    fireEvent.click(view.getByRole('button',{name:'Modo Supply'}));
    expect(view.queryByLabelText('Origem logística: Brasília')).toBeNull();
    expect(view.getByLabelText('Legenda Supply')).toBeTruthy();
  });
  it('shows connection, origin, distance and efficiency from current province state',() => {
    const cache=network();const presentation=buildArmyPresentation([],provinces,cache);
    const view=render(<GameMapTooltip tooltip={{x:0,y:0,province:capital}} countries={new Map(countries.map(c => [c.tag,c]))} presentation={presentation} war={buildWarPresentation(provinces,countries,[],[],[])} logistics={cache} />);
    expect(view.getByText('Conectada')).toBeTruthy();expect(view.getByText('Origem')).toBeTruthy();expect(view.getByText('Distância')).toBeTruthy();expect(view.getByText('Eficiência logística')).toBeTruthy();
    const tooltip=view.getByRole('tooltip');expect(tooltip.textContent).toContain('Brasília');expect(tooltip.textContent).toContain(`${Math.round(getProvinceLogistics(cache,'BRA',capital.id)!.efficiency*100)}%`);
  });
  it('popover reports actual shared supply and disconnected logistics',() => {
    const units=[army('BRA',province.id,20,'one'),army('BRA',province.id,20,'two')];const data={...props(),armies:units};
    const view=render(<GameMap {...data} />);fireEvent.click(view.getByRole('button',{name:/Brasil: 2 exércitos/}));
    expect(view.getAllByText(/Desconectada/)).toHaveLength(2);
    expect(view.getAllByText(new RegExp(`${Math.round(getArmySupply(units[0],province,units,network()).ratio*100)}%`)).length).toBeGreaterThan(0);
  });
  it('provincial military panel shows supply, connection and distance with readable labels',() => {
    const cache=network(),units=[army('BRA',province.id,20)];
    const view=render(<ProvinceMilitaryTab province={province} playerCountry={countries.find(c => c.tag==='BRA')!} armiesHere={units} technology={createInitialTechState('BRA')} onRecruit={vi.fn()} logistics={cache} />);
    expect(view.getByText('Logística: Desconectada · Distância: —')).toBeTruthy();
    expect(view.getByText(/Supply \d+%/)).toBeTruthy();
  });
});

describe('Logistics V2 save compatibility',() => {
  it('round-trips the existing save format with no network/cache and rebuilds it after load',() => {
    const refs={dateRef:{current:{year:1444,month:11,day:11}},provincesRef:{current:provinces},countriesRef:{current:countries},armiesRef:{current:[]},warsRef:{current:[]},diplomaticRelationsRef:{current:[]},recruitmentsRef:{current:[]},buildingConstructionsRef:{current:[]},playerTechStateRef:{current:createInitialTechState('BRA')},botTechStatesRef:{current:new Map()},activeBattlesRef:{current:[]}};
    const before=network();saveGame(refs,'logistics');const saved=localStorage.getItem('imperium_save_logistics')!;
    expect(JSON.parse(saved).version).toBe(2);expect(saved).not.toContain('dependentProvinces');expect(saved).not.toContain('networks');
    const loaded=loadGame('logistics')!;expect(loaded).not.toBeNull();
    const after=buildLogisticsNetworks({...loaded.world,relations:loaded.diplomacy.relations,wars:loaded.military.wars});
    expect(getProvinceLogistics(after,'BRA',capital.id)).toEqual(getProvinceLogistics(before,'BRA',capital.id));
    expect(getProvinceLogistics(after,'BRA',province.id)).toEqual(getProvinceLogistics(before,'BRA',province.id));
  });
  it('loads a legacy V1 save and resolves its capital without additional persisted fields',() => {
    localStorage.setItem('imperium_save_legacy-logistics',JSON.stringify({version:1,id:'legacy-logistics',name:'Legacy',timestamp:0,date:{year:1444,month:11,day:11},provinces,countries,armies:[],wars:[],relations:[],recruitments:[],constructions:[],playerTech:createInitialTechState('BRA'),botTechs:{},activeBattles:[]}));
    const loaded=loadGame('legacy-logistics')!;expect(loaded).not.toBeNull();
    const cache=buildLogisticsNetworks({...loaded.world,relations:loaded.diplomacy.relations,wars:loaded.military.wars});
    expect(cache.networks.get('BRA')?.originId).toBe(capital.id);
    expect(getProvinceLogistics(cache,'BRA',province.id)?.connected).toBe(false);
  });
});
