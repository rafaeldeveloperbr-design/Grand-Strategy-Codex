// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WarPanel } from '../WarPanel';
import { army, date, war, world } from '../../engine/__tests__/helpers/southAmericaAudit';
afterEach(cleanup);
function setup(player='BRA') {
  const s=world();
  const wars=[{...war('BRA','ARG'),id:'root-secret',campaignId:'root-secret'}, {...war('CHL','ARG'),id:'ally-secret',campaignId:'root-secret'}];
  const props={wars,playerCountry:s.countries.find(c=>c.tag===player)!,allCountries:s.countries,provinces:s.provinces,armies:[army('BRA','sa_bra_brasilia',1),army('ARG','sa_arg_buenos_aires',1)],date,onClose:vi.fn(),onMakePeace:vi.fn()};
  return props;
}
describe('WarPanel campaign presentation', () => {
  it('renders one campaign for multiple war pairs', () => { render(<WarPanel {...setup()}/>); expect(screen.getAllByRole('region')).toHaveLength(1); expect(screen.getAllByRole('meter')).toHaveLength(1); });
  it('shows friendly leaders and allied participants', () => { render(<WarPanel {...setup()}/>); expect(screen.getByText(/Atacantes:.*Brasil.*Chile/)).toBeTruthy(); expect(screen.getByText(/Defensores:.*Argentina/)).toBeTruthy(); });
  it('shows surrender progress for both leaders', () => { render(<WarPanel {...setup()}/>); expect(screen.getByRole('progressbar',{name:'Rendição de Brasil'})).toBeTruthy(); expect(screen.getByRole('progressbar',{name:'Rendição de Argentina'})).toBeTruthy(); });
  it('shows occupied capital by its friendly province name', () => { const p=setup(); const capital=p.provinces.find(province=>province.id===(p.allCountries.find(c=>c.tag==='ARG')!.capitalId ?? p.allCountries.find(c=>c.tag==='ARG')!.capital))!; capital.owner='BRA'; render(<WarPanel {...p}/>); expect(screen.getByText(new RegExp(`Capital de Argentina: ${capital.name}.*ocupada`))).toBeTruthy(); });
  it('shows aggregated casualties without duplicating leader losses', () => { const p=setup(); p.wars[0].attackerCasualties=100; p.wars[1].attackerCasualties=50; render(<WarPanel {...p}/>); expect(screen.getByText('Baixas de Brasil e aliados: 150')).toBeTruthy(); });
  it('shows score, territory and duration', () => { render(<WarPanel {...setup()}/>); expect(screen.getByRole('meter').getAttribute('aria-valuemin')).toBe('-100'); expect(screen.getByText(/Território de Argentina:/)).toBeTruthy(); expect(screen.getByText('0 dias de guerra')).toBeTruthy(); });
  it('does not expose internal tags, campaign or province IDs as text', () => { const {container}=render(<WarPanel {...setup()}/>); expect(container.textContent).not.toMatch(/root-secret|ally-secret|sa_arg_|\bBRA\b|\bARG\b|\bCHL\b/); });
  it('white peace uses an authorized pair for an allied player', () => { const p=setup('CHL'); render(<WarPanel {...p}/>); fireEvent.click(screen.getByRole('button',{name:'Assinar Paz Branca da Campanha'})); expect(p.onMakePeace).toHaveBeenCalledExactlyOnceWith('ally-secret'); });
  it('keeps civil war in its own objective lifecycle', () => { const p=setup(); p.wars=[{...war('BRA','rebel_BRA'),campaignId:'civil'}]; render(<WarPanel {...p}/>); expect(screen.queryByRole('progressbar')).toBeNull(); expect(screen.getByRole('button',{name:'Assinar Paz Branca da Campanha'}).hasAttribute('disabled')).toBe(true); });
  it('supports close action and empty campaign state', () => { const p=setup(); p.wars=[]; render(<WarPanel {...p}/>); expect(screen.getByText('Nenhuma guerra ativa no momento.')).toBeTruthy(); fireEvent.click(screen.getByRole('button',{name:'Fechar guerras'})); expect(p.onClose).toHaveBeenCalledOnce(); });
});
