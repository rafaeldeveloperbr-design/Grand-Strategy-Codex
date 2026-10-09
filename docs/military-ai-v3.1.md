# Military AI V3.1 — recovery, recent defeat and order deduplication

## Audit and root cause

The active military entry point is `processAI` in `src/engine/aiEngine/aiMovement.ts`, called by `processAiTick` under the `botMilitaryAI` profiler phase. There are no active functions named `aiMilitary` or `botMilitaryDecisions` in this repository.

Previously the AI prioritized capital defense, reinforcement rendezvous, logistics retreat, enemy-army evaluation, territorial objectives, and peaceful frontier positioning. Effective power already included canonical organization, morale, supply, unit stats, troop size, terrain and fortification. However organization only reduced estimated power: it was not a hard readiness gate. Enemy attacks used a normal ratio of 1.20 (cautious 1.50), comparing against one selected enemy army. Territorial fallback could bypass the final destination force check entirely. A defeated army could therefore resume offensive marching after its two-day retreat protection, before recovering organization.

Battle V3 clears defeated armies' routes and target locks and retreats surviving losers to a safe province. Its short `retreatProtectionDays` was the only existing relevant cooldown. Military AI's local route builder wrote movement fields directly and did not explicitly honor that protection. There was no strategic defeat memory to reuse.

Military AI already leaves armies with an active `destination` unchanged. Destination churn for active marches was therefore already prevented. The missing pieces were equivalent-order checks for the other destination contracts and the shared group movement adapter. The exact message “2 exércitos receberam ordem para Chaco.” originates in `groupMovementFeedback`, called by the UI `useArmyActions` hook; the military AI itself does not emit that message. Group commands previously rebuilt every requested route and counted every successful return as a new order. V3.1 fixes the underlying shared command contract without adding an AI notification system.

## Rules and final constants

| Constant | Value |
| --- | ---: |
| `MIN_OFFENSIVE_ORGANIZATION` | 50% |
| `RECENT_DEFEAT_DAYS` | 10 daily ticks |
| `NORMAL_ATTACK_RATIO` | 1.20 |
| Existing cautious attack ratio | 1.50 |
| `RECENT_DEFEAT_ATTACK_RATIO` | 1.50 |
| `CAUTIOUS_RECENT_DEFEAT_ATTACK_RATIO` | 1.60 |

Constants and `canInitiateOffensive` / `getRequiredAttackRatio` live in `militaryRecovery.ts`. Organization uses `calculateArmyOrganization`: a strength-weighted average normalized against each unit definition's maximum, not raw regiment organization.

An AI army below 50% holds in friendly territory without hostile stacks. In an unsafe position it can use existing defensive province scoring and routing to reposition. Recovery routes cannot pass through hostile territory or hostile stacks. If no safe route exists, it holds rather than inventing an offensive fallback. Embarked armies, armies in combat and armies with retreat protection receive no land AI order. Low-organization armies cannot be selected as offensive reinforcement support. Player movement is not subject to the offensive organization threshold.

The existing `recoverArmy` still restores organization and morale through supply and national recovery modifiers. It does not recover marching, embarked or fighting armies. V3.1 introduces no independent recovery simulation and no recovery toasts.

Before offensive dispatch, effective attacking power is compared with the sum of all eligible hostile armies at the destination using the existing indexed province bucket. Attacking power does not borrow the current province's defensive terrain/fortification advantage. Defender terrain, fortification, organization, morale and logistics remain part of the estimate. Territorial targets are filtered before scoring, and the route helper checks again at dispatch, including hostile stacks in friendly provinces. Intermediate hostile stacks use the centralized required ratio too. Battle V3's damage model is unchanged.

The cautious condition remains War Resolution's existing side score <= -50 or surrender >= 60. Defeat memory adds to this posture; it does not replace it.

## Defeat memory and recovery lifecycle

`Army.recentDefeat` is additive:

```ts
recentDefeat?: {
  provinceId: string;
  battleId?: string;
  daysRemaining: number;
}
```

Surviving Battle V3 losers record the battle province and battle ID when retreat is finalized. Manual battle withdrawals record the same memory and clear target locks. This is additive bookkeeping in the existing retreat output; combat resolution, damage, reinforcement and mechanical retreat protection are unchanged.

The ten days start at defeat. The existing two-day retreat protection overlaps this strategic memory and remains mechanically independent. `processMovementTick` decrements the memory once per simulated day, globally, before ordinary movement. Repeated AI decisions do not consume it. This uses a persisted daily countdown rather than a new date epoch or AI clock.

At adequate organization, a retry against the recorded province requires 1.50 effective superiority, or 1.60 in cautious posture. The memory is a conditional penalty, not an absolute embargo: a weak or vacated target can become valid immediately after organization/protection requirements are satisfied. Another province remains available at the ordinary threshold. Expiration restores the ordinary threshold, but never bypasses the organization gate.

Daily maintenance removes expired memory, invalid province references, memory on armies with zero strength, and memory for absent countries. Removing an Army naturally removes its metadata. Annihilation outputs explicitly clear it. Splitting copies the memory; merging retains the memory with the longer remaining duration so automatic AI merges cannot silently erase recovery. Only one province is remembered per army; ties on merge retain the primary army's memory.

## Orders and groups

