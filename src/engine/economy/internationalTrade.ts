import type { Country, DiplomaticRelation, GameDate, GoodId, Province, War } from '../../types';
import type { TradeGoodMetrics } from '../../types/economy';
import { areAtWar, diplomacyDay, isDiplomaticCountry } from '../diplomacy';
import { indexRelations, relationKey } from '../diplomacy/diplomacyRelations';
import { ALL_GOODS, GOODS, getStorageCapacity, normalizeMarket, refreshProvinceMarket } from '../market';
import { calculateLawModifiers } from '../government';
import { ECONOMY_V2_BALANCE as B } from './balance';
import { aggregateNationalMarket, strategicStockTarget } from './nationalMarket';
import { emptyTradeMetrics, normalizeNationalTrade } from './tradeState';

export interface InternationalTradeContext {
  countries: Country[];
  provinces: Province[];
  relations: DiplomaticRelation[];
  wars: War[];
  date: GameDate;
}
export interface BilateralTransfer {
  from: string; to: string; good: GoodId;
  amount: number; price: number; value: number; tariff: number;
}
/** One eligibility boundary for future optional diplomatic trade policies. */
export function canCountriesTrade(from: Country, to: Country, ctx: InternationalTradeContext): boolean {
  return from.tag !== to.tag && isDiplomaticCountry(from) && isDiplomaticCountry(to)
    && ctx.countries.some(c => c.tag === from.tag) && ctx.countries.some(c => c.tag === to.tag)
    && ctx.provinces.some(p => p.owner === from.tag) && ctx.provinces.some(p => p.owner === to.tag)
    && !areAtWar(ctx.relations,from.tag,to.tag)
    && !ctx.wars.some(w => w.attacker === from.tag && w.defender === to.tag || w.attacker === to.tag && w.defender === from.tag);
}
export function calculateBilateralPrice(id: GoodId, exporterPrice: number, importerPrice: number): number {
  const average = (exporterPrice+importerPrice)/2;
  const base = GOODS[id].basePrice;
  return Math.max(base*B.priceMinMultiplier,Math.min(base*B.priceMaxMultiplier,Number.isFinite(average) ? average : base));
}
const units = (amount: number): number => Math.max(0,Math.floor(amount*B.volumePrecision+B.volumeEpsilon));
const volume = (amount: number): number => units(amount)/B.volumePrecision;
const shortageRatio = (p: Province,id: GoodId): number => {
  const g = p.market!.goods[id];
  return g.demand > 0 ? Math.max(0,g.demand-g.consumption-g.stock)/g.demand : 0;
};
const surplus = (p: Province,id: GoodId): number => volume(Math.max(0,p.market!.goods[id].stock-strategicStockTarget(p.market!.goods[id])));
const deficit = (p: Province,id: GoodId): number => {
  const g = p.market!.goods[id];
  return volume(Math.max(0,Math.min(strategicStockTarget(g),getStorageCapacity(p))-g.stock));
};
const sourceOrder = (ps: Province[],id: GoodId): Province[] => [...ps].sort((a,b) => surplus(b,id)-surplus(a,id) || a.id.localeCompare(b.id));
const destinationOrder = (ps: Province[],id: GoodId): Province[] => [...ps].sort((a,b) => shortageRatio(b,id)-shortageRatio(a,id) || deficit(b,id)-deficit(a,id) || a.id.localeCompare(b.id));

function record(country: Country, partner: string, id: GoodId, metrics: TradeGoodMetrics) {
  const trade = country.trade!;
  const add = (target: TradeGoodMetrics) => {
    for (const key of Object.keys(metrics) as (keyof TradeGoodMetrics)[]) target[key] += metrics[key];
  };
  add(trade.goods[id]);
  let row = trade.partners.find(p => p.tag === partner && p.good === id);
  if (!row) { row = {tag: partner,good: id,...emptyTradeMetrics()}; trade.partners.push(row); }
  add(row);
}

/** Deterministic automatic policy for AI and player: buy actual needs, sell only
 * protected surplus, with a finite gross budget. No standing orders/contracts. */
