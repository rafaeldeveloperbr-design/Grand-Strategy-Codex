// Authoring-only bridge: inspect the actual TypeScript assembly and validator.
// No separately maintained landmass/topology manifest and no runtime dependency.
import { createServer } from 'vite';

const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom',logLevel:'error'});
try {
  const map = await server.ssrLoadModule('/src/data/map/index.ts');
  process.stdout.write(JSON.stringify({
    regions:map.mapRegions.map(r=>r.id),
    provinceIds:map.provincesData.map(p=>p.id),
    countryTags:map.countries.map(c=>c.tag),
    provinces:map.provincesData.map(p=>({id:p.id,owner:p.owner,neighbors:p.neighbors})),
    landmasses:map.mapLandmasses,
    topology:map.validateMapTopology(map.provincesData,map.countries),
  }));
} finally {
  await server.close();
}
