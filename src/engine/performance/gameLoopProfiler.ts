import type { AirCounters } from '../../types/air';
import type { DiplomacyAIProfile } from './diplomacyAIProfiler';
import type { NavalCounters } from '../../types/naval';
import type { AmphibiousCounters } from '../../types/naval';
import type { MilitaryAIProfile } from './militaryAIProfiler';
import { AI_PHASES, createAITickProfiler, profilerNow, type AIPhase, type SlowestBot, type AITickProfile } from './aiTickProfiler';

export const GAME_LOOP_PHASES = ['economy', 'politics', 'unrest', 'diplomacyTechnology', 'AI',
  'airProduction', 'airAI', 'airCombat', 'airMissions', 'navalConstruction', 'navalAI', 'movement', 'navalMovement', 'battleArrival', 'battleContinuous', 'navalCombat', 'amphibious', 'warResolution', 'rebellion', 'cleanup',
  'statePublication', 'TOTAL'] as const;
type Phase = typeof GAME_LOOP_PHASES[number];
export type PhaseStats = { count: number; total: number; average: number; max: number; last: number };
export type AirProductionCounters = { activeAirBuilds: number; queuedAirBuilds: number; completedAirWings: number; waitingAirBuilds: number };

export type AIBreakdown = {
  simulationActivation?: AITickProfile['simulationActivation'];
  activeBotsProcessed?: number;
  passiveBotsSkipped?: number;
  diplomacyAI?: DiplomacyAIProfile;
  diplomacyAIMax?: DiplomacyAIProfile;
  militaryAI?: MilitaryAIProfile;
  phases: Partial<Record<AIPhase, PhaseStats>>;
  slowestEconomicBot?: SlowestBot;
  slowestMilitaryBot?: SlowestBot;
};

