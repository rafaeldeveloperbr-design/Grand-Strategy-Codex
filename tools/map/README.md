# World Map V1 authoring

Country outlines are a mainland-only extract of the public-domain Natural Earth
1:110m Admin 0 dataset:
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson
https://www.naturalearthdata.com/about/terms-of-use/

French Guiana is extracted from France's South American polygon. Offshore islands,
the detached Tierra del Fuego polygons and disputed-territory gameplay are omitted.
This source represents contemporary country positions, not the game's 1444 history.

`southAmerica.provinces.json` stores regional seeds and approximate gameplay values.
`southAmerica.outlines.json` stores the checked-in country outlines for offline,
repeatable generation. Internal provinces are simplified gameplay partitions,
not official state/department borders. All six active regions use `world_projection.py`:
x = (longitude + 180) * 14, y = (90 - latitude) * 14.
Global bounds are 5040 × 2520; future continents use the same SVG space.

With Python and Shapely installed, run:

```sh
python tools/map/generate_south_america.py
```

The generator writes `geometry.ts` and verifies country coverage and overlaps.
Its contact suggestions are authoring diagnostics. It does not create movement
connections: `topology.ts` is separately authored and reviewed, with selected
Andean crossings and no maritime routes. Runtime has no Python, network or Shapely
dependency. Changing a drawing does not change neighbors or movement costs.

## North America V1

`northAmerica.outlines.json` extracts the same Natural Earth GeoJSON linked above,
selecting ADM0_A3 CAN, USA, MEX, GTM, BLZ, HND, SLV, NIC, CRI, PAN, CUB, HTI, DOM,
JAM. The largest polygon per country is retained: USA is contiguous mainland;
Alaska/Hawaii, Canadian Arctic islands and Newfoundland are omitted. Caribbean
countries retain their principal island, including both countries on Hispaniola.
The checked-in extract makes generation offline and reproducible.

`northAmerica.provinces.json` holds 35 strategic seeds, names, gameplay population,
development and existing terrain types. These are not administrative/census data.

```sh
python tools/map/generate_south_america.py
python tools/map/generate_north_america.py
python tools/map/audit_world.py
```

Python/Shapely are authoring requirements only. The North America generator writes
`geometry.ts` and `definitions.ts`, auditing coverage, polygon validity, interior
centers and overlap. `audit_world.py` separately checks actual rounded SVG outputs
for all four regions. Three-decimal rounding can produce tiny boundary slivers under
0.05 square SVG units, never structural overlap.

Topology remains explicitly authored in each region's `topology.ts`; contact
diagnostics never create neighbors. `crossRegionConnections.ts` declares
`sa_col_caribe` ↔ `na_pan_panama` once; the assembler expands it bidirectionally.
Expected landmasses are declared in `MapRegion.landmasses`. Islands never receive
fake mainland edges; split mainlands and unexpected landmass connections fail
validation.

## Europe + Africa V1 (Step 2)

`europe.outlines.json` and `africa.outlines.json` are checked-in extracts of the
same Natural Earth Admin 0 1:110m GeoJSON. Country selection uses `ADM0_A3`;
the largest polygon is retained, except Denmark, whose two polygons deliberately
retain Jutland and Zealand. Its seeds specify `outlinePart` (0 = Jutland,
1 = Zealand), so Voronoi clipping never assigns Jutland fragments to Copenhagen.
Northern Ireland, Sicily/Sardinia, Corsica, Svalbard, Cabinda and other detached
territories are omitted. Countries not in the gameplay roster remain gaps, not
new territory assigned to a neighbor. Russia is deferred to Asia/Eurasia.

`europe.provinces.json` contains 56 seeds for 28 countries; `africa.provinces.json`
contains 49 seeds for 34 countries, including Madagascar. Capitals and gameplay
values are independent of historic census/budgets. Regeneration is offline:

```sh
python tools/map/generate_south_america.py
python tools/map/generate_north_america.py
python tools/map/generate_europe.py
python tools/map/generate_africa.py
python tools/map/audit_world.py
```

The two new wrappers call `generate_region.py`, reusing the existing half-plane
partitioning/SVG helpers and `world_projection.py`. Only polygonal parts of
clipped GeometryCollections are serialized; zero-area line fragments are ignored.
Country coverage tolerance is 1e-6 square degrees for numerical clipping slivers;
the output audit independently checks all 196 shapes, IDs, interior centers,
bounds, structural overlap, and geometric contact of the new **authored** land
edges. It never builds or rewrites neighbors.

Mainland Europe and Scandinavia are separate **modeled** land components until
Russia's real land bridge is available. No Denmark–Sweden or Channel crossing is
invented. Ireland, Great Britain, Zealand and Madagascar are also explicit groups.
Africa remains one continental component. Inland lake borders (e.g. Congo–Tanzania)
follow the existing coarse land-border model; there are no maritime edges.

