// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ProvinceMilitaryTab } from '../ProvincePanel/ProvinceMilitaryTab';
import { countries } from '../../data/countries';
import { provincesData } from '../../data/provinces';
import { RECRUITABLE_UNIT_IDS, UNIT_DEFINITIONS } from '../../data/units';
import { createInitialTechState } from '../../engine/technology';
import { normalizeMarket } from '../../engine/market';
import { createArmy, createRegiment } from '../../engine/military';
import { loadGame, saveGame, getSaveCompatibilityError } from '../../engine/saveSystem';
import { startContinuousBattle } from '../../engine/combat/continuousBattle';

afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
function fixture() {
  const country = structuredClone(countries[0]); country.resources.gold = 5000; country.resources.manpower = 20000;
  const province = structuredClone(provincesData.find(p => p.owner === country.tag)!);
  province.market = normalizeMarket(province.market);
  province.market.goods.iron.stock = 1000; province.market.goods.tools.stock = 1000;
  province.buildings = [{ type: 'military_arsenal', level: 2, daysRemaining: 0 }];
  const technology = createInitialTechState(country.tag); technology.completedTechnologies = ['improved_weapons'];
  return { country, province, technology };
}
function saveFixture(): Parameters<typeof saveGame>[0] {
  const { country, province, technology } = fixture();
  const army = createArmy(country.tag, 'Legacy', province.id);
  army.regiments = Object.values(UNIT_DEFINITIONS).map(def => ({ ...createRegiment(def.type), strength: 333, organization: 67, morale: 81, experience: 12 }));
  return {
    provincesRef: { current: [province] }, countriesRef: { current: [country] }, armiesRef: { current: [army] },
    warsRef: { current: [] }, diplomaticRelationsRef: { current: [] },
    recruitmentsRef: { current: [{ id: 'old', owner: country.tag, provinceId: province.id, unitType: 'cavalry', count: 2, daysRemaining: 15, paidCost: { gold: 150, manpower: 2000, iron: 12, tools: 6 } }] },
    buildingConstructionsRef: { current: [] }, playerTechStateRef: { current: technology }, botTechStatesRef: { current: new Map() }, activeBattlesRef: { current: [] }, dateRef: { current: { year: 1836, month: 1, day: 1 } },
  };
}
describe('Military Units V3 UI and save boundary', () => {
  it('renders only modern recruitment names and invokes the selected typed ID', () => {
    const { country, province, technology } = fixture(), onRecruit = vi.fn();
    render(<ProvinceMilitaryTab playerCountry={country} province={province} technology={technology} armiesHere={[]} onRecruit={onRecruit} />);
    for (const type of RECRUITABLE_UNIT_IDS) expect(screen.getByText(UNIT_DEFINITIONS[type].name)).toBeTruthy();
    expect(screen.queryByText(UNIT_DEFINITIONS.cavalry.name)).toBeNull();
    expect(screen.queryByText(UNIT_DEFINITIONS.archers.name)).toBeNull();
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(onRecruit).toHaveBeenCalledWith(province.id, 'armor');
  });
  it('shows Arsenal blocking reasons and prevents recruitment', () => {
    const { country, province, technology } = fixture(); province.buildings = [];
    render(<ProvinceMilitaryTab playerCountry={country} province={province} technology={technology} armiesHere={[]} onRecruit={vi.fn()} />);
    expect(screen.getAllByRole('button')[2].hasAttribute('disabled')).toBe(true);
    expect(screen.getAllByRole('button')[0].hasAttribute('disabled')).toBe(false);
  });
  it('round-trips modern and legacy partial regiments and paid legacy queues idempotently', () => {
    const refs = saveFixture(); expect(saveGame(refs, 'v3')).toBe(true);
    const first = loadGame('v3')!;
    expect(first.military.armies).toEqual(refs.armiesRef.current);
    expect(first.military.recruitments).toEqual(refs.recruitmentsRef.current);
    refs.armiesRef.current = first.military.armies; refs.recruitmentsRef.current = first.military.recruitments;
    expect(saveGame(refs, 'v3')).toBe(true);
    expect(loadGame('v3')!.military).toEqual(first.military);
    expect(first.world.countries[0].resources.gold).toBe(refs.countriesRef.current[0].resources.gold);
  });
  it('rejects unknown saved IDs with a clear error and protects the original slot', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const refs = saveFixture(); saveGame(refs, 'v3');
    const raw = JSON.parse(localStorage.getItem('imperium_save_v3')!);
    raw.military.armies[0].regiments[0].type = 'future_tank';
    const bad = JSON.stringify(raw); localStorage.setItem('imperium_save_v3', bad);
    expect(loadGame('v3')).toBeNull(); expect(getSaveCompatibilityError()).toContain('future_tank');
    expect(saveGame(refs, 'v3')).toBe(false);
    expect(localStorage.getItem('imperium_save_v3')).toBe(bad);
  });
  it('preserves active battle participant states, snapshots and compositions', () => {
    const refs = saveFixture(); const attacker = refs.armiesRef.current[0];
    const defender = { ...createArmy('ARG', 'Defender', refs.provincesRef.current[0].id), regiments: [createRegiment('armor')] };
    refs.armiesRef.current.push(defender);
    const battle = startContinuousBattle([attacker], [defender], refs.provincesRef.current[0], refs.dateRef.current, 'active');
    refs.activeBattlesRef.current = [battle]; saveGame(refs, 'active');
    expect(loadGame('active')!.military.activeBattles).toEqual([battle]);
  });
});
