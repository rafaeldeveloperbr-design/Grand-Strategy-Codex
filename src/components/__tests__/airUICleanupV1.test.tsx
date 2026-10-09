// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ProvincePanel, type ProvincePanelProps } from '../ProvincePanel/ProvincePanel';
import { countries, provincesData } from '../../data/map';
import { airBaseByProvinceId, createInitialAirState } from '../../engine/air';
import { portByProvince } from '../../engine/naval';
import { createInitialTechState } from '../../engine/technology';
import { saveGame, loadGame } from '../../engine/saveSystem';

afterEach(cleanup);
function fixture(): ProvincePanelProps {
  const airState = createInitialAirState(countries, provincesData);
  const province = structuredClone(provincesData.find(p => p.owner === 'BRA' && portByProvince.has(p.id) && airBaseByProvinceId.has(p.id))!);
  airState.wings = airState.wings.map(w => w.id === airState.wings.find(wing => wing.countryTag === 'BRA')!.id ? { ...w, baseProvinceId: province.id } : w);
  const playerCountry = structuredClone(countries.find(c => c.tag === 'BRA')!);
  return {
    province, provinces: [province], countries: [playerCountry], playerCountry,
    armies: [], recruitments: [], buildingConstructions: [], playerTechState: createInitialTechState('BRA'), botTechStates: new Map(),
    airState: { ...airState, production: { nextId: 3, queues: { [province.id]: [
      { id: 'air-build-1', countryTag: 'BRA', provinceId: province.id, type: 'FIGHTER', progress: 30, requiredProgress: 120 },
      { id: 'air-build-2', countryTag: 'BRA', provinceId: province.id, type: 'CAS', progress: 0, requiredProgress: 150 },
    ] } } },
    onClose: vi.fn(), onProvinceClick: vi.fn(), onBuild: vi.fn(), onRecruit: vi.fn(), onCancelRecruitment: vi.fn(), onCancelBuilding: vi.fn(),
    onAirBuild: vi.fn(), onAirBuildCancel: vi.fn(), onSelectAirWing: vi.fn(),
  };
}
const open = (name: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
const inland = () => structuredClone(provincesData.find(p => p.owner === 'BRA' && !airBaseByProvinceId.has(p.id) && !portByProvince.has(p.id))!);
const overview = (container: HTMLElement) => within(container.querySelector('.province-panel__sidebar')! as HTMLElement);

it('shows Aéreo for an Air Base even without air state', () => { const p = fixture(); render(<ProvincePanel {...p} airState={undefined}/>); expect(screen.getByRole('button', { name: /Aéreo/ })).toBeTruthy(); });
it('hides Aéreo without relevant content', () => { render(<ProvincePanel {...fixture()} province={inland()}/>); expect(screen.queryByRole('button', { name: /Aéreo/ })).toBeNull(); });
it('moves capacity, wings, costs, production and queue into Aéreo', () => {
  const p = fixture(); render(<ProvincePanel {...p}/>);
  expect(screen.queryByLabelText('Air Base')).toBeNull(); open('Militar'); expect(screen.queryByLabelText('Aircraft Production')).toBeNull(); open('Aéreo');
  expect(screen.getByLabelText('Air Base').textContent).toContain('Capacidade:');
  const wing = p.airState!.wings.find(w => w.baseProvinceId === p.province.id)!;
  fireEvent.click(screen.getByText(new RegExp(wing.name))); expect(p.onSelectAirWing).toHaveBeenCalledWith(wing.id);
  expect(screen.getByLabelText('Aircraft Production').textContent).toContain('ouro'); expect(screen.getByText(/Fila 2\/5/)).toBeTruthy();
  expect(screen.getByLabelText('Production air-build-1').getAttribute('value')).toBe('30');
});
it('lists active and queued air production in Atividades with progress and cancellation', () => {
  const p = fixture(); const { container } = render(<ProvincePanel {...p}/>); const a = overview(container);
  expect(a.getByText(/30 \/ 120 dias · 25% · Ativo/)).toBeTruthy(); expect(a.getByText(/0 \/ 150 dias · 0% · Na fila/)).toBeTruthy();
  fireEvent.click(a.getByLabelText('Cancelar produção aérea air-build-1')); expect(p.onAirBuildCancel).toHaveBeenCalledWith('air-build-1');
  expect(screen.queryByRole('button', { name: /Atividades/ })).toBeNull();
});
it('preserves Obras, Recrutamento and Naval alongside Aéreo', () => {
  const p = fixture(), id = p.province.id;
  p.buildingConstructions = [{ id: 'b', provinceId: id, owner: 'BRA', buildingType: 'farm', daysRemaining: 10, totalDays: 20, cost: 100 }];
  p.recruitments = [{ id: 'r', provinceId: id, owner: 'BRA', unitType: 'garrison', count: 1, daysRemaining: 21, totalDays: 22 }];
  p.navalState = { fleets: [], battles: [], construction: { nextId: 1, shipyards: [], upgrades: [], builds: [{ id: 'n', provinceId: id, countryTag: 'BRA', unitType: 'DESTROYER', progress: 60, requiredProgress: 120, startedAt: 0 }] } };
  const { container } = render(<ProvincePanel {...p}/>); const a = overview(container);
  for (const name of [/Obras/, /Recrutamento/, /Naval/, /Aéreo/]) expect(a.getByText(name)).toBeTruthy();
  fireEvent.click(a.getByTitle('Cancelar recrutamento')); expect(p.onCancelRecruitment).toHaveBeenCalledWith('r');
});
it('falls back to Info and stays there when returning from inland', () => {
  const p = fixture(); const { container, rerender } = render(<ProvincePanel {...p}/>); open('Aéreo');
  rerender(<ProvincePanel {...p} province={inland()}/>); expect(container.querySelector('.province-panel__tab--active')?.textContent).toContain('Info');
  rerender(<ProvincePanel {...p}/>); expect(container.querySelector('.province-panel__tab--active')?.textContent).toContain('Info');
});
it('orders Aéreo and Porto without an Atividades tab and switches independently', () => {
  const { container } = render(<ProvincePanel {...fixture()}/>);
  expect([...container.querySelectorAll('.province-panel__tab')].map(b => b.textContent?.replace(/^\S+ /, ''))).toEqual(['Info', 'Obras', 'Militar', 'Aéreo', 'Porto']);
  open('Porto'); expect(screen.getByLabelText('Port information')).toBeTruthy(); open('Aéreo'); expect(screen.queryByLabelText('Port information')).toBeNull();
});
it('cancels production from Aéreo', () => { const p = fixture(); render(<ProvincePanel {...p}/>); open('Aéreo'); fireEvent.click(screen.getByLabelText('Cancel air-build-1')); expect(p.onAirBuildCancel).toHaveBeenCalledWith('air-build-1'); });
it('shows queued content even without a base and blocks production', () => {
  const p = fixture(); p.province = { ...p.province, id: 'no-base' }; p.airState!.production!.queues['no-base'] = p.airState!.production!.queues[Object.keys(p.airState!.production!.queues)[0]];
  render(<ProvincePanel {...p}/>); open('Aéreo'); expect(screen.getByText(/Sem Air Base · produção bloqueada/)).toBeTruthy(); expect((screen.getByText('Build Fighter Wing') as HTMLButtonElement).disabled).toBe(true); expect(screen.getByLabelText('Cancel air-build-1')).toBeTruthy();
});
it('recognizes incoming rebase and shows its remaining time', () => {
  const p = fixture(), province = inland(); p.airState!.wings[0] = { ...p.airState!.wings[0], status: 'REBASING', rebase: { targetProvinceId: province.id, daysRemaining: 2, totalDays: 4 } };
  render(<ProvincePanel {...p} province={province}/>); open('Aéreo'); expect(screen.getByText(/Rebase: 2 dias/)).toBeTruthy();
});
it('omits empty air activity sections and filters queues by province', () => { const p = fixture(); const { container } = render(<ProvincePanel {...p} province={inland()}/>); expect(overview(container).getByText('Nenhuma atividade em andamento.')).toBeTruthy(); expect(overview(container).queryByText(/Aéreo/)).toBeNull(); });
it('preserves serialized gameplay state while switching all tabs', () => { const p = fixture(), before = JSON.stringify(p); render(<ProvincePanel {...p}/>); for (const tab of ['Aéreo', 'Porto', 'Militar', 'Obras', 'Info']) open(tab); expect(JSON.stringify(p)).toBe(before); });
it('round-trips air state through public save/load after using the new tabs', () => {
  const p = fixture(); render(<ProvincePanel {...p}/>); open('Aéreo'); 
  const refs = {
    airStateRef: { current: p.airState! }, navalStateRef: { current: { fleets: [], battles: [] } },
    provincesRef: { current: structuredClone(provincesData) }, countriesRef: { current: structuredClone(countries) },
    armiesRef: { current: [] }, warsRef: { current: [] }, diplomaticRelationsRef: { current: [] },
    recruitmentsRef: { current: [] }, buildingConstructionsRef: { current: [] },
    playerTechStateRef: { current: p.playerTechState }, botTechStatesRef: { current: new Map() },
    activeBattlesRef: { current: [] }, dateRef: { current: { year: 1444, month: 11, day: 11 } },
  };
  expect(saveGame(refs, 'air-ui')).toBe(true); expect(loadGame('air-ui')!.air).toEqual(p.airState);
  localStorage.removeItem('imperium_save_air-ui');
});
