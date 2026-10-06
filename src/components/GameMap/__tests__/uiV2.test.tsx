// @vitest-environment jsdom
import { getTerrainDefinition } from '../../../engine/terrain';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { countries, provincesData } from '../../../data/map';
import { createArmy, createRegiment, calculateLocalSupplyCapacity, calculateArmyOrganization, calculateArmyMorale } from '../../../engine/military';
import type { Army, Province, War } from '../../../types';
import { GameMap, type MapProps } from '../GameMap';
import { buildArmyPresentation, buildMapValues, buildWarPresentation, groupOffset, numericMapColor, MAP_MODES } from '../mapPresentation';

afterEach(cleanup);
const capital = provincesData.find(province => province.id === 'sa_bra_brasilia')!;
const next = provincesData.find(province => province.id === capital.neighbors[0])!;
function army(id: string, owner = 'BRA', location = capital.id, troops = 1000): Army {
  return { ...createArmy(owner, `Exército ${id}`, location), id, regiments: [{ ...createRegiment('infantry'), strength: troops, organization: 70, morale: 80 }] };
}
function props(armies: Army[] = [], extra: Partial<MapProps> = {}): MapProps {
  return { provinces: [capital, next], countries, armies, recruitments: [], buildingConstructions: [], activeBattles: [], selectedProvince: null, hoveredProvince: null, selectedArmy: null, onProvinceHover: vi.fn(), onProvinceClick: vi.fn(), onArmyClick: vi.fn(), onProvinceRightClick: vi.fn(), ...extra };
}

