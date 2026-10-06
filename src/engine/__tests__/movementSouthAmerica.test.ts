import { describe, expect, it } from 'vitest';
import { provincesData, validateMapTopology } from '../../data/map';
import { moveArmy, processArmyMovement } from '../military/movementEngine';
import { checkAllProvinceCombats, findRetreatProvince, processBattleDay, retreatArmyManually, startContinuousBattle } from '../combat';
import { calculateArmySize } from '../military';
import { army, campaign, date, day, province, relation, war } from './helpers/southAmericaAudit';

describe('South America movement integration', () => {
  it('crosses one edge per tick, occupies intermediate provinces, and completes a long order', () => {
    const moving = moveArmy(army('BRA', 'sa_bra_brasilia'), 'sa_arg_buenos_aires', provincesData, [relation('BRA', 'ARG')])!;
    const ordered = [...moving.path];
    let state = campaign([moving], [relation('BRA', 'ARG')], [war('BRA', 'ARG')]);
    const visited: string[] = [];
    for (let tick = 0; tick < 100 && state.armies[0].destination; tick++) {
      const previous = state.armies[0].location!;
      state = day(state);
      const current = state.armies[0].location!;
      if (previous !== current) {
        expect(state.provinces.find(p => p.id === previous)!.neighbors).toContain(current);
        visited.push(current);
        expect(state.provinces.find(p => p.id === current)!.owner).toBe('BRA');
      }
    }
    expect(visited).toEqual(ordered);
    expect(state.armies[0]).toMatchObject({ location: 'sa_arg_buenos_aires', destination: null, targetDestination: null, path: [], position: null });
    // Capital validation is initial-map-only; occupation keeps original capitals.
    expect(validateMapTopology(state.provinces, state.countries).issues.filter(issue => issue.type !== 'invalid-capital')).toEqual([]);
  });

  it('simultaneous incoming defenders prevent empty occupation before combat detection', () => {
    const target = 'sa_arg_buenos_aires';
    const invader = { ...moveArmy(army('BRA', 'sa_arg_chaco', 4), target, provincesData, [relation('BRA', 'ARG')])!, movementSpeed: 10 };
    const defender = { ...moveArmy(army('ARG', 'sa_arg_cordoba', 4), target, provincesData, [])!, movementSpeed: 10 };
    expect(invader.destination).toBe(target); expect(defender.destination).toBe(target);
    const state = day(campaign([invader, defender], [relation('BRA', 'ARG')], [war('BRA', 'ARG')]));
    expect(state.battlesStarted).toBe(1);
    expect(state.provinces.find(p => p.id === target)!.owner).toBe('ARG');
  });

  it.each(['edge', 'missing-province', 'access', 'ownership', 'invalid-path'] as const)('cancels stale movement after %s changes without changing logical location', change => {
    const relations = [relation('BRA', 'COL')];
    const moving = moveArmy(army('BRA', 'sa_bra_amazonas'), 'sa_col_amazonia', provincesData, relations)!;
    let map = structuredClone(provincesData), actualRelations = relations;
    if (change === 'edge') map.find(p => p.id === moving.location)!.neighbors = [];
    if (change === 'missing-province') map = map.filter(p => p.id !== moving.destination);
    if (change === 'access') actualRelations = [];
    if (change === 'ownership') map.find(p => p.id === moving.destination)!.owner = 'VEN';
    if (change === 'invalid-path') moving.path.push('sa_arg_santa_cruz');
    const result = processArmyMovement([moving], map, actualRelations);
    expect(result.arrivedArmies).toEqual([]);
    expect(result.updatedArmies[0]).toMatchObject({ location: moving.location, destination: null, targetDestination: null, path: [], position: null, movementProgress: 0 });
  });

  it('rejects combat orders and same-province orders, and freezes an army in combat', () => {
    const idle = army('BRA', 'sa_bra_brasilia'), busy = { ...idle, inCombat: true };
    expect(moveArmy(busy, 'sa_bra_sao_paulo', provincesData, [])).toBeNull();
    expect(moveArmy(idle, idle.location!, provincesData, [])).toBeNull();
    const result = processArmyMovement([{ ...busy, destination: 'sa_bra_sao_paulo' }], provincesData, []);
    expect(result.updatedArmies[0].location).toBe(idle.location);
    expect(result.arrivedArmies).toEqual([]);
  });

  it('logical progress ignores visual position and remains partial under low speed', () => {
    const moving = { ...moveArmy(army('BRA', 'sa_bra_brasilia'), 'sa_bra_sao_paulo', provincesData, [])!, movementSpeed: .1 };
    const result = processArmyMovement([{ ...moving, position: { x: Infinity, y: NaN } }], provincesData, []);
    expect(result.updatedArmies[0].location).toBe(moving.location);
    expect(result.updatedArmies[0].movementProgress).toBeGreaterThan(0);
    expect(result.updatedArmies[0].movementProgress).toBeLessThan(1);
    expect(Number.isFinite(result.updatedArmies[0].position!.x)).toBe(true);
  });

  it('does not stop at friendly allied armies or conquer their territory', () => {
    const relations = [relation('BRA', 'COL', 'alliance', 80)];
    const moving = moveArmy(army('BRA', 'sa_bra_amazonas'), 'sa_col_bogota', provincesData, relations)!;
    let state = campaign([moving, army('COL', 'sa_col_amazonia')], relations, []);
    for (let tick = 0; tick < 30 && state.armies.find(a => a.owner === 'BRA')!.destination; tick++) state = day(state);
    expect(state.armies.find(a => a.owner === 'BRA')!.location).toBe('sa_col_bogota');
    expect(state.provinces.find(p => p.id === 'sa_col_amazonia')!.owner).toBe('COL');
    expect(state.currentActiveBattles).toEqual([]);
  });

  it('starts combat at an intermediate defender before proceeding or conquering', () => {
    const moving = moveArmy(army('BRA', 'sa_bra_parana'), 'sa_arg_buenos_aires', provincesData, [relation('BRA', 'ARG')])!;
    const defended = moving.path.find(id => province(id).owner === 'ARG')!;
    let state = campaign([moving, army('ARG', defended, 3)], [relation('BRA', 'ARG')], [war('BRA', 'ARG')]);
    for (let tick = 0; tick < 20 && state.currentActiveBattles.length === 0; tick++) state = day(state);
    expect(state.currentActiveBattles.length).toBeGreaterThan(0);
    const invader = state.armies.find(a => a.owner === 'BRA')!;
    expect(invader.location).toBe(defended); expect(invader.inCombat).toBe(true);
    expect(invader.destination).toBeNull();
    expect(state.provinces.find(p => p.id === defended)!.owner).toBe('ARG');
  });
});

