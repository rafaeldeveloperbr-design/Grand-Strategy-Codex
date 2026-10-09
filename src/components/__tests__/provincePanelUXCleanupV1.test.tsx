// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ProvincePanel, type ProvincePanelProps } from '../ProvincePanel/ProvincePanel';
import { countries, provincesData } from '../../data/map';
import { createInitialTechState } from '../../engine/technology';
import { createDefaultMarket } from '../../engine/market';
import { emptyNavalConstruction } from '../../engine/naval/construction';
import { portByProvince } from '../../engine/naval';

afterEach(cleanup);
function fixture(): ProvincePanelProps {
  const province = structuredClone(provincesData.find(p => p.id === 'sa_bra_sao_paulo')!);
  province.market = createDefaultMarket();
  province.market.goods.iron.stock = 1000;
  province.market.goods.tools.stock = 1000;
  const playerCountry = structuredClone(countries.find(c => c.tag === 'BRA')!);
  playerCountry.resources.gold = 10000;
  return {
    province, provinces: [province], countries: [playerCountry, countries.find(c => c.tag === 'USA')!], playerCountry,
    armies: [], recruitments: [], buildingConstructions: [], playerTechState: createInitialTechState('BRA'), botTechStates: new Map(),
    navalState: { fleets: [], battles: [], construction: { ...emptyNavalConstruction(), shipyards: [{ provinceId: province.id, level: 1 }] } },
    onClose: vi.fn(), onProvinceClick: vi.fn(), onBuild: vi.fn(), onRecruit: vi.fn(), onCancelRecruitment: vi.fn(), onCancelBuilding: vi.fn(),
    onNavalBuild: vi.fn(), onNavalCancel: vi.fn(),
  };
}
function activities(props: ProvincePanelProps, types: string[]) {
  const id = props.province.id;
  if (types.includes('recruitment')) props.recruitments = [{ id: 'rec', provinceId: id, owner: 'BRA', unitType: 'garrison', count: 1, daysRemaining: 21, totalDays: 22 }];
  if (types.includes('building')) props.buildingConstructions = [{ id: 'building', provinceId: id, owner: 'BRA', buildingType: 'farm', daysRemaining: 10, totalDays: 20, cost: 100 }];
  if (types.includes('naval')) props.navalState!.construction!.builds = [{ id: 'ship', provinceId: id, countryTag: 'BRA', unitType: 'DESTROYER', progress: 76, requiredProgress: 120, startedAt: 0 }];
  if (types.includes('upgrade')) props.navalState!.construction!.upgrades = [{ id: 'upgrade', provinceId: id, countryTag: 'BRA', targetLevel: 2, progress: 90, requiredProgress: 180, startedAt: 0 }];
}
function openPort() { fireEvent.click(screen.getByRole('button', { name: /Porto/ })); }
function sidebar(container: HTMLElement) { return within(container.querySelector('.province-panel__sidebar')! as HTMLElement); }

