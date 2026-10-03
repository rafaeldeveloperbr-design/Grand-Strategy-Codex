import type { Province } from '../../types';
import { ALL_GOODS, GOODS, normalizeMarket } from '../../engine/market';

export function ProvinceMarketSection({ province }: { province: Province }) {
  const market = normalizeMarket(province.market);
  return (
    <div className="province-panel__section">
      <h3 className="province-panel__subtitle">Mercado</h3>
      <div className="province-panel__info-row" style={{ fontSize: '10px', fontWeight: 700 }}>
        <span>Bem</span><span>Est. | Prod. | Dem. | Imp. | Exp. | Preço</span>
      </div>
      {ALL_GOODS.map(id => {
        const good = GOODS[id];
        const state = market.goods[id];
        const sourceType = id === 'food' ? 'farm' : id === 'wood' ? 'lumber_mill' : id === 'iron' ? 'iron_mine' : 'workshop';
        const source = province.buildings.find(building => building.type === sourceType && building.daysRemaining <= 0);
        return (
          <div className="province-panel__info-row" key={id} style={{ fontSize: '11px' }}>
            <span className="province-panel__label">{good.name}</span>
            <span className="province-panel__value">
              {state.stock.toFixed(1)} | +{state.production.toFixed(1)} | {state.demand.toFixed(1)} | {state.imported.toFixed(1)} | {state.exported.toFixed(1)} | {state.price.toFixed(2)}¤
              {state.shortage > 0 ? ' ⚠️' : ''}
              {source ? ` · ${sourceType === 'farm' ? 'Fazenda' : sourceType === 'lumber_mill' ? 'Serraria' : sourceType === 'iron_mine' ? 'Mina de Ferro' : 'Oficina'} Nv.${source.level}` : id === 'food' ? ' · Subsistência' : ''}
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
