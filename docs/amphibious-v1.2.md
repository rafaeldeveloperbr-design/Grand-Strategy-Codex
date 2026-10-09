# Amphibious V1.2: beach extraction

## Audit and root cause

V1.1 made invasion targets independent of ports, but `embarkArmy` still required an entry in `portByProvince` and a friendly fleet `DOCKED` in that province. An army landed on Tierra del Fuego could therefore leave its fleet offshore but could not use that fleet again. Normal disembarkation still uses a docked fleet; invasion landing supplies the separate beach disembarkation path.

The existing contracts are retained: `embarkedFleetId` distinguishes cargo from land forces; cargo has no land location, movement route or combat membership. Fleets at sea use `locationSeaNodeId`, while docking uses `portProvinceId`. Capacity and naval cargo losses are calculated by the existing transport helpers. V1.1's `coastalSeaNodes`, `coastalLandingError` and `resolveAmphibiousLandingSeaNode` already provide validated, deterministic ocean links, so extraction uses them directly. There is no second coast detector or nearest-global-node fallback.

## Port and beach commands

Port embarkation remains instantaneous and requires an eligible same-controller fleet docked at the accessible port. Port disembarkation is unchanged. For a province without a port, the same `embarkArmy` command starts beach extraction instead. `AMPHIBIOUS_BEACH_EXTRACTION_DAYS = 5` is centralized in `beachExtraction.ts`.

The army must have troops, be stationary, not embarked, not in Battle V3 and not protected by retreat. The fleet must belong to the same controller, have enough transport, be `HOLDING` at the exact canonical coastal SeaNode, have no pending route, and have no invasion commitment. A moving, docked, fighting or retreating fleet is ineligible. Province access uses the existing own/allied/military-access naval contract and rejects hostile or inaccessible territory. Thus the observed hostile beach becomes extractable after conquest; this does not add evacuation from unconquered hostile territory.

The canonical resolver prefers a port node where applicable; beaches use the ranked, precomputed ocean coast association. Inland provinces, lake-only provinces, disconnected water, flagged inland/lake nodes, and connections across land remain excluded by V1.1. Extraction requires this resolved node, rather than any arbitrary nearby node.

The Army transport panel keeps the existing fleet selector and Embark command. On a beach it displays "Embarque pela praia — 5 dias", reserved capacity, specific validation errors, elapsed progress and an explicit cancellation button. FleetPanel also displays extraction reservations. UI validation calls the engine command validator so the displayed reason and actual command share one rule set. No new naval mode or target-selection system is introduced.

## Countdown and Battle V3

During all five days the army retains its province location, troops and ordinary terrestrial presence. It can defend, be attacked and be destroyed normally. The daily extraction phase runs after ordinary Battle V3 arrivals, so even an enemy arriving on the fifth day cancels extraction before embarkation. Active battle membership is checked as well as the army's combat flag. Battle V3 itself is unchanged.

On completion, the shared `aboardFleet` helper sets `embarkedFleetId`, clears extraction and land movement/target state, and removes the land location. The fleet remains at its SeaNode. Extraction creates no port, changes no ownership and does not call `transferProvince`. Normal invasion occupation continues to use that function separately.

## Capacity and reservations

One surviving TRANSPORT still carries 5,000 soldiers. Existing cargo loss allocation and naval transport balance are unchanged. Capacity is checked at initiation, every active daily tick and immediately before completion.

Reservations are derived from the current troop counts of armies with `beachExtraction`, grouped by fleet alongside existing cargo. There is no separately stored reservation counter that can become stale. A second operation or normal port embark cannot overbook a fleet. Multiple operations that fit can complete on the same day deterministically. If cargo plus valid reservations no longer fit, all pending extractions for that fleet are canceled; no partial embark or array-order winner is introduced. Capacity loss that still leaves sufficient space does not interrupt extraction. Soldiers extracting on land do not suffer embarked cargo losses when their target fleet is destroyed.

## Cancellation and cleanup

Extraction cancels if the army enters a battle, retreats, moves, disappears, loses valid coast access or receives an incompatible accepted movement order. Invalid movement orders leave the existing operation intact. Reorganization is rejected while extracting to prevent splitting or duplicating reserved troops. Explicit cancellation releases the derived reservation immediately.

It also cancels when the fleet disappears, moves away, starts a route, docks, fights, retreats, commits to invasion or loses sufficient capacity; when the original province or its canonical coast connection changes; or when war/access changes invalidate permission. Same-tick naval engagements cancel even if that naval battle resolves within the tick. Canceling leaves surviving troops on land and does not teleport the fleet.

