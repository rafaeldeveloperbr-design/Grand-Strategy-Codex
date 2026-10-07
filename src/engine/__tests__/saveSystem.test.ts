import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, listSaves } from '../saveSystem';
import type { Army, GameDate, Province } from '../../types';
import type { CountryTechState } from '../../types/technology';
import { cancelNationalFocus, createInitialTechState, normalizeTechState } from '../technology';
import { createDefaultMarket, GOOD_IDS, GOODS } from '../market';

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

  it('round-trips legacy focuses, normalizes bots and keeps V2 state serialization', () => {
    const player = {...createInitialTechState('BRA'),activeResearchId:'standardized_tools',researchProgressDays:12.5,completedTechnologies:['improved_agriculture','advanced_sawmills','advanced_mining'],activeFocusId:'focus_professional_cavalry',focusProgressDays:17,completedFocuses:['focus_cavalry_traditions','focus_kingdom_centralization','focus_civil_reforms']};
    const bot = {...createInitialTechState('ARG'),activeResearchId:'removed',researchProgressDays:-8,completedTechnologies:['medicine','missing','medicine'],activeFocusId:'removed',focusProgressDays:8,completedFocuses:['focus_national_unity','missing','focus_national_unity']};
    const refs: SaveGameRefs = {
      dateRef:{current:{day:1,month:1,year:1836}},provincesRef:{current:[]},countriesRef:{current:[]},armiesRef:{current:[]},
      warsRef:{current:[]},diplomaticRelationsRef:{current:[]},recruitmentsRef:{current:[]},buildingConstructionsRef:{current:[]},activeBattlesRef:{current:[]},
      playerTechStateRef:{current:player},botTechStatesRef:{current:new Map([['ARG',bot]])},
    };
    expect(saveGame(refs,'focus-v2')).toBe(true);
    const raw = JSON.parse(localStorage.getItem('imperium_save_focus-v2')!);
    expect(raw.version).toBe(2);
    expect(raw.technology.player).toEqual(player);
    expect(Object.keys(raw.technology.player).sort()).toEqual(Object.keys(createInitialTechState('BRA')).sort());
    const loaded = loadGame('focus-v2')!;
    expect(loaded.technology.player).toEqual(player);
    expect(loaded.technology.bots.get('ARG')).toEqual(normalizeTechState(bot));
    refs.playerTechStateRef.current = cancelNationalFocus(loaded.technology.player);
    expect(saveGame(refs,'focus-v2')).toBe(true);
    expect(loadGame('focus-v2')?.technology.player).toEqual({...player,activeFocusId:null,focusProgressDays:0});
  });

  it('loads V1 legacy active focuses and bot completions without renaming IDs', () => {
    const player = {...createInitialTechState('BRA'),activeResearchId:'education',researchProgressDays:23.5,completedTechnologies:['sanitation','medicine','public_administration'],activeFocusId:'focus_scientific_patronage',focusProgressDays:23,completedFocuses:['focus_kingdom_centralization']};
    const bot = {...createInitialTechState('ARG'),activeResearchId:'advanced_mining',researchProgressDays:7,completedTechnologies:['advanced_sawmills','missing','advanced_sawmills'],completedFocuses:['focus_professional_cavalry','missing','focus_professional_cavalry']};
    localStorage.setItem('imperium_save_focus-v1',JSON.stringify({
      id:'focus-v1',name:'Legacy',timestamp:1,date:{day:1,month:1,year:1},provinces:[],countries:[],armies:[],wars:[],relations:[],recruitments:[],constructions:[],activeBattles:[],
      playerTech:player,botTechs:{ARG:bot},
    }));
    const loaded = loadGame('focus-v1')!;
    expect(loaded.technology.player).toEqual(player);
    expect(loaded.technology.bots.get('ARG')).toEqual(normalizeTechState(bot));
  });

  it('preserva os dados populacionais completos', () => {
    const population = { total: 12000, growthRate: 0.0015, employed: 6000, unemployed: 1200, satisfaction: 72, foodShortageDays: 1800, severeFoodShortageDays: 1700, migrationNet: -2 };
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

  it('preserva estoques, preços e poder de compra do mercado', () => {
    const market = createDefaultMarket();
    market.goods[GOOD_IDS.FOOD].stock = 42;
    market.goods[GOOD_IDS.FOOD].price = 1.7;
    market.purchasingPower = 63;
    const refs = {
      dateRef: { current: { day: 1, month: 1, year: 1836 } },
      provincesRef: { current: [{ id: 'p1', population: { total: 1000, growthRate: 0.002, employed: 500, unemployed: 100, satisfaction: 60 }, market } as Province] },
      countriesRef: { current: [] }, armiesRef: { current: [] }, warsRef: { current: [] }, diplomaticRelationsRef: { current: [] },
      recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] },
      playerTechStateRef: { current: { countryTag: 'BRA', activeFocusId: null, activeResearchId: null, completedFocuses: [], completedTechnologies: [], focusProgressDays: 0, researchProgressDays: 0 } },
      botTechStatesRef: { current: new Map() }, activeBattlesRef: { current: [] },
    } as SaveGameRefs;
    saveGame(refs, 'market');
    expect(loadGame('market')?.world.provinces[0].market).toEqual(market);
  });

  it('migra população numérica de save antigo com padrões seguros', () => {
    localStorage.setItem('imperium_save_legacy', JSON.stringify({
      id: 'legacy', name: 'Legacy', timestamp: 1, date: { day: 1, month: 1, year: 1 },
      provinces: [{ id: 'p1', population: 5000 }], countries: [], armies: [], wars: [], relations: [], recruitments: [], constructions: [],
      playerTech: { countryTag: 'BRA', activeFocusId: null, activeResearchId: null, completedFocuses: [], completedTechnologies: [], focusProgressDays: 0, researchProgressDays: 0 },
      botTechs: {}, activeBattles: [],
    }));
    expect(loadGame('legacy')?.world.provinces[0].population).toEqual({
      total: 5000, growthRate: 0.002, employed: 2500, unemployed: 500, satisfaction: 60, foodShortageDays: 0, severeFoodShortageDays: 0, migrationNet: 0,
    });
    const migratedMarket = loadGame('legacy')?.world.provinces[0].market;
    expect(migratedMarket?.goods[GOOD_IDS.FOOD].price).toBe(GOODS[GOOD_IDS.FOOD].basePrice);
    expect(migratedMarket?.goods[GOOD_IDS.FOOD].stock).toBe(0);
    expect(migratedMarket?.purchasingPower).toBe(50);
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
