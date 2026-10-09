import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
import { geometryIndex } from './naval-geometry.mjs';
const server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { provincesData: provinces, countries } = await server.ssrLoadModule('/src/data/map/index.ts');
  const { shapes, land, waterLine } = geometryIndex(provinces);
  const nodes = [], edges = [], coastal = [], berths = new Map();
  const project = (lon, lat) => [(lon+180)*14, (90-lat)*14];
  const ocean = (x,y) => { const lon=x/14-180, lat=90-y/14; return lat < -50 ? 'Southern Ocean' : lon < -70 || lon > 120 ? 'Pacific' : lon > 20 ? 'Indian / Asian seas' : lat > 30 ? 'North Atlantic / European seas' : 'Atlantic'; };
  const addNode = (x,y) => { const node = { id: `sea-${nodes.length}`, x: +x.toFixed(3), y: +y.toFixed(3), ocean: ocean(x,y), neighbors: [] }; nodes.push(node); return node; };
  // A 6 degree offshore lattice, refined to 3 degrees next to coasts.
  for (let x=0; x<=5040; x+=42) for (let y=126; y<=2100; y+=42) {
    if (land(x,y)) continue;
    const near = [[42,0],[-42,0],[0,42],[0,-42]].some(([dx,dy]) => land(x+dx,y+dy));
    if ((x%84===0 && y%84===42) || near) addNode(x,y);
  }
  // Narrow passages receive coordinates, never hand-authored edges.
  for (const [lon,lat] of [[-6,36],[-5.7,35.95],[-5.4,35.95],[-5.1,36],[-4.7,36], [9,58],[10,57.5],[11,57],[11.7,56.5],[12.4,56],[12.65,55.8],[12.8,55.5],[13,55],[14,55], [103.5,1.1],[104,1],[104.5,1.2], [129,34],[130,33.5]]) {
    const [x,y]=project(lon,lat); if (!land(x,y)) addNode(x,y);
  }
  for (const [left,right,bottom,top] of [[-7,-3,34,38],[8,15,54,59]]) for(let lon=left;lon<=right;lon+=.5) for(let lat=bottom;lat<=top;lat+=.5) {
    const [x,y]=project(lon,lat);if(!land(x,y)&&!nodes.some(n=>n.x===x&&n.y===y)) addNode(x,y);
  }
  for (const shape of shapes) {
    const options=[];
    for (const ring of shape.rings) for (let i=0;i<ring.length;i++) {
      const a=ring[i], b=ring[(i+1)%ring.length], len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if (len < .1) continue;
      const x=(a[0]+b[0])/2, y=(a[1]+b[1])/2, dx=(b[1]-a[1])/len*2, dy=(a[0]-b[0])/len*2;
      // A border is coastal only when its opposite side is water in the whole world.
      if (land(x+dx,y+dy) !== land(x-dx,y-dy)) {
        const berth=land(x+dx,y+dy) ? [x-dx,y-dy] : [x+dx,y+dy];
        options.push({ berth, len });
      }
    }
    if (options.length) { coastal.push(shape.id); berths.set(shape.id,options.sort((a,b)=>b.len-a.len)); }
  }
  const portCandidates=[];
  // One operational base per eligible country, plus an explicit US Pacific base.
  for (const country of countries) {
    const candidates=provinces.filter(p=>p.owner===country.tag && berths.has(p.id)).sort((a,b)=> Number(b.id===country.capitalId)-Number(a.id===country.capitalId) || b.development-a.development || a.id.localeCompare(b.id));
    portCandidates.push(...candidates);
  }
  const ports=[];
  for (const p of portCandidates) {
    for (const {berth} of berths.get(p.id)) {
      const near=nodes.map(n=>({n,d:Math.hypot(n.x-berth[0],n.y-berth[1])})).filter(v=>v.d<200).sort((a,b)=>a.d-b.d);
      const link=near.find(v=>waterLine(berth,[v.n.x,v.n.y]));
      if (!link) continue;
      ports.push({ provinceId:p.id, level: Math.min(3,Math.max(1,Math.floor(p.development/4))), seaNodeId:link.n.id, x:+berth[0].toFixed(3), y:+berth[1].toFixed(3) }); break;
    }
  }
  const bins=new Map();
  for (const n of nodes) { const key=`${Math.floor(n.x/160)},${Math.floor(n.y/160)}`, b=bins.get(key)??[]; b.push(n); bins.set(key,b); }
  const keys=new Set();
  function edge(a,b,logical=false) {
    const key=[a.id,b.id].sort().join('|'); if(keys.has(key)) return;
    if(!logical && !waterLine([a.x,a.y],[b.x,b.y])) return;
    keys.add(key); a.neighbors.push(b.id); b.neighbors.push(a.id);
    edges.push({a:a.id,b:b.id,distance:+Math.hypot(logical ? 5040-Math.abs(a.x-b.x) : a.x-b.x,a.y-b.y).toFixed(3) || 42,...(logical?{logical:true}:{})});
  }
  for(const n of nodes) {
    const near=[];
    for(let x=Math.floor(n.x/160)-1;x<=Math.floor(n.x/160)+1;x++) for(let y=Math.floor(n.y/160)-1;y<=Math.floor(n.y/160)+1;y++) for(const other of bins.get(`${x},${y}`)??[]) {
      const d=Math.hypot(n.x-other.x,n.y-other.y); if(other!==n && d<=160) near.push({other,d});
    }
    for(const {other} of near.sort((a,b)=>a.d-b.d).slice(0,12)) edge(n,other);
  }
  for(const n of nodes.filter(n=>n.x===0)) { const other=nodes.find(o=>o.x===5040 && o.y===n.y); if(other) edge(n,other,true); }
  // Inland lakes and disconnected fragments are excluded, never treated as oceans.
  const byId=new Map(nodes.map(n=>[n.id,n])), visited=new Set(), components=[];
  for(const n of nodes) if(!visited.has(n.id)) { const ids=new Set([n.id]), queue=[n.id]; visited.add(n.id); for(let i=0;i<queue.length;i++) for(const id of byId.get(queue[i]).neighbors) if(!visited.has(id)) { visited.add(id); ids.add(id); queue.push(id); } components.push(ids); }
  components.sort((a,b)=>b.size-a.size); const main=components[0];
  const connectedPorts=ports.filter(p=>main.has(p.seaNodeId)), usedTags=new Set();
  const operationalPorts=connectedPorts.filter(p=>{const tag=provinces.find(v=>v.id===p.provinceId).owner;if(usedTags.has(tag)&&p.provinceId!=='na_usa_california')return false;usedTags.add(tag);return true;});
  // Explicit coast links are independent of operational ports. Only main-ocean
  // nodes with an unobstructed water segment from a real coastline qualify.
  const coastalSeaNodes = {};
  for (const p of provinces) {
    const links = new Map();
    for (const { berth } of berths.get(p.id) ?? []) {
      const candidates=[];
      for(let x=Math.floor(berth[0]/160)-2;x<=Math.floor(berth[0]/160)+2;x++) for(let y=Math.floor(berth[1]/160)-2;y<=Math.floor(berth[1]/160)+2;y++) candidates.push(...(bins.get(`${x},${y}`)??[]));
      const nearby=candidates.filter(n=>main.has(n.id)&&Math.hypot(n.x-berth[0],n.y-berth[1])<200).sort((a,b)=>Math.hypot(a.x-berth[0],a.y-berth[1])-Math.hypot(b.x-berth[0],b.y-berth[1])||a.id.localeCompare(b.id));
      for (const n of nearby.slice(0,12)) {
        if (!main.has(n.id) || Math.hypot(n.x-berth[0],n.y-berth[1]) >= 200 || !waterLine(berth,[n.x,n.y])) continue;
        links.set(n.id,n);
      }
    }
    const port=operationalPorts.find(port=>port.provinceId===p.id);
    if(port) links.set(port.seaNodeId,byId.get(port.seaNodeId));
    if (links.size) coastalSeaNodes[p.id] = [...links.values()].sort((a,b)=>Math.hypot(a.x-p.center.x,a.y-p.center.y)-Math.hypot(b.x-p.center.x,b.y-p.center.y) || a.id.localeCompare(b.id)).map(n=>n.id);
  }
  const graph={ coastalSeaNodes, waterBorderProvinceIds: coastal.sort(), nodes:nodes.filter(n=>main.has(n.id)).map(n=>({...n,neighbors:n.neighbors.filter(id=>main.has(id)).sort()})), edges:edges.filter(e=>main.has(e.a)&&main.has(e.b)), ports:operationalPorts, coastalProvinceIds:Object.keys(coastalSeaNodes).sort() };
  // Validation uses rounded output, exactly as consumed by the game.
  for(const n of graph.nodes) if(land(n.x,n.y)) throw new Error(`Land node ${n.id}`);
  for(const e of graph.edges) if(!e.logical && !waterLine([byId.get(e.a).x,byId.get(e.a).y],[byId.get(e.b).x,byId.get(e.b).y])) throw new Error(`Land edge ${e.a}/${e.b}`);
  for(const p of graph.ports) if(!waterLine([p.x,p.y],[byId.get(p.seaNodeId).x,byId.get(p.seaNodeId).y])) throw new Error(`Invalid berth ${p.provinceId}`);
  if(process.argv.includes('--check')) {if(await readFile('src/data/navalWorld.json','utf8')!==JSON.stringify(graph)) throw new Error('Naval world differs from deterministic generation');}
  else await writeFile('src/data/navalWorld.json',JSON.stringify(graph));
  console.log(JSON.stringify({nodes:graph.nodes.length,edges:graph.edges.length,ports:graph.ports.length,coastal:graph.coastalProvinceIds.length,logical:graph.edges.filter(e=>e.logical).length,excludedComponents:components.length-1}));
} finally { await server.close(); }
