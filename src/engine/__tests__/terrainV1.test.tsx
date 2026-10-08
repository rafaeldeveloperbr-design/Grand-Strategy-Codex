// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { countries, provincesData } from '../../data/map';
import type { Army, Province } from '../../types';
import { TERRAIN_DEFINITIONS, getTerrainDefinition, isTerrainType, type TerrainType } from '../terrain';
import { calculateLocalSupplyCapacity, getArmySupply } from '../military/supplyEngine';
import { processArmyMovement, findPath } from '../military/movementEngine';
import { recoverArmy } from '../military/recoveryEngine';
import { calculateDefenderTotalPower } from '../combat/combatCalculations';
import { startContinuousBattle, processBattleDay } from '../combat';
import { army, date } from './helpers/southAmericaAudit';
import { GameMap } from '../../components/GameMap/GameMap';
import { GameMapTooltip } from '../../components/GameMap/GameMapTooltip';
import { ProvinceInfoTab } from '../../components/ProvincePanel/ProvinceInfoTab';
import { buildArmyPresentation, buildWarPresentation } from '../../components/GameMap/mapPresentation';
import { loadGame, saveGame } from '../saveSystem';
import { createInitialTechState } from '../technology';

afterEach(cleanup);
const base = provincesData.find(p => p.id === 'sa_bra_brasilia')!;
const terrainProvince = (terrain: TerrainType): Province => ({ ...base, terrain });
const types = Object.keys(TERRAIN_DEFINITIONS) as TerrainType[];

describe('Terrain V1 data and military integration', () => {
  it('classifies every province, across six regions with six valid distinct colors and 128 countries', () => {
    expect(provincesData).toHaveLength(494); expect(countries).toHaveLength(201);
    expect(provincesData.every(p => isTerrainType(p.terrain))).toBe(true);
    expect(new Set(types.map(t => TERRAIN_DEFINITIONS[t].color)).size).toBe(6);
    expect(isTerrainType('urban')).toBe(false);
  });
  it.each(types)('applies destination movement cost for %s with unchanged BFS', terrain => {
    const origin = { ...base, terrain: 'plains' as const, neighbors: ['target'] };
    const target = { ...base, id: 'target', terrain, neighbors: [origin.id] };
    const moving = { ...army('BRA', base.id, 1), destination: target.id, path: [target.id], movementSpeed: .1 };
    const result = processArmyMovement([moving], [origin, target], []).updatedArmies[0];
    expect(result.movementProgress).toBeCloseTo(.1 / TERRAIN_DEFINITIONS[terrain].movementCost);
    expect(findPath(origin.id, target.id, [origin, target], 'BRA', [])).toEqual(['target']);
    let force: Army = moving; let days = 0;
    while (force.destination && days < 30) { const tick = processArmyMovement([force], [origin, target], []); force = tick.arrivedArmies[0] ?? tick.updatedArmies[0]; days++; }
    expect(days).toBeGreaterThanOrEqual(Math.ceil(TERRAIN_DEFINITIONS[terrain].movementCost / .1));
    expect(force.location).toBe('target');
  });
  it('orders costs and preserves the legacy plains baseline', () => {
    const costs = types.map(t => TERRAIN_DEFINITIONS[t].movementCost);
    expect(costs).toEqual([1, 1.15, 1.35, 1.2, 1.6, 1.25]);
    expect(getTerrainDefinition({})).toEqual(TERRAIN_DEFINITIONS.plains);
  });
  it.each(types)('scales supply and defender power once for %s, composing forts', terrain => {
    const p = terrainProvince(terrain), plains = terrainProvince('plains');
    expect(calculateLocalSupplyCapacity(p)).toBeCloseTo(calculateLocalSupplyCapacity(plains) * TERRAIN_DEFINITIONS[terrain].supplyModifier);
    const force = army('BRA', p.id, 50);
    const supply = getArmySupply(force, p);
    expect(Number.isFinite(supply.ratio)).toBe(true); expect(supply.ratio).toBeGreaterThanOrEqual(0); expect(supply.ratio).toBeLessThanOrEqual(1);
    for (const defense of [0, 4]) {
      const fortified = { ...p, defense, buildings: [{ type: 'fortress' as const, level: 2, daysRemaining: 0 }] };
      expect(calculateDefenderTotalPower(force, fortified).totalPower).toBeCloseTo(calculateDefenderTotalPower(force, { ...fortified, terrain: 'plains' }).totalPower * TERRAIN_DEFINITIONS[terrain].defenseModifier);
    }
    const country = structuredClone(countries.find(c => c.tag === 'BRA')!); country.resources.manpower = 0;
    force.regiments = force.regiments.map(r => ({ ...r, morale: 30, organization: 30 }));
    const before = JSON.stringify(force);
    const recovered = recoverArmy(force, country, p);
    expect(supply.status).toBe('critical');
    expect(recovered.army.regiments[0].morale).toBeGreaterThanOrEqual(30);
    expect(recovered.army.regiments[0].organization).toBeGreaterThanOrEqual(30);
    expect(Object.values(recovered.province.market!.goods).every(g => g.stock >= 0 && Number.isFinite(g.stock))).toBe(true);
    expect(JSON.stringify(force)).toBe(before);
  });
  it.each(types)('continuous combat composes terrain and fort once for %s', terrain => {
    // Abundant development isolates defense from supply penalties.
    const p = { ...terrainProvince(terrain), development: 100, defense: 3, buildings: [{ type: 'fortress' as const, level: 2, daysRemaining: 0 }] };
    const forces = [army('ARG', p.id, 3, 'att'), army('BRA', p.id, 3, 'def')];
    const battle = startContinuousBattle([forces[0]], [forces[1]], p, date, 'terrain-battle');
    const baseline = processBattleDay(battle, forces, { ...p, terrain: 'plains' }, [p]);
    const actual = processBattleDay(battle, forces, p, [p]);
    const baselineLoss = 3000 - baseline.battle.defenderCurrentTroops;
    const actualLoss = 3000 - actual.battle.defenderCurrentTroops;
    expect(Math.abs(actualLoss - baselineLoss / TERRAIN_DEFINITIONS[terrain].defenseModifier)).toBeLessThanOrEqual(1);
    expect(actual.battle.attackerCurrentTroops).toBeLessThanOrEqual(baseline.battle.attackerCurrentTroops);
  });
  it('handles invalid supply capacity and empty armies finitely', () => {
    expect(calculateLocalSupplyCapacity({ ...base, development: NaN })).toBe(0);
    const force = { ...army('BRA', base.id), regiments: [] };
    expect(getArmySupply(force, base).ratio).toBe(1);
  });
});

