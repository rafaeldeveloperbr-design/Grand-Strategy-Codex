"""Offline supplemental geometry generation; topology is separately authored in TS."""
import json
from pathlib import Path
from shapely.geometry import shape, Point
from shapely.ops import transform
from generate_south_america import svg_path, polygons
from world_projection import project, split_antimeridian
ROOT=Path(__file__).resolve().parent

def generate():
 records=json.loads((ROOT/'completeness.extract.json').read_text(encoding='utf-8'))
 geometry=[]; definitions=[]; countries=[]
 for e in records:
  visual=transform(project,split_antimeridian(shape(e['geometry']))).buffer(0)
  assert visual.is_valid and not visual.is_empty,e['id']
  center=max(polygons(visual),key=lambda p:p.area).representative_point()
  assert visual.contains(Point(round(center.x,3),round(center.y,3))),e['id']
  geometry.append(f"  {{ id: '{e['id']}', center: {{ x: {center.x:.3f}, y: {center.y:.3f} }}, path: '{svg_path(visual, precision=6)}' }},")
  definitions.append('  '+json.dumps([e[k] for k in ['id','name','owner','population','development','terrain','region']],ensure_ascii=False)+',')
  if e['country']:
   c=e['country'];countries.append('  '+json.dumps([c['tag'],c['name'],c.get('capitalId',e['id']),c['capital'],e['region']],ensure_ascii=False)+',')
 dest=ROOT.parents[1]/'src/data/map/completeness'
 dest.mkdir(exist_ok=True)
 (dest/'geometry.ts').write_text("import type { ProvinceGeometry } from '../types';\n// Generated offline from completeness.extract.json; see tools/map/README.md.\nexport const geometry: ProvinceGeometry[] = [\n"+'\n'.join(geometry)+"\n];\n",encoding='utf-8')
 (dest/'definitions.ts').write_text("import type { TerrainType } from '../../../engine/terrain';\n// Generated gameplay values; not census or recognition claims.\nexport const definitions: readonly [string,string,string,number,number,TerrainType,string][] = [\n"+'\n'.join(definitions)+"\n];\nexport const countryDefinitions: readonly [string,string,string,string,string][] = [\n"+'\n'.join(countries)+"\n];\n",encoding='utf-8')
 print(f'Completeness: {len(records)} valid supplemental shapes, {len(countries)} scenario countries.')
if __name__=='__main__': generate()
