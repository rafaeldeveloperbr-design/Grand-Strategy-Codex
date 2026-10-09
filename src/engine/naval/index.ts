import { captureNavalParticipants, updateNavalParticipants } from './reports';
import type { Country, Province, War } from '../../types';
import type { DiplomaticRelation } from '../../types/diplomacy';
import type { Fleet, NavalState, NavalUnitType } from '../../types/naval';
import { createNavalUnit, NAVAL_BALANCE as B, NAVAL_UNIT_STATS } from '../../data/navalUnits';
import { getCampaigns } from '../diplomacy/campaigns';
import { findSeaRoute, seaRouteDistance } from './pathfinding';
import { edgeKey, navalPorts, portByProvince, seaEdgeByPair, seaNodeById } from './world';
export * from './world';
export * from './pathfinding';
export * from './construction';
export * from './transport';
export * from './beachExtraction';
export * from './friendlyBeachLanding';
export const fleetSpeed = (f: Fleet): number => f.units.length ? Math.min(...f.units.map(u=>u.speed)) : 0;
export const fleetStrength = (f: Fleet): number => f.units.reduce((s,u)=>s+u.strength,0);
export const fleetOrganization = (f: Fleet): number => f.units.length ? f.units.reduce((s,u)=>s+u.organization/u.maxOrganization,0)/f.units.length*100 : 0;
export const fleetPower = (f: Fleet): number => f.units.reduce((s,u)=>s+u.attack*u.strength/u.maxStrength*(.25+.75*u.organization/u.maxOrganization),0);
/** Logical node occupancy excludes ports and transit, regardless of rendered position. */
export const fleetCombatNode = (f: Fleet): string | undefined =>
  f.status!=='DOCKED'&&!f.portProvinceId&&f.movementProgress===0&&seaNodeById.has(f.locationSeaNodeId??'') ? f.locationSeaNodeId : undefined;
