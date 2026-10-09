import data from '../../data/navalWorld.json';
import type { Province } from '../../types';
import type { NavalPort, SeaEdge, SeaNode } from '../../types/naval';
export const seaNodes: readonly SeaNode[] = data.nodes;
export const seaEdges: readonly SeaEdge[] = data.edges;
export const navalPorts: readonly NavalPort[] = data.ports;
export const seaNodeById = new Map(seaNodes.map(n => [n.id, n]));
export const portByProvince = new Map(navalPorts.map(p => [p.provinceId, p]));
const coastIndex: Readonly<Record<string, readonly string[]>> = data.coastalSeaNodes;
const waterBorderIds = new Set(data.waterBorderProvinceIds);
export const isNavigableSeaNode = (node: SeaNode | undefined): node is SeaNode => !!node && !node.inland && !node.lake && !/lake|inland/i.test(node.ocean) && node.neighbors.some(id => seaNodeById.has(id));
export function getCoastalSeaNodes(province: Pick<Province, 'id'> | string): SeaNode[] {
  const id = typeof province === 'string' ? province : province.id;
  return (coastIndex[id] ?? []).map(id => seaNodeById.get(id)).filter(isNavigableSeaNode);
}
export const isCoastalProvince = (province: Pick<Province, 'id'> | string): boolean => getCoastalSeaNodes(province).length > 0;
export function resolveAmphibiousLandingSeaNode(province: Pick<Province, 'id'> | string): SeaNode | undefined {
  const id = typeof province === 'string' ? province : province.id, nodes = getCoastalSeaNodes(id);
  return nodes.find(n => n.id === portByProvince.get(id)?.seaNodeId) ?? nodes[0];
}
export function coastalLandingError(id: string): string | undefined {
  if (isCoastalProvince(id)) return;
  return waterBorderIds.has(id) ? 'Alvo em lago/interior ou sem conexão com mar navegável.' : 'Alvo não costeiro.';
}
export const getCoastalProvinces = (provinces: readonly Province[]): Province[] => provinces.filter(isCoastalProvince);
export const edgeKey = (a: string, b: string): string => a < b ? `${a}|${b}` : `${b}|${a}`;
export const seaEdgeByPair = new Map(seaEdges.map(e => [edgeKey(e.a, e.b), e]));
export function validateSeaGraph(nodes: readonly SeaNode[] = seaNodes, edges: readonly SeaEdge[] = seaEdges, ports: readonly NavalPort[] = navalPorts): string[] {
  const issues: string[] = [], index = new Map(nodes.map(n => [n.id, n]));
  if (index.size !== nodes.length) issues.push('Duplicate sea node IDs');
  const pairs = new Set<string>();
  for (const e of edges) {
    const key = edgeKey(e.a, e.b);
    if (pairs.has(key)) issues.push(`Duplicate edge ${key}`); pairs.add(key);
    if (!index.has(e.a) || !index.has(e.b) || e.a === e.b || !Number.isFinite(e.distance) || e.distance <= 0) issues.push(`Invalid edge ${key}`);
    if (!index.get(e.a)?.neighbors.includes(e.b) || !index.get(e.b)?.neighbors.includes(e.a)) issues.push(`Missing edge adjacency ${key}`);
  }
  for (const n of nodes) {
    if (![n.x,n.y].every(Number.isFinite) || n.x < 0 || n.x > 5040 || n.y < 0 || n.y > 2520) issues.push(`Invalid coordinates ${n.id}`);
    if (new Set(n.neighbors).size !== n.neighbors.length) issues.push(`Duplicate neighbors ${n.id}`);
    for (const id of n.neighbors) if (id === n.id || !index.get(id)?.neighbors.includes(n.id) || !pairs.has(edgeKey(n.id,id))) issues.push(`Invalid adjacency ${n.id}/${id}`);
  }
  const portIds = new Set<string>();
  for (const p of ports) {
    if (portIds.has(p.provinceId)) issues.push(`Duplicate port ${p.provinceId}`); portIds.add(p.provinceId);
    if (!index.has(p.seaNodeId) || !isCoastalProvince(p.provinceId) || p.level < 1 || ![p.x,p.y].every(Number.isFinite)) issues.push(`Invalid port ${p.provinceId}`);
  }
  if (nodes[0]) {
    const seen = new Set([nodes[0].id]), queue = [nodes[0].id];
    for (let i=0;i<queue.length;i++) for (const id of index.get(queue[i])?.neighbors ?? []) if (!seen.has(id)) { seen.add(id); queue.push(id); }
    if (seen.size !== nodes.length) issues.push('Disconnected ocean network');
  }
  return issues;
}
