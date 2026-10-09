import type { AirState } from '../../types/air';
import type { AirContext } from '../../engine/air';
import { airBases, airZones, getAirZoneControl } from '../../engine/air';
import { useMemo } from 'react';
import type { MapViewBox } from '../../data/map/types';
import airMapBounds from '../../data/airMapBounds.json';
const boundsById: Readonly<Record<string,readonly number[]>> = airMapBounds;

export function AirLayer({part,mode=true,state,ctx,player,selected,selectedZone,scale,viewport,onWing,onZone,onBase}:{part:'zones'|'markers';mode?:boolean;state:AirState;ctx:AirContext;player:string;selected?:string|null;selectedZone?:string|null;scale:number;viewport:MapViewBox;onWing:(id:string)=>void;onZone:(id:string,provinceId:string,inspect:boolean)=>void;onBase:(id:string)=>void}) {
  const provinces=useMemo(()=>new Map(ctx.provinces.map(p=>[p.id,p])),[ctx.provinces]);
  const countries=useMemo(()=>new Map(ctx.countries.map(c=>[c.tag,c])),[ctx.countries]);
  const controls=useMemo(()=>new Map((part==='zones'?airZones:[]).map(z=>[z.id,getAirZoneControl(state,z.id,player,{provinces:ctx.provinces,countries:ctx.countries,wars:ctx.wars,relations:ctx.relations})])),[part,state,ctx.provinces,ctx.countries,ctx.wars,ctx.relations,player]);
  const wingsByBase=useMemo(()=>{const index=new Map<string,AirState['wings']>();for(const wing of state.wings){const list=index.get(wing.baseProvinceId)??[];list.push(wing);index.set(wing.baseProvinceId,list);}return index;},[state.wings]);
  const visibleZones=useMemo(()=>part==='zones'?airZones.map(zone=>({zone,ids:zone.provinceIds.filter(id=>{const b=boundsById[id];return !b || b[2]>=viewport.x && b[0]<=viewport.x+viewport.w && b[3]>=viewport.y && b[1]<=viewport.y+viewport.h;})})).filter(z=>z.ids.length):[],[part,viewport]);
  const margin=400*scale;
  const visibleBases=airBases.filter(b=>{const p=provinces.get(b.provinceId);return p && p.center.x>=viewport.x-margin && p.center.x<=viewport.x+viewport.w+margin && p.center.y>=viewport.y-margin && p.center.y<=viewport.y+viewport.h+margin;});
  return <g className={`air-layer ${mode?'air-layer--active':'air-layer--normal'}`} aria-label={part==='zones'?'Air zones':'Air markers'}>
    {part==='zones' && visibleZones.map(({zone,ids})=> {
      const control=controls.get(zone.id)!;
      return <g key={zone.id}>
        {ids.map(id=> {const p=provinces.get(id);return p && <path key={id} data-province-id={id} data-air-zone-id={zone.id} d={p.path} className={`air-zone ${control.superiority>0?'air-zone--friendly':control.superiority<0?'air-zone--hostile':''} ${selectedZone===zone.id?'air-zone--selected':''}`} onClick={e=>{e.stopPropagation();onZone(zone.id,id,e.altKey);}}><title>{zone.name} · Superioridade {Math.round(control.superiority*100)}%</title></path>;})}
        <text x={zone.center.x} y={zone.center.y} fontSize={11*scale} className="air-zone-label" pointerEvents="none">{Math.round(control.superiority*100)}%</text>
      </g>;
    })}
    {part==='markers' && visibleBases.map(base=> {
      const p=provinces.get(base.provinceId);if(!p)return null;
      const wings=wingsByBase.get(base.provinceId)??[];
      if(!mode&&!wings.length)return null;
      return <g key={base.provinceId} data-province-id={p.id} transform={`translate(${p.center.x} ${p.center.y})`}>
        {mode && <g transform={`translate(${-18*scale} ${18*scale})`} role="button" tabIndex={0} aria-label={`AirBase ${p.name}`} onClick={e=>{e.stopPropagation();onBase(p.id);}} onKeyDown={e=>{if(e.key==='Enter')onBase(p.id);}}>
          <rect x={-8*scale} y={-8*scale} width={16*scale} height={16*scale} rx={3*scale} className="air-base"/><text textAnchor="middle" y={4*scale} fontSize={12*scale} className="air-marker-text">✈</text><title>{`${p.name} · Base nível ${base.level} · ${wings.length}/${base.capacity} grupos`}</title>
        </g>}
        {wings.map((w,i)=><g key={w.id} data-air-wing-id={w.id} role="button" tabIndex={0} aria-label={`AirWing ${w.name}`} transform={`translate(${(i*58+15)*scale} ${-18*scale})`} onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onWing(w.id);}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onWing(w.id);}}}>
          <rect x={-2*scale} y={-4*scale} width={58*scale} height={25*scale} fill="transparent" pointerEvents="all"/>
          <rect className="air-wing-body" width={54*scale} height={17*scale} rx={3*scale} fill={countries.get(w.countryTag)?.color} stroke={selected===w.id?'var(--gold, #c6a756)':'var(--border-color, #555)'} strokeWidth={scale} pointerEvents="none"/><text x={3*scale} y={12*scale} fontSize={9*scale} className="air-marker-text">{w.type==='FIGHTER'?'F':w.type==='CAS'?'C':w.type==='BOMBER'?'B':'T'} {w.aircraftCount} {w.countryTag}</text><title>{`${w.name} · ${w.mission ?? w.status}`}</title>
        </g>)}
      </g>;
    })}
  </g>;
}
