# Amphibious V1.3: friendly beach landing

## Audit and root cause

`disembarkArmy` only accepted a same-controller fleet `DOCKED` at a valid accessible port, resolving the land destination through `fleet.portProvinceId`. A fleet holding offshore after V1.2 extraction had no docked-port destination. Meanwhile, `planInvasion` required war with the target owner: a conquered beach was no longer a hostile target and could not reuse invasion planning. Friendly transport therefore had no beach disembarkation command.

V1.1 provides the canonical `coastalSeaNodes` index, lake/interior/disconnected-water guards and deterministic `resolveAmphibiousLandingSeaNode`. V1.2 provides the shared own/alliance/military-access naval contract, live cargo indexes and safe extraction cleanup. V1.3 reuses these contracts and `embarkedFleetId`; no coast metadata, naval graph, transport balance or Battle V3 implementation changes are needed.

## Explicit peaceful operation

`startFriendlyBeachLanding` is separate from `planInvasion`. It accepts one or several embarked army IDs and a target province. Group validation is atomic and duplicate IDs are removed. The owning controller is the actor; this is not a player-only API.

The fleet must be same-controller, `HOLDING`, stationary at the target's exact canonical SeaNode, without docking, a pending route, invasion or beach extraction. The army must still be live cargo, not fighting or retreat-protected. Other friendly landing orders may share that fleet, allowing individual or simultaneous group disembarkation without duplicating cargo or reserving capacity again.

Friendly targets are own territory, allied territory with the existing alliance access, or territory granting the existing directional military access. A naval war or a war relation rejects the friendly flow even if alliance/access metadata is still present. Neutral territory without access is invalid. An unrelated war does not prevent landing on own territory. Inland, lake-only and disconnected-water targets remain invalid under V1.1 rules. There is no globally nearest-node selection or crossing a land barrier.

The target is also checked using Battle V3's army hostility contract, including campaign and rebellion hostility. Hostile land forces in otherwise friendly territory reject initiation and cancel ongoing landing. This check does not depend solely on the province owner's tag. Neutral or friendly forces do not prevent peaceful landing.

## Port versus beach and duration

Existing docked-port disembarkation remains instantaneous. The target command `disembarkArmiesAtProvince` prefers that existing command when all selected cargo is docked at the requested port. Its peaceful target validation also prevents silently entering a hostile stack through the new target-selection flow.

Otherwise, the command starts an explicit friendly beach landing. `AMPHIBIOUS_FRIENDLY_BEACH_LANDING_DAYS` aliases the existing five-day open-beach duration; port/beach duration constants now live in dependency-independent `amphibiousRules.ts` and remain exported through the existing transport API. There is no separately balanced duplicate five-day constant. The canonical resolver still prefers the port SeaNode for a province with a port. An offshore fleet can use that coastal node for a slower landing without docking; the docked-port path remains the convenient instant option.

During the five days, the army stays embarked, has no land location and consumes its existing transport capacity. The fleet remains at sea. Completion clears `embarkedFleetId`, restores the target land location and clears landing, extraction, movement and target state through `ashoreArmy`. The army is updated once in the existing array; no duplicate arrival is appended.

Friendly completion returns no invasion or terrestrial arrival event, starts no Battle and performs no occupation. It never writes `Province.owner`, never calls `transferProvince`, never creates a Port and never makes a permanent docking point. V1.1 hostile landing still returns ordinary Battle V3 arrivals and uses the normal occupation/territory-transfer path.

## Revalidation, diplomacy and cancellation

The daily phase runs after existing naval cargo losses and ordinary terrestrial Battle V3 arrivals. Thus an enemy arriving on day five is visible before completion and cancels the operation. It also cancels on lost coast/province/node, revoked access, new hostility, incompatible invasion/extraction, fleet movement, a changed SeaNode, pending route, docking, retreat or combat. Same-tick naval engagement cancels even if the naval battle already resolved.

Cancellation removes only friendly landing metadata; surviving armies stay aboard the valid fleet. War declaration never converts the order into an invasion. A new invasion must be issued separately. Player cancellation is available per Army and through Fleet Cancel Order. Fleet movement commands revalidate immediately, including while paused. Final simulation cleanup validates again after diplomacy and other phases without incrementing elapsed days twice.

The existing `resolveTransportLosses` phase owns fleet destruction, transport capacity losses and proportional cargo casualties. One surviving TRANSPORT still carries 5,000 soldiers. Surviving cargo can continue landing if the fleet stays eligible; destroyed cargo is removed with its landing metadata and cargo reference. V1.3 does not introduce a second casualty rule or turn destroyed-fleet cargo into land forces. The tick API is used after that loss phase, as are existing amphibious operations.

## UI and commands

FleetPanel retains existing cargo checkboxes and invasion selection, adding the explicit "Desembarcar em costa amiga" target command. It supports left-click and right-click target selection. The friendly and invasion selection modes are mutually exclusive. Friendly landing progress is displayed per cargo army, and conflicting invasion planning is unavailable while friendly landing is active.

