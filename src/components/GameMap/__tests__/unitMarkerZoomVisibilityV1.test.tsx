// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { countries, provincesData, mapMetadata } from '../../../data/map';
import { createArmy, createRegiment } from '../../../engine/military';
import { createInitialAirState } from '../../../engine/air';
import { createInitialNavies, portByProvince } from '../../../engine/naval';
import { startContinuousBattle } from '../../../engine/combat';
import { GameMap, type MapProps } from '../GameMap';
import { ArmyMovementLayer } from '../ArmyMovementLayer';
import { AirLayer } from '../AirLayer';
import { NavalLayer } from '../NavalLayer';
import { buildArmyPresentation } from '../mapPresentation';
import { markerDetailLevel, type MarkerDetailLevel } from '../markerDetail';
import type { NavalBattle } from '../../../types/naval';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const viewport = mapMetadata.initialViewBox;
const province = provincesData.find(p => p.id === 'sa_bra_brasilia')!;
const army = (id: string) => ({ ...createArmy('BRA', id, province.id), id, regiments: [{ ...createRegiment('infantry'), strength: 1000 }] });
const units = [army('a'), army('b')];
const countryMap = new Map(countries.map(c => [c.tag, c]));
const air = createInitialAirState(countries, provincesData);
const wing = air.wings.find(w => w.countryTag === 'BRA')!;
const wings = [wing, { ...wing, id: 'second-wing', name: 'Second Wing' }];
const fleet = createInitialNavies(countries, provincesData).find(f => f.countryTag === 'BRA')!;
const ctx = { provinces: provincesData, countries, wars: [], relations: [] };
const baseProps: MapProps = { provinces: provincesData, countries, armies: [], recruitments: [], buildingConstructions: [], activeBattles: [], selectedArmy: null, selectedProvince: null, hoveredProvince: null, onProvinceClick: vi.fn(), onProvinceHover: vi.fn(), onArmyClick: vi.fn(), onProvinceRightClick: vi.fn() };
const zoomBox = (zoom: number) => ({ ...viewport, w: viewport.w / zoom, h: viewport.h / zoom, x: province.center.x - viewport.w / zoom / 2, y: province.center.y - viewport.h / zoom / 2 });
function armyLayer(detailLevel: MarkerDetailLevel, selectedArmy: string | null = null, armies = units) {
  return <svg><ArmyMovementLayer detailLevel={detailLevel} presentation={buildArmyPresentation(armies, [province])} countries={countryMap} selectedArmy={selectedArmy} hoveredArmyId={null} openStackKey={null} onArmyClick={baseProps.onArmyClick} onArmyHover={vi.fn()} onStackOpen={vi.fn()} /></svg>;
}
function airLayer(detailLevel: MarkerDetailLevel, mode = false, selected: string | null = null, list = wings, activate = vi.fn()) {
  return <svg onClick={baseProps.onProvinceClick as () => void}><AirLayer part="markers" detailLevel={detailLevel} mode={mode} state={{ wings: list, engagements: [] }} ctx={ctx} player="BRA" selected={selected} scale={1} viewport={viewport} onWing={vi.fn()} onZone={vi.fn()} onBase={vi.fn()} onCompactActivate={activate} /></svg>;
}
function navalLayer(detailLevel: MarkerDetailLevel, mode = false, selected: string | null = null, battles: NavalBattle[] = [], activate = vi.fn()) {
  return <svg onClick={baseProps.onProvinceClick as () => void}><NavalLayer detailLevel={detailLevel} mode={mode} selected={selected} fleets={[fleet]} battles={battles} wars={[]} countries={countryMap} provinces={provincesData} viewport={viewport} scale={1} onSelect={vi.fn()} onOrder={vi.fn()} onPort={vi.fn()} onBattle={vi.fn()} onCompactActivate={activate} /></svg>;
}

