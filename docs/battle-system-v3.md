# Battle System V3

## Audit before the change

The daily game loop moves armies, completes amphibious landings, calls
`processBattleArrival`, then `processBattleContinuous`, then War Resolution.
Amphibious completion already produced the ordinary `arrivedArmies` input.
The arrival hook transferred empty hostile provinces with `transferProvince`;
the continuous hook accounted for population losses and the campaign ledger.
The working tree was clean before this task. No commit or push was performed.

The former continuous model already stored participant IDs and side membership,
but used representative owners for air modifiers, reinforcement reports and
parts of conquest/history. It rescanned armies and provinces repeatedly. It
also silently discarded an active battle when a side disappeared during arrival,
skipping its final report. Detection required a defender owned by the province,
missing battles between hostile armies in third-country territory and some
civil conflicts. Battle IDs used wall-clock time and uncontrolled randomness.

Former daily pressures were:

```
attacker = (attack + .45 * shock) * air * supply
defender = (attack + .35 * defense) * air * supply * (1 + fort) * terrainDefense
strengthLoss = floor(sideTroops * .018 * opposingPressure / ownPressure)
organizationLoss = 12 * opposingPressure / ownPressure
moraleLoss = .35 * organizationLoss
```

Attack/defense/shock come from `calculateArmyCombatStats`: unit definitions,
strength relative to regiment maximum, organization, morale, experience and
unit-specific technology. Fort resistance included provincial defense, building
defense, siege and the existing military fort cap. Supply came from logistics.

Loss allocation exhausted the first army before touching the next. Organization
was only applied while strength casualties remained, allowing later armies to
avoid organization pressure altogether. Defender application used armies already
damaged that day. Army order consequently influenced outcomes. Side break used
unweighted organization/morale averages or a troop threshold of 50.

Battles also ended on a fixed countdown: 1 day below 1,000 troops, 3 below 2,500,
otherwise approximately `floor(smallerForce / 1500)`. Terrain and forts raised
defender pressure without reducing tempo, so difficult terrain often *shortened*
combat. Before-change fixtures A–E ended in 5, 5, 4, 3 and 6 days.

`battleResolver` and `battleFinalizer` are old compatibility exports; repository
search found no production callers. The live loop uses continuous combat only.
Their legacy one-shot formulas were not turned into a second V3 implementation.

## Canonical state and lifecycle

`ActiveBattle` keeps stable attacker/defender country identities and explicit
`participantSides`. Representatives remain UI/fallback identities and are repaired
from sorted valid participants; losing a representative does not end its side.
Added fields are optional for compatibility: `durationDays`, `phase`, initial
participant sizes/snapshots, per-country air modifiers and retreat outcomes.

`battleParticipants.ts` supplies common participant, validity, membership,
hostility and reinforcement-side helpers. Valid combat participants must have
positive strength, be on land in the battle province and be outside retreat
protection. Campaign hostility is indexed once per tick. Consistent campaign
pairs expand to opposing participant countries. Contradictory campaigns do not
expand; armies hostile to both sides cannot reinforce either. Neutral armies
never enter. Existing legacy/modern rebel hostility semantics are shared by
arrival and continuous processing. Diplomacy V2 was not changed.

Arrival indexes armies by ID/province and battles by province/army. It repairs an
existing battle, adds compatible reinforcements, and creates at most one battle
per province from sorted hostile participants. Stale sides stay queued for the
finalizer instead of disappearing. Each army belongs to at most one active
battle, including corrupted duplicate input. Reinforcement is idempotent,
records its actual initial strength, and never resets elapsed days.

An empty hostile province is transferred without a fake battle. Ordinary
occupation still requires the existing direct war pair; established rebel
liberation remains allowed. Landings use this exact arrival hook. No naval
combat, transport, landing penalty or air internals were changed.

## V3 damage and organization

All land balance constants are in `src/engine/combat/battleConfig.ts`.
The existing attack/defense, technology, supply, siege and fort formulas are
retained. Air multipliers are applied to each country's own army statistics
before aggregation, rather than to the whole coalition through a representative.

