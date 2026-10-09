import type { ActiveBattle } from '../types';
import type { AirState } from '../types/air';
import { airZoneById, airMissionEfficiency, getAirZoneControl, getAirSupportForBattle, getAirSuperiorityModifier, type AirContext } from '../engine/air';
import { buildNavalHostility } from '../engine/naval';
export function AirZonePanel({id,state,ctx,player,battles,onClose,onLocate}:{id:string;state:AirState;ctx:AirContext;player:string;battles:ActiveBattle[];onClose:()=>void;onLocate:()=>void}) {
  const zone=airZoneById.get(id);if(!zone)return null;
  const control=getAirZoneControl(state,id,player,ctx),hostile=buildNavalHostility(ctx.wars).get(player);
  const wings=state.wings.filter(w=>w.assignedAirZoneId===id);
  const friendly=wings.filter(w=>w.countryTag===player || ctx.relations.some(r=>r.alliance && (r.countryA===player && r.countryB===w.countryTag || r.countryB===player && r.countryA===w.countryTag)));
  return <aside className="air-panel" aria-label="AirZone panel"><button onClick={onClose} aria-label="Close AirZone">×</button><h3>{zone.name}</h3>
    <p>Presença: {[...new Set(wings.map(w=>w.countryTag))].join(', ') || '—'}</p>
    <p>Aeronaves amigas: {friendly.reduce((s,w)=>s+w.aircraftCount,0)} · Inimigas: {wings.filter(w=>hostile?.has(w.countryTag)).reduce((s,w)=>s+w.aircraftCount,0)}</p>
    <p>Superioridade: {Math.round(control.superiority*100)}% · Poder {control.friendly.toFixed(1)} / {control.enemy.toFixed(1)}</p>
    <p>Batalhas terrestres: {battles.filter(b=>zone.provinceIds.includes(b.provinceId)).length}</p>
    {battles.filter(b=>zone.provinceIds.includes(b.provinceId)).map(b=><p key={b.id}>Apoio em {ctx.provinces.find(p=>p.id===b.provinceId)?.name}: CAS +{(getAirSupportForBattle(state,b,player,ctx)*100).toFixed(1)}% · Superioridade {((getAirSuperiorityModifier(state,b.provinceId,player,ctx)-1)*100).toFixed(1)}%</p>)}
    <p>Combates aéreos: {state.engagements.filter(e=>e.zoneId===id).length} · Perdas: {state.engagements.filter(e=>e.zoneId===id).reduce((s,e)=>s+Object.values(e.losses).reduce((a,b)=>a+b,0),0)}</p>
    {wings.map(w=><p key={w.id}>{w.countryTag} {w.type} · {w.mission} · {(airMissionEfficiency(w,ctx)*100).toFixed(0)}%</p>)}
    <button onClick={onLocate}>Localizar zona</button></aside>;
}
