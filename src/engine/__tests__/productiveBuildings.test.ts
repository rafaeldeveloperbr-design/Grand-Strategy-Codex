import { describe, expect, it } from 'vitest';
import type { Country, Province } from '../../types';
import { allocateProductiveWorkers, calculateDemand, calculateProduction, createDefaultMarket, getStorageCapacity, processProvinceMarket } from '../market';
import { getPopulationCapacity } from '../population';
import { getBuildingCosts, getBuildingTime } from '../../data/buildings';
import { getBuildingBlockReason, processConstructions, startBuilding } from '../buildings';
import { migrateLegacyBuildings } from '../saveSystem';
import { payRecruitmentCost, processRecruitments } from '../military/recruitmentEngine';
import { calculateProvinceDefense } from '../economy';

const makeProvince = (buildings: Province['buildings'] = [], total = 10000): Province => {
  const market = createDefaultMarket();
  market.goods.wood.stock = 1000; market.goods.iron.stock = 1000; market.goods.tools.stock = 1000;
  return { id: 'p', name: 'P', owner: 'A', color: '#000', neighbors: [], population: { total, growthRate: 0, employed: Math.floor(total * .6), unemployed: 0, satisfaction: 60 }, market, maxPopulation: 20000, development: 5, buildings, defense: 1, center: { x: 0, y: 0 }, path: '' };
};
const built = (type: Province['buildings'][number]['type'], level = 1) => ({ type, level, daysRemaining: 0 });

