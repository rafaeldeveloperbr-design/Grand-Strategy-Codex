// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { countries, provincesData, mapMetadata } from '../../../data/map';
import { GameMap, type MapProps } from '../GameMap';
import { ProvinceLayer } from '../ProvinceLayer';
import { PROVINCE_LABEL_MIN_ZOOM } from '../mapPresentation';

const capital = provincesData.find(p => p.id === 'sa_bra_brasilia')!;
const neighbor = provincesData.find(p => p.id === capital.neighbors[0])!;
const mapCountries = countries.filter(c => c.tag === 'BRA');
const props: MapProps = {
  provinces: [capital, neighbor], countries: mapCountries, armies: [], recruitments: [], buildingConstructions: [], activeBattles: [],
  selectedProvince: null, hoveredProvince: null, selectedArmy: null,
  onProvinceClick: vi.fn(), onProvinceHover: vi.fn(), onArmyClick: vi.fn(), onProvinceRightClick: vi.fn(),
};
const zoomBox = (zoom: number) => ({ ...mapMetadata.initialViewBox, w: mapMetadata.initialViewBox.w / zoom });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Province label zoom visibility V1', () => {
  it.each([1, 7.999])('omits all province labels at zoom %s including capitals', zoom => {
    const view = render(<GameMap {...props} initialViewBox={zoomBox(zoom)} />);
    expect(view.container.querySelectorAll('.map__province-label')).toHaveLength(0);
    expect([...view.container.querySelectorAll('text')].filter(text => text.textContent === '★')).toHaveLength(1);
    expect(view.container.querySelectorAll('.map__province')).toHaveLength(2);
  });
  it.each([PROVINCE_LABEL_MIN_ZOOM, 9])('preserves existing names, style and position at zoom %s', zoom => {
    const view = render(<GameMap {...props} initialViewBox={zoomBox(zoom)} />);
    const labels = [...view.container.querySelectorAll('.map__province-label')];
    expect(labels.map(label => label.textContent?.trim())).toEqual(props.provinces.map(p => p.name));
    const original = render(<svg><ProvinceLayer provinces={props.provinces} countries={mapCountries} buildingConstructions={[]} recruitments={[]}
      selectedProvince={null} hoveredProvince={null} onProvinceClick={vi.fn()} onMouseEnter={vi.fn()} onMouseMove={vi.fn()} onMouseLeave={vi.fn()} /></svg>);
    expect(labels.map(label => label.outerHTML)).toEqual([...original.container.querySelectorAll('.map__province-label')].map(label => label.outerHTML));
    expect([...view.container.querySelectorAll('text')].filter(text => text.textContent === '★')).toHaveLength(1);
  });
  it.each([1, PROVINCE_LABEL_MIN_ZOOM])('preserves province interaction and tooltip at zoom %s', zoom => {
    const view = render(<GameMap {...props} initialViewBox={zoomBox(zoom)} />);
    const path = view.container.querySelector(`[data-province-id="${capital.id}"]`)!;
    fireEvent.click(path); expect(props.onProvinceClick).toHaveBeenCalledWith(capital.id);
    fireEvent.contextMenu(path); expect(props.onProvinceRightClick).toHaveBeenCalledWith(capital.id);
    fireEvent.mouseEnter(path, { clientX: 120, clientY: 180 });
    expect(view.getByRole('tooltip').textContent).toContain(capital.name);
    fireEvent.mouseLeave(path); expect(view.queryByRole('tooltip')).toBeNull();
  });
});
