// @vitest-environment jsdom
import React, { useEffect, useRef, useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Army } from '../../types';
import { countries, provincesData } from '../../data/map';
import { createArmy, createRegiment, splitArmyByRegiments, transferRegiments, mergeArmyGroup, type ReorganizationContext } from '../../engine/military';
import { createInitialTechState } from '../../engine/technology';
import { saveGame, loadGame } from '../../engine/saveSystem';
import { ArmyReorganizationPanel } from '../ArmyReorganizationPanel';
import { useArmyActions } from '../../hooks/app/useArmyActions';
import { useGameSelection } from '../../hooks/app/useGameSelection';

afterEach(() => { cleanup(); localStorage.clear(); });
const province = provincesData.find(p => p.owner === 'BRA')!;
const host = (id: string): Army => ({ ...createArmy('BRA', id, province.id), id, regiments: ['infantry', 'artillery', 'motorized_infantry', 'cavalry'].map(type => ({ ...createRegiment(type as 'infantry' | 'artillery' | 'motorized_infantry' | 'cavalry', province.id), strength: 333, organization: 37, morale: 63, experience: 19 })) });
function Harness({ multiple = false, moving = false }: { multiple?: boolean; moving?: boolean }) {
  const [armies, setArmies] = useState([host('one'), host('two')].map((a, i) => moving && i === 0 ? { ...a, movementPlan: { waypoints: [province.id] } } : a));
  const armiesRef = useRef(armies), provincesRef = useRef([province]);
  useEffect(() => { armiesRef.current = armies; }, [armies]);
  const selection = useGameSelection('BRA', provincesRef, armiesRef, vi.fn(), armies);
  const { handleArmyClick, toggleStackSelection } = selection;
  useEffect(() => { if (multiple) toggleStackSelection(['one', 'two']); else handleArmyClick('one'); }, [multiple, handleArmyClick, toggleStackSelection]);
  const actions = useArmyActions({ selectedArmy: selection.selectedArmy, selectedArmyIds: selection.selectedArmyIds, setSelectedArmy: selection.setSelectedArmy, setSelectedProvince: selection.setSelectedProvince, setIsPanelOpen: selection.setIsPanelOpen, provincesRef, armiesRef, diplomaticRelationsRef: useRef([]), playerCountryTag: 'BRA', setArmies, addLog: vi.fn(), addToast: vi.fn(), splitSelection: selection.splitSelection, setSplitSelection: selection.setSplitSelection, setShowSplitModal: selection.setShowSplitModal });
  return <><ArmyReorganizationPanel selectedIds={selection.selectedArmyIds} context={{ armies, provinces: [province], playerCountryTag: 'BRA' }} onConfirm={actions.handleReorganize} onHalf={actions.handleSplitHalf} /><output data-testid="army-state">{JSON.stringify(armies)}</output><output data-testid="selection">{selection.selectedArmyIds.join(',')}</output></>;
}
const state = (): Army[] => JSON.parse(screen.getByTestId('army-state').textContent!);

