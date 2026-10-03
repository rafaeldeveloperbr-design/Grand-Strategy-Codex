import { describe, expect, it } from 'vitest';
import type { GoodId, Province } from '../../types';
import { GOOD_IDS, createDefaultMarket } from '../market';
import { TRADE_PRIORITY, calculateTradeBalance, findDomesticTradePath, processInternalTrade } from '../internalTrade';

function province(id: string, owner: string, neighbors: string[], stock: number, demand: number, good: GoodId = GOOD_IDS.FOOD): Province {
  const market = createDefaultMarket();
  market.goods[good] = { ...market.goods[good], stock, demand, shortage: Math.max(0, demand - stock), price: 2 };
  return {
    id, owner, neighbors, name: id, color: '#000', population: { total: 10000, growthRate: 0, employed: 5000, unemployed: 1000, satisfaction: 60 },
    market, maxPopulation: 20000, development: 5, buildings: [], defense: 0, center: { x: 0, y: 0 }, path: '', unrest: 0,
  };
}
const total = (provinces: Province[], good: GoodId = GOOD_IDS.FOOD) => provinces.reduce((sum, p) => sum + p.market!.goods[good].stock, 0);

describe('Comércio Interno V1', () => {
  it('província com excedente abastece província com déficit', () => {
    const result = processInternalTrade([province('a', 'X', ['b'], 100, 10), province('b', 'X', ['a'], 0, 20)]);
    expect(result[0].market!.goods.food.exported).toBe(20);
    expect(result[1].market!.goods.food.imported).toBe(20);
  });

  it('preserva reserva mínima baseada na demanda local', () => {
    const source = province('a', 'X', ['b'], 20, 10);
    expect(calculateTradeBalance(source, GOOD_IDS.FOOD).reserve).toBe(15);
    const result = processInternalTrade([source, province('b', 'X', ['a'], 0, 100)]);
    expect(result[0].market!.goods.food.stock).toBe(15);
  });

  it('FOOD possui prioridade estável sobre os demais bens', () => {
    expect(TRADE_PRIORITY[0]).toBe(GOOD_IDS.FOOD);
  });

  it('não negocia entre países diferentes', () => {
    const result = processInternalTrade([province('a', 'X', ['b'], 100, 10), province('b', 'Y', ['a'], 0, 20)]);
    expect(result[1].market!.goods.food.imported).toBe(0);
  });

  it('não negocia entre províncias desconectadas', () => {
    const result = processInternalTrade([province('a', 'X', [], 100, 10), province('b', 'X', [], 0, 20)]);
    expect(result[1].market!.goods.food.stock).toBe(0);
  });

  it('encontra e utiliza rota por província intermediária amiga', () => {
    const provinces = [province('a', 'X', ['m'], 100, 10), province('m', 'X', ['a', 'b'], 15, 10), province('b', 'X', ['m'], 0, 20)];
    expect(findDomesticTradePath('a', 'b', provinces)).toEqual(['a', 'm', 'b']);
    expect(processInternalTrade(provinces)[2].market!.goods.food.imported).toBeGreaterThan(0);
  });

  it('conserva a soma total dos bens transferidos', () => {
    const provinces = [province('a', 'X', ['b'], 100, 10), province('b', 'X', ['a'], 0, 20)];
    expect(total(processInternalTrade(provinces))).toBe(total(provinces));
  });

  it('combina múltiplos fornecedores', () => {
    const result = processInternalTrade([
      province('a', 'X', ['c'], 30, 10), province('b', 'X', ['c'], 40, 10), province('c', 'X', ['a', 'b'], 0, 40),
    ]);
    expect(result[0].market!.goods.food.exported).toBeGreaterThan(0);
    expect(result[1].market!.goods.food.exported).toBeGreaterThan(0);
    expect(result[2].market!.goods.food.imported).toBe(40);
  });

  it('distribui de forma justa entre múltiplos consumidores', () => {
    const result = processInternalTrade([
      province('s', 'X', ['a', 'b'], 35, 10), province('a', 'X', ['s'], 0, 20), province('b', 'X', ['s'], 0, 20),
    ]);
    expect(result.find(p => p.id === 'a')!.market!.goods.food.imported).toBe(10);
    expect(result.find(p => p.id === 'b')!.market!.goods.food.imported).toBe(10);
  });

  it('resultado é determinístico independentemente da ordem do array', () => {
    const provinces = [province('s', 'X', ['a', 'b'], 35, 10), province('a', 'X', ['s'], 0, 20), province('b', 'X', ['s'], 0, 20)];
    const flows = (items: Province[]) => processInternalTrade(items).sort((a, b) => a.id.localeCompare(b.id)).map(p => p.market!.goods.food.imported);
    expect(flows(provinces)).toEqual(flows([...provinces].reverse()));
  });

  it('importação reduz escassez e pressão de preço', () => {
    const consumer = province('b', 'X', ['a'], 0, 20);
    const priceBefore = consumer.market!.goods.food.price;
    const result = processInternalTrade([province('a', 'X', ['b'], 100, 10), consumer]);
    const food = result.find(p => p.id === 'b')!.market!.goods.food;
    expect(food.shortage).toBe(0);
    expect(food.price).toBeLessThan(priceBefore);
  });

  it('registra métricas corretas de importação e exportação', () => {
    const result = processInternalTrade([province('a', 'X', ['b'], 100, 10), province('b', 'X', ['a'], 0, 20)]);
    expect(result[0].market!.goods.food.exported).toBe(result[1].market!.goods.food.imported);
    expect(result[0].market!.goods.food.imported).toBe(0);
    expect(result[1].market!.goods.food.exported).toBe(0);
  });
});
