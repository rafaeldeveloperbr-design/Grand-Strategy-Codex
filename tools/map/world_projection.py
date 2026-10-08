"""Shared equirectangular coordinates, with geometry-only antimeridian splitting."""
from shapely.geometry import Polygon, box
from shapely.affinity import translate
from shapely.ops import unary_union

def project(x, y, z=None):
    return (x + 180) * 14, (90 - y) * 14

def split_antimeridian(geometry):
    """Unwrap each ring, clip to 360-degree windows and return edge fragments.
    This never creates movement edges or a wrapping camera.
    """
    def unwrap(ring):
        result=[]
        for x,y in ring.coords:
            if result:
                while x-result[-1][0]>180: x-=360
                while x-result[-1][0]<-180: x+=360
            result.append((x,y))
        return result
    result=[]
    parts=[geometry] if geometry.geom_type=='Polygon' else geometry.geoms
    for part in parts:
        if part.geom_type!='Polygon': continue
        exterior=unwrap(part.exterior)
        exterior_mid=sum(x for x,y in exterior)/len(exterior)
        holes=[]
        for ring in part.interiors:
            hole=unwrap(ring)
            hole_mid=sum(x for x,y in hole)/len(hole)
            shift=round((exterior_mid-hole_mid)/360)*360
            holes.append([(x+shift,y) for x,y in hole])
        poly=Polygon(exterior,holes)
        for offset in [-360,0,360]:
            clipped=translate(poly,xoff=offset).intersection(box(-180,-90,180,90))
            if clipped.geom_type=='Polygon' and clipped.area>0: result.append(clipped)
            elif clipped.geom_type=='MultiPolygon': result.extend(clipped.geoms)
    return unary_union(result)
