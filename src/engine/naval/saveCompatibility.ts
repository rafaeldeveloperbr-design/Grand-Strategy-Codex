import type { NavalState } from '../../types/naval';
import { NAVAL_UNIT_STATS } from '../../data/navalUnits';
import { NAVAL_BUILD_CONFIG, NAVAL_QUEUE_LIMIT } from '../../data/navalConstruction';
import { edgeKey, portByProvince, seaEdgeByPair, seaNodeById } from './world';
import { LANDING_DAYS } from './transport';
const record = (v:unknown):v is Record<string,unknown> => typeof v==='object'&&v!==null;
const strings = (v:unknown):v is string[] => Array.isArray(v)&&v.every(i=>typeof i==='string');
const finite = (v:unknown):v is number => typeof v==='number'&&Number.isFinite(v);
/** Additive V3: missing naval data means an empty navy, never a new-game respawn. */
export function readNavalSave(value:unknown):NavalState {
  if(value===undefined) return {fleets:[],battles:[]};
  if(!record(value)||!Array.isArray(value.fleets)||!Array.isArray(value.battles)) throw new Error('Save naval inválido');
  const ids=new Set<string>(), unitIds=new Set<string>();
  for(const f of value.fleets) {
    if(!record(f)||typeof f.id!=='string'||ids.has(f.id)||typeof f.countryTag!=='string'||typeof f.name!=='string'||!Array.isArray(f.units)||!f.units.length||!strings(f.route)||!finite(f.movementProgress)||f.movementProgress<0||f.movementProgress>=1||!['DOCKED','HOLDING','MOVING','COMBAT','RETREATING'].includes(String(f.status))) throw new Error('Fleet inválida no save');
    ids.add(f.id);
    const port=typeof f.portProvinceId==='string'?portByProvince.get(f.portProvinceId):undefined;
    const node=typeof f.locationSeaNodeId==='string'?seaNodeById.get(f.locationSeaNodeId):undefined;
    if(f.portProvinceId!==undefined&&!port || f.locationSeaNodeId!==undefined&&!node) throw new Error('Localização naval inválida');
    if(!port&&!node || port&&node) throw new Error('Localização naval inválida');
    let prior=node?.id;
    for(const id of f.route) {if(!seaNodeById.has(id)||prior&&!seaEdgeByPair.has(edgeKey(prior,id))) throw new Error('Rota naval inválida');if(!prior&&port?.seaNodeId!==id) throw new Error('Saída do porto inválida');prior=id;}
    if(f.destinationSeaNodeId!==undefined&&(!seaNodeById.has(String(f.destinationSeaNodeId))||f.route.length>0&&f.route[f.route.length-1]!==f.destinationSeaNodeId)) throw new Error('Destino naval inválido');
    if(f.destinationPortId!==undefined&&!portByProvince.has(String(f.destinationPortId))) throw new Error('Porto de destino inválido');
    if(f.destinationPortId!==undefined && portByProvince.get(String(f.destinationPortId))!.seaNodeId !== (f.destinationSeaNodeId ?? node?.id)) throw new Error('Conexão do porto de destino inválida');
    if(f.status==='DOCKED'&&!port || f.status==='HOLDING'&&!node) throw new Error('Status/localização naval incompatível');
    if(f.movementProgress>0&&(!['MOVING','RETREATING'].includes(String(f.status)) || !f.route.length&&!f.destinationPortId)) throw new Error('Progresso naval incompatível');
    if(f.retreatUntil!==undefined&&!finite(f.retreatUntil)) throw new Error('Retirada naval inválida');
    for(const u of f.units) {
      if(!record(u)||typeof u.id!=='string'||unitIds.has(u.id)||typeof u.type!=='string'||!Object.prototype.hasOwnProperty.call(NAVAL_UNIT_STATS,u.type)) throw new Error('Unidade naval inválida');
      unitIds.add(u.id);
      if(!['strength','maxStrength','organization','maxOrganization','attack','defense','speed'].every(k=>finite(u[k])&&(u[k] as number)>=0)||!finite(u.maxStrength)||u.maxStrength<=0||!finite(u.maxOrganization)||u.maxOrganization<=0||!finite(u.strength)||u.strength<=0||u.strength>u.maxStrength||!finite(u.organization)||u.organization>u.maxOrganization||!finite(u.speed)||u.speed<=0) throw new Error('Stats navais inválidos');
    }
  }
  if (value.construction !== undefined) {
    const c = value.construction;
    if (!record(c) || !Array.isArray(c.shipyards) || !Array.isArray(c.builds) || !Array.isArray(c.upgrades) || !Number.isSafeInteger(c.nextId) || (c.nextId as number) < 1) throw new Error('Construção naval inválida');
    const yards = new Map<string,number>(), orderIds = new Set<string>(), upgradePorts = new Set<string>(), queueSizes = new Map<string,number>();
    for (const s of c.shipyards) {
      if (!record(s) || typeof s.provinceId !== 'string' || !portByProvince.has(s.provinceId) || yards.has(s.provinceId) || !Number.isInteger(s.level) || (s.level as number) < 0 || (s.level as number) > 3) throw new Error('Shipyard inválido');
      yards.set(s.provinceId,s.level as number);
    }
    for (const order of [...c.builds,...c.upgrades]) {
      if (!record(order) || typeof order.id !== 'string' || !/^naval-build-\d+$/.test(order.id) || Number(order.id.slice(12)) >= (c.nextId as number) || orderIds.has(order.id) || typeof order.countryTag !== 'string' || typeof order.provinceId !== 'string' || !portByProvince.has(order.provinceId) || !finite(order.progress) || !finite(order.requiredProgress) || order.requiredProgress <= 0 || order.progress < 0 || order.progress >= order.requiredProgress || !finite(order.startedAt)) throw new Error('Ordem naval inválida');
      orderIds.add(order.id);
    }
    for (const order of c.builds) {
      if (!record(order) || typeof order.unitType !== 'string' || !Object.prototype.hasOwnProperty.call(NAVAL_UNIT_STATS,order.unitType) || order.targetFleetId !== undefined && typeof order.targetFleetId !== 'string') throw new Error('Navio em construção inválido');
      const id = String(order.provinceId), size=(queueSizes.get(id)??0)+1;
      if(size>NAVAL_QUEUE_LIMIT || (yards.get(id)??0)<NAVAL_BUILD_CONFIG[order.unitType as keyof typeof NAVAL_BUILD_CONFIG].level)throw new Error('Fila naval inválida');
      queueSizes.set(id,size);
    }
    for (const order of c.upgrades) {
      if (!record(order) || !Number.isInteger(order.targetLevel) || (order.targetLevel as number)<1 || (order.targetLevel as number)>3 || order.targetLevel !== (yards.get(String(order.provinceId))??0)+1 || upgradePorts.has(String(order.provinceId))) throw new Error('Upgrade naval inválido');
      upgradePorts.add(String(order.provinceId));
    }
    for (const id of [...ids,...unitIds]) {
      const serial=id.match(/^(?:fleet-built-|ship-naval-build-)(\d+)$/)?.[1];
      if(serial && Number(serial)>=(c.nextId as number))throw new Error('Contador naval inválido');
    }
  }
  const battleIds=new Set<string>();
  if (value.invasions !== undefined) {
    if (!Array.isArray(value.invasions)) throw new Error('Invasões inválidas');
    const committed = new Set<string>(), armies = new Set<string>();
    for (const order of value.invasions) {
      if (!record(order) || typeof order.fleetId !== 'string' || !ids.has(order.fleetId) || committed.has(order.fleetId) || !strings(order.armyIds) || !order.armyIds.length || order.armyIds.some(id => armies.has(id)) || new Set(order.armyIds).size !== order.armyIds.length || typeof order.targetProvinceId !== 'string' || typeof order.seaNodeId !== 'string' || !seaNodeById.has(order.seaNodeId) || portByProvince.get(order.targetProvinceId)?.seaNodeId !== order.seaNodeId || typeof order.targetOwner !== 'string' || !['SAILING', 'LANDING'].includes(String(order.status)) || !Number.isInteger(order.landingDays) || (order.landingDays as number) < 0 || (order.landingDays as number) >= LANDING_DAYS || order.status === 'SAILING' && order.landingDays !== 0 || order.status === 'LANDING' && order.landingDays === 0) throw new Error('Ordem/progresso de invasão inválido');
      committed.add(order.fleetId); order.armyIds.forEach(id => armies.add(id));
      const fleet = value.fleets.find(f => f.id === order.fleetId);
      if (!fleet || ['COMBAT', 'RETREATING'].includes(fleet.status) || order.status === 'LANDING' && (fleet.status !== 'HOLDING' || fleet.locationSeaNodeId !== order.seaNodeId || fleet.movementProgress !== 0)) throw new Error('Fleet incompatível com landing');
    }
  }
  for(const b of value.battles) {
    if(!record(b)||typeof b.id!=='string'||battleIds.has(b.id)||!seaNodeById.has(String(b.seaNodeId))||!strings(b.sideA)||!strings(b.sideB)||!['ACTIVE','ENDED'].includes(String(b.status))||!finite(b.startedAt)||!['days','lossesA','lossesB'].every(k=>finite(b[k])&&(b[k] as number)>=0)) throw new Error('NavalBattle inválida');
    battleIds.add(b.id);
    if (b.embarkedTroopLosses !== undefined && (!finite(b.embarkedTroopLosses) || b.embarkedTroopLosses < 0)) throw new Error('Baixas embarcadas inválidas');
    if(new Set([...b.sideA,...b.sideB]).size!==b.sideA.length+b.sideB.length) throw new Error('Participante naval duplicado');
    if(b.status==='ACTIVE'&&(!b.sideA.some(id=>ids.has(id))||!b.sideB.some(id=>ids.has(id)))) throw new Error('Fleet de batalha ausente');
  }
  // All nested fields are checked above at the unknown JSON boundary.
  return structuredClone(value) as unknown as NavalState;
}
