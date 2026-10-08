import { createDiplomacyAIProfiler } from './diplomacyAIProfiler';
import { createMilitaryAIProfiler } from './militaryAIProfiler';
import { profilerNow } from './aiTickProfilerClock';
export { profilerNow } from './aiTickProfilerClock';
import type { GameDate } from '../../types/date';

export const AI_PHASES = ['diplomacyAI', 'rebellionResponse', 'buildLogisticsNetworks',
  'botEconomicDecisions', 'botMilitaryAI', 'botLoggingFeedback', 'armyMerge', 'separatistAI',
  'rebelMovement', 'overhead', 'TOTAL'] as const;
export type AIPhase = typeof AI_PHASES[number];
export type SlowestBot = { tag: string; duration: number; date: GameDate };
export type AITickProfile = {
  phases: Record<AIPhase, number>;
  slowestEconomicBot?: SlowestBot;
  slowestMilitaryBot?: SlowestBot;
};
export type AISlowPhase = { phase: AIPhase; duration: number; date: GameDate; countryTag?: string };


/** Measures calls without modifying their arguments, results, or execution order. */
export function createAITickProfiler(enabled: boolean, options: {
  now?: () => number; reportSpike?: (spike: AISlowPhase) => void;
} = {}) {
  const clock = options.now ?? profilerNow;
  const diplomacyProfiler = createDiplomacyAIProfiler(enabled, { now: clock });
  const militaryProfiler = createMilitaryAIProfiler(enabled, clock);
  const reportSpike = options.reportSpike ?? (spike => console.warn('[AI Slow Phase]', spike));
  let started = 0, date: GameDate = { year: 0, month: 0, day: 0 };
  let current: AITickProfile | undefined;
  let last: AITickProfile | undefined;
  const warned = new Set<AIPhase>();
  const warn = (phase: AIPhase, duration: number, countryTag?: string) => {
    if (duration <= 1000) return;
    warned.add(phase);
    reportSpike({ phase, duration, date: { ...date }, ...(countryTag ? { countryTag } : {}) });
  };
  return {
    diplomacyProfiler,
    militaryProfiler,
    get last() { return last; },
    begin(gameDate: GameDate) {
      if (!enabled) return;
      started = clock(); date = { ...gameDate }; warned.clear();
      militaryProfiler.begin();
      current = { phases: Object.fromEntries(AI_PHASES.map(phase => [phase, 0])) as Record<AIPhase, number> };
      last = undefined;
    },
    measure<T>(phase: Exclude<AIPhase, 'overhead' | 'TOTAL'>, run: () => T, countryTag?: string): T {
      if (!enabled || !current) return run();
      const start = clock();
      try { return run(); }
      finally {
        const duration = clock() - start;
        current.phases[phase] += duration;
        if (countryTag && (phase === 'botEconomicDecisions' || phase === 'botMilitaryAI')) {
          const key = phase === 'botEconomicDecisions' ? 'slowestEconomicBot' : 'slowestMilitaryBot';
          if (!current[key] || duration > current[key].duration) current[key] = { tag: countryTag, duration, date: { ...date } };
        }
        warn(phase, duration, countryTag);
      }
    },
    finish() {
      if (!enabled || !current) return;
      militaryProfiler.finish();
      current.phases.TOTAL = clock() - started;
      // Includes setup, force-target checks, state assignment, iteration and measurement overhead.
      // Report it explicitly so named call costs are not confused with all AI work.
      const measured = AI_PHASES.filter(phase => phase !== 'TOTAL' && phase !== 'overhead')
        .reduce((sum, phase) => sum + current!.phases[phase], 0);
      current.phases.overhead = Math.max(0, current.phases.TOTAL - measured);
      for (const phase of AI_PHASES) if (!warned.has(phase)) warn(phase, current.phases[phase]);
      last = current; current = undefined;
    },
  };
}
export type AITickProfiler = ReturnType<typeof createAITickProfiler>;
