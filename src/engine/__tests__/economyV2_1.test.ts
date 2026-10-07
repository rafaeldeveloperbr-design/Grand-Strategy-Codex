// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Country, GoodId, Province } from '../../types';
import { countries as mapCountries, provincesData } from '../../data/map';
import { ALL_GOODS, calculateLocalPrice, createDefaultMarket, getStorageCapacity } from '../market';
import { ECONOMY_V2_BALANCE as B } from '../economy/balance';
import { aggregateNationalMarket, calculateImportDependency, strategicStockTarget } from '../economy/nationalMarket';
import { canCountriesTrade, calculateBilateralPrice, processInternationalTrade, type InternationalTradeContext } from '../economy/internationalTrade';
import { normalizeNationalTrade, normalizeTariffRate } from '../economy/tradeState';
import { declareWar, diplomacyDay, createRelation } from '../diplomacy';
import { prepareCountryMarkets, processDailyTick } from '../economy';
import { processEconomyTick } from '../../hooks/gameLoop/economyTick';
import { createInitialTechState } from '../technology';
import { saveGame, loadGame } from '../saveSystem';

function province(id: string,owner: string,stock: number,demand = 1,consumption = 0,good: GoodId = 'food'): Province {
  const market = createDefaultMarket();
  for (const id of ALL_GOODS) market.goods[id] = {...market.goods[id],stock: 0};
  market.goods[good] = {...market.goods[good],stock,demand,consumption,production: 2,price: 1,shortage: Math.max(0,demand-stock-consumption)};
  return {...structuredClone(provincesData[0]),id,owner,neighbors: [],development: 5,
    population: {total: 10000,employed: 5000,unemployed: 1000,growthRate: 0,satisfaction: 60},
    buildings: [{type: 'warehouse',level: 4,daysRemaining: 0}],market};
}
function country(tag: string,provinces: Province[],gold = 10000): Country {
  return {...structuredClone(mapCountries[0]),tag,name: tag,capitalId: provinces.find(p => p.owner === tag)?.id,
    provinces: provinces.filter(p => p.owner === tag).map(p => p.id),resources: {...mapCountries[0].resources,gold}};
}
function world(ps = [province('a','A',100),province('b','B',0)]): InternationalTradeContext {
  return {countries: [...new Set(ps.map(p => p.owner))].map(tag => country(tag,ps)),provinces: ps,wars: [],relations: [],date: {year: 1444,month: 11,day: 11}};
}
const onNextDay = (ctx: InternationalTradeContext): InternationalTradeContext => {
  const date = new Date((diplomacyDay(ctx.date)+1)*86400000);
  return {...ctx,date: {year: date.getUTCFullYear(),month: date.getUTCMonth()+1,day: date.getUTCDate()}};
};
const stock = (ctx: {provinces: Province[]},id = 'food' as GoodId) => ctx.provinces.reduce((sum,p) => sum+p.market!.goods[id].stock,0);
const gold = (ctx: {countries: Country[]}) => ctx.countries.reduce((sum,c) => sum+c.resources.gold,0);
const run = (ctx: InternationalTradeContext) => ({...ctx,...processInternationalTrade(ctx)});

