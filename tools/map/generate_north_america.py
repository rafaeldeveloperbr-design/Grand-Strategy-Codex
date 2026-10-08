"""Offline North America geometry/data authoring; topology remains explicitly authored.

Uses checked-in mainland/principal-island Natural Earth outlines. No runtime Python.
"""
import json
from pathlib import Path
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union
from generate_south_america import clip_half_plane, polygons, svg_path
from world_projection import project

ROOT = Path(__file__).resolve().parent
DEST = ROOT.parents[1] / 'src/data/map/regions/northAmerica'


def generate():
    outlines = {tag: shape(value) for tag, value in json.loads((ROOT / 'northAmerica.outlines.json').read_text()).items()}
    seeds = json.loads((ROOT / 'northAmerica.provinces.json').read_text(encoding='utf-8'))
    cells = {}
    lines = ["import type { ProvinceGeometry } from '../../types';", '',
             '// Generated from Natural Earth 1:110m. See tools/map/README.md.',
             '// Shared world projection; geometry never defines movement edges.',
             'export const provinceGeometry: ProvinceGeometry[] = [']
    definitions = ["import type { TerrainType } from '../../../../engine/terrain';", '',
                   '// Generated from tools/map/northAmerica.provinces.json; gameplay values, not census data.',
                   'export const definitions: readonly [id: string, name: string, owner: string, population: number, development: number, terrain: TerrainType][] = [']
    for seed in seeds:
        x, y = seed['longitude'], seed['latitude']
        vertices = [(-180, -90), (180, -90), (180, 90), (-180, 90)]
        for other in seeds:
            if other['tag'] != seed['tag'] or other['id'] == seed['id']:
                continue
            ox, oy = other['longitude'], other['latitude']
            vertices = clip_half_plane(vertices, ox-x, oy-y, (ox*ox+oy*oy-x*x-y*y)/2)
        cell = outlines[seed['tag']].intersection(Polygon(vertices))
        assert cell.is_valid and not cell.is_empty, seed['id']
        cells[seed['id']] = cell
        visual = transform(project, cell)
        center = Point(project(x, y))
        if not visual.buffer(-4).contains(center):
            center = max(polygons(visual), key=lambda p: p.area).representative_point()
        # Audit rounded centers, not just full-precision authoring points.
        assert visual.contains(Point(round(center.x, 3), round(center.y, 3))), seed['id']
        lines.append(f"  {{ id: '{seed['id']}', center: {{ x: {center.x:.3f}, y: {center.y:.3f} }}, path: '{svg_path(visual)}' }},")
        definitions.append('  [' + ', '.join(json.dumps(seed[k], ensure_ascii=False) for k in ['id','name','tag','population','development','terrain']) + '],')
    for tag, outline in outlines.items():
        union = unary_union([cells[s['id']] for s in seeds if s['tag'] == tag])
        assert union.symmetric_difference(outline).area < 1e-7, tag
    ids = list(cells)
    overlap = max(cells[a].intersection(cells[b]).area for i,a in enumerate(ids) for b in ids[i+1:])
    assert overlap < 1e-4, overlap
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / 'geometry.ts').write_text('\n'.join(lines + ['];','']), encoding='utf-8')
    (DEST / 'definitions.ts').write_text('\n'.join(definitions + ['];','']), encoding='utf-8')
    print(f'North America: {len(cells)} valid cells, complete coverage, maximum overlap {overlap:.9f}.')
    # Contact diagnostics only. Never writes neighbors.
    for i,a in enumerate(ids):
        contacts = [b for b in ids[i+1:] if cells[a].boundary.intersection(cells[b].boundary).length > .01]
        if contacts:
            print(a + ': ' + ', '.join(contacts))


if __name__ == '__main__':
    generate()