describe('Terrain V1 UI and saves', () => {
  it('renders every terrain color, six legend entries and preserves province selection', () => {
    const onClick = vi.fn();
    const view = render(<GameMap provinces={provincesData} countries={countries} armies={[]} recruitments={[]} buildingConstructions={[]} activeBattles={[]} selectedProvince={null} hoveredProvince={null} selectedArmy={null} onProvinceHover={vi.fn()} onProvinceClick={onClick} onArmyClick={vi.fn()} onProvinceRightClick={vi.fn()} />);
    fireEvent.click(view.getByRole('button', { name: 'Modo Terreno' }));
    const shapes = new Map([...view.container.querySelectorAll('[data-province-id]')].map(node => [node.getAttribute('data-province-id'), node]));
    expect(shapes.size).toBe(provincesData.length);
    for (const p of provincesData) expect(shapes.get(p.id)!.getAttribute('fill')).toBe(getTerrainDefinition(p).color);
    for (const terrain of Object.values(TERRAIN_DEFINITIONS)) expect(view.getByLabelText('Legenda Terreno').textContent).toContain(terrain.label);
    fireEvent.click(view.container.querySelector(`[data-province-id="${base.id}"]`)!);
    expect(onClick).toHaveBeenCalledWith(base.id);
  });
  it.each(types)('shows correct tooltip and panel for %s', terrain => {
    const p = terrainProvince(terrain);
    const view = render(<GameMapTooltip tooltip={{ x: 0, y: 0, province: p }} countries={new Map(countries.map(c => [c.tag, c]))} presentation={buildArmyPresentation([], [p])} war={buildWarPresentation([p], countries, [], [], [])} />);
    expect(view.getByRole('tooltip').textContent).toContain(`Terreno: ${TERRAIN_DEFINITIONS[terrain].label}`);
    view.unmount();
    const panel = render(<ProvinceInfoTab province={p} armiesHere={[]} neighborProvinces={[]} onProvinceClick={vi.fn()} />);
    expect(panel.container.textContent).toContain(`Terreno:${TERRAIN_DEFINITIONS[terrain].label}`);
    expect(panel.container.textContent).toContain('Supply:');
    expect(panel.getAllByText('Terreno:')).toHaveLength(1);
  });
  it('omits canonical terrain from saves and restores missing/unknown terrain by ID', () => {
    localStorage.clear();
    const refs = { dateRef: { current: date }, provincesRef: { current: provincesData }, countriesRef: { current: countries }, armiesRef: { current: [] }, warsRef: { current: [] }, diplomaticRelationsRef: { current: [] }, recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] }, playerTechStateRef: { current: createInitialTechState('BRA') }, botTechStatesRef: { current: new Map() }, activeBattlesRef: { current: [] } };
    saveGame(refs, 'terrain-save', 'terrain-save');
    const key = 'imperium_save_terrain-save';
    const raw = JSON.parse(localStorage.getItem(key)!);
    expect(raw.world.provinces.every((p: Province) => p.terrain === undefined)).toBe(true);
    raw.world.provinces[0].terrain = 'unknown'; localStorage.setItem(key, JSON.stringify(raw));
    expect(loadGame('terrain-save')!.world.provinces.map(p => p.terrain)).toEqual(provincesData.map(p => p.terrain));
  });
});