describe('unit marker semantic zoom', () => {
  it.each([[1, 'HIDDEN'], [3.999, 'HIDDEN'], [4, 'COMPACT'], [6.999, 'COMPACT'], [7, 'FULL'], [8, 'FULL']] as const)('zoom %s uses %s', (zoom, detail) => expect(markerDetailLevel(zoom)).toBe(detail));
  it.each([[1, 0, 0], [4, 1, 0], [7, 0, 1]] as const)('GameMap passes zoom %s to army layer', (zoom, compact, full) => {
    const view = render(<GameMap {...baseProps} initialViewBox={zoomBox(zoom)} armies={units} />);
    expect(view.container.querySelectorAll('.army-compact-marker')).toHaveLength(compact);
    expect(view.container.querySelectorAll('.army-stack-marker')).toHaveLength(full);
  });
  it('keeps only selected army/group compact while distant, including routes', () => {
    const moving = { ...units[0], destination: province.id, path: [province.id] };
    const view = render(armyLayer('HIDDEN', 'a', [moving, army('c')]));
    expect(view.container.querySelectorAll('.army-compact-marker')).toHaveLength(1);
    expect(view.container.querySelector('[data-route-army="a"]')).toBeTruthy();
    expect(view.container.querySelector('.army-mini-status')).toBeNull();
  });
  it('uses one compact stack, preserving identity and aggregate after reorder', () => {
    const view = render(armyLayer('COMPACT'));
    const marker = view.container.querySelector('.army-compact-marker')!;
    const key = marker.getAttribute('data-stack-key');
    expect(marker.getAttribute('aria-label')).toContain('2.000 tropas');
    expect(view.container.querySelectorAll('.army-compact-marker')).toHaveLength(1);
    view.rerender(armyLayer('COMPACT', null, [...units].reverse()));
    expect(view.container.querySelector('.army-compact-marker')!.getAttribute('data-stack-key')).toBe(key);
  });
  it('preserves full single and stack markers', () => {
    const view = render(armyLayer('FULL'));
    expect(view.container.querySelectorAll('.army-stack-marker')).toHaveLength(1);
    view.rerender(armyLayer('FULL', null, [units[0]]));
    expect(view.container.querySelectorAll('.army-marker')).toHaveLength(1);
  });
  it('opens compact stacks and supports additive selection and keyboard without bubbling', () => {
    const open = vi.fn(), toggle = vi.fn(), bubble = vi.fn();
    const view = render(<svg onClick={bubble} onKeyDown={bubble}><ArmyMovementLayer detailLevel="COMPACT" presentation={buildArmyPresentation(units, [province])} countries={countryMap} selectedArmy={null} hoveredArmyId={null} openStackKey={null} onArmyClick={vi.fn()} onArmyHover={vi.fn()} onStackOpen={open} onStackToggleAdditive={toggle} /></svg>);
    const marker = view.getByRole('button');
    fireEvent.click(marker); expect(open).toHaveBeenCalledTimes(1);
    fireEvent.click(marker, { ctrlKey: true }); expect(toggle).toHaveBeenCalledWith(['a', 'b']);
    fireEvent.keyDown(marker, { key: ' ' }); expect(open).toHaveBeenCalledTimes(2);
    expect(bubble).not.toHaveBeenCalled();
  });
  it('compact single army preserves normal and Ctrl click', () => {
    const view = render(armyLayer('COMPACT', null, [units[0]]));
    fireEvent.click(view.getByRole('button')); expect(baseProps.onArmyClick).toHaveBeenCalledWith('a', false);
    fireEvent.click(view.getByRole('button'), { ctrlKey: true }); expect(baseProps.onArmyClick).toHaveBeenCalledWith('a', true);
  });
});

