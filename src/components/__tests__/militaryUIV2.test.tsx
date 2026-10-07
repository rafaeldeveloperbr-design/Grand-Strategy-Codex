// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Army, CombatResult, Province } from '../../types';
import { countries, provincesData } from '../../data/map';
import { createArmy, createRegiment, getEffectiveRecruitmentCost } from '../../engine/military';
import { createInitialTechState } from '../../engine/technology';
import { normalizeMarket } from '../../engine/market';
import { useGameSelection } from '../../hooks/app/useGameSelection';
import { useArmyActions } from '../../hooks/app/useArmyActions';
import { orderArmyGroup } from '../../hooks/app/armyGroupCommands';
import { ArmyStackPopover } from '../ArmyStackPopover';
import { ArmySelectionSummary } from '../ArmySelectionSummary';
import { ProvinceMilitaryTab } from '../ProvincePanel/ProvinceMilitaryTab';
import { GameMap } from '../GameMap/GameMap';
import { buildArmyPresentation } from '../GameMap/mapPresentation';
import { BattleHistoryModal } from '../BattleHistoryModal';
import { BattleReportModal } from '../BattleReportModal';
import { startContinuousBattle } from '../../engine/combat';
import { processBattleContinuous } from '../../hooks/gameLoop/battleContinuousTick';
import { world, army as campaignArmy, relation, war, date } from '../../engine/__tests__/helpers/southAmericaAudit';
import { UNIT_DEFINITIONS, RECRUITABLE_UNIT_IDS } from '../../data/units';

afterEach(cleanup);
const army = (id: string, location = 'a', owner = 'BRA'): Army => ({ ...createArmy(owner, id, location), id, regiments: [createRegiment('infantry')] });
function map(): Province[] {
  const p = structuredClone(provincesData[0]);
  return ['a', 'b', 'c', 'd'].map(id => ({ ...structuredClone(p), id, name: id, owner: 'BRA', neighbors: id === 'a' ? ['c'] : id === 'b' ? ['d'] : id === 'd' ? ['b', 'c'] : ['a', 'd'] }));
}

