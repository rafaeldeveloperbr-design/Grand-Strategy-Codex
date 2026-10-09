# Amphibious Invasion V1.1

## Audit and previous restriction

V1 `planInvasion` required both `isCoastalProvince` and an operational entry in `portByProvince`, then took `seaNodeId` from that port. The offline generator already inspected province polygon borders, but exported `coastalProvinceIds` from connected port candidates instead of all validated ocean coasts. Some candidates had no operational port, and planning still rejected those. Province geometry (`path`, `center`) was sufficient for offline coast detection; runtime metadata had no independent coast-to-ocean relationship.

Ports remain a static `NavalPort` list: province ID, level, offshore berth coordinates and SeaNode ID. Fleet docking uses `portProvinceId`; a fleet at sea uses `locationSeaNodeId`. These are mutually exclusive. Beaches use only the latter and never create a port.

## Canonical coast and node resolution

`generate_naval.mjs` generates `coastalSeaNodes`, a province-to-node index independent of operational ports. A polygon border midpoint must have land on one side and water on the other. Its offshore anchor must have an unobstructed `waterLine` connection to an ocean graph node within 200 map units. Nodes come from the existing largest connected ocean component; disconnected lake and water fragments are excluded before creating these links. Explicit runtime lake/inland flags and labels, absent nodes and nodes without valid neighbors are rejected as well.

Candidates are ranked offline by distance to the province center and then stable node ID. Each border anchor considers its twelve closest ocean candidates. The runtime helpers `getCoastalSeaNodes`, `isCoastalProvince` and `resolveAmphibiousLandingSeaNode` share this index. The resolver prefers the operational port node when available, then the first ranked validated coast node. It never chooses a globally nearest node across land. A province with only an interior water border or without a usable ocean link is invalid.

The existing naval nodes, edges, operational ports and movement balance are retained. World geometry is authoritative: this does not introduce World Wrap or new naval range rules.

## Landing flow and balance

`AMPHIBIOUS_PORT_LANDING_DAYS = 3`; `AMPHIBIOUS_BEACH_LANDING_DAYS = 5`. No additional organization penalty. A fleet sails through normal naval movement, holds at the resolved node, and advances its landing countdown once per daily tick. Landing yields ordinary terrestrial arrivals. Battle V3 starts against hostile defenders without changing ownership first; an empty target uses the existing territorial rules and `transferProvince`. No separate amphibious battle system exists. Fleet position and ships remain at sea after landing.

Transport capacity remains 5,000 soldiers per surviving TRANSPORT. The existing proportional casualty allocation, population losses and naval battle troop-loss reports are unchanged. Orders revalidate target coast/node, target owner, war, fleet/cargo presence, capacity, naval engagement and movement orders. Canceling a landing leaves surviving troops aboard a valid fleet. The existing `resolveTransportLosses` phase removes cargo of destroyed fleets, so armies are not left linked to destroyed fleets.

## UI, AI and save/load

Target selection accepts both left-click and right-click. Hover feedback uses the same planning validation and reports port/beach duration or a specific coast, war, cargo, capacity or path error. FleetPanel displays the relevant countdown denominator.

The previous AI only issued naval movement/interception orders; it did not autonomously plan amphibious orders. V1.1 adds planning for FULL non-player fleets with existing embarked cargo. It tries hostile valid coastal provinces, preferring ports, with stable province ID ordering. Unreachable candidates are skipped. PASSIVE fleets retain movement and landing progress without generating new orders. Automatic army embarkation is outside this change.

Save V3 remains additive: `InvasionOrder.landingType` is optional PORT/BEACH; the existing `seaNodeId` and elapsed `landingDays` persist node and countdown. Remaining days are derived from duration minus elapsed days. Missing landingType retains the old PORT/three-day behavior. Save validation rejects mismatched coast nodes, types and countdowns; army/fleet cross-reference checks remain intact.

## Performance and limitations

Geometry and global sea-node searches run only in offline generation. Runtime resolves a province through a precomputed index, filtering its local candidate list. It does not scan all SeaNodes per army or tick. AI scans hostile province targets only for eligible fleets with cargo; ordinary Dijkstra runs when planning a route. No range, supply, blockades, marines, shore bombardment or automatic port construction is added.

Coast detection uses polygon segment midpoints, two-unit offshore anchors and the existing simplified map geometry. The twelve-candidate and 200-unit connection bound are conservative; a coast without a validated connection remains unavailable. Interior bodies connected by genuine ocean graph edges follow that graph; disconnected bodies do not become navigable based on distance alone.

## Browser regression and validation

The old Battle V3 amphibious smoke timed out waiting for an active battle because its fully organized Argentine defender was free to receive military AI orders. The diagnostic reproduction showed the invader successfully landed in Buenos Aires, its invasion order was removed, and the defender had marched to Brazil; no battle or history entry existed. It was a fixture behavior issue, not a port/node mismatch or a broken Battle V3 arrival. The corrected fixture uses a recovering defender (25 organization), which holds friendly territory during the three/five-day landing. The smoke checks that a real Battle V3 starts and produces a unique history/report; normal full-organization combat fixtures retain the minimum-duration assertions. It now also runs the actual Tierra del Fuego beach target.

The standalone transport smoke separately hit Chrome localStorage quota when it retained an autosave plus a complete manual campaign save. It now removes the disposable profile's autosave before saving and explicitly waits for the manual key. This does not change game save storage. The naval browser smoke needed the same quota accommodation, now checks the actual declared war rather than a diplomacy panel that closes after confirmation, and waits for a monthly autosave containing the naval battle instead of assuming a fixed number of seconds reaches month-end.

Added regression coverage: actual Tierra del Fuego voyage and coastal nodes; port/beach 3/5-day comparison; normal Battle V3 and transferProvince paths; no port creation; fleet position and disembark; deterministic port-first resolution; real Caspian/lake/inland guards; unsafe target/node/order/capacity/fleet/army/war cancellation; transport losses; additive old port saves and full Save V3 port/beach round trips; FULL/PASSIVE AI with port preference; left/right-click selection and hover durations; actual offshore-anchor visibility and a continental barrier fixture.

The generated world exposes 336 valid coastal provinces, 124 unchanged operational ports, 1,541 unchanged sea nodes and 6,463 unchanged edges. Geometry excludes 28 disconnected water components. Conservative local coast candidate sampling excludes Jersey from the previous broader coast metadata; Jersey had no operational port and was already unavailable for V1 invasion. Some real coasts around disconnected/simplified seas also remain invalid because they have no validated connection to the navigable graph.

Benchmark (Node v24.21.0 / Windows, 200 samples per case): 20 active port landings p95 0.108 ms; 20 active beach landings p95 0.062 ms. These are absolute measurements, not a before/after claim. Reports and browser screenshots are under `artifacts/`.

Final validation: `npm run lint`, `npm run typecheck`, `npm run test:run -- --maxWorkers=2` (97 files, 2,518 tests), `npm run build`, and `git diff --check` passed. The build retains its existing large-bundle warning. Added 32 regression cases plus updated the obsolete V1 no-port rejection. Amphibious, Naval V1, Battle V3 and movement regressions pass. `smoke:amphibious`, full `smoke:battle-v3` (eight scenarios including port and beach), and `smoke-naval-browser.mjs` pass with zero browser runtime exceptions. `benchmark:amphibious` includes both port and beach cases. `generate_naval.mjs --check` passes deterministic generation; comparison with the previous data confirms sea nodes, edges and operational ports are unchanged. No commit or push was made.
