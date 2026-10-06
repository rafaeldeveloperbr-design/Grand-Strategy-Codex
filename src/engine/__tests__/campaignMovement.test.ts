import { describe, expect, it, vi, afterEach } from 'vitest';
import { countries, provincesData, validateMapTopology } from '../../data/map';
import { moveArmy } from '../military/movementEngine';
import { processAI } from '../aiEngine/aiMovement';
import { checkAllProvinceCombats } from '../combat';
import { calculateArmySize } from '../military';
import { isBorderProvince } from '../aiEngine/aiHelpers';
import { access, army, campaign, date, day, province, relation, war } from './helpers/southAmericaAudit';

afterEach(() => vi.restoreAllMocks());

describe('South America controlled campaigns', () => {
  it.each([
    ['BRA', 'sa_bra_brasilia', 'ARG', 'sa_arg_buenos_aires'],
    ['CHL', 'sa_chl_santiago', 'BOL', 'sa_bol_la_paz'],
    ['VEN', 'sa_ven_caracas', 'URY', 'sa_ury_montevideu'],
  ])('%s advances from %s and wins a defended campaign against %s in %s', (owner, start, enemy, target) => {
    const relations = access(owner).map(r => r.countryB === enemy ? r : { ...r, status: 'alliance' as const, opinion: 80 });
    const invader = army(owner, start, 5), defender = army(enemy, target, 1);
    defender.regiments = defender.regiments.map(r => ({ ...r, strength: 300, morale: 1, organization: 1 }));
    let state = campaign([moveArmy(invader, target, provincesData, relations)!, defender], relations, [war(owner, enemy)]);
    let changes = 0, ticks = 0;
    for (; ticks < 200; ticks++) {
      let force = state.armies.find(a => a.id === invader.id)!;
      expect(force).toBeDefined(); expect(calculateArmySize(force)).toBeGreaterThan(0);
      if (state.provinces.find(p => p.id === target)!.owner === owner) break;
      if (!force.destination && !force.inCombat && force.location !== target) {
        const order = moveArmy(force, target, state.provinces, relations);
        expect(order).not.toBeNull(); state.armies = state.armies.map(a => a.id === force.id ? order! : a);
        force = order!;
      }
      const previous = force.location!, owners = new Map(state.provinces.map(p => [p.id, p.owner]));
      // Arrival and battle hooks run in their real order, including a same-day short battle.
      state = day(state);
      const current = state.armies.find(a => a.id === invader.id)!.location!;
      if (current !== previous) expect(state.provinces.find(p => p.id === previous)!.neighbors).toContain(current);
      for (const p of state.provinces) if (owners.get(p.id) !== p.owner) {
        changes++; expect(owners.get(p.id)).toBe(enemy); expect(p.owner).toBe(owner);
      }
      expect(validateMapTopology(state.provinces, state.countries).issues.filter(issue => issue.type !== 'invalid-capital')).toEqual([]);
    }
    expect(ticks).toBeLessThan(200); expect(changes).toBeGreaterThan(0); expect(state.battlesStarted).toBeGreaterThan(0);
    expect(state.provinces.find(p => p.id === target)!.owner).toBe(owner);
    expect(state.currentActiveBattles).toEqual([]);
    expect(state.armies.find(a => a.id === invader.id)).toMatchObject({ destination: null, path: [], inCombat: false });
  });

  it('finishing an old battle after peace does not authorize a conquest', () => {
    const target = 'sa_arg_chaco', attacker = army('BRA', target, 5), defender = army('ARG', target, 1);
    defender.regiments = defender.regiments.map(r => ({ ...r, strength: 100, morale: 1, organization: 1 }));
    const combat = checkAllProvinceCombats([attacker, defender], provincesData, [war('BRA', 'ARG')], date, []);
    let state = campaign(combat.armies, [], []);
    state.currentActiveBattles = combat.newBattles;
    state = day(state);
    expect(state.currentActiveBattles).toEqual([]);
    expect(state.provinces.find(p => p.id === target)!.owner).toBe('ARG');
    const details = state.battleHistory[0].participantDetails!;
    for (const detail of details) expect(detail.final).toBe(calculateArmySize(state.armies.find(a => a.id === detail.id)!));
  });

  it('keeps multiple losing armies at their own resolved retreat and actual troop totals', () => {
    const target = 'sa_bra_parana', attacker = army('ARG', target, 6);
    const defenders = [army('BRA', target, 1, 'loser-1'), army('BRA', target, 1, 'loser-2')]
      .map(a => ({ ...a, regiments: a.regiments.map(r => ({ ...r, morale: 1, organization: 1 })) }));
    const combat = checkAllProvinceCombats([attacker, ...defenders], provincesData, [war('ARG', 'BRA')], date, []);
    let state = campaign(combat.armies, [relation('ARG', 'BRA')], [war('ARG', 'BRA')]);
    state.currentActiveBattles = combat.newBattles;
    state = day(state);
    for (const force of state.armies.filter(a => a.owner === 'BRA')) {
      expect(province(target).neighbors).toContain(force.location);
      expect(calculateArmySize(force)).toBeLessThanOrEqual(1000);
    }
    expect(state.provinces.find(p => p.id === target)!.owner).toBe('ARG');
  });
});

