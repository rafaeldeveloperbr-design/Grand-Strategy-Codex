import { describe, expect, it } from 'vitest';
import { assembleMap, countries, mapCapitals, mapRegions, provincesData, validateMapTopology } from '../../data/map';
import { provincesData as legacyProvinces } from '../../data/provinces';
import { countries as legacyCountries, getCountryByTag } from '../../data/countries';
import type { TopologyCountry, TopologyProvince } from '../../data/map';
import { findPath } from '../military/movementEngine';

function fixture(): { provinces: TopologyProvince[]; countries: TopologyCountry[] } {
  return {
    provinces: [{ id: 'a', owner: 'A', neighbors: ['b'] }, { id: 'b', owner: 'A', neighbors: ['a'] }],
    countries: [{ tag: 'A', provinces: ['a', 'b'], capital: 'a' }],
  };
}

describe('map topology validation', () => {
  it('accepts a valid map and does not mutate inputs', () => {
    const data = fixture();
    const before = JSON.stringify(data);
    expect(validateMapTopology(data.provinces, data.countries)).toEqual({ valid: true, issues: [], components: [['a', 'b']] });
    expect(JSON.stringify(data)).toBe(before);
  });

  it.each([
    ['missing-neighbor', (p: TopologyProvince[]) => { p[0].neighbors = ['b', 'missing']; }],
    ['asymmetric-neighbor', (p: TopologyProvince[]) => { p[1].neighbors = []; }],
    ['duplicate-neighbor', (p: TopologyProvince[]) => { p[0].neighbors = ['b', 'b']; }],
    ['self-neighbor', (p: TopologyProvince[]) => { p[0].neighbors = ['a', 'b']; }],
    ['invalid-owner', (p: TopologyProvince[]) => { p[0].owner = 'missing'; }],
    ['owner-mismatch', (p: TopologyProvince[]) => { p[0].owner = 'B'; }],
    ['duplicate-province-id', (p: TopologyProvince[]) => { p.push({ ...p[0] }); }],
  ] as const)('detects %s', (type, mutate) => {
    const data = fixture(); mutate(data.provinces);
    const result = validateMapTopology(data.provinces, data.countries);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ type, provinceId: 'a' }));
  });

  it('detects isolated provinces and separate connected landmasses', () => {
    const data = fixture();
    data.provinces.push({ id: 'c', owner: 'A', neighbors: ['d'] }, { id: 'd', owner: 'A', neighbors: ['c'] }, { id: 'e', owner: 'A', neighbors: [] });
    data.countries[0].provinces = ['a', 'b', 'c', 'd', 'e'];
    const result = validateMapTopology(data.provinces, data.countries);
    expect(result.components).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    expect(result.issues.map(issue => issue.type)).toEqual(['isolated-province', 'disconnected-components']);
  });

  it('does not mistake an incoming unilateral edge for a separate island', () => {
    const data = fixture(); data.provinces[0].neighbors = [];
    expect(validateMapTopology(data.provinces, data.countries).issues.map(issue => issue.type)).toEqual(['asymmetric-neighbor']);
  });

  it('self and missing edges do not connect land', () => {
    const data = fixture(); data.provinces[0].neighbors = ['a', 'missing']; data.provinces[1].neighbors = [];
    expect(validateMapTopology(data.provinces, data.countries).components).toEqual([['a'], ['b']]);
  });

  it('detects duplicate countries, missing holdings and unlisted ownership', () => {
    const data = fixture(); data.countries[0].provinces = ['a', 'missing']; data.countries.push({ ...data.countries[0] });
    const types = validateMapTopology(data.provinces, data.countries).issues.map(issue => issue.type);
    expect(types).toEqual(expect.arrayContaining(['duplicate-country-id', 'missing-country-province', 'unlisted-owned-province']));
  });

  it.each(['missing', 'b', ''])('validates explicit capitals (%s)', capital => {
    const data = fixture(); data.countries[0].capital = capital;
    if (capital === 'b') data.provinces[1].owner = 'B';
    expect(validateMapTopology(data.provinces, data.countries).issues).toContainEqual(expect.objectContaining({ type: 'invalid-capital', provinceId: capital }));
  });

  it('supports capitalId and absent capitals without inferring the first holding', () => {
    const data = fixture(); delete data.countries[0].capital;
    expect(validateMapTopology(data.provinces, data.countries).valid).toBe(true);
    data.countries[0].capitalId = 'missing';
    expect(validateMapTopology(data.provinces, data.countries).issues[0].type).toBe('invalid-capital');
  });

  it('handles an empty map', () => {
    expect(validateMapTopology([], [])).toEqual({ valid: true, issues: [], components: [] });
  });

  it('audits the real map with only the four preserved legacy unilateral edges', () => {
    const result = validateMapTopology(provincesData, countries.map(country => ({ ...country, capital: mapCapitals[country.tag] })));
    expect(result.valid).toBe(false);
    expect(result.components).toHaveLength(1);
    expect(result.issues.map(({ type, provinceId, neighborId }) => ({ type, provinceId, neighborId }))).toEqual([
      { type: 'asymmetric-neighbor', provinceId: 'p12', neighborId: 'p10' },
      { type: 'asymmetric-neighbor', provinceId: 'p19', neighborId: 'p16' },
      { type: 'asymmetric-neighbor', provinceId: 'p20', neighborId: 'p19' },
      { type: 'asymmetric-neighbor', provinceId: 'p21', neighborId: 'p19' },
    ]);
  });

  it('keeps legacy exports and lookup compatible', () => {
    expect(legacyProvinces).toBe(provincesData); expect(legacyCountries).toBe(countries);
    expect(getCountryByTag('IMP')).toBe(countries[0]); expect(getCountryByTag('missing')).toBeUndefined();
  });

  it('assembles multiple regions and preserves cross-region edges', () => {
    const current = mapRegions[0];
    const split = [0, 1].map(index => ({ ...current, id: String(index), provinces: current.provinces.filter((_, i) => i % 2 === index), topology: current.topology.filter((_, i) => i % 2 === index), geometry: current.geometry.filter((_, i) => i % 2 === index), countries: index === 0 ? current.countries : [] }));
    const assembled = assembleMap(split);
    expect(assembled.provincesData).toHaveLength(provincesData.length);
    for (const province of assembled.provincesData) expect(province).toEqual(provincesData.find(item => item.id === province.id));
    expect(assembled.countries).toEqual(countries);
    expect(() => assembleMap([current, current])).toThrow('Duplicate map definition');
    expect(() => assembleMap([{ ...current, geometry: [] }])).toThrow('Missing topology or geometry');
  });

  it('pathfinding depends on explicit edges, independently of drawing coordinates', () => {
    const map = provincesData.map(province => ({ ...province, owner: 'IMP' }));
    const path = findPath('p1', 'p22', map, 'IMP', []);
    expect(path.length).toBeGreaterThan(0);
    expect(findPath('p1', 'p22', map.map(province => ({ ...province, center: { x: 0, y: 0 }, path: '' })), 'IMP', [])).toEqual(path);
    expect(findPath('p1', 'p22', map.map(province => ({ ...province, neighbors: [] })), 'IMP', [])).toEqual([]);
  });
});
