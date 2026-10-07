// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Army, Province } from '../../types';
import { countries, provincesData } from '../../data/map';
import { createArmy, createRegiment, appendWaypoint, advanceMovementPlans } from '../../engine/military';
import { createInitialTechState } from '../../engine/technology';
import { saveGame, loadGame, getSaveCompatibilityError } from '../../engine/saveSystem';
import { GameMap } from '../GameMap/GameMap';
import { ArmyMovementPlanPanel } from '../ArmyMovementPlanPanel';
import { ArmySelectionSummary } from '../ArmySelectionSummary';
import { useArmyActions } from '../../hooks/app/useArmyActions';
import { processMovementTick } from '../../hooks/gameLoop/movementTick';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
const places = (): Province[] => ['a', 'b', 'c'].map((id, i) => ({ ...structuredClone(provincesData[0]), id, name: id.toUpperCase(), owner: 'BRA', development: 100, terrain: 'plains', center: { x: i * 50, y: 100 }, neighbors: id === 'b' ? ['a', 'c'] : ['b'] }));
const unit = (id = 'one'): Army => ({ ...createArmy('BRA', id, 'a'), id, regiments: [createRegiment('infantry')] });
const planned = () => appendWaypoint(appendWaypoint(unit(), 'b', places(), [])!, 'c', places(), [])!;
function saveFixture(): Parameters<typeof saveGame>[0] {
  const provinceList = places(), country = { ...structuredClone(countries.find(c => c.tag === 'BRA')!), provinces: ['a', 'b', 'c'], capital: 'a', capitalId: 'a' };
  return { dateRef: { current: { year: 1836, month: 1, day: 1 } }, provincesRef: { current: provinceList }, countriesRef: { current: [country] }, armiesRef: { current: [planned()] }, warsRef: { current: [] }, diplomaticRelationsRef: { current: [] }, recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] }, playerTechStateRef: { current: createInitialTechState('BRA') }, botTechStatesRef: { current: new Map() }, activeBattlesRef: { current: [] } };
}

