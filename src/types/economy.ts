import type { GoodId } from './province';

/** External flows from the latest completed trade tick, not domestic trade. */
export interface TradeGoodMetrics {
  imports: number;
  exports: number;
  importValue: number;
  exportValue: number;
  tariffRevenue: number;
}
export interface TradePartner extends TradeGoodMetrics {
  tag: string;
  good: GoodId;
}
export interface NationalTradeState {
  tariffRate: number;
  lastTradeDay?: number;
  goods: Record<GoodId, TradeGoodMetrics>;
  partners: TradePartner[];
}
