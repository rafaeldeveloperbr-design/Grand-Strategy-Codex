// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { countries, provincesData } from '../../../data/map';
import { createInitialNavies, resolveAmphibiousLandingSeaNode } from '../../../engine/naval';
import { createArmy } from '../../../engine/military';
import { ArmyTransportPanel } from '../../ArmyTransportPanel';
import { FleetPanel } from '../../FleetPanel';
import { GameMap } from '../GameMap';
const beachId = 'sa_arg_restored_1';
function setup() {
  const provinces = structuredClone(provincesData); provinces.find(p => p.id === beachId)!.owner = 'BRA';
  const docked = createInitialNavies(countries, provinces).find(f => f.countryTag === 'BRA')!;
  const fleet = { ...docked, status: 'HOLDING' as const, portProvinceId: undefined, locationSeaNodeId: resolveAmphibiousLandingSeaNode(beachId)!.id };
  const army = { ...createArmy('BRA', 'Cargo', docked.portProvinceId!), id: 'cargo', location: null, embarkedFleetId: fleet.id, regiments: [{ type: 'infantry' as const, strength: 3600, morale: 100 }] };
  const noop = vi.fn(), landing = vi.fn();
  const props = { provinces, countries, armies: [army], recruitments: [], buildingConstructions: [], activeBattles: [], selectedProvince: null, hoveredProvince: beachId, selectedArmy: null, playerCountryTag: 'BRA', onProvinceClick: noop, onProvinceHover: noop, onArmyClick: noop, onProvinceRightClick: noop, selectedFleetId: fleet.id, navalState: { fleets: [fleet], battles: [] }, onFriendlyLanding: landing, initialViewBox: { x: 0, y: 100, w: 5040, h: 2300 } };
  return { army, fleet, props, landing, noop };
}
afterEach(cleanup);
describe('Friendly beach transport commands V1.3', () => {
  it.each(['click', 'contextmenu'])('Fleet cargo selection then %s sends a distinct friendly command', event => {
    const s = setup(), invade = vi.fn(), { container } = render(<GameMap {...s.props} onInvasion={invade} />);
    fireEvent.click(screen.getByLabelText('Invade with Cargo')); fireEvent.click(screen.getByText('Desembarcar em costa amiga'));
    expect(screen.getByRole('status').textContent).toContain('Desembarque pela praia \u2014 5 dias');
    fireEvent(container.querySelector(`[data-province-id="${beachId}"]`)!, new MouseEvent(event, { bubbles: true }));
    expect(s.landing).toHaveBeenCalledWith([s.army.id], beachId); expect(invade).not.toHaveBeenCalled(); expect(s.noop).not.toHaveBeenCalled();
  });
  it('selected embarked Army can right-click the friendly coast without a new fleet selection', () => {
    const s = setup(), { container } = render(<GameMap {...s.props} selectedFleetId={null} selectedArmy={s.army.id} />);
    fireEvent.contextMenu(container.querySelector(`[data-province-id="${beachId}"]`)!);
    expect(s.landing).toHaveBeenCalledWith([s.army.id], beachId); expect(s.noop).not.toHaveBeenCalled();
  });
  it('cancel target selection restores the existing province selection', () => {
    const s = setup(), { container } = render(<GameMap {...s.props} />);
    fireEvent.click(screen.getByLabelText('Invade with Cargo')); fireEvent.click(screen.getByText('Desembarcar em costa amiga')); fireEvent.click(screen.getByText('Cancelar sele\u00e7\u00e3o'));
    fireEvent.click(container.querySelector(`[data-province-id="${beachId}"]`)!); expect(s.noop).toHaveBeenCalledWith(beachId); expect(s.landing).not.toHaveBeenCalled();
  });
  it.each(['access', 'node', 'combat', 'inland', 'lake', 'hostile'])('hover explains invalid %s', reason => {
    const s = setup();
    if (reason === 'access') s.props.provinces.find(p => p.id === beachId)!.owner = 'CHL';
    if (reason === 'node') s.fleet.locationSeaNodeId = 'wrong';
    const props = { ...s.props, ...(reason === 'combat' ? { navalState: { fleets: [{ ...s.fleet, status: 'COMBAT' as const }], battles: [] } } : {}), hoveredProvince: reason === 'inland' ? 'sa_bra_mato_grosso' : reason === 'lake' ? 'as_aze_baku' : beachId };
    if (reason === 'hostile') s.props.provinces.find(p => p.id === beachId)!.owner = 'ARG';
    render(<GameMap {...props} {...(reason === 'combat' ? { selectedFleetId: null, selectedArmy: s.army.id } : {})} wars={reason === 'hostile' ? [{ id: 'w', attacker: 'BRA', defender: 'ARG', startDate: { year: 2020, month: 1, day: 1 }, warScore: 0, attackerCasualties: 0, defenderCasualties: 0, occupiedByAttacker: [], occupiedByDefender: [] }] : []} />);
    if (reason !== 'combat') { fireEvent.click(screen.getByLabelText('Invade with Cargo')); fireEvent.click(screen.getByText('Desembarcar em costa amiga')); }
    const text = screen.getByRole('status').textContent;
    expect(text).toMatch(reason === 'access' ? /Sem acesso/ : reason === 'node' ? /Sem rota naval válida|SeaNode/ : reason === 'combat' ? /combate/ : reason === 'hostile' ? /hostil/ : /costeir|lago|interior/);
  });
  it('Army panel shows elapsed progress and explicit cancellation while still aboard', () => {
    const s = setup(), cancel = vi.fn(), army = { ...s.army, friendlyBeachLanding: { provinceId: beachId, seaNodeId: s.fleet.locationSeaNodeId, elapsedDays: 2 } };
    render(<ArmyTransportPanel army={army} armies={[army]} fleets={[s.fleet]} provinces={s.props.provinces} owner onEmbark={s.noop} onDisembark={s.noop} onCancelFriendlyLanding={cancel} />);
    expect(screen.getByText(/Embarked on/)).toBeTruthy(); expect(screen.getByText(/2\/5 dias/)).toBeTruthy(); expect(screen.queryByText('Disembark')).toBeNull(); fireEvent.click(screen.getByText('Cancelar desembarque')); expect(cancel).toHaveBeenCalledOnce();
  });
  it('Fleet panel reports friendly progress and blocks competing invasion selection', () => {
    const s = setup(), army = { ...s.army, friendlyBeachLanding: { provinceId: beachId, seaNodeId: s.fleet.locationSeaNodeId, elapsedDays: 3 } };
    render(<FleetPanel fleet={s.fleet} provinces={s.props.provinces} embarkedArmies={[army]} owner onPlanInvasion={s.noop} onPlanFriendlyLanding={s.landing} onReturn={s.noop} onCancel={s.noop} onLocate={s.noop} onClose={s.noop} />);
    expect(screen.getByText(/3\/5 dias/)).toBeTruthy(); expect(screen.queryByText('Plan Invasion')).toBeNull(); expect(screen.queryByText('Desembarcar em costa amiga')).toBeNull();
  });
});
