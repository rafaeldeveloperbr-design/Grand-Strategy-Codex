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
not official state/department borders. Both regions now use `world_projection.py`:
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
for both regions. Three-decimal rounding can produce tiny boundary slivers under
0.05 square SVG units, never structural overlap.

Topology remains explicitly authored in each region's `topology.ts`; contact
diagnostics never create neighbors. `crossRegionConnections.ts` declares
`sa_col_caribe` ↔ `na_pan_panama` once; the assembler expands it bidirectionally.
Expected landmasses are declared in `MapRegion.landmasses`. Islands never receive
fake mainland edges; split mainlands and unexpected landmass connections fail
validation.