## Asia + Oceania Core (Step 3A)

The Step 2 descriptions above record its historical scope. The active assembly
now has six regions, 128 countries and 274 provinces. Asia contributes 37/70;
Oceania contributes 2/8. Regenerate offline with `generate_asia.py` and
`generate_oceania.py`, using the same checked-in outlines/seeds and projection.
Russia retains its mainland polygon up to longitude 180; antimeridian fragments,
Kaliningrad and islands are deferred. Turkey retains Thrace/Anatolia separately.
Malaysia retains its peninsula; Indonesia retains Java/Sumatra as separate parts.
Australia excludes Tasmania; New Zealand retains North/South Island separately.
No outline selection creates sea neighbors or a Bosporus bridge.

`audit_world.py` audits all 274 shapes and authored geometric contacts. Its
`export_audit.mjs` bridge uses the installed Vite/Node toolchain to inspect the
actual TypeScript assembly and topology validator: 128 unique country tags,
17 intentional landmasses and 11 cross-region edges. Russia and Sinai join
Europe/Asia/Africa into the shared `eurasian-mainland` declaration. Generators
never create neighbors; topology remains explicitly authored.

See `docs/world-map-expansion-v1-step-3a.md` and the mandatory planned
`docs/world-map-completeness-backlog.md` for omitted countries/territories and
secondary polygon parts. Completing that backlog is Step 3B, before naval work.

## Step 3B completeness: offline supplemental extracts

The previous sections describe the CORE debt history. Active assembly now extends
those same six regions through `src/data/map/completeness`, never a second map.
`completeness.extract.json` contains only needed vector polygons, resolution,
region, owner, gameplay seed values and optional scenario country/capital metadata.
Its generated TS definitions are consumed through the existing `createProvinceGameplay`
and `assembleMap` pipeline. No additional country/geometry audit manifest exists.

Sources downloaded on 08 October 2026, Natural Earth public domain:
- 110m Admin 0 Countries: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson
  SHA256 `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`.
- 10m Admin 0 Map Units: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson
  SHA256 `57da82be755f4afccd8f3b14251bb2752f5df1395f47d2d86f817470c4a48862`.
- License: https://www.naturalearthdata.com/about/terms-of-use/ (public domain,
  modification and distribution permitted).

110m remains the main world source. 10m is used only where an entity or detached
island is omitted/inadequate at 110m. Microstate footprints carve local holes from
CORE; Gibraltar and Macao require small local neighboring border patches.
Source features are selected by ADM0_A3/GU_A3; source SAH/KOS/PSX are mapped to
scenario ESH/XKX/PSE. Their names/owners express gameplay representation only.
Full source dumps are not versioned. Source coastlines are neither hand drawn nor
inflated for clicking. Offline restoration keeps all pre-existing province IDs.
Detached 10m extracts filter polygons below 0.00001 square geographic degrees and
within 0.03 degrees of CORE, avoiding high-resolution coastal slivers. Resulting
omissions are explicitly recorded in the backlog. Small neighboring islands may
use a strategic compound holding with no neighbors; large mainland/island holdings
that would permit a false jump (Bioko, PNG offshore, Gaza) are separate provinces.

`generate_completeness.py` writes only geometry/definitions. Topology and intentional
land components live in the reviewed TS `completeness/topology.ts`; generation
never invents movement contacts. Runtime never downloads source geometry.
Supplemental SVG uses six decimals to retain small island rings; CORE retains
three. `split_antimeridian` unwraps, aligns holes, clips and normalizes rings into
[-180,180]. It changes geometry only, without camera wrap or logical seam edges.

Regenerate and audit:

```sh
python tools/map/generate_south_america.py
python tools/map/generate_north_america.py
python tools/map/generate_europe.py
python tools/map/generate_africa.py
python tools/map/generate_asia.py
python tools/map/generate_oceania.py
python tools/map/generate_completeness.py
python tools/map/test_world_projection.py
python tools/map/audit_world.py
node tools/map/benchmark_world.mjs
```

The audit reads actual rounded SVG, the extract roster and live TypeScript assembly.
It checks validity, centers, bounds, overlaps, antimeridian segments, duplicate tags
and IDs, complete landmass membership, actual contact on authored terrestrial edges,
compound part counts and cross-region edges. The existing overlap tolerance remains
0.05 SVG square units; no validation threshold was raised for Step 3B.
Benchmark medians are local authoring diagnostics, not browser GPU/frame-time claims.
Detailed decisions and measurements: `docs/world-map-expansion-v1-step-3b.md`.