describe('Movement Commands V2 UI', () => {
  it('forwards Shift+right-click while preserving the normal click contract', () => {
    const command = vi.fn(), select = vi.fn(), toggle = vi.fn();
    const view = render(<GameMap provinces={places()} countries={countries} armies={[unit()]} recruitments={[]} buildingConstructions={[]} activeBattles={[]} selectedProvince={null} hoveredProvince={null} selectedArmy="one" onProvinceHover={vi.fn()} onProvinceClick={vi.fn()} onArmyClick={select} onToggleArmy={toggle} onProvinceRightClick={command} />);
    const target = view.container.querySelector('[data-province-id="b"]')!;
    fireEvent.contextMenu(target, { shiftKey: true }); expect(command).toHaveBeenLastCalledWith('b', true);
    fireEvent.contextMenu(target); expect(command).toHaveBeenLastCalledWith('b');
    fireEvent.click(view.container.querySelector('.army-marker')!, { ctrlKey: true }); expect(toggle).toHaveBeenCalledWith('one');
    expect(screen.getByText(/Shift\+direito: waypoint/)).toBeTruthy();
  });
  it('renders active/future segments, numbered points and deduplicates identical manual routes', () => {
    const one = planned(), two = { ...planned(), id: 'two' };
    const view = render(<GameMap provinces={places()} countries={countries} armies={[one, two]} recruitments={[]} buildingConstructions={[]} activeBattles={[]} selectedProvince={null} hoveredProvince={null} selectedArmy="one" selectedArmyIds={['one', 'two']} onProvinceHover={vi.fn()} onProvinceClick={vi.fn()} onArmyClick={vi.fn()} onProvinceRightClick={vi.fn()} />);
    expect(view.container.querySelectorAll('[data-route-army]')).toHaveLength(1);
    expect(view.container.querySelector('[data-route-segment="active"]')?.hasAttribute('stroke-dasharray')).toBe(false);
    expect(view.container.querySelector('[data-route-segment="planned"]')?.getAttribute('stroke-dasharray')).toBe('3 5');
    expect(view.container.querySelectorAll('[data-waypoint]')).toHaveLength(2);
  });
  it('shows the individual queue, final destination and clear action', () => {
    const clear = vi.fn();
    render(<ArmyMovementPlanPanel army={planned()} provinces={places()} onClear={clear} />);
    expect(screen.getByText('Rota: 2 pontos restantes')).toBeTruthy();
    expect(screen.getByText('Destino final:')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual(['B', 'C']);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar rota' })); expect(clear).toHaveBeenCalledOnce();
  });
  it('shows a group movement summary and clears routes separately from selection', () => {
    const clear = vi.fn(); render(<ArmySelectionSummary armies={[planned(), unit('two')]} allArmies={[planned(), unit('two')]} provinces={places()} onClear={vi.fn()} onClearRoutes={clear} />);
    expect(screen.getByText('1 com rota ativa · 1 sem movimento ativo')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar rotas' })); expect(clear).toHaveBeenCalledOnce();
  });
  it('adds a group waypoint and clears all plans through the real action hook with one toast', () => {
    const armiesRef = { current: [unit('one'), unit('two')] }, toast = vi.fn();
    const { result } = renderHook(() => useArmyActions({ selectedArmy: 'one', selectedArmyIds: ['one', 'two'], setSelectedArmy: vi.fn(), setSelectedProvince: vi.fn(), setIsPanelOpen: vi.fn(), provincesRef: { current: places() }, armiesRef, diplomaticRelationsRef: { current: [] }, playerCountryTag: 'BRA', setArmies: vi.fn(), addLog: vi.fn(), addToast: toast, splitSelection: new Set(), setSplitSelection: vi.fn(), setShowSplitModal: vi.fn() }));
    act(() => result.current.handleProvinceRightClick('b', true));
    expect(toast).toHaveBeenCalledOnce(); expect(armiesRef.current.every(a => a.movementPlan?.waypoints[0] === 'b')).toBe(true);
    act(() => result.current.handleClearRoutes());
    expect(armiesRef.current.every(a => !a.destination && !a.movementPlan)).toBe(true);
  });
});

describe('Movement Commands V2 persistence', () => {
  it('round-trips a queued plan at version 3 and continues it after load', () => {
    const refs = saveFixture(); expect(saveGame(refs, 'route')).toBe(true);
    const loaded = loadGame('route')!;
    expect(loaded.version).toBe(3); expect(loaded.military.armies[0]).toEqual(refs.armiesRef.current[0]);
    const first = processMovementTick({ ...loaded.world, armies: loaded.military.armies, relations: [], addLog: vi.fn() });
    const units = [...first.armies, ...first.arrivedArmies];
    const next = advanceMovementPlans(units, loaded.world.provinces, []).armies[0];
    expect(next.targetDestination).toBe('c'); expect(next.movementPlan?.waypoints).toEqual(['c']);
    refs.armiesRef.current = loaded.military.armies; saveGame(refs, 'route');
    expect(loadGame('route')!.military.armies).toEqual(loaded.military.armies);
  });
  it('loads old armies with no new field as having no manual route', () => {
    const refs = saveFixture(); refs.armiesRef.current = [unit()]; saveGame(refs, 'old');
    const loaded = loadGame('old')!;
    expect(loaded.military.armies[0].movementPlan?.waypoints ?? []).toEqual([]);
    expect(advanceMovementPlans(loaded.military.armies, loaded.world.provinces, []).armies).toEqual(loaded.military.armies);
  });
  it.each([{ waypoints: ['missing'] }, { waypoints: [5] }, { waypoints: null }])('rejects malformed plans safely and protects the original slot', plan => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refs = saveFixture(); saveGame(refs, 'bad');
    const raw = JSON.parse(localStorage.getItem('imperium_save_bad')!); raw.military.armies[0].movementPlan = plan;
    const invalid = JSON.stringify(raw); localStorage.setItem('imperium_save_bad', invalid);
    expect(loadGame('bad')).toBeNull(); expect(getSaveCompatibilityError()).toContain('Plano de movimento');
    expect(saveGame(refs, 'bad')).toBe(false); expect(localStorage.getItem('imperium_save_bad')).toBe(invalid);
  });
});
