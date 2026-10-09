import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { deepStrictEqual } from 'node:assert';
import { mkdir, writeFile } from 'node:fs/promises';

const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const samples = Number(process.argv.find(a => a.startsWith('--samples='))?.split('=')[1] ?? 7);
const baselineOnly = process.argv.includes('--baseline-only');
const profiling = !process.argv.includes('--no-profile');
const baselineModule = process.argv.find(a => a.startsWith('--baseline-module='))?.slice('--baseline-module='.length);
const output = process.argv.find(a => a.startsWith('--output='))?.slice('--output='.length);
if (!Number.isInteger(samples) || samples < 1) throw new Error('--samples must be a positive integer');
try {
  const { militaryWorld } = await server.ssrLoadModule('/src/engine/__tests__/helpers/militaryWorld.ts');
  const legacy = await server.ssrLoadModule(baselineModule ?? '/src/engine/__tests__/helpers/legacyMilitaryAI.ts');
  const current = await server.ssrLoadModule('/src/engine/aiEngine/aiMovement.ts');
  const { createMilitaryAIContext } = await server.ssrLoadModule('/src/engine/aiEngine/militaryAIContext.ts');
  const { createMilitaryAIProfiler } = await server.ssrLoadModule('/src/engine/performance/militaryAIProfiler.ts');
  const { buildLogisticsNetworks } = await server.ssrLoadModule('/src/engine/logistics/index.ts');
  const results = { environment: { node: process.version, cpu: cpus()[0]?.model, samples, baseline: baselineModule ?? 'legacyMilitaryAI', profiling: profiling ? 'enabled; phases inclusive' : 'disabled', warmups: 2 } };
  for (const scenario of ['peace', 'wars', 'manyArmies']) {
    const world = militaryWorld(scenario);
    const logistics = buildLogisticsNetworks(world);
    let reference;
    const rows = { countries: world.countries.length, provinces: world.provinces.length, armies: world.armies.length };
    for (const label of baselineOnly ? ['before'] : ['before', 'after']) {
      // Version changes can intentionally alter decisions; still verify exact
      // determinism within each implementation. Default optimization comparison
      // retains cross-version equivalence checks.
      if (baselineModule) reference = undefined;
      const times = []; let profile;
      for (let sample = -2; sample < samples; sample++) {
        const w = structuredClone(world);
        const profiler = createMilitaryAIProfiler(profiling); profiler.begin();
        const start = performance.now();
        const context = label === 'after' || baselineModule ? profiler.measure('indexBuild', () => createMilitaryAIContext(w.countries, w.provinces, w.armies, w.relations, w.wars)) : undefined;
        for (const country of w.countries) {
          if (country.tag === 'BRA') continue;
          const args = [country.tag, w.armies, w.provinces, w.relations, w.wars, w.countries, logistics];
          w.armies = label === 'before' ? baselineModule ? legacy.processAI(...args, context, profiler) : legacy.processProfiledMilitaryAI(profiler, ...args) : current.processAI(...args, context, profiler);
        }
        const elapsed = performance.now() - start; profiler.finish();
        if (reference) deepStrictEqual(w.armies, reference); else reference = w.armies;
        if (sample >= 0) { times.push(elapsed); profile = profiler.last; }
      }
      const sorted = [...times].sort((a, b) => a - b);
      rows[label] = { median: sorted[Math.floor(sorted.length / 2)], max: sorted.at(-1), milliseconds: times, profile };
      console.info(`[MilitaryAI benchmark] ${scenario} ${label} median=${rows[label].median.toFixed(2)}ms max=${rows[label].max.toFixed(2)}ms`);
    }
    results[scenario] = rows;
  }
  await mkdir('artifacts', { recursive: true });
  await writeFile(output ?? `artifacts/military-ai-${baselineOnly ? 'baseline' : profiling ? 'benchmark' : 'benchmark-production'}.json`, JSON.stringify(results, null, 2) + '\n');
} finally { await server.close(); }