describe('Economy V2.1 national market', () => {
  it('aggregates production, consumption, demand, stock and balance without moving stock', () => {
    const ctx = world([province('a','A',80,2,1),province('a2','A',100,3,2),province('b','B',0)]);
    ctx.provinces[1].market!.goods.food.production = 5;
    const before = structuredClone(ctx),national = aggregateNationalMarket(ctx.countries[0],ctx.provinces).goods.food;
    expect(national).toMatchObject({nationalProduction: 7,nationalConsumption: 3,demand: 5,stock: 180,nationalBalance: 4,strategicReserve: 150,exportable: 28,importNeed: 0});
    expect(ctx).toEqual(before);
  });
  it('weights national prices by demand, then stock, with a safe empty fallback', () => {
    const ctx = world([province('a','A',80,2),province('a2','A',100,6)]);
    ctx.provinces[0].market!.goods.food.price = 1; ctx.provinces[1].market!.goods.food.price = 3;
    expect(aggregateNationalMarket(ctx.countries[0],ctx.provinces).goods.food.price).toBe(2.5);
    for (const p of ctx.provinces) p.market!.goods.food.demand = 0;
    expect(aggregateNationalMarket(ctx.countries[0],ctx.provinces).goods.food.price).toBeCloseTo(380/180);
    expect(aggregateNationalMarket(ctx.countries[0],[]).goods.tools.price).toBe(8);
  });
  it('uses post-consumption availability without charging current demand twice', () => {
    const p = province('a','A',30,1,1);
    expect(strategicStockTarget(p.market!.goods.food)).toBe(30);
    expect(aggregateNationalMarket(country('A',[p]),[p]).goods.food).toMatchObject({exportable: 0,importNeed: 0});
  });
  it('defines dependency consistently, clamps it and handles no recorded consumption', () => {
    expect(calculateImportDependency(3,10)).toBe(.3);
    expect(calculateImportDependency(20,10)).toBe(1);
    expect(calculateImportDependency(0,0)).toBe(0);
    expect(calculateImportDependency(1,0)).toBe(1);
    expect(calculateImportDependency(-1,10)).toBe(0);
  });
});