For each side, using the same pre-round snapshot:

```
ratio = clamp(opposingPressure / max(1, ownPressure), .2, 4)
scale = clamp(sqrt(10000 / smallerForce), .5, 3)
tempo = scale * terrainTempo / (1 + 4 * fortBonus)
tempo *= .55 during the first two rounds
strengthLoss = floor(sideTroops * .008 * tempo * ratio)
organizationLoss = 5.5 * tempo * ratio
moraleLoss = .15 * organizationLoss
```

Both sides' losses are calculated before either is applied. Strength losses are
distributed in proportion to current army strength, with integer remainders
assigned by sorted ID. The existing `applyTroopLoss` updates regiments.
Organization pressure reaches every participant even when rounded casualties
are zero. Experience still uses the existing military daily gain.

An army is combat capable above 18 organization and with positive strength.
Armies at/below the threshold no longer generate attack pressure. A zero-pressure
opponent deals no strength or organization damage; the positive-pressure ratio
clamp only applies to combat-capable opposition. A
side breaks when **all** remaining armies are destroyed or at/below that
organization threshold. Morale still affects existing combat stats and recovery;
it is no longer a second independent immediate defeat condition. There is no
third morale bar. On simultaneous break, the existing deterministic remaining
military-condition comparison chooses a result, with defender winning ties.

`ENGAGEMENT` describes the opening two rounds; `MAIN_COMBAT` follows;
`BREAK_RETREAT` records final processing. There is no maximum/minimum battle
timer and no countdown defeat. Legacy `daysTotal`/`daysRemaining` fields are
maintained as compatibility counters; V3 uses elapsed `durationDays`.

Terrain tempo is plains 1, forest .8, jungle .65, hills .75, mountains .32,
desert .85. Existing terrain defense still applies once. Difficult terrain
reduces both daily strength and organization loss, while favoring defenders.
Fortification slows both sides in addition to increasing defensive resistance;
the existing bounded fort/siege calculation prevents invincibility.

## Air Warfare V1.1

The official `getAirSuperiorityModifier` and `getAirSupportForBattle` APIs are
called once per participating country per battle day. The former consumes the
official province superiority/zone-control APIs internally. V3 does not duplicate
range, mission, aircraft, coalition support or superiority calculations.

The audited current API returns superiority in **.97–1.03** and CAS in **0–.05**;
the combined multiplier is `superiority + CAS`, with baseline exactly 1.
The request's .97–1.08 example corresponds to the combined upper bound, not a
separate superiority multiplier. API bounds are unchanged. The multiplier
affects combat effectiveness and therefore both casualty and organization
pressure. CAS cannot create a battle or independently issue retreat.

Fixture E uses the contract maximum for one side (1.03 + .05) and .97 for its
opponent. Actual mission/range/API integration is also covered in tests.

## Retreat, conquest and accounting

Each defeated surviving army checks adjacent land neighbors. Prefer its own
province, then legally accessible non-hostile territory. Exclude enemy-occupied
destinations, embarked blockers and armies under retreat protection. Break ties
by province ID. No worldwide pathfinding is introduced.

The existing instantaneous adjacent relocation contract is retained. Automatic
and manual retreat clear incompatible movement plans and give a configurable
two-day `retreatProtectionDays` counter plus the source battle ID. Protected
armies cannot fight, occupy, receive normal movement/waypoint orders or be
reorganized. The movement tick advances protection. Winners remain, leave combat
and clear stale battle targets; existing onward waypoint plans can continue.

No legal neighbor means all actual surviving regiment strength is lost and
`retreatOutcomes[id].reason = no_retreat` is recorded. Mixed retreat/annihilation
outcomes retain each army's destination/reason. Pursuit penalties were deliberately
left out: normal defeat is an organization break with survivors.

Manual last-side withdrawal queues a `BREAK_RETREAT` record for the same daily
finalizer, rather than bypassing history and the casualty ledger. The manual API
still returns its immediate active-list result for older direct callers.

