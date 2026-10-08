// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CountrySelectionScreen } from '../../CountrySelectionScreen';
import { GameMap } from '../GameMap';
import { countries, provincesData, mapMetadata } from '../../../data/map';
import { getCountryInitialView } from '../../../engine/countrySelection';

afterEach(cleanup);
describe('real selection map integration', () => {
  it('clicking Greenland highlights Denmark holdings, preserves hover names and confirms Denmark', () => {
    const confirm = vi.fn();
    const { container } = render(<CountrySelectionScreen onConfirm={confirm} onLoad={vi.fn()} saves={[]} error={null} />);
    const greenland = provincesData.find(p => p.name === 'Greenland')!;
    const path = container.querySelector(`[data-province-id="${greenland.id}"]`)!;
    fireEvent.click(path);
    expect(container.querySelectorAll('.map__province--selected')).toHaveLength(provincesData.filter(p => p.owner === 'DNK').length);
    fireEvent.mouseEnter(path, { clientX: 30, clientY: 30 });
    expect(screen.getByRole('tooltip').textContent).toContain('Greenland');
    expect(screen.getByRole('tooltip').textContent).toContain(countries.find(c => c.tag === 'DNK')!.name);
    fireEvent.click(screen.getByRole('button', { name: `Jogar como ${countries.find(c => c.tag === 'DNK')!.name}` }));
    expect(confirm).toHaveBeenCalledWith('DNK');
    expect(confirm).toHaveBeenCalledTimes(1);
  });
  it('country-focused view initializes controls and Reset preserves the world overview', () => {
    const player = countries.find(c => c.tag === 'AND')!;
    const owned = provincesData.filter(p => p.owner === player.tag);
    const box = getCountryInitialView(player, owned)!;
    render(<GameMap provinces={owned} countries={[player]} armies={[]} recruitments={[]} buildingConstructions={[]}
      activeBattles={[]} selectedProvince={null} hoveredProvince={null} selectedArmy={null} initialViewBox={box}
      onProvinceClick={vi.fn()} onProvinceHover={vi.fn()} onArmyClick={vi.fn()} onProvinceRightClick={vi.fn()} />);
    const svg = screen.getByLabelText(mapMetadata.name);
    expect(svg.getAttribute('viewBox')).toBe(`${box.x} ${box.y} ${box.w} ${box.h}`);
    fireEvent.click(screen.getByTitle('Reset'));
    const world = mapMetadata.initialViewBox;
    expect(svg.getAttribute('viewBox')).toBe(`${world.x} ${world.y} ${world.w} ${world.h}`);
  });
});