describe('Economy V2.1 bilateral trade and automatic policy', () => {
  it('withdraws real provincial stock, delivers imports, pays gold and records tariff', () => {
    const ctx = world(),before = structuredClone(ctx),result = run(ctx);
    expect(result.transfers).toEqual([{from: 'A',to: 'B',good: 'food',amount: 31,price: 1,value: 31,tariff: 3.1}]);
    expect(result.provinces.map(p => p.market!.goods.food.stock)).toEqual([69,31]);
    expect(result.countries.map(c => c.resources.gold)).toEqual([10031,9969]);
    expect(gold(result)).toBe(gold(ctx)); expect(stock(result)).toBe(stock(ctx));
    expect(result.countries[1].trade!.goods.food).toMatchObject({imports: 31,importValue: 31,tariffRevenue: 3.1});
    expect(result.countries[0].trade!.goods.food).toMatchObject({exports: 31,exportValue: 31});
    expect(aggregateNationalMarket(result.countries[1],result.provinces).tradeBalance).toBe(-31);
    expect(ctx).toEqual(before);
  });
  it('does not export beyond surplus or below thirty days plus unmet current demand', () => {
    const ctx = world([province('a','A',40),province('b','B',0)]),result = run(ctx);
    expect(result.transfers[0].amount).toBe(9);
    expect(result.provinces[0].market!.goods.food.stock).toBe(31);
    for (const p of result.provinces) expect(p.market!.goods.food.stock).toBeGreaterThanOrEqual(0);
  });
  it('does not export goods needed by other domestic provinces', () => {
    const ctx = world([province('a','A',100),province('a2','A',0,10),province('b','B',0)]);
    expect(run(ctx).transfers).toHaveLength(0);
  });
  it('blocks exports while a disconnected domestic province cannot meet today’s needs', () => {
    const ctx = world([province('a','A',400),province('a2','A',0,1),province('b','B',0)]);
    expect(aggregateNationalMarket(ctx.countries[0],ctx.provinces).goods.food.exportable).toBe(0);
    expect(run(ctx).transfers).toHaveLength(0);
  });
  it('withdraws from the largest safe provincial surplus first', () => {
    const ctx = world([province('a','A',35),province('a2','A',100),province('b','B',0)]),result = run(ctx);
    expect(result.provinces[0].market!.goods.food.stock).toBe(35);
    expect(result.provinces[1].market!.goods.food.stock).toBe(69);
  });
  it('does not import without a genuine national need or sell and rebuy the same good', () => {
    const ctx = world([province('a','A',100),province('b','B',31)]);
    expect(run(ctx).transfers).toHaveLength(0);
    const traded = run(world());
    expect(run(onNextDay(traded)).transfers).toHaveLength(0);
  });
  it('trades Brazil–Argentina and Brazil–Chile directly, and blocks only the warring pair', () => {
    const ctx = world([province('bra','BRA',100),province('arg','ARG',0),province('chl','CHL',31)]);
    ctx.provinces[0].market!.goods.tools = {...ctx.provinces[0].market!.goods.food,stock: 0,price: 8};
    ctx.provinces[2].market!.goods.tools = {...ctx.provinces[2].market!.goods.food,stock: 100,price: 8};
    const peaceful = run(ctx);
    expect(peaceful.transfers.some(t => t.from === 'BRA' && t.to === 'ARG' && t.good === 'food')).toBe(true);
    expect(peaceful.transfers.some(t => t.from === 'CHL' && t.to === 'BRA' && t.good === 'tools')).toBe(true);
    const declared = declareWar(ctx,'BRA','ARG'); expect(declared.ok).toBe(true);
    const wartime = run({...ctx,relations: declared.relations,wars: declared.wars});
    expect(wartime.transfers.some(t => t.from === 'BRA' && t.to === 'ARG')).toBe(false);
    expect(wartime.transfers.some(t => t.from === 'CHL' && t.to === 'BRA')).toBe(true);
  });
  it.each([0,50,100])('preserves an importer treasury at or below the reserve (%s)', amount => {
    const ctx = world(); ctx.countries[1].resources.gold = amount;
    const result = run(ctx);
    expect(result.transfers).toHaveLength(0);
    expect(result.countries[1].resources.gold).toBe(amount);
  });
  it('scales buying by the gross gold budget and preserves the minimum treasury', () => {
    const ctx = world(); ctx.countries[1].resources.gold = B.minTreasuryReserve+11;
    const result = run(ctx);
    expect(result.transfers[0].amount).toBe(10);
    expect(result.countries[1].resources.gold).toBeCloseTo(101);
    expect(result.transfers[0].tariff).toBe(1);
  });
  it('shares a finite budget across all goods and does not recycle tariff receipts', () => {
    const ctx = world(); ctx.countries[1].resources.gold = 111;
    for (const p of ctx.provinces) p.market!.goods.tools = {...p.market!.goods.food,price: 8};
    const result = run(ctx);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0].good).toBe('food');
  });
  it('prioritizes the most severe shortages and meets all current demand before reserves', () => {
    const ctx = world([province('a','A',34),province('b','B',0,1),province('b2','B',0,2)]);
    const result = run(ctx);
    expect(result.provinces.slice(1).map(p => p.market!.goods.food.stock)).toEqual([1,2]);
    expect(result.provinces.slice(1).every(p => p.market!.goods.food.shortage === 0)).toBe(true);
    const limited = world([province('a','A',32),province('b','B',.5,1),province('b2','B',0,1)]);
    const starving = run(limited);
    expect(starving.provinces[1].market!.goods.food.stock).toBe(.5);
    expect(starving.provinces[2].market!.goods.food.stock).toBe(1);
  });
  it('respects provincial storage capacity without dropping excess imported goods', () => {
    const a = province('a','A',100),b = province('b','B',0,100);
    const ctx = world([a,b]),result = run(ctx);
    expect(result.provinces[1].market!.goods.food.stock).toBeLessThanOrEqual(getStorageCapacity(b));
    expect(stock(result)).toBe(stock(ctx));
  });
  it('matches deterministically independent of input order and conserves decimal volumes', () => {
    const ctx = world([province('a','A',61.33),province('c','C',61.47),province('b','B',.07),province('d','D',.09)]);
    const original = run(ctx),reversed = run({...ctx,countries: [...ctx.countries].reverse(),provinces: [...ctx.provinces].reverse()});
    expect(reversed.transfers).toEqual(original.transfers);
    expect([...reversed.provinces].sort((a,b) => a.id.localeCompare(b.id))).toEqual([...original.provinces].sort((a,b) => a.id.localeCompare(b.id)));
    expect([...reversed.countries].sort((a,b) => a.tag.localeCompare(b.tag))).toEqual([...original.countries].sort((a,b) => a.tag.localeCompare(b.tag)));
    expect(stock(original)).toBeCloseTo(stock(ctx),10);
    expect(gold(original)).toBeCloseTo(gold(ctx),10);
    for (const c of original.countries) expect(c.resources.gold).toBeGreaterThanOrEqual(B.minTreasuryReserve);
  });
  it('does not transfer or reset metrics a second time on the same day', () => {
    const ctx = run(world()),repeated = run(ctx);
    expect(repeated.transfers).toHaveLength(0);
    expect(repeated.countries).toEqual(ctx.countries);
    expect(repeated.provinces).toEqual(ctx.provinces);
  });
  it('recalculates local price, shortage and purchasing power using the provincial formula', () => {
    const ctx = world(),result = run(ctx),g = result.provinces[1].market!.goods.food;
    expect(g.shortage).toBe(0);
    expect(g.price).toBe(calculateLocalPrice('food',g.consumption+g.stock,g.demand));
    expect(g.price).toBeLessThan(ctx.provinces[1].market!.goods.food.price);
    expect(result.provinces[1].market!.purchasingPower).toBeGreaterThan(0);
    expect(g.imported).toBe(0); // domestic flow metrics are not overwritten
  });
  it('uses bilateral average prices with commodity-specific clamps', () => {
    expect(calculateBilateralPrice('iron',4,8)).toBe(6);
    expect(calculateBilateralPrice('tools',0,0)).toBe(4);
    expect(calculateBilateralPrice('tools',1000,2000)).toBe(24);
    expect(calculateBilateralPrice('food',NaN,Infinity)).toBe(1);
  });
  it('enforces volume and relevant deficit thresholds without creating tiny trades', () => {
    expect(run(world([province('a','A',31.5),province('b','B',0)])).transfers).toHaveLength(0);
    expect(run(world([province('a','A',100),province('b','B',30.5)])).transfers).toHaveLength(0);
  });
});