export function buildNavalIndexes(fleets: readonly Fleet[]) {
  const byCountry=new Map<string,Fleet[]>(), bySeaNode=new Map<string,Fleet[]>(), byPort=new Map<string,Fleet[]>(), byId=new Map<string,Fleet>();
  const add=(index: Map<string,Fleet[]>, key:string, f:Fleet) => {const list=index.get(key)??[];list.push(f);index.set(key,list);};
  for(const f of fleets) {byId.set(f.id,f);add(byCountry,f.countryTag,f);if(f.portProvinceId) add(byPort,f.portProvinceId,f);const node=fleetCombatNode(f);if(node)add(bySeaNode,node,f);}
  return {byCountry,bySeaNode,byPort,byId};
}
export function buildNavalHostility(wars: readonly War[]): Map<string,Set<string>> {
  const result=new Map<string,Set<string>>();
  for(const campaign of getCampaigns([...wars])) if(!campaign.inconsistent) for(const a of campaign.attackerParticipants) for(const b of campaign.defenderParticipants) {
    const as=result.get(a)??new Set<string>(), bs=result.get(b)??new Set<string>();as.add(b);bs.add(a);result.set(a,as);result.set(b,bs);
  }
  return result;
}
/** Presence is derived from node buckets; it neither blocks neutral passage nor changes war score. */
export function buildNavalPresence(fleets: readonly Fleet[], wars: readonly War[]) {
  const hostility=buildNavalHostility(wars);
  const presence=new Map<string,{countryTags:string[];fleetIds:string[];combatPower:number;contested:boolean;controller?:string}>();
  for(const [node,bucket] of buildNavalIndexes(fleets).bySeaNode) {
    const tags=[...new Set(bucket.map(f=>f.countryTag))].sort();
    const contested=tags.some(tag=>tags.some(other=>hostility.get(tag)?.has(other)));
    presence.set(node,{countryTags:tags,fleetIds:bucket.map(f=>f.id),combatPower:bucket.reduce((sum,f)=>sum+fleetPower(f),0),contested,controller:tags.length===1?tags[0]:undefined});
  }
  return presence;
}
export function canUseNavalPort(tag:string, province:Province, relations:readonly DiplomaticRelation[], hostility:Map<string,Set<string>>):boolean {
  return portByProvince.has(province.id) && canUseNavalAccess(tag,province,relations,hostility);
}
/** Shared port/beach ownership, alliance and access contract. */
export function canUseNavalAccess(tag:string, province:Province, relations:readonly DiplomaticRelation[], hostility:Map<string,Set<string>>):boolean {
  if(hostility.get(tag)?.has(province.owner)) return false;
  if(province.owner===tag) return true;
  const r=relations.find(r=>r.countryA===tag&&r.countryB===province.owner||r.countryB===tag&&r.countryA===province.owner);
  return !!r?.alliance || !!r?.militaryAccess?.includes(province.owner);
}
export function createInitialNavies(countries:readonly Country[], provinces:readonly Province[]):Fleet[] {
  const provinceById=new Map(provinces.map(p=>[p.id,p])), portsByCountry=new Map<string,typeof navalPorts[number][]>();
  for(const p of navalPorts) {const tag=provinceById.get(p.provinceId)?.owner;if(tag) {const list=portsByCountry.get(tag)??[];list.push(p);portsByCountry.set(tag,list);}}
  const major=new Set(['USA','GBR','JPN','FRA','ITA','DEU','BRA','CHN','RUS','IND','AUS']);
  return countries.flatMap(c=> {
    const ports=portsByCountry.get(c.tag);if(!ports?.length||c.isAnnexed) return [];
    const score=Math.max(0,c.economy.goldIncome)+Math.max(0,c.resources.manpower)/2000+c.provinces.length*2+ports.length*3;
    if(!major.has(c.tag)&&score<12) return [];
    const types:NavalUnitType[]=major.has(c.tag) ? ['DESTROYER','DESTROYER','CRUISER','BATTLESHIP','TRANSPORT'] : score>=30 ? ['DESTROYER','CRUISER'] : ['DESTROYER'];
    const id=`fleet-${c.tag}-1`;
    return [{id,countryTag:c.tag,name:`${c.name} · 1ª Frota`,units:types.map((t,i)=>createNavalUnit(`${id}-${i}`,t)),portProvinceId:ports[0].provinceId,route:[],movementProgress:0,status:'DOCKED' as const}];
  });
}
export function cancelNavalOrder(f:Fleet):Fleet {
  if(f.status==='COMBAT'||f.status==='RETREATING') return f;
  if(f.movementProgress>0&&!f.route.length&&f.destinationPortId) return f;
  // At sea a stop retains the current edge to its endpoint: no teleport backwards.
  if(f.movementProgress>0 && f.route[0]) return {...f,route:[f.route[0]],destinationSeaNodeId:f.route[0],destinationPortId:undefined};
  return {...f,route:[],destinationSeaNodeId:undefined,destinationPortId:undefined,movementProgress:0,status:f.portProvinceId?'DOCKED':'HOLDING'};
}
export function orderFleetMove(f:Fleet,nodeId:string,actor:string):Fleet|null {
  if(f.countryTag!==actor||f.status==='COMBAT'||f.status==='RETREATING'||!seaNodeById.has(nodeId)) return null;
  if(f.movementProgress>0&&!f.route.length&&f.destinationPortId) return null;
  // Replanning during an edge keeps that edge and its elapsed progress.
  const underway=f.movementProgress>0 && f.route[0];
  const start=underway || f.locationSeaNodeId || portByProvince.get(f.portProvinceId??'')?.seaNodeId;
  if(!start) return null;
  const path=findSeaRoute(start,nodeId);if(!path) return null;
  const route=underway ? [underway,...path] : f.portProvinceId ? [start,...path] : path;
  return {...f,route,destinationSeaNodeId:nodeId,destinationPortId:undefined,movementProgress:underway?f.movementProgress:0,status:'MOVING'};
}
/** V1 interception snapshots a logical endpoint; it does not track the target dynamically. */
export function resolveFleetIntercept(own:Fleet|undefined,target:Fleet|undefined,actor:string,wars:readonly War[]):{nodeId:string;error?:never}|{error:string;nodeId?:never} {
  if(!own||own.countryTag!==actor)return {error:'Selecione uma frota própria.'};
  if(!target)return {error:'A frota alvo não existe mais.'};
  if(!buildNavalHostility(wars).get(actor)?.has(target.countryTag))return {error:'A frota alvo não é hostil.'};
  if(own.status==='COMBAT')return {error:'A frota própria está ocupada em combate.'};
  if(own.status==='RETREATING')return {error:'A frota própria está em retirada.'};
  if(own.movementProgress>0&&!own.route.length&&own.destinationPortId)return {error:'A frota própria está entrando no porto.'};
  if(!seaNodeById.has(own.locationSeaNodeId??portByProvince.get(own.portProvinceId??'')?.seaNodeId??''))return {error:'A frota própria não tem node válido.'};
  const nodeId=target.portProvinceId ? portByProvince.get(target.portProvinceId)?.seaNodeId
    : target.status==='MOVING'||target.status==='RETREATING'&&target.movementProgress>0
      ? target.route[0]??target.destinationSeaNodeId??target.locationSeaNodeId : target.locationSeaNodeId;
  return nodeId&&seaNodeById.has(nodeId)?{nodeId}:{error:'A frota alvo não tem node válido.'};
}
export function orderFleetReturn(f:Fleet,provinces:readonly Province[],relations:readonly DiplomaticRelation[],wars:readonly War[],actor:string,portId?:string):Fleet|null {
  if(f.countryTag!==actor||f.status==='COMBAT'||f.status==='RETREATING') return null;
  if(f.portProvinceId&&f.movementProgress===0&&(!portId||portId===f.portProvinceId)) return cancelNavalOrder(f);
  const hostility=buildNavalHostility(wars), start=f.route[0]&&f.movementProgress>0 ? f.route[0] : f.locationSeaNodeId || portByProvince.get(f.portProvinceId??'')?.seaNodeId;
  if(!start) return null;
  const available=provinces.filter(p=>(!portId||p.id===portId)&&canUseNavalPort(f.countryTag,p,relations,hostility));
  let best: {id:string;node:string;distance:number}|undefined;
  for(const p of available) {const node=portByProvince.get(p.id)!.seaNodeId, route=findSeaRoute(start,node);if(!route) continue;const distance=seaRouteDistance(start,route);if(!best||distance<best.distance||distance===best.distance&&p.id<best.id) best={id:p.id,node,distance};}
  if(!best) return null;
  const moved=orderFleetMove(f,best.node,actor); return moved?{...moved,destinationPortId:best.id}:null;
}
export function fleetPosition(f:Fleet):{x:number;y:number}|undefined {
  const port=portByProvince.get(f.portProvinceId??''), node=seaNodeById.get(f.locationSeaNodeId??''), from=port??node;
  if(!from) return undefined;
  const to=seaNodeById.get(f.route[0]??'') ?? (f.status==='MOVING' ? portByProvince.get(f.destinationPortId??'') : undefined);if(!to||!f.movementProgress) return {x:from.x,y:from.y};
  const logical=node&&'id' in to&&seaEdgeByPair.get(edgeKey(node.id,to.id))?.logical;
  if(logical) return f.movementProgress<.5 ? {x:node.x,y:node.y} : {x:to.x,y:to.y};
  return {x:from.x+(to.x-from.x)*f.movementProgress,y:from.y+(to.y-from.y)*f.movementProgress};
}
export function navalMovementTick(fleets:readonly Fleet[],provinces:readonly Province[],relations:readonly DiplomaticRelation[],wars:readonly War[]):Fleet[] {
  const provinceById=new Map(provinces.map(p=>[p.id,p])), hostility=buildNavalHostility(wars), occupied=buildNavalIndexes(fleets).bySeaNode;
  return fleets.map(original=> {
    let f={...original,route:[...original.route]}, budget=fleetSpeed(f)*B.speedToMapUnits;
    if(f.status==='COMBAT') return original;
    if(f.portProvinceId) {const p=provinceById.get(f.portProvinceId);if(!p||!canUseNavalPort(f.countryTag,p,relations,hostility)) {const port=portByProvince.get(f.portProvinceId);f={...f,portProvinceId:undefined,locationSeaNodeId:port?.seaNodeId,status:'HOLDING',route:[],movementProgress:0,destinationPortId:undefined,destinationSeaNodeId:undefined};}}
    if(f.status!=='MOVING'&&f.status!=='RETREATING') return f;
    if(f.locationSeaNodeId&&f.movementProgress===0&&f.status!=='RETREATING'&&occupied.get(f.locationSeaNodeId)?.some(other=>hostility.get(f.countryTag)?.has(other.countryTag))) return f;
    if(f.locationSeaNodeId) occupied.set(f.locationSeaNodeId,(occupied.get(f.locationSeaNodeId)??[]).filter(other=>other.id!==f.id));
    if(f.portProvinceId&&!f.route.length) { const port=portByProvince.get(f.portProvinceId)!;f={...f,locationSeaNodeId:port.seaNodeId,portProvinceId:undefined}; }
    while(budget>0 && f.route.length) {
      const to=seaNodeById.get(f.route[0]), port=portByProvince.get(f.portProvinceId??''), from=seaNodeById.get(f.locationSeaNodeId??'');
      const edge=from&&to?seaEdgeByPair.get(edgeKey(from.id,to.id)):undefined;
      const distance=port&&to?Math.max(1,Math.hypot(port.x-to.x,port.y-to.y)):edge?.distance;
      if(!to||!distance) return {...f,route:[],movementProgress:0,status:port?'DOCKED':'HOLDING',destinationSeaNodeId:undefined,destinationPortId:undefined};
      const needed=(1-f.movementProgress)*distance;
      if(budget<needed) {f.movementProgress+=budget/distance;break;}
      budget-=needed;f.locationSeaNodeId=to.id;f.portProvinceId=undefined;f.movementProgress=0;f.route.shift();
      // Stop at hostile occupied nodes so multiple-edge movement cannot skip combat.
      if(occupied.get(to.id)?.some(other=>hostility.get(f.countryTag)?.has(other.countryTag))) break;
    }
    if(!f.route.length) {
      const destination=f.destinationPortId?provinceById.get(f.destinationPortId):undefined, port=destination?portByProvince.get(destination.id):undefined;
      if(destination&&port&&port.seaNodeId===f.locationSeaNodeId&&canUseNavalPort(f.countryTag,destination,relations,hostility)) {
        const node=seaNodeById.get(port.seaNodeId)!;
        const distance=Math.max(1,Math.hypot(node.x-port.x,node.y-port.y));
        f.movementProgress=Math.min(1,f.movementProgress+budget/distance);
        if(f.movementProgress<1) return f;
        f.portProvinceId=destination.id;f.locationSeaNodeId=undefined;f.status='DOCKED';f.movementProgress=0;
      } else f.status='HOLDING';
      f.destinationPortId=undefined;f.destinationSeaNodeId=undefined;
    }
    if(f.locationSeaNodeId&&f.movementProgress===0) {const bucket=occupied.get(f.locationSeaNodeId)??[];bucket.push(f);occupied.set(f.locationSeaNodeId,bucket);}
    return f;
  });
}
export function navalRecoveryTick(fleets:readonly Fleet[],countries:readonly Country[],provinces:readonly Province[],relations:readonly DiplomaticRelation[],wars:readonly War[]) {
  const countryByTag=new Map(countries.map(c=>[c.tag,{...c,resources:{...c.resources},economy:{...c.economy}}])), provinceById=new Map(provinces.map(p=>[p.id,p])), hostility=buildNavalHostility(wars);
  const result=fleets.map(f=> {
    const country=countryByTag.get(f.countryTag);if(!country) return f;
    const maintenance=f.units.reduce((s,u)=>s+NAVAL_UNIT_STATS[u.type].maintenance,0);
    country.resources.gold=Math.max(0,country.resources.gold-maintenance);country.economy.goldExpense+=maintenance;
    const p=provinceById.get(f.portProvinceId??'');if(!p||f.status!=='DOCKED'||!canUseNavalPort(f.countryTag,p,relations,hostility)) return f;
    const level=portByProvince.get(p.id)!.level;
    return {...f,units:f.units.map(u=> {
      const repair=Math.min(B.repairStrength*level,u.maxStrength-u.strength,country.resources.gold/B.repairGoldPerStrength);
      country.resources.gold=Math.max(0,country.resources.gold-repair*B.repairGoldPerStrength);
      return {...u,strength:u.strength+repair,organization:Math.min(u.maxOrganization,u.organization+B.recoveryOrganization*level)};
    })};
  });
  return {fleets:result,countries:countries.map(c=>countryByTag.get(c.tag)!)};
}
export function navalAITick(fleets:readonly Fleet[],full:Set<string>,player:string,provinces:readonly Province[],relations:readonly DiplomaticRelation[],wars:readonly War[],committed:ReadonlySet<string>=new Set()) {
  const hostility=buildNavalHostility(wars), indexes=buildNavalIndexes(fleets), bots=new Set<string>();
  const result=fleets.map(f=> {
    if(f.countryTag===player||!full.has(f.countryTag)||committed.has(f.id)) return f;
    bots.add(f.countryTag);if(['COMBAT','RETREATING','MOVING'].includes(f.status)) return f;
    if(fleetOrganization(f)<50||f.units.some(u=>u.strength<u.maxStrength*.65)) return orderFleetReturn(f,provinces,relations,wars,f.countryTag)??f;
    const home=portByProvince.get(f.portProvinceId??''), origin=f.locationSeaNodeId??home?.seaNodeId;if(!origin) return f;
    const originNode=seaNodeById.get(origin)!;
    const enemies=[...(hostility.get(f.countryTag)??[])].flatMap(tag=>indexes.byCountry.get(tag)??[]).filter(e=>!e.portProvinceId && e.locationSeaNodeId && fleetPower(e)<=fleetPower(f)*1.35);
    const nearby=enemies.map(e=>({e,n:seaNodeById.get(e.locationSeaNodeId!)!})).filter(v=>Math.hypot(v.n.x-originNode.x,v.n.y-originNode.y)<600).sort((a,b)=>Math.hypot(a.n.x-originNode.x,a.n.y-originNode.y)-Math.hypot(b.n.x-originNode.x,b.n.y-originNode.y)||a.e.id.localeCompare(b.e.id));
    if(nearby[0]) return orderFleetMove(f,nearby[0].n.id,f.countryTag)??f;
    // Hold in home waters in peace. Undock once, then keep station without daily orders.
    if(home) return orderFleetMove(f,home.seaNodeId,f.countryTag)??f;
    return f;
  });
  return {fleets:result,bots:bots.size};
}
export function navalCombatTick(state:NavalState,wars:readonly War[],day:number,provinces:readonly Province[],relations:readonly DiplomaticRelation[]):NavalState {
  const fleets=structuredClone(state.fleets), indexes=buildNavalIndexes(fleets), hostility=buildNavalHostility(wars);
  let battles=structuredClone(state.battles);const engaged=new Set<string>();
  // Existing engagements end as soon as hostility, location or participation disappears.
  for(const battle of battles.filter(b=>b.status==='ACTIVE')) {
    updateNavalParticipants(battle, indexes.byId);
    const a=battle.sideA.map(id=>indexes.byId.get(id)).filter((f):f is Fleet=>!!f&&fleetCombatNode(f)===battle.seaNodeId), b=battle.sideB.map(id=>indexes.byId.get(id)).filter((f):f is Fleet=>!!f&&fleetCombatNode(f)===battle.seaNodeId);
    if(!a.length||!b.length||!a.every(f=>b.every(e=>hostility.get(f.countryTag)?.has(e.countryTag)))) {battle.status='ENDED';for(const f of [...a,...b]) if(f.status==='COMBAT') f.status='HOLDING';}
    else {
      // Keep destroyed participants in the report, but do not damage fleets in transit.
      const stillHere=(id:string)=>{const f=indexes.byId.get(id);return !f||fleetCombatNode(f)===battle.seaNodeId;};
      battle.sideA=battle.sideA.filter(stillHere);battle.sideB=battle.sideB.filter(stillHere);
      for(const f of [...a,...b]) engaged.add(f.id);
      // Join the existing engagement before detecting new ones; otherwise an arrival
      // has no unengaged opponent, or two arrivals create a duplicate battle.
      for(const f of [...(indexes.bySeaNode.get(battle.seaNodeId)??[])].sort((a,b)=>a.id.localeCompare(b.id))) {
        if(engaged.has(f.id)||(f.retreatUntil!==undefined&&f.retreatUntil>day))continue;
        if(b.every(e=>hostility.get(f.countryTag)?.has(e.countryTag))&&a.every(e=>!hostility.get(f.countryTag)?.has(e.countryTag))) {a.push(f);battle.sideA.push(f.id);engaged.add(f.id);}
        else if(a.every(e=>hostility.get(f.countryTag)?.has(e.countryTag))&&b.every(e=>!hostility.get(f.countryTag)?.has(e.countryTag))) {b.push(f);battle.sideB.push(f.id);engaged.add(f.id);}
      }
    }
  }
  for(const [node,bucket] of indexes.bySeaNode) {
    const sorted=bucket.filter(f=>!engaged.has(f.id)&&(f.retreatUntil===undefined||f.retreatUntil<=day)).sort((a,b)=>a.id.localeCompare(b.id));
    for(const a of sorted) {
      if(engaged.has(a.id)) continue;
      const b=sorted.find(b=>!engaged.has(b.id)&&hostility.get(a.countryTag)?.has(b.countryTag));if(!b) continue;
      // Coalition joiners must be hostile to every opposing participant; neutrals never receive damage.
      const sideA=[a], sideB=[b];
      for(const f of sorted) if(f!==a&&f!==b&&!engaged.has(f.id)) {
        if(sideB.every(e=>hostility.get(f.countryTag)?.has(e.countryTag))&&sideA.every(e=>!hostility.get(f.countryTag)?.has(e.countryTag))) sideA.push(f);
        else if(sideA.every(e=>hostility.get(f.countryTag)?.has(e.countryTag))&&sideB.every(e=>!hostility.get(f.countryTag)?.has(e.countryTag))) sideB.push(f);
      }
      const id=`naval-${day}-${node}-${a.id}-${b.id}`;
      battles.push({id,seaNodeId:node,sideA:sideA.map(f=>f.id),sideB:sideB.map(f=>f.id),startedAt:day,days:0,status:'ACTIVE',lossesA:0,lossesB:0});for(const f of [...sideA,...sideB]) engaged.add(f.id);
    }
  }
  for (const battle of battles.filter(b=>b.status==='ACTIVE')) captureNavalParticipants(battle, indexes.byId);
  const retreat=(f:Fleet,nodeId:string) => {
    const node=seaNodeById.get(nodeId)!;
    const neighbors=node.neighbors.filter(id=>!indexes.bySeaNode.get(id)?.some(e=>hostility.get(f.countryTag)?.has(e.countryTag)));
    const choices=neighbors.length?neighbors:node.neighbors;
    const friendly=navalPorts.filter(p=>{const province=provinces.find(v=>v.id===p.provinceId);return province&&canUseNavalPort(f.countryTag,province,relations,hostility);});
    const ranked=choices.map(id=>({id,distance:Math.min(Infinity,...friendly.map(p=>{const route=findSeaRoute(id,p.seaNodeId);return route?seaRouteDistance(id,route):Infinity;}))})).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
    f.status=ranked.length?'RETREATING':'HOLDING';f.route=ranked.length?[ranked[0].id]:[];f.destinationSeaNodeId=ranked[0]?.id;f.destinationPortId=undefined;f.movementProgress=0;f.retreatUntil=day+B.retreatDays;
  };
  for(const battle of battles.filter(b=>b.status==='ACTIVE')) {
    const a=battle.sideA.map(id=>indexes.byId.get(id)).filter((f):f is Fleet=>!!f), b=battle.sideB.map(id=>indexes.byId.get(id)).filter((f):f is Fleet=>!!f);
    const attackA=a.reduce((s,f)=>s+fleetPower(f),0), attackB=b.reduce((s,f)=>s+fleetPower(f),0);
    const damage=(side:Fleet[],attack:number) => {
      const defense=side.flatMap(f=>f.units).reduce((s,u)=>s+u.defense*u.strength/u.maxStrength,0);
      const units=side.reduce((s,f)=>s+f.units.length,0), amount=attack*B.damage/(1+defense/100)/Math.max(1,units);let lost=0;
      for(const f of side) {f.status='COMBAT';f.route=[];f.destinationSeaNodeId=undefined;f.destinationPortId=undefined;f.movementProgress=0;
        for(const u of f.units) {const d=Math.min(u.strength,amount);lost+=d;u.strength-=d;u.organization=Math.max(0,u.organization-amount*B.organizationDamage);}f.units=f.units.filter(u=>u.strength>0);}
      return lost;
    };
    battle.lossesA+=damage(a,attackB);battle.lossesB+=damage(b,attackA);battle.days++;
    updateNavalParticipants(battle, indexes.byId);
    const broken=(side:Fleet[])=>side.every(f=>!f.units.length||fleetOrganization(f)<=B.retreatOrganization);
    const brokenA=broken(a), brokenB=broken(b);
    if(brokenA||brokenB) {
      battle.status='ENDED';battle.winner=brokenA&&brokenB?'DRAW':brokenA?'B':'A';
      for(const f of a) if(f.units.length) {if(brokenA) retreat(f,battle.seaNodeId);else f.status='HOLDING';}
      for(const f of b) if(f.units.length) {if(brokenB) retreat(f,battle.seaNodeId);else f.status='HOLDING';}
    }
  }
  battles=[...battles.filter(b=>b.status==='ENDED').slice(-B.historyLimit),...battles.filter(b=>b.status==='ACTIVE')];
  return {...state,fleets:fleets.filter(f=>f.units.length),battles};
}
export function cleanupNavalState(state:NavalState,provinces:readonly Province[],wars:readonly War[]):NavalState {
  const territory=new Set(provinces.map(p=>p.owner));
  const fleets=state.fleets.filter(f=>territory.has(f.countryTag)&&f.units.length), byId=new Map(fleets.map(f=>[f.id,f])), hostility=buildNavalHostility(wars);
  const battles=state.battles.map(b=> {
    if(b.status!=='ACTIVE') return b;
    const a=b.sideA.map(id=>byId.get(id)).filter((f):f is Fleet=>!!f), opposite=b.sideB.map(id=>byId.get(id)).filter((f):f is Fleet=>!!f);
    return !a.length||!opposite.length||!a.every(f=>opposite.every(e=>hostility.get(f.countryTag)?.has(e.countryTag))) ? {...b,status:'ENDED' as const} : b;
  });
  const engaged=new Set(battles.filter(b=>b.status==='ACTIVE').flatMap(b=>[...b.sideA,...b.sideB]));
  const owners=new Map(provinces.map(p=>[p.id,p.owner]));
  const construction=state.construction ? {...state.construction,
    builds:state.construction.builds.filter(b=>owners.get(b.provinceId)===b.countryTag),
    upgrades:state.construction.upgrades.filter(b=>owners.get(b.provinceId)===b.countryTag),
  } : undefined;
  return {...state,...(construction?{construction}:{}),battles,fleets:fleets.map(f=>f.status==='COMBAT'&&!engaged.has(f.id)?{...f,status:'HOLDING' as const}:f)};
}
