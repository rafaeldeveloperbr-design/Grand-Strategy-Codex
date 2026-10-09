import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'error'});
try {
  const {provincesData}=await server.ssrLoadModule('/src/data/map/index.ts');
  const bounds={};
  for(const p of [...provincesData].sort((a,b)=>a.id.localeCompare(b.id))) {
    // Authored world paths are absolute polygon M/L/Z. Conservatively retain unknown shapes.
    if(/[a-kno-y]/i.test(p.path)){bounds[p.id]=[0,0,5040,2520];continue;}
    const values=(p.path.match(/-?\d+(?:\.\d+)?/g)??[]).map(Number);
    const xs=values.filter((_,i)=>i%2===0),ys=values.filter((_,i)=>i%2===1);
    bounds[p.id]=[Math.floor(Math.min(...xs)),Math.floor(Math.min(...ys)),Math.ceil(Math.max(...xs)),Math.ceil(Math.max(...ys))];
  }
  await writeFile('src/data/airMapBounds.json',JSON.stringify(bounds)+'\n');
  console.log(`Generated conservative air overlay bounds for ${provincesData.length} provinces.`);
}finally{await server.close();}
