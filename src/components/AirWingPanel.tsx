import { useState } from 'react';
import type { AirMission, AirState, AirWing } from '../types/air';
import { AIRCRAFT_TYPES } from '../data/aircraft';
import { AIR_MISSION_LABELS } from '../engine/air/commands';
import { airBases, airZones, airZoneById, airMissionEfficiency, isAirZoneInRange, canUseAirBase, type AirContext } from '../engine/air';
export function AirWingPanel({wing,state,ctx,owner,onMission,onRebase,onCancel,onLocate,onClose,onTargetMission,onTargetRebase,onSelectWing}:{wing:AirWing;state:AirState;ctx:AirContext;owner:boolean;onMission:(mission:AirMission,zone:string)=>void;onRebase:(id:string)=>void;onCancel:()=>void;onLocate:()=>void;onClose:()=>void;onTargetMission?:(mission:AirMission)=>void;onTargetRebase?:()=>void;onSelectWing?:(id:string)=>void}) {
  const missions=AIRCRAFT_TYPES[wing.type].missions;
  const [mission,setMission]=useState<AirMission>(wing.mission ?? missions[0] ?? 'AIR_SUPERIORITY');
  const [zone,setZone]=useState(wing.assignedAirZoneId ?? airZones.find(z=>isAirZoneInRange(wing,z.id,ctx.provinces))?.id ?? '');
  const [base,setBase]=useState('');
  return <aside className="air-panel" aria-label="AirWing panel">
    <button onClick={onClose} aria-label="Close AirWing">×</button><h3>✈ {wing.name}</h3>
    <p>{wing.countryTag} · {wing.type} · {wing.aircraftCount}/{wing.maxAircraft} aeronaves</p>
    <p>Força {wing.strength.toFixed(0)}% · Organização {wing.organization.toFixed(0)}%</p>
    <p>Base: {ctx.provinces.find(p=>p.id===wing.baseProvinceId)?.name} · {wing.status}</p>
    {wing.rebase && <p>Rebase: {ctx.provinces.find(p=>p.id===wing.rebase?.targetProvinceId)?.name} · {wing.rebase.daysRemaining}/{wing.rebase.totalDays} dias</p>}
    <p>Zona: {airZoneById.get(wing.assignedAirZoneId ?? '')?.name ?? '—'} · Missão: {wing.mission ?? 'NONE'}</p>
    <p>Eficiência: {(airMissionEfficiency(wing,ctx)*100).toFixed(0)}% · Alcance: {AIRCRAFT_TYPES[wing.type].range} unidades</p>
    {onSelectWing && state.wings.filter(w=>w.baseProvinceId===wing.baseProvinceId).length>1 && <label>Wings nesta base<select aria-label="Wings at base" value={wing.id} onChange={e=>onSelectWing(e.target.value)}>{state.wings.filter(w=>w.baseProvinceId===wing.baseProvinceId).map(w=><option key={w.id} value={w.id}>{w.name} · {w.aircraftCount}</option>)}</select></label>}
    {owner && <>
      {onTargetMission && <div className="air-panel__actions">{missions.map(m=><button key={m} disabled={wing.status==='REBASING'} onClick={()=>onTargetMission(m)}>{AIR_MISSION_LABELS[m]}</button>)}<button disabled={wing.status==='REBASING'} onClick={onTargetRebase}>Rebase no mapa</button></div>}
      <details open={!onTargetMission}><summary>Seleção por lista</summary>
      <label>Missão<select aria-label="Assign Mission" value={mission} disabled={!missions.length || wing.status==='REBASING'} onChange={e=>setMission(e.target.value as AirMission)}>{missions.map(m=><option key={m}>{m}</option>)}</select></label>
      <label>Zona<select aria-label="Select AirZone" value={zone} onChange={e=>setZone(e.target.value)}>{airZones.map(z=><option key={z.id} value={z.id} disabled={!isAirZoneInRange(wing,z.id,ctx.provinces)}>{z.name}{!isAirZoneInRange(wing,z.id,ctx.provinces)?' · fora de alcance':''}</option>)}</select></label>
      <p role="status">{isAirZoneInRange(wing,zone,ctx.provinces)?'Dentro de alcance':'Fora de alcance'}</p>
      <button disabled={!missions.length || wing.status==='REBASING' || !isAirZoneInRange(wing,zone,ctx.provinces)} onClick={()=>onMission(mission,zone)}>Atribuir missão</button>
      <label>Base de destino<select aria-label="Rebase target" value={base} onChange={e=>setBase(e.target.value)}><option value="">Selecionar base…</option>{airBases.filter(b=>b.provinceId!==wing.baseProvinceId && canUseAirBase(wing.countryTag,b.provinceId,ctx)).map(b=>{const n=state.wings.filter(w=>w.id!==wing.id && (w.baseProvinceId===b.provinceId || w.rebase?.targetProvinceId===b.provinceId)).length;return <option key={b.provinceId} value={b.provinceId} disabled={n>=b.capacity}>{ctx.provinces.find(p=>p.id===b.provinceId)?.name} · {n}/{b.capacity}</option>;})}</select></label>
      <button disabled={!base || wing.status==='REBASING'} onClick={()=>onRebase(base)}>Rebase</button>
      </details>
      <button disabled={wing.status==='REBASING'} onClick={onCancel}>Cancelar missão / recuperar</button>
    </>}
    <button onClick={onLocate}>Localizar (F)</button>
  </aside>;
}
