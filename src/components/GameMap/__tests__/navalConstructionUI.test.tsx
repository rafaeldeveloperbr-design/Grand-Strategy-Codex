// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { countries, provincesData } from '../../../data/map';
import { ProvinceNavalConstruction } from '../../ProvincePanel/ProvinceNavalConstruction';
import { startNavalConstruction, cancelNavalConstruction, emptyNavalConstruction } from '../../../engine/naval/construction';
import { createInitialNavies } from '../../../engine/naval';
import { createDefaultMarket } from '../../../engine/market';
import type { NavalState } from '../../../types/naval';
afterEach(cleanup);
function Harness({ level=1, foreign=false, poor=false }={}) {
  const p=structuredClone(provincesData.find(p=>p.id==='sa_bra_sao_paulo')!);p.market=createDefaultMarket();p.market.goods.iron.stock=1000;p.market.goods.tools.stock=1000;if(foreign)p.owner='USA';
  const c=structuredClone(countries.find(c=>c.tag===p.owner)!);c.resources.gold=poor?0:10000;
  const [state,setState]=useState({naval:{fleets:createInitialNavies(countries,provincesData).filter(f=>f.countryTag==='BRA'),battles:[],construction:{...emptyNavalConstruction(),shipyards:[{provinceId:p.id,level}]}} as NavalState,provinces:[p],countries:[c]});
  return <ProvinceNavalConstruction province={state.provinces[0]} country={state.countries[0]} actor="BRA" naval={state.naval} onBuild={(id,type,target)=>{const next=startNavalConstruction(state.naval,state.provinces,state.countries,'BRA',id,type,0,target);if(!next.error)setState(next);}} onCancel={id=>setState({...state,naval:cancelNavalConstruction(state.naval,id,'BRA')})}/>;
}
describe('Naval construction UI',()=>{
  it('build click pays once, renders queue and cancel removes it without refund',()=>{
    render(<Harness/>);fireEvent.click(screen.getByText('Build Destroyer'));
    expect(screen.getByLabelText('Naval build queue').textContent).toContain('Destroyer');expect(screen.getByText(/Ouro nacional: 9820/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Cancel naval build naval-build-1'));expect(screen.getByLabelText('Naval build queue').textContent).toBe('');expect(screen.getByText(/Ouro nacional: 9820/)).toBeTruthy();
  });
  it('shows insufficient level and disables cruiser/battleship',()=>{render(<Harness/>);expect((screen.getByText('Build Cruiser') as HTMLButtonElement).disabled).toBe(true);expect(screen.getByText('Build Cruiser').parentElement!.textContent).toContain('nível 2');});
  it('level 3 unlocks all four types',()=>{render(<Harness level={3}/>);for(const name of ['Destroyer','Transport','Cruiser','Battleship'])expect((screen.getByText(`Build ${name}`) as HTMLButtonElement).disabled).toBe(false);});
  it('foreign ports remain inspectable but cannot build or upgrade',()=>{render(<Harness foreign/>);expect((screen.getByText('Build Destroyer') as HTMLButtonElement).disabled).toBe(true);expect((screen.getByText('Upgrade Shipyard') as HTMLButtonElement).disabled).toBe(true);});
  it('explains resource shortage',()=>{render(<Harness poor/>);expect(screen.getByText('Build Destroyer').parentElement!.textContent).toContain('Ouro insuficiente');});
  it('upgrade shows progress and blocks production; cancel restores it',()=>{
    render(<Harness/>);fireEvent.click(screen.getByText('Upgrade Shipyard'));expect(screen.getByText(/Upgrade → nível 2/)).toBeTruthy();expect((screen.getByText('Build Destroyer') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Cancelar upgrade'));expect((screen.getByText('Build Destroyer') as HTMLButtonElement).disabled).toBe(false);
  });
  it('can explicitly target docked fleet',()=>{
    render(<Harness/>);fireEvent.change(screen.getByLabelText('Reinforcement fleet'),{target:{value:'fleet-BRA-1'}});fireEvent.click(screen.getByText('Build Destroyer'));expect(screen.getByLabelText('Naval build queue').textContent).toContain('1ª Frota');
  });
});
