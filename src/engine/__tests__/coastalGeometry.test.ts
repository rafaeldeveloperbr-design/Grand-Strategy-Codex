import { describe, it, expect } from 'vitest';
import { geometryIndex } from '../../../tools/map/naval-geometry.mjs';
import { provincesData } from '../../data/map/index.ts';
import { getCoastalSeaNodes } from '../naval/world.ts';

describe('Generated beach connections respect geometry',()=>{
  it('rejects a water segment across a continental barrier',()=>{
    const geometry=geometryIndex([{id:'barrier',path:'M10,0 L20,0 L20,30 L10,30 Z'}]);
    expect(geometry.waterLine([0,15],[30,15])).toBe(false);
    expect(geometry.waterLine([0,40],[30,40])).toBe(true);
  });
  it.each(['sa_arg_restored_1','sa_chl_restored_1'])('every Tierra del Fuego link has a real unobstructed offshore anchor: %s',id=>{
    const {shapes,land,waterLine}=geometryIndex(provincesData),shape=shapes.find(p=>p.id===id)!,anchors: [number, number][]=[];
    for(const ring of shape.rings)for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(len<.1)continue;
      const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,dx=(b[1]-a[1])/len*2,dy=(a[0]-b[0])/len*2;
      if(land(x+dx,y+dy)!==land(x-dx,y-dy))anchors.push(land(x+dx,y+dy)?[x-dx,y-dy]:[x+dx,y+dy]);
    }
    const nodes=getCoastalSeaNodes(id);expect(nodes.length).toBeGreaterThan(0);
    for(const node of nodes)expect(anchors.some(anchor=>Math.hypot(node.x-anchor[0],node.y-anchor[1])<200&&waterLine(anchor,[node.x,node.y]))).toBe(true);
  });
});