describe('Economy V2.1 diplomacy, annexation and rebellion boundaries', () => {
  it('allows distant peaceful countries without any agreement, including low opinion', () => {
    const ctx = world(); ctx.relations = [{...createRelation('A','B'),opinion: -100}];
    expect(canCountriesTrade(ctx.countries[0],ctx.countries[1],ctx)).toBe(true);
    expect(run(ctx).transfers).toHaveLength(1);
  });
  it.each(['relations','wars'] as const)('blocks wartime transfers using %s', source => {
    const ctx = world();
    if (source === 'relations') ctx.relations = [{...createRelation('A','B'),status: 'war'}];
    else ctx.wars = [{id: 'w',attacker: 'B',defender: 'A',startDate: ctx.date,warScore: 0,attackerCasualties: 0,defenderCasualties: 0,occupiedByAttacker: [],occupiedByDefender: []}];
    expect(run(ctx).transfers).toHaveLength(0);
  });
  it('stops new trade immediately after a real Diplomacy V2 war declaration', () => {
    const ctx = world(),peaceful = run(ctx);
    expect(peaceful.transfers).toHaveLength(1);
    const declared = declareWar(ctx,'A','B'); expect(declared.ok).toBe(true);
    expect(run({...ctx,relations: declared.relations,wars: declared.wars}).transfers).toHaveLength(0);
  });
  it.each(['annexed','rebel','landless','missing'] as const)('excludes %s countries and preserves actual stocks', state => {
    const ctx = world();
    if (state === 'annexed') ctx.countries[0].isAnnexed = true;
    if (state === 'rebel') { ctx.countries[0].tag = 'rebel_A'; ctx.provinces[0].owner = 'rebel_A'; }
    if (state === 'landless') ctx.countries[0].provinces = [];
    if (state === 'missing') ctx.countries = ctx.countries.slice(1);
    const result = run(ctx);
    expect(result.transfers).toHaveLength(0);
    expect(stock(result)).toBe(stock(ctx));
  });
  it('keeps stocks in transferred provinces, cleans annexed metrics and allows restoration', () => {
    const ctx = run(world());
    ctx.countries[0].isAnnexed = true; ctx.countries[0].provinces = [];
    ctx.provinces[0].owner = 'B'; ctx.countries[1].provinces.push('a');
    const after = run(onNextDay(ctx));
    expect(stock(after)).toBe(stock(ctx));
    expect(after.countries[0].trade!.partners).toHaveLength(0);
    ctx.provinces[0].owner = 'A'; ctx.countries[0].isAnnexed = false; ctx.countries[0].provinces = ['a'];
    ctx.provinces[1].market!.goods.food.stock = 0;
    expect(run(onNextDay(ctx)).transfers).toHaveLength(1);
  });
});