describe('Air compact markers', () => {
  it('aggregates wings per base with correct count and stable identity after reorder', () => {
    const view = render(airLayer('COMPACT'));
    expect(view.container.querySelectorAll('[data-air-compact]')).toHaveLength(1);
    expect(view.container.querySelector('[data-air-compact]')!.textContent).toContain('✈ 2');
    expect(view.container.querySelectorAll('[data-air-wing-id]')).toHaveLength(0);
    const id = view.container.querySelector('[data-air-compact]')!.getAttribute('data-air-base-id');
    view.rerender(airLayer('COMPACT', false, null, [...wings].reverse()));
    expect(view.container.querySelector('[data-air-compact]')!.getAttribute('data-air-base-id')).toBe(id);
  });
  it('keeps only icon and count visible with the same transparent hit target', () => {
    const view = render(airLayer('COMPACT'));
    const marker = view.container.querySelector('[data-air-compact]')!;
    const hitTarget = marker.querySelector('rect')!;
    expect(marker.querySelectorAll('rect')).toHaveLength(1);
    expect(hitTarget.getAttribute('fill')).toBe('transparent');
    expect(hitTarget.hasAttribute('stroke')).toBe(false);
    expect(hitTarget.getAttribute('width')).toBe('44');
    expect(hitTarget.getAttribute('height')).toBe('32');
    expect((hitTarget as SVGElement).style.pointerEvents).toBe('all');
    expect(marker.querySelector('text')!.textContent).toBe('✈ 2');
    expect(marker.querySelector('text')!.getAttribute('stroke')).toBe('#151821');
    expect(marker.getAttribute('tabindex')).toBe('0');
  });
  it.each(['click', 'Enter', ' '])('activates base with %s without bubbling', key => {
    const activate = vi.fn(); const view = render(airLayer('COMPACT', false, null, wings, activate));
    const marker = view.getByRole('button');
    if (key === 'click') fireEvent.click(marker); else fireEvent.keyDown(marker, { key });
    expect(activate).toHaveBeenCalledExactlyOnceWith(wing.baseProvinceId);
    expect(baseProps.onProvinceClick).not.toHaveBeenCalled();
  });
  it('hides distant wings, keeps selected base compact and uses compact in distant Air Mode', () => {
    const view = render(airLayer('HIDDEN')); expect(view.queryAllByRole('button')).toHaveLength(0);
    view.rerender(airLayer('HIDDEN', false, wing.id)); expect(view.container.querySelectorAll('[data-air-compact]')).toHaveLength(1);
    view.rerender(airLayer('HIDDEN', true)); expect(view.container.querySelectorAll('[data-air-compact]')).toHaveLength(1);
    expect(view.container.querySelectorAll('[data-air-wing-id]')).toHaveLength(0);
  });
  it('Air Mode promotes medium detail to full wing markers', () => {
    const view = render(airLayer('COMPACT', true)); expect(view.container.querySelectorAll('[data-air-wing-id]')).toHaveLength(2);
    expect(view.container.querySelector('[data-air-compact]')).toBeNull();
  });
  it('GameMap activates Air Mode without selecting a wing or clicking a province', () => {
    const select = vi.fn(); const view = render(<GameMap {...baseProps} initialViewBox={zoomBox(4)} airState={{ wings, engagements: [] }} onAirWingSelect={select} />);
    fireEvent.click(view.container.querySelector('[data-air-compact]')!);
    expect(view.getByLabelText('Air Mode').getAttribute('aria-pressed')).toBe('true');
    expect(view.container.querySelectorAll('[data-air-wing-id]')).toHaveLength(2);
    expect(select).not.toHaveBeenCalled(); expect(baseProps.onProvinceClick).not.toHaveBeenCalled();
  });
});

