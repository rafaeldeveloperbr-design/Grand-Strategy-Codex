# Diplomacy AI spike audit (Performance Pass V1, stage 2B)

## Reproduced cause

`processDiplomacyAI` is normally a proposal-response pass. Every 30 days it
also maintains guarantees, alliance/NAP breaks and war calls. Every 90 days
it additionally evaluates and sorts proactive proposals. These cadences remain
unchanged.

The 90-day pass visited 40,000 ordered country pairs in the real world
(201 countries, excluding the player as an initiator; 20,100 relations).
For each pair, the old implementation scanned the relations array for lookups
and allies. `hasStrategicThreat` then scanned countries again, recalculated
military power from armies/countries, and repeatedly rebuilt province-owner
Maps in `areNeighbors`. Access-route BFS also performed linear relation
lookups for traversed borders.

A focused pre-optimization trace reproduced 61,480 ms in one call:

| Subphase | Time |
| --- | ---: |
| Strategic threat | 40,162 ms |
| Political ties / allies | 9,828 ms |
| Relation lookup / maintenance evaluation | 7,022 ms |
| Access logic | 3,022 ms |

Maintenance alone had approximately 3,404 ms in relation evaluation.
The dominant cost was repeated reads and temporary index construction,
not a recursion, JSON clone, proposal expiry loop, or autonomous declaration.
`processDiplomacyAI` does not call `declareWar`: war-call acceptance uses
`respondToWarCall` / campaign joining. Expiration cleanup remains in
`processDiplomacyTick`; AI retains its existing skip of expired proposals.

The old read path included `O(C^2 * R)` full-relation scans and a country
triple-loop with repeated `O(A + C + P)` work (and additional relation reads
on shared-neighbor checks). Access traversals could multiply graph-edge visits
by `R`. Here C is countries, R relations, A armies and P provinces.

## Correction and invariants

`DiplomacyAIIndex` builds ephemeral country, relation, ally, proposal, power,
war, campaign, enemy, province, neighbor and army-location indexes on demand.
Quiet ticks without actionable proposals do not build them. Pair/country,
power and access reads are constant-time lookups. Strategic-threat checks
inspect shared neighbors instead of all countries and reuse the owner index.
Access BFS uses the same origins, graph, traversal order and objective checks;
only relation lookup and index construction change.

Country/pair iteration, scores, candidate sorting, acceptance rules, limits,
cooldowns and engine mutation functions remain unchanged. Indexes refresh
after every immutable state transition. Single-pair changes refresh that pair;
war-call joins rebuild relation indexes because they may change several pairs.
Nothing is cached across ticks. Canonical lookup retains the first legacy
duplicate, while ally/guarantee selectors retain every matching row and order.

The new path pays one world-index construction, then pair-local reads and
neighbor/ally-list work instead of repeated global scans. Existing immutable
relation writes still cost `O(R)` per update; this pass does not redesign them,
the engine, military AI, economy AI, or the game scheduler.

## Instrumentation

The development-only subprofiler measures proposal collection/evaluation,
relation evaluation, neighbors, political ties, strategic threat, alliance,
access, NAP, war evaluation, war calls, relation updates, sorting, index work,
other time and TOTAL. It records phase count/total/max, the slowest pair,
the date and counts of countries, relations, wars, proposals and pair visits.

`[DiplomacyAI Slow Phase]` reports individual or cumulative subphases strictly
above 500 ms with compact context and maximum individual duration.
Existing `[AI Slow Phase]` warnings remain active. Each 60-tick `[GameLoop]`
window exposes the last diplomacy trace and the most expensive diplomacy
trace in `aiBreakdown.diplomacyAI` / `aiBreakdown.diplomacyAIMax`.

## Local benchmark

Windows x64, Node 24.21.0, Intel i5-11400F; profiling enabled.
Three baseline repetitions and nine optimized repetitions, reusing an unchanged
input snapshot per scenario. Each output was checked against the exact baseline
relations, wars and messages, including array order (SHA-256 comparison when
reusing the saved baseline). These are observations, not functional-test limits.

| Scenario | Before median | After median | Before p95/max | After p95/max |
| --- | ---: | ---: | ---: | ---: |
| Quiet day | 0.76 ms | 0.97 ms | 1.11 ms | 1.13 ms |
| 30-day maintenance | 3,621.85 ms | 260.71 ms | 3,790.52 ms | 274.19 ms |
| 90-day proposal cycle | 57,118.52 ms | 348.17 ms | 61,841.49 ms | 386.11 ms |

Small sample sizes make p95 equal to max here. Full records are in
`artifacts/diplomacy-ai-baseline.json`, `artifacts/diplomacy-ai-benchmark.json`
and `artifacts/diplomacy-ai-cycle-profile.json`.

Reproduce both versions (the baseline intentionally takes minutes):

```sh
npm run benchmark:diplomacy-ai -- --samples=3
```

Recheck the current implementation against the saved baseline:

```sh
npm run benchmark:diplomacy-ai -- --after-only --samples=9
```

The frozen pre-index implementation is only a test/benchmark oracle. Functional
tests use it on smaller worlds, and exact baseline hashes on the full world so
they keep their existing timeout. No timeout was increased or timing-dependent
functional threshold introduced.

## Validation

21 new regression/profiling cases; 1,673 tests pass in 68 files with
`npm run test:run -- --maxWorkers=2`. The unmodified default parallel run
twice hit the existing 5-second timeout in the 30-full-world-economy-ticks
test; reducing worker contention passed without changing that timeout, test,
configuration, or economy code. Lint, typecheck, build and `git diff --check`
pass. Build retains its existing large-bundle warning.
