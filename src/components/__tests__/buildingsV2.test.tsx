// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { ProvinceBuildingsTab } from '../ProvincePanel/ProvinceBuildingsTab';
import { ProvinceSidebar } from '../ProvincePanel/ProvinceSidebar';
import { countries, provincesData } from '../../data/map';
import type { BuildingConstruction, Province } from '../../types';
import { createDefaultMarket } from '../../engine/market';
import { saveGame, loadGame } from '../../engine/saveSystem';
import { createInitialTechState } from '../../engine/technology';
import { getBuildingLevel } from '../../data/buildings';

afterEach(() => { cleanup(); localStorage.clear(); });
function setup() {
  const country = structuredClone(countries[0]); country.resources.gold = 10000;
  const province: Province = structuredClone(provincesData[0]); province.owner = country.tag; province.buildings = [{ type: 'infrastructure', level: 2, daysRemaining: 0 }];
  province.market = createDefaultMarket(); for (const g of Object.values(province.market.goods)) g.stock = 1000;
  const onBuild = vi.fn();
  const order: BuildingConstruction = { id: 'c', owner: country.tag, provinceId: province.id, buildingType: 'military_arsenal', cost: 600, resourceCost: { wood: 24, iron: 20, tools: 12 }, totalDays: 60, daysRemaining: 30 };
  return { country, province, order, onBuild, props: { province, provinces: [province], playerCountry: country, constructions: [] as BuildingConstruction[], onBuild } };
}
describe('Buildings V2 cards and activities', () => {
  it('renders eleven cards grouped by category with quantitative current/next effects, costs and time', () => {
    const { props } = setup(), view = render(<ProvinceBuildingsTab {...props} />);
    expect(view.getAllByRole('article')).toHaveLength(11);
    for (const name of ['Produção', 'Comércio', 'População', 'Militar', 'Defesa', 'Infraestrutura']) expect(view.getByRole('region', { name })).toBeTruthy();
    const infrastructure = within(view.getByRole('article', { name: 'Infraestrutura' }));
    expect(infrastructure.getByText(/Nível 2 \/ 5/)).toBeTruthy();
    expect(infrastructure.getByText(/Atual:.*\+16% eficiência logística/)).toBeTruthy();
    expect(infrastructure.getByText(/Próximo nível 3:.*\+24% eficiência logística/)).toBeTruthy();
    expect(infrastructure.getByText('Ouro 1170')).toBeTruthy(); expect(infrastructure.getByText('Madeira 45')).toBeTruthy();
    expect(infrastructure.getByText('Tempo: 86 dias')).toBeTruthy();
  });
  it('uses the shared prerequisite and resource reasons, and dispatches only available upgrades', () => {
    const { props, onBuild, province } = setup(); province.buildings = [];
    province.market!.goods.tools.stock = 0;
    const view = render(<ProvinceBuildingsTab {...props} />);
    const arsenal = within(view.getByRole('article', { name: 'Arsenal Militar' }));
    expect(arsenal.getByText('Requer Quartel ou Infraestrutura nível 1')).toBeTruthy();
    expect(arsenal.getByText('TOOLS insuficiente')).toBeTruthy(); expect(arsenal.getByRole('button').hasAttribute('disabled')).toBe(true);
    fireEvent.click(arsenal.getByRole('button')); expect(onBuild).not.toHaveBeenCalled();
    province.market!.goods.tools.stock = 1000;
    view.rerender(<ProvinceBuildingsTab {...props} />);
    fireEvent.click(within(view.getByRole('article', { name: 'Fazenda' })).getByRole('button'));
    expect(onBuild).toHaveBeenCalledWith(province.id, 'farm');
  });
  it('shows active target level, remaining days, progress and existing cancellation', () => {
    const { props, order } = setup(); props.constructions = [order];
    const view = render(<ProvinceBuildingsTab {...props} />);
    expect(view.getByText(/Arsenal Militar · Nível 1.*30 dias restantes/)).toBeTruthy();
    expect(view.getByRole('progressbar', { name: 'Progresso de Arsenal Militar' }).getAttribute('value')).toBe('30');
    expect(view.getAllByText('Já existe construção em andamento')).toHaveLength(11);
    const cancel = vi.fn();
    const sidebar = render(<ProvinceSidebar provinceConstructions={[order]} recruitmentsHere={[]} onCancelBuilding={cancel} onCancelRecruitment={vi.fn()} />);
    fireEvent.click(sidebar.getByTitle('Cancelar (Reembolso proporcional)')); expect(cancel).toHaveBeenCalledWith(order.id);
  });
});

describe('Buildings V2 actual save/load', () => {
  it('roundtrips arsenal levels, progress and paid costs; migrates legacy queued types without a version bump', () => {
    const { country, province, order } = setup(); province.buildings.push({ type: 'military_arsenal', level: 3, daysRemaining: 0 });
    const refs = { provincesRef: { current: [province] }, countriesRef: { current: [country] }, armiesRef: { current: [] }, warsRef: { current: [] }, diplomaticRelationsRef: { current: [] }, recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [order] }, playerTechStateRef: { current: createInitialTechState(country.tag) }, botTechStatesRef: { current: new Map() }, activeBattlesRef: { current: [] }, dateRef: { current: { day: 1, month: 1, year: 1444 } } };
    saveGame(refs, 'buildings-v2');
    const loaded = loadGame('buildings-v2')!;
    expect(loaded.version).toBe(3); expect(loaded.economy.constructions).toEqual([order]);
    expect(getBuildingLevel(loaded.world.provinces[0], 'military_arsenal')).toBe(3);
    const raw = JSON.parse(localStorage.getItem('imperium_save_buildings-v2')!);
    raw.world.provinces[0].buildings = [{ type: 'lumber', level: 4, daysRemaining: 0 }];
    raw.economy.constructions[0].buildingType = 'university';
    localStorage.setItem('imperium_save_buildings-v2', JSON.stringify(raw));
    const migrated = loadGame('buildings-v2')!;
    expect(getBuildingLevel(migrated.world.provinces[0], 'lumber_mill')).toBe(4); expect(getBuildingLevel(migrated.world.provinces[0], 'military_arsenal')).toBe(0);
    expect(migrated.economy.constructions[0]).toEqual({ ...order, buildingType: 'infrastructure' });
  });
});
