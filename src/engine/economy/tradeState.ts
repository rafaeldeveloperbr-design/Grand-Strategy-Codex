import type { NationalTradeState, TradeGoodMetrics, TradePartner } from '../../types/economy';
import { ALL_GOODS } from '../market';
import { ECONOMY_V2_BALANCE as B } from './balance';

const object = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
const finite = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
export const normalizeTariffRate = (value: unknown): number => Math.max(0, Math.min(B.maxTariffRate, finite(value, B.defaultTariffRate)));
export const emptyTradeMetrics = (): TradeGoodMetrics => ({imports: 0,exports: 0,importValue: 0,exportValue: 0,tariffRevenue: 0});
const normalizeMetrics = (value: unknown): TradeGoodMetrics => {
  const raw = object(value);
  return Object.fromEntries(Object.keys(emptyTradeMetrics()).map(key => [key, Math.max(0, finite(raw[key]))])) as unknown as TradeGoodMetrics;
};
/** Optional country field makes V1/V2 saves compatible without a new save version. */
export function normalizeNationalTrade(value?: unknown): NationalTradeState {
  const raw = object(value),goods = object(raw.goods);
  const partners: TradePartner[] = (Array.isArray(raw.partners) ? raw.partners : []).flatMap(value => {
    const p = object(value);
    if (typeof p.tag !== 'string' || !ALL_GOODS.includes(p.good as TradePartner['good'])) return [];
    return [{tag: p.tag,good: p.good as TradePartner['good'],...normalizeMetrics(p)}];
  });
  return {
    tariffRate: normalizeTariffRate(raw.tariffRate),
    ...(typeof raw.lastTradeDay === 'number' && Number.isFinite(raw.lastTradeDay) ? {lastTradeDay: Math.trunc(raw.lastTradeDay)} : {}),
    goods: Object.fromEntries(ALL_GOODS.map(id => [id, normalizeMetrics(goods[id])])) as NationalTradeState['goods'],
    partners,
  };
}
