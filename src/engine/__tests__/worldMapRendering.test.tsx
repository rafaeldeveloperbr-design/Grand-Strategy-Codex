// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { GameMap } from '../../components/GameMap';
import { useMapControls } from '../../components/GameMap/useMapControls';
import { countries, mapMetadata, provincesData } from '../../data/map';
import { createInitialArmies } from '../../data/map/initialState';
import { saveGame, loadGame, getSaveCompatibilityError, CURRENT_VERSION } from '../saveSystem';
import { createInitialTechState } from '../technology';
import { date } from './helpers/southAmericaAudit';

afterEach(()=>{cleanup();localStorage.clear();vi.unstubAllGlobals();});
function props() { return {provinces:provincesData,countries,armies:[],recruitments:[],buildingConstructions:[],activeBattles:[],selectedProvince:null,hoveredProvince:null,selectedArmy:null,onProvinceHover:vi.fn(),onProvinceClick:vi.fn(),onArmyClick:vi.fn(),onProvinceRightClick:vi.fn()}; }
function saveWorld() {
  return saveGame({provincesRef:{current:provincesData},countriesRef:{current:countries},armiesRef:{current:createInitialArmies(countries)},dateRef:{current:date},warsRef:{current:[]},activeBattlesRef:{current:[]},diplomaticRelationsRef:{current:[]},recruitmentsRef:{current:[]},buildingConstructionsRef:{current:[]},playerTechStateRef:{current:createInitialTechState('BRA')},botTechStatesRef:{current:new Map()}},'world');
}
describe('World Map V1 rendering and interaction', () => {
  it('renders all four regions simultaneously with one selectable shape per province', () => { const view=render(<GameMap {...props()}/>); const nodes=[...view.container.querySelectorAll('[data-province-id]')]; expect(nodes).toHaveLength(196); expect(new Set(nodes.map(n=>n.getAttribute('data-province-id'))).size).toBe(196); expect(view.container.querySelectorAll('[data-province-id^="na_"]')).toHaveLength(35); expect(view.container.querySelectorAll('[data-province-id^="sa_"]')).toHaveLength(56); expect(view.container.querySelectorAll('[data-province-id^="eu_"]')).toHaveLength(56); expect(view.container.querySelectorAll('[data-province-id^="af_"]')).toHaveLength(49); });
  it('selects and hovers a North American province through its real path', () => { const p=props(),view=render(<GameMap {...p}/>); const node=view.container.querySelector('[data-province-id="na_usa_texas"]')!; fireEvent.click(node); expect(p.onProvinceClick).toHaveBeenCalledWith('na_usa_texas'); fireEvent.mouseEnter(node,{clientX:100,clientY:100}); expect(p.onProvinceHover).toHaveBeenCalledWith('na_usa_texas'); expect(view.getByRole('tooltip').textContent).toContain('Texas'); expect(view.getByRole('tooltip').textContent).toContain('Estados Unidos'); fireEvent.mouseLeave(node); expect(view.queryByRole('tooltip')).toBeNull(); });
  it('shows friendly island/capital names without exposing IDs or tags', () => { const view=render(<GameMap {...props()}/>); fireEvent.mouseEnter(view.container.querySelector('[data-province-id="na_cub_cuba"]')!,{clientX:100,clientY:100}); const tooltip=view.getByRole('tooltip'); expect(tooltip.textContent).toContain('Havana'); expect(tooltip.textContent).toContain('Cuba'); expect(tooltip.textContent).not.toMatch(/na_|sa_|\bCUB\b/); expect(view.container.querySelector('svg')?.textContent).not.toMatch(/na_|sa_/); });
  it('uses world metadata and keeps zoom/reset behavior', () => { const view=render(<GameMap {...props()}/>); const svg=view.container.querySelector('svg.map__svg')!,initial=svg.getAttribute('viewBox'); expect(svg.getAttribute('aria-label')).toBe(mapMetadata.name); fireEvent.click(view.getByTitle('Zoom In')); expect(svg.getAttribute('viewBox')).not.toBe(initial); fireEvent.click(view.getByTitle('Reset')); expect(svg.getAttribute('viewBox')).toBe(initial); fireEvent.click(view.getByTitle('Zoom Out')); expect(svg.getAttribute('viewBox')).not.toBe(initial); });
  it('pans in shared SVG coordinates independently of the initial continent', () => { const inverse={}; const ref={current:{getScreenCTM:()=>({inverse:()=>inverse})} as unknown as SVGSVGElement}; vi.stubGlobal('DOMPoint',class {constructor(public x:number,public y:number){} matrixTransform(){return this;} }); const hook=renderHook(()=>useMapControls(ref)); const before=hook.result.current.viewBox; act(()=>hook.result.current.handleMouseDown({button:0,shiftKey:true,clientX:10,clientY:10} as React.MouseEvent)); act(()=>hook.result.current.handleMouseMovePan({clientX:20,clientY:20} as React.MouseEvent)); expect(hook.result.current.viewBox.x).toBeLessThan(before.x); expect(hook.result.current.viewBox.y).toBeLessThan(before.y); act(()=>hook.result.current.handleMouseUp()); expect(hook.result.current.isPanning).toBe(false); });
  it.each([
    ['eu_fra_paris','Paris','França'], ['eu_deu_berlin','Berlim','Alemanha'], ['eu_dnk_copenhagen','Copenhague','Dinamarca'],
    ['af_egy_cairo','Cairo','Egito'], ['af_nga_abuja','Abuja','Nigéria'], ['af_zaf_pretoria','Pretória','África do Sul'],
    ['af_mdg_antananarivo','Antananarivo','Madagascar'],
  ])('selects, hovers and orders through the real new path %s', (id,name,country) => {
    const p = props(), view = render(<GameMap {...p}/>);
    const node = view.container.querySelector(`[data-province-id="${id}"]`)!;
    fireEvent.click(node); expect(p.onProvinceClick).toHaveBeenCalledWith(id);
    fireEvent.mouseEnter(node,{clientX:100,clientY:100}); expect(p.onProvinceHover).toHaveBeenCalledWith(id);
    const tooltip = view.getByRole('tooltip'); expect(tooltip.textContent).toContain(name); expect(tooltip.textContent).toContain(country);
    expect(tooltip.textContent).not.toMatch(/(?:eu|af|na|sa)_[a-z_]+/);
    fireEvent.contextMenu(node); expect(p.onProvinceRightClick).toHaveBeenCalledWith(id);
    fireEvent.mouseLeave(node); expect(view.queryByRole('tooltip')).toBeNull();
  });
  it('renders friendly labels and army markers for every new capital', () => {
    const armies = createInitialArmies(countries), p = props(), view = render(<GameMap {...p} armies={armies}/>);
    const labels = [...view.container.querySelectorAll('.map__province-label')].map(n => n.textContent);
    expect(labels).toContain('Paris'); expect(labels).toContain('Cairo'); expect(labels).toContain('Brasília'); expect(labels).toContain('Texas');
    expect(view.container.querySelector('svg')?.textContent).not.toMatch(/(?:eu|af|na|sa)_[a-z_]+/);
    expect(view.container.querySelectorAll('.army-marker')).toHaveLength(armies.length);
    fireEvent.click(view.getByRole('button',{name:/^França: Exército de França/}));
    expect(p.onArmyClick).toHaveBeenCalledWith('army_init_fra');
    expect(view.getByRole('button',{name:/^Egito: Exército de Egito/})).toBeDefined();
  });
  it('resets to an overview containing every active province center', () => {
    const {x,y,w,h} = mapMetadata.initialViewBox;
    for (const province of provincesData) {
      expect(province.center.x).toBeGreaterThanOrEqual(x); expect(province.center.x).toBeLessThanOrEqual(x+w);
      expect(province.center.y).toBeGreaterThanOrEqual(y); expect(province.center.y).toBeLessThanOrEqual(y+h);
    }
    const view = render(<GameMap {...props()}/>); fireEvent.click(view.getByTitle('Zoom In')); fireEvent.click(view.getByTitle('Reset'));
    expect(view.container.querySelector('svg.map__svg')?.getAttribute('viewBox')).toBe(`${x} ${y} ${w} ${h}`);
  });
});
describe('World Map V1 save identity', () => {
  it('round trips world-v1 without changing save schema version', () => { expect(saveWorld()).toBe(true); const loaded=loadGame('world')!; expect(loaded.mapId).toBe('world-v1'); expect(loaded.version).toBe(CURRENT_VERSION); expect(loaded.world.provinces).toHaveLength(196); expect(loaded.world.countries).toHaveLength(89); });
  it('rejects an explicit old map ID in the loader with a controlled message', () => { saveWorld(); const raw=JSON.parse(localStorage.getItem('imperium_save_world')!); raw.mapId='south-america-v1'; localStorage.setItem('imperium_save_world',JSON.stringify(raw)); expect(loadGame('world')).toBeNull(); expect(getSaveCompatibilityError()).toContain('outro mapa'); expect(getSaveCompatibilityError()).toContain('World Map V1'); });
  it('does not silently replace or merge rejected old saves', () => { saveWorld(); const raw=JSON.parse(localStorage.getItem('imperium_save_world')!); raw.mapId='south-america-v1'; raw.world.provinces=raw.world.provinces.filter((p:{id:string})=>p.id.startsWith('sa_')); const old=JSON.stringify(raw); localStorage.setItem('imperium_save_world',old); expect(loadGame('world')).toBeNull(); expect(localStorage.getItem('imperium_save_world')).toBe(old); });
});
