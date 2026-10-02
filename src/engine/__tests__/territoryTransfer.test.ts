import { describe, expect, it, vi } from 'vitest';
import type { Army, BuildingConstruction, Country, Province, Recruitment, War } from '../../types';
import { processBattleArrival } from '../../hooks/gameLoop/battleArrivalTick';
import { transferProvince } from '../territoryTransfer';

const province = (owner = 'DEF'): Province => ({ id: 'p', name: 'Border', owner, color: '#000', neighbors: [], population: 1, maxPopulation: 1, development: 1, buildings: [], defense: 0, center: { x: 0, y: 0 }, path: '', unrest: 0 });
const country = (tag: string, provinces: string[]): Country => ({ tag, name: tag, adjective: tag, color: '#000', colorLight: '#111', provinces, resources: { gold: 0, manpower: 0, maxManpower: 0, stability: 50, prestige: 0 }, economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 }, flag: '', activeLaws: { conscription: '', taxation: '', governance: '', economy: '', intelligence: '' } });
const army: Army = { id: 'a', owner: 'ATT', name: 'Army', regiments: [{ type: 'infantry', strength: 1000, morale: 100 }], location: 'p', destination: null, targetDestination: null, movementProgress: 0, movementSpeed: 1, position: null, path: [], inCombat: false };
const recruitment: Recruitment = { id: 'r', provinceId: 'p', owner: 'DEF', unitType: 'infantry', daysRemaining: 2, count: 1 };
const construction: BuildingConstruction = { id: 'c', provinceId: 'p', owner: 'DEF', buildingType: 'farm', daysRemaining: 2, totalDays: 4, cost: 10 };
const war: War = { id: 'w', attacker: 'ATT', defender: 'DEF', startDate: { day: 1, month: 1, year: 1500 }, warScore: 0, attackerCasualties: 0, defenderCasualties: 0, occupiedByAttacker: [], occupiedByDefender: [] };

function arrival(wars: War[]) {
  const activeBattlesRef = { current: [] };
  return processBattleArrival({
    arrivedArmies: [army], armies: [], provinces: [province()], countries: [country('ATT', []), country('DEF', ['p'])], wars,
    recruitments: [recruitment], buildingConstructions: [construction], currentActiveBattles: [], snapshot: { date: { day: 1, month: 1, year: 1500 } },
    playerCountryTag: 'XXX', allCountries: [], activeBattlesRef, addLog: vi.fn(), addToast: vi.fn(), setActiveBattles: vi.fn(),
    cancelProvinceActivities: () => { throw new Error('legacy transfer path must not run'); },
  });
}

describe('transferência territorial', () => {
  it('captura província vazia durante guerra e sincroniza todo o estado', () => {
    const result = arrival([war]);
    expect(result.provinces[0].owner).toBe('ATT');
    expect(result.provinces[0].unrest).toBeGreaterThan(0);
    expect(result.countries.find(c => c.tag === 'ATT')?.provinces).toContain('p');
    expect(result.countries.find(c => c.tag === 'DEF')?.provinces).not.toContain('p');
    expect(result.recruitments).toEqual([]);
    expect(result.buildingConstructions).toEqual([]);
  });

  it('não permite ocupação de outro país sem guerra', () => {
    const result = arrival([]);
    expect(result.provinces[0].owner).toBe('DEF');
    expect(result.countries.find(c => c.tag === 'DEF')?.provinces).toContain('p');
    expect(result.recruitments).toHaveLength(1);
    expect(result.buildingConstructions).toHaveLength(1);
  });

  it('helper de libertação zera unrest e evita IDs duplicados', () => {
    const result = transferProvince({ provinces: [province('rebel_x')], countries: [country('ATT', ['p']), country('rebel_x', ['p'])], recruitments: [recruitment], constructions: [construction] }, 'p', 'ATT', { liberation: true });
    expect(result.provinces[0]).toMatchObject({ owner: 'ATT', unrest: 0 });
    expect(result.countries[0].provinces).toEqual(['p']);
    expect(result.recruitments).toEqual([]);
    expect(result.constructions).toEqual([]);
  });
});