describe('South America retreat audit (existing adjacent-province rule)', () => {
  it('selects a different own neighbor if the first is occupied by a hostile army', () => {
    const battle = province('sa_bra_brasilia');
    const blocked = battle.neighbors[0], enemies = [army('ARG', blocked)];
    const retreat = findRetreatProvince('BRA', battle, provincesData, enemies)!;
    expect(retreat.id).not.toBe(blocked); expect(battle.neighbors).toContain(retreat.id);
    expect(retreat.owner).toBe('BRA');
  });

  it('cannot retreat through neutral, enemy or enemy-occupied territory to a distant homeland', () => {
    expect(findRetreatProvince('COL', province('sa_bra_brasilia'), provincesData)).toBeNull();
    const map = provincesData.map(p => p.id === 'sa_bra_sao_paulo' ? { ...p, owner: 'ARG' } : p);
    expect(findRetreatProvince('BRA', province('sa_bra_brasilia'), map)!.owner).toBe('BRA');
  });

  it('manual withdrawal clears stale visuals/orders and ends a battle when one side leaves', () => {
    const location = 'sa_bra_parana', p = province(location);
    const attacker = { ...army('ARG', location, 2), inCombat: true }, defender = { ...army('BRA', location, 2), inCombat: true,
      destination: 'sa_bra_brasilia', targetDestination: 'sa_bra_brasilia', path: ['sa_bra_brasilia'], position: { x: 999, y: 999 } };
    const battle = startContinuousBattle([attacker], [defender], p, date, 'manual-audit');
    const result = retreatArmyManually(defender.id, battle.id, [attacker, defender], [battle], provincesData);
    expect(result.retreatSuccess).toBe(true); expect(result.battleEnded).toBe(true);
    const withdrawn = result.armies.find(a => a.id === defender.id)!;
    expect(p.neighbors).toContain(withdrawn.location);
    expect(withdrawn).toMatchObject({ destination: null, targetDestination: null, path: [], position: null, inCombat: false });
    expect(result.armies.every(a => !a.inCombat)).toBe(true);
  });

  it.each([true, false])('handles every defeated army, with an adjacent exit available: %s', exit => {
    const p = province('sa_bra_parana'), attackers = [army('ARG', p.id, 6)];
    const defenders = [army('BRA', p.id, 1, 'defender-1'), army('BRA', p.id, 1, 'defender-2')]
      .map(a => ({ ...a, regiments: a.regiments.map(r => ({ ...r, morale: 1, organization: 1 })), position: { x: 999, y: 999 } }));
    const map = exit ? provincesData : provincesData.map(item => p.neighbors.includes(item.id) ? { ...item, owner: 'ARG' } : item);
    const combat = checkAllProvinceCombats([...attackers, ...defenders], map, [war('ARG', 'BRA')], date, []);
    const result = processBattleDay(combat.newBattles[0], combat.armies, p, map);
    expect(result.finished).toBe(true);
    for (const loser of result.armies.filter(a => a.owner === 'BRA')) {
      if (exit) { expect(p.neighbors).toContain(loser.location); expect(calculateArmySize(loser)).toBeGreaterThan(0); }
      else expect(calculateArmySize(loser)).toBe(0);
      expect(loser.position).toBeNull(); expect(loser.destination).toBeNull();
    }
  });
});
