import { createServer } from 'vite';
import { cpus, platform, arch } from 'node:os';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { writeFile, mkdir, readFile } from 'node:fs/promises';

const samples = Number(process.argv.find(arg => arg.startsWith('--samples='))?.split('=')[1] ?? 3);
if (!Number.isInteger(samples) || samples < 1) throw new Error('--samples must be a positive integer');
const baselineOnly = process.argv.includes('--baseline-only');
const afterOnly = process.argv.includes('--after-only');
const profileCycle = process.argv.includes('--profile-cycle');
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const statistics = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return { samples: values.length, median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1), milliseconds: values };
};
const diplomaticState = result => ({ relations: result.relations, wars: result.wars, messages: result.messages });
try {
  const { diplomacyWorld } = await server.ssrLoadModule('/src/engine/__tests__/helpers/diplomacyWorld.ts');
  const legacy = await server.ssrLoadModule('/src/engine/__tests__/helpers/legacyDiplomacyAI.ts');
  const current = await server.ssrLoadModule('/src/engine/diplomacy/diplomacyAI.ts');
  const { createDiplomacyAIProfiler } = await server.ssrLoadModule('/src/engine/performance/diplomacyAIProfiler.ts');
  const savedBaseline = afterOnly ? JSON.parse(await readFile('artifacts/diplomacy-ai-baseline.json', 'utf8')) : undefined;
  const results = {};
  for (const scenario of profileCycle ? ['proposalCycle'] : ['normal', 'maintenance', 'proposalCycle']) {
    const ctx = diplomacyWorld(scenario), rows = afterOnly ? { before: savedBaseline[scenario].before } : {};
    let reference;
    for (const [label, fn] of [...(!afterOnly ? [['before', legacy.processDiplomacyAI]] : []), ...(!baselineOnly ? [['after', current.processDiplomacyAI]] : [])]) {
      const durations = []; let profile; let state;
      for (let i = 0; i < samples; i++) {
        const profiler = createDiplomacyAIProfiler(true, { reportSpike: () => undefined });
        const start = performance.now();
        const result = fn(ctx, 'BRA', profiler);
        durations.push(performance.now() - start); profile = profiler.last; state = diplomaticState(result);
        if (reference) deepStrictEqual(state, reference);
        else reference = state;
        console.info(`[DiplomacyAI benchmark] ${scenario} ${label} sample=${i + 1} ${durations.at(-1).toFixed(2)}ms`);
      }
      const sha256 = createHash('sha256').update(JSON.stringify(state)).digest('hex');
      if (afterOnly) strictEqual(sha256, savedBaseline[scenario].before.sha256, `${scenario}: exact diplomatic output differs from baseline`);
      rows[label] = { ...statistics(durations), profile,
        sha256 };
    }
    results[scenario] = rows;
    console.info(JSON.stringify({ scenario, ...Object.fromEntries(Object.entries(rows).map(([key, value]) => [key, {
      median: value.median, p95: value.p95, max: value.max, sha256: value.sha256,
      phases: Object.fromEntries(Object.entries(value.profile.phases).map(([key, phase]) => [key, phase.total])) }])) }));
  }
  results.environment = { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCPUs: cpus().length, profiling: 'enabled', note: 'Sample counts are recorded per scenario; input snapshot is unchanged between repetitions' };
  await mkdir('artifacts', { recursive: true });
  await writeFile(`artifacts/diplomacy-ai-${profileCycle ? 'cycle-profile' : baselineOnly ? 'baseline' : 'benchmark'}.json`, JSON.stringify(results, null, 2) + '\n');
} finally { await server.close(); }
