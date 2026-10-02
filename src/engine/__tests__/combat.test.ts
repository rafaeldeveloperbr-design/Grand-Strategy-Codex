import { describe, expect, it, vi } from 'vitest';
import type { ActiveBattle, Army, BuildingConstruction, Country, Province, Recruitment, War } from '../../types';
import { calculateArmySize, checkAllProvinceCombats, startContinuousBattle } from '../combat';
import { processArmyMovement } from '../military';
import { processBattleArrival } from '../../hooks/gameLoop/battleArrivalTick';
import { processBattleContinuous } from '../../hooks/gameLoop/battleContinuousTick';

const date = { year: 1444, month: 11, day: 11 };

function province(id: string, owner: string, neighbors: string[] = []): Province {
  return {
    id, owner, neighbors, name: id, color: '#000', population: 10000,
    maxPopulation: 20000, development: 1, buildings: [], defense: 0,
    center: { x: 0, y: 0 }, path: '', unrest: 0, originalOwner: owner,
  };
}

function army(id: string, owner: string, location: string, troops: number, inCombat = false): Army {
  return {
    id, owner, location, inCombat, name: id,
    regiments: [{ type: 'infantry', strength: troops, morale: 100 }],
    destination: null, targetDestination: null, movementProgress: 0,
    movementSpeed: 1, position: null, path: [],
  };
}

function country(tag: string, provinces: string[]): Country {
  return {
    tag, provinces, name: tag, adjective: tag, color: '#000', colorLight: '#111', flag: tag,
    resources: { gold: 1000, manpower: 10000, maxManpower: 10000, stability: 50, prestige: 0 },
    economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 },
    activeLaws: {
      conscription: 'conscription_peacetime', taxation: 'taxation_normal',
      governance: 'governance_balanced', economy: 'economy_mixed', intelligence: 'intelligence_basic',
    },
  };
}

function war(attacker = 'ATT', defender = 'DEF'): War {
  return {
    id: 'war', attacker, defender, startDate: date, warScore: 0,
    attackerCasualties: 0, defenderCasualties: 0,
    occupiedByAttacker: [], occupiedByDefender: [],
  };
}

function arrivalParams(overrides: Partial<Parameters<typeof processBattleArrival>[0]> = {}) {
  const activeBattlesRef = { current: [] as ActiveBattle[] };
  return {
    arrivedArmies: [] as Army[], armies: [] as Army[], provinces: [] as Province[],
    countries: [] as Country[], wars: [] as War[], recruitments: [] as Recruitment[],
    buildingConstructions: [] as BuildingConstruction[], currentActiveBattles: [] as ActiveBattle[],
    snapshot: { date }, playerCountryTag: 'ATT', activeBattlesRef,
    addLog: vi.fn(), addToast: vi.fn(), setActiveBattles: vi.fn(),
    ...overrides,
  };
}

function continuousParams(
  armies: Army[], provinces: Province[], countries: Country[], battles: ActiveBattle[], wars: War[] = [war()],
) {
  const activeBattlesRef = { current: battles };
  return {
    armies, provinces, countries, wars, currentActiveBattles: battles,
    recruitments: [] as Recruitment[], buildingConstructions: [] as BuildingConstruction[],
    snapshot: { date }, playerCountryTag: 'PLAYER', allCountries: countries,
    addLog: vi.fn(), addToast: vi.fn(), setActiveBattles: vi.fn(), setArmies: vi.fn(),
    setBattleHistory: vi.fn(), setBattleReport: vi.fn(), setIsPaused: vi.fn(), activeBattlesRef,
  };
}