describe('economia produtiva e construções v2', () => {
  it.each([['farm', 'food'], ['lumber_mill', 'wood'], ['iron_mine', 'iron']] as const)('%s produz %s', (type, good) => {
    expect(calculateProduction(makeProvince([built(type)]))[good]).toBeGreaterThan(calculateProduction(makeProvince())[good]);
  });
  it('oficina consome WOOD e IRON e produz TOOLS', () => {
    const province = makeProvince([built('workshop')]); const before = province.market!; const after = processProvinceMarket(province);
    expect(after.goods.tools.production).toBeGreaterThan(0);
    expect(after.goods.wood.stock).toBeLessThan(before.goods.wood.stock);
    expect(after.goods.iron.stock).toBeLessThan(before.goods.iron.stock);
  });
  it('falta de insumo limita a oficina proporcionalmente', () => {
    const rich = makeProvince([built('workshop')]); const poor = makeProvince([built('workshop')]); poor.market!.goods.iron.stock = 0;
    expect(processProvinceMarket(poor).goods.tools.production).toBe(0);
    expect(processProvinceMarket(rich).goods.tools.production).toBeGreaterThan(0);
  });
  it('trabalhadores são compartilhados sem duplicação', () => {
    const province = makeProvince([built('farm', 5), built('lumber_mill', 5), built('iron_mine', 5), built('workshop', 5)], 1000);
    expect(Object.values(allocateProductiveWorkers(province)).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(province.population.employed);
  });
  it('produção cai quando faltam trabalhadores', () => {
    const high = calculateProduction(makeProvince([built('farm', 5)], 10000)).food;
    const low = calculateProduction(makeProvince([built('farm', 5)], 1000)).food;
    expect(low).toBeLessThan(high);
  });
  it('armazém aumenta a capacidade real em 50% por nível', () => expect(getStorageCapacity(makeProvince([built('warehouse', 2)]))).toBe(getStorageCapacity(makeProvince()) * 2));
  it('habitação aumenta a capacidade populacional', () => expect(getPopulationCapacity(makeProvince([built('housing', 3)]))).toBe(35000));
  it('custo e tempo crescem por nível', () => {
    expect(getBuildingCosts('farm', 2).gold).toBeGreaterThan(getBuildingCosts('farm', 1).gold);
    expect(getBuildingTime('farm', 2)).toBeGreaterThan(getBuildingTime('farm', 1));
  });
  it('paga dinheiro e bens uma única vez ao iniciar', () => {
    const province = makeProvince(); const result = startBuilding(province, 'A', 'farm', 1000, []);
    expect(result.success).toBe(true); if (!result.success) return;
    const paidWood = result.province.market!.goods.wood.stock;
    processConstructions(result.constructions, [result.province]);
    expect(result.province.market!.goods.wood.stock).toBe(paidWood);
  });
  it('bloqueia sem recursos e não altera estado', () => {
    const province = makeProvince(); province.market!.goods.tools.stock = 0;
    const result = startBuilding(province, 'A', 'farm', 1000, []);
    expect(result.success).toBe(false); expect(province.market!.goods.tools.stock).toBe(0);
  });
  it('upgrade registra o próximo nível e nível 5 bloqueia', () => {
    const p = makeProvince([built('farm', 1)]); expect(startBuilding(p, 'A', 'farm', 10000, []).success).toBe(true);
    expect(getBuildingBlockReason(makeProvince([built('farm', 5)]), 'farm', 10000, [])).toBe('Nível máximo');
  });
  it('obra provincial simultânea é bloqueada', () => {
    const p = makeProvince(); const first = startBuilding(p, 'A', 'farm', 10000, []); if (!first.success) throw new Error();
    expect(getBuildingBlockReason(first.province, 'warehouse', first.gold, first.constructions)).toBe('Construção em andamento');
  });
  it('tropas estacionadas elevam demanda FOOD proporcionalmente', () => {
    const small = calculateDemand({ ...makeProvince(), stationedTroops: 1000 }).food;
    const large = calculateDemand({ ...makeProvince(), stationedTroops: 5000 }).food;
    expect(large).toBeGreaterThan(small); expect(small - calculateDemand(makeProvince()).food).toBeCloseTo(.35);
  });
  it('migra e combina construções legadas', () => {
    const legacy = [{ type: 'fortification', level: 2, daysRemaining: 0 }, { type: 'temple', level: 1, daysRemaining: 0 }] as unknown as Province['buildings'];
    expect(migrateLegacyBuildings(legacy).map(building => building.type)).toEqual(['fortress', 'housing']);
  });
  it('recrutamento consome IRON/TOOLS e manpower uma única vez', () => {
    const province = makeProvince();
    const country = { tag: 'A', name: 'A', adjective: 'A', color: '', colorLight: '', provinces: ['p'], resources: { gold: 1000, manpower: 5000, maxManpower: 5000, stability: 50, prestige: 0 }, economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 }, flag: '', activeLaws: { conscription: '', taxation: '', governance: '', economy: '', intelligence: '' } } satisfies Country;
    const paid = payRecruitmentCost(province, country, 'infantry'); expect(paid.success).toBe(true); if (!paid.success) return;
    expect(paid.province.market!.goods.iron.stock).toBeLessThan(province.market!.goods.iron.stock);
    const processed = processRecruitments([{ id: 'r', owner: 'A', provinceId: 'p', unitType: 'infantry', count: 1, daysRemaining: 1 }], [], [paid.country], [paid.province]);
    expect(processed.countries[0].resources.manpower).toBe(paid.country.resources.manpower);
  });
  it('recrutamento sem equipamento é bloqueado', () => {
    const province = makeProvince(); province.market!.goods.iron.stock = 0;
    const country = { tag: 'A', name: 'A', adjective: 'A', color: '', colorLight: '', provinces: ['p'], resources: { gold: 1000, manpower: 5000, maxManpower: 5000, stability: 50, prestige: 0 }, economy: { goldIncome: 0, goldExpense: 0, manpowerGain: 0, manpowerExpense: 0 }, flag: '', activeLaws: { conscription: '', taxation: '', governance: '', economy: '', intelligence: '' } } satisfies Country;
    expect(payRecruitmentCost(province, country, 'infantry').success).toBe(false);
  });
  it('quartel acelera o recrutamento existente', () => {
    const rec = [{ id: 'r', owner: 'A', provinceId: 'p', unitType: 'infantry' as const, count: 1, daysRemaining: 10 }];
    const country = { tag: 'A' } as Country;
    expect(processRecruitments(rec, [], [country], [makeProvince([built('barracks')])]).recruitments[0].daysRemaining).toBeLessThan(9);
  });
  it('fortaleza acrescenta +2 de defesa por nível', () => expect(calculateProvinceDefense(makeProvince([built('fortress', 3)]))).toBe(7));
});
