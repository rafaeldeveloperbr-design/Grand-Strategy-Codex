# Air Warfare V1

## Architecture and world

Air Warfare is a separate aggregated domain (`AirState`, `AirWing`, `AirBase`,
`AirZone`, `AirMission`, `AirEngagement`). An AirWing contains one aircraft type;
there are no individual aircraft objects or moving individual plane markers.
`AircraftTypeConfig` is the aircraft template. The catalog and all balance/cost
constants live in `src/data/aircraft.ts`. Engine APIs live in `src/engine/air`.

The existing world remains **world-v1, 201 countries, 494 provinces**.
Initial totals: **56 zones, 83 bases, 66 wings in 38 countries** (1,584 aircraft).
BRA starts with one Fighter, one CAS and one Bomber group, each with 24 aircraft.

Zones partition each MapRegion into 600 × 450 projection cells. Empty cells are
omitted; every province belongs to exactly one zone. IDs include region and cell,
names include the region and an example province. Centers are average province
centers; neighbors come from land topology. Separate regions never merge through
nearby coordinates. Islands can produce singleton zones; this is a deliberate
exception to multi-province operation, avoiding continent-wide island missions.
Membership, centers and neighbors are computed once when the world module loads.
`airZoneByProvinceId` and `airZoneById` are the stable indexes.

Construction V2 uses permanent economic/military building levels and queues with
paid resource costs. Air V1 does not need aircraft production or base construction,
so bases remain immutable metadata instead of adding a building and a queue type.
No base means level 0; authored initial bases have levels 1–3 and capacity 2/4/6
wings. All countries' wings and incoming rebase reservations share that capacity.

Base seeding ranks owned provinces by capital, development, population and ID.
Countries get up to three bases (one per eight owned provinces, rounded up).
First bases of countries with at least eight provinces are level 3; otherwise
multi-province countries with at least three provinces get level 2. Single-province
countries below 60,000 scenario population have no base. Population here is the
scenario's scaled gameplay population, not a contemporary census.

Forces require a base, population ≥60,000, aggregate development ≥12 and maximum
manpower ≥10,000. Fighter is the baseline. Population ≥110,000 and development ≥22
add CAS; population ≥200,000 or eight provinces add CAS and Bomber. Capacity bounds
the result. Development and manpower supply the economic/strategic proxy because
initial daily economic income has not been simulated yet. Microstates are excluded.
Country IDs and province tie breakers are sorted, making generation deterministic.

## Aircraft catalog

| Type | Air attack | Air defense | Speed | Range | Efficiency | Gold/aircraft/day | Missions |
|---|---:|---:|---:|---:|---:|---:|---|
| FIGHTER | 8 | 7 | 450 | 650 | 1.0 | 0.025 | AIR_SUPERIORITY, INTERCEPTION |
| CAS | 2 | 4 | 300 | 500 | 0.9 | 0.030 | CLOSE_AIR_SUPPORT |
| BOMBER | 1 | 5 | 350 | 1,100 | 0.8 | 0.050 | BOMBING |
| TRANSPORT_PLANE | 0 | 3 | 350 | 900 | 0.0 | 0.020 | NONE |

Speed and range use world projection units. The catalog supports Transport Plane,
but no initial transport groups are seeded and it has no operational mission.
No drones, missiles or nuclear aircraft are introduced.

## Range, access and rebase

Range is deterministic Euclidean distance from base province center to zone center.
There is no wrapping, geographic/network pathfinding, SeaGraph or naval range.
The UI disables distant zones and labels them "fora de alcance"; the engine also
rejects assignment outside range, and effective missions revalidate range daily.

Bases follow current territorial ownership. Own bases work automatically; allied
or access-granted bases require a diplomatic relation. `militaryAccess` contains
the **grantor**: for BRA flying from ARG, the relation must contain ARG. Hostility
overrides both alliance and access. Coalition hostility uses existing campaign
participants, the same semantics used by naval warfare; naval rules are unchanged.

Rebase duration is `max(1, ceil(distance / aircraft speed))` days. It clears mission
and assignment, retains the origin slot and reserves the destination slot until
arrival. New orders cannot interrupt an existing rebase. Invalid access cancels
the target; cleanup revalidates both origin and destination. Captured bases cause
an immediate emergency evacuation to the first valid base with space, with −20
organization. Sequential reservations prevent overfilling during evacuation.
If no legal base survives, the stranded wing is removed.

