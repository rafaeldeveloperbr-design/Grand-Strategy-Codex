import { describe, expect, it } from 'vitest';
import type { Army, Province } from '../../types';
import {
  addReinforcementsToBattle,
  checkAllProvinceCombats,
  processBattleDay,
  startContinuousBattle,
  synchronizeBattle,
} from '../combat';
import { calculateArmySize } from '../combat/combatCalculations';

const date = { day: 1, month: 1, year: 1500 };
const province = (overrides: Partial<Province> = {}): Province => ({
  id: 'front', name: 'Front', owner: 'DEF', color: '#000', neighbors: ['att-home', 'def-home'],
  population: { total: 1, growthRate: 0.002, employed: 0, unemployed: 0, satisfaction: 60 }, maxPopulation: 1, development: 1, buildings: [], defense: 0,
  center: { x: 0, y: 0 }, path: '', unrest: 0, ...overrides,
});
const army = (id: string, owner: string, strength: number, overrides: Partial<Army> = {}): Army => ({
  id, owner, name: id, regiments: strength ? [{ type: 'infantry', strength, morale: 100 }] : [],
  location: 'front', destination: null, targetDestination: null, movementProgress: 0,
  movementSpeed: 1, position: null, path: [], inCombat: true, ...overrides,
});

function assertSynchronized(battle: ReturnType<typeof startContinuousBattle>, armies: Army[]) {
  const synchronized = synchronizeBattle(battle, armies);
  for (const side of ['attacker', 'defender'] as const) {
    const actual = armies.filter(a => battle.participantSides[a.id] === side)
      .reduce((sum, a) => sum + calculateArmySize(a), 0);
    expect(battle[side === 'attacker' ? 'attackerCurrentTroops' : 'defenderCurrentTroops']).toBe(actual);
    if (synchronized) expect(synchronized[side === 'attacker' ? 'attackerCurrentTroops' : 'defenderCurrentTroops']).toBe(actual);
  }
}

describe('fluxo de batalha contínua', () => {
  it('inclui dois atacantes contra um defensor e sincroniza perdas reais', () => {
    const armies = [army('a1', 'ATT', 800), army('a2', 'ATT', 700), army('d1', 'DEF', 1000)];
    const battle = startContinuousBattle(armies.slice(0, 2), [armies[2]], province(), date, 'b1');
    expect(battle.attackerCurrentTroops).toBe(1500);
    const result = processBattleDay(battle, armies, province(), [province()]);
    assertSynchronized(result.battle, result.armies);
    expect(result.armies.filter(a => a.owner === 'ATT').map(calculateArmySize)).not.toEqual([800, 700]);
  });

  it('inclui um atacante contra dois defensores', () => {
    const armies = [army('a1', 'ATT', 1800), army('d1', 'DEF', 700), army('d2', 'DEF', 600)];
    const battle = startContinuousBattle([armies[0]], armies.slice(1), province(), date, 'b2');
    expect(battle.defenderCurrentTroops).toBe(1300);
    const result = processBattleDay(battle, armies, province(), [province()]);
    assertSynchronized(result.battle, result.armies);
  });

  it('adiciona reforços uma vez e deriva o total dos regimentos', () => {
    const initial = [army('a1', 'ATT', 1000), army('d1', 'DEF', 1000)];
    const reinforcement = army('a2', 'ATT', 450, { inCombat: false });
    let battle = startContinuousBattle([initial[0]], [initial[1]], province(), date, 'b3');
    battle = addReinforcementsToBattle(battle, reinforcement, 'attacker', province());
    battle = addReinforcementsToBattle(battle, reinforcement, 'attacker', province());
    expect(battle.participantArmyIds.filter(id => id === 'a2')).toHaveLength(1);
    expect(synchronizeBattle(battle, [...initial, reinforcement])?.attackerCurrentTroops).toBe(1450);
  });

  it('substitui representante desaparecido por outro participante do lado', () => {
    const armies = [army('a2', 'ATT', 900), army('d1', 'DEF', 900)];
    const battle = startContinuousBattle([army('a1', 'ATT', 1000), armies[0]], [armies[1]], province(), date, 'b4');
    expect(synchronizeBattle(battle, armies)?.attackerArmyId).toBe('a2');
  });

  it('finaliza e limpa inCombat quando um lado fica sem participantes', () => {
    const defender = army('d1', 'DEF', 900);
    const battle = startContinuousBattle([army('a1', 'ATT', 1000)], [defender], province(), date, 'b5');
    const result = processBattleDay(battle, [defender], province(), [province()]);
    expect(result.finished).toBe(true);
    expect(result.winner).toBe('defender');
    expect(result.armies[0].inCombat).toBe(false);
  });

  it('recuo automático processa coletivamente todos os sobreviventes derrotados', () => {
    const attackers = [army('a1', 'ATT', 400), army('a2', 'ATT', 400)];
    const defender = army('d1', 'DEF', 2000);
    const field = province();
    const home = province({ id: 'att-home', owner: 'ATT', neighbors: ['front'] });
    const battle = { ...startContinuousBattle(attackers, [defender], field, date, 'b6'), daysTotal: 3, daysRemaining: 1 };
    const result = processBattleDay(battle, [...attackers, defender], field, [field, home]);
    expect(result.finished).toBe(true);
    expect(result.armies.filter(a => a.owner === 'ATT' && calculateArmySize(a) > 0)
      .every(a => a.location === 'att-home' && !a.inCombat)).toBe(true);
  });

  it('aniquila participante derrotado que não possui rota de fuga', () => {
    const attacker = army('a1', 'ATT', 700);
    const defender = army('d1', 'DEF', 2000);
    const field = province({ neighbors: [] });
    const battle = { ...startContinuousBattle([attacker], [defender], field, date, 'b7'), daysRemaining: 1 };
    const result = processBattleDay(battle, [attacker, defender], field, [field]);
    expect(calculateArmySize(result.armies.find(a => a.id === 'a1')!)).toBe(0);
    expect(result.armies.find(a => a.id === 'a1')?.inCombat).toBe(false);
  });

  it('não deixa defensores derrotados bloqueando conquista após retirada completa', () => {
    const attacker = army('a1', 'ATT', 3000);
    const defenders = [army('d1', 'DEF', 500), army('d2', 'DEF', 500)];
    const field = province();
    const home = province({ id: 'def-home', owner: 'DEF', neighbors: ['front'] });
    const battle = { ...startContinuousBattle([attacker], defenders, field, date, 'b8'), daysTotal: 3, daysRemaining: 1 };
    const result = processBattleDay(battle, [attacker, ...defenders], field, [field, home]);
    const defendersStillBlocking = result.armies.filter(a =>
      result.battle.participantSides[a.id] === 'defender' && a.location === field.id && calculateArmySize(a) > 0);
    expect(result.winner).toBe('attacker');
    expect(defendersStillBlocking).toEqual([]);
  });

  it('detecta todos os exércitos presentes ao criar a batalha', () => {
    const armies = [army('a1', 'ATT', 500, { inCombat: false }), army('a2', 'ATT', 500, { inCombat: false }), army('d1', 'DEF', 500, { inCombat: false }), army('d2', 'DEF', 500, { inCombat: false })];
    const result = checkAllProvinceCombats(armies, [province()], [{ attacker: 'ATT', defender: 'DEF' }], date, []);
    expect(result.newBattles[0].participantArmyIds).toHaveLength(4);
  });
});
