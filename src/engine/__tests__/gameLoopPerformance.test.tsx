// @vitest-environment jsdom
import { useRef, useState } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameLoopScheduler } from '../../hooks/gameLoop/useGameLoopScheduler';
import { useGameLoop } from '../../hooks/useGameLoop';
import { useGameRefs } from '../../hooks/useGameRefs';
import { createInitialTechState } from '../technology';
import { createGameLoopProfiler, GAME_LOOP_PHASES } from '../performance/gameLoopProfiler';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const initial = { speed: 1, paused: false, ended: false };
function mount(tick = vi.fn(), config = initial) {
  return renderHook(({ speed, paused, ended }) => {
    const timer = useRef<number | null>(null);
    return useGameLoopScheduler(tick, speed, paused, ended, timer);
  }, { initialProps: config });
}
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('game loop scheduling', () => {
  it('does not schedule while paused and schedules on play', () => {
    const tick = vi.fn(), game = mount(tick, { ...initial, paused: true });
    expect(vi.getTimerCount()).toBe(0);
    game.rerender(initial); expect(vi.getTimerCount()).toBe(1);
    advance(1000); expect(tick).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });
  it('never queues a timeout during a slow tick or catches up afterward', () => {
    const tick = vi.fn(() => {
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(184);
    });
    mount(tick, { ...initial, speed: 5 });
    advance(60); expect(tick).toHaveBeenCalledTimes(1);
    advance(59); expect(tick).toHaveBeenCalledTimes(1);
    advance(1); expect(tick).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });
  it('replaces the speed 1 deadline immediately with speed 5', () => {
    const tick = vi.fn(), game = mount(tick);
    advance(500); game.rerender({ ...initial, speed: 5 });
    expect(vi.getTimerCount()).toBe(1);
    advance(59); expect(tick).not.toHaveBeenCalled();
    advance(1); expect(tick).toHaveBeenCalledTimes(1);
  });
  it.each([{ ...initial, speed: 0 }, { ...initial, paused: true }, { ...initial, ended: true }])(
    'cancels when configuration becomes %j', config => {
      const tick = vi.fn(), game = mount(tick);
      advance(1000); game.rerender(config);
      expect(vi.getTimerCount()).toBe(0);
      advance(5000); expect(tick).toHaveBeenCalledTimes(1);
    });
  it('does not execute or schedule an initially ended game', () => {
    const tick = vi.fn(); mount(tick, { ...initial, ended: true });
    advance(5000); expect(tick).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels on unmount', () => {
    const tick = vi.fn(), game = mount(tick); game.unmount();
    advance(5000); expect(tick).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it('can stop from inside the tick before React publishes pause/endgame', () => {
    const tick = vi.fn(() => game.result.current());
    const game = mount(tick); advance(1000); advance(5000);
    expect(tick).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
  });
  it('uses the latest callback without duplicating or delaying the timer', () => {
    const first = vi.fn(), latest = vi.fn(), timer = { current: null as number | null };
    const game = renderHook(({ tick }) => useGameLoopScheduler(tick, 1, false, false, timer), { initialProps: { tick: first } });
    advance(500); game.rerender({ tick: latest }); advance(500);
    expect(first).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });
  it('advances one day per real tick and automatically reports after 60 ticks', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const ignore = () => undefined;
    const game = renderHook(() => {
      const [date, setDate] = useState({ day: 30, month: 12, year: 1444 });
      const playerTechState = createInitialTechState('A');
      const refs = useGameRefs({ provinces: [], allCountries: [], armies: [], recruitments: [], wars: [],
        diplomaticRelations: [], date, buildingConstructions: [], playerTechState, botTechStates: new Map(),
        aiDifficulty: 'medium', activeBattles: [] });
      useGameLoop({ ...refs, playerCountryTag: 'A', battleHistory: [], hasTriggeredEndGame: false,
        gameSpeed: 1, isPaused: false, allCountries: [], setDate, setProvinces: ignore, setAllCountries: ignore,
        setArmies: ignore, setWars: ignore, setDiplomaticRelations: ignore, setRecruitments: ignore,
        setBuildingConstructions: ignore, setPlayerTechState: ignore, setBotTechStates: ignore,
        setActiveBattles: ignore, setEndGameType: ignore, setGameStats: ignore, setHasTriggeredEndGame: ignore,
        setIsPaused: ignore, setBattleHistory: ignore, setBattleReport: ignore,
        addLog: ignore, addToast: ignore, addAILog: ignore, formatGameDate: () => '' });
      return date;
    });
    advance(999); expect(game.result.current.day).toBe(30);
    advance(1); expect(game.result.current).toEqual({ day: 1, month: 1, year: 1445 });
    advance(1000); expect(game.result.current).toEqual({ day: 2, month: 1, year: 1445 });
    expect(info).not.toHaveBeenCalled();
    for (let i = 0; i < 58; i++) advance(1000);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain('[GameLoop]');
    expect(info.mock.calls[0][1]).toMatchObject({ speed: 1, targetInterval: 1000, total: { count: 60 } });
  });
});

describe('game loop profiler', () => {
  it('measures every phase and aggregates count, total, average, max and last', () => {
    let time = 0;
    const report = vi.fn(), profiler = createGameLoopProfiler(true, { now: () => time, reportEvery: 2, report });
    for (const cost of [2, 4]) {
      profiler.begin();
      for (const phase of GAME_LOOP_PHASES.filter(p => p !== 'TOTAL')) { time += cost; profiler.endPhase(phase); }
      profiler.finish(5, 30);
    }
    const phases = report.mock.calls[0][0].phases;
    expect(phases.economy).toEqual({ count: 2, total: 6, average: 3, max: 4, last: 4 });
    expect(phases.TOTAL?.last).toBe((GAME_LOOP_PHASES.length - 1) * 4);
    expect(Object.keys(phases)).toHaveLength(GAME_LOOP_PHASES.length);
    expect(phases.navalAI).toEqual(phases.economy);
    expect(phases.navalMovement).toEqual(phases.economy);
    expect(phases.navalCombat).toEqual(phases.economy);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0][0].slowTicks).toBe(1);
  });
  it('does not read clocks, report or change results when disabled', () => {
    const clock = vi.fn(() => { throw Error('clock should not run'); }), report = vi.fn();
    const profiler = createGameLoopProfiler(false, { now: clock, report });
    const calculate = () => { profiler.begin(); const result = 42; profiler.endPhase('economy'); profiler.finish(1, 1000); return result; };
    expect(calculate()).toBe(42); expect(clock).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled(); expect(profiler.phases).toEqual({});
  });
  it('preserves computations while enabled and tolerates performance unavailable', () => {
    vi.stubGlobal('performance', undefined);
    const profiler = createGameLoopProfiler(true, { reportEvery: 100 });
    profiler.begin(); const result = [1, 2].map(n => n * 2); profiler.endPhase('AI'); profiler.finish(1, 1000);
    expect(result).toEqual([2, 4]); expect(profiler.phases.AI?.last).toBeGreaterThanOrEqual(0);
  });
});