## Missions, air control and air combat

Operational mission efficiency is catalog efficiency × strength/100 × organization/100.
It is zero below 20 strength or organization, during rebase, outside range, without
valid base access or without aircraft. Fighters provide control using aircraft ×
efficiency × air attack. Own and allied fighters contribute friendly power; only
actual war enemies contribute opposing power. Neutral powers do not contest control.
Superiority is `(friendly − enemy) / (friendly + enemy)`, with 0 for no power.

Air superiority fighters attack hostile active wings in their zone. Interception
fighters only initiate attacks against hostile CAS/Bomber missions. Interceptors
remain idle without targets, although their fighter presence still contributes
defensive control; enemy superiority fighters can attack them.

Combat is independent of terrestrial ActiveBattle. Each daily zone has one
aggregated engagement summary, with participating IDs and losses. Wings are sorted
by ID for targeting. Each fighter distributes a daily attack budget proportionally
to hostile aircraft count; defense reduces damage. Non-fighters defend against
attackers but never initiate combat. Fighter fire and defensive fire use the same
pre-combat snapshot. Losses are applied simultaneously, rounded up once per wing,
capped at its aircraft count, and reduce aircraft, strength and organization.
Engaged wings lose 8 organization. Empty wings are removed. No random generator
or terrestrial manpower/casualty conversion is involved.

## CAS and temporary land integration

Stable APIs for Battle System V3 are:

- `getAirZoneControl(state, zoneId, countryTag, context)`;
- `getAirSuperiorityForProvince(state, provinceId, countryTag, context)`;
- `getAirSuperiorityModifier(state, provinceId, countryTag, context)`;
- `getAirSupportForBattle(state, battle, countryTag, context)`.

CAS requires a battle participant, a valid in-range mission and effective efficiency
≥0.1. It includes CAS from armies participating on that same side when context
provides armies. Hostile superiority suppresses CAS efficiency by up to 80%.
Support scales toward a **5% maximum bonus** at 60 effective aircraft.

The only land integration is in `battleContinuousTick`: fill its existing
`combatMultipliers` map with `1 + superiority × 0.03 + CAS support` for participant
owners. Thus the combined air contribution is bounded to **0.97–1.08**. The current
combat engine consumes the representative owner's multiplier on each side, also
affecting its existing pressure-based organization damage calculation. No combat
formulas, arrival logic, fortifications or Battle System V3 were rewritten.
Without air forces, the multiplier is exactly 1; regression coverage checks exact
equality of terrestrial battle outcomes. The AirZone panel shows battle support
and superiority percentages. Amphibious armies receive ordinary land support only
after landing into the existing battle flow; there is no naval aviation effect.

## Bombing

Bombers apply bounded operational **economic disruption**, once daily after air
combat. Only hostile owners of provinces inside the assigned zone are affected.
Power is aircraft × efficiency × superiority suppression × 0.03 gold; it is divided
across hostile owners. All bombing missions share a cap of **5 gold per target
country per day**, and treasury cannot go below zero. Interception both inflicts
losses before bombing and contributes suppression through hostile fighter control.
There is no explicit civilian targeting, building destruction, permanent level
damage, damage ledger or direct war-score change. This choice avoids coupling a
temporary damage subsystem to Construction V2 and makes additional saved damage
state unnecessary.

## Maintenance, recovery and replacement

Every wing pays daily gold upkeep, including resting/rebasing wings; the cost also
appears in national gold expenses. Active missions lose 2 organization each day.
Inaccessible, rebasing and active operational wings do not receive ordinary repair.
At a valid base, resting or temporarily ineffective missions recover organization
by 4 × level and strength by 2 × level, clamped at 100. Exhausted assigned missions
therefore recover and resume without a new strategic decision, including PASSIVE.

Replacement adds up to one aircraft × base level/day, bounded by maxAircraft and
available resources: **4 gold + 2 iron + 1 tool per aircraft**. Own bases use their
province's stock. Allied bases can use the operator's own stocked province, ordered
by ID; they never consume the host's goods. Only actual replacement is charged;
there is no fuel or production queue. Cancel Mission is the player's explicit
rest/replacement command. A fully destroyed wing cannot be recreated in V1;
Aircraft Construction V1.1 is the intended future source of new groups.

## AI and Simulation Activation

