import { describe, expect, it } from 'vitest';
import type { Army, Province, Country } from '../../types';
import { provincesData, countries } from '../../data/map';
import { appendWaypoint, issueMoveCommand, clearMovementPlan, advanceMovementPlans, createArmy, createRegiment } from '../military';
import { orderArmyGroup } from '../../hooks/app/armyGroupCommands';
import { processMovementTick } from '../../hooks/gameLoop/movementTick';
import { campaign, day, relation, war } from './helpers/southAmericaAudit';
import { validateMilitarySave } from '../military/saveCompatibility';
import { processBattleDay, startContinuousBattle, retreatArmyManually } from '../combat';

export const commandMap = (): Province[] => ['a', 'b', 'c', 'd', 'r'].map((id, i) => ({ ...structuredClone(provincesData[0]), id, name: id.toUpperCase(), owner: 'BRA', terrain: 'plains', development: 100, buildings: [], center: { x: i * 50, y: 100 }, neighbors: id === 'a' ? ['b'] : id === 'b' ? ['a', 'c', 'r'] : id === 'c' ? ['b', 'd'] : id === 'd' ? ['c'] : ['b'] }));
export const commandArmy = (id = 'one', location = 'a', owner = 'BRA'): Army => ({ ...createArmy(owner, id, location), id, regiments: [createRegiment('infantry')] });
function nation(places: Province[], tag = 'BRA'): Country {
  return { ...structuredClone(countries.find(c => c.tag === tag)!), provinces: places.filter(p => p.owner === tag).map(p => p.id), capital: tag === 'BRA' ? 'a' : 'r', capitalId: tag === 'BRA' ? 'a' : 'r' };
}
function march(armies: Army[], places = commandMap(), relations: ReturnType<typeof relation>[] = []) {
  const result = processMovementTick({ armies, provinces: places, countries: [nation(places)], relations, addLog: () => {} });
  return [...result.armies, ...result.arrivedArmies];
}
const planned = (army = commandArmy(), places = commandMap()) => {
  let current = army;
  for (const waypoint of ['b', 'c', 'd']) { const next = appendWaypoint(current, waypoint, places, []); if (!next) throw new Error('Invalid fixture'); current = next; }
  return current;
};

