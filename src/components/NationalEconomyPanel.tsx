import React, { useEffect, useRef } from 'react';
import type { Country, Province } from '../types';
import { ALL_GOODS } from '../engine/market';
import { aggregateNationalMarket } from '../engine/economy/nationalMarket';
import { normalizeNationalTrade } from '../engine/economy/tradeState';
import { ECONOMY_V2_BALANCE as B } from '../engine/economy/balance';
import { getGoodName } from '../utils/translations';


interface Props {
  country: Country;
  countries: Country[];
  provinces: Province[];
  onTariffChange: (rate: number) => void;
  onClose: () => void;
}
const number = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const signed = (value: number) => `${value >= 0 ? '+' : ''}${number(value)}`;

export function NationalEconomyPanel({ country, countries, provinces, onTariffChange, onClose }: Props) {
  const market = aggregateNationalMarket(country, provinces), trade = normalizeNationalTrade(country.trade);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  const partnerName = (tag: string) => countries.find(c => c.tag === tag)?.name ?? tag;
  const imports = trade.partners.filter(p => p.imports > 0).sort((a, b) => b.importValue - a.importValue || a.tag.localeCompare(b.tag) || a.good.localeCompare(b.good)).slice(0, B.displayedPartners);
  const exports = trade.partners.filter(p => p.exports > 0).sort((a, b) => b.exportValue - a.exportValue || a.tag.localeCompare(b.tag) || a.good.localeCompare(b.good)).slice(0, B.displayedPartners);
  return <div className="national-economy-overlay">
    <section className="national-economy" role="dialog" aria-modal="true" aria-labelledby="national-economy-title">
      <header className="national-economy__header">
        <div><h2 id="national-economy-title">Economia nacional · {country.name}</h2><p>COMÉRCIO</p></div>
        <button ref={closeRef} onClick={onClose} aria-label="Fechar economia nacional">✕</button>
      </header>
      <div className="national-economy__content">
        <div className="national-economy__totals">
          <div><span>Importações totais</span><strong>{number(market.importValue)} ouro</strong></div>
          <div><span>Exportações totais</span><strong>{number(market.exportValue)} ouro</strong></div>
          <div><span>Saldo comercial · {market.tradeBalance >= 0 ? 'Superávit' : 'Déficit comercial'}</span><strong className={market.tradeBalance >= 0 ? 'national-economy__positive' : 'national-economy__negative'}>{signed(market.tradeBalance)} ouro</strong></div>
          <div><span>Receita tarifária</span><strong>{number(market.tariffRevenue)} ouro</strong></div>
        </div>
        <label className="national-economy__tariff">Tarifa atual: {Math.round(trade.tariffRate * 100)}%
          <input aria-label="Tarifa nacional" type="range" min="0" max={B.maxTariffRate * 100} step="1" value={Math.round(trade.tariffRate * 100)} onChange={event => onTariffChange(Number(event.target.value) / 100)} />
        </label>
        <p className="national-economy__note">Produção, consumo e demanda por dia. Importações, exportações e receita do último ciclo diário. Saldo produtivo = produção − consumo.</p>
        <div className="national-economy__table-wrap"><table>
          <caption>Mercado nacional e comércio por bem</caption>
          <thead><tr>{['Bem', 'Produção', 'Consumo', 'Demanda', 'Estoque', 'Saldo', 'Importado', 'Exportado', 'Dependência', 'Preço nacional'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{ALL_GOODS.map(id => {
            const g = market.goods[id];
            return <tr key={id}>
              <th scope="row" title={getGoodName(id)}>{getGoodName(id)}</th>
              <td>{number(g.nationalProduction)}</td><td>{number(g.nationalConsumption)}</td><td>{number(g.demand)}</td><td>{number(g.stock)}</td>
              <td className={g.nationalBalance >= 0 ? 'national-economy__positive' : 'national-economy__negative'}>{signed(g.nationalBalance)}</td>
              <td>{number(g.imports)}</td><td>{number(g.exports)}</td><td>{Math.round(g.dependency * 100)}%</td><td>{number(g.price)} ouro</td>
            </tr>;
          })}</tbody>
        </table></div>
        <p className="national-economy__note">Reserva estratégica: {B.strategicReserveDays} dias de demanda. Comércio automático preserva {B.minTreasuryReserve} ouro e só vende excedentes. A tarifa retorna ao próprio tesouro; o orçamento de compra considera valor + tarifa.</p>
        <p className="national-economy__note">Dependência compara importações e consumo do ciclo. Quando não há consumo registrado, importações são exibidas como 100%. Compras para reserva também entram neste indicador.</p>
        <div className="national-economy__partners">
          <section><h3>Principais importações</h3>{imports.length ? <ul>{imports.map(p => <li key={`${p.tag}:${p.good}`}>{getGoodName(p.good)} ← {partnerName(p.tag)} <span>{number(p.imports)} · {number(p.importValue)} ouro</span></li>)}</ul> : <p>Nenhuma importação neste ciclo.</p>}</section>
          <section><h3>Principais exportações</h3>{exports.length ? <ul>{exports.map(p => <li key={`${p.tag}:${p.good}`}>{getGoodName(p.good)} → {partnerName(p.tag)} <span>{number(p.exports)} · {number(p.exportValue)} ouro</span></li>)}</ul> : <p>Nenhuma exportação neste ciclo.</p>}</section>
        </div>
      </div>
    </section>
  </div>;
}