describe('Province panel UX cleanup V1', () => {
  it('hides Porto for inland provinces', () => {
    const props = fixture(); props.province = structuredClone(provincesData.find(p => !portByProvince.has(p.id) && p.owner === 'BRA')!);
    render(<ProvincePanel {...props} />); expect(screen.queryByRole('button', { name: /Porto/ })).toBeNull();
  });
  it('orders Info, Obras, Militar, Porto and keeps naval content inside the scrolling tab', () => {
    const { container } = render(<ProvincePanel {...fixture()} />);
    expect(Array.from(container.querySelectorAll('.province-panel__tab')).map(b => b.textContent?.trim())).toEqual(['📊 Info', '🏗️ Obras', '⚔️ Militar', '⚓ Porto']);
    expect(screen.queryByLabelText('Port information')).toBeNull(); openPort();
    const port = screen.getByLabelText('Port information');
    expect(port.parentElement?.className).toBe('province-panel__content');
    expect(container.querySelectorAll('.naval-port-info')).toHaveLength(1);
    expect(container.querySelector('.province-panel__main')?.contains(container.querySelector('.province-panel__tabs'))).toBe(true);
  });
  it.each(['Porto · nível', 'Shipyard · nível 1', 'Build Destroyer', 'Build Transport', 'Build Cruiser', 'Build Battleship', 'Upgrade Shipyard', 'Estoque local: IRON', 'Recuperação:'])('moves %s into Porto', label => {
    render(<ProvincePanel {...fixture()} />); expect(screen.queryByText(label, { exact: false })).toBeNull(); openPort();
    expect(within(screen.getByLabelText('Port information')).getByText(label, { exact: false })).toBeTruthy();
  });
  it('shows a port without a shipyard and preserves its blocked build reason', () => {
    const props = fixture(); props.navalState!.construction!.shipyards = []; render(<ProvincePanel {...props} />); openPort();
    expect(screen.getByText(/Shipyard · nível 0/)).toBeTruthy(); expect((screen.getByText('Build Destroyer') as HTMLButtonElement).disabled).toBe(true);
  });
  it('preserves Cruiser level requirements', () => {
    render(<ProvincePanel {...fixture()} />); openPort(); const button = screen.getByText('Build Cruiser') as HTMLButtonElement;
    expect(button.disabled).toBe(true); expect(button.parentElement?.textContent).toContain('nível 2');
  });
  it('shows naval queue and upgrade with cancel commands only in Porto', () => {
    const props = fixture(); activities(props, ['naval', 'upgrade']); const { container } = render(<ProvincePanel {...props} />); openPort();
    expect(screen.getByLabelText('Naval build queue').textContent).toContain('63%'); expect(screen.getByText(/Upgrade → nível 2/).textContent).toContain('50%');
    expect(sidebar(container).queryByRole('button')).toBeNull();
    fireEvent.click(screen.getByLabelText('Cancel naval build ship')); fireEvent.click(screen.getByText('Cancelar upgrade'));
    expect(props.onNavalCancel).toHaveBeenCalledWith('ship'); expect(props.onNavalCancel).toHaveBeenCalledWith('upgrade');
  });
  it('falls back to Info on inland selection and stays there on return', () => {
    const props = fixture(); const { rerender, container } = render(<ProvincePanel {...props} />); openPort();
    rerender(<ProvincePanel {...props} province={structuredClone(provincesData.find(p => !portByProvince.has(p.id) && p.owner === 'BRA')!)} />);
    expect(container.querySelector('.province-panel__tab--active')?.textContent).toContain('Info'); expect(screen.queryByLabelText('Port information')).toBeNull();
    rerender(<ProvincePanel {...props} />); expect(container.querySelector('.province-panel__tab--active')?.textContent).toContain('Info');
  });
  it('preserves other selected tabs on province change', () => {
    const props = fixture(); const { rerender, container } = render(<ProvincePanel {...props} />); fireEvent.click(screen.getByRole('button', { name: /Militar/ }));
    rerender(<ProvincePanel {...props} province={{ ...props.province, id: 'inland' }} />); expect(container.querySelector('.province-panel__tab--active')?.textContent).toContain('Militar');
  });
  it.each(['recruitment', 'building', 'naval', 'upgrade'])('includes active %s in Atividades', type => {
    const props = fixture(); activities(props, [type]); const { container } = render(<ProvincePanel {...props} />); const overview = sidebar(container);
    expect(overview.queryByText('Nenhuma atividade em andamento.')).toBeNull();
    expect(overview.getByText({ recruitment: /1× Guarnição/, building: /Obras/, naval: 'Destroyer', upgrade: /Upgrade Shipyard 1 → 2/ }[type]!)).toBeTruthy();
    expect(container.querySelector('.province-panel__sidebar .province-panel__construction-fill')).toBeTruthy();
  });
  it('shows recruitment on Militar without the false empty message', () => {
    const props = fixture(); activities(props, ['recruitment']); const { container } = render(<ProvincePanel {...props} />); fireEvent.click(screen.getByRole('button', { name: /Militar/ }));
    expect(sidebar(container).getByText(/1× Guarnição/)).toBeTruthy(); expect(container.textContent).not.toContain('Nenhuma obra ou recrutamento');
    expect(sidebar(container).getByText('21 dias restantes · 5%')).toBeTruthy();
  });
  it('aggregates all categories and upgrade, preserving progress and state', () => {
    const props = fixture(); activities(props, ['building', 'recruitment', 'naval', 'upgrade']); const before = JSON.stringify(props);
    const { container } = render(<ProvincePanel {...props} />); openPort(); const overview = sidebar(container);
    for (const name of [/Obras/, /Recrutamento/, /Naval/, /1× Guarnição/, 'Destroyer', /Upgrade Shipyard 1 → 2/]) expect(overview.getByText(name)).toBeTruthy();
    expect(overview.getByText(/76 \/ 120 dias · 63%/)).toBeTruthy(); expect(overview.getByText(/90 \/ 180 dias · 50%/)).toBeTruthy();
    expect(JSON.stringify(props)).toBe(before);
  });
  it('shows the new empty state and hides empty sections', () => {
    const { container } = render(<ProvincePanel {...fixture()} />); expect(sidebar(container).getByText('Nenhuma atividade em andamento.')).toBeTruthy();
    expect(container.querySelectorAll('.province-panel__sidebar-section')).toHaveLength(0);
  });
  it('filters queues from other provinces', () => {
    const props = fixture(); activities(props, ['building', 'recruitment', 'naval', 'upgrade']); props.province = { ...props.province, id: 'other' };
    const { container } = render(<ProvincePanel {...props} />); expect(sidebar(container).getByText('Nenhuma atividade em andamento.')).toBeTruthy();
  });
  it('keeps foreign port inspectable with player actions blocked', () => {
    const props = fixture(); props.province.owner = 'USA'; const { container } = render(<ProvincePanel {...props} />); openPort();
    expect(screen.getByText(/Porto · nível/)).toBeTruthy(); expect(screen.getByText(/Shipyard · nível/)).toBeTruthy();
    for (const label of ['Upgrade Shipyard', 'Build Destroyer', 'Build Transport', 'Build Cruiser', 'Build Battleship']) expect((screen.getByText(label) as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector('.province-panel__sidebar')).toBeNull(); expect(screen.queryByLabelText('Reinforcement fleet')).toBeNull();
  });
});
