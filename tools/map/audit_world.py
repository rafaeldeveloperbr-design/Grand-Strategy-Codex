"""Audit checked-in, rounded SVG geometry (both regions) using Shapely.

Checks actual output bounds, interior centers and pairwise overlap, not only seeds.
"""
import re
from pathlib import Path
from shapely.geometry import Polygon, MultiPolygon, Point

ROOT = Path(__file__).resolve().parents[2]


def read_geometry():
    cells = {}
    for region in ['southAmerica','northAmerica']:
        text = (ROOT / f'src/data/map/regions/{region}/geometry.ts').read_text(encoding='utf-8')
        records = re.findall(r"id: '([^']+)', center: \{ x: ([\d.-]+), y: ([\d.-]+) \}, path: '([^']+)'", text)
        for id, x, y, path in records:
            outlines = []
            for ring in path.split('M')[1:]:
                points = [tuple(map(float, p.split(','))) for p in ring.replace('Z','').strip().split(' L')]
                # SVG rings are emitted exterior, then any interiors for that polygon.
                if outlines and Polygon(outlines[-1][0]).contains(Polygon(points).representative_point()):
                    outlines[-1][1].append(points)
                else:
                    outlines.append((points, []))
            poly = MultiPolygon([Polygon(exterior,holes) for exterior,holes in outlines])
            assert id not in cells, id
            assert poly.is_valid and not poly.is_empty, id
            assert poly.contains(Point(float(x),float(y))), f'Center outside {id}'
            left,top,right,bottom = poly.bounds
            assert 0 <= left <= right <= 5040 and 0 <= top <= bottom <= 2520, id
            cells[id] = poly
    return cells


def audit():
    cells = read_geometry()
    ids = list(cells)
    assert len(ids) == 91
    worst = (0,None,None)
    for i,a in enumerate(ids):
        for b in ids[i+1:]:
            overlap = cells[a].intersection(cells[b]).area
            if overlap > worst[0]:
                worst = (overlap,a,b)
    # Tiny slivers from three-decimal SVG rounding are tolerated, not structural overlap.
    assert worst[0] < .05, worst
    print(f'World SVG audit: {len(cells)} valid cells, interior centers and global bounds; max overlap {worst}.')
    return cells


if __name__ == '__main__':
    audit()
