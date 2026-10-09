// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { countries, provincesData } from '../../../data/map';
import { createInitialNavies, portByProvince, resolveAmphibiousLandingSeaNode } from '../../../engine/naval';
import { createArmy } from '../../../engine/military';
import { ArmyTransportPanel } from '../../ArmyTransportPanel';
import { FleetPanel, NavalBattlePanel } from '../../FleetPanel';
import { GameMap } from '../GameMap';
import { buildArmyPresentation } from '../mapPresentation';
const fleet = createInitialNavies(countries, provincesData).find(f => f.countryTag === 'BRA')!;
const army = { ...createArmy('BRA', '1º Exército', fleet.portProvinceId!), id: 'transport-army', regiments: [{ type: 'infantry' as const, strength: 3600, morale: 100, originProvinceId: fleet.portProvinceId }] };
const embarked = { ...army, location: null, embarkedFleetId: fleet.id };
const target = provincesData.find(p => p.owner === 'ARG' && portByProvince.has(p.id))!;
const noop = vi.fn();
const mapProps = { provinces: provincesData, countries, armies: [embarked], recruitments: [], buildingConstructions: [], activeBattles: [], selectedProvince: null, hoveredProvince: null, selectedArmy: null, playerCountryTag: 'BRA', onProvinceClick: noop, onProvinceHover: noop, onArmyClick: noop, onProvinceRightClick: noop, selectedFleetId: fleet.id, navalState: { fleets: [fleet], battles: [] }, initialViewBox: { x: 0, y: 100, w: 5040, h: 2300 } };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('Army transport UI', () => {
  it('Army panel exposes fleet choice and capacity with Embark', () => { const embark = vi.fn(); render(<ArmyTransportPanel army={army} armies={[army]} fleets={[fleet]} provinces={provincesData} owner onEmbark={embark} onDisembark={noop}/>); expect(screen.getByLabelText('Embark Fleet').textContent).toContain('Total 5000'); expect(screen.getByLabelText('Embark Fleet').textContent).toContain('Usada 0'); fireEvent.click(screen.getByText('Embark')); expect(embark).toHaveBeenCalledWith(fleet.id); });
  it('offers multiple fleets independently', () => { const other = { ...fleet, id: 'fleet-other', name: 'Segunda Fleet' }, embark = vi.fn(); render(<ArmyTransportPanel army={army} armies={[army]} fleets={[fleet, other]} provinces={provincesData} owner onEmbark={embark} onDisembark={noop}/>); fireEvent.change(screen.getByLabelText('Embark Fleet'), { target: { value: other.id } }); fireEvent.click(screen.getByText('Embark')); expect(embark).toHaveBeenCalledWith(other.id); });
  it('hides Embark inland and for foreign army', () => { const inland = { ...army, location: provincesData.find(p => !portByProvince.has(p.id))!.id }; const { rerender } = render(<ArmyTransportPanel army={inland} armies={[inland]} fleets={[fleet]} provinces={provincesData} owner onEmbark={noop} onDisembark={noop}/>); expect(screen.queryByText('Embark')).toBeNull(); rerender(<ArmyTransportPanel army={army} armies={[army]} fleets={[fleet]} provinces={provincesData} owner={false} onEmbark={noop} onDisembark={noop}/>); expect(screen.queryByText('Embark')).toBeNull(); });
  it('shows embarked fleet and enables port disembark', () => { const disembark = vi.fn(); render(<ArmyTransportPanel army={embarked} armies={[embarked]} fleets={[fleet]} provinces={provincesData} owner onEmbark={noop} onDisembark={disembark}/>); expect(screen.getByText(`Embarked on ${fleet.name}`)).toBeTruthy(); fireEvent.click(screen.getByText('Disembark')); expect(disembark).toHaveBeenCalledOnce(); });
  it('FleetPanel displays transport capacity, cargo, per-army disembark and selection', () => { const disembark = vi.fn(), plan = vi.fn(); render(<FleetPanel fleet={fleet} provinces={provincesData} embarkedArmies={[embarked]} owner onDisembark={disembark} onPlanInvasion={plan} onReturn={noop} onCancel={noop} onLocate={noop} onClose={noop}/>); expect(screen.getByLabelText('Transport Capacity').textContent).toContain('3.600 / 5.000'); fireEvent.click(screen.getByText(`Disembark ${army.name}`)); expect(disembark).toHaveBeenCalledWith(army.id); fireEvent.click(screen.getByLabelText(`Invade with ${army.name}`)); fireEvent.click(screen.getByText('Plan Invasion')); expect(plan).toHaveBeenCalledWith([army.id]); });
  it('Plan Invasion followed by province click sends selected cargo without clearing fleet', () => { const invade = vi.fn(); const { container } = render(<GameMap {...mapProps} onInvasion={invade}/>); fireEvent.click(screen.getByLabelText(`Invade with ${army.name}`)); fireEvent.click(screen.getByText('Plan Invasion')); expect(screen.getByRole('status').textContent).toContain('clique'); fireEvent.click(container.querySelector(`[data-province-id="${target.id}"]`)!); expect(invade).toHaveBeenCalledWith([army.id], target.id); expect(noop).not.toHaveBeenCalled(); });
  it('canceling target selection restores regular province selection', () => { const { container } = render(<GameMap {...mapProps} onInvasion={noop}/>); fireEvent.click(screen.getByLabelText(`Invade with ${army.name}`)); fireEvent.click(screen.getByText('Plan Invasion')); fireEvent.click(screen.getByText('Cancelar seleção')); fireEvent.click(container.querySelector(`[data-province-id="${target.id}"]`)!); expect(mapProps.onProvinceClick).toHaveBeenCalledWith(target.id); });
  it('embarked army has no terrestrial marker/group', () => { expect(buildArmyPresentation([embarked], provincesData).groups).toEqual([]); });
  it('NavalBattlePanel exposes troops aboard and distinct troop losses', () => { render(<NavalBattlePanel fleets={[fleet]} armies={[embarked]} battle={{ id: 'battle', seaNodeId: portByProvince.get(fleet.portProvinceId!)!.seaNodeId, sideA: [fleet.id], sideB: ['enemy'], startedAt: -100, days: 1, lossesA: 10, lossesB: 20, status: 'ENDED', embarkedTroopLosses: 2000 }} onLocate={noop} onClose={noop}/>); expect(screen.getByText(/Troops aboard/).textContent).toContain('3.600'); expect(screen.getByText(/Embarked troop losses/).textContent).toContain('2.000'); });
});

