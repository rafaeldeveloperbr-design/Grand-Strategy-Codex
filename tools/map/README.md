# South America V1 authoring

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
not official state/department borders. Projection: x = (longitude + 82) * 14,
y = (13 - latitude) * 14.

With Python and Shapely installed, run:

```sh
python tools/map/generate_south_america.py
```

The generator writes `geometry.ts` and verifies country coverage and overlaps.
Its contact suggestions are authoring diagnostics. It does not create movement
connections: `topology.ts` is separately authored and reviewed, with selected
Andean crossings and no maritime routes. Runtime has no Python, network or Shapely
dependency. Changing a drawing does not change neighbors or movement costs.
