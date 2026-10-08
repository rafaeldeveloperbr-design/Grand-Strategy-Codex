import { useCallback, useLayoutEffect, useRef, type MutableRefObject } from 'react';

export const SPEED_INTERVALS: Record<number, number> = { 0: 0, 1: 1000, 2: 500, 3: 250, 4: 125, 5: 60 };

/** One timeout, one running tick, and no elapsed-time debt or catch-up. */
export function useGameLoopScheduler(processTick: () => void, speed: number, paused: boolean,
  ended: boolean, timerRef: MutableRefObject<number | null>) {
  const tickRef = useRef(processTick);
  const tickRunningRef = useRef(false);
  const scheduleRef = useRef<() => void>(() => undefined);
  const stopRef = useRef<() => void>(() => undefined);

  useLayoutEffect(() => { tickRef.current = processTick; });

  const stop = useCallback(() => { stopRef.current(); }, []);

  useLayoutEffect(() => {
    let active = speed > 0 && !paused && !ended;
    const cancel = () => {
      active = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
    stopRef.current = cancel;
    const schedule = () => {
      if (!active || tickRunningRef.current || timerRef.current !== null) return;
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (!active || tickRunningRef.current) return;
        tickRunningRef.current = true;
        try { tickRef.current(); }
        finally {
          tickRunningRef.current = false;
          scheduleRef.current();
        }
      }, SPEED_INTERVALS[speed]);
    };
    scheduleRef.current = schedule;
    schedule();
    return cancel;
  }, [speed, paused, ended, timerRef]);

  return stop;
}
