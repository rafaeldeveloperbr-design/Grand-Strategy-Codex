// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NationalEconomyPanel } from '../NationalEconomyPanel';
import { TopBar } from '../TopBar';
import { countries, provincesData } from '../../data/map';
import { createDefaultMarket } from '../../engine/market';
import { normalizeNationalTrade } from '../../engine/economy/tradeState';

afterEach(cleanup);
function fixture() {
  const province = {...structuredClone(provincesData[0]),owner: 'BRA',market: createDefaultMarket()};
  province.market.goods.food = {stock: 100,production: 9,consumption: 12,demand: 15,shortage: 0,price: 2,imported: 0,exported: 0};
  const country = {...structuredClone(countries[0]),tag: 'BRA',name: 'Brasil',provinces: [province.id],trade: normalizeNationalTrade({tariffRate: .1,
    goods: {food: {imports: 3,importValue: 6,tariffRevenue: .6},tools: {exports: 1,exportValue: 8}},
    partners: [{tag: 'CHL',good: 'food',imports: 3,importValue: 6},{tag: 'ARG',good: 'tools',exports: 1,exportValue: 8}]})};
  const partners = [{...country,tag: 'CHL',name: 'Chile'},{...country,tag: 'ARG',name: 'Argentina'}];
  return {country,countries: [country,...partners],provinces: [province],onClose: vi.fn(),onTariffChange: vi.fn()};
}
describe('Economy V2.1 national UI', () => {
  it('renders national goods, aggregate values and last-cycle external flows', () => {
    const props = fixture(); render(<NationalEconomyPanel {...props} />);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading',{name: 'Economia nacional · Brasil'})).toBeTruthy();
    expect(screen.getByRole('table').textContent).toContain('Mercado nacional e comércio por bem');
    const food = screen.getByRole('rowheader',{name: 'Alimentos'}).closest('tr')!;
    expect(within(food).getAllByRole('cell').map(cell => cell.textContent)).toEqual(['9,0','12,0','15,0','100,0','-3,0','3,0','0,0','25%','2,0 ouro']);
    expect(screen.getAllByRole('rowheader').map(cell => cell.textContent)).toEqual(['Alimentos','Madeira','Ferro','Ferramentas']);
    expect(screen.getByText('Importações totais').parentElement!.textContent).toBe('Importações totais6,0 ouro');
    expect(screen.getByText('Exportações totais').parentElement!.textContent).toBe('Exportações totais8,0 ouro');
    expect(screen.getByText('Saldo comercial · Superávit').parentElement!.textContent).toContain('+2,0 ouro');
    expect(screen.getByText('Receita tarifária').parentElement!.textContent).toContain('0,6 ouro');
    expect(screen.getByText(/Alimentos ← Chile/)).toBeTruthy();
    expect(screen.getByText(/Ferramentas → Argentina/)).toBeTruthy();
  });
  it('shows a trade deficit with its sign and allows tariff changes within 0..50%', () => {
    const props = fixture(); props.country.trade.goods.tools.exportValue = 0;
    render(<NationalEconomyPanel {...props} />);
    expect(screen.getByText('Saldo comercial · Déficit comercial').parentElement!.textContent).toContain('-6,0 ouro');
    const slider = screen.getByRole('slider',{name: 'Tarifa nacional'});
    expect(slider.getAttribute('max')).toBe('50'); expect(slider.getAttribute('min')).toBe('0');
    fireEvent.change(slider,{target: {value: '25'}});
    expect(props.onTariffChange).toHaveBeenCalledWith(.25);
  });
  it('renders legacy countries with empty flows and default tariff safely', () => {
    const props = fixture();
    render(<NationalEconomyPanel {...props} country={{...props.country,trade: undefined}} />);
    expect(screen.getByText('Tarifa atual: 10%')).toBeTruthy();
    expect(screen.getByText('Nenhuma importação neste ciclo.')).toBeTruthy();
    expect(screen.getByText('Nenhuma exportação neste ciclo.')).toBeTruthy();
    expect(screen.getByText('Saldo comercial · Superávit').parentElement!.textContent).toContain('+0,0 ouro');
  });
  it('supports the close button and Escape', () => {
    const props = fixture(); render(<NationalEconomyPanel {...props} />);
    const button = screen.getByRole('button',{name: 'Fechar economia nacional'});
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(document,{key: 'Escape'}); expect(props.onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(button); expect(props.onClose).toHaveBeenCalledTimes(2);
  });
  it('exposes the national trade entry in the top bar', () => {
    const props = fixture(),open = vi.fn();
    render(<TopBar playerCountry={props.country} date={{year: 1444,month: 11,day: 11}} gameSpeed={0} onSpeedChange={vi.fn()} onResearchClick={vi.fn()} onFocusClick={vi.fn()} onEconomyClick={open} />);
    fireEvent.click(screen.getByRole('button',{name: 'Abrir economia nacional'}));
    expect(open).toHaveBeenCalledOnce();
  });
});
