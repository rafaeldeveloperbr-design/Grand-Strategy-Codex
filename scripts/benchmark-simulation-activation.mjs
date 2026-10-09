import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';

const samples = Number(process.argv.find(a => a.startsWith('--samples='))?.split('=')[1] ?? 9);
if (!Number.isInteger(samples) || samples < 1) throw new Error('--samples must be a positive integer');
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { activationTickParams } = await server.ssrLoadModule('/src/engine/__tests__/helpers/simulationActivationWorld.ts');
  const { processAiTick: before } = await server.ssrLoadModule('/src/engine/__tests__/helpers/legacyActivationAiTick.ts');
  const { processAiTick: after } = await server.ssrLoadModule('/src/hooks/gameLoop/aiTick.ts');
  const { buildSimulationActivation } = await server.ssrLoadModule('/src/engine/simulationActivation.ts');
  const { createAITickProfiler } = await server.ssrLoadModule('/src/engine/performance/aiTickProfiler.ts');
  const { diplomacyWorld } = await server.ssrLoadModule('/src/engine/__tests__/helpers/diplomacyWorld.ts');
  const { transferProvince } = await server.ssrLoadModule('/src/engine/territoryTransfer.ts');
  const { war } = await server.ssrLoadModule('/src/engine/__tests__/helpers/southAmericaAudit.ts');
  const results = { environment: { node: process.version, cpu: cpus()[0]?.model, samples, warmups: 3,
    measurement: 'Node/Vite SSR, independent cloned one-day states; dev profiler enabled, phases inclusive. Not a browser scheduler benchmark.' }, scenarios: {} };
  const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  for (const scenario of ['USA', 'BRA', 'AND', 'TUV', 'wars', 'expansion']) {
    const player = ['wars', 'expansion'].includes(scenario) ? 'AND' : scenario;
    const normal = activationTickParams(player);
    if (scenario === 'wars') normal.wars = [war('AND', 'TUV'), war('SMR', 'TUV'), war('MCO', 'TUV'), war('LIE', 'VAT'), war('LUX', 'MLT'), war('ISL', 'CYP')];
    if (scenario === 'expansion') {
      const ownerById = new Map(normal.provinces.map(p => [p.id, p.owner]));
      const province = normal.provinces.find(p => p.owner === 'FRA' && p.neighbors.some(id => ownerById.get(id) === 'DEU'));
      if (!province) throw new Error('Expansion fixture must acquire a real German land border');
      const moved = transferProvince({ ...normal, constructions: normal.buildingConstructions }, province.id, player);
      Object.assign(normal, moved, { buildingConstructions: moved.constructions });
    }
    const cycle = diplomacyWorld('proposalCycle').date;
    const activation = buildSimulationActivation({ ...normal, date: normal.snapshot.date });
    const row = { playerCountryTag: player, ...activation.summary, activationMilliseconds: [], normal: {}, diplomacyCycle: {} };
    for (let i = -3; i < samples; i++) {
      const start = performance.now(); buildSimulationActivation({ ...normal, date: normal.snapshot.date });
      if (i >= 0) row.activationMilliseconds.push(performance.now() - start);
    }
    row.activationMedian = median(row.activationMilliseconds);
    for (const mode of ['normal', 'diplomacyCycle']) {
      const phaseSamples = { before: [], after: [] };
      // Alternate before/after order to reduce warmup/order bias.
      for (let sample = -3; sample < samples; sample++) for (const label of sample % 2 ? ['after', 'before'] : ['before', 'after']) {
        const data = structuredClone({ countries: normal.countries, provinces: normal.provinces, armies: normal.armies,
          wars: normal.wars, relations: normal.relations, currentBotTechStates: normal.currentBotTechStates });
        const profiler = createAITickProfiler(true);
        const p = { ...normal, ...data, profiler, ceilingLogRef: { current: new Set() },
          snapshot: { date: mode === 'normal' ? normal.snapshot.date : cycle }, buildingConstructions: [], recruitments: [] };
        const start = performance.now(); (label === 'before' ? before : after)(p);
        const elapsed = performance.now() - start;
        if (label === 'after') row[mode].activation = profiler.last.simulationActivation;
        if (sample >= 0) phaseSamples[label].push({ elapsed, ...profiler.last.phases });
      }
      for (const label of ['before', 'after']) row[mode][label] = Object.fromEntries(
        ['elapsed', 'botEconomicDecisions', 'botMilitaryAI', 'diplomacyAI', 'buildLogisticsNetworks', 'simulationActivation']
          .map(key => [key, median(phaseSamples[label].map(p => p[key]))]));
      console.info(`[Activation] ${scenario} ${mode} FULL=${row.fullCountries} PASSIVE=${row.passiveCountries} AI=${row[mode].before.elapsed.toFixed(2)} -> ${row[mode].after.elapsed.toFixed(2)}ms activation=${row.activationMedian.toFixed(3)}ms`);
    }
    results.scenarios[scenario] = row;
  }
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/simulation-activation-v1-benchmark.json', JSON.stringify(results, null, 2) + '\n');
} finally { await server.close(); }
