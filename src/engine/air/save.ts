import type { AirState, AirWing, AircraftType, AirMission } from '../../types/air';
import { AIRCRAFT_TYPES } from '../../data/aircraft';
import { airBaseByProvinceId, airZoneById } from './world';
import { canUseAirBase, type AirContext } from './index';
const record = (v: unknown): v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
/** Missing air state is a legacy V3 save, with no newly seeded forces. */
export function readAirSave(raw: unknown, ctx: AirContext): AirState {
  if (raw===undefined) return {wings:[],engagements:[]};
  if (!record(raw) || !Array.isArray(raw.wings)) throw new Error('Air save: invalid state');
  const ids=new Set<string>();
  const wings: AirWing[]=raw.wings.map((value:unknown)=> {
    if (!record(value)) throw new Error('Air save: invalid wing');
    const fail=()=>{throw new Error(`Air save: invalid wing ${String(value.id)}`);};
    const {id,countryTag,name,type,aircraftCount,maxAircraft,strength,organization,baseProvinceId,assignedAirZoneId,mission,status,rebase}=value;
    if(typeof id!=='string' || !id || ids.has(id) || typeof countryTag!=='string' || !ctx.countries.some(c=>c.tag===countryTag) || typeof name!=='string' || typeof type!=='string' || !Object.prototype.hasOwnProperty.call(AIRCRAFT_TYPES,type) || typeof baseProvinceId!=='string' || !canUseAirBase(countryTag,baseProvinceId,ctx)) return fail();
    ids.add(id);
    if(typeof aircraftCount!=='number' || !Number.isInteger(aircraftCount) || typeof maxAircraft!=='number' || !Number.isInteger(maxAircraft) || maxAircraft<1 || aircraftCount<1 || aircraftCount>maxAircraft || typeof strength!=='number' || !Number.isFinite(strength) || strength<0 || strength>100 || typeof organization!=='number' || !Number.isFinite(organization) || organization<0 || organization>100) return fail();
    if(status!=='READY' && status!=='MISSION' && status!=='REBASING') return fail();
    if(assignedAirZoneId!==undefined && (typeof assignedAirZoneId!=='string' || !airZoneById.has(assignedAirZoneId))) return fail();
    if(mission!==undefined && (typeof mission!=='string' || !AIRCRAFT_TYPES[type as AircraftType].missions.includes(mission as AirMission))) return fail();
    if(status==='MISSION' ? !mission || !assignedAirZoneId || rebase!==undefined : mission!==undefined || assignedAirZoneId!==undefined) return fail();
    let parsedRebase: AirWing['rebase'];
    if(status==='REBASING') {
      if(!record(rebase) || typeof rebase.targetProvinceId!=='string' || rebase.targetProvinceId===baseProvinceId || !canUseAirBase(countryTag,rebase.targetProvinceId,ctx) || typeof rebase.totalDays!=='number' || !Number.isInteger(rebase.totalDays) || rebase.totalDays<1 || typeof rebase.daysRemaining!=='number' || !Number.isInteger(rebase.daysRemaining) || rebase.daysRemaining<1 || rebase.daysRemaining>rebase.totalDays) return fail();
      parsedRebase={targetProvinceId:rebase.targetProvinceId,totalDays:rebase.totalDays,daysRemaining:rebase.daysRemaining};
    } else if(rebase!==undefined) return fail();
    return {id,countryTag,name,type:type as AircraftType,aircraftCount,maxAircraft,strength,organization,baseProvinceId,assignedAirZoneId:assignedAirZoneId as string | undefined,mission:mission as AirMission | undefined,status,rebase:parsedRebase};
  });
  const occupancy=new Map<string,number>();
  for(const w of wings) for(const id of [w.baseProvinceId,...(w.rebase?[w.rebase.targetProvinceId]:[])]) occupancy.set(id,(occupancy.get(id)??0)+1);
  for(const [id,count] of occupancy) if(count>(airBaseByProvinceId.get(id)?.capacity ?? 0)) throw new Error(`Air save: overloaded base ${id}`);
  // Engagements are daily feedback, not simulation state; rebuild next tick.
  return {wings,engagements:[]};
}