describe('Beach target UX',()=>{
  it('right-click also selects a beach target',()=>{const invade=vi.fn();const beach=provincesData.find(p=>p.id==='sa_arg_restored_1')!;const {container}=render(<GameMap {...mapProps} onInvasion={invade}/>);fireEvent.click(screen.getByLabelText(`Invade with ${army.name}`));fireEvent.click(screen.getByText('Plan Invasion'));fireEvent.contextMenu(container.querySelector(`[data-province-id="${beach.id}"]`)!);expect(invade).toHaveBeenCalledWith([army.id],beach.id);expect(mapProps.onProvinceRightClick).not.toHaveBeenCalled();});
  it.each([true,false])('hover shows port=%s duration',port=>{const province=port?target:provincesData.find(p=>p.id==='sa_arg_restored_1')!;render(<GameMap {...mapProps} hoveredProvince={province.id} wars={[{id:'ui-war',attacker:'BRA',defender:'ARG',startDate:{year:1444,month:11,day:1},warScore:0,attackerCasualties:0,defenderCasualties:0,occupiedByAttacker:[],occupiedByDefender:[]}]} onInvasion={noop}/>);fireEvent.click(screen.getByLabelText(`Invade with ${army.name}`));fireEvent.click(screen.getByText('Plan Invasion'));expect(screen.getByRole('status').textContent).toContain(port?'porto \u2014 3 dias':'praia \u2014 5 dias');});
});

