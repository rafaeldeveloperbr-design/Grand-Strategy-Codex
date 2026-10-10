// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { countries, provincesData, mapMetadata } from '../../../data/map';
import { GameMap, type MapProps } from '../GameMap';
import { CountryLabelsLayer } from '../CountryLabelsLayer';
import { COUNTRY_LABEL_MIN_ZOOM, PROVINCE_LABEL_MIN_ZOOM } from '../mapPresentation';

const mapCountries = countries.filter(country => ['BRA', 'URY'].includes(country.tag));
const provinces = provincesData.filter(province => mapCountries.some(country => country.tag === province.owner));
const props: MapProps = { provinces, countries: mapCountries, armies: [], recruitments: [], buildingConstructions: [], activeBattles: [],
  selectedProvince: null, hoveredProvince: null, selectedArmy: null,
  onProvinceClick: vi.fn(), onProvinceHover: vi.fn(), onArmyClick: vi.fn(), onProvinceRightClick: vi.fn() };
afterEach(cleanup);

describe('Country labels V1', () => {
  it.each([1, 2.999, COUNTRY_LABEL_MIN_ZOOM, 5, 7.999, PROVINCE_LABEL_MIN_ZOOM, 9])('uses mutually exclusive country/province labels at zoom %s', zoom => {
    const view = render(<GameMap {...props} initialViewBox={{ ...mapMetadata.initialViewBox, w: mapMetadata.initialViewBox.w / zoom }} />);
    const countryLabels = view.container.querySelectorAll('.map__country-label');
    expect(countryLabels).toHaveLength(zoom >= COUNTRY_LABEL_MIN_ZOOM && zoom < PROVINCE_LABEL_MIN_ZOOM ? mapCountries.length : 0);
    expect(view.container.querySelectorAll('.map__province-label')).toHaveLength(zoom >= PROVINCE_LABEL_MIN_ZOOM ? provinces.length : 0);
    if (countryLabels.length) expect([...countryLabels].map(label => label.textContent?.trim())).toEqual(mapCountries.map(country => country.name));
  });
  it('renders exactly one unboxed, noninteractive label per territorial country at its mean province center', () => {
    const view = render(<svg><CountryLabelsLayer countries={mapCountries} provinces={provinces} /></svg>);
    for (const country of mapCountries) {
      const labels = view.container.querySelectorAll(`[data-country-label="${country.tag}"]`);
      expect(labels).toHaveLength(1);
      const owned = provinces.filter(province => province.owner === country.tag);
      expect(Number(labels[0].getAttribute('x'))).toBeCloseTo(owned.reduce((sum, p) => sum + p.center.x, 0) / owned.length);
      expect(Number(labels[0].getAttribute('y'))).toBeCloseTo(owned.reduce((sum, p) => sum + p.center.y, 0) / owned.length);
      expect(labels[0].getAttribute('pointer-events')).toBe('none');
      expect((labels[0] as SVGElement).style.textTransform).toBe('uppercase');
    }
    expect(view.container.querySelector('rect')).toBeNull();
    const large = view.container.querySelector('[data-country-label="BRA"]')!;
    const small = view.container.querySelector('[data-country-label="URY"]')!;
    expect(Number(large.getAttribute('font-size'))).toBeGreaterThan(Number(small.getAttribute('font-size')));
  });
  it.each([[1, 13], [4, 13], [5, 17], [9, 17], [10, 22], [19, 22], [20, 28], [100, 28]])('uses font size %s provinces -> %s within the clamp', (count, size) => {
    const country = mapCountries[0];
    const owned = Array.from({ length: count }, (_, i) => ({ ...provinces[0], id: `province-${i}`, owner: country.tag }));
    const view = render(<svg><CountryLabelsLayer countries={[country]} provinces={owned} /></svg>);
    expect(view.container.querySelector('text')!.getAttribute('font-size')).toBe(String(size));
    expect(size).toBeGreaterThanOrEqual(12); expect(size).toBeLessThanOrEqual(30);
  });
});
