import { describe, expect, it } from 'vitest';
import type { Army, BuildingType, Country, Province } from '../../types';
import { BUILDING_DEFINITIONS, getBuildingCost, getPopulationCapacity, getProvinceDefense } from '../../data/buildings';
import { startBuildingProject, processConstructions } from '../buildings';
import { calculateDemand, calculateProduction, createDefaultMarket, GOOD_IDS, processProvinceMarket } from '../market';
import { payRecruitmentCost, processRecruitments } from '../military/recruitmentEngine';
import { processInternalTrade } from '../internalTrade';
import { migrateBuildingType } from '../saveSystem';
import { processAIEconomicDecisions } from '../aiEngine/aiEconomy';

const makeProvince = (buildings: Province['buildings'] = [], overrides: Partial<Province> = {}): Province => ({
  id: 'p1', name: 'P1', owner: 'A', color: '#000', neighbors: [],
  population: { total: 10000, growthRate: 0, employed: 5000, unemployed: 1000, satisfaction: 60 },
  market: createDefaultMarket(), maxPopulation: 20000, baseMaxPopulation: 20000, development: 5,
  buildings, defense: 1, center: { x: 0, y: 0 }, path: '', ...overrides,
});
const country = (gold = 10000, manpower = 10000): Country => ({
  tag: 'A', name: 'A', adjective: 'A', color: '#000', colorLight: '#111', provinces: ['p1'],
  resources: { gold, manpower, maxManpower: 20000, stability: 60, prestige: 0 },
  economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 }, flag: '',
  activeLaws: { conscription: '', taxation: '', governance: '', economy: '', intelligence: '' },
});
const building = (type: BuildingType, level = 1) => ({ type, level, daysRemaining: 0 });
const stock = (province: Province, wood: number, iron: number, tools: number) => {
  province.market!.goods.wood.stock = wood; province.market!.goods.iron.stock = iron; province.market!.goods.tools.stock = tools;
  return province;
};