describe('Beach extraction UI V1.2', () => {
  const beachId = 'sa_arg_restored_1';
  function beachSetup() {
    const provinces = structuredClone(provincesData);
    provinces.find(p => p.id === beachId)!.owner = 'BRA';
    const land = { ...army, location: beachId };
    const offshore = { ...fleet, status: 'HOLDING' as const, portProvinceId: undefined, locationSeaNodeId: resolveAmphibiousLandingSeaNode(beachId)!.id };
    return { land, offshore, props: { army: land, armies: [land], fleets: [offshore], provinces, owner: true, onEmbark: vi.fn(), onDisembark: noop } };
  }
  it('offers the existing Fleet selector and Embark command for a valid beach', () => {
    const s = beachSetup(); render(<ArmyTransportPanel {...s.props}/>);
    expect(screen.getByText('Embarque pela praia — 5 dias')).toBeTruthy();
    expect(screen.getByLabelText('Embark Fleet').textContent).toContain(s.offshore.name);
    fireEvent.click(screen.getByText('Embark')); expect(s.props.onEmbark).toHaveBeenCalledWith(s.offshore.id);
  });
  it('shows progress and allows player cancellation while the Army stays on land', () => {
    const s = beachSetup(), cancel = vi.fn(), extracting = { ...s.land, beachExtraction: { fleetId: s.offshore.id, provinceId: beachId, seaNodeId: s.offshore.locationSeaNodeId, elapsedDays: 2 } };
    render(<ArmyTransportPanel {...s.props} army={extracting} armies={[extracting]} onCancelExtraction={cancel}/>);
    expect(screen.getByText(/2\/5 dias/)).toBeTruthy(); expect(screen.queryByText('Embark')).toBeNull();
    fireEvent.click(screen.getByText('Cancelar extração')); expect(cancel).toHaveBeenCalledOnce();
  });
  it('shows the wrong-coast reason when the Fleet is elsewhere', () => {
    const s = beachSetup(); s.offshore.locationSeaNodeId = portByProvince.get(fleet.portProvinceId!)!.seaNodeId;
    render(<ArmyTransportPanel {...s.props}/>); expect(screen.getByText(/SeaNode correto/)).toBeTruthy(); expect(screen.queryByText('Embark')).toBeNull();
  });
  it.each(['army', 'fleet'])('disables Embark and explains %s combat', reason => {
    const s = beachSetup();
    const land = { ...s.land, inCombat: reason === 'army' };
    const offshore = { ...s.offshore, status: reason === 'fleet' ? 'COMBAT' as const : 'HOLDING' as const };
    render(<ArmyTransportPanel {...s.props} army={land} armies={[land]} fleets={[offshore]}/>);
    expect((screen.getByText('Embark') as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(/batalha|combate/)).toBeTruthy();
  });
  it('shows reserved capacity and prevents overbooking in the UI', () => {
    const s = beachSetup(), reserving = { ...s.land, id: 'reserved', regiments: [{ type: 'infantry' as const, strength: 2000, morale: 100 }], beachExtraction: { fleetId: s.offshore.id, provinceId: beachId, seaNodeId: s.offshore.locationSeaNodeId, elapsedDays: 1 } };
    render(<ArmyTransportPanel {...s.props} armies={[s.land, reserving]}/>);
    expect(screen.getByLabelText('Embark Fleet').textContent).toContain('Reservada 2000');
    expect((screen.getByText('Embark') as HTMLButtonElement).disabled).toBe(true); expect(screen.getByText(/Transporte insuficiente/)).toBeTruthy();
  });
  it('shows the access rejection explicitly', () => {
    const s = beachSetup(); s.props.provinces.find(p => p.id === beachId)!.owner = 'CHL';
    render(<ArmyTransportPanel {...s.props}/>); expect(screen.getByText(/Acesso/)).toBeTruthy();
    expect((screen.getByText('Embark') as HTMLButtonElement).disabled).toBe(true);
  });
  it('FleetPanel displays capacity reserved by terrestrial extractions', () => {
    const s = beachSetup(); render(<FleetPanel fleet={s.offshore} provinces={s.props.provinces} extractingArmies={[s.land]} owner onReturn={noop} onCancel={noop} onLocate={noop} onClose={noop}/>);
    expect(screen.getByText(/Reserved for beach extraction/).textContent).toContain('3.600');
  });
});