describe('Naval compact markers and mode integration', () => {
  it('renders only anchor plus hit target, and keeps selected fleet distant', () => {
    const view = render(navalLayer('COMPACT')); const marker = view.container.querySelector('[data-fleet-compact]')!;
    expect(marker.querySelector('text')!.textContent).toBe('⚓'); expect(marker.querySelectorAll('circle')).toHaveLength(1);
    view.rerender(navalLayer('HIDDEN')); expect(view.queryByLabelText(`Fleet: ${fleet.name}`)).toBeNull();
    view.rerender(navalLayer('HIDDEN', false, fleet.id)); expect(view.container.querySelector('[data-fleet-compact]')).toBeTruthy();
    view.rerender(navalLayer('HIDDEN', true)); expect(view.container.querySelector('[data-fleet-compact]')).toBeTruthy();
  });
  it.each(['click', 'Enter', ' '])('compact fleet activation with %s stops bubbling', key => {
    const activate = vi.fn(); const view = render(navalLayer('COMPACT', false, null, [], activate)); const marker = view.getByLabelText(`Fleet: ${fleet.name}`);
    if (key === 'click') fireEvent.click(marker); else fireEvent.keyDown(marker, { key });
    expect(activate).toHaveBeenCalledExactlyOnceWith(fleet.id); expect(baseProps.onProvinceClick).not.toHaveBeenCalled();
  });
  it('Naval Mode uses full FleetMarker at medium zoom', () => {
    const view = render(navalLayer('COMPACT', true)); const marker = view.getByLabelText(`Fleet: ${fleet.name}`);
    expect(marker.querySelectorAll('circle')).toHaveLength(2); expect(marker.hasAttribute('data-fleet-compact')).toBe(false);
  });
  it('preserves compact fleet count and IDs after fleet array reorder', () => {
    const other = { ...fleet, id: 'other-fleet', name: 'Other Fleet' };
    const renderFleets = (list: typeof fleet[]) => <svg><NavalLayer detailLevel="COMPACT" mode={false} selected={null} fleets={list} battles={[]} wars={[]} countries={countryMap} provinces={provincesData} viewport={viewport} scale={1} onSelect={vi.fn()} onOrder={vi.fn()} onPort={vi.fn()} onBattle={vi.fn()} onCompactActivate={vi.fn()} /></svg>;
    const view = render(renderFleets([fleet, other]));
    const ids = () => [...view.container.querySelectorAll('[data-fleet-compact]')].map(marker => marker.getAttribute('data-fleet-id')).sort();
    expect(ids()).toEqual([fleet.id, other.id].sort());
    view.rerender(renderFleets([other, fleet]));
    expect(ids()).toEqual([fleet.id, other.id].sort());
  });
  it('GameMap activates Naval Mode and existing fleet selection', () => {
    const select = vi.fn(), clear = vi.fn(); const view = render(<GameMap {...baseProps} initialViewBox={zoomBox(4)} navalState={{ fleets: [fleet], battles: [] }} onFleetSelect={select} onClearSelection={clear} />);
    fireEvent.click(view.getByLabelText(`Fleet: ${fleet.name}`));
    expect(view.getByLabelText('Naval Mode').getAttribute('aria-pressed')).toBe('true'); expect(select).toHaveBeenCalledWith(fleet.id);
    expect(clear).toHaveBeenCalled(); expect(baseProps.onProvinceClick).not.toHaveBeenCalled();
  });
  it('preserves battle markers at hidden detail', () => {
    const battle = { id: 'battle', status: 'ACTIVE', seaNodeId: portByProvince.get(fleet.portProvinceId!)!.seaNodeId } as NavalBattle;
    const view = render(navalLayer('HIDDEN', false, null, [battle]));
    expect(view.getByLabelText('Naval battle')).toBeTruthy();
    expect(view.container.querySelector('[data-fleet-id]')).toBeNull();
  });
  it('keeps terrestrial battles rendered while army markers are hidden', () => {
    const attacker = units[0], defender = { ...units[1], owner: 'ARG' };
    const battle = startContinuousBattle([attacker], [defender], province, { year: 1936, month: 1, day: 1 }, 'marker-test');
    const view = render(<GameMap {...baseProps} armies={[attacker, defender]} activeBattles={[battle]} />);
    expect(view.container.querySelector('.battle-markers-layer > g')).toBeTruthy();
    expect(view.container.querySelector('.army-marker, .army-compact-marker')).toBeNull();
  });
  it('selectionMode excludes Air/Naval markers and controls even with selected entities', () => {
    const view = render(<GameMap {...baseProps} selectionMode selectedAirWingId={wing.id} selectedFleetId={fleet.id} airState={{ wings, engagements: [] }} navalState={{ fleets: [fleet], battles: [] }} initialViewBox={zoomBox(7)} />);
    expect(view.container.querySelector('[data-air-wing-id], [data-air-compact], [data-fleet-id]')).toBeNull();
    expect(view.queryByLabelText('Air Mode')).toBeNull(); expect(view.queryByLabelText('Naval Mode')).toBeNull();
  });
});
