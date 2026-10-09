import type { AirState } from '../../types/air';
import type { AirContext } from '../../engine/air';
import { airBases, airZones, getAirZoneControl } from '../../engine/air';
import { useMemo } from 'react';
import type { MapViewBox } from '../../data/map/types';
import airMapBounds from '../../data/airMapBounds.json';
const boundsById: Readonly<Record<string,readonly number[]>> = airMapBounds;

export function AirLayer({part,state,ctx,player,selected,selectedZone,scale,viewport,onWing,onZone,onBase}:{part:'zones'|'markers';state:AirState;ctx:AirContext;player:string;selected?:string|null;selectedZone?:string|null;scale:number;viewport:MapViewBox;onWing:(id:string)=>void;onZone:(id:string)=>void;onBase:(id:string)=>void}) {
  const provinces=useMemo(()=>new Map(ctx.provinces.map(p=>[p.id,p])),[ctx.provinces]);
  const countries=useMemo(()=>new Map(ctx.countries.map(c=>[c.tag,c])),[ctx.countries]);
  const controls=useMemo(()=>new Map((part==='zones'?airZones:[]).map(z=>[z.id,getAirZoneControl(state,z.id,player,{provinces:ctx.provinces,countries:ctx.countries,wars:ctx.wars,relations:ctx.relations})])),[part,state,ctx.provinces,ctx.countries,ctx.wars,ctx.relations,player]);
  const visibleZones=useMemo(()=>airZones.map(zone=>({zone,ids:zone.provinceIds.filter(id=>{const b=boundsById[id];return !b || b[2]>=viewport.x && b[0]<=viewport.x+viewport.w && b[3]>=viewport.y && b[1]<=viewport.y+viewport.h;})})).filter(z=>z.ids.length),[viewport]);
  const margin=400*scale;
  const visibleBases=airBases.filter(b=>{const p=provinces.get(b.provinceId);return p && p.center.x>=viewport.x-margin && p.center.x<=viewport.x+viewport.w+margin && p.center.y>=viewport.y-margin && p.center.y<=viewport.y+viewport.h+margin;});
  return <g className="air-layer" aria-label={part==='zones'?'Air zones':'Air markers'}>
    {part==='zones' && visibleZones.map(({zone,ids})=> {
      const control=controls.get(zone.id)!;
      return <g key={zone.id}>
        {ids.map(id=> {const p=provinces.get(id);return p && <path key={id} data-air-zone-id={zone.id} d={p.path} className={`air-zone ${control.superiority>0?'air-zone--friendly':control.superiority<0?'air-zone--hostile':''} ${selectedZone===zone.id?'air-zone--selected':''}`} onClick={e=>{e.stopPropagation();onZone(zone.id);}}><title>{zone.name} · Superioridade {Math.round(control.superiority*100)}%</title></path>;})}
        <text x={zone.center.x} y={zone.center.y} fontSize={11*scale} className="air-zone-label" pointerEvents="none">{Math.round(control.superiority*100)}%</text>
      </g>;
    })}
    {part==='markers' && visibleBases.map(base=> {
      const p=provinces.get(base.provinceId);if(!p)return null;
      const wings=state.wings.filter(w=>w.baseProvinceId===base.provinceId);
      return <g key={base.provinceId} transform={`translate(${p.center.x} ${p.center.y})`}>
        <g transform={`translate(${-18*scale} ${18*scale})`} role="button" tabIndex={0} aria-label={`AirBase ${p.name}`} onClick={e=>{e.stopPropagation();onBase(p.id);}} onKeyDown={e=>{if(e.key==='Enter')onBase(p.id);}}>
          <rect x={-8*scale} y={-8*scale} width={16*scale} height={16*scale} rx={3*scale} className="air-base"/><text textAnchor="middle" y={4*scale} fontSize={12*scale} className="air-marker-text">✈</text><title>{p.name} · Base nível {base.level} · {wings.length}/{base.capacity} grupos</title>
        </g>
        {wings.map((w,i)=><g key={w.id} role="button" tabIndex={0} aria-label={`AirWing ${w.name}`} transform={`translate(${(i*58+15)*scale} ${-18*scale})`} onClick={e=>{e.stopPropagation();onWing(w.id);}} onKeyDown={e=>{if(e.key==='Enter')onWing(w.id);}}>
          <rect width={54*scale} height={17*scale} rx={3*scale} fill={countries.get(w.countryTag)?.color} stroke={selected===w.id?'var(--gold, #c6a756)':'var(--border-color, #555)'} strokeWidth={scale}/><text x={3*scale} y={12*scale} fontSize={9*scale} className="air-marker-text">{w.type==='FIGHTER'?'F':w.type==='CAS'?'C':w.type==='BOMBER'?'B':'T'} {w.aircraftCount} {w.countryTag}</text><title>{w.name} · {w.mission ?? w.status}</title>
        </g>)}
      </g>;
    })}
  </g>;
}
