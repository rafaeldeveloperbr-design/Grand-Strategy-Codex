import { type AirCombatParticipantSnapshot, type AirCombatReport } from '../../types/air';
import { createAirCombatReport, finishAirCombatReport, limitAirCombatHistory } from './reports';
import type { AirState, AirWing, AircraftType, AirMission, AirProductionState } from '../../types/air';
import { AIRCRAFT_TYPES, AIR_PRODUCTION_CONFIG, AIR_QUEUE_LIMIT } from '../../data/aircraft';
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
  let reports: AirCombatReport[] | undefined;
  if (raw.reports !== undefined) {
    const fail = (): never => { throw new Error('Air save: invalid combat report'); };
    if (!Array.isArray(raw.reports)) return fail();
    const reportIds = new Set<string>();
    const activeZones = new Set<string>();
    reports = raw.reports.map((value: unknown) => {
      if (!record(value)) return fail();
      const {id, zoneId, day, participants} = value;
      if (typeof id !== 'string' || !id || reportIds.has(id) || typeof zoneId !== 'string' || !airZoneById.has(zoneId) || !Number.isSafeInteger(day) || !Array.isArray(participants) || !participants.length) return fail();
      reportIds.add(id);
      const legacy = value.status === undefined;
      if (!legacy) {
        if ((value.status !== 'ACTIVE' && value.status !== 'ENDED') || !Number.isSafeInteger(value.startedAt) || value.startedAt !== day || !Number.isSafeInteger(value.lastCombatDay) || (value.lastCombatDay as number) < (value.startedAt as number)) return fail();
        if (value.status === 'ACTIVE') {
          if (value.endedAt !== undefined || activeZones.has(zoneId)) return fail();
          activeZones.add(zoneId);
        } else if (!Number.isSafeInteger(value.endedAt) || (value.endedAt as number) < (value.lastCombatDay as number)) return fail();
      }
      const wingIds = new Set<string>();
      const snapshots: AirCombatParticipantSnapshot[] = participants.map((p: unknown) => {
  if (!record(p)) return fail();

  const {
    wingId,
    wingName,
    countryTag,
    type,
    mission,
    initialAircraft,
    finalAircraft,
    aircraftLost,
    aircraftReplacements,
  } = p;

  if (
    typeof wingId !== 'string' ||
    !wingId ||
    wingIds.has(wingId) ||
    typeof wingName !== 'string' ||
    typeof countryTag !== 'string' ||
    !ctx.countries.some(c => c.tag === countryTag) ||
    typeof type !== 'string' ||
    !Object.prototype.hasOwnProperty.call(AIRCRAFT_TYPES, type)
  ) {
    return fail();
  }

  if (
    mission !== undefined &&
    (
      typeof mission !== 'string' ||
      !AIRCRAFT_TYPES[type as AircraftType].missions.includes(
        mission as AirMission
      )
    )
  ) {
    return fail();
  }

  if (
    ![initialAircraft, finalAircraft, aircraftLost].every(
      n => Number.isSafeInteger(n) && (n as number) >= 0
    )
  ) {
    return fail();
  }

  if (
    aircraftReplacements !== undefined &&
    (
      !Number.isSafeInteger(aircraftReplacements) ||
      (aircraftReplacements as number) < 0
    )
  ) {
    return fail();
  }

  // V1 was a single tick. Accumulated reports may include replenishment between ticks.
  if (
    legacy &&
    (
      (initialAircraft as number) < (finalAircraft as number) ||
      aircraftLost !==
        (initialAircraft as number) - (finalAircraft as number)
    )
  ) {
    return fail();
  }

  wingIds.add(wingId);

  return {
    wingId,
    wingName,
    countryTag,
    type: type as AircraftType,
    mission: mission as AirMission | undefined,
    initialAircraft: initialAircraft as number,
    finalAircraft: finalAircraft as number,
    aircraftLost: aircraftLost as number,
    aircraftReplacements:
      aircraftReplacements === undefined
        ? 0
        : aircraftReplacements as number,
  };
});
      // Totals are derived from factual snapshots, never trusted from serialized data.
      const report = createAirCombatReport(id, zoneId, day as number, snapshots);
      let hostileCountryPairs: AirCombatReport['hostileCountryPairs'];
      if (value.hostileCountryPairs !== undefined) {
        if (!Array.isArray(value.hostileCountryPairs)) return fail();
        const tags = new Set(snapshots.map(p => p.countryTag));
        const pairIds = new Set<string>();
        hostileCountryPairs = value.hostileCountryPairs.map((pair: unknown) => {
          if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(tag => typeof tag === 'string' && tags.has(tag)) || pair[0] === pair[1]) return fail();
          const ordered = [...pair].sort() as [string, string];
          const key = JSON.stringify(ordered);
          if (pairIds.has(key)) return fail();
          pairIds.add(key);
          return ordered;
        }).sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
      }
      if (legacy) return finishAirCombatReport(report, day as number);
      return {...report, status: value.status as AirCombatReport['status'], lastCombatDay: value.lastCombatDay as number,
        ...(value.status === 'ENDED' ? {endedAt: value.endedAt as number} : {}),
        ...(hostileCountryPairs ? {hostileCountryPairs} : {})};
    });
    reports = limitAirCombatHistory(reports);
  }
  // Engagements are daily feedback, not simulation state; rebuild next tick.
  let production: AirProductionState | undefined;
  if (raw.production !== undefined) {
    const p = raw.production;
    const fail = (): never => { throw new Error('Air save: invalid production queue/counter'); };
    if (!record(p) || !record(p.queues) || !Number.isSafeInteger(p.nextId) || (p.nextId as number) < 1) return fail();
    production = { queues: {}, nextId: p.nextId as number };
    let largestId = 0;
    for (const wing of wings) { const match = /^wing-air-build-(\d+)$/.exec(wing.id); if (match) largestId = Math.max(largestId, Number(match[1])); }
    for (const [base, values] of Object.entries(p.queues)) {
      if (!airBaseByProvinceId.has(base) || !Array.isArray(values) || !values.length || values.length > AIR_QUEUE_LIMIT) return fail();
      production.queues[base] = values.map(value => {
        if (!record(value)) return fail();
        const { id, countryTag, provinceId, type, progress, requiredProgress } = value;
        const match = typeof id === 'string' ? /^air-build-([1-9]\d*)$/.exec(id) : null;
        if (!match || ids.has(id as string) || ids.has(`wing-${id}`) || provinceId !== base || typeof countryTag !== 'string' || !ctx.countries.some(c => c.tag === countryTag && !c.isAnnexed) || ctx.provinces.find(p => p.id === base)?.owner !== countryTag || typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(AIR_PRODUCTION_CONFIG, type)) return fail();
        if (!Number.isSafeInteger(progress) || (progress as number) < 0 || requiredProgress !== AIR_PRODUCTION_CONFIG[type as AircraftType].days || (progress as number) > (requiredProgress as number)) return fail();
        const serial = Number(match[1]); if (!Number.isSafeInteger(serial)) return fail();
        ids.add(id as string); largestId = Math.max(largestId, serial);
        return { id: id as string, countryTag, provinceId: base, type: type as AircraftType, progress: progress as number, requiredProgress: requiredProgress as number };
      });
    }
    if (production.nextId <= largestId) return fail();
  }
  return {wings,engagements:[],...(reports ? {reports} : {}),...(production ? {production} : {})};
}