A selected embarked Army can right-click an accessible coastal province directly. Its panel explains the command and shows target/progress plus cancellation during an operation. Hover feedback uses the actual engine validator: docked-port targets show "Desembarcar pelo porto"; beach targets show the five-day label; invalid targets explain access, coast/lake, hostile forces, fleet position/combat or incompatible orders. Normal fleet right-click port movement remains unchanged outside target-selection mode.

## Additive Save V3

Optional `Army.friendlyBeachLanding` stores `provinceId`, resolved `seaNodeId` and integer `elapsedDays` (0 through 4). Fleet association stays exclusively in `embarkedFleetId`; remaining days are derived from the shared duration. Existing serialization/migrations preserve the new field without a schema-version change.

Save validation checks metadata types and progress, coast/node references, cargo ownership, no land presence or movement, a holding fleet at the correct node, no retreat protection, and no conflicting invasion/extraction. Existing cargo capacity validation remains authoritative. Access and hostility are revalidated against live diplomacy on the next tick, allowing a structurally valid save immediately after a diplomatic change. Old saves without metadata load normally. Both mid-operation and completed states are exercised through real Save V3 save/load.

## AI, activation and performance

The APIs accept AI/controller actors. No existing AI planner issues friendly troop transport/disembarkation commands, so automatic friendly beach destination planning is deferred. FULL naval movement/invasion AI treats fleets with active friendly landing as committed and does not overwrite their orders. PASSIVE and FULL both progress initiated operations through the unconditional daily phase; Simulation Activation is unchanged.

With no friendly orders, the phase returns before building indexes. Active ticks build fleet/province maps, cargo groups and used-capacity totals once. Land forces are indexed by province before checking hostile presence. Each order resolves only its province's precomputed coastal candidates and its indexed fleet/cargo/land bucket; it does not scan every SeaNode or fleet per operation. No new graph generation is required.

## Regressions and browser round trip

New engine tests cover own/allied/access beaches, real no-Port Chilean coast and access revocation, neutral/hostile/inland/lake/wrong-node rejection, port preference and instant port disembarkation, five-day cargo presence and clean completion, no owner/Port/Battle/transfer effects, fleet status/node/route changes, explicit cancellation, same-tick naval combat, fifth-day hostile arrival and rebel hostility, multiple/group/individual armies, conflict guards, the existing cargo-loss mechanism, additive Save V3 and invalid metadata, FULL/PASSIVE continuity, and the actual conquered Tierra del Fuego round trip.

UI tests cover both target click styles, right-click with selected cargo Army, target-selection cancellation, hover validation reasons, progress/cancellation and conflicting invasion suppression. Existing V1.1 invasion, V1.2 extraction, Naval V1, Battle V3 and movement tests remain in the full suite.

The longer browser scenario uncovered an existing recruitment ID collision after full-page save reload: the in-memory counter restarted at zero while restored `army_1`, etc. remained in the campaign. A background recruitment could reuse one of those IDs, causing Save V3 to reject an unrelated duplicate Army during the landing countdown. Recruitment now passes current Army IDs to the existing collision-aware generator through an optional `createArmy` argument. A fresh-module-load regression reproduces the saved-counter-reset case. No recruitment costs, durations, troops or AI strategy change.

`npm run smoke:amphibious-round-trip` now extends the real browser voyage: Brazilian Port A embarkation, hostile Tierra del Fuego landing/conquest, beach extraction with save/load, a labeled war-ended fixture preserving that actual world/cargo/fleet state, right-click friendly return to the same no-Port BRA province with five days and another mid-operation save/load, second extraction, voyage to accessible Chilean Port C and normal port disembarkation. It checks unchanged owners and battle count for the friendly segment, no invasion/Port, stationary fleet and no residual or duplicate Army state. Reports/screenshots use `artifacts/amphibious-v1.3-*`.

The war-ended fixture uses a fresh complete manual save, preserving air/base state along with current province ownership. Combining an older save's air state with a later world snapshot had produced an unrelated invalid-base fixture; no air engine change was needed.

Final validation passed: `npm run lint`, `npm run typecheck`, `npm run test:run -- --maxWorkers=2` (101 files, 2,658 tests), `npm run build`, and `git diff --check`. Added 65 V1.3 engine/Save V3 cases, 12 UI cases and one recruitment reload regression: 78 new tests. The full suite includes existing amphibious, beach extraction, naval, Battle V3 and movement regressions. The browser round-trip smoke passed all eight checks with zero runtime exceptions. The build retains the existing large-bundle warning. Coast metadata was not changed, so no generation change/check was required.

## Limitations

Automatic AI friendly transport planning is deferred; active orders and controller APIs are supported. The existing same-controller and alliance/military-access contracts remain required. Fleets must already be at the canonical coastal node; friendly landing does not itself plan a voyage. Coasts retain V1.1's conservative simplified geometry and connected ocean graph. No supply/logistics, evacuation bonus, port construction, naval range, blockade, visibility changes or Battle rewrite is included. No commit or push is made.
