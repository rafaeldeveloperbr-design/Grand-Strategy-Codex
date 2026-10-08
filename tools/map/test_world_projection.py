"""Geometry-only antimeridian regression tests, independent of runtime routing."""
import unittest
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.ops import transform
from world_projection import project, split_antimeridian

class ProjectionTests(unittest.TestCase):
    def test_crossing_ring_splits_to_edges(self):
        source=Polygon([(179,10),(-179,10),(-179,12),(179,12)])
        result=split_antimeridian(source)
        self.assertTrue(result.is_valid)
        self.assertAlmostEqual(result.area,4)
        self.assertEqual(len(result.geoms),2)
        self.assertTrue(result.contains(Point(179.5,11)))
        self.assertTrue(result.contains(Point(-179.5,11)))
        self.assertFalse(result.contains(Point(0,11)))
    def test_normal_ring_retains_geometry(self):
        source=Polygon([(10,10),(11,10),(11,11),(10,11)])
        self.assertTrue(source.equals(split_antimeridian(source)))
    def test_crossing_hole_aligns_with_exterior(self):
        source=Polygon([(179,0),(-179,0),(-179,4),(179,4)],
                       [[(-179.5,1),(179.5,1),(179.5,2),(-179.5,2)]])
        result=split_antimeridian(source)
        self.assertTrue(result.is_valid)
        self.assertAlmostEqual(result.area,7)
        self.assertFalse(result.contains(Point(179.8,1.5)))
        self.assertFalse(result.contains(Point(-179.8,1.5)))
    def test_already_split_multipolygon_is_idempotent(self):
        source=MultiPolygon([Polygon([(179,10),(180,10),(180,11),(179,11)]),Polygon([(-180,10),(-179,10),(-179,11),(-180,11)])])
        result=split_antimeridian(source)
        self.assertTrue(source.equals(result))
        self.assertTrue(result.equals(split_antimeridian(result)))
    def test_projection_bounds_and_no_large_segment(self):
        result=transform(project,split_antimeridian(Polygon([(179,-10),(-179,-10),(-179,-8),(179,-8)])))
        self.assertEqual(result.bounds[0],0)
        self.assertEqual(result.bounds[2],5040)
        for p in result.geoms:
            coords=list(p.exterior.coords)
            self.assertTrue(all(abs(a[0]-b[0])<30 for a,b in zip(coords,coords[1:])))
if __name__=='__main__':unittest.main()