The finalizer verifies that no remaining unprotected hostile army blocks
occupation and calls **only `transferProvince`**. Country territory lists,
population, unrest, market, construction and recruitment therefore follow the
existing transfer contract. No production battle code directly assigns owner.

Each round observes actual before/after regiment strength. That single delta
feeds `applyMilitaryCasualties` by origin province and a persisted per-country
battle casualty ledger. Organization never reduces population. Annihilation
includes all remaining men in the same delta. Completion calls
`recordBattleWarCasualties` once per battle ID, preserving campaign IDs and
`recordedBattleIds`. War Resolution formulas were not changed.

Reports use initial/final snapshots for **every** participant, including removed
armies and allies; totals and losses are aggregated by side and country.
History deduplicates battle IDs. Hostility ending or a missing province releases
participants and records a cancellation reason without awarding conquest or
political victory changes. A missing valid side is finalized normally.

## Save/load and presentation

Save V3 persists the additive active-battle fields and army retreat protection.
`normalizeBattleSave` repairs legacy identities, sides, elapsed duration and
phase; it removes duplicate battle/province/army membership without creating
arrival events. Rebel-tag migration also handles participant snapshots and
casualty-ledger keys. Current V3 rounds resume deterministically after load.

Battle history is now an optional additive military save field, written by
manual save/autosave and restored/deduplicated on load. Legacy saves lacking
history load with an empty historical list. Legacy migration preserves known original snapshots, reinforcement sizes and
exact aggregate initial strength by side, including losses from before load.
Unknown individual initial sizes are inferred proportionally from survivors;
old saves that never stored those sizes cannot recover the exact per-army
distribution. Current V3 saves persist all individual initial sizes.

The active map panel shows both sides' weighted organization, aggregate strength,
army count, participant list, elapsed duration, terrain, fort and air modifiers.
Markers show elapsed days rather than a misleading fixed countdown. Reports
show participants, country casualties, air values and retreat/annihilation reason
alongside the existing side statistics. The report heading receives initial
keyboard focus so long reports open at their heading, not scrolled to the footer.

## Balance fixtures

Results are deterministic engine fixtures, not machine-time thresholds. Infantry
forces use the catalog's 1,000-man regiment scale, full organization/morale,
no technology advantage, and legal home retreat provinces. The browser uses
real-world logistics and normal AI, so it can produce different durations.

| Fixture | Forces / setting | Old days | V3 days | V3 attacker loss | V3 defender loss |
|---|---|---:|---:|---:|---:|
| A | 10k / 10k, plains | 5 | 12 | 1,247 | 617 |
| B | 15k / 10k, plains | 5 | 11 | 817 | 1,173 |
| C | 10k / 10k, mountains | 4 | 23 | 1,189 | 262 |
| D | 10k / 10k, fortress 5 | 3 | 20 | 1,127 | 173 |
| E | 10k / 10k, bounded air support | 6 | 14 | 1,219 | 861 |
| F | 30k / 30k, plains | 5 | 19 | 3,512 | 1,755 |
| G | 50k / 10k, plains | 2 | 5 | 346 | 1,277 |
| H | 1k / 1k, skirmish | 1 | 5 | 129 | 67 |

A–E average **16 days** (old average 4.6). All V3 balance fixtures end through
organization break and legal retreat; the defeated side normally keeps about
87–89% of its strength. Lower daily losses do not imply lower *total* losses in
every scenario, because the fight now lasts longer. Terrain/fortification and
scale targets emerge from pressure/organization, with no fixed duration.

## Performance, profiler and verification

Arrival uses ephemeral `armyById`, `armiesByProvince`, `battleByProvince`,
`battleByArmy` and campaign-hostility indexes. Combat operates on participants
and merges the army world list once per round; it does not repeatedly scan all
armies for side membership. Logistics snapshots only build owner networks that
can participate. Zero active battles skip continuous combat setup entirely.
Province/army arrays remain the public immutable game-loop contract.

