// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { GameMap } from '../../components/GameMap/GameMap';
import App from '../../App';
import { countries, mapMetadata, provincesData } from '../../data/map';
import { createInitialArmies } from '../../data/map/initialState';

afterEach(cleanup);

describe('South America rendering and map controls', () => {
  it('renders all provinces, explicit capitals and the metadata viewport, and resets zoom', () => {
    const { container, getByTitle } = render(<GameMap
      provinces={provincesData} countries={countries} armies={createInitialArmies(countries)}
      recruitments={[]} buildingConstructions={[]} activeBattles={[]}
      selectedProvince={null} hoveredProvince={null} selectedArmy={null}
      onProvinceHover={vi.fn()} onProvinceClick={vi.fn()} onArmyClick={vi.fn()} onProvinceRightClick={vi.fn()}
    />);
    const svg = container.querySelector('svg.map__svg')!;
    const { x, y, w, h } = mapMetadata.initialViewBox;
    const initial = `${x} ${y} ${w} ${h}`;
    expect(svg.getAttribute('viewBox')).toBe(initial);
    expect(container.querySelectorAll('[data-province-id]')).toHaveLength(196);
    expect(container.querySelectorAll('.map__province-label')).toHaveLength(196);
    expect(container.querySelectorAll('[data-province-id^="sa_"]')).toHaveLength(56);
    expect(container.querySelectorAll('[data-province-id^="na_"]')).toHaveLength(35);
    expect([...container.querySelectorAll('text')].filter(text => text.textContent === '★')).toHaveLength(89);
    fireEvent.click(getByTitle('Zoom In'));
    expect(svg.getAttribute('viewBox')).not.toBe(initial);
    fireEvent.click(getByTitle('Reset'));
    expect(svg.getAttribute('viewBox')).toBe(initial);
  });

  it('selects and orders movement using the actual province path, with no sea proximity fallback', () => {
    const onClick = vi.fn(), onRightClick = vi.fn();
    const { container } = render(<GameMap
      provinces={provincesData} countries={countries} armies={[]}
      recruitments={[]} buildingConstructions={[]} activeBattles={[]}
      selectedProvince={null} hoveredProvince={null} selectedArmy={null}
      onProvinceHover={vi.fn()} onProvinceClick={onClick} onArmyClick={vi.fn()} onProvinceRightClick={onRightClick}
    />);
    const path = container.querySelector('[data-province-id="sa_bra_brasilia"]')!;
    fireEvent.click(path);
    expect(onClick).toHaveBeenCalledWith('sa_bra_brasilia');
    fireEvent.contextMenu(path);
    expect(onRightClick).toHaveBeenCalledWith('sa_bra_brasilia');
    onRightClick.mockClear();
    fireEvent.contextMenu(container.querySelector('svg.map__svg')!);
    expect(onRightClick).not.toHaveBeenCalled();
  });

  it('starts the full application with the active scenario and Brazil as player', () => {
    window.history.replaceState({}, '', '/?newgame=1');
    const { container } = render(<App />);
    expect(container.querySelectorAll('[data-province-id]')).toHaveLength(196);
    expect(container.textContent).toContain('Brasil');
    expect(container.textContent).not.toContain('Império Aureliano');
  });
});