describe('UI V2 visual army grouping', () => {
  it('renders one army with its original marker and selection callback', () => {
    const data = props([army('one')]);
    const view = render(<GameMap {...data} />);
    expect(view.container.querySelectorAll('.army-marker')).toHaveLength(1);
    expect(view.container.querySelectorAll('.army-stack-marker')).toHaveLength(0);
    fireEvent.click(view.container.querySelector('.army-marker')!);
    expect(data.onArmyClick).toHaveBeenCalledWith('one');
    expect(data.onProvinceClick).not.toHaveBeenCalled();
  });
  it('groups colocated armies by owner, preserves references and totals', () => {
    const units = [army('one', 'BRA', capital.id, 700), army('two', 'BRA', capital.id, 1400), army('three', 'ARG')];
    const before = JSON.stringify(units);
    const result = buildArmyPresentation(units, [capital]);
    expect(result.groups).toHaveLength(2);
    const brazil = result.groups.find(group => group.owner === 'BRA')!;
    expect(brazil.troops).toBe(2100);
    expect(brazil.armies).toEqual(units.slice(0, 2));
    expect(brazil.armies[0]).toBe(units[0]);
    expect(result.localTotals.get(capital.id)).toEqual({ count: 3, troops: 3100 });
    expect(new Set(result.groups.map(group => `${group.offsetX},${group.offsetY}`)).size).toBe(2);
    expect(JSON.stringify(units)).toBe(before);
    const reversed = buildArmyPresentation([...units].reverse(), [capital]);
    expect(reversed.groups.map(group => [group.owner, group.offsetX, group.offsetY])).toEqual(result.groups.map(group => [group.owner, group.offsetX, group.offsetY]));
  });
  it('uses separate rendered stacks for enemies and correct summed troops', () => {
    const view = render(<GameMap {...props([army('a'), army('b'), army('c', 'ARG'), army('d', 'ARG')])} />);
    expect(view.container.querySelectorAll('.army-stack-marker')).toHaveLength(2);
    expect(view.container.querySelectorAll('.army-marker')).toHaveLength(0);
    expect(view.getByRole('button', { name: /Brasil: 2 exércitos, 2.000 tropas/ })).toBeTruthy();
    expect(view.getByRole('button', { name: /Argentina: 2 exércitos/ })).toBeTruthy();
  });
  it('opens the list, shows stats and selects a real individual ID', () => {
    const data = props([army('a'), army('b')], { selectedArmy: 'b' });
    const view = render(<GameMap {...data} />);
    fireEvent.click(view.container.querySelector('.army-stack-marker')!, { clientX: 500, clientY: 300 });
    const dialog = view.getByRole('dialog');
    expect(dialog.textContent).toContain('2.000 tropas');
    expect(dialog.textContent).toContain('Org');
    expect(dialog.textContent).toContain('Moral');
    expect(dialog.textContent).toContain('Supply');
    expect(dialog.textContent).toContain('Parado');
    expect(dialog.querySelector('[data-army-choice="b"]')!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(dialog.querySelector('[data-army-choice="a"]')!);
    expect(data.onArmyClick).toHaveBeenCalledWith('a');
    expect(view.queryByRole('dialog')).toBeNull();
  });
  it('dismisses with Escape, outside click, province selection and external selection', () => {
    const data = props([army('a'), army('b')]);
    const view = render(<GameMap {...data} />);
    const open = () => fireEvent.click(view.container.querySelector('.army-stack-marker')!);
    open(); fireEvent.keyDown(document, { key: 'Escape' }); expect(view.queryByRole('dialog')).toBeNull();
    open(); fireEvent.pointerDown(document.body); expect(view.queryByRole('dialog')).toBeNull();
    open(); fireEvent.click(view.container.querySelector(`[data-province-id="${next.id}"]`)!); expect(view.queryByRole('dialog')).toBeNull();
    open(); view.rerender(<GameMap {...data} selectedProvince={next.id} />); expect(view.queryByRole('dialog')).toBeNull();
    open(); view.rerender(<GameMap {...data} selectedArmy="a" />); expect(view.queryByRole('dialog')).toBeNull();
  });
  it('opens via keyboard and closes when a stack becomes a singleton', () => {
    const data = props([army('a'), army('b')]);
    const view = render(<GameMap {...data} />);
    fireEvent.keyDown(view.container.querySelector('.army-stack-marker')!, { key: 'Enter' });
    expect(view.getByRole('dialog')).toBeTruthy();
    expect(document.activeElement?.getAttribute('data-army-choice')).toBe('a');
    view.rerender(<GameMap {...data} armies={[data.armies[0]]} />);
    expect(view.queryByRole('dialog')).toBeNull();
    expect(view.container.querySelectorAll('.army-marker')).toHaveLength(1);
  });
  it('renders many armies once, without changing arrays, IDs or regiments', () => {
    const units = Array.from({ length: 240 }, (_, index) => army(`unit-${index}`, index < 200 ? 'BRA' : 'ARG'));
    const before = JSON.stringify(units);
    const view = render(<GameMap {...props(units)} />);
    expect(view.container.querySelectorAll('.army-stack-marker')).toHaveLength(2);
    expect(view.container.querySelectorAll('.army-marker')).toHaveLength(0);
    const model = buildArmyPresentation(units, [capital]);
    const ids = model.groups.flatMap(group => group.armies.map(item => item.id));
    expect(ids).toHaveLength(240); expect(new Set(ids).size).toBe(240);
    expect(model.groups.reduce((sum, group) => sum + group.troops, 0)).toBe(240000);
    expect(JSON.stringify(units)).toBe(before);
  });
  it('retains physical marching positions and separates different routes', () => {
    const departing = { ...army('a'), destination: next.id, path: [next.id] };
    const stationary = army('b');
    const start = buildArmyPresentation([departing, stationary], [capital, next]);
    expect(start.groups).toHaveLength(1); expect(start.groups[0].moving).toBe(true);
    const moving = { ...departing, movementProgress: .5, position: { x: 75, y: 90 } };
    const result = buildArmyPresentation([moving, stationary], [capital, next]);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.find(group => group.armies[0].id === 'a')).toMatchObject({ x: 75, y: 90 });
    expect(result.localTotals.get(capital.id)).toEqual({ count: 1, troops: 1000 });
    // Logistics still uses the engine's registered location, without changing supply semantics.
    expect(result.byLocation.get(capital.id)).toHaveLength(2);
    const coMarcher = { ...moving, id: 'c' };
    expect(buildArmyPresentation([moving, coMarcher], [capital, next]).groups).toHaveLength(1);
  });
  it('preserves all owner slots deterministically for larger numbers of groups', () => {
    const positions = Array.from({ length: 10 }, (_, index) => groupOffset(index));
    expect(new Set(positions.map(position => JSON.stringify(position))).size).toBe(10);
    expect(positions).toEqual(Array.from({ length: 10 }, (_, index) => groupOffset(index)));
  });
  it('keeps a co-marching stack open across position updates', () => {
    const units = ['a', 'b'].map(id => ({ ...army(id), destination: next.id, path: [next.id], movementProgress: .3, position: { x: 75, y: 90 } }));
    const data = props(units); const view = render(<GameMap {...data} />);
    fireEvent.click(view.container.querySelector('.army-stack-marker')!);
    const key = view.container.querySelector('.army-stack-marker')!.getAttribute('data-stack-key');
    view.rerender(<GameMap {...data} armies={units.map(unit => ({ ...unit, movementProgress: .4, position: { x: 85, y: 100 } }))} />);
    expect(view.getByRole('dialog')).toBeTruthy();
    expect(view.container.querySelector('.army-stack-marker')!.getAttribute('data-stack-key')).toBe(key);
  });
  it('never combines rebels with their original country and summarizes combat/movement', () => {
    const units = [army('a'), army('b'), { ...army('r', 'rebel_BRA_1'), originalOwner: 'BRA', rebellionFactionId: 'rebel_BRA_1', inCombat: true }, { ...army('s', 'rebel_BRA_1'), originalOwner: 'BRA', destination: next.id }];
    const model = buildArmyPresentation(units, [capital, next]);
    expect(model.groups).toHaveLength(2);
    expect(model.groups.find(group => group.owner === 'rebel_BRA_1')).toMatchObject({ fighting: true, moving: true, troops: 2000 });
    const view = render(<GameMap {...props(units)} />);
    const rebel = view.container.querySelectorAll('.army-stack-marker')[1];
    expect(rebel.textContent).toContain('⚔'); expect(rebel.textContent).toContain('→');
    fireEvent.click(rebel);
    expect(view.getByRole('dialog').textContent).toContain('Combate');
  });
  it('restores keyboard focus to the stack after Escape', () => {
    const view = render(<GameMap {...props([army('a'), army('b')])} />);
    const stack = view.container.querySelector<SVGGElement>('.army-stack-marker')!;
    stack.focus(); fireEvent.keyDown(stack, { key: ' ' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(stack);
  });
});

describe('UI V2 routes, map modes and operational information', () => {
  it('draws the real selected route from current position, without repeating next step', () => {
    const moving = { ...army('a'), destination: next.id, targetDestination: next.id, path: [next.id], movementProgress: .4, position: { x: 60, y: 80 } };
    const data = props([moving, { ...moving, id: 'b' }]);
    const view = render(<GameMap {...data} />);
    expect(view.container.querySelectorAll('[data-route-army]')).toHaveLength(0);
    view.rerender(<GameMap {...data} selectedArmy="a" />);
    expect(view.container.querySelectorAll('[data-route-army]')).toHaveLength(1);
    expect(view.container.querySelector('[data-route-army="a"] polyline')!.getAttribute('points')).toBe(`60,80 ${next.center.x},${next.center.y}`);
    expect(view.container.querySelector('[data-route-army="a"] polyline')!.getAttribute('marker-end')).toContain('url(');
    expect(view.container.querySelector('.army-mini-status')!.textContent).toContain('40%');
    expect(view.container.querySelector('.army-stack-marker--selected')).toBeTruthy();
  });
  it('shows independent routes for departing stack members with different destinations', () => {
    const third = provincesData.find(province => province.id === capital.neighbors[1])!;
    const units = [{ ...army('a'), destination: next.id, path: [next.id] }, { ...army('b'), destination: third.id, path: [third.id] }];
    const view = render(<GameMap {...props(units, { provinces: [capital, next, third] })} />);
    fireEvent.click(view.container.querySelector('.army-stack-marker')!);
    expect(view.container.querySelectorAll('[data-route-army]')).toHaveLength(2);
    expect(view.container.querySelector('[data-route-army="a"] polyline')!.getAttribute('points')).not.toBe(view.container.querySelector('[data-route-army="b"] polyline')!.getAttribute('points'));
    expect(view.getByRole('dialog').textContent).toContain('Movendo');
  });
  it('defaults to political ownership colors and restores them after numeric modes', () => {
    const data = props(); const view = render(<GameMap {...data} />);
    const path = view.container.querySelector(`[data-province-id="${capital.id}"]`)!;
    const color = countries.find(country => country.tag === capital.owner)!.color;
    expect(path.getAttribute('fill')).toBe(color);
    expect(view.getByRole('button', { name: 'Modo Político' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(view.getByRole('button', { name: 'Modo População' }));
    fireEvent.click(view.getByRole('button', { name: 'Modo Político' }));
    expect(path.getAttribute('fill')).toBe(color);
  });
  it.each(MAP_MODES.filter(mode => mode.id !== 'political'))('renders $id with correct values, legend and preserved clicks', mode => {
    const data = props(); const before = JSON.stringify(data.provinces); const view = render(<GameMap {...data} />);
    fireEvent.click(view.getByRole('button', { name: `Modo ${mode.label}` }));
    const values = buildMapValues(data.provinces, mode.id);
    const path = view.container.querySelector(`[data-province-id="${capital.id}"]`)!;
    expect(path.getAttribute('fill')).toBe(mode.id === 'terrain' ? getTerrainDefinition(capital).color : numericMapColor(values.values.get(capital.id)!, values.max, mode.id));
    expect(view.getByLabelText(`Legenda ${mode.label}`)).toBeTruthy();
    fireEvent.click(path); expect(data.onProvinceClick).toHaveBeenCalledWith(capital.id);
    fireEvent.contextMenu(path); expect(data.onProvinceRightClick).toHaveBeenCalledWith(capital.id);
    expect(JSON.stringify(data.provinces)).toBe(before);
  });
  it('uses canonical local supply capacity and rebel pressure in numeric modes', () => {
    const province = { ...capital, unrest: 25, rebellion: { ...capital.rebellion, progress: 70 } } as Province;
    expect(buildMapValues([province], 'unrest').values.get(province.id)).toBe(70);
    expect(buildMapValues([province], 'supply').values.get(province.id)).toBe(calculateLocalSupplyCapacity(province));
    const unit = army('a'); const stats = buildArmyPresentation([unit], [capital]).readouts.get(unit.id)!;
    expect(stats.organization).toBe(calculateArmyOrganization(unit));
    expect(stats.morale).toBe(calculateArmyMorale(unit));
  });
  it('provides current tooltip population, capital, troop totals, unrest and supply', () => {
    const data = props([army('a', 'BRA', capital.id, 1500), army('b')]);
    const view = render(<GameMap {...data} />);
    fireEvent.mouseEnter(view.container.querySelector(`[data-province-id="${capital.id}"]`)!, { clientX: 150, clientY: 200 });
    const tooltip = view.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Capital'); expect(tooltip.textContent).toContain('Brasil');
    expect(tooltip.textContent).toContain('2 / 2.500'); expect(tooltip.textContent).toContain(capital.population.total.toLocaleString('pt-BR'));
    expect(tooltip.textContent).toContain(calculateLocalSupplyCapacity(capital).toFixed(1));
    const updated = { ...capital, population: { ...capital.population, total: 77777 } };
    view.rerender(<GameMap {...data} provinces={[updated, next]} />);
    expect(view.getByRole('tooltip').textContent).toContain('77.777');
  });
  it('marks war frontier provinces, occupied paths and capitals at risk, preserving geometry', () => {
    const enemy = { ...next, owner: 'ARG' }; const provinces = [capital, enemy];
    const war: War = { id: 'war', attacker: 'BRA', defender: 'ARG', startDate: { year: 1444, month: 11, day: 11 }, warScore: 0, attackerCasualties: 0, defenderCasualties: 0, occupiedByAttacker: [enemy.id], occupiedByDefender: [] };
    const before = JSON.stringify(provinces);
    const model = buildWarPresentation(provinces, countries, [war], [], []);
    expect(model.frontlines.has(capital.id)).toBe(true); expect(model.capitalsAtRisk.has(capital.id)).toBe(true);
    const view = render(<GameMap {...props([], { provinces, wars: [war], selectedArmy: 'a', armies: [army('a')] })} />);
    expect(view.container.querySelector('[data-occupied-province]')!.getAttribute('d')).toBe(enemy.path);
    expect(view.container.querySelector(`[data-army-province="${capital.id}"]`)).toBeTruthy();
    fireEvent.mouseEnter(view.container.querySelector(`[data-province-id="${enemy.id}"]`)!);
    expect(view.getByRole('tooltip').textContent).toContain('Ocupação ativa');
    expect(JSON.stringify(provinces)).toBe(before);
  });
});
