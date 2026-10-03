import type { Province } from '../../types';
import { ALL_GOODS, GOODS, normalizeMarket } from '../../engine/market';
import { getFoodShortageStatus, normalizePopulation } from '../../engine/population';
import { POPULATION_BALANCE } from '../../engine/population';

export function ProvinceMarketSection({ province }: { province: Province }) {
  const market = normalizeMarket(province.market);
  const population = normalizePopulation(province.population);
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
        const foodStatus = id === 'food'
          ? getFoodShortageStatus(state, population.foodShortageDays, population.severeFoodShortageDays)
          : undefined;
        const displayedDays = foodStatus?.severity === 'severe'
          ? foodStatus.severeConsecutiveDays : foodStatus?.consecutiveDays ?? 0;

        const moderatePercent =
          Math.round(POPULATION_BALANCE.MODERATE_SHORTAGE * 100);

        const recoveryPercent =
          Math.round(POPULATION_BALANCE.SEVERE_SHORTAGE_RECOVERY * 100);

        const foodTooltip = foodStatus
          ? [
            `Situação alimentar`,
            `Déficit atual: ${foodStatus.percent}%`,
            '',
            `Escassez começa em ${moderatePercent}% de déficit.`,
            `Fome severa exige uma crise persistente.`,
            `Após estabelecida, a fome continua até o déficit cair abaixo de ${recoveryPercent}%.`,
            '',
            `A fome reduz crescimento, satisfação e atratividade migratória.`,
            '',
            `Aumente a produção de FOOD, construa Fazendas ou melhore o abastecimento para recuperar a província.`,
          ].join('\n')
          : undefined;
        const shortageLabel = foodStatus?.severity === 'severe'
          ? ` 🔴 Fome severa ${foodStatus.percent}%${displayedDays > 0 ? ` · ${displayedDays} dias` : ''}`
          : foodStatus?.severity === 'moderate'
            ? ` ⚠️ Escassez ${foodStatus.percent}%${foodStatus.consecutiveDays > 0 ? ` · ${foodStatus.consecutiveDays} dias` : ''}`
            : foodStatus && foodStatus.ratio > 0 ? ` ⚠️ Déficit ${foodStatus.percent}%` : ' · Normal';
        return (
          <div className="province-panel__info-row" key={id} style={{ fontSize: '11px' }}>
            <span className="province-panel__label">{good.name}</span>

            <span
              className="province-panel__value"
              title={id === 'food' ? foodTooltip : undefined}
              style={{ cursor: id === 'food' ? 'help' : undefined }}
            >
              {state.stock.toFixed(1)} | +{state.production.toFixed(1)} | {state.demand.toFixed(1)} | {state.imported.toFixed(1)} | {state.exported.toFixed(1)} | {state.price.toFixed(2)}¤
              {shortageLabel}
              {source
                ? ` · ${sourceType === 'farm'
                  ? 'Fazenda'
                  : sourceType === 'lumber_mill'
                    ? 'Serraria'
                    : sourceType === 'iron_mine'
                      ? 'Mina de Ferro'
                      : 'Oficina'
                } Nv.${source.level}`
                : id === 'food'
                  ? ' · Subsistência'
                  : ''}
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
