import { describe, it, expect } from 'vitest';
import {
  calculateRebelArmySize,
  processDailyUnrestDecay,
  applyConquestUnrest,
  isProvincePacified,
  calculateUnrestEconomicImpact,
  UNREST_BALANCE,
} from '../unrest';

import type { Army, Province } from '../../types';
import type { GameDate } from '../../types/date';

const createProvince = (
  overrides: Partial<Province> = {}
): Province => ({
  id: 'p1',
  name: 'Porto Alegre',
  owner: 'BRA',
  color: '#009739',
  neighbors: [],
  population: { total: 10000, growthRate: 0.002, employed: 5000, unemployed: 1000, satisfaction: 60 },
  maxPopulation: 50000,
  development: 1,
  buildings: [],
  defense: 0,
  center: { x: 0, y: 0 },
  path: '',
  unrest: 0,
  ...overrides,
});

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

const date: GameDate = {
  day: 1,
  month: 1,
  year: 1836,
};

describe('UNREST', () => {
  it('conquista - aplica 50 de unrest inicial', () => {
    const conquered = applyConquestUnrest(
      createProvince(),
      date
    );

    expect(conquered.unrest!).toBe(50);
  });

  it('pressão converge às causas sociais, sem crescimento incondicional', () => {
    const provinces: Province[] = [
      createProvince({
        unrest: 10,
        buildings: [],
      }),
    ];

    const result = processDailyUnrestDecay(
      provinces,
      date,
      []
    );

    expect(
      result.updatedProvinces[0].unrest!
    ).toBeLessThan(10);
  });

  it('pacificação - templo reduz unrest', () => {
    const noTemple = processDailyUnrestDecay(
      [
        createProvince({
          unrest: 20,
          buildings: [],
        }),
      ],
      date,
      []
    );

    const withTemple = processDailyUnrestDecay(
      [
        createProvince({
          unrest: 20,
          buildings: [
            {
              type: 'housing',
              level: 1,
              daysRemaining: 0,
            },
          ],
        }),
      ],
      date,
      []
    );

    expect(
      withTemple.updatedProvinces[0].unrest!
    ).toBeLessThan(
      noTemple.updatedProvinces[0].unrest!
    );
  });

  it('pacificação - guarnição reduz unrest', () => {
    const armies: Army[] = [
      createArmy({
        location: 'p1',
        owner: 'BRA',
        inCombat: false,
      }),
    ];

    const noGarrison = processDailyUnrestDecay(
      [
        createProvince({
          unrest: 20,
        }),
      ],
      date,
      []
    );

    const withGarrison = processDailyUnrestDecay(
      [
        createProvince({
          unrest: 20,
        }),
      ],
      date,
      armies
    );

    expect(
      withGarrison.updatedProvinces[0].unrest!
    ).toBeLessThan(
      noGarrison.updatedProvinces[0].unrest!
    );
  });

  it('unrest extremo sozinho não gera revolta nem reseta pressão', () => {
    const provinces: Province[] = [
      createProvince({
        unrest: 99.9,
      }),
    ];

    const result = processDailyUnrestDecay(
      provinces,
      date,
      []
    );

    expect(result.revoltedProvinces.length).toBe(0);
    expect(result.updatedProvinces[0].unrest!).toBeGreaterThan(90);
  });

  it('tamanho rebelde - escala dentro dos limites configurados', () => {
    const small = calculateRebelArmySize(
      createProvince({
        population: { total: 1000, growthRate: 0.002, employed: 500, unemployed: 100, satisfaction: 60 },
      })
    );

    const big = calculateRebelArmySize(
      createProvince({
        population: { total: 100000, growthRate: 0.002, employed: 50000, unemployed: 10000, satisfaction: 60 },
      })
    );

    expect(big).toBeGreaterThanOrEqual(small);
    expect(big).toBeLessThanOrEqual(
      UNREST_BALANCE.MAX_REBEL_SIZE
    );
    expect(small).toBeGreaterThanOrEqual(
      UNREST_BALANCE.MIN_REBEL_SIZE
    );
  });

  it('econômico - unrest 100 penaliza 50% ouro', () => {
    const high = calculateUnrestEconomicImpact(100);

    expect(high.goldMultiplier).toBe(0.5);
    expect(high.manpowerMultiplier).toBe(0.7);
  });

  it('pacificada - exige pressão estável e ausência de organização', () => {
    expect(
      isProvincePacified(
        createProvince({
          unrest: 0,
        })
      )
    ).toBe(true);

    expect(
      isProvincePacified(
        createProvince({
          unrest: 50,
        })
      )
    ).toBe(false);
  });
});