describe('South America movement AI audit', () => {
  it('issues a reachable distant offensive order while still deep inside its own country', () => {
    const force = army('BRA', 'sa_bra_brasilia', 4), relations = [relation('BRA', 'ARG')];
    const planned = processAI('BRA', [force], provincesData, relations, [war('BRA', 'ARG')], countries)[0];
    expect(planned.path.length).toBeGreaterThan(1); expect(planned.destination).toBe(planned.path[0]);
    expect(province(planned.targetDestination!).owner).toBe('ARG');
    expect(planned.path.every(id => ['BRA', 'ARG'].includes(province(id).owner))).toBe(true);
  });

  it('peace AI reaches and holds a frontier even with a random source that previously induced loops', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let state = campaign([army('BRA', 'sa_bra_brasilia')], [], []);
    const locations: string[] = [];
    for (let tick = 0; tick < 100; tick++) {
      state.armies = processAI('BRA', state.armies, state.provinces, [], [], state.countries);
      state = day(state); locations.push(state.armies[0].location!);
    }
    expect(isBorderProvince(state.armies[0].location!, state.provinces, 'BRA')).toBe(true);
    expect(new Set(locations.slice(-30)).size).toBe(1);
    expect(state.armies[0].destination).toBeNull();
  });

  it('an unreachable war target causes no repeated impossible orders or teleport', () => {
    const force = army('COL', 'sa_col_bogota'), relations = [relation('COL', 'ARG')];
    for (let tick = 0; tick < 60; tick++) {
      const planned = processAI('COL', [force], provincesData, relations, [war('COL', 'ARG')], countries)[0];
      expect(planned.destination).toBeNull(); expect(planned.path).toEqual([]); expect(planned.location).toBe(force.location);
    }
  });

  it('defends the explicit capital regardless of holdings order', () => {
    const own = army('BRA', 'sa_bra_para', 4), enemy = army('ARG', 'sa_bra_brasilia', 2);
    const shuffled = countries.map(c => ({ ...c, provinces: [...c.provinces].reverse() }));
    const planned = processAI('BRA', [own, enemy], provincesData, [relation('BRA', 'ARG')], [war('BRA', 'ARG')], shuffled)[0];
    expect(planned.targetDestination).toBe('sa_bra_brasilia'); expect(planned.path.length).toBeGreaterThan(0);
  });

  it('orders reachable friendly reinforcement without reciprocal rendezvous swaps', () => {
    const first = army('BRA', 'sa_bra_parana', 3, 'first');
    const second = army('BRA', 'sa_bra_rio_grande_do_sul', 3, 'second');
    const enemy = army('ARG', 'sa_arg_chaco', 3);
    const planned = processAI('BRA', [first, second, enemy], provincesData,
      [relation('BRA', 'ARG')], [war('BRA', 'ARG')], countries);
    expect(planned[1].targetDestination).toBe(first.location);
    expect(planned[0].destination).toBeNull();
    let previous = second.location!;
    for (const id of planned[1].path) { expect(province(previous).neighbors).toContain(id); previous = id; }
  });

  it('allied troops near the capital do not create an enemy capital-defense order', () => {
    const own = army('BRA', 'sa_bra_para', 3), ally = army('COL', 'sa_bra_brasilia', 3);
    const planned = processAI('BRA', [own, ally], provincesData, [relation('BRA', 'COL', 'alliance', 80)], [], countries)[0];
    expect(planned.targetDestination).not.toBe('sa_bra_brasilia');
  });
});
