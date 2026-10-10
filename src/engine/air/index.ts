import type { ActiveBattle, Army, Country, Province, War, DiplomaticRelation } from '../../types';
import type { AirState, AirWing, AirMission, AirCounters, AirCombatReport } from '../../types/air';
import { advanceAirCombatReports } from './reports';
import { AIRCRAFT_TYPES, AIR_BALANCE as B } from '../../data/aircraft';
import { buildNavalHostility } from '../naval';
import { airBases, airBaseByProvinceId, airZoneById, airZoneByProvinceId, airZones } from './world';
export * from './world';
export * from './production';
export * from './commands';
export interface AirContext { provinces: readonly Province[]; countries: readonly Country[]; wars: readonly War[]; relations: readonly DiplomaticRelation[]; armies?: readonly Army[] }
export function canUseAirBase(tag: string, provinceId: string, ctx: AirContext): boolean {
  const p=ctx.provinces.find(p=>p.id===provinceId);
  if (!p || !airBaseByProvinceId.has(provinceId) || buildNavalHostility(ctx.wars).get(tag)?.has(p.owner)) return false;
  if (p.owner===tag) return true;
  const r=ctx.relations.find(r=>r.countryA===tag && r.countryB===p.owner || r.countryB===tag && r.countryA===p.owner);
  // militaryAccess stores the grantor: host grants passage to the other party.
  return !!r?.alliance || !!r?.militaryAccess?.includes(p.owner);
}
export function airDistance(a: {x:number;y:number}, b: {x:number;y:number}): number { return Math.hypot(a.x-b.x,a.y-b.y); }
export function isAirZoneInRange(w: AirWing, zoneId: string, ps: readonly Province[]): boolean {
  const base=ps.find(p=>p.id===w.baseProvinceId), zone=airZoneById.get(zoneId);
  return !!base && !!zone && airDistance(base.center,zone.center)<=AIRCRAFT_TYPES[w.type].range;
}
export function airMissionEfficiency(w: AirWing, ctx: AirContext): number {
  if (w.status!=='MISSION' || !w.mission || !w.assignedAirZoneId || !canUseAirBase(w.countryTag,w.baseProvinceId,ctx) || !isAirZoneInRange(w,w.assignedAirZoneId,ctx.provinces) || w.organization<B.minOrganization || w.strength<B.minStrength || w.aircraftCount<=0) return 0;
  return AIRCRAFT_TYPES[w.type].missionEfficiency*w.strength/100*w.organization/100;
}
export function assignAirMission(w: AirWing, mission: AirMission, zoneId: string, ctx: AirContext): AirWing | null {
  if (w.status==='REBASING' || !AIRCRAFT_TYPES[w.type].missions.includes(mission) || !canUseAirBase(w.countryTag,w.baseProvinceId,ctx) || !isAirZoneInRange(w,zoneId,ctx.provinces)) return null;
  return {...w,mission,assignedAirZoneId:zoneId,status:'MISSION',recovery:undefined};
}
export function cancelAirMission(w: AirWing): AirWing { return w.status==='REBASING' ? w : {...w,mission:undefined,assignedAirZoneId:undefined,status:'READY',recovery:undefined}; }
export function rebaseAirWing(w: AirWing, targetProvinceId: string, state: AirState, ctx: AirContext): AirWing | null {
  const target=ctx.provinces.find(p=>p.id===targetProvinceId), base=ctx.provinces.find(p=>p.id===w.baseProvinceId), capacity=airBaseByProvinceId.get(targetProvinceId)?.capacity ?? 0;
  const occupancy=state.wings.filter(other=>other.id!==w.id && (other.baseProvinceId===targetProvinceId || other.rebase?.targetProvinceId===targetProvinceId)).length;
  if (!target || !base || w.status==='REBASING' || targetProvinceId===w.baseProvinceId || !canUseAirBase(w.countryTag,targetProvinceId,ctx) || occupancy>=capacity) return null;
  const days=Math.max(1,Math.ceil(airDistance(base.center,target.center)/AIRCRAFT_TYPES[w.type].speed));
  return {...w,status:'REBASING',recovery:undefined,mission:undefined,assignedAirZoneId:undefined,rebase:{targetProvinceId,daysRemaining:days,totalDays:days}};
}
export function getAirZoneControl(state: AirState, zoneId: string, countryTag: string, ctx: AirContext) {
  const enemies=buildNavalHostility(ctx.wars).get(countryTag) ?? new Set<string>();
  const power=(w:AirWing)=>w.type==='FIGHTER' ? w.aircraftCount*airMissionEfficiency(w,ctx)*AIRCRAFT_TYPES[w.type].airAttack : 0;
  const wings=state.wings.filter(w=>w.assignedAirZoneId===zoneId);
  const friendly=wings.filter(w=>w.countryTag===countryTag || ctx.relations.some(r=>r.alliance && (r.countryA===countryTag && r.countryB===w.countryTag || r.countryB===countryTag && r.countryA===w.countryTag) && !enemies.has(w.countryTag))).reduce((s,w)=>s+power(w),0);
  const enemy=wings.filter(w=>enemies.has(w.countryTag)).reduce((s,w)=>s+power(w),0);
  return {friendly,enemy,superiority:friendly+enemy ? (friendly-enemy)/(friendly+enemy) : 0};
}
export function getAirSuperiorityForProvince(state: AirState, provinceId: string, tag: string, ctx: AirContext) { return getAirZoneControl(state,airZoneByProvinceId.get(provinceId)?.id ?? '',tag,ctx); }
export function getAirSuperiorityModifier(state: AirState, provinceId: string, tag: string, ctx: AirContext): number { return 1+B.superiorityModifier*getAirSuperiorityForProvince(state,provinceId,tag,ctx).superiority; }
export function getAirSupportForBattle(state: AirState, battle: ActiveBattle, tag: string, ctx: AirContext): number {
  const participants=(ctx.armies ?? []).filter(a=>(battle.participantArmyIds ?? []).includes(a.id));
  const representative=participants.find(a=>a.owner===tag);
  const side=representative ? battle.participantSides[representative.id] : battle.attackerCountryId===tag ? 'attacker' : battle.defenderCountryId===tag ? 'defender' : undefined;
  if (!side) return 0;
  const supporters=new Set([tag,...participants.filter(a=>battle.participantSides[a.id]===side).map(a=>a.owner)]);
  const zone=airZoneByProvinceId.get(battle.provinceId)?.id;
  const control=getAirZoneControl(state,zone ?? '',tag,ctx);
  const efficiency=1-Math.max(0,-control.superiority)*.8;
  const power=state.wings.filter(w=>supporters.has(w.countryTag) && w.assignedAirZoneId===zone && w.mission==='CLOSE_AIR_SUPPORT').reduce((s,w)=> { const e=airMissionEfficiency(w,ctx)*efficiency; return s+(e>=B.minimumEfficiency ? w.aircraftCount*e : 0); },0);
  return Math.min(B.casMaxBonus,power/B.casAircraftForMax*B.casMaxBonus);
}
/** Universal withdrawal, independent of player ownership or AI activation. */
function enterAirRecovery(w: AirWing): AirWing {
  if (w.status !== 'MISSION' || !w.mission || !w.assignedAirZoneId ||
      !(w.strength < 40 || w.organization < 40 || w.aircraftCount < w.maxAircraft / 2)) return w;
  return {...w, status:'RECOVERING', recovery:{mission:w.mission, airZoneId:w.assignedAirZoneId},
    mission:undefined, assignedAirZoneId:undefined};
}
export function airAITick(state: AirState, full: ReadonlySet<string>, player: string, ctx: AirContext, battles: readonly ActiveBattle[]) {
  const bots=new Set<string>();
  const hostility=buildNavalHostility(ctx.wars);
  const wings=state.wings.map(original=> {
    const w = enterAirRecovery(original);
    if (w.countryTag===player || !full.has(w.countryTag) || w.status==='REBASING' || w.status==='RECOVERING') return w;
    bots.add(w.countryTag);
    const home=airZoneByProvinceId.get(w.baseProvinceId);
    const enemies=hostility.get(w.countryTag) ?? new Set<string>();
    const battleZones=battles.filter(b=>b.attackerCountryId===w.countryTag || b.defenderCountryId===w.countryTag).map(b=>airZoneByProvinceId.get(b.provinceId)?.id);
    const candidates=airZones.filter(z=>isAirZoneInRange(w,z.id,ctx.provinces));
    const threat=candidates.find(z=>state.wings.some(e=>enemies.has(e.countryTag) && e.assignedAirZoneId===z.id && (e.type==='BOMBER' || e.type==='CAS')));
    const target=candidates.find(z=>battleZones.includes(z.id)) ?? (w.type==='FIGHTER' ? threat : undefined) ?? (w.type==='BOMBER' ? candidates.find(z=>z.provinceIds.some(id=>ctx.provinces.some(p=>p.id===id && enemies.has(p.owner)))) : home);
    if (!target || w.type==='TRANSPORT_PLANE' || w.type==='CAS' && !battleZones.includes(target.id) || w.type==='BOMBER' && !enemies.size) return cancelAirMission(w);
    const control=getAirZoneControl(state,target.id,w.countryTag,ctx);
    if (control.enemy>Math.max(1,control.friendly)*1.5) return w.type==='FIGHTER' && home ? assignAirMission(w,'AIR_SUPERIORITY',home.id,ctx) ?? cancelAirMission(w) : cancelAirMission(w);
    const mission: AirMission=w.type==='FIGHTER' ? threat?.id===target.id ? 'INTERCEPTION' : 'AIR_SUPERIORITY' : w.type==='CAS' ? 'CLOSE_AIR_SUPPORT' : 'BOMBING';
    return assignAirMission(w,mission,target.id,ctx) ?? cancelAirMission(w);
  });
  return {state:{...state,wings},bots:bots.size};
}
/** Country fighter budgets use the same pre-combat snapshot in both directions. */
export function airCombatTick(state: AirState, ctx: AirContext, day: number, onEnded?: (report: AirCombatReport) => void): AirState {
  const hostility=buildNavalHostility(ctx.wars), losses=new Map<string,number>(), engaged=new Set<string>();
  const zones=new Map<string,AirWing[]>();
  for (const w of [...state.wings].sort((a,b)=>a.id.localeCompare(b.id))) if (w.assignedAirZoneId && airMissionEfficiency(w,ctx)>0) {const bucket=zones.get(w.assignedAirZoneId)??[];bucket.push(w);zones.set(w.assignedAirZoneId,bucket);}
  const fighterLossRemainders = {...state.fighterLossRemainders};
  const engagements: AirState['engagements']=[];
  for (const [zoneId,ws] of [...zones].sort(([a], [b]) => a.localeCompare(b))) {
    const ids=new Set<string>();
    const groups = new Map<string, AirWing[]>();
    for (const w of ws.filter(w => w.type === 'FIGHTER')) {
      const group = groups.get(w.countryTag) ?? [];
      group.push(w);
      groups.set(w.countryTag, group);
    }
    const effective = new Map([...groups].map(([tag, wings]) => [tag,
      wings.reduce((sum, w) => sum + w.aircraftCount * airMissionEfficiency(w, ctx), 0)]));
    const countryLosses = new Map<string, number>();
    const tags = [...groups.keys()].sort();
    const power = new Map(tags.map(tag => [tag, effective.get(tag)! * AIRCRAFT_TYPES.FIGHTER.airAttack]));
    for (const attacker of tags) {
      const targets = tags.filter(tag => hostility.get(attacker)?.has(tag));
      const totalHostilePower = targets.reduce((sum, tag) => sum + power.get(tag)!, 0);
      for (const defender of targets) {
        for (const w of [...groups.get(attacker)!, ...groups.get(defender)!]) {
          ids.add(w.id); engaged.add(w.id);
        }
        // Each country spends its offensive budget once across operational enemies.
        const defenderPower = power.get(defender)!;
        const targetShare = defenderPower / totalHostilePower;
        const allocatedEffectiveFighters = effective.get(attacker)! * targetShare;
        const allocatedAttackerPower = power.get(attacker)! * targetShare;
        const ratio = Math.min(2, Math.max(.5, Math.sqrt(
          allocatedAttackerPower / Math.max(1, defenderPower))));
        const key = JSON.stringify([zoneId, attacker, defender]);
        const budget = allocatedEffectiveFighters * B.combatLossRate * ratio + (fighterLossRemainders[key] ?? 0);
        const integerLosses = Math.floor(budget);
        fighterLossRemainders[key] = budget - integerLosses;
        countryLosses.set(defender, (countryLosses.get(defender) ?? 0) + integerLosses);
      }
    }
    // Largest remainder apportionment: exact totals, proportional counts, ID tie-breaks.
    for (const [tag, budget] of countryLosses) {
      const wings = groups.get(tag)!;
      const available = wings.reduce((sum, w) => sum + w.aircraftCount, 0);
      const total = Math.min(available, budget);
      const shares = wings.map(w => {
        const quota = total * w.aircraftCount / available;
        return {w, lost: Math.floor(quota), fraction: quota - Math.floor(quota)};
      }).sort((a, b) => b.fraction - a.fraction || a.w.id.localeCompare(b.w.id));
      const extra = total - shares.reduce((sum, share) => sum + share.lost, 0);
      shares.forEach((share, i) => losses.set(share.w.id, share.lost + (i < extra ? 1 : 0)));
    }
    const nonFighterLosses = new Map<string, number>();
    for (const fighter of ws.filter(w=>w.type==='FIGHTER')) {
      const targets=ws.filter(w=>hostility.get(fighter.countryTag)?.has(w.countryTag) && w.type!=='FIGHTER');
      if (!targets.length) continue;
      // Retain the legacy escort/retaliation budget, including its original target denominator.
      const legacyTargets=ws.filter(w=>hostility.get(fighter.countryTag)?.has(w.countryTag) && (fighter.mission!=='INTERCEPTION' || w.type==='BOMBER' || w.type==='CAS'));
      const total=legacyTargets.reduce((s,w)=>s+w.aircraftCount,0);
      for (const target of targets) {
        ids.add(fighter.id);ids.add(target.id);engaged.add(fighter.id);engaged.add(target.id);
        const damage=fighter.aircraftCount*airMissionEfficiency(fighter,ctx)*AIRCRAFT_TYPES.FIGHTER.airAttack*B.combatLossRate/AIRCRAFT_TYPES[target.type].airDefense*target.aircraftCount/total;
        nonFighterLosses.set(target.id,(nonFighterLosses.get(target.id)??0)+damage);
        // Non-fighters defend only; fighters resolve their own simultaneous offensive budget.
        nonFighterLosses.set(fighter.id,(nonFighterLosses.get(fighter.id)??0)+target.aircraftCount*airMissionEfficiency(target,ctx)*AIRCRAFT_TYPES[target.type].airAttack*B.combatLossRate/AIRCRAFT_TYPES.FIGHTER.airDefense/legacyTargets.length);
      }
    }
    for (const [id, damage] of nonFighterLosses) losses.set(id, (losses.get(id) ?? 0) + Math.ceil(damage));
    if(ids.size) {
      const engagement = {zoneId,wingIds:[...ids].sort(),losses:Object.fromEntries([...ids].map(id=>[id,Math.min(ws.find(w=>w.id===id)!.aircraftCount,(losses.get(id)??0))]))};
      engagements.push(engagement);

    }
  }
  return {...state,fighterLossRemainders,wings:state.wings.map(w=> {const lost=Math.min(w.aircraftCount,(losses.get(w.id)??0));return {...w,aircraftCount:w.aircraftCount-lost,strength:Math.max(0,w.strength-lost/w.maxAircraft*100),organization:Math.max(0,w.organization-(engaged.has(w.id)?B.combatOrganizationLoss:0))};}).filter(w=>w.aircraftCount>0),engagements,reports:advanceAirCombatReports(state.reports ?? [], engagements, state.wings, day, hostility, onEnded)};
}
export function airMissionsTick(state: AirState, ctx: AirContext) {
  const countries=ctx.countries.map(c=>({...c,resources:{...c.resources},economy:{...c.economy}}));
  const provinces=ctx.provinces.map(p=>({...p,market:p.market ? {...p.market,goods:{...p.market.goods,iron:{...p.market.goods.iron},tools:{...p.market.goods.tools}}} : undefined}));
  const nextCtx={...ctx,countries,provinces};
  const damage=new Map<string,number>();
  const hostility=buildNavalHostility(ctx.wars);
  // Stable resource spending order; retain the caller's wing order in the result.
  const updatedWings=[...state.wings].sort((a,b)=>a.id.localeCompare(b.id)).map(original=> {
    let w={...enterAirRecovery(original)};
    if (w.rebase) {
      if (!canUseAirBase(w.countryTag,w.rebase.targetProvinceId,nextCtx)) w={...w,rebase:undefined,status:'READY'};
      else if (w.rebase.daysRemaining<=1) w={...w,baseProvinceId:w.rebase.targetProvinceId,rebase:undefined,status:'READY'};
      else w={...w,rebase:{...w.rebase,daysRemaining:w.rebase.daysRemaining-1}};
    }
    const country=countries.find(c=>c.tag===w.countryTag);
    if (!country) return w;
    const maintenance=w.aircraftCount*AIRCRAFT_TYPES[w.type].maintenance;
    country.resources.gold=Math.max(0,country.resources.gold-maintenance);
    country.economy.goldExpense+=maintenance;
    if (!canUseAirBase(w.countryTag,w.baseProvinceId,nextCtx)) return cancelAirMission(w);
    const e=airMissionEfficiency(w,nextCtx);
    if (e > 0) {
  if (w.mission === 'BOMBING') {
    const zone = airZoneById.get(w.assignedAirZoneId!)!;
    const owners = [
      ...new Set(
        zone.provinceIds
          .map(id => provinces.find(p => p.id === id)?.owner)
          .filter(
            (tag): tag is string =>
              !!tag &&
              !!hostility.get(w.countryTag)?.has(tag)
          )
      ),
    ].sort();

    const control = getAirZoneControl(
      state,
      zone.id,
      w.countryTag,
      nextCtx
    );

    const power =
      w.aircraftCount *
      e *
      (1 - Math.max(0, -control.superiority) * 0.8) *
      B.bombingGoldPerAircraft;

    for (const owner of owners) {
      damage.set(
        owner,
        (damage.get(owner) ?? 0) + power / owners.length
      );
    }
  }

  w.organization = Math.max(
    0,
    w.organization - B.missionOrganizationLoss
  );
} else if (w.status === 'READY' || w.status === 'RECOVERING') {
  const base = airBaseByProvinceId.get(w.baseProvinceId)!;

  w.organization = Math.min(
    100,
    w.organization + B.organizationRecovery * base.level
  );

  w.strength = Math.min(
    100,
    w.strength + B.strengthRecovery * base.level
  );

}
    if (w.status === 'MISSION' || w.status === 'READY' || w.status === 'RECOVERING') {
      const base = airBaseByProvinceId.get(w.baseProvinceId)!;
      const fullReplacementCapacity = B.replacementPerLevel * base.level;
      const multiplier = w.status === 'MISSION' ? B.operationalReplacementMultiplier : 1;
      const capacity = fullReplacementCapacity * multiplier + (w.replacementRemainder ?? 0);
      const replacementCapacity = Math.floor(capacity);
      // Only fractional capacity survives shortages or a full wing; no delivery debt.
      w.replacementRemainder = capacity - replacementCapacity;
  const p = provinces.find(p => p.id === w.baseProvinceId)!;

  const depot =
    p.owner === w.countryTag && p.market
      ? p
      : provinces
          .filter(p => p.owner === w.countryTag && p.market)
          .sort((a, b) => a.id.localeCompare(b.id))
          .find(
            p =>
              p.market!.goods.iron.stock >= B.replacementIron &&
              p.market!.goods.tools.stock >= B.replacementTools
          );

  if (depot?.market) {
    const n = Math.min(
      w.maxAircraft - w.aircraftCount,
      replacementCapacity,
      Math.floor(country.resources.gold / B.replacementGold),
      Math.floor(
        depot.market.goods.iron.stock /
          B.replacementIron
      ),
      Math.floor(
        depot.market.goods.tools.stock /
          B.replacementTools
      )
    );

    if (n > 0) {
      w.aircraftCount += n;

      country.resources.gold -=
        n * B.replacementGold;

      depot.market.goods.iron.stock -=
        n * B.replacementIron;

      depot.market.goods.tools.stock -=
        n * B.replacementTools;
    }
  }
    }
    if (w.status === 'RECOVERING') {
      const recovery = w.recovery;
      // Drop invalid destinations immediately; never strand an automatic order.
      if (!recovery || !airZoneById.has(recovery.airZoneId) ||
          !isAirZoneInRange(w, recovery.airZoneId, nextCtx.provinces) ||
          !AIRCRAFT_TYPES[w.type].missions.includes(recovery.mission)) w = cancelAirMission(w);
      else if (w.organization >= 80 && w.strength >= 70 &&
               w.aircraftCount >= Math.ceil(w.maxAircraft * .75)) {
        w = assignAirMission(w, recovery.mission, recovery.airZoneId, nextCtx) ?? cancelAirMission(w);
      }
    }
    return w;
  });
  const byId = new Map(updatedWings.map(w => [w.id, w]));
  const wings = state.wings.map(w => byId.get(w.id)!);
  for(const c of countries) c.resources.gold=Math.max(0,c.resources.gold-Math.min(B.bombingMaxGoldPerCountry,damage.get(c.tag)??0));
  return {state:{...state,wings},countries,provinces};
}
/** Captured bases trigger safe evacuation; losing all access removes the stranded wing. */
export function cleanupAirState(state: AirState,ctx: AirContext): AirState {
  const candidates=state.wings.filter(w=>w.aircraftCount>0 && ctx.countries.some(c=>c.tag===w.countryTag && !c.isAnnexed));
  const occupancy=new Map<string,number>();
  for(const w of candidates) if(canUseAirBase(w.countryTag,w.baseProvinceId,ctx) && (!w.rebase || canUseAirBase(w.countryTag,w.rebase.targetProvinceId,ctx))) {
    for(const id of [w.baseProvinceId,...(w.rebase ? [w.rebase.targetProvinceId] : [])]) occupancy.set(id,(occupancy.get(id)??0)+1);
  }
  const wings=candidates.sort((a,b)=>a.id.localeCompare(b.id)).flatMap(w=> {
    if(canUseAirBase(w.countryTag,w.baseProvinceId,ctx) && (!w.rebase || canUseAirBase(w.countryTag,w.rebase.targetProvinceId,ctx))) return [w];
    const ready={...cancelAirMission({...w,status:'READY',rebase:undefined}),status:'READY' as const};
    const target=airBases.find(b=>canUseAirBase(w.countryTag,b.provinceId,ctx) && (occupancy.get(b.provinceId)??0)<b.capacity);
    if(!target) return [];
    // Emergency evacuation is immediately based, so every published/save state has valid access.
    occupancy.set(target.provinceId,(occupancy.get(target.provinceId)??0)+1);
    return [{...ready,baseProvinceId:target.provinceId,organization:Math.max(0,w.organization-20)}];
  });
  return {...state,wings};
}
export function airCounters(state: AirState,bots=0): AirCounters {
  return {airWings:state.wings.length,activeAirMissions:state.wings.filter(w=>w.status==='MISSION').length,airAIBots:bots,airEngagements:state.engagements.length,aircraftLost:state.engagements.reduce((s,e)=>s+Object.values(e.losses).reduce((a,b)=>a+b,0),0),casMissions:state.wings.filter(w=>w.mission==='CLOSE_AIR_SUPPORT').length,bombingMissions:state.wings.filter(w=>w.mission==='BOMBING').length};
}
