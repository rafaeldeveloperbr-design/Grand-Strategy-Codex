import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
const server = await createServer({ server: { hmr: false }, logLevel: 'error' });
try {
  const { countries, provincesData } = await server.ssrLoadModule('/src/data/map/index.ts');
  const { createInitialNavies, portByProvince, amphibiousTick, buildTransportIndexes, resolveTransportLosses } = await server.ssrLoadModule('/src/engine/naval/index.ts');
  const fleet = createInitialNavies(countries, provincesData).find(f => f.countryTag === 'BRA');
  const target = provincesData.find(p => p.owner === 'ARG' && portByProvince.has(p.id));
  const date = { year: 1444, month: 11, day: 1 };
  const wars = [{ id: 'bench-war', attacker: 'BRA', defender: 'ARG', startDate: date, warScore: 0, attackerCasualties: 0, defenderCasualties: 0, occupiedByAttacker: [], occupiedByDefender: [] }];
  function stats(fn) {
    for (let i = 0; i < 30; i++) fn();
    const samples = [];
    for (let i = 0; i < 200; i++) { const start = performance.now(); fn(); samples.push(performance.now() - start); }
    samples.sort((a, b) => a - b);
    return { samples: samples.length, medianMs: samples[100], p95Ms: samples[190], meanMs: samples.reduce((a, b) => a + b, 0) / samples.length };
  }
  const report = { environment: { node: process.version, platform: process.platform }, countries: countries.length, provinces: provincesData.length, cases: [] };
  for (const [count, activeLandings] of [[0, 0], [10, 0], [50, 0], [20, 20]]) {
    const fleets = Array.from({ length: Math.max(1, count) }, (_, i) => ({ ...structuredClone(fleet), id: `bench-fleet-${i}`, portProvinceId: undefined, locationSeaNodeId: portByProvince.get(target.id).seaNodeId, status: 'HOLDING' }));
    const armies = Array.from({ length: count }, (_, i) => ({ id: `bench-army-${i}`, owner: 'BRA', name: `Army ${i}`, location: null, embarkedFleetId: fleets[i].id, destination: null, targetDestination: null, path: [], movementProgress: 0, movementSpeed: 1, position: null, regiments: [{ type: 'infantry', strength: 3600, morale: 100, originProvinceId: fleet.portProvinceId }] }));
    const naval = { fleets, battles: [], invasions: fleets.slice(0, activeLandings).map((f, i) => ({ fleetId: f.id, armyIds: [armies[i].id], targetProvinceId: target.id, targetOwner: 'ARG', seaNodeId: f.locationSeaNodeId, status: 'LANDING', landingDays: 1 })) };
    const damaged = { ...naval, fleets: fleets.map(f => ({ ...f, units: f.units.filter(u => u.type !== 'TRANSPORT') })) };
    report.cases.push({ transportedArmies: count, activeLandings, transportBookkeeping: stats(() => buildTransportIndexes(armies)), landingTick: stats(() => amphibiousTick(naval, armies, provincesData, wars)), capacityHandling: stats(() => resolveTransportLosses(naval, armies, provincesData)), capacityLossHandling: stats(() => resolveTransportLosses(damaged, armies, provincesData)) });
  }
  await writeFile('artifacts/amphibious-invasion-v1-benchmark.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await server.close(); }
