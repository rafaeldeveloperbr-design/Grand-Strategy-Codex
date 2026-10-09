// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countries, provincesData } from '../../../data/map';
import { createInitialNavies, orderFleetMove, portByProvince, seaNodeById } from '../../../engine/naval';
import type { Fleet } from '../../../types/naval';
import systemCss from '../../../styles/system.css?raw';
import { GameMap } from '../GameMap';
import { FleetMarker } from '../NavalLayer';
import { useGameSelection } from '../../../hooks/app/useGameSelection';

const own = createInitialNavies(countries, provincesData).find(f => f.countryTag === 'BRA')!;
const origin = portByProvince.get(own.portProvinceId!)!.seaNodeId;
const destination = seaNodeById.get(origin)!.neighbors[0];
const issued = vi.fn();
const props = { provinces: provincesData, countries, armies: [], recruitments: [], buildingConstructions: [], activeBattles: [], selectedProvince: null, hoveredProvince: null, selectedArmy: null, playerCountryTag: 'BRA', onProvinceClick: vi.fn(), onProvinceHover: vi.fn(), onArmyClick: vi.fn(), onProvinceRightClick: vi.fn(), initialViewBox: { x: 0, y: 100, w: 5040, h: 2300 } };
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });
const hit = () => screen.getByLabelText(`Fleet: ${own.name}`).querySelector('[data-fleet-hit-target]')!;

function Harness({ initial = own }: { initial?: Fleet }) {
  const [fleet, setFleet] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const selection = useGameSelection('BRA', { current: provincesData }, { current: props.armies }, vi.fn(), props.armies);
  return <><style>{systemCss}</style><output data-testid="selection">{JSON.stringify({ fleet: selected, province: selection.selectedProvince, army: selection.selectedArmy })}</output>
    <GameMap {...props} selectedProvince={selection.selectedProvince} selectedArmy={selection.selectedArmy} navalState={{ fleets: [fleet], battles: [] }} selectedFleetId={selected}
      onProvinceClick={id => { setSelected(null); selection.handleProvinceClick(id); props.onProvinceClick(id); }}
      onFleetSelect={id => { setSelected(id); if (id) { selection.clearArmySelection(); selection.handleClosePanel(); } }}
      onFleetOrder={id => { issued(id); const next = orderFleetMove(fleet, id, 'BRA'); if (next) setFleet(next); }}/></>;
}

describe('FleetMarker direct selection', () => {
  it.each(['DOCKED', 'HOLDING', 'MOVING', 'RETREATING', 'COMBAT'] as const)('selects and inspects an unselected %s fleet', status => {
    const fleet: Fleet = status === 'DOCKED' ? own : { ...own, status, portProvinceId: undefined, locationSeaNodeId: origin };
    render(<Harness initial={fleet}/>);
    expect(screen.queryByLabelText('Fleet panel')).toBeNull();
    expect(getComputedStyle(hit()).pointerEvents).toBe('all');
    fireEvent.click(hit());
    expect(screen.getByLabelText('Fleet panel').textContent).toContain(status);
    expect(JSON.parse(screen.getByTestId('selection').textContent!).fleet).toBe(own.id);
  });
  it.each([false, true])('reselects after Province selection with Naval Mode=%s, restores panel, Locate/F and node orders', mode => {
    const moving = orderFleetMove(own, destination, 'BRA')!;
    const { container } = render(<Harness initial={moving}/>);
    if (mode) fireEvent.click(screen.getByLabelText('Naval Mode'));
    fireEvent.click(hit());
    expect(screen.getByLabelText('Fleet panel')).toBeTruthy();
    fireEvent.click(container.querySelector(`[data-province-id="${own.portProvinceId}"]`)!);
    expect(screen.queryByLabelText('Fleet panel')).toBeNull();
    expect(JSON.parse(screen.getByTestId('selection').textContent!).province).toBe(own.portProvinceId);
    fireEvent.click(hit());
    expect(screen.getByLabelText('Fleet panel')).toBeTruthy();
    expect(JSON.parse(screen.getByTestId('selection').textContent!)).toEqual({ fleet: own.id, province: null, army: null });
    const svg = container.querySelector('svg.map__svg')!;
    const before = svg.getAttribute('viewBox');
    fireEvent.click(screen.getByText('Locate (F)'));
    const located = svg.getAttribute('viewBox');
    expect(located).not.toBe(before);
    fireEvent.click(screen.getByLabelText('Reset View'));
    fireEvent.keyDown(window, { key: 'f' });
    expect(svg.getAttribute('viewBox')).toBe(located);
    fireEvent.click(screen.getByLabelText('Reset View'));
    fireEvent.contextMenu(screen.getByLabelText(`SeaNode ${destination}`).querySelector('[data-sea-node-hit-target]')!, { button: 2 });
    expect(issued).toHaveBeenCalledExactlyOnceWith(destination);
    expect(screen.getByLabelText('Fleet panel').textContent).toContain('MOVING');
  });
  it('blocks mouse-down, click and double-click propagation to the map/province', () => {
    const select = vi.fn(), down = vi.fn(), click = vi.fn(), double = vi.fn(), command = vi.fn();
    render(<svg onMouseDown={down} onClick={click} onDoubleClick={double} onContextMenu={command}><FleetMarker fleet={own} selected={false} color="#fff" scale={1} onSelect={select}/></svg>);
    fireEvent.mouseDown(hit(), { button: 0 }); fireEvent.click(hit()); fireEvent.doubleClick(hit());
    expect(select).toHaveBeenCalledWith(own.id);
    expect(down).not.toHaveBeenCalled(); expect(click).not.toHaveBeenCalled(); expect(double).not.toHaveBeenCalled(); expect(command).not.toHaveBeenCalled();
  });
  it('pressing and moving on a fleet does not start camera drag', () => {
    const { container } = render(<Harness/>); const svg = container.querySelector('svg.map__svg')!;
    const before = svg.getAttribute('viewBox');
    fireEvent.mouseDown(hit(), { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(svg, { buttons: 1, clientX: 240, clientY: 240 });
    fireEvent.mouseUp(svg, { button: 0 }); fireEvent.click(hit());
    expect(svg.getAttribute('viewBox')).toBe(before);
    expect(screen.getByLabelText('Fleet panel')).toBeTruthy();
    expect(props.onProvinceClick).not.toHaveBeenCalled();
  });
  it('keeps a 32px hit area under actual decorative CSS after zoom without enlarging the visual', () => {
    const { container } = render(<Harness/>); const svg = container.querySelector('svg.map__svg')!;
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1008, 460));
    fireEvent.click(screen.getByLabelText('Naval Mode'));
    const before = Number(hit().getAttribute('r'));
    const width = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    fireEvent.click(screen.getByTitle('Zoom In'));
    const after = Number(hit().getAttribute('r'));
    expect(after).toBeLessThan(before);
    expect(after / before).toBeCloseTo(Number(svg.getAttribute('viewBox')!.split(' ')[2]) / width);
    expect(getComputedStyle(hit()).pointerEvents).toBe('all');
    fireEvent.click(hit()); expect(screen.getByLabelText('Fleet panel')).toBeTruthy();
  });
});
