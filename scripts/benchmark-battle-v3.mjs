import { createServer } from 'vite';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({ server: { hmr: false }, logLevel: 'error' });
try {
  const { startContinuousBattle, processBattleDay, checkAllProvinceCombats } = await server.ssrLoadModule(process.argv[3] ?? '/src/engine/combat/index.ts');
  const date = { year: 1500, month: 1, day: 1 };
  const province = (id, owner, extra = {}) => ({ id, name: id, owner, neighbors: ['a-home', 'd-home'], population: { total: 100000, growthRate: 0, employed: 0, unemployed: 100000, satisfaction: 60 }, maxPopulation: 100000, development: 1, buildings: [], defense: 0, center: { x: 0, y: 0 }, path: '', unrest: 0, ...extra });
  const army = (id, owner, strength, location = 'front') => ({ id, name: id, owner, location, regiments: [{ type: 'infantry', strength, maxStrength: 1000, organization: 100, morale: 100 }], destination: null, targetDestination: null, path: [], movementProgress: 0, movementSpeed: 1, position: null });
  const homes = [province('a-home', 'ATT'), province('d-home', 'DEF')];
  const balance = [];
  for (const [name, strength, extra, air] of [['A', 10000, {}, 1], ['B', 15000, {}, 1], ['C', 10000, { terrain: 'mountains' }, 1], ['D', 10000, { defense: 5, buildings: [{ type: 'fortress', level: 5, daysRemaining: 0 }] }, 1], ['E', 10000, {}, 1.08], ['F-large', 30000, {}, 1], ['G-overwhelming', 50000, {}, 1], ['H-skirmish', 1000, {}, 1]]) {
    const field = province('front', 'DEF', extra);
    let armies = [army('a', 'ATT', strength), army('d', 'DEF', name === 'F-large' ? 30000 : name === 'H-skirmish' ? 1000 : 10000)];
    let battle = startContinuousBattle([armies[0]], [armies[1]], field, date, name);
    let result, days = 0;
    do { result = processBattleDay(battle, armies, field, [field, ...homes], new Map([['ATT', air],['DEF',name === 'E' ? .97 : 1]])); battle = result.battle; armies = result.armies; days++; } while (!result.finished && days < 200);
    balance.push({ name, days, winner: result.winner, attackerCasualties: battle.attackerCasualties, defenderCasualties: battle.defenderCasualties, organization: [battle.attackerFinalCombatSnapshot?.organization, battle.defenderFinalCombatSnapshot?.organization], endReason: battle.endReason, retreat: result.retreatInfo });
  }
  const measure = fn => { for (let i = 0; i < 10; i++) fn(); const values = []; for (let i = 0; i < 50; i++) { const t = performance.now(); fn(); values.push(performance.now() - t); } values.sort((a,b) => a-b); return { medianMs: values[25], p95Ms: values[47] }; };
  const cases = [];
  for (const [count, perSide, reinforcement, air] of [[0,1,false,false],[10,1,false,false],[25,1,false,false],[50,1,false,false],[25,3,false,false],[25,3,true,false],[25,1,false,true]]) {
    const fields = Array.from({ length: count }, (_, i) => province(`f${i}`, 'DEF'));
    const armies = fields.flatMap(p => ['ATT','DEF'].flatMap(tag => Array.from({ length: perSide }, (_, i) => army(`${p.id}-${tag}-${i}`, tag, 10000, p.id))));
    const battles = fields.map(p => startContinuousBattle(armies.filter(a => a.location === p.id && a.owner === 'ATT'), armies.filter(a => a.location === p.id && a.owner === 'DEF'), p, date, p.id));
    const extras = reinforcement ? fields.map(p => army(`extra-${p.id}`, 'ATT', 5000, p.id)) : [];
    const wars = [{ attacker: 'ATT', defender: 'DEF' }];
    cases.push({ count, perSide, reinforcement, air, arrival: measure(() => checkAllProvinceCombats([...armies,...extras], fields, wars, date, battles)), continuous: measure(() => battles.map((b,i) => processBattleDay(b, armies, fields[i], [...fields,...homes], new Map(air ? [['ATT',1.08],['DEF',.97]] : [])))), finalization: measure(() => battles.map((b,i) => processBattleDay(b, armies.map(a => a.owner === 'DEF' ? {...a, regiments:a.regiments.map(r => ({...r, organization:0}))} : a), fields[i], [...fields,...homes]))) });
  }
  await mkdir('artifacts', { recursive: true });
  const report = { node: process.version, balance, cases };
  await writeFile(process.argv[2] ?? 'artifacts/battle-v3-benchmark.json', JSON.stringify(report,null,2));
  console.log(JSON.stringify(balance,null,2));
} finally { await server.close(); }
