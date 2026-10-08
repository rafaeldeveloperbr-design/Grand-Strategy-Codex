"""Offline geometry generator/audit. Requires Python + shapely (authoring only).

Natural Earth public-domain 1:110m country outlines, projected equirectangular.
Internal cells are gameplay regions, not real administrative boundaries.
This tool writes ONLY geometry.ts; movement edges are separately authored.
"""
import json
from pathlib import Path

from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union
from world_projection import project

ROOT = Path(__file__).resolve().parent
DEST = ROOT.parents[1] / 'src/data/map/regions/southAmerica/geometry.ts'


def clip_half_plane(vertices, nx, ny, limit):
    result = []
    for a, b in zip(vertices, vertices[1:] + vertices[:1]):
        da, db = a[0] * nx + a[1] * ny - limit, b[0] * nx + b[1] * ny - limit
        if da <= 0:
            result.append(a)
        if (da <= 0) != (db <= 0):
            t = da / (da - db)
            result.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return result


def polygons(geometry):
    return [geometry] if geometry.geom_type == 'Polygon' else list(geometry.geoms)


def svg_path(geometry, precision=3):
    paths = []
    for polygon in polygons(geometry):
        for ring in [polygon.exterior, *polygon.interiors]:
            points = list(ring.coords)[:-1]
            paths.append('M' + ' L'.join(f'{x:.{precision}f},{y:.{precision}f}' for x, y in points) + ' Z')
    return ' '.join(paths)


def generate():
    outlines = {tag: shape(value) for tag, value in json.loads((ROOT / 'southAmerica.outlines.json').read_text()).items()}
    seeds = json.loads((ROOT / 'southAmerica.provinces.json').read_text(encoding='utf-8'))
    cells = {}
    lines = ["import type { ProvinceGeometry } from '../../types';", '',
             '// Natural Earth 1:110m outlines; see tools/map/README.md for provenance.',
             '// Generated gameplay subdivisions. Never used to infer movement edges.',
             'export const provinceGeometry: ProvinceGeometry[] = [']
    for seed in seeds:
        x, y = seed['longitude'], seed['latitude']
        vertices = [(-90, -60), (-25, -60), (-25, 20), (-90, 20)]
        for other in seeds:
            if other['tag'] != seed['tag'] or other['id'] == seed['id']:
                continue
            ox, oy = other['longitude'], other['latitude']
            vertices = clip_half_plane(vertices, ox - x, oy - y, (ox * ox + oy * oy - x * x - y * y) / 2)
        cell = outlines[seed['tag']].intersection(Polygon(vertices))
        assert cell.is_valid and not cell.is_empty, seed['id']
        cells[seed['id']] = cell
        visual = transform(project, cell)
        # Use the regional seed when it is inland; otherwise an interior point.
        center = Point(project(x, y))
        if not visual.buffer(-4).contains(center):
            center = max(polygons(visual), key=lambda p: p.area).representative_point()
        lines.append(f"  {{ id: '{seed['id']}', center: {{ x: {center.x:.3f}, y: {center.y:.3f} }}, path: '{svg_path(visual)}' }},")
    lines.append('];')
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text('\n'.join(lines) + '\n', encoding='utf-8')

    # Authoring audit: coverage, interior overlap and rounded SVG centers.
    for tag, outline in outlines.items():
        union = unary_union([cells[s['id']] for s in seeds if s['tag'] == tag])
        assert union.symmetric_difference(outline).area < 1e-7, tag
    ids = list(cells)
    max_overlap = max(cells[a].intersection(cells[b]).area for i, a in enumerate(ids) for b in ids[i + 1:])
    assert max_overlap < 1e-4, max_overlap
    print(f'Geometry audit: {len(cells)} valid cells, complete country coverage; max overlap {max_overlap:.9f} square degrees.')
    # Diagnostic suggestions only. No topology is written by this generator.
    for tag in outlines:
        print(tag + ': ' + '; '.join(a.removeprefix('sa_') + ' / ' + b.removeprefix('sa_')
              for i, a in enumerate(ids) for b in ids[i + 1:]
              if cells[a].boundary.intersection(cells[b].boundary).length > .05
              and next(s['tag'] for s in seeds if s['id'] == a) == tag))


if __name__ == '__main__':
    generate()