The existing `battleArrival` and `battleContinuous` profiler phases are preserved.
Dev profiler windows also collect active battles, participants, reinforcements,
retreats, annihilations and actual battle casualties. No new per-tick logging.

`npm run benchmark:battle-v3` records warm median/p95 timings for 0, 10, 25 and 50
battles, multi-army, reinforcement-heavy and air-supported cases. It measures
arrival, participant combat, and a broken-side round including retreat/finalization.
Timings describe this host only. Raw results and before-change samples are in
`artifacts/battle-v3-benchmark.json` and `artifacts/battle-v3-baseline.json`.
The microbenchmark does not include React rendering or full-world economic ticks.

62 new tests in `battleV3.test.tsx` cover side membership, 1v1/2v1/1v2/3v3,
representative removal, coalition accounting, deterministic rounds/retreat,
terrain/fort duration, zero-rounded casualties, air API integration, population,
once-only campaign/history recording, transfer contract, protected movement and
reorganization, stale sides, real save/load continuation, report rendering and
active-panel aggregation. Existing Amphibious V1 tests exercise actual defended
and empty landings through the same arrival path. Old timeout-based combat,
terrain, movement and revolt tests were updated to assert intentional V3 behavior.

`npm run smoke:battle-v3` runs disposable Chrome against the real app, loads
public Save V3 fixtures, observes BRA/ARG battles in x3, saves/loads mid-battle,
checks reinforcement, terrain, forts, air, retreat, annihilation and reports.
Screenshots and machine-readable results are under `artifacts/battle-v3-*`.
Final measured medians (milliseconds):

| Battles / scenario | Arrival | Continuous | Finalization |
|---|---:|---:|---:|
| 0 | 0.003 | 0 | 0 |
| 10 | 0.125 | 0.350 | 0.317 |
| 25 | 0.163 | 0.685 | 0.737 |
| 50 | 0.254 | 1.187 | 1.606 |
| 25, 3v3 | 0.310 | 1.380 | 1.960 |
| 25, 3v3 with reinforcement | 0.490 | 1.318 | 1.802 |
| 25, air support | 0.124 | 0.393 | 0.640 |

The original 50-battle medians were 0.731 / 1.179 / 1.545 ms respectively.
Arrival improved substantially; continuous/finalization timings do not establish
a speedup. The immutable daily wrapper still merges world armies, and supply,
retreat and population integration retain some world-array work. These results
are a microbenchmark, not a claim that the entire game loop is independent of
world size. Raw artifacts include p95 values; host scheduling adds noise.

The final real-browser checklist passed all seven scenes with **zero browser
errors**: plains (8 days), mountains (21), fortress (15), air (8), reinforcement
(13), no-route annihilation (1), and actual amphibious arrival/combat (15).
Mid-battle save/load preserved one active battle and elapsed time. Completed
battles produced history/reports once and left no original active battle.
Normal AI remains enabled: the amphibious scenario includes recruitment and
counterattack, so its 11,000 attacker losses are not a static 10k-vs-10k fixture.
Defended and empty landing semantics are also covered by the existing direct
Amphibious V1 integration tests.

Final checks: `npm run lint`, `npm run typecheck`,
`npm run test:run -- --maxWorkers=2` (**93 files, 2,431 tests passed**),
`npm run build`, and `git diff --check` passed. Build retains the existing Vite
large-chunk warning. No commit or push was made. Naval Combat, Air internals and
War Resolution formulas were not changed.

## Remaining limits

Retreat is the existing instant adjacent relocation, with short explicit
protection; no animated retreat march or pursuit model. Long-range alternative
escape routes are not searched. No weather, generals, complex width, tactics,
airborne units, shore support, air/naval rebalance, construction changes,
World Wrap or Peace Conference were introduced. Fortified battles can exceed
45 days; there is deliberately no timer that kills otherwise valid combat.
Manual withdrawal of the final participant queues `BREAK_RETREAT` for the next
continuous tick, which performs the same centralized reporting/accounting as an
automatic retreat.
