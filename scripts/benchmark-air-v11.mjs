import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const samples = 100, warmups = 20;
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { countries, provincesData: provinces, mapMetadata } = await server.ssrLoadModule('/src/data/map/index.ts');
  const air = await server.ssrLoadModule('/src/engine/air/index.ts');
  const { AirLayer } = await server.ssrLoadModule('/src/components/GameMap/AirLayer.tsx');
  const state = air.createInitialAirState(countries, provinces), ctx = { provinces, countries, wars: [], relations: [] };
  const results = [];
  const measure = (name, run, extra = {}) => {
    const times = [];
    for (let i = 0; i < samples + warmups; i++) { const begin = performance.now(); run(); if (i >= warmups) times.push(performance.now() - begin); }
    const sorted = [...times].sort((a, b) => a - b);
    results.push({ name, ...extra, averageMs: times.reduce((a, b) => a + b, 0) / samples, medianMs: sorted[Math.floor(samples / 2)], p95Ms: sorted[Math.floor(samples * .95)] });
  };
  for (const activeBases of [0, 20, 50]) {
    const production = { nextId: activeBases + 1, queues: {} };
    for (const [i, base] of air.airBases.slice(0, activeBases).entries()) production.queues[base.provinceId] = [{ id: `air-build-${i + 1}`, countryTag: provinces.find(p => p.id === base.provinceId).owner, provinceId: base.provinceId, type: 'FIGHTER', progress: 20, requiredProgress: 120 }];
    measure(`production-${activeBases}-active-bases`, () => air.processAirProductionTick({ ...state, production }, provinces, countries), { activeBases });
  }
  const noop = () => {};
  for (const mode of [false, true]) measure(mode ? 'markers-air-mode' : 'markers-normal-mode', () => renderToStaticMarkup(React.createElement('svg', null, React.createElement(AirLayer, { part: 'markers', mode, state, ctx, player: 'BRA', scale: 1, viewport: mapMetadata.bounds, onWing: noop, onZone: noop, onBase: noop }))), { wings: state.wings.length, measurement: 'React SSR marker rendering; excludes browser paint' });
  const fighter = state.wings.find(w => w.countryTag === 'BRA' && w.type === 'FIGHTER');
  measure('right-click-command-dispatch', () => air.resolveAirTarget(state, { kind: 'MISSION', wingId: fighter.id, mission: 'AIR_SUPERIORITY' }, fighter.baseProvinceId, 'BRA', ctx));
  const report = { samples, warmups, node: process.version, results };
  await writeFile('artifacts/air-warfare-v1.1-benchmark.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await server.close(); }
