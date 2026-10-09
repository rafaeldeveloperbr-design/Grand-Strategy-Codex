// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countries, provincesData, mapMetadata } from '../../../data/map';
import { clampView, zoomView, fitCameraBounds, countryFocusBounds, regionalBounds, MIN_ZOOM, MAX_ZOOM, blocksMapKeyboard } from '../camera';
import { useMapControls } from '../useMapControls';
import { GameMap } from '../GameMap';
import { createInitialArmies } from '../../../data/map/initialState';

afterEach(cleanup);
const box = { x: 1500, y: 600, w: 800, h: 400 };
const center = (b: typeof box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const props = { provinces: provincesData, countries, armies: [], recruitments: [], buildingConstructions: [], activeBattles: [], selectedProvince: null, hoveredProvince: null, selectedArmy: null, playerCountryTag: 'BRA', initialViewBox: box, onProvinceClick: vi.fn(), onProvinceHover: vi.fn(), onArmyClick: vi.fn(), onProvinceRightClick: vi.fn() };
const read = (svg: Element) => { const [x,y,w,h] = svg.getAttribute('viewBox')!.split(' ').map(Number); return {x,y,w,h}; };

describe('camera math', () => {
  it('keeps the cursor world point through repeated zoom cycles', () => {
    let next = box;
    for (let i=0;i<100;i++) { next=zoomView(next,.23,.71,-.1); next=zoomView(next,.23,.71,.1); }
    expect(next.x + next.w*.23).toBeCloseTo(box.x+box.w*.23, 8);
    expect(next.y + next.h*.71).toBeCloseTo(box.y+box.h*.71, 8);
  });
  it('enforces minimum zoom', () => expect(zoomView(box,.5,.5,100).w).toBe(mapMetadata.initialViewBox.w / MIN_ZOOM));
  it('enforces maximum zoom', () => expect(zoomView(box,.5,.5,-100).w).toBe(mapMetadata.initialViewBox.w / MAX_ZOOM));
  it('fits bounds with padding and viewport aspect', () => { const fitted=fitCameraBounds(box,2,.1); expect(fitted.w).toBe(960); expect(center(fitted)).toEqual(center(box)); });
  it('clamps pan in both directions', () => { const left=clampView({...box,x:-1e9,y:-1e9}), right=clampView({...box,x:1e9,y:1e9}); expect(left.x).toBe(-120); expect(right.x).toBe(4360); expect(left.y).toBe(-60); expect(right.y).toBe(2180); });
  it('centers an oversized view', () => expect(center(clampView({x:99,y:99,w:6000,h:3000}))).toEqual({x:2520,y:1260}));
  it.each(['FRA','USA'])('ignores distant holdings of %s', tag => {
    const country=countries.find(c=>c.tag===tag)!, owned=provincesData.filter(p=>p.owner===tag), capital=owned.find(p=>p.id===(country.capitalId??country.capital))!;
    const b=countryFocusBounds(country,provincesData)!;
    expect(center(b)).toEqual(capital.center); expect(b.w).toBeLessThan(2000);
    expect(owned.some(p=>Math.abs(p.center.x-capital.center.x)>900 || Math.abs(p.center.y-capital.center.y)>600)).toBe(true);
  });
  it('does not mutate world data', () => { const before=JSON.stringify([countries,provincesData]); countryFocusBounds(countries[0],provincesData); expect(JSON.stringify([countries,provincesData])).toBe(before); });
  it.each(['Americas','Europe','Asia','Africa','Oceania'])('derives finite bounds for %s', name => { const b=regionalBounds[name]; expect(Number.isFinite(b.x)).toBe(true); expect(b.w).toBeGreaterThan(1); expect(fitCameraBounds(b,2).w).toBeLessThanOrEqual(5040); });
  it.each(['input','textarea','select'])('blocks keyboard in %s', tag => expect(blocksMapKeyboard(document.createElement(tag))).toBe(true));
  it('blocks editable descendants', () => { const parent=document.createElement('div'); parent.contentEditable='true'; parent.setAttribute('contenteditable','true'); const child=document.createElement('span'); parent.append(child); expect(blocksMapKeyboard(child)).toBe(true); });
});

describe('camera interactions', () => {
  it('locates selected army by button and F without changing it', () => {
    const army=createInitialArmies(countries).find(a=>a.owner==='BRA')!, before=JSON.stringify(army);
    render(<GameMap {...props} armies={[army]} selectedArmy={army.id}/>);
    const province=provincesData.find(p=>p.id===army.location)!, svg=screen.getByLabelText(mapMetadata.name);
    fireEvent.click(screen.getByRole('button',{name:'Locate selected entity'})); expect(center(read(svg))).toEqual(province.center);
    fireEvent.keyDown(window,{key:'0'}); fireEvent.keyDown(window,{key:'f'}); expect(center(read(svg))).toEqual(province.center);
    expect(JSON.stringify(army)).toBe(before);
  });
  it('wheel zooms and prevents page scrolling', () => {
    render(<GameMap {...props}/>); const svg=screen.getByLabelText(mapMetadata.name);
    const event=new WheelEvent('wheel',{deltaY:-100,clientX:100,clientY:100,bubbles:true,cancelable:true});
    fireEvent(svg,event); expect(event.defaultPrevented).toBe(true); expect(read(svg).w).toBeLessThan(box.w);
  });
  it('mouseleave and window blur end drag', () => {
    const hook=renderHook(()=>useMapControls(undefined,box));
    act(()=>hook.result.current.handleMouseDown({button:0,clientX:0,clientY:0} as React.MouseEvent));
    act(()=>hook.result.current.handleMouseMovePan({clientX:30,clientY:0} as React.MouseEvent));
    fireEvent(window,new Event('blur')); expect(hook.result.current.isPanning).toBe(false);
    render(<GameMap {...props}/>); const svg=screen.getByLabelText(mapMetadata.name);
    fireEvent.mouseDown(svg,{button:0,clientX:0,clientY:0}); fireEvent.mouseMove(svg,{clientX:30,clientY:0});
    expect(svg.style.cursor).toBe('grabbing'); fireEvent.mouseLeave(svg); expect(svg.style.cursor).toBe('grab');
  });
  it('drag changes pan and external mouseup ends dragging', () => {
    const hook=renderHook(()=>useMapControls(undefined,box));
    act(()=>hook.result.current.handleMouseDown({button:0,clientX:10,clientY:10} as React.MouseEvent));
    act(()=>hook.result.current.handleMouseMovePan({clientX:110,clientY:30} as React.MouseEvent));
    expect(hook.result.current.viewBox.x).toBe(1400); expect(hook.result.current.isPanning).toBe(true);
    fireEvent.mouseUp(window); expect(hook.result.current.isPanning).toBe(false);
  });
  it('reset restores authored overview', () => { const hook=renderHook(()=>useMapControls(undefined,box)); act(()=>hook.result.current.resetView()); expect(hook.result.current.viewBox).toEqual(mapMetadata.initialViewBox); });
  it('focus province centers it', () => { const hook=renderHook(()=>useMapControls(undefined,box)); act(()=>hook.result.current.focusProvince(provincesData[0])); expect(center(hook.result.current.viewBox)).toEqual(provincesData[0].center); });
  it('focus microstate remains within zoom limits', () => { const p=provincesData.find(p=>p.owner==='MCO')!; const hook=renderHook(()=>useMapControls(undefined,box)); act(()=>hook.result.current.focusProvince(p)); expect(center(hook.result.current.viewBox)).toEqual(p.center); expect(hook.result.current.viewBox.w).toBeGreaterThanOrEqual(5040/MAX_ZOOM); });
  it('focus player centers capital region', () => { render(<GameMap {...props}/>); fireEvent.click(screen.getByRole('button',{name:'Focus Player'})); const capital=provincesData.find(p=>p.id===countries.find(c=>c.tag==='BRA')!.capitalId)!; const b=read(screen.getByLabelText(mapMetadata.name)); expect(center(b).x).toBeCloseTo(capital.center.x); expect(center(b).y).toBeCloseTo(capital.center.y); });
  it('single click and tiny movement select; drag suppresses selection', () => {
    const click=vi.fn(); const {container}=render(<GameMap {...props} onProvinceClick={click}/>); const path=container.querySelector('[data-province-id]')!;
    fireEvent.mouseDown(path,{button:0,clientX:100,clientY:100}); fireEvent.mouseMove(path,{clientX:102,clientY:102}); fireEvent.mouseUp(path); fireEvent.click(path); expect(click).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(path,{button:0,clientX:100,clientY:100}); fireEvent.mouseMove(path,{clientX:140,clientY:100}); fireEvent.mouseUp(window); fireEvent.click(path); expect(click).toHaveBeenCalledTimes(1);
  });
  it('double click focuses without breaking selection', () => { const click=vi.fn(); const {container}=render(<GameMap {...props} onProvinceClick={click}/>); const path=container.querySelector('[data-province-id]')!; fireEvent.click(path); fireEvent.doubleClick(path); expect(click).toHaveBeenCalledTimes(1); expect(read(screen.getByLabelText(mapMetadata.name)).w).toBe(160); });
  it('keyboard pans and ignores inputs and modifiers', () => { render(<GameMap {...props}/>); const svg=screen.getByLabelText(mapMetadata.name); fireEvent.keyDown(window,{key:'ArrowRight'}); expect(read(svg).x).toBe(1580); const input=document.createElement('input'); document.body.append(input); fireEvent.keyDown(input,{key:'ArrowRight'}); fireEvent.keyDown(window,{key:'ArrowRight',ctrlKey:true}); expect(read(svg).x).toBe(1580); input.remove(); });
  it('resize preserves camera and focus uses current dimensions', () => { const hook=renderHook(()=>useMapControls(undefined,box)); fireEvent(window,new Event('resize')); expect(hook.result.current.viewBox).toEqual(box); });
  it.each(['Americas','Europe','Asia','Africa','Oceania'])('regional jump %s works in GameMap', name => { render(<GameMap {...props}/>); fireEvent.change(screen.getByLabelText('Regional jump'),{target:{value:name}}); expect(read(screen.getByLabelText(mapMetadata.name))).toEqual(fitCameraBounds(regionalBounds[name],2)); });
  it('World jump and 0 reset', () => { render(<GameMap {...props}/>); const svg=screen.getByLabelText(mapMetadata.name); fireEvent.change(screen.getByLabelText('Regional jump'),{target:{value:'World'}}); expect(read(svg)).toEqual(mapMetadata.initialViewBox); fireEvent.keyDown(window,{key:'+'}); fireEvent.keyDown(window,{key:'0'}); expect(read(svg)).toEqual(mapMetadata.initialViewBox); });
  it('renders full world and keeps selection screen simple', () => { const {container}=render(<GameMap {...props} selectionMode/>); expect(countries).toHaveLength(201); expect(container.querySelectorAll('[data-province-id]')).toHaveLength(494); expect(screen.queryByLabelText('Regional jump')).toBeNull(); expect(screen.queryByRole('button',{name:'Focus Player'})).toBeNull(); });
  it('zoomAt accounts for SVG letterboxing', () => {
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); vi.spyOn(svg,'getBoundingClientRect').mockReturnValue({left:10,top:20,width:1000,height:1000} as DOMRect); const ref={current:svg};
    const hook=renderHook(()=>useMapControls(ref,box));
    act(()=>hook.result.current.zoomAt(260,520,-.2));
    const next=hook.result.current.viewBox; expect(next.x+next.w*.25).toBeCloseTo(1700); expect(next.y+next.h*.5).toBeCloseTo(800);
  });
});