export function processInternationalTrade(ctx: InternationalTradeContext) {
  const day = diplomacyDay(ctx.date),transfers: BilateralTransfer[] = [];
  const countries = ctx.countries.map(c => ({...c,resources: {...c.resources},trade: normalizeNationalTrade(c.trade)}));
  const valid = countries.filter(c => isDiplomaticCountry(c) && ctx.provinces.some(p => p.owner === c.tag));
  const validTags = new Set(valid.map(c => c.tag));
  for (const c of countries.filter(c => !validTags.has(c.tag))) c.trade = normalizeNationalTrade({tariffRate: c.trade!.tariffRate});
  if (day%B.tradeTickInterval !== 0 || valid.every(c => c.trade!.lastTradeDay === day)) return {countries,provinces: ctx.provinces,transfers};
  const participants = valid.filter(c => c.trade!.lastTradeDay !== day).sort((a,b) => a.tag.localeCompare(b.tag));
  // Per-tick lookup; still delegates eligibility to the canonical validator.
  const relationIndex = indexRelations(ctx.relations);
  const provinces = ctx.provinces.map(p => validTags.has(p.owner) ? {...p,market: normalizeMarket(p.market)} : p);
  const owned = new Map(participants.map(c => [c.tag,provinces.filter(p => p.owner === c.tag).sort((a,b) => a.id.localeCompare(b.id))]));
  const markets = new Map(participants.map(c => [c.tag,aggregateNationalMarket(c,owned.get(c.tag)!)]));
  const budgets = new Map(participants.map(c => [c.tag,Math.max(0,c.resources.gold-B.minTreasuryReserve)]));
  for (const c of participants) c.trade = normalizeNationalTrade({tariffRate: c.trade!.tariffRate,lastTradeDay: day});
  const touched = new Set<string>();

  // FOOD first, followed by the existing commodity order; no randomness.
  for (const id of ALL_GOODS) {
    const importers = participants.filter(c => markets.get(c.tag)!.goods[id].importNeed >= B.minimumImportNeed)
      .sort((a,b) => {
        const x = markets.get(a.tag)!.goods[id],y = markets.get(b.tag)!.goods[id];
        return (y.demand ? y.shortage/y.demand : 0)-(x.demand ? x.shortage/x.demand : 0) || y.importNeed-x.importNeed || a.tag.localeCompare(b.tag);
      });
    const exporters = participants.filter(c => markets.get(c.tag)!.goods[id].exportable >= B.minimumTradeVolume)
      .sort((a,b) => markets.get(a.tag)!.goods[id].price-markets.get(b.tag)!.goods[id].price
        || markets.get(b.tag)!.goods[id].exportable-markets.get(a.tag)!.goods[id].exportable || a.tag.localeCompare(b.tag));
    for (const importer of importers) for (const exporter of exporters) {
      if (!canCountriesTrade(exporter,importer,{...ctx,relations:relationIndex.get(relationKey(exporter.tag,importer.tag)) ?? []})) continue;
      const supply = markets.get(exporter.tag)!.goods[id],need = markets.get(importer.tag)!.goods[id];
      const sources = sourceOrder(owned.get(exporter.tag)!,id),destinations = destinationOrder(owned.get(importer.tag)!,id);
      const price = calculateBilateralPrice(id,supply.price,need.price),tariffRate = importer.trade!.tariffRate;
      const amount = volume(Math.min(supply.exportable,need.importNeed,
        sources.reduce((sum,p) => sum+surplus(p,id),0),destinations.reduce((sum,p) => sum+deficit(p,id),0),
        budgets.get(importer.tag)!/(price*(1+tariffRate))));
      if (amount < B.minimumTradeVolume) continue;
      let remaining = units(amount);
      for (const p of sources) {
        const take = Math.min(remaining,units(surplus(p,id)));
        if (take > 0) { p.market!.goods[id].stock -= take/B.volumePrecision; touched.add(p.id); remaining -= take; }
        if (remaining === 0) break;
      }
      remaining = units(amount);
      // Meet today's unmet demand everywhere before building future reserves.
      for (const currentNeedsOnly of [true,false]) for (const p of destinations) {
        const g = p.market!.goods[id];
        const wanted = currentNeedsOnly ? Math.min(deficit(p,id),Math.max(0,g.demand-g.consumption-g.stock)) : deficit(p,id);
        const added = Math.min(remaining,units(wanted));
        if (added > 0) { g.stock += added/B.volumePrecision; touched.add(p.id); remaining -= added; }
        if (remaining === 0) break;
      }
      const value = amount*price,tariff = value*tariffRate,gross = value+tariff;
      // Gross debit + domestic tariff receipt: net importer cost is trade value.
      // The gross budget still reserves tariff funding and cannot be recycled.
      importer.resources.gold = importer.resources.gold-gross+tariff;
      exporter.resources.gold += value;
      budgets.set(importer.tag,Math.max(0,budgets.get(importer.tag)!-gross));
      supply.exportable = Math.max(0,supply.exportable-amount); need.importNeed = Math.max(0,need.importNeed-amount);
      record(importer,exporter.tag,id,{imports: amount,exports: 0,importValue: value,exportValue: 0,tariffRevenue: tariff});
      record(exporter,importer.tag,id,{imports: 0,exports: amount,importValue: 0,exportValue: value,tariffRevenue: 0});
      transfers.push({from: exporter.tag,to: importer.tag,good: id,amount,price,value,tariff});
    }
  }
  for (const p of provinces.filter(p => touched.has(p.id))) {
    const country = countries.find(c => c.tag === p.owner)!;
    p.market = refreshProvinceMarket(p,calculateLawModifiers(country.activeLaws).purchasingPowerMultiplier);
  }
  for (const c of participants) c.trade!.partners.sort((a,b) => b.importValue+b.exportValue-a.importValue-a.exportValue || a.tag.localeCompare(b.tag) || a.good.localeCompare(b.good));
  return {countries,provinces,transfers};
}