`hasEquivalentMovementOrder` in the existing `movementCommands.ts` checks `destination`, `targetDestination`, the final `path` element and `targetProvinceId`. All checks are O(1). An equivalent order returns the original Army object, preserving path identity, movement progress and plans. The military route helper uses the same predicate before path construction.

`orderArmyGroup` excludes identity returns from its updates map. A group of two with one already marching sends only one new order; a fully equivalent group sends none. `useArmyActions` already returns without feedback when updates and failures are both empty, so skipped duplicates cause no new log/toast/state update. Append-waypoint and clear-plan commands retain their existing semantics.

Active AI marches retain the existing destination rather than switching to a marginally better target each tick. Explicit player rerouting to a different target still works. This is the existing simple order commitment, not a new planning or hysteresis system.

## Activation and persistence

Simulation Activation is unchanged: `processAiTick` invokes military decisions only for FULL non-player countries. PASSIVE armies keep existing orders; ordinary movement and recovery continue, and defeat memory expires through global daily maintenance.

Save V3 already serializes Army objects intact, and existing migrations preserve additive fields. No version bump or alternate save schema is required. The compatibility validator accepts the optional memory only with a string province, positive integer duration and optional string battle ID. Saves without it continue to load with `undefined`. Saving while recovering preserves the countdown exactly; loading does not consume a day. Invalid world references are removed by the next daily maintenance pass.

## Performance

No new global Army × Province × Army scan is introduced. Local force checks reuse `MilitaryAIContext.armiesByProvince`; normal readiness/memory/order checks are constant-time apart from canonical regiment aggregation. Daily cleanup builds province/country sets once and scans armies once. Cautious posture is calculated once per bot. The existing route cache remains in use.

`scripts/benchmark-military-ai.mjs` now accepts `--baseline-module` and `--output`, allowing comparison against the exact pre-change implementation. A custom baseline verifies determinism within each version because intentional policy changes need not produce identical cross-version output. The default legacy optimization comparison still asserts cross-version equality.

Measured on this workspace, Node v24.21.0, seven samples, two warmups, profiling disabled, 201 countries / 494 provinces:

| Scenario | Before median | V3.1 median |
| --- | ---: | ---: |
| Peace | 7.52 ms | 7.18 ms |
| Wars | 8.45 ms | 8.63 ms |
| Many armies | 33.12 ms | 30.01 ms |

These small differences are timing observations, not a claimed universal speedup. The detailed report is `artifacts/military-ai-v3.1-benchmark.json`; the baseline was the repository's pre-change `aiMovement.ts`, loaded temporarily beside the current module and removed after benchmarking.

## Tests, validation and limitations

`militaryAI31.test.tsx` adds 36 tests: 0/20/49/50/70% readiness, normalized organization, retreat protection, defensive repositioning, player orders, local stacked defenders, deterministic decisions, normal/cautious/recent thresholds, alternative targets, clear superiority, expiration and cleanup, merge/split memory, every equivalent destination field, partial group dispatch, stable Chaco orders, explicit reroute, no duplicate UI feedback, the PRY/BRA defeat-recovery scenario, annihilation, FULL/PASSIVE dispatch and real Save V3 load with/without memory.

Existing suites cover Battle V3 reinforcement/retreat, War Resolution, Logistics, Movement Commands V2, Amphibious, Naval, Air and Simulation Activation. Validation also exposed old unrelated test expectations: missing `TopBar.provinces` props, old 1444 new-game dates (the app starts in 2020), and diplomacy messages queried as text instead of `title`. Only those fixtures/assertions were corrected; their production systems were not changed.

The policy is deliberately conservative and evaluates each independently ordered attacker against all local defenders. It does not promise coordinated multi-army assaults. It remembers one defeat province, preserves already active AI marches, and has no sophisticated fallback planner or user-facing debug panel. Strategic memory can be overcome before ten days by clear superiority; low organization cannot. No commit or push is performed.

Final checks: `npm run lint`, `npm run typecheck`, `npm run test:run -- --maxWorkers=2` (94 files, 2,467 tests passed), `npm run build`, and `git diff --check` passed. Build retains the existing large-bundle warning. Military AI and Battle V3 benchmarks completed; Battle V3's eight balance scenarios retained their combat outcomes.

The browser Battle V3 smoke completed plain, mountains, fortress, air, reinforcement and annihilation scenarios, including mid-battle save/load. It timed out at the amphibious fixture while waiting for a battle to start; a second run with plain/reinforcement/amphibious repeated that timeout. This browser fixture is therefore **not validated** by this change. No Amphibious production changes were made, and its automated regression tests pass in the full suite. The timeout's root cause has not been established. This limitation is distinct from the passing engine tests and benchmarks.

Changed implementation files: `aiEngine/aiMovement.ts`, new `aiEngine/militaryRecovery.ts`, `combat/continuousBattle.ts`, `combat/combatRetreats.ts` (metadata only), `military/movementCommands.ts`, `military/movementEngine.ts` (split/merge metadata), `military/saveCompatibility.ts`, `hooks/gameLoop/movementTick.ts`, `hooks/app/armyGroupCommands.ts`, and `types/army.ts`. Supporting changes: the new `militaryAI31.test.tsx`, five existing test files with corrected fixtures/assertions, `scripts/benchmark-military-ai.mjs`, this document, and the V3.1 benchmark reports in `artifacts/`.
