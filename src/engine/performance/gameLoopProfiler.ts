import type { DiplomacyAIProfile } from './diplomacyAIProfiler';
import { AI_PHASES, createAITickProfiler, profilerNow, type AIPhase, type SlowestBot } from './aiTickProfiler';

export const GAME_LOOP_PHASES = ['economy', 'politics', 'unrest', 'diplomacyTechnology', 'AI',
  'movement', 'battleArrival', 'battleContinuous', 'warResolution', 'rebellion', 'cleanup',
  'statePublication', 'TOTAL'] as const;
type Phase = typeof GAME_LOOP_PHASES[number];
export type PhaseStats = { count: number; total: number; average: number; max: number; last: number };

export type AIBreakdown = {
  diplomacyAI?: DiplomacyAIProfile;
  diplomacyAIMax?: DiplomacyAIProfile;
  phases: Partial<Record<AIPhase, PhaseStats>>;
  slowestEconomicBot?: SlowestBot;
  slowestMilitaryBot?: SlowestBot;
};

/** Production uses an inert instance; every report resets the recent window. */
export function createGameLoopProfiler(enabled: boolean, options: {
  now?: () => number; reportEvery?: number;
  report?: (summary: { speed: number; targetInterval: number; total: PhaseStats | undefined; slowTicks: number; speedCounts: Record<number, number>; aiBreakdown: AIBreakdown; phases: Partial<Record<Phase, PhaseStats>> }) => void;
} = {}) {
  const clock = options.now ?? profilerNow;
  const phases: Partial<Record<Phase, PhaseStats>> = {};
  const aiProfiler = createAITickProfiler(enabled, { now: clock });
  let aiBreakdown: AIBreakdown = { phases: {} };
  let speedCounts: Record<number, number> = {};
  let ticks = 0, slowTicks = 0;
  let started = 0, phaseStarted = 0;
  const record = (phase: Phase, duration: number) => {
    const stat = phases[phase] ?? { count: 0, total: 0, average: 0, max: 0, last: 0 };
    stat.count++; stat.total += duration; stat.average = stat.total / stat.count;
    stat.max = Math.max(stat.max, duration); stat.last = duration;
    phases[phase] = stat;
  };
  return {
    phases, aiProfiler,
    begin() { if (enabled) started = phaseStarted = clock(); },
    endPhase(phase: Exclude<Phase, 'TOTAL'>) {
      if (!enabled) return;
      const time = clock(); record(phase, time - phaseStarted); phaseStarted = time;
    },
    finish(speed: number, target: number) {
      if (!enabled) return;
      const duration = clock() - started;
      record('TOTAL', duration); ticks++;
      speedCounts[speed] = (speedCounts[speed] ?? 0) + 1;
      const ai = aiProfiler.last;
      if (ai) {
        const diplomacy = aiProfiler.diplomacyProfiler.last;
        aiBreakdown.diplomacyAI = diplomacy;
        if (diplomacy && (!aiBreakdown.diplomacyAIMax || (diplomacy.phases.TOTAL?.total ?? 0) > (aiBreakdown.diplomacyAIMax.phases.TOTAL?.total ?? 0))) {
          aiBreakdown.diplomacyAIMax = diplomacy;
        }
        for (const phase of AI_PHASES) {
          const stat = aiBreakdown.phases[phase] ?? { count: 0, total: 0, average: 0, max: 0, last: 0 };
          stat.count++; stat.total += ai.phases[phase]; stat.average = stat.total / stat.count;
          stat.max = Math.max(stat.max, ai.phases[phase]); stat.last = ai.phases[phase];
          aiBreakdown.phases[phase] = stat;
        }
        for (const key of ['slowestEconomicBot', 'slowestMilitaryBot'] as const) {
          const bot = ai[key];
          if (bot && (!aiBreakdown[key] || bot.duration > aiBreakdown[key].duration)) aiBreakdown[key] = bot;
        }
      }
      if (duration > target) slowTicks++;
      if (ticks % (options.reportEvery ?? 60) === 0) {
        const summary = { speed, targetInterval: target, total: phases.TOTAL ? { ...phases.TOTAL } : undefined, slowTicks, speedCounts: { ...speedCounts }, aiBreakdown: structuredClone(aiBreakdown), phases: structuredClone(phases) };
        if (options.report) options.report(summary);
        else {
          const breakdown = AI_PHASES
            .map(phase => `${phase}=${aiBreakdown.phases[phase]?.last.toFixed(1) ?? '0'}ms`).join(' ');
          const slowest = (bot: SlowestBot | undefined) => `${bot?.tag ?? '-'} ${bot?.duration.toFixed(1) ?? '0'}ms`;
          console.info(
            `[GameLoop] speed=${speed} targetInterval=${target}ms `
            + `total.last=${duration.toFixed(1)}ms total.average=${phases.TOTAL!.average.toFixed(1)}ms `
            + `total.max=${phases.TOTAL!.max.toFixed(1)}ms slowTicks=${slowTicks} `
            + `AI breakdown: ${breakdown} `
            + `slowestEconomicBot=${slowest(aiBreakdown.slowestEconomicBot)} `
            + `slowestMilitaryBot=${slowest(aiBreakdown.slowestMilitaryBot)}`, summary);
        }
        // Each report contains a fresh, non-overlapping window (60 ticks by default).
        for (const phase of GAME_LOOP_PHASES) delete phases[phase];
        ticks = 0; slowTicks = 0; speedCounts = {}; aiBreakdown = { phases: {} };
      }
    },
  };
}
