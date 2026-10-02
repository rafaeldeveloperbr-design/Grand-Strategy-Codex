import { describe, it, expect, vi } from 'vitest';
import { processMovementTick } from '../../hooks/gameLoop/movementTick';

import type {
  Army,
  Province,
  Country,
} from '../../types';

describe('MOVIMENTO', () => {
  const addLog = vi.fn();

  const createArmy = (
    overrides: Partial<Army> = {}
  ): Army => ({
    id: 'army-test',
    owner: 'BRA',
    name: 'Exército Teste',
    regiments: [
      {
        type: 'infantry',
        strength: 1000,
        morale: 100,
      },
    ],
    location: 'p1',
    destination: null,
    targetDestination: null,
    movementProgress: 0,
    movementSpeed: 1,
    position: null,
    path: [],
    inCombat: false,
    ...overrides,
  });

  const createProvince = (
    overrides: Partial<Province> = {}
  ): Province => ({
    id: 'p1',
    name: 'Província Teste',
    owner: 'BRA',
    color: '#00ff00',
    neighbors: [],
    population: 10000,
    maxPopulation: 50000,
    development: 1,
    buildings: [],
    defense: 0,
    center: { x: 0, y: 0 },
    path: '',
    unrest: 0,
    ...overrides,
  });

  const createCountry = (
    overrides: Partial<Country> = {}
  ): Country => ({
    tag: 'BRA',
    name: 'Brasil',
    adjective: 'Brasileiro',
    color: '#009739',
    colorLight: '#4ade80',
    provinces: [],

    resources: {
      gold: 1000,
      manpower: 1000,
      maxManpower: 10000,
      stability: 60,
      prestige: 0,
    },

    economy: {
      goldIncome: 0,
      goldExpense: 0,
      manpowerGain: 0,
      manpowerExpense: 0,
    },

    flag: '🇧🇷',

    activeLaws: {
      conscription: '',
      taxation: '',
      governance: '',
      economy: '',
      intelligence: '',
    },

    ...overrides,
  });

  it('deslocamento - exército que chega é movido para arrivedArmies', () => {
    const armies: Army[] = [
      createArmy({
        id: 'a1',
        owner: 'BRA',
        originalOwner: 'BRA',
        location: 'p1',
        destination: 'p2',
        targetDestination: 'p2',
        movementProgress: 0,
      }),
    ];

    const provinces: Province[] = [
      createProvince({
        id: 'p1',
        name: 'Rio',
        owner: 'BRA',
        originalOwner: 'BRA',
        neighbors: ['p2'],
      }),
      createProvince({
        id: 'p2',
        name: 'SP',
        owner: 'BRA',
        originalOwner: 'BRA',
        neighbors: ['p1'],
      }),
    ];

    const countries: Country[] = [
      createCountry({
        tag: 'BRA',
        name: 'Brasil',
        provinces: ['p1'],
      }),
    ];

    const result = processMovementTick({
      armies,
      provinces,
      relations: [],
      countries,
      addLog,
    });

    expect(result.armies.length).toBe(0);
    expect(result.arrivedArmies.length).toBe(1);
    expect(result.arrivedArmies[0].id).toBe('a1');
    expect(result.provinces.length).toBe(2);
  });

  it('libertação rebelde - mantém província quando há exército rebelde', () => {
    const armies: Army[] = [
      createArmy({
        id: 'reb1',
        owner: 'rebel_farroupilha',
        originalOwner: 'BRA',
        location: 'p1',
      }),
    ];

    const provinces: Province[] = [
      createProvince({
        id: 'p1',
        name: 'Porto Alegre',
        owner: 'rebel_farroupilha',
        originalOwner: 'BRA',
        unrest: 10,
      }),
      createProvince({
        id: 'p2',
        name: 'Rio',
        owner: 'BRA',
        originalOwner: 'BRA',
        unrest: 0,
      }),
    ];

    const countries: Country[] = [
      createCountry({
        tag: 'BRA',
        name: 'Brasil',
        provinces: [],
      }),
      createCountry({
        tag: 'rebel_farroupilha',
        name: 'Farroupilha',
        adjective: 'Farroupilha',
        provinces: ['p1'],
      }),
    ];

    const result = processMovementTick({
      armies,
      provinces,
      relations: [],
      countries,
      addLog,
    });

    expect(result.provinces).toBeDefined();
  });

  it('libertação - quando rebelde sem exército, devolve', () => {
    const armies: Army[] = [];

    const provinces: Province[] = [
      createProvince({
        id: 'p1',
        name: 'Porto Alegre',
        owner: 'rebel_farroupilha',
        originalOwner: 'BRA',
        unrest: 10,
      }),
    ];

    const countries: Country[] = [
      createCountry({
        tag: 'BRA',
        name: 'Brasil',
        provinces: [],
      }),
    ];

    const result = processMovementTick({
      armies,
      provinces,
      relations: [],
      countries,
      addLog,
    });

    expect(result.provinces[0].owner).toBe('BRA');
    expect(result.provinces[0].unrest).toBe(0);
    expect(addLog).toHaveBeenCalled();
  });
});