import type { Country, GoodId, GoodMarketState, Province } from '../../types';
import type { TradeGoodMetrics } from '../../types/economy';
import { ALL_GOODS, GOODS, normalizeMarket } from '../market';
import { ECONOMY_V2_BALANCE as B } from './balance';
import { normalizeNationalTrade } from './tradeState';

export interface NationalGoodMarket extends TradeGoodMetrics {
  nationalProduction: number;
  nationalConsumption: number;
  stock: number;
  demand: number;
  shortage: number;
  nationalBalance: number;
  strategicReserve: number;
  exportable: number;
  importNeed: number;
  price: number;
  dependency: number;
}
export interface NationalMarket {
  tag: string;
  goods: Record<GoodId, NationalGoodMarket>;
  importValue: number;
  exportValue: number;
  tariffRevenue: number;
  tradeBalance: number;
}
/** Markets are post-consumption: protect unmet current demand plus 30 future days. */
export function strategicStockTarget(good: GoodMarketState): number {
  return good.demand * B.strategicReserveDays + Math.max(0, good.demand - good.consumption);
}
export function calculateImportDependency(imports: number, consumption: number): number {
  if (imports <= 0) return 0;
  return consumption > 0 ? Math.min(1, Math.max(0, imports / consumption)) : 1;
}
/** Pure national view; no virtual inventory, caches or derived save fields. */
export function aggregateNationalMarket(country: Country, provinces: Province[]): NationalMarket {
  const markets = provinces.filter(p => p.owner === country.tag).sort((a,b) => a.id.localeCompare(b.id)).map(p => normalizeMarket(p.market));
  const trade = normalizeNationalTrade(country.trade);
  const goods = Object.fromEntries(ALL_GOODS.map(id => {
    const local = markets.map(m => m.goods[id]);
    const sum = (field: 'stock' | 'production' | 'consumption' | 'demand' | 'shortage') => local.reduce((total,g) => total+g[field],0);
    const stock = sum('stock'),demand = sum('demand'),consumption = sum('consumption');
    const target = local.reduce((total,g) => total+strategicStockTarget(g),0);
    // Weight by demand; unused commodities use stock, then a simple mean.
    const stockWeight = stock > 0;
    const weight = (g: GoodMarketState) => demand > 0 ? g.demand : stockWeight ? g.stock : 1;
    const denominator = local.reduce((total,g) => total+weight(g),0);
    const price = denominator > 0 ? local.reduce((total,g) => total+g.price*weight(g),0)/denominator : GOODS[id].basePrice;
    const domesticShortage = local.some(g => g.consumption+g.stock < g.demand);
    return [id, {...trade.goods[id],nationalProduction: sum('production'),nationalConsumption: consumption,stock,demand,shortage: sum('shortage'),
      nationalBalance: sum('production')-consumption,strategicReserve: demand*B.strategicReserveDays,
      exportable: domesticShortage ? 0 : Math.max(0,stock-target),importNeed: Math.max(0,target-stock),price,
      dependency: calculateImportDependency(trade.goods[id].imports,consumption)}];
  })) as Record<GoodId, NationalGoodMarket>;
  const importValue = ALL_GOODS.reduce((sum,id) => sum+goods[id].importValue,0);
  const exportValue = ALL_GOODS.reduce((sum,id) => sum+goods[id].exportValue,0);
  return {tag: country.tag,goods,importValue,exportValue,tariffRevenue: ALL_GOODS.reduce((sum,id) => sum+goods[id].tariffRevenue,0),tradeBalance: exportValue-importValue};
}