/** Production uses an inert instance; every report resets the recent window. */
export function createGameLoopProfiler(enabled: boolean, options: {
  now?: () => number; reportEvery?: number;
  report?: (summary: { speed: number; targetInterval: number; total: PhaseStats | undefined; slowTicks: number; speedCounts: Record<number, number>; aiBreakdown: AIBreakdown; airCounters: AirCounters; airProduction: AirProductionCounters; navalCounters: NavalCounters; amphibious: AmphibiousCounters; navalConstruction: { activeNavalBuilds: number; queuedNavalBuilds: number; completedShips: number; shipyardUpgrades: number }; phases: Partial<Record<Phase, PhaseStats>> }) => void;
} = {}) {
  const clock = options.now ?? profilerNow;
  const phases: Partial<Record<Phase, PhaseStats>> = {};
  const aiProfiler = createAITickProfiler(enabled, { now: clock });
  let aiBreakdown: AIBreakdown = { phases: {} };
  let speedCounts: Record<number, number> = {};
  let ticks = 0, slowTicks = 0;
  let started = 0, phaseStarted = 0;
  let politicalActivationDuration = 0;
  let airCounters: AirCounters = { airWings: 0, activeAirMissions: 0, airAIBots: 0, airEngagements: 0, aircraftLost: 0, casMissions: 0, bombingMissions: 0 };
  let navalCounters: NavalCounters = { fleets: 0, movingFleets: 0, navalAIBots: 0, activeNavalBattles: 0, pathfindCalls: 0 };
  let navalConstruction = { activeNavalBuilds: 0, queuedNavalBuilds: 0, completedShips: 0, shipyardUpgrades: 0 };
  let airProduction: AirProductionCounters = { activeAirBuilds: 0, queuedAirBuilds: 0, completedAirWings: 0, waitingAirBuilds: 0 };
  let amphibious: AmphibiousCounters = { embarkedArmies: 0, transportedTroops: 0, activeLandings: 0, completedLandings: 0, troopLossesAtSea: 0 };
  const record = (phase: Phase, duration: number) => {
    const stat = phases[phase] ?? { count: 0, total: 0, average: 0, max: 0, last: 0 };
    stat.count++; stat.total += duration; stat.average = stat.total / stat.count;
    stat.max = Math.max(stat.max, duration); stat.last = duration;
    phases[phase] = stat;
  };
  return {
    phases, aiProfiler,
    recordAirProduction(counters: AirProductionCounters) { if (enabled) for (const key of Object.keys(counters) as (keyof AirProductionCounters)[]) airProduction[key] += counters[key]; },
    recordAir(counters: AirCounters) { if (enabled) for (const key of Object.keys(counters) as (keyof AirCounters)[]) airCounters[key] += counters[key]; },
    recordAmphibious(counters: AmphibiousCounters) { if (enabled) for (const key of Object.keys(counters) as (keyof AmphibiousCounters)[]) amphibious[key] += counters[key]; },
    recordNavalConstruction(counters: typeof navalConstruction) { if (enabled) for (const key of Object.keys(counters) as (keyof typeof navalConstruction)[]) navalConstruction[key] += counters[key]; },
    recordNaval(counters: NavalCounters) { if (enabled) for (const key of Object.keys(counters) as (keyof NavalCounters)[]) navalCounters[key] += counters[key]; },
    begin() { if (enabled) { started = phaseStarted = clock(); politicalActivationDuration = 0; } },
    measureSimulationActivation<T>(run: () => T): T {
      if (!enabled) return run();
      const start = clock();
      try { return run(); } finally { politicalActivationDuration += clock() - start; }
    },
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
        aiBreakdown.simulationActivation = ai.simulationActivation
          ? { ...ai.simulationActivation, duration: ai.simulationActivation.duration + politicalActivationDuration } : undefined;
        aiBreakdown.activeBotsProcessed = ai.activeBotsProcessed;
        aiBreakdown.passiveBotsSkipped = ai.passiveBotsSkipped;
        const military = aiProfiler.militaryProfiler.last;
        if (military) {
          const aggregate = aiBreakdown.militaryAI ?? structuredClone(military);
          if (aiBreakdown.militaryAI) {
            for (const key of Object.keys(military.counts) as (keyof MilitaryAIProfile['counts'])[]) aggregate.counts[key] += military.counts[key];
            for (const key of Object.keys(military.phases) as (keyof MilitaryAIProfile['phases'])[]) {
              const next = military.phases[key]!;
              const stat = aggregate.phases[key] ?? { total: 0, count: 0, max: 0 };
              stat.total += next.total; stat.count += next.count; stat.max = Math.max(stat.max, next.max);
              aggregate.phases[key] = stat;
            }
          }
          aiBreakdown.militaryAI = aggregate;
        }
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
        const summary = { speed, targetInterval: target, total: phases.TOTAL ? { ...phases.TOTAL } : undefined, slowTicks, speedCounts: { ...speedCounts }, aiBreakdown: structuredClone(aiBreakdown), airCounters: { ...airCounters }, airProduction: { ...airProduction }, navalCounters: { ...navalCounters }, navalConstruction: { ...navalConstruction }, amphibious: { ...amphibious }, phases: structuredClone(phases) };
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
        airCounters = { airWings: 0, activeAirMissions: 0, airAIBots: 0, airEngagements: 0, aircraftLost: 0, casMissions: 0, bombingMissions: 0 };
        airProduction = { activeAirBuilds: 0, queuedAirBuilds: 0, completedAirWings: 0, waitingAirBuilds: 0 };
        navalConstruction = { activeNavalBuilds: 0, queuedNavalBuilds: 0, completedShips: 0, shipyardUpgrades: 0 };
        amphibious = { embarkedArmies: 0, transportedTroops: 0, activeLandings: 0, completedLandings: 0, troopLossesAtSea: 0 };
        navalCounters = { fleets: 0, movingFleets: 0, navalAIBots: 0, activeNavalBattles: 0, pathfindCalls: 0 };
      }
    },
  };
}
