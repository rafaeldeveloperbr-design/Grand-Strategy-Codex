import { modeMarkerDetail, type MarkerDetailLevel } from './markerDetail';
import type { Country, Province, War } from '../../types';
import { useMemo } from 'react';
import type { MapViewBox } from '../../data/map/types';
import type { Fleet, NavalBattle } from '../../types/naval';
import { buildNavalPresence, fleetPosition, navalPorts, seaNodes, seaEdges, seaNodeById, seaEdgeByPair, edgeKey, portByProvince } from '../../engine/naval';
export function FleetMarker({fleet,selected,color,scale,onSelect,onIntercept}:{fleet:Fleet;selected:boolean;color:string;scale:number;onSelect:(id:string)=>void;onIntercept?:(id:string)=>void}) {
  const point=fleetPosition(fleet);if(!point) return null;
  return <g transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0} aria-label={`Fleet: ${fleet.name}`} data-fleet-id={fleet.id}
    onMouseDown={e=>{e.stopPropagation();}}
    onDoubleClick={e=>{e.stopPropagation();}}
    onContextMenu={e=>{e.preventDefault();e.stopPropagation();onIntercept?.(fleet.id);}}
    onClick={e=>{e.stopPropagation();onSelect(fleet.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ') {e.preventDefault();e.stopPropagation();onSelect(fleet.id);}}} style={{cursor:'pointer'}}>
    {/* Keep the visual unchanged; the screen-sized hit target overrides decorative-circle CSS. */}
    <circle data-fleet-hit-target="" r={16*scale} fill="transparent" style={{pointerEvents:'all'}}/>
    <circle r={Math.max(8,12*scale)} fill={selected?'#fff1ac':'#132638'} stroke={color} strokeWidth={Math.max(2,2*scale)} pointerEvents="none"/>
    <text textAnchor="middle" dominantBaseline="central" fill={selected?'#14253a':'#ffffff'} fontSize={Math.max(10,14*scale)} pointerEvents="none">⚓</text>
    <title>{fleet.name} · {fleet.status}{fleet.route.some((id,i)=>seaEdgeByPair.get(edgeKey(i?fleet.route[i-1]:fleet.locationSeaNodeId??'',id))?.logical)?' · Pacific logical crossing':''}</title>
  </g>;
}
export function NavalLayer({fleets,battles,wars,detailLevel='FULL',onCompactActivate,mode,selected,countries,provinces,viewport,scale,onSelect,onOrder,onPort,onReturnPort,onBattle,onIntercept}:{detailLevel?:MarkerDetailLevel;onCompactActivate?:(id:string)=>void;fleets:readonly Fleet[];battles:readonly NavalBattle[];wars:readonly War[];mode:boolean;selected:string|null;countries:Map<string,Country>;provinces:readonly Province[];viewport:MapViewBox;scale:number;onSelect:(id:string)=>void;onOrder:(id:string)=>void;onPort:(id:string)=>void;onReturnPort?:(id:string)=>void;onBattle:(id:string)=>void;onIntercept?:(id:string)=>void}) {
  const visibleNodes=useMemo(()=>seaNodes.filter(n=>n.x>=viewport.x-30&&n.x<=viewport.x+viewport.w+30&&n.y>=viewport.y-30&&n.y<=viewport.y+viewport.h+30),[viewport]);
  const network=useMemo(()=>mode?seaEdges.filter(e=>!e.logical).filter(e=>{const a=seaNodeById.get(e.a)!,b=seaNodeById.get(e.b)!;return Math.max(a.x,b.x)>=viewport.x&&Math.min(a.x,b.x)<=viewport.x+viewport.w&&Math.max(a.y,b.y)>=viewport.y&&Math.min(a.y,b.y)<=viewport.y+viewport.h;}).map(e=>{const a=seaNodeById.get(e.a)!,b=seaNodeById.get(e.b)!;return <line key={`${e.a}/${e.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#70cfee" strokeWidth={scale}/>;}):null,[mode,viewport,scale]);
  const f=fleets.find(f=>f.id===selected), provinceById=new Map(provinces.map(p=>[p.id,p]));
  const presence=buildNavalPresence(fleets,wars);
  const routeLines=[];
  if(f) {
    let from=fleetPosition(f);
    for(let i=0;i<f.route.length;i++) {
      const to=seaNodeById.get(f.route[i]);
      const prior=i?f.route[i-1]:f.locationSeaNodeId;
      if(from&&to&&!seaEdgeByPair.get(edgeKey(prior??'',to.id))?.logical) routeLines.push(<line key={`route-${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#ffe49a" strokeWidth={2*scale} strokeDasharray={`${5*scale} ${4*scale}`} pointerEvents="none"/>);
      from=to;
    }
    const port=portByProvince.get(f.destinationPortId??'');if(from&&port) routeLines.push(<line key="port-route" x1={from.x} y1={from.y} x2={port.x} y2={port.y} stroke="#ffe49a" strokeWidth={2*scale} pointerEvents="none"/>);
  }
  return <g data-testid="naval-layer">
    {mode&&<g pointerEvents="none" opacity=".24">{network}</g>}
    {(mode||selected)&&visibleNodes.map(n=><g key={n.id} data-sea-node-id={n.id} role="button" aria-label={`SeaNode ${n.id}`}
      onMouseDown={e=>{if(e.button===2)e.stopPropagation();}}
      onContextMenu={e=>{e.preventDefault();e.stopPropagation();if(f)onOrder(n.id);}}>
      {/* Inline pointerEvents overrides the map's decorative-circle CSS rule.
          scale is world units per screen pixel, keeping a 24px hit target at every zoom. */}
      <circle data-sea-node-hit-target="" cx={n.x} cy={n.y} r={12*scale} fill="transparent" style={{pointerEvents:'all'}}/>
      <circle cx={n.x} cy={n.y} r={Math.max(2,4*scale)} fill="#63bad0" pointerEvents="none"/>
      <title>{n.ocean} · {n.id} · {presence.get(n.id)?.contested ? 'Disputado' : presence.get(n.id)?.controller ?? 'Sem controle'} · {presence.get(n.id)?.fleetIds.length ?? 0} frotas · Direito: mover frota</title>
    </g>)}
    {mode&&navalPorts.filter(p=>provinceById.has(p.provinceId)).map(p=><g key={p.provinceId} transform={`translate(${p.x} ${p.y})`} role="button" tabIndex={0} aria-label={`Port: ${provinceById.get(p.provinceId)?.name}`} onClick={e=>{e.stopPropagation();onPort(p.provinceId);}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onReturnPort?.(p.provinceId);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();onPort(p.provinceId);}}}>
      <rect x={-7*scale} y={-7*scale} width={14*scale} height={14*scale} fill="#acd8e4" stroke="#132638" strokeWidth={scale}/><title>Porto nível {p.level} · {provinceById.get(p.provinceId)?.name}</title></g>)}
    {routeLines}
    {fleets.map(f=>{
      const detail=modeMarkerDetail(detailLevel,mode);
      if(detail==='HIDDEN'&&f.id!==selected)return null;
      if(detail!=='FULL') {
        const point=fleetPosition(f);if(!point)return null;
        const activate=()=>onCompactActivate?.(f.id);
        return <g key={f.id} data-fleet-id={f.id} data-fleet-compact="" transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0} aria-label={`Fleet: ${f.name}`} style={{cursor:'pointer'}}
          onMouseDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onContextMenu={e=>{e.preventDefault();e.stopPropagation();onIntercept?.(f.id);}} onClick={e=>{e.stopPropagation();activate();}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();activate();}}}>
          <circle data-fleet-hit-target="" r={16*scale} fill="transparent" style={{pointerEvents:'all'}} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={16*scale} fill={f.id===selected?'var(--gold)':'#fff'} pointerEvents="none">⚓</text><title>{f.name}</title>
        </g>;
      }
      return <FleetMarker key={f.id} fleet={f} selected={f.id===selected} color={countries.get(f.countryTag)?.color??'#aaa'} scale={scale} onSelect={onSelect} onIntercept={onIntercept}/>;})}
    {battles.filter(b=>b.status==='ACTIVE').map(b=>{const n=seaNodeById.get(b.seaNodeId);return n?<g key={b.id} transform={`translate(${n.x} ${n.y-20*scale})`} role="button" tabIndex={0} aria-label="Naval battle" onClick={e=>{e.stopPropagation();onBattle(b.id);}} onKeyDown={e=>{if(e.key==='Enter')onBattle(b.id);}}><circle data-naval-battle-hit-target="" r={14*scale} fill="transparent" style={{pointerEvents:'all'}}/><circle r={9*scale} fill="#b53737" pointerEvents="none"/><text textAnchor="middle" dominantBaseline="central" fontSize={12*scale} fill="white">⚔</text></g>:null;})}
  </g>;
}