Air AI reuses the naval phase's existing FULL activation snapshot. It creates no
new activation reasons and never controls the player's wings. PASSIVE countries
receive no assignment/cancellation decisions, while existing missions, combat,
maintenance, rebase and recovery continue globally.

Peace fighters protect their home zone. Damaged groups (strength/org below 40,
or fewer than half their nominal aircraft) rest. At war, battle zones have priority;
fighters can intercept nearby hostile bombers/CAS, CAS selects its own battle,
and bombers look for nearby hostile territory. Every assignment validates range
and access. If hostile fighter power exceeds friendly power ×1.5, fighters fall
back to the home zone and other types rest. No new wings, base construction or
global air strategy is implemented.

## Tick order and profiler

The existing terrestrial sequence is preserved:

`economy → politics → unrest → diplomacy/technology → land AI → naval construction
→ naval AI → airAI → land movement → naval movement → naval combat → airCombat
→ airMissions → amphibious → battle arrival → battle continuous → war resolution
→ rebellion → cleanup → state publication/autosave`.

Rebase advancement is part of airMissions; rebasing wings never fight before arrival.
Air combat resolves before the same day's bombing and before land CAS consumption.
CAS and bombing therefore see the surviving post-combat wings. AI sees existing
battles; new arrivals can receive already assigned CAS during continuous combat.
Only cleanup changes due to capture/peace occur after land combat and resolution.

Dev-only profiler phases are `airAI`, `airCombat`, `airMissions`. Counters are
`airWings`, `activeAirMissions`, `airAIBots`, `airEngagements`, `aircraftLost`,
`casMissions`, `bombingMissions`. Reports aggregate and reset each window as the
existing profiler does; production profiling is inert and there are no wing logs.

## UI and rendering

Air Mode adds themed zone overlays, fighter control, base markers and type/count/tag
wing markers. Without Air Mode, no air overlay or markers are drawn. Zone selection
reports presence, friendly/enemy aircraft, missions/efficiency, losses and land
battles/support. Wing selection reports count, strength, organization, base, zone,
mission, efficiency, range and rebase progress, with owner-only commands.
The ProvincePanel military tab includes a compact Air Base section, with no fifth tab.
Locate and F focus the selected wing's **base**, using the existing camera helpers.
AirWing/Fleet/Army/Province selections clear incompatible panels; Escape clears air
selection. Country Selection has no air controls.

Air overlays only render province shapes intersecting the viewport. Conservative
province bounds are generated offline in `src/data/airMapBounds.json`; run
`node scripts/generate-air-bounds.mjs` if authored world geometry changes. There is
no geometry parsing in animation frames or ticks. Province/country/control indexes
are memoized so camera panning does not recalculate air control.
Zone shapes sit below Army markers, while AirBase/AirWing markers sit above the
land layers. Base icons are offset from the province center to avoid masking
capital/fleet markers. This keeps terrestrial click targets accessible in Air Mode.

## Save V3

The extension is additive: `air.wings` persists aircraft type/count/max, strength,
organization, base, mission, zone, status and timed rebase target/progress. Bases
and zones are derived static data and are omitted. Engagements are daily feedback,
not persistent simulation entities; they are rebuilt on the next tick.
New games seed once. Loads use saved wings and never duplicate or recreate initial
forces; saves without air data load an empty air force. Naval/amphibious state,
technology player identity and existing battle state follow their existing contracts.

Validation rejects malformed types/mission combinations, nonexistent base/country/
zone, enemy or inaccessible bases, negative/nonintegral/excess aircraft, invalid
strength/org, duplicate IDs, inconsistent status/mission, overloaded bases and
invalid rebase targets/progress. Public load returns null with an error; invalid
live air state returns false without writing. Manual loading updates both ref and
state setter. The existing localStorage quota remains; full-world saves can fill
it, and the existing storage-full feedback is preserved. The browser smoke uses
one slot in a disposable profile.

## Validation and benchmark

Automated suites: `airWarfareV1.test.ts`, `airSaveV3.test.ts`, `airUIV1.test.tsx`.
They cover world preservation/deterministic seeding, access direction, range and
capacity, all 16 aircraft/mission combinations, timed rebase, FULL/PASSIVE, simultaneous
combat, losses/removal, recovery/resource payments, allied CAS, bounded modifiers,
bombing/interception, immutable inputs, malformed saves, V3 public round-trips,
naval/player preservation, profiler windows, selection/camera and viewport rendering.

