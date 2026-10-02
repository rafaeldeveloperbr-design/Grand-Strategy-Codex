import type { Province } from '../../types';
import { ALL_GOODS, GOODS, normalizeMarket } from '../../engine/market';

export function ProvinceMarketSection({ province }: { province: Province }) {
  const market = normalizeMarket(province.market);
  return (
    <div className="province-panel__section">
      <h3 className="province-panel__subtitle">Mercado</h3>
      <div className="province-panel__info-row" style={{ fontSize: '10px', fontWeight: 700 }}>
        <span>Bem</span><span>Est. | Prod. | Dem. | Preço</span>
      </div>
      {ALL_GOODS.map(id => {
        const good = GOODS[id];
        const state = market.goods[id];
        return (
          <div className="province-panel__info-row" key={id} style={{ fontSize: '11px' }}>
            <span className="province-panel__label">{good.name}</span>
            <span className="province-panel__value">
              {state.stock.toFixed(1)} | +{state.production.toFixed(1)} | {state.demand.toFixed(1)} | {state.price.toFixed(2)}¤
              {state.shortage > 0 ? ' ⚠️' : ''}
            </span>
          </div>
        );
      })}
      <div className="province-panel__info-row" style={{ marginTop: '6px' }}>
        <span className="province-panel__label">Poder de compra:</span>
        <span className="province-panel__value">{market.purchasingPower.toFixed(1)}/100</span>
      </div>
    </div>
  );
}