describe('Army Reorganization V1 UI', () => {
  it('blocks a stale regiment selection after the army changes while the dialog is open', () => {
    const source = host('one');
    const onConfirm = vi.fn();
    const context = { armies: [source], provinces: [province], playerCountryTag: 'BRA' };
    const view = render(<ArmyReorganizationPanel selectedIds={['one']} context={context} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dividir' }));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    view.rerender(<ArmyReorganizationPanel selectedIds={['one']} context={{ ...context, armies: [{ ...source, regiments: [...source.regiments].reverse() }] }} onConfirm={onConfirm} />);
    expect(screen.getByText('A composição mudou. Revise a seleção antes de confirmar.')).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Criar destacamento' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it('opens split, previews whole damaged regiments, confirms and selects the detachment', () => {
    render(<Harness />); fireEvent.click(screen.getByRole('button', { name: 'Dividir' }));
    const modal = screen.getByRole('dialog', { name: 'Dividir exército' });
    expect(within(modal).getByText('Nenhum regimento selecionado')).toBeTruthy();
    fireEvent.click(within(modal).getAllByRole('checkbox')[0]);
    expect(within(modal).getByText('Exército atual')).toBeTruthy();
    expect(within(modal).getByText('1.332 → 999')).toBeTruthy();

    expect(within(modal).getByText('Novo exército')).toBeTruthy();
    expect(within(modal).getByText('333 homens')).toBeTruthy();
    expect(within(modal).getByText('1× Infantaria')).toBeTruthy();
    fireEvent.click(within(modal).getByRole('button', { name: 'Criar destacamento' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(state()).toHaveLength(3);
    const selected = state().find(a => a.id === screen.getByTestId('selection').textContent)!;
    expect(selected.regiments).toHaveLength(1); expect(selected.regiments[0].strength).toBe(333); expect(selected.regiments[0].experience).toBe(19);
    expect(state().find(a => a.id === 'one')!.regiments).toHaveLength(3);
  });
  it('blocks selecting every regiment and cancels without modifying state', () => {
    render(<Harness />); const before = state(); fireEvent.click(screen.getByRole('button', { name: 'Dividir' }));
    const modal = screen.getByRole('dialog'); for (const checkbox of within(modal).getAllByRole('checkbox')) fireEvent.click(checkbox);
    expect(within(modal).getByText('Todos os regimentos selecionados')).toBeTruthy();
    expect(within(modal).getByRole('button', { name: 'Criar destacamento' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' })); expect(state()).toEqual(before); expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('transfers selected regiments and keeps the source selected', () => {
    render(<Harness />); fireEvent.click(screen.getByRole('button', { name: 'Transferir' }));
    const modal = screen.getByRole('dialog'); expect(within(modal).getByRole('combobox').textContent).toContain('two');
    fireEvent.click(within(modal).getAllByRole('checkbox')[1]); fireEvent.click(within(modal).getByRole('button', { name: 'Transferir regimentos' }));
    expect(state().find(a => a.id === 'one')!.regiments).toHaveLength(3); expect(state().find(a => a.id === 'two')!.regiments).toHaveLength(5);
    expect(state().find(a => a.id === 'two')!.regiments[4].type).toBe('artillery'); expect(screen.getByTestId('selection').textContent).toBe('one');
  });
  it.each([false, true])('merges individual/multiple selected armies with a preview: multiple=$value', multiple => {
    render(<Harness multiple={multiple} />); fireEvent.click(screen.getByRole('button', { name: multiple ? 'Fundir selecionados' : 'Fundir' }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText('Exército resultante')).toBeTruthy();
    expect(within(modal).getByText(/2\.664 homens/)).toBeTruthy();
    fireEvent.click(within(modal).getByRole('button', { name: 'Fundir exércitos' }));
    expect(state()).toHaveLength(1); expect(state()[0].id).toBe('one'); expect(state()[0].regiments).toHaveLength(8); expect(screen.getByTestId('selection').textContent).toBe('one');
  });
  it('shows a shared movement-plan block without clearing the route', () => {
    render(<Harness moving />); expect(screen.getByRole('button', { name: 'Dividir' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Exército em movimento ou com rota ativa/)).toBeTruthy(); expect(state()[0].movementPlan?.waypoints).toEqual([province.id]);
  });
  it('closes using Escape and leaves the armies unchanged', () => {
    render(<Harness />); const before = state(); fireEvent.click(screen.getByRole('button', { name: 'Dividir' }));
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull(); expect(state()).toEqual(before);
  });
  it('shows multi-selection block reasons for armies in different provinces', () => {
    const one = host('one'), two = { ...host('two'), location: 'other' }, ctx = { armies: [one, two], provinces: [province, { ...province, id: 'other' }], playerCountryTag: 'BRA' };
    render(<ArmyReorganizationPanel selectedIds={['one', 'two']} context={ctx} onConfirm={vi.fn()} />);
    expect(screen.getByText('Exércitos em províncias diferentes')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Fundir selecionados' }).hasAttribute('disabled')).toBe(true);
  });
});

describe('Army Reorganization V1 persistence', () => {
  it.each(['split', 'transfer', 'merge'] as const)('%s round-trips damaged modern/legacy armies with no resource changes', mode => {
    const ctx: ReorganizationContext = { armies: [host('one'), host('two')], provinces: [structuredClone(province)], playerCountryTag: 'BRA' };
    const result = mode === 'split' ? splitArmyByRegiments('one', [0, 3], ctx) : mode === 'transfer' ? transferRegiments('one', 'two', [0, 3], ctx) : mergeArmyGroup(['one', 'two'], ctx);
    if (!result.success) throw new Error('fixture');
    const country = structuredClone(countries.find(c => c.tag === 'BRA')!);
    const refs: Parameters<typeof saveGame>[0] = { provincesRef: { current: ctx.provinces }, countriesRef: { current: [country] }, armiesRef: { current: result.armies }, warsRef: { current: [] }, diplomaticRelationsRef: { current: [] }, recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] }, playerTechStateRef: { current: createInitialTechState('BRA') }, botTechStatesRef: { current: new Map() }, activeBattlesRef: { current: [] }, dateRef: { current: { year: 1836, month: 1, day: 1 } } };
    expect(saveGame(refs, 'reorganized')).toBe(true);
    const loaded = loadGame('reorganized')!; expect(loaded.version).toBe(2); expect(loaded.military.armies).toEqual(result.armies); expect(loaded.world.countries[0].resources).toEqual(country.resources);
    expect(loaded.military.armies.flatMap(a => a.regiments).some(r => r.type === 'cavalry' && r.strength === 333 && r.experience === 19)).toBe(true);
  });
});
