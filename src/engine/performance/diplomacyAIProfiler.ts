import type { GameDate } from '../../types';
import type { DiplomacyContext } from '../diplomacy/diplomacyTypes';
import { profilerNow } from './aiTickProfilerClock';

export const DIPLOMACY_AI_PHASES = ['proposalCollection', 'proposalEvaluation', 'relationEvaluation',
  'neighborEvaluation', 'politicalTie', 'strategicThreat', 'allianceLogic', 'accessLogic', 'nonAggressionLogic', 'warEvaluation', 'callToWar', 'relationUpdates',
  'candidateSorting', 'indexBuild', 'other', 'TOTAL'] as const;
export type DiplomacyAIPhase = typeof DIPLOMACY_AI_PHASES[number];
export type DiplomacyPair = { from?: string; to?: string; countryTag?: string };
export type DiplomacyAIProfile = {
  date: GameDate;
  counts: { countries: number; relations: number; wars: number; proposals: number;
    proposalsProcessed: number; maintenancePairs: number; candidatePairs: number };
  phases: Partial<Record<DiplomacyAIPhase, { total: number; count: number; max: number; context?: DiplomacyPair }>>;
  slowestPair?: { phase: DiplomacyAIPhase; duration: number; context: DiplomacyPair };
  slowest?: { phase: DiplomacyAIPhase; duration: number; context?: DiplomacyPair };
};
export type DiplomacyAISpike = { phase: DiplomacyAIPhase; duration: number; date: GameDate;
  context?: DiplomacyPair; iterations: number; maxInvocation: number; counts: DiplomacyAIProfile['counts'] };

export function createDiplomacyAIProfiler(enabled: boolean, options: {
  now?: () => number; reportSpike?: (spike: DiplomacyAISpike) => void;
} = {}) {
  const clock = options.now ?? profilerNow;
  const report = options.reportSpike ?? (spike => console.warn('[DiplomacyAI Slow Phase]', spike));
  let current: DiplomacyAIProfile | undefined, last: DiplomacyAIProfile | undefined, started = 0;
  const warned = new Set<DiplomacyAIPhase>();
  const warn = (phase: DiplomacyAIPhase, duration: number, context?: DiplomacyPair) => {
    if (duration <= 500 || !current) return;
    warned.add(phase);
    report({ phase, duration, date: { ...current.date }, context,
      iterations: current.phases[phase]?.count ?? 0, maxInvocation: current.phases[phase]?.max ?? duration,
      counts: { ...current.counts } });
  };
  return {
    get last() { return last; },
    begin(ctx: DiplomacyContext) {
      if (!enabled) return;
      started = clock(); warned.clear(); last = undefined;
      current = { date: { ...ctx.date }, phases: {}, counts: {
        countries: ctx.countries.length, relations: ctx.relations.length, wars: ctx.wars.length,
        proposals: 0, proposalsProcessed: 0, maintenancePairs: 0, candidatePairs: 0 } };
    },
    count(counter: 'proposals' | 'proposalsProcessed' | 'maintenancePairs' | 'candidatePairs', amount = 1) {
      if (current) current.counts[counter] += amount;
    },
    measure<T>(phase: Exclude<DiplomacyAIPhase, 'other' | 'TOTAL'>, run: () => T, context?: DiplomacyPair): T {
      if (!enabled || !current) return run();
      const start = clock();
      try { return run(); }
      finally {
        const duration = clock() - start;
        const stat = current.phases[phase] ?? { total: 0, count: 0, max: 0 };
        stat.total += duration; stat.count++;
        if (duration >= stat.max) { stat.max = duration; stat.context = context; }
        current.phases[phase] = stat;
        if (!current.slowest || duration > current.slowest.duration) current.slowest = { phase, duration, context };
        if (context && (!current.slowestPair || duration > current.slowestPair.duration)) current.slowestPair = { phase, duration, context };
        warn(phase, duration, context);
      }
    },
    finish() {
      if (!enabled || !current) return;
      const duration = clock() - started;
      const measured = Object.values(current.phases).reduce((sum, phase) => sum + phase.total, 0);
      current.phases.other = { total: Math.max(0, duration - measured), count: 1, max: Math.max(0, duration - measured) };
      current.phases.TOTAL = { total: duration, count: 1, max: duration };
      for (const phase of DIPLOMACY_AI_PHASES) {
        const stat = current.phases[phase];
        if (stat && !warned.has(phase)) warn(phase, stat.total, stat.context);
      }
      last = current; current = undefined;
    },
  };
}
export type DiplomacyAIProfiler = ReturnType<typeof createDiplomacyAIProfiler>;