Fleet commands validate ongoing extractions immediately, including while paused. A final cleanup phase after diplomacy and other simulation updates validates without advancing the day count. Removing an army also removes its derived reservation. Invalid extraction references are cleared rather than converted into cargo, so cancellation cannot create a stale `embarkedFleetId`.

## Save V3 and AI

The additive optional `Army.beachExtraction` field stores `fleetId`, `seaNodeId`, `provinceId` and integer `elapsedDays` (0 through 4). Existing Save V3 serialization and migrations preserve it. Remaining days are derived from five minus elapsed days. Save validation checks types, progress, army/fleet/province references, canonical node, stationary state, combat/protection and aggregate cargo/reservation capacity. Access is revalidated during simulation. Old saves without this field load normally, including instant port embarkation and V1.1 landing orders.

Engine APIs accept the owning controller as actor and support AI callers. Active extraction progresses and revalidates through the ordinary simulation regardless of FULL/PASSIVE order-generation mode. V1.1 invasion planning is preserved. Automatic AI beach evacuation/withdrawal planning is deferred to V1.3; this change does not introduce a new naval strategy planner.

## Performance

The UI selects beach fleets through the existing fleet-by-SeaNode index. Runtime coast resolution reads only the province's precomputed candidates. With no extraction orders, the tick exits before building fleet/province indexes. With active orders it builds those maps and cargo/reservation groups once, then validates operations through indexed lookups. It does not search all fleets or all SeaNodes separately for each extracting army.

`npm run benchmark:beach-extraction` measures progress, cleanup, completion and destroyed-fleet cancellation (Node v24.21.0, Windows, 200 samples after warmup). Daily progress p95: no active orders with 1,000 fleets, 0.0011 ms; 20 orders/20 fleets, 0.0807 ms; 50 orders/50 fleets, 0.1741 ms; 20 orders/1,000 fleets, 0.1255 ms. These are absolute measurements, not a before/after improvement claim. Raw results: `artifacts/amphibious-v1.2-benchmark.json`.

## Regression coverage and browser validation

Added 54 engine/Save V3 cases and eight UI cases. They cover instant port embark; real Tierra del Fuego beach extraction; inland/lake/wrong-node rejection; five-day terrestrial presence; clean completion and stationary fleet; 5,000 capacity, reservations, deterministic simultaneous completion and capacity loss; fleet/army destruction and movement; combat, protection, access and explicit cancellation; fifth-day Battle V3 arrival; no ownership change or port creation; save/load progress, old saves and corrupt metadata; engine API use by an AI actor; and a complete voyage/landing/conquest/extraction/return/port-disembark round trip. Existing V1.1, Naval V1, Battle V3 and movement regressions remain covered by the full suite.

The new `npm run smoke:amphibious-round-trip` uses actual browser commands and daily simulation: Port A embarkation, voyage to Tierra del Fuego, five-day landing and ordinary occupation, beach extraction, manual save/load mid-countdown, re-embarkation, voyage to a distinct accessible Chilean Port C and normal disembarkation. Its war/access fixture is loaded through Save V3; the fleet starts at its home SeaNode and travels normally. State assertions verify progress and absence of duplicate cargo or residual land/extraction state. Browser reports and screenshots are under `artifacts/amphibious-v1.2-*`.

The naval smoke exposed a separate timing weakness under concurrent validation: after a fixed three-second wait it treated any non-COMBAT fleet as ready, including RETREATING. Return to Port is disabled during retreat, so that command did nothing and a later docking assertion failed. The smoke now waits for HOLDING/DOCKED before issuing the return and waits for actual docking plus repair afterward. Naval engine movement, retreat and recovery rules are unchanged. The previous amphibious Battle V3 timeout root cause and fixture correction remain documented in `amphibious-v1.1.md`.

Final validation: lint, TypeScript, the full suite (98 files, 2,580 tests), production build and `git diff --check`; amphibious, naval and all eight Battle V3 browser smoke scenarios, plus the new round-trip smoke. Browser scenarios report no runtime exceptions. The build retains its existing large-bundle warning.

## Limitations

Coast availability retains V1.1's conservative geometry and existing connected ocean graph. Same-controller fleets and existing naval access rules remain required. Automatic AI extraction decisions are deferred. No supply, logistics, partial embarkation, evacuation-under-fire bonus, port construction, range, blockade, visibility overhaul or Battle V3 rewrite is included. No commit or push was made.