describe('COMBATE - fluxo territorial', () => {
  it('não captura a província vazia dentro do motor de movimento', () => {
    const origin = province('home', 'ATT', ['target']);
    const target = province('target', 'DEF', ['home']);
    const moving = { ...army('a1', 'ATT', 'home', 1000), destination: 'target', path: ['target'] };
    const result = processArmyMovement([moving], [origin, target], [{ countryA: 'ATT', countryB: 'DEF', opinion: -100, status: 'war', pactDaysRemaining: 0 }]);
    expect(result.updatedProvinces.find(p => p.id === 'target')?.owner).toBe('DEF');
    expect(result.arrivedArmies).toHaveLength(1);
  });

  it('conquista uma província vazia em guerra pelo fluxo territorial completo', () => {
    const target = province('target', 'DEF');
    const recruitment = { id: 'r', provinceId: 'target', owner: 'DEF', unitType: 'infantry', daysRemaining: 2, count: 1 } as Recruitment;
    const construction = { id: 'c', provinceId: 'target', owner: 'DEF', buildingType: 'farm', daysRemaining: 2, totalDays: 2, cost: 10 } as BuildingConstruction;
    const result = processBattleArrival(arrivalParams({
      arrivedArmies: [army('a1', 'ATT', 'target', 1000)], provinces: [target],
      countries: [country('ATT', []), country('DEF', ['target'])], wars: [war()],
      recruitments: [recruitment], buildingConstructions: [construction],
    }));

    expect(result.provinces[0]).toMatchObject({ owner: 'ATT', unrest: 50, originalOwner: 'DEF' });
    expect(result.countries.find(c => c.tag === 'ATT')?.provinces).toContain('target');
    expect(result.countries.find(c => c.tag === 'DEF')?.provinces).not.toContain('target');
    expect(result.recruitments).toEqual([]);
    expect(result.buildingConstructions).toEqual([]);
  });

  it('não permite ocupação de província estrangeira sem guerra', () => {
    const result = processBattleArrival(arrivalParams({
      arrivedArmies: [army('a1', 'ATT', 'target', 1000)], provinces: [province('target', 'DEF')],
      countries: [country('ATT', []), country('DEF', ['target'])], wars: [],
    }));
    expect(result.provinces[0].owner).toBe('DEF');
    expect(result.countries.find(c => c.tag === 'ATT')?.provinces).toEqual([]);
    expect(result.currentActiveBattles).toEqual([]);
  });
});