describe('Movement Commands V2', () => {
  it('replaces an existing order and clears the manual queue without mutating on failure', () => {
    const army = planned(), before = structuredClone(army);
    const moved = issueMoveCommand(army, 'c', commandMap(), [])!;
    expect(moved.targetDestination).toBe('c'); expect(moved.movementPlan).toBeUndefined();
    expect(issueMoveCommand(army, 'missing', commandMap(), [])).toBeNull(); expect(army).toEqual(before);
  });
  it('executes A to B to C to D sequentially through ordinary movement ticks', () => {
    let units = [planned()]; const visited: string[] = [];
    for (let i = 0; i < 20; i++) {
      units = march(units);
      if (visited[visited.length - 1] !== units[0].location) visited.push(units[0].location!);
      if (units[0].location === 'd' && !units[0].movementPlan) break;
    }
    expect(visited).toEqual(['b', 'c', 'd']);
    expect(units[0].destination).toBeNull(); expect(units[0].movementPlan).toBeUndefined();
  });
  it('appends from the last planned destination without replacing the active segment', () => {
    const first = appendWaypoint(commandArmy(), 'b', commandMap(), [])!;
    const second = appendWaypoint(first, 'd', commandMap(), [])!;
    expect(second.path).toEqual(first.path); expect(second.destination).toBe('b');
    expect(second.movementPlan?.waypoints).toEqual(['b', 'd']);
  });
  it('adds the current final destination when extending an ordinary order', () => {
    const normal = issueMoveCommand(commandArmy(), 'c', commandMap(), [])!;
    const added = appendWaypoint(normal, 'd', commandMap(), [])!;
    expect(added.movementPlan?.waypoints).toEqual(['c', 'd']); expect(added.path).toEqual(['b', 'c']);
  });
  it('clears a plan without teleporting or changing battle state', () => {
    const army = { ...planned(), inCombat: true, movementProgress: .5 };
    const cleared = clearMovementPlan(army);
    expect(cleared.location).toBe(army.location); expect(cleared.regiments).toBe(army.regiments);
    expect(cleared.inCombat).toBe(true); expect(cleared.movementPlan).toBeUndefined(); expect(cleared.path).toEqual([]);
  });
  it('gives three selected armies the same waypoint using independent paths and deduplicates IDs', () => {
    const units = [commandArmy('one'), commandArmy('two', 'c'), commandArmy('three', 'd'), commandArmy('enemy', 'a', 'ARG')];
    const result = orderArmyGroup(['one', 'two', 'three', 'one', 'enemy'], units, 'BRA', 'b', commandMap(), [], 'append');
    expect(result.updates.size).toBe(3); expect(result.armies[3]).toBe(units[3]);
    expect(result.armies.slice(0, 3).map(a => a.path)).toEqual([['b'], ['b'], ['c', 'b']]);
  });
  it('preserves a failed army and its previous plan on partial append failure', () => {
    const places = commandMap(); places[3].neighbors = [];
    const one = appendWaypoint(commandArmy('one'), 'b', places, [])!;
    const two = { ...commandArmy('two', 'd'), movementPlan: { waypoints: ['d'] } };
    const result = orderArmyGroup(['one', 'two'], [one, two], 'BRA', 'c', places, [], 'append');
    expect(result.updates.size).toBe(1); expect(result.failures).toHaveLength(1); expect(result.armies[1]).toBe(two);
  });
  it('uses directional access and the existing war override', () => {
    const places = commandMap(); places[1].owner = 'ARG';
    expect(appendWaypoint(commandArmy(), 'b', places, [])).toBeNull();
    expect(appendWaypoint(commandArmy(), 'b', places, [relation('BRA', 'ARG', 'access')])).not.toBeNull();
    expect(appendWaypoint(commandArmy('arg', 'a', 'ARG'), 'c', places, [relation('BRA', 'ARG', 'access')])).toBeNull();
    expect(appendWaypoint(commandArmy(), 'b', places, [relation('BRA', 'ARG')])).not.toBeNull();
  });
  it('stops the entire plan when future access is revoked instead of skipping the checkpoint', () => {
    const places = commandMap(); places[2].owner = 'ARG';
    const access = [relation('BRA', 'ARG', 'access')];
    const first = appendWaypoint(commandArmy(), 'b', places, access)!;
    const queued = appendWaypoint(first, 'c', places, access)!;
    const atB = { ...queued, location: 'b', destination: null, targetDestination: null, path: [] };
    const result = advanceMovementPlans([atB], places, []);
    expect(result.interruptions).toHaveLength(1); expect(result.armies[0].location).toBe('b'); expect(result.armies[0].movementPlan).toBeUndefined();
  });
  it('stops active plans whose corridor was transferred without crossing forbidden territory', () => {
    const places = commandMap(), army = planned(); places[1].owner = 'ARG';
    const result = processMovementTick({ armies: [army], provinces: places, countries: [nation(places)], relations: [], addLog: () => {} });
    expect(result.arrivedArmies).toEqual([]); expect(result.armies[0].location).toBe('a'); expect(result.armies[0].movementPlan).toBeUndefined();
  });
  it('pauses plans in battle and resumes from the actual post-retreat position', () => {
    const army = { ...planned(), inCombat: true, destination: null, targetDestination: null, path: [] };
    expect(advanceMovementPlans([army], commandMap(), []).armies[0]).toBe(army);
    const retreated = { ...army, inCombat: false, location: 'r' };
    const resumed = advanceMovementPlans([retreated], commandMap(), []).armies[0];
    expect(resumed.location).toBe('r'); expect(resumed.path).toEqual(['b']); expect(resumed.movementPlan?.waypoints).toEqual(['b', 'c', 'd']);
  });
  it('survives a real battle at its first waypoint and continues the remaining plan', () => {
    const places = commandMap(); places[1].owner = places[4].owner = 'ARG';
    const diplomacy = [relation('BRA', 'ARG')];
    let attacker = commandArmy();
    for (const waypoint of ['b', 'c', 'd']) attacker = appendWaypoint(attacker, waypoint, places, diplomacy)!;
    const defender = commandArmy('def', 'b', 'ARG'); defender.regiments[0].organization = 0; defender.regiments[0].morale = 0;
    let state = { ...campaign([attacker, defender], diplomacy, [war('BRA', 'ARG')]), provinces: places, countries: [nation(places), nation(places, 'ARG')] };
    for (let i = 0; i < 30; i++) {
      state = day(state);
      if (state.armies.find(a => a.id === attacker.id)?.location === 'd') break;
    }
    expect(state.battlesStarted).toBeGreaterThan(0); expect(state.battleHistory.length).toBeGreaterThan(0);
    expect(state.armies.find(a => a.id === attacker.id)?.location).toBe('d');
  });
  it('clears destroyed plans and handles missing provinces safely', () => {
    expect(advanceMovementPlans([{ ...planned(), regiments: [] }], commandMap(), []).armies[0].movementPlan).toBeUndefined();
    const invalid = { ...commandArmy(), movementPlan: { waypoints: ['unknown'] } };
    expect(advanceMovementPlans([invalid], commandMap(), []).interruptions).toHaveLength(1);
    expect(() => validateMilitarySave({ world: { provinces: commandMap() }, armies: [invalid] })).toThrow(/Plano de movimento/);
    expect(() => validateMilitarySave({ armies: [{ movementPlan: { waypoints: [2] } }] })).toThrow();
  });
  it('revalidates from the position chosen by actual manual retreat without blocking withdrawal', () => {
    const places = commandMap();
    const own = { ...planned(), location: 'b', destination: null, targetDestination: null, path: [], inCombat: true };
    const enemy = { ...commandArmy('enemy', 'b', 'ARG'), inCombat: true };
    const battle = startContinuousBattle([enemy], [own], places[1], { year: 1836, month: 1, day: 1 }, 'withdraw');
    const result = retreatArmyManually(own.id, battle.id, [own, enemy], [battle], places);
    expect(result.retreatSuccess).toBe(true);
    const retreated = result.armies.find(a => a.id === own.id)!;
    expect(retreated.location).not.toBe('b'); expect(retreated.movementPlan).toBeUndefined();
    const continued = advanceMovementPlans([retreated], places, [relation('BRA', 'ARG')]).armies[0];
    expect(continued.location).toBe(retreated.location); expect(continued.targetDestination).toBeNull();
  });
  it('clears a losing army plan and protects it from immediate reengagement after retreat', () => {
    const places = commandMap();
    const own = { ...planned(), location: 'b', destination: null, targetDestination: null, path: [], inCombat: true };
    own.regiments[0].organization = 0; own.regiments[0].morale = 0;
    const enemy = { ...commandArmy('enemy', 'b', 'ARG'), inCombat: true };
    const battle = startContinuousBattle([enemy], [own], places[1], { year: 1836, month: 1, day: 1 }, 'lost');
    const result = processBattleDay(battle, [own, enemy], places[1], places);
    const retreated = result.armies.find(a => a.id === own.id)!;
    expect(result.finished).toBe(true); expect(retreated.location).not.toBe('b');
    expect(retreated.movementPlan).toBeUndefined(); expect(retreated.retreatProtectionDays).toBe(2);
    places[1].owner = 'ARG';
    const resumed = advanceMovementPlans([retreated], places, []);
    expect(resumed.interruptions).toHaveLength(0); expect(resumed.armies[0].destination).toBeNull();
  });
});
