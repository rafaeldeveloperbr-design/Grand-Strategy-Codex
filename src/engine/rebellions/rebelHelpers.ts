import { Army, Province } from '../../types';


export const REBEL_ACCUMULATION_RATE = 1000;
export const SEPARATIST_THRESHOLD = 5000;

export interface RebelProcessingResult {
  updatedArmies: Army[];
  updatedProvinces: Province[];
  notifications: string[];
  logs: string[];
}

export function isRebelArmy(army: Army): boolean {
  return army.owner.startsWith('rebel_');
}

export function getArmyTotalTroops(army: Army): number {
  return army.regiments.reduce((sum, r) => sum + Math.floor(r.strength), 0);
}

let rebelArmyIdCounter = 0;
export function generateRebelArmyId(): string {
  rebelArmyIdCounter++;
  return `rebel_army_${Date.now()}_${rebelArmyIdCounter}`;
}

/**
 * BFS apenas por território histórico (originalOwner)
 */
export function findSeparatistPath(
  startId: string,
  targetId: string,
  provinces: Province[],
  rebelOriginalOwner: string
): string[] {
  if (startId === targetId) return [];

  const visited = new Set<string>([startId]);
  const parent = new Map<string, string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) {
      const path: string[] = [];
      let node: string | undefined = targetId;
      while (node !== startId) {
        path.unshift(node!);
        node = parent.get(node!);
      }
      return path;
    }

    const currentProv = provinces.find(p => p.id === current);
    if (!currentProv) continue;

    for (const neighbor of currentProv.neighbors || []) {
      if (visited.has(neighbor)) continue;
      const neighborProv = provinces.find(p => p.id === neighbor);
      if (!neighborProv) continue;
      if (neighborProv.originalOwner !== rebelOriginalOwner) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  return [];
}

/**
 * BFS livre (usado APENAS para rebeldes perdidos voltarem para casa)
 */
export function findWayHomePath(
  startId: string,
  targetId: string,
  provinces: Province[]
): string[] {
  if (startId === targetId) return [];
  const visited = new Set<string>([startId]);
  const parent = new Map<string, string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === targetId) {
      const path: string[] = [];
      let node: string | undefined = targetId;
      while (node !== startId) {
        path.unshift(node!);
        node = parent.get(node!);
      }
      return path;
    }
    const currentProv = provinces.find(p => p.id === current);
    if (!currentProv) continue;
    for (const neighbor of currentProv.neighbors || []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  return [];
}

/**
 * Movimento separatista (ignora diplomacia padrao)
 */
export function moveSeparatistArmy(
  army: Army,
  targetId: string,
  provinces: Province[],
  allowHome = false
): Army | null {
  const currentProvince = provinces.find(p => p.id === army.location);
  if (!currentProvince) return null;
  if (!currentProvince.neighbors.includes(targetId)) return null;

  const targetProvince = provinces.find(p => p.id === targetId);
  if (!targetProvince) return null;

  if (!allowHome && targetProvince.owner === army.originalOwner) {
    console.log(`❌ moveSeparatistArmy: bloqueado (alvo ${targetProvince.name} pertence a ${targetProvince.owner}, que é o originalOwner ${army.originalOwner})`);
    return null;
  }

  return {
    ...army,
    destination: targetId,
    targetDestination: targetId,
    path: [targetId],
    movementProgress: 0,
  };
}