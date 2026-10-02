import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, listSaves } from '../saveSystem';
import type { Army, GameDate, Province } from '../../types';
import type { CountryTechState } from '../../types/technology';

type SaveGameRefs = Parameters<typeof saveGame>[0];

// Polyfill pra rodar mesmo em Node
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>();

  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      get length() {
        return store.size;
      },
      key: (i: number) =>
        Array.from(store.keys())[i] ?? null,
      getItem: (k: string) =>
        store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
    },
    configurable: true,
  });
}

describe('SAVE/LOAD', () => {
  beforeEach(() => localStorage.clear());

  it('salvar e carregar preserva data', () => {
    const date: GameDate = { day: 15, month: 6, year: 1836 };
    const refs = {
      dateRef: { current: date },
      provincesRef: { current: [] },
      countriesRef: { current: [] },
      armiesRef: {
        current: [
          {
            id: 'a1',
          } as Army,
        ],
      },
      warsRef: { current: [] },
      diplomaticRelationsRef: { current: [] },
      recruitmentsRef: { current: [] },
      buildingConstructionsRef: { current: [] },
      playerTechStateRef: {
        current: {
          countryTag: 'BRA',
          activeFocusId: null,
          activeResearchId: null,
          completedFocuses: [],
          completedTechnologies: [],
          focusProgressDays: 0,
          researchProgressDays: 0,
        },
      },
      botTechStatesRef: { current: new Map() },
      activeBattlesRef: { current: [] },
    } as SaveGameRefs;

    saveGame(refs, 'test1', 'Teste');
    const loaded = loadGame('test1');

    expect(loaded?.date).toEqual(date);
    expect(loaded?.military.armies[0].id).toBe('a1');
  });

  it('reconstruir Map de bots', () => {
    const botTechState: CountryTechState = {
      countryTag: 'ARG',
      activeFocusId: null,
      activeResearchId: null,
      completedFocuses: [],
      completedTechnologies: [],
      focusProgressDays: 0,
      researchProgressDays: 0,
    };

    const botMap = new Map<string, CountryTechState>([
      ['ARG', botTechState],
    ]);
    const refs = {
      dateRef: { current: { day: 1, month: 1, year: 1836 } },
      provincesRef: { current: [] },
      countriesRef: { current: [] },
      armiesRef: { current: [] },
      warsRef: { current: [] },
      diplomaticRelationsRef: { current: [] },
      recruitmentsRef: { current: [] },
      buildingConstructionsRef: { current: [] },
      playerTechStateRef: {
        current: {
          countryTag: 'BRA',
          activeFocusId: null,
          activeResearchId: null,
          completedFocuses: [],
          completedTechnologies: [],
          focusProgressDays: 0,
          researchProgressDays: 0,
        },
      },
      botTechStatesRef: { current: botMap },
      activeBattlesRef: { current: [] },
    } as SaveGameRefs;

    saveGame(refs, 'testMap', 'MapTest');
    const loaded = loadGame('testMap');

    expect(loaded?.technology.bots instanceof Map).toBe(true);
    expect(loaded?.technology.bots.get('ARG')).toBeDefined();
  });

  it('preserva os dados populacionais completos', () => {
    const population = { total: 12000, growthRate: 0.0015, employed: 6000, unemployed: 1200, satisfaction: 72 };
    const refs = {
      dateRef: { current: { day: 1, month: 1, year: 1836 } },
      provincesRef: { current: [{ id: 'p1', population } as Province] }, countriesRef: { current: [] }, armiesRef: { current: [] },
      warsRef: { current: [] }, diplomaticRelationsRef: { current: [] }, recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] },
      playerTechStateRef: { current: { countryTag: 'BRA', activeFocusId: null, activeResearchId: null, completedFocuses: [], completedTechnologies: [], focusProgressDays: 0, researchProgressDays: 0 } },
      botTechStatesRef: { current: new Map() }, activeBattlesRef: { current: [] },
    } as SaveGameRefs;
    saveGame(refs, 'population');
    expect(loadGame('population')?.world.provinces[0].population).toEqual(population);
  });

  it('migra população numérica de save antigo com padrões seguros', () => {
    localStorage.setItem('imperium_save_legacy', JSON.stringify({
      id: 'legacy', name: 'Legacy', timestamp: 1, date: { day: 1, month: 1, year: 1 },
      provinces: [{ id: 'p1', population: 5000 }], countries: [], armies: [], wars: [], relations: [], recruitments: [], constructions: [],
      playerTech: { countryTag: 'BRA', activeFocusId: null, activeResearchId: null, completedFocuses: [], completedTechnologies: [], focusProgressDays: 0, researchProgressDays: 0 },
      botTechs: {}, activeBattles: [],
    }));
    expect(loadGame('legacy')?.world.provinces[0].population).toEqual({
      total: 5000, growthRate: 0.002, employed: 2500, unemployed: 500, satisfaction: 60,
    });
  });


});
it('rejeita save corrompido sem crash', () => {
  localStorage.setItem('save_corrompido', JSON.stringify({ id: 'x', name: 'lixo' })); // sem date
  localStorage.setItem('save_corrompido2', '{ json invalido');

  const saves = listSaves();
  expect(saves.find(s => s.id === 'corrompido')).toBeUndefined();

  const loaded = loadGame('corrompido');
  expect(loaded).toBeNull();
});