describe('COMBATE - múltiplos exércitos', () => {
  it('sincroniza os totais reais de dois atacantes contra um defensor', () => {
    const p = province('battle', 'DEF', ['att-home', 'def-home']);
    const armies = [army('a1', 'ATT', 'battle', 3000), army('a2', 'ATT', 'battle', 3000), army('d1', 'DEF', 'battle', 3000)];
    const detected = checkAllProvinceCombats(armies, [p], [war()], date, []);
    const result = processBattleContinuous(continuousParams(detected.armies, [p], [country('ATT', ['att-home']), country('DEF', ['battle', 'def-home'])], detected.newBattles));
    const active = result.currentActiveBattles[0];
    expect(active.attackerCurrentTroops).toBe(result.armies.filter(a => a.owner === 'ATT').reduce((n, a) => n + calculateArmySize(a), 0));
    expect(active.defenderCurrentTroops).toBe(result.armies.filter(a => a.owner === 'DEF').reduce((n, a) => n + calculateArmySize(a), 0));
  });

  it('sincroniza os totais reais de um atacante contra dois defensores', () => {
    const p = province('battle', 'DEF', ['att-home', 'def-home']);
    const armies = [army('a1', 'ATT', 'battle', 4000), army('d1', 'DEF', 'battle', 2000), army('d2', 'DEF', 'battle', 2000)];
    const detected = checkAllProvinceCombats(armies, [p], [war()], date, []);
    const result = processBattleContinuous(continuousParams(detected.armies, [p], [country('ATT', ['att-home']), country('DEF', ['battle', 'def-home'])], detected.newBattles));
    const active = result.currentActiveBattles[0];
    expect(active.attackerCurrentTroops).toBe(result.armies.filter(a => a.owner === 'ATT').reduce((n, a) => n + calculateArmySize(a), 0));
    expect(active.defenderCurrentTroops).toBe(result.armies.filter(a => a.owner === 'DEF').reduce((n, a) => n + calculateArmySize(a), 0));
  });

  it('inclui reforço e mantém seu dano sincronizado no total do lado', () => {
    const p = province('battle', 'DEF', ['att-home', 'def-home']);
    const initial = [army('a1', 'ATT', 'battle', 5000, true), army('d1', 'DEF', 'battle', 5000, true)];
    const battle = startContinuousBattle([initial[0]], [initial[1]], p, date, 'battle-1');
    const reinforcement = army('a2', 'ATT', 'battle', 1000);
    const detected = checkAllProvinceCombats([...initial, reinforcement], [p], [war()], date, [battle]);
    expect(detected.reinforcementsAdded.map(r => r.armyId)).toEqual(['a2']);
    const result = processBattleContinuous(continuousParams(detected.armies, [p], [country('ATT', ['att-home']), country('DEF', ['battle', 'def-home'])], detected.updatedBattles));
    const active = result.currentActiveBattles[0];
    const realAttackers = result.armies.filter(a => a.owner === 'ATT').reduce((n, a) => n + calculateArmySize(a), 0);
    expect(active.attackerCurrentTroops).toBe(realAttackers);
    expect(calculateArmySize(result.armies.find(a => a.id === 'a2')!)).toBeLessThan(1000);
  });

  it('substitui um representante desaparecido por participante válido', () => {
    const p = province('battle', 'DEF', ['att-home', 'def-home']);
    const original = [army('a1', 'ATT', 'battle', 5000), army('a2', 'ATT', 'battle', 5000), army('d1', 'DEF', 'battle', 5000)];
    const battle = startContinuousBattle(original.slice(0, 2), [original[2]], p, date, 'battle-1');
    const survivors = [original[1], original[2]].map(a => ({ ...a, inCombat: true }));
    const result = processBattleContinuous(continuousParams(survivors, [p], [country('ATT', ['att-home']), country('DEF', ['battle', 'def-home'])], [battle]));
    expect(result.currentActiveBattles).toHaveLength(1);
    expect(result.currentActiveBattles[0].attackerArmyId).toBe('a2');
  });

  it('finaliza a batalha quando um lado não possui mais participantes válidos', () => {
    const p = province('battle', 'DEF', ['att-home', 'def-home']);
    const attacker = army('a1', 'ATT', 'battle', 3000, true);
    const defender = army('d1', 'DEF', 'battle', 1000, true);
    const battle = startContinuousBattle([attacker], [defender], p, date, 'battle-1');
    const result = processBattleContinuous(continuousParams(
      [attacker], [p, province('att-home', 'ATT'), province('def-home', 'DEF')],
      [country('ATT', ['att-home']), country('DEF', ['battle', 'def-home'])], [battle],
    ));
    expect(result.currentActiveBattles).toEqual([]);
    expect(result.provinces.find(item => item.id === 'battle')?.owner).toBe('ATT');
    expect(result.armies.find(a => a.id === 'a1')?.inCombat).toBe(false);
  });

  it('recua todos os defensores sobreviventes e conquista após a retirada completa', () => {
    const battleProvince = province('battle', 'DEF', ['att-home', 'def-home']);
    const attHome = province('att-home', 'ATT', ['battle']);
    const defHome = province('def-home', 'DEF', ['battle']);
    const attackers = [army('a1', 'ATT', 'battle', 5000, true)];
    const defenders = [army('d1', 'DEF', 'battle', 600, true), army('d2', 'DEF', 'battle', 600, true)];
    const battle = { ...startContinuousBattle(attackers, defenders, battleProvince, date, 'battle-1'), daysTotal: 3, daysRemaining: 1 };
    const result = processBattleContinuous(continuousParams(
      [...attackers, ...defenders], [battleProvince, attHome, defHome],
      [country('ATT', ['att-home']), country('DEF', ['battle', 'def-home'])], [battle],
    ));

    const survivingDefenders = result.armies.filter(a => a.owner === 'DEF' && calculateArmySize(a) > 0);
    expect(survivingDefenders.length).toBeGreaterThan(0);
    expect(survivingDefenders.every(a => a.location === 'def-home' && !a.inCombat)).toBe(true);
    expect(result.armies.some(a => a.owner === 'DEF' && a.location === 'battle')).toBe(false);
    expect(result.provinces.find(p => p.id === 'battle')?.owner).toBe('ATT');
    expect(result.currentActiveBattles).toEqual([]);
  });

  it('aniquila participantes derrotados sem rota de retirada', () => {
    const battleProvince = province('battle', 'DEF', ['att-home']);
    const attackers = [army('a1', 'ATT', 'battle', 5000, true)];
    const defenders = [army('d1', 'DEF', 'battle', 600, true), army('d2', 'DEF', 'battle', 600, true)];
    const battle = { ...startContinuousBattle(attackers, defenders, battleProvince, date, 'battle-1'), daysTotal: 3, daysRemaining: 1 };
    const result = processBattleContinuous(continuousParams(
      [...attackers, ...defenders], [battleProvince, province('att-home', 'ATT', ['battle'])],
      [country('ATT', ['att-home']), country('DEF', ['battle'])], [battle],
    ));
    expect(result.armies.some(a => a.owner === 'DEF')).toBe(false);
    expect(result.provinces.find(p => p.id === 'battle')?.owner).toBe('ATT');
  });
});
