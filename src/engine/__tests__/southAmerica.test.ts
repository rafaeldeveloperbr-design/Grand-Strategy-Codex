import { describe, expect, it } from 'vitest';
import { countries, mapMetadata, mapRegions, provincesData, validateMapTopology } from '../../data/map';
import { createInitialArmies } from '../../data/map/initialState';
import { getCountryCapitalId } from '../aiEngine/aiMovement';
import { findPath } from '../military/movementEngine';
import { createInitialTechState } from '../technology';
import { loadGame, saveGame, type SaveGameV2 } from '../saveSystem';
import { isSaveCompatibleWithActiveMap } from '../../data/map/saveCompatibility';
import { calculateDemand, calculateProduction } from '../market';
import { transferProvince } from '../territoryTransfer';

describe('South America V1 scenario', () => {
  it('activates only South America, with descriptive IDs and the 13 requested countries', () => {
    expect(mapRegions.map(region => region.id)).toEqual(['southAmerica']);
    expect(countries.map(country => country.tag).sort()).toEqual(['ARG', 'BOL', 'BRA', 'CHL', 'COL', 'ECU', 'GUF', 'GUY', 'PER', 'PRY', 'SUR', 'URY', 'VEN']);
    expect(provincesData).toHaveLength(56);
    expect(provincesData.every(province => /^sa_[a-z]{3}_[a-z_]+$/.test(province.id))).toBe(true);
    expect(validateMapTopology(provincesData, countries)).toMatchObject({ valid: true, issues: [], components: [expect.any(Array)] });
  });

  it('has explicit, important capitals and an interior Brazilian capital', () => {
    for (const country of countries) {
      const capital = provincesData.find(province => province.id === country.capitalId)!;
      expect(capital.owner).toBe(country.tag);
      expect(capital.development).toBeGreaterThanOrEqual(5);
      expect(getCountryCapitalId({ ...country, provinces: [...country.provinces].reverse() })).toBe(country.capitalId);
    }
    const brasilia = provincesData.find(province => province.id === 'sa_bra_brasilia')!;
    expect(brasilia.neighbors.every(id => provincesData.find(province => province.id === id)!.owner === 'BRA')).toBe(true);
    const noCapital = { ...countries[0], capitalId: undefined, capital: undefined };
    expect(getCountryCapitalId(noCapital)).toBeNull();
    expect(getCountryCapitalId({ ...noCapital, capital: 'legacy_explicit' })).toBe('legacy_explicit');
  });

  it.each([
    ['sa_bra_brasilia', 'sa_arg_buenos_aires'],
    ['sa_chl_santiago', 'sa_col_bogota'],
    ['sa_ven_caracas', 'sa_ury_montevideu'],
    ['sa_per_lima', 'sa_bra_brasilia'],
  ])('finds a valid land route from %s to %s with diplomatic access', (start, end) => {
    const owner = provincesData.find(province => province.id === start)!.owner;
    // Route existence does not grant access in normal gameplay.
    const relations = countries.filter(country => country.tag !== owner).map(country => ({
      countryA: owner, countryB: country.tag, status: 'war' as const, opinion: -100, pactDaysRemaining: 0,
    }));
    const route = findPath(start, end, provincesData, owner, relations);
    expect(route.length).toBeGreaterThan(0);
    expect(route[route.length - 1]).toBe(end);
    expect(new Set(route).size).toBe(route.length);
    let previous = start;
    for (const id of route) {
      expect(provincesData.find(province => province.id === previous)!.neighbors).toContain(id);
      expect(provincesData.find(province => province.id === id)!.neighbors).toContain(previous);
      previous = id;
    }
    expect(findPath(start, end, provincesData, owner, [])).toEqual([]);
  });

  it('initializes valid capital armies and viable provincial markets without extreme values', () => {
    const armies = createInitialArmies(countries);
    expect(armies).toHaveLength(13);
    for (const army of armies) {
      const capital = provincesData.find(province => province.id === army.location)!;
      expect(capital.owner).toBe(army.owner);
      expect(army.regiments.every(regiment => regiment.strength <= 1000)).toBe(true);
    }
    for (const province of provincesData) {
      expect(province.population.total).toBeGreaterThanOrEqual(10000);
      expect(province.population.total).toBeLessThanOrEqual(40000);
      expect(province.market!.goods.food.stock).toBeGreaterThan(0);
      expect(calculateProduction(province).food, province.id).toBeGreaterThanOrEqual(calculateDemand(province).food);
      expect(province.unrest).toBe(0);
    }
    const population = (tag: string) => provincesData.filter(province => province.owner === tag).reduce((sum, province) => sum + province.population.total, 0);
    expect(population('BRA')).toBeGreaterThan(population('ARG'));
    expect(population('ARG')).toBeGreaterThan(population('URY'));
  });

  it('keeps territory transfer compatible with new IDs and explicit capitals', () => {
    const result = transferProvince({ provinces: provincesData, countries, recruitments: [], constructions: [] }, 'sa_pry_chaco', 'BRA');
    expect(result.countries.find(country => country.tag === 'BRA')!.capitalId).toBe('sa_bra_brasilia');
    expect(result.countries.find(country => country.tag === 'PRY')!.provinces).not.toContain('sa_pry_chaco');
    expect(result.countries.find(country => country.tag === 'BRA')!.provinces).toContain('sa_pry_chaco');
  });

  it('keeps all SVG paths finite, nondegenerate and inside map bounds with interior centers', () => {
    for (const province of provincesData) {
      expect(province.path).toMatch(/^M[\d., LZM-]+$/);
      const rings = province.path.split('M').filter(Boolean).map(ring => ring.replace('Z', '').trim().split(/\s*L\s*/).map(point => point.split(',').map(Number)));
      for (const ring of rings) {
        expect(ring.length).toBeGreaterThanOrEqual(3);
        for (const [x, y] of ring) {
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(mapMetadata.bounds.x);
          expect(y).toBeGreaterThanOrEqual(mapMetadata.bounds.y);
          expect(x).toBeLessThanOrEqual(mapMetadata.bounds.x + mapMetadata.bounds.w);
          expect(y).toBeLessThanOrEqual(mapMetadata.bounds.y + mapMetadata.bounds.h);
        }
      }
      const containsCenter = rings.some(ring => {
        let inside = false;
        const { x, y } = province.center;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const [xi, yi] = ring[i], [xj, yj] = ring[j];
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      });
      expect(containsCenter, province.id).toBe(true);
    }
  });

  it('rejects worlds from other maps without rejecting old South America saves without mapId', () => {
    const save = { world: { provinces: provincesData, countries } } as SaveGameV2;
    expect(isSaveCompatibleWithActiveMap(save)).toBe(true);
    expect(isSaveCompatibleWithActiveMap({ ...save, mapId: 'fictitious' })).toBe(false);
    expect(isSaveCompatibleWithActiveMap({ ...save, world: { ...save.world, provinces: [{ ...provincesData[0], id: 'p1' }] } })).toBe(false);
  });

  it('round-trips the new map and capitals, and confines legacy capital inference to loading', () => {
    const storage = new Map<string, string>();
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    } });
    try {
      const refs = {
        provincesRef: { current: provincesData }, countriesRef: { current: countries },
        armiesRef: { current: createInitialArmies(countries) }, dateRef: { current: { year: 1444, month: 11, day: 11 } },
        warsRef: { current: [] }, activeBattlesRef: { current: [] }, diplomaticRelationsRef: { current: [] },
        recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] },
        playerTechStateRef: { current: createInitialTechState('BRA') }, botTechStatesRef: { current: new Map() },
      };
      saveGame(refs, 'south-america');
      const loaded = loadGame('south-america')!;
      expect(loaded.mapId).toBe(mapMetadata.id);
      expect(isSaveCompatibleWithActiveMap(loaded)).toBe(true);
      expect(loaded.world.countries.map(country => country.capitalId)).toEqual(countries.map(country => country.capitalId));
      expect(validateMapTopology(loaded.world.provinces, loaded.world.countries).valid).toBe(true);
      const raw = JSON.parse(storage.get('imperium_save_south-america')!);
      delete raw.world.countries[0].capitalId;
      raw.world.countries[0].provinces.reverse();
      storage.set('imperium_save_south-america', JSON.stringify(raw));
      expect(loadGame('south-america')!.world.countries[0].capitalId).toBe('sa_bra_brasilia');
    } finally {
      if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
      else Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});
