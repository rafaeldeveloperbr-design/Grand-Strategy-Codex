// @vitest-environment jsdom
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countries, provincesData } from '../../../data/map';
import { createInitialNavies, orderFleetMove, portByProvince, seaNodeById } from '../../../engine/naval';
import type { Fleet } from '../../../types/naval';
import systemCss from '../../../styles/system.css?raw';
import { GameMap } from '../GameMap';

const own = createInitialNavies(countries, provincesData).find(f => f.countryTag === 'BRA')!;
const origin = portByProvince.get(own.portProvinceId!)!.seaNodeId;
const destination = seaNodeById.get(origin)!.neighbors[0];
const props = { provinces: provincesData, countries, armies: [], recruitments: [], buildingConstructions: [], activeBattles: [], selectedProvince: null, hoveredProvince: null, selectedArmy: null, playerCountryTag: 'BRA', onProvinceClick: vi.fn(), onProvinceHover: vi.fn(), onArmyClick: vi.fn(), onProvinceRightClick: vi.fn(), initialViewBox: { x: 0, y: 100, w: 5040, h: 2300 } };
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });
function hit(id = destination) {
  return screen.getByLabelText(`SeaNode ${id}`).querySelector('[data-sea-node-hit-target]')!;
}
function mount(fleet: Fleet = own, selected: string | null = fleet.id, order = vi.fn()) {
  return render(<><style>{systemCss}</style><GameMap {...props} navalState={{ fleets: [fleet], battles: [] }} selectedFleetId={selected} onFleetOrder={order}/></>);
}

describe('SeaNode contextmenu interaction', () => {
  it('the actual SVG hit circle forwards the exact ID and prevents the native menu without province callbacks', () => {
    const order = vi.fn(); mount(own, own.id, order);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    fireEvent(hit(), event);
    expect(event.defaultPrevented).toBe(true);
    expect(order).toHaveBeenCalledExactlyOnceWith(destination);
    expect(props.onProvinceClick).not.toHaveBeenCalled();
    expect(props.onProvinceRightClick).not.toHaveBeenCalled();
  });
  it('overrides the real decorative-circle CSS and keeps the 24px hit area after zoom', () => {
    const { container } = mount();
    // jsdom has no layout; supply the screen dimensions used by the real camera.
    vi.spyOn(container.querySelector('svg.map__svg')!, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1008, 460));
    fireEvent.click(screen.getByLabelText('Naval Mode'));
    const before = Number(hit().getAttribute('r'));
    expect(getComputedStyle(hit()).pointerEvents).toBe('all');
    expect(hit().getAttribute('fill')).toBe('transparent');
    const width = () => Number(container.querySelector('svg.map__svg')!.getAttribute('viewBox')!.split(' ')[2]);
    const initialWidth = width();
    fireEvent.click(screen.getByTitle('Zoom In'));
    const after = Number(hit().getAttribute('r'));
    expect(after).toBeLessThan(before);
    expect(after / before).toBeCloseTo(width() / initialWidth);
    expect(getComputedStyle(hit()).pointerEvents).toBe('all');
  });
  it('right mouse press and movement do not start a pan', () => {
    const { container } = mount();
    const svg = container.querySelector('svg.map__svg')!;
    const before = svg.getAttribute('viewBox');
    fireEvent.mouseDown(hit(), { button: 2, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(svg, { buttons: 2, clientX: 200, clientY: 200 });
    fireEvent.mouseUp(svg, { button: 2 });
    expect(svg.getAttribute('viewBox')).toBe(before);
    expect(props.onProvinceClick).not.toHaveBeenCalled();
  });
  it('Naval Mode exposes interactive nodes without a selection but emits no command', () => {
    const order = vi.fn(); mount(own, null, order);
    expect(screen.queryByLabelText(`SeaNode ${destination}`)).toBeNull();
    fireEvent.click(screen.getByLabelText('Naval Mode'));
    expect(getComputedStyle(hit()).pointerEvents).toBe('all');
    fireEvent.contextMenu(hit());
    expect(order).not.toHaveBeenCalled();
  });
  it('a selected foreign fleet cannot receive a node command', () => {
    const order = vi.fn(); const foreign = { ...own, id: 'foreign', countryTag: 'USA' };
    mount(foreign, foreign.id, order);
    fireEvent.click(screen.getByLabelText('Naval Mode'));
    fireEvent.contextMenu(hit());
    expect(order).not.toHaveBeenCalled();
  });
  it.each(['DOCKED', 'HOLDING'] as const)('%s fleet receives a real movement order in peace', status => {
    const initial: Fleet = status === 'DOCKED' ? own : { ...own, status, portProvinceId: undefined, locationSeaNodeId: origin };
    const issued = vi.fn();
    function CommandHarness() {
      const [fleet, setFleet] = useState(initial);
      return <><output data-testid="command-state">{JSON.stringify(fleet)}</output><GameMap {...props} wars={[]} navalState={{ fleets: [fleet], battles: [] }} selectedFleetId={fleet.id} onFleetOrder={id => {
        const next = orderFleetMove(fleet, id, 'BRA'); issued(id); if (next) setFleet(next);
      }}/></>;
    }
    render(<CommandHarness/>);
    fireEvent.click(screen.getByLabelText('Naval Mode'));
    fireEvent.contextMenu(hit(), { button: 2 });
    const fleet = JSON.parse(screen.getByTestId('command-state').textContent!) as Fleet;
    expect(issued).toHaveBeenCalledExactlyOnceWith(destination);
    expect(fleet.status).toBe('MOVING');
    expect(fleet.destinationSeaNodeId).toBe(destination);
    expect(fleet.route[fleet.route.length - 1]).toBe(destination);
  });
});