describe('Economia produtiva e recursos estratégicos', () => {
  it.each([
    ['farm', GOOD_IDS.FOOD], ['lumber_mill', GOOD_IDS.WOOD], ['iron_mine', GOOD_IDS.IRON],
  ] as const)('%s produz seu bem real', (type, good) => {
    expect(calculateProduction(makeProvince([building(type)]))[good]).toBeGreaterThan(0);
  });

  it('Workshop consome WOOD/IRON e produz TOOLS', () => {
    const province = stock(makeProvince([building('workshop', 2)]), 100, 100, 0);
    const result = processProvinceMarket(province);
    expect(result.goods.tools.production).toBeGreaterThan(0);
    expect(result.goods.wood.stock).toBeLessThan(100);
    expect(result.goods.iron.stock).toBeLessThan(100);
  });

  it('Workshop para sem insumos', () => {
    const result = processProvinceMarket(makeProvince([building('workshop', 3)]));
    expect(result.goods.tools.production).toBe(0);
  });

  it('mão de obra limita todos os setores sem duplicar trabalhadores', () => {
    const sectors = [building('farm', 5), building('lumber_mill', 5), building('iron_mine', 5), building('workshop', 5)];
    const scarce = calculateProduction(makeProvince(sectors, { population: { total: 1000, growthRate: 0, employed: 100, unemployed: 500, satisfaction: 50 } }));
    const supplied = calculateProduction(makeProvince(sectors, { population: { total: 100000, growthRate: 0, employed: 50000, unemployed: 10000, satisfaction: 60 } }));
    expect(scarce.food + scarce.wood + scarce.iron + scarce.tools).toBeLessThan(supplied.food + supplied.wood + supplied.iron + supplied.tools);
  });

  it('Warehouse aumenta armazenamento e Housing aumenta capacidade populacional', () => {
    const base = makeProvince(); const warehouse = makeProvince([building('warehouse', 2)]);
    base.market!.goods.food.stock = warehouse.market!.goods.food.stock = 1000;
    expect(processProvinceMarket(warehouse).goods.food.stock).toBeGreaterThan(processProvinceMarket(base).goods.food.stock);
    expect(getPopulationCapacity(makeProvince([building('housing', 2)]))).toBe(30000);
  });

  it('Barracks acelera recrutamento e Fortress aumenta defesa efetiva', () => {
    const rec = [{ id: 'r', provinceId: 'p1', owner: 'A', unitType: 'infantry' as const, daysRemaining: 10, count: 1 }];
    const without = processRecruitments(rec, [], [country()], [makeProvince()]).recruitments[0].daysRemaining;
    const withBarracks = processRecruitments(rec, [], [country()], [makeProvince([building('barracks', 2)])]).recruitments[0].daysRemaining;
    expect(withBarracks).toBeLessThan(without);
    expect(getProvinceDefense(makeProvince([building('fortress', 2)]))).toBe(5);
  });

  it('construção paga dinheiro e recursos uma única vez e upgrade eleva nível', () => {
    const province = stock(makeProvince([building('farm', 1)]), 100, 100, 100);
    const started = startBuildingProject(province, country(), 'farm', []);
    expect(started.success).toBe(true);
    expect(started.province.market!.goods.wood.stock).toBeLessThan(100);
    const paidStock = started.province.market!.goods.wood.stock;
    const completed = processConstructions([{ ...started.constructions[0], daysRemaining: 1 }], [started.province]);
    expect(completed.completedConstructions[0].targetLevel).toBe(2);
    expect(started.province.market!.goods.wood.stock).toBe(paidStock);
  });

  it('bloqueia construção sem recursos, aumenta custo por nível e respeita máximo', () => {
    expect(startBuildingProject(makeProvince(), country(), 'workshop', []).success).toBe(false);
    expect(getBuildingCost('farm', 3)).toBeGreaterThan(getBuildingCost('farm', 1));
    const maxed = stock(makeProvince([building('farm', BUILDING_DEFINITIONS.farm.maxLevel)]), 100, 100, 100);
    expect(startBuildingProject(maxed, country(), 'farm', []).reason).toBe('Nível máximo');
  });

  it('recrutamento consome IRON/TOOLS e bloqueia quando faltam', () => {
    const equipped = stock(makeProvince(), 100, 100, 100);
    const paid = payRecruitmentCost(country(), equipped, 'infantry');
    expect(paid.success).toBe(true);
    expect(paid.province.market!.goods.iron.stock).toBe(95);
    expect(paid.province.market!.goods.tools.stock).toBe(97);
    expect(payRecruitmentCost(country(), makeProvince(), 'infantry').success).toBe(false);
  });

  it('tropas elevam demanda local de FOOD', () => {
    const army: Army = { id: 'a', owner: 'A', name: 'A', regiments: [{ type: 'infantry', strength: 3000, morale: 100 }], location: 'p1', destination: null, targetDestination: null, movementProgress: 0, movementSpeed: 1, position: null, path: [] };
    expect(calculateDemand(makeProvince(), [army]).food).toBeGreaterThan(calculateDemand(makeProvince()).food);
  });

  it('comércio abastece a oficina para produzir no tick seguinte', () => {
    const mine = stock(makeProvince([building('iron_mine', 3)], { id: 'mine', neighbors: ['industry'] }), 0, 100, 0);
    mine.market!.goods.iron.demand = 1;
    const industry = stock(makeProvince([building('workshop', 2)], { id: 'industry', neighbors: ['mine'] }), 100, 0, 0);
    industry.market!.goods.iron.demand = 10; industry.market!.goods.iron.shortage = 10;
    const traded = processInternalTrade([mine, industry]);
    expect(traded[1].market!.goods.iron.imported).toBeGreaterThan(0);
    expect(processProvinceMarket(traded[1]).goods.tools.production).toBeGreaterThan(0);
  });

  it('migra tipos antigos para equivalentes conservadores', () => {
    expect(migrateBuildingType('fortification')).toBe('fortress');
    expect(migrateBuildingType('temple')).toBe('housing');
    expect(migrateBuildingType('port')).toBe('market');
    expect(migrateBuildingType('university')).toBe('infrastructure');
  });

  it('IA não inicia construção ou recrutamento sem recursos econômicos', () => {
    const result = processAIEconomicDecisions(
      country(0, 0), [makeProvince()],
      { countryTag: 'A', activeFocusId: null, activeResearchId: null, completedFocuses: [], completedTechnologies: [], focusProgressDays: 0, researchProgressDays: 0 },
      [], [], '1/1/1', true
    );
    expect(result.buildingConstructions).toEqual([]);
    expect(result.recruitments).toEqual([]);
    expect(result.provinces[0].market!.goods.iron.stock).toBe(0);
  });
});