describe('Economy V2.1 integration and saves', () => {
  beforeEach(() => localStorage.clear());
  function save(ctx: InternationalTradeContext) {
    saveGame({dateRef: {current: ctx.date},countriesRef: {current: ctx.countries},provincesRef: {current: ctx.provinces},armiesRef: {current: []},warsRef: {current: ctx.wars},diplomaticRelationsRef: {current: ctx.relations},
      recruitmentsRef: {current: []},buildingConstructionsRef: {current: []},activeBattlesRef: {current: []},playerTechStateRef: {current: createInitialTechState('B')},botTechStatesRef: {current: new Map()}},'economy-v2-1');
    return loadGame('economy-v2-1')!;
  }
  it('persists tariffs, non-derivable flows, partners and tick idempotency through save/load', () => {
    const ctx = world(); ctx.countries[1].trade = normalizeNationalTrade({tariffRate: .25});
    const result = run(ctx),loaded = save(result);
    expect(loaded.world.countries.map(c => c.trade)).toEqual(result.countries.map(c => c.trade));
    const restored = {...ctx,countries: loaded.world.countries,provinces: loaded.world.provinces};
    expect(run(restored).transfers).toHaveLength(0);
    expect(aggregateNationalMarket(restored.countries[1],restored.provinces).tradeBalance).toBe(-31);
    expect(JSON.stringify(loaded.world.countries)).not.toContain('nationalProduction');
  });
  it('migrates existing V2 saves with defaults without changing stocks or gold', () => {
    const ctx = world(),loaded = save(ctx);
    expect(loaded.world.countries[0].trade).toEqual(normalizeNationalTrade());
    expect(stock(loaded.world)).toBe(stock(ctx)); expect(gold(loaded.world)).toBe(gold(ctx));
  });
  it('migrates V1 countries with default tariffs without replacing provincial markets', () => {
    const ctx = world();
    localStorage.setItem('imperium_save_legacy-economy',JSON.stringify({id: 'legacy-economy',name: 'Legacy',timestamp: 1,date: ctx.date,
      provinces: ctx.provinces,countries: ctx.countries,armies: [],wars: [],relations: [],recruitments: [],constructions: [],
      playerTech: createInitialTechState('B'),botTechs: {},activeBattles: []}));
    const loaded = loadGame('legacy-economy')!;
    expect(loaded.world.countries.map(c => c.trade!.tariffRate)).toEqual([.1,.1]);
    expect(stock(loaded.world)).toBe(stock(ctx));
    expect(gold(loaded.world)).toBe(gold(ctx));
    expect(loaded.world.provinces[0].market).toEqual(ctx.provinces[0].market);
  });
  it('normalizes malformed trade fields and clamps saved tariffs safely', () => {
    expect(normalizeTariffRate(-1)).toBe(0); expect(normalizeTariffRate(4)).toBe(.5);
    expect(normalizeTariffRate(NaN)).toBe(.1); expect(normalizeTariffRate('bad')).toBe(.1);
    const normalized = normalizeNationalTrade({tariffRate: Infinity,lastTradeDay: NaN,goods: {food: {imports: -5,exports: NaN,importValue: 'bad'}},partners: [{tag: 'A',good: 'bad'},null]});
    expect(normalized).toEqual(normalizeNationalTrade());
  });
  it('keeps the existing standalone daily tick equivalent to prepare + finalize', () => {
    const ctx = world(),c = ctx.countries[0],ps = [ctx.provinces[0]];
    expect(processDailyTick(c,prepareCountryMarkets(c,ps),undefined,false,true)).toEqual(processDailyTick(c,ps));
  });
  it('imports before demographics and improves same-day satisfaction without double production', () => {
    const ctx = world([province('a','A',700),province('b','B',0)]);
    const c = ctx.countries[1],baseline = processDailyTick(c,[ctx.provinces[1]]);
    const result = processEconomyTick({countries: ctx.countries,provinces: ctx.provinces,recruitments: [],armies: [],buildingConstructions: [],wars: [],relations: [],playerCountryTag: 'B',date: ctx.date,allCountries: ctx.countries,
      playerTechState: createInitialTechState('B'),botTechStates: new Map(),addToast: vi.fn(),addAILog: vi.fn(),addLog: vi.fn(),formatGameDate: () => 'test'});
    const imported = result.provinces.find(p => p.id === 'b')!;
    expect(result.countries[1].trade!.goods.food.imports).toBeGreaterThan(0);
    expect(imported.market!.goods.food.shortage).toBe(0);
    expect(imported.population.satisfaction).toBeGreaterThan(baseline.provinces[0].population.satisfaction);
    expect(imported.market!.goods.food.production).toBe(baseline.provinces[0].market!.goods.food.production);
    expect(imported.population.foodShortageDays).toBe(0);
  });
  it('runs 180 days on the actual South America economy and stops Brazil/Argentina trade at war', () => {
    let ctx: InternationalTradeContext = {countries: structuredClone(mapCountries),provinces: structuredClone(provincesData),wars: [],relations: [],date: {year: 1444,month: 11,day: 11}};
    let importedVolume = 0,tradeValue = 0;
    const tech = new Map(ctx.countries.map(c => [c.tag,createInitialTechState(c.tag)]));
    for (let day = 0; day < 180; day++) {
      if (day === 60) {
        const declared = declareWar(ctx,'BRA','ARG'); expect(declared.ok).toBe(true);
        ctx = {...ctx,relations: declared.relations,wars: declared.wars};
      }
      const tick = processEconomyTick({countries: ctx.countries,provinces: ctx.provinces,recruitments: [],armies: [],buildingConstructions: [],wars: ctx.wars,relations: ctx.relations,playerCountryTag: 'BRA',date: ctx.date,allCountries: ctx.countries,
        playerTechState: tech.get('BRA')!,botTechStates: tech,addToast: vi.fn(),addAILog: vi.fn(),addLog: vi.fn(),formatGameDate: () => 'simulation'});
      ctx = {...ctx,countries: tick.countries,provinces: tick.provinces};
      for (const id of ALL_GOODS) {
        const imports = ctx.countries.reduce((sum,c) => sum+c.trade!.goods[id].imports,0);
        const exports = ctx.countries.reduce((sum,c) => sum+c.trade!.goods[id].exports,0);
        expect(imports).toBeCloseTo(exports,8);
        importedVolume += imports;
      }
      for (const c of ctx.countries) {
        expect(c.resources.gold).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(c.resources.gold)).toBe(true);
        tradeValue += aggregateNationalMarket(c,ctx.provinces).importValue;
        if (day >= 60 && ['BRA','ARG'].includes(c.tag)) expect(c.trade!.partners.some(p => p.tag === (c.tag === 'BRA' ? 'ARG' : 'BRA'))).toBe(false);
      }
      for (const p of ctx.provinces) for (const id of ALL_GOODS) {
        expect(Number.isFinite(p.market!.goods[id].stock)).toBe(true);
        expect(p.market!.goods[id].stock).toBeGreaterThanOrEqual(0);
        expect(p.market!.goods[id].price).toBeGreaterThanOrEqual(.5*({food: 1,wood: 2,iron: 4,tools: 8}[id]));
      }
      ctx = onNextDay(ctx);
    }
    expect(importedVolume).toBeGreaterThan(0);
    expect(tradeValue).toBeGreaterThan(0);
    console.info(`Economy V2.1 audit: 180 days, ${importedVolume.toFixed(2)} goods traded, ${tradeValue.toFixed(2)} gold; BRA/ARG at war since day 60.`);
  });
});