Run `npm run benchmark:air` for 30 measured samples after five warmups: zero wings,
initial peace forces, some wars, multiple disputed zones, 100 wings and simultaneous
CAS/bombing with land battles. It measures air AI, combat, missions/support and a
separate all-wing/all-zone range sweep. Results and actual world counts are in
`artifacts/air-warfare-v1-benchmark.json`. There is no machine-dependent pass threshold.

Measured phase averages on this machine (milliseconds; range sweep is a separate
diagnostic, not extra per-tick work):

| Scenario | AI | Combat | Missions/CAS | All-zone range sweep |
|---|---:|---:|---:|---:|
| Zero wings | 0.002 | 0.002 | 0.109 | 0.000 |
| Initial peace, 66 wings | 3.615 | 0.026 | 0.375 | 1.299 |
| Some wars, 66 wings | 2.812 | 0.247 | 0.931 | 1.214 |
| Four disputed zones, 66 wings | 2.677 | 0.425 | 0.891 | 1.145 |
| 100 wings | 3.782 | 0.530 | 0.893 | 1.780 |
| CAS + bombing + four land battles | 2.420 | 0.272 | 0.611 | 1.193 |

The three air tick phases total about 5.2 ms in the 100-wing fixture. This benchmark
isolates engine work; it does not attribute the entire world's rendering or other
simulation costs to air warfare.

Run `npm run smoke:air` for Chrome headless CDP: New Game BRA, Air Mode, base/military
section, fighter mission, Locate/F, diplomacy war declaration, a saved battle fixture
with enemy fighters/CAS/bombing, rebase, save/load and x3 navigation. The fixture
uses normal save loading; React inspection is read-only. Evidence is in
`artifacts/air-warfare-v1-browser.json` and `.png`. Frame gaps are diagnostic data,
not a statistically controlled before/after microstutter claim. Headless full-world
x3 still exhibits long frames; air engine times and rendering times are distinct.
The final browser comparison restores the same saved front and camera before each
of three 1.8-second samples per mode, alternating order. Air Mode averaged 26 frames,
261.1 ms maximum-frame gap and 8.67 gaps above 50 ms per sample; normal mode averaged
24 frames, 283.37 ms maximum gap and 9 gaps above 50 ms. This fixture showed no
clear deterioration with Air Mode, but persistent long frames preclude a claim
that the whole game's microstutter is solved. All browser checks passed with zero
runtime exceptions, including the CAS feedback and rebase save/load round-trip.

Required final checks: `npm run lint`, `npm run typecheck`,
`npm run test:run -- --maxWorkers=2`, `npm run build`, `git diff --check`.
Final result: **all five passed; 89 test files and 2,255 tests passed**, including
**110 added air tests** (90 engine, 6 save/integration, 14 UI). No worker timeout
occurred. Build retains the existing large-bundle warning; Node also emits its
experimental localStorage warning in the test environment. Neither failed a check.

## Manual checklist and limits

- New Game BRA; enable Air Mode; select Brasília AirBase and its Fighter.
- Assign Air Superiority to a reachable zone; check range and superiority.
- Declare war; opposing in-range fighters in one zone should lose aircraft together.
- Put CAS over an existing land battle; verify AirZone support percentages.
- Put Bomber over a hostile zone; verify bounded treasury disruption/interception.
- Cancel mission, stock iron/tools and gold; verify base recovery/replacement.
- Rebase to São Paulo; save during transit, load, then observe arrival.
- Save/load an assigned mission; verify no extra initial groups and player retained.
- Test F, zoom/pan and x3 with Air Mode on/off; inspect aggregated profiling.

Not implemented: Battle System V3, drones, missiles, SAM/complex air defense, carriers,
paratroopers, airborne transport, complex strategic campaigns/logistics, doctrines,
full air technology, pilots/commanders, radar, fuel, aviation weather, naval aviation,
air war score, naval range, blockades or World Wrap. No naval combat formulas or
War Resolution formulas were changed. Aircraft loss never counts as land manpower.

Next: Battle System V3 consumes these air APIs; Aircraft Construction V1.1 supplies
new groups; War Resolution V1.1 can add air contributions, followed by Peace
Conference V2. Modern Warfare later introduces drones, missiles, air defense and
long-range strikes. The data-driven catalog and clean support/control boundary are
the extension hooks; no placeholder future aircraft types or technology tree exist.

No commit or push is part of this task.
