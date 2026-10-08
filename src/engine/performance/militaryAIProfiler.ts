import { profilerNow } from './aiTickProfilerClock';

export const MILITARY_AI_PHASES = ['indexBuild', 'ownArmyCollection', 'warStateEvaluation', 'enemyEvaluation',
  'borderEvaluation', 'targetSelection', 'pathfinding', 'accessChecks', 'logisticsChecks', 'movementDecision',
  'defensiveDecision', 'offensiveDecision', 'idleDecision', 'stateMutation', 'TOTAL'] as const;
export type MilitaryAIPhase = typeof MILITARY_AI_PHASES[number];
export type MilitaryAIProfile = {
  phases: Partial<Record<MilitaryAIPhase, { total: number; count: number; max: number }>>;
  counts: Record<'bots' | 'warBots' | 'peaceBots' | 'armiesEvaluated' | 'pathfindCalls' | 'pathCacheHits' | 'routeChecks' | 'provinceScans' | 'relationLookups', number>;
};
export function createMilitaryAIProfiler(enabled: boolean, now = profilerNow) {
  let current: MilitaryAIProfile | undefined;
  let last: MilitaryAIProfile | undefined;
  return {
    get last() { return last; },
    begin() {
      if (!enabled) return;
      last = undefined;
      current = { phases: Object.fromEntries(MILITARY_AI_PHASES.map(phase => [phase, { total: 0, count: 0, max: 0 }])), counts: { bots: 0, warBots: 0, peaceBots: 0, armiesEvaluated: 0,
        pathfindCalls: 0, pathCacheHits: 0, routeChecks: 0, provinceScans: 0, relationLookups: 0 } };
    },
    count(key: keyof MilitaryAIProfile['counts'], amount = 1) { if (current) current.counts[key] += amount; },
    // Phases are inclusive: nested route/access costs remain visible without changing execution.
    measure<T>(phase: MilitaryAIPhase, run: () => T): T {
      if (!current) return run();
      const start = now();
      try { return run(); } finally {
        const duration = now() - start;
        const stat = current.phases[phase] ?? { total: 0, count: 0, max: 0 };
        stat.total += duration; stat.count++; stat.max = Math.max(stat.max, duration);
        current.phases[phase] = stat;
      }
    },
    finish() { if (current) { last = current; current = undefined; } },
  };
}
export type MilitaryAIProfiler = ReturnType<typeof createMilitaryAIProfiler>;
