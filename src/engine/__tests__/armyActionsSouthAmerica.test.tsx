// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useArmyActions } from '../../hooks/app/useArmyActions';
import { startContinuousBattle } from '../combat';
import { army, campaign, date, day, province, relation, war, world } from './helpers/southAmericaAudit';

afterEach(cleanup);

it('the real withdrawal action retreats one adjacent edge and permits occupation after the defender leaves', () => {
  const location = 'sa_bra_parana', map = world();
  const attacker = { ...army('ARG', location, 4), inCombat: true };
  const defender = { ...army('BRA', location, 2), inCombat: true };
  const battle = startContinuousBattle([attacker], [defender], province(location), date, 'ui-retreat');
  const armiesRef = { current: [attacker, defender] }, activeBattlesRef = { current: [battle] };
  const setArmies = vi.fn(), setActiveBattles = vi.fn();
  const { result } = renderHook(() => useArmyActions({ selectedArmy: defender.id,
    setSelectedArmy: vi.fn(), setSelectedProvince: vi.fn(), setIsPanelOpen: vi.fn(),
    provincesRef: { current: map.provinces }, armiesRef, activeBattlesRef, setActiveBattles,
    diplomaticRelationsRef: { current: [relation('ARG', 'BRA')] }, playerCountryTag: 'BRA',
    setArmies, addLog: vi.fn(), addToast: vi.fn(), splitSelection: new Set(),
    setSplitSelection: vi.fn(), setShowSplitModal: vi.fn() }));
  act(() => result.current.handleRetreatArmy(attacker.id, battle.id));
  expect(setArmies).not.toHaveBeenCalled(); // Player cannot withdraw an enemy.
  act(() => result.current.handleRetreatArmy(defender.id, battle.id));
  const withdrawn = armiesRef.current.find(a => a.id === defender.id)!;
  expect(province(location).neighbors).toContain(withdrawn.location);
  expect(withdrawn.inCombat).toBe(false);
  expect(activeBattlesRef.current[0].phase).toBe('BREAK_RETREAT');
  expect(setActiveBattles).toHaveBeenCalledWith(activeBattlesRef.current);
  const state = day({...campaign(armiesRef.current, [relation('ARG', 'BRA')], [war('ARG', 'BRA')]),currentActiveBattles:activeBattlesRef.current});
  expect(state.currentActiveBattles).toHaveLength(0);
  expect(state.battleHistory).toHaveLength(1);
  expect(state.provinces.find(p => p.id === location)!.owner).toBe('ARG');
  expect(state.countries.find(c => c.tag === 'ARG')!.provinces).toContain(location);
  expect(state.countries.find(c => c.tag === 'BRA')!.provinces).not.toContain(location);
});