describe('Military UI V2 selection', () => {
  it('selects one, toggles several, filters third parties, clears and removes destroyed IDs', () => {
    const armiesRef = { current: [army('one'), army('two'), army('enemy', 'a', 'ARG'), army('rebel', 'a', 'rebel_BRA')] };
    const provincesRef = { current: map() }, diplomacy = vi.fn();
    const { result, rerender } = renderHook(({ units }) => useGameSelection('BRA', provincesRef, armiesRef, diplomacy, units), { initialProps: { units: armiesRef.current } });
    act(() => result.current.handleArmyClick('one'));
    expect(result.current.selectedArmyIds).toEqual(['one']);
    act(() => { result.current.toggleArmySelection('two'); result.current.toggleArmySelection('enemy'); result.current.toggleArmySelection('rebel'); });
    expect(result.current.selectedArmyIds).toEqual(['one', 'two']);
    act(() => result.current.toggleArmySelection('one'));
    expect(result.current.selectedArmyIds).toEqual(['two']);
    act(() => result.current.toggleStackSelection(['one', 'two', 'enemy']));
    expect(result.current.selectedArmyIds).toEqual(['two', 'one']);
    act(() => result.current.toggleStackSelection(['one', 'two']));
    expect(result.current.selectedArmyIds).toEqual([]);
    act(() => result.current.toggleStackSelection(['one', 'two']));
    armiesRef.current = [army('two')]; rerender({ units: armiesRef.current });
    expect(result.current.selectedArmyIds).toEqual(['two']);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(result.current.selectedArmyIds).toEqual([]);
  });
  it('retains selected armies during combat and retreat, then drops transferred ownership', () => {
    const armiesRef = { current: [army('one')] }, provincesRef = { current: map() }, diplomacy = vi.fn();
    const { result, rerender } = renderHook(({ units }) => useGameSelection('BRA', provincesRef, armiesRef, diplomacy, units), { initialProps: { units: armiesRef.current } });
    act(() => result.current.handleArmyClick('one'));
    armiesRef.current = [{ ...army('one'), inCombat: true }]; rerender({ units: armiesRef.current });
    expect(result.current.selectedArmyIds).toEqual(['one']);
    armiesRef.current = [army('one', 'b')]; rerender({ units: armiesRef.current });
    expect(result.current.selectedArmyIds).toEqual(['one']);
    armiesRef.current = [army('one', 'b', 'ARG')]; rerender({ units: armiesRef.current });
    expect(result.current.selectedArmyIds).toEqual([]);
  });
  it('drops destroyed armies even when their empty record still exists', () => {
    const armiesRef = { current: [army('one')] }, provincesRef = { current: map() };
    const { result, rerender } = renderHook(({ units }) => useGameSelection('BRA', provincesRef, armiesRef, vi.fn(), units), { initialProps: { units: armiesRef.current } });
    act(() => result.current.handleArmyClick('one'));
    armiesRef.current = [{ ...army('one'), regiments: [] }]; rerender({ units: armiesRef.current });
    expect(result.current.selectedArmyIds).toEqual([]);
  });
  it('selects all controllable stack members without closing the popover', () => {
    const units = [army('one'), army('two')], places = map();
    const presentation = buildArmyPresentation(units, places), select = vi.fn(), toggle = vi.fn();
    const view = render(<ArmyStackPopover group={presentation.groups[0]} province={places[0]} countries={new Map(countries.map(c => [c.tag, c]))} presentation={presentation} selectedArmy="one" selectedArmyIds={['one']} playerCountryTag="BRA" onSelect={select} onToggleStack={toggle} onClearSelection={vi.fn()} onClose={vi.fn()} anchor={{ x: 0, y: 0 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar todos' }));
    expect(toggle).toHaveBeenCalledWith(['one', 'two']);
    expect(view.container.querySelector('[data-army-choice="one"]')?.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(view.container.querySelector('[data-army-choice="two"]')!);
    expect(select).toHaveBeenCalledWith('two'); expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('highlights all selected markers and retains the national marker color', () => {
    const units = [army('one', 'a'), army('two', 'b')];
    const view = render(<GameMap provinces={map()} countries={countries} armies={units} recruitments={[]} buildingConstructions={[]} activeBattles={[]} selectedProvince={null} hoveredProvince={null} selectedArmy="one" selectedArmyIds={['one', 'two']} playerCountryTag="BRA" onProvinceHover={vi.fn()} onProvinceClick={vi.fn()} onArmyClick={vi.fn()} onProvinceRightClick={vi.fn()} />);
    const markers = view.container.querySelectorAll('.army-marker');
    expect(markers).toHaveLength(2);
    for (const marker of markers) expect(marker.getAttribute('class')).toContain('selected');
    expect(view.container.innerHTML).toContain(countries.find(c => c.tag === 'BRA')!.color);
  });
  it('keeps the live map stack open while its members are toggled', () => {
    const units = [army('one'), army('two')];
    const props = { provinces: map(), countries, armies: units, recruitments: [], buildingConstructions: [], activeBattles: [], selectedProvince: null, hoveredProvince: null, selectedArmy: null as string | null, selectedArmyIds: [] as string[], playerCountryTag: 'BRA', onProvinceHover: vi.fn(), onProvinceClick: vi.fn(), onArmyClick: vi.fn(), onToggleArmy: vi.fn(), onToggleStack: vi.fn(), onProvinceRightClick: vi.fn() };
    const view = render(<GameMap {...props} />);
    fireEvent.click(view.container.querySelector('.army-stack-marker')!);
    view.rerender(<GameMap {...props} selectedArmy="one" selectedArmyIds={['one']} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    view.rerender(<GameMap {...props} selectedArmy="one" selectedArmyIds={['one', 'two']} />);
    expect(screen.getByRole('button', { name: 'Desmarcar todos' })).toBeTruthy();
    expect(view.container.querySelectorAll('[data-army-choice][aria-pressed="true"]')).toHaveLength(2);
  });
  it('summarizes composition and troop-weighted metrics without mutating armies', () => {
    const one = army('one'), two = army('two');
    two.regiments = [{ ...createRegiment('armor'), strength: 500, organization: 45, morale: 50 }];
    const units = [one, two], before = structuredClone(units);
    render(<ArmySelectionSummary armies={units} allArmies={units} provinces={map()} onClear={vi.fn()} />);
    expect(screen.getByText('2 exércitos selecionados')).toBeTruthy();
    expect(screen.getByText('1.500')).toBeTruthy(); expect(screen.getByText('Blindados')).toBeTruthy();
    expect(screen.getAllByText('83%')).toHaveLength(2);
    expect(units).toEqual(before);
  });
});

describe('Military UI V2 group commands', () => {
  it('orders the same final destination with independent routes and no merging', () => {
    const units = [army('one'), army('two', 'b')], before = structuredClone(units);
    const result = orderArmyGroup(['one', 'two'], units, 'BRA', 'c', map(), []);
    expect(result.updates.size).toBe(2);
    expect(result.armies.map(a => a.targetDestination)).toEqual(['c', 'c']);
    expect(result.armies.map(a => a.path)).toEqual([['c'], ['d', 'c']]);
    expect(units).toEqual(before); expect(result.armies.map(a => a.id)).toEqual(['one', 'two']);
  });
  it('keeps valid orders on partial failure and preserves a failed existing route', () => {
    const places = map(); places[1].neighbors = [];
    const units = [army('one'), { ...army('two', 'b'), destination: 'd', path: ['d'], targetDestination: 'd' }];
    const result = orderArmyGroup(['one', 'two'], units, 'BRA', 'c', places, []);
    expect(result.updates.size).toBe(1); expect(result.failures[0].name).toBe('two');
    expect(result.armies[1]).toBe(units[1]);
  });
  it('rejects invalid destinations, inaccessible neutral territory, and allows war/access', () => {
    const units = [army('one'), army('two', 'b')], places = map();
    expect(orderArmyGroup(['one', 'two'], units, 'BRA', 'missing', places, []).failures).toHaveLength(2);
    places[2].owner = 'ARG';
    expect(orderArmyGroup(['one', 'two'], units, 'BRA', 'c', places, []).updates.size).toBe(0);
    expect(orderArmyGroup(['one', 'two'], units, 'BRA', 'c', places, [relation('BRA', 'ARG')]).updates.size).toBe(2);
    expect(orderArmyGroup(['one', 'two'], units, 'BRA', 'c', places, [relation('BRA', 'ARG', 'access')]).updates.size).toBe(2);
  });
  it('emits one aggregated toast through the actual action hook', () => {
    const armiesRef = { current: [army('one'), army('two', 'b')] }, addToast = vi.fn();
    const { result } = renderHook(() => useArmyActions({ selectedArmy: 'one', selectedArmyIds: ['one', 'two'], setSelectedArmy: vi.fn(), setSelectedProvince: vi.fn(), setIsPanelOpen: vi.fn(), provincesRef: { current: map() }, armiesRef, diplomaticRelationsRef: { current: [] }, playerCountryTag: 'BRA', setArmies: vi.fn(), addLog: vi.fn(), addToast, splitSelection: new Set(), setSplitSelection: vi.fn(), setShowSplitModal: vi.fn() }));
    act(() => result.current.handleProvinceRightClick('c'));
    expect(addToast).toHaveBeenCalledTimes(1); expect(addToast.mock.calls[0][0]).toContain('2 exércitos receberam');
    expect(armiesRef.current.every(a => a.targetDestination === 'c')).toBe(true);
  });
  it.each([1, 2])('aggregates partial/total failure when %i armies are fighting', blocked => {
    const units = [army('one'), army('two', 'b')].map((a, i) => ({ ...a, inCombat: i < blocked }));
    const armiesRef = { current: units }, addToast = vi.fn();
    const { result } = renderHook(() => useArmyActions({ selectedArmy: 'one', selectedArmyIds: ['one', 'two'], setSelectedArmy: vi.fn(), setSelectedProvince: vi.fn(), setIsPanelOpen: vi.fn(), provincesRef: { current: map() }, armiesRef, diplomaticRelationsRef: { current: [] }, playerCountryTag: 'BRA', setArmies: vi.fn(), addLog: vi.fn(), addToast, splitSelection: new Set(), setSplitSelection: vi.fn(), setShowSplitModal: vi.fn() }));
    act(() => result.current.handleProvinceRightClick('c'));
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast.mock.calls[0][0]).toContain(`${blocked} falharam`);
    expect(armiesRef.current.filter(a => a.targetDestination === 'c')).toHaveLength(2 - blocked);
    expect(armiesRef.current[0]).toBe(units[0]);
  });
});

function completedBattle() {
  const state = world(), front = state.provinces.find(p => p.id === 'sa_bra_parana')!;
  const attacker = { ...campaignArmy('ARG', front.id, 4, 'attack'), inCombat: true };
  const defender = { ...campaignArmy('BRA', front.id, 1, 'defend'), inCombat: true };
  defender.regiments[0] = { ...defender.regiments[0], strength: 50, organization: 0, morale: 0 };
  const battle = startContinuousBattle([attacker], [defender], front, date, 'ui-battle');
  const setBattleReport = vi.fn(), setIsPaused = vi.fn(), addToast = vi.fn();
  let history: CombatResult[] = [];
  processBattleContinuous({ ...state, armies: [attacker, defender], wars: [war('ARG', 'BRA')], relations: [relation('ARG', 'BRA')], currentActiveBattles: [battle], recruitments: [], buildingConstructions: [], snapshot: { date }, playerCountryTag: 'ARG', playerTechState: createInitialTechState('ARG'), botTechStates: new Map(), allCountries: state.countries, addLog: vi.fn(), addToast, setActiveBattles: vi.fn(), setArmies: vi.fn(), setBattleHistory: update => { history = typeof update === 'function' ? update(history) : update; }, setBattleReport, setIsPaused, activeBattlesRef: { current: [battle] }, cancelProvinceActivities: vi.fn() });
  return { history, setBattleReport, setIsPaused, addToast };
}
describe('Military UI V2 battle UX', () => {
  it('finishes a real battle, records history, notifies once, and never forces report or pause', () => {
    const result = completedBattle();
    expect(result.history).toHaveLength(1); expect(result.addToast).toHaveBeenCalledTimes(1);
    expect(result.addToast.mock.calls[0][0]).toContain('baixas aliadas');
    expect(result.addToast.mock.calls[0][0]).toContain(result.history[0].provinceName);
    expect(result.setBattleReport).not.toHaveBeenCalled(); expect(result.setIsPaused).not.toHaveBeenCalled();
  });
  it('opens reports voluntarily from history using click or keyboard and closes with Escape', () => {
    const result = completedBattle().history[0], onViewBattle = vi.fn(), onClose = vi.fn();
    const view = render(<BattleHistoryModal playerCountryTag="ARG" battleHistory={[result]} allCountries={countries} onClose={onClose} onViewBattle={onViewBattle} />);
    const entry = screen.getByRole('button', { name: `Abrir relatório de ${result.provinceName}` });
    fireEvent.keyDown(entry, { key: 'Enter' }); fireEvent.click(entry);
    expect(onViewBattle).toHaveBeenCalledTimes(2); expect(onViewBattle).toHaveBeenCalledWith(result);
    view.unmount();
    render(<BattleReportModal battleResult={result} playerCountry={countries.find(c => c.tag === 'ARG')!} allCountries={countries} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' }); expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' })); expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('keeps modern and legacy composition labels readable in historical reports', () => {
    const result = completedBattle().history[0];
    if (!result.combatReport) throw new Error('Missing complete report');
    const report = { ...result, combatReport: { ...result.combatReport, attacker: { ...result.combatReport.attacker, regimentComposition: { armor: { initial: 500, final: 300 }, cavalry: { initial: 1000, final: 900 } } } } };
    render(<BattleReportModal battleResult={report} playerCountry={countries.find(c => c.tag === 'ARG')!} allCountries={countries} onClose={vi.fn()} />);
    expect(screen.getByText('Blindados')).toBeTruthy(); expect(screen.getByText('Cavalaria')).toBeTruthy();
  });
});

describe('Military UI V2 recruitment presentation', () => {
  it('shows all seven cards, real costs, blocked reasons, legacy composition and queue progress', () => {
    const country = structuredClone(countries.find(c => c.tag === 'BRA')!), province = map()[0], technology = createInitialTechState('BRA');
    country.resources.gold = 5000; country.resources.manpower = 20000;
    province.market = normalizeMarket(province.market); province.market.goods.iron.stock = 1000; province.market.goods.tools.stock = 1000;
    province.buildings = []; const legacy = army('old'); legacy.regiments = [createRegiment('cavalry')];
    render(<ProvinceMilitaryTab province={province} playerCountry={country} armiesHere={[legacy]} technology={technology} onRecruit={vi.fn()} recruitments={[{ id: 'paid', owner: 'BRA', provinceId: 'a', unitType: 'cavalry', count: 2, daysRemaining: 10, totalDays: 20 }]} />);
    const cards = within(screen.getByRole('region', { name: 'Recrutamento moderno' }));
    for (const type of RECRUITABLE_UNIT_IDS) expect(cards.getByText(UNIT_DEFINITIONS[type].name)).toBeTruthy();
    expect(cards.queryByText(UNIT_DEFINITIONS.cavalry.name)).toBeNull();
    expect(cards.getAllByText('Ouro')).toHaveLength(7); expect(cards.getAllByText('Ferro')).toHaveLength(7);
    expect(cards.getByRole('button', { name: /Recrutar Blindados/ }).hasAttribute('disabled')).toBe(true);
    expect(cards.getAllByText('Arsenal Militar nível 2 necessário')).toHaveLength(2);
    expect(screen.getByText(/Cavalaria 1.000/)).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Progresso de Cavalaria' }).getAttribute('value')).toBe('50');
    expect(screen.getByText('a · 10 dias restantes')).toBeTruthy();
    const cost = getEffectiveRecruitmentCost('infantry', { country, province, technology });
    expect(cards.getAllByText(String(cost.gold)).length).toBeGreaterThan(0);
  });
});
