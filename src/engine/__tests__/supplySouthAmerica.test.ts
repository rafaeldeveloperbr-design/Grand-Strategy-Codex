import { describe, expect, it } from 'vitest';
import { countries, provincesData } from '../../data/map';
import { calculateLocalSupplyCapacity, getArmySupply } from '../military/supplyEngine';
import { recoverArmy } from '../military/recoveryEngine';
import { processProvinceMarket } from '../market';
import { processEconomyTick } from '../../hooks/gameLoop/economyTick';
import { createInitialTechState } from '../technology';
import { army, date, noop, province, world } from './helpers/southAmericaAudit';

describe('South America supply and recovery audit', () => {
  it.each([
    ['sa_bra_brasilia', 1], ['sa_bra_brasilia', 20], ['sa_bra_amazonas', 20],
    ['sa_bra_amazonas', 80], ['sa_arg_buenos_aires', 20], ['sa_bol_beni', 80],
  ])('keeps supply finite for %s with %s regiments', (location, count) => {
    const force = army('BRA', location, count);
    for (const moving of [false, true]) {
      const supply = getArmySupply({ ...force, destination: moving ? 'sa_bra_para' : null }, province(location));
      expect(supply.ratio).toBeGreaterThanOrEqual(0); expect(supply.ratio).toBeLessThanOrEqual(1);
      expect(Number.isFinite(supply.combatMultiplier)).toBe(true);
      expect(Number.isFinite(supply.movementMultiplier)).toBe(true);
    }
  });

  it('scales local capacity with development and completed buildings, without special terrain rules', () => {
    const developed = province('sa_bra_brasilia'), interior = province('sa_bra_amazonas');
    expect(calculateLocalSupplyCapacity(developed)).toBeGreaterThan(calculateLocalSupplyCapacity(interior));
    expect(getArmySupply(army('BRA', developed.id, 1), developed).status).toBe('good');
    expect(getArmySupply(army('BRA', interior.id, 80), interior).status).toBe('critical');
    expect(getArmySupply(army('BRA', developed.id, 20), developed).ratio).toBeLessThan(getArmySupply(army('BRA', developed.id, 1), developed).ratio);
    expect(calculateLocalSupplyCapacity({ ...interior, buildings: [{ type: 'infrastructure', level: 5, daysRemaining: 10 }] })).toBe(calculateLocalSupplyCapacity({ ...interior, buildings: [] }));
  });

  it('applies the existing hostile capacity penalty and shares capacity among colocated forces', () => {
    const p = province('sa_bra_amazonas'), a = army('BRA', p.id, 5), b = army('BRA', p.id, 10, 'stack-b');
    expect(getArmySupply(a, { ...p, owner: 'ARG' }).ratio).toBeLessThan(getArmySupply(a, p).ratio);
    expect(getArmySupply(a, p, [a, b]).ratio).toBeLessThan(getArmySupply(a, p).ratio);
  });

  it('critical supply slows recovery without draining morale/organization or giving free troops', () => {
    const p = province('sa_bra_amazonas'), c = structuredClone(countries.find(c => c.tag === 'BRA')!);
    c.resources.manpower = 0; c.resources.gold = 0;
    const force = army('BRA', p.id, 80);
    force.regiments = force.regiments.map(r => ({ ...r, strength: 800, morale: 30, organization: 30 }));
    let previous = force, stock = p;
    for (let tick = 0; tick < 90; tick++) {
      const result = recoverArmy(previous, c, stock);
      expect(result.reinforced).toBe(0);
      expect(result.army.regiments[0].morale).toBeGreaterThanOrEqual(previous.regiments[0].morale);
      expect(result.army.regiments[0].organization!).toBeGreaterThanOrEqual(previous.regiments[0].organization!);
      for (const good of Object.values(result.province.market!.goods)) expect(good.stock).toBeGreaterThanOrEqual(0);
      previous = result.army; stock = result.province;
    }
    const small = { ...force, regiments: [force.regiments[0]] };
    expect(recoverArmy(small, c, p).army.regiments[0].morale).toBeGreaterThan(recoverArmy(force, c, p).army.regiments[0].morale);
  });

  it.each(['gold', 'manpower', 'iron', 'tools'] as const)('does not reinforce without %s', resource => {
    const p = province('sa_bra_brasilia'), c = structuredClone(countries[0]);
    const force = army('BRA', p.id, 1); force.regiments[0].strength = 500;
    if (resource === 'gold' || resource === 'manpower') c.resources[resource] = 0;
    else p.market!.goods[resource].stock = 0;
    expect(recoverArmy(force, c, p).reinforced).toBe(0);
  });

  it('moving armies do not recover and stacked recovery uses the same logistical pressure', () => {
    const p = province('sa_bra_amazonas'), c = structuredClone(countries[0]), a = army('BRA', p.id, 1), b = army('BRA', p.id, 80, 'stack');
    a.regiments[0].morale = 30; a.regiments[0].organization = 30;
    expect(recoverArmy({ ...a, destination: 'sa_bra_para' }, c, p).army.regiments[0].morale).toBe(30);
    expect(recoverArmy(a, c, p, [a, b]).army.regiments[0].morale).toBeLessThan(recoverArmy(a, c, p).army.regiments[0].morale);
    const map = world();
    const result = processEconomyTick({ ...map, armies: [a, b], recruitments: [], buildingConstructions: [], wars: [], date,
      playerCountryTag: 'BRA', allCountries: map.countries, playerTechState: createInitialTechState('BRA'), botTechStates: new Map(),
      addLog: noop, addAILog: noop, addToast: noop, formatGameDate: () => '' });
    expect(result.armies[0].regiments[0].morale).toBeLessThan(recoverArmy(a, c, p).army.regiments[0].morale);
  });

  it('all provincial markets remain finite/nonnegative after 120 controlled daily updates', () => {
    for (const initial of provincesData) {
      let p = structuredClone(initial);
      for (let tick = 0; tick < 120; tick++) p = { ...p, market: processProvinceMarket({ ...p, stationedTroops: 40000 }) };
      for (const good of Object.values(p.market!.goods)) {
        expect(Number.isFinite(good.stock)).toBe(true); expect(good.stock).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
