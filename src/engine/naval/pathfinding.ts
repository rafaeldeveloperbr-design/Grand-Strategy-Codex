import { edgeKey, seaEdgeByPair, seaNodeById } from './world';
let pathfindCalls = 0;
export const resetNavalPathfindCalls = (): void => { pathfindCalls = 0; };
export const getNavalPathfindCalls = (): number => pathfindCalls;
// Binary heap Dijkstra. Ties use explicit node IDs; no random or persistent cache.
export function findSeaRoute(start: string, destination: string): string[] | null {
  pathfindCalls++;
  if (!seaNodeById.has(start) || !seaNodeById.has(destination)) return null;
  if (start === destination) return [];
  const heap: { id: string; distance: number }[] = [], distances = new Map([[start,0]]), previous = new Map<string,string>();
  const less = (a: typeof heap[number], b: typeof heap[number]) => a.distance < b.distance || a.distance === b.distance && a.id < b.id;
  const push = (item: typeof heap[number]) => { heap.push(item); let i=heap.length-1; while(i>0) {const p=(i-1)>>1; if(!less(heap[i],heap[p])) break; [heap[i],heap[p]]=[heap[p],heap[i]]; i=p;} };
  const pop = () => {const top=heap[0], last=heap.pop()!; if(heap.length) {heap[0]=last; let i=0; for(;;) {let j=i, l=i*2+1,r=l+1; if(l<heap.length&&less(heap[l],heap[j])) j=l; if(r<heap.length&&less(heap[r],heap[j])) j=r; if(j===i) break; [heap[i],heap[j]]=[heap[j],heap[i]]; i=j;}} return top;};
  push({id:start,distance:0});
  while(heap.length) {
    const current=pop(); if(current.distance !== distances.get(current.id)) continue;
    if(current.id===destination) { const route: string[]=[]; let id=destination; while(id!==start) {route.push(id); id=previous.get(id)!;} return route.reverse(); }
    for(const next of seaNodeById.get(current.id)!.neighbors) {
      const distance=current.distance+seaEdgeByPair.get(edgeKey(current.id,next))!.distance;
      if(distance < (distances.get(next) ?? Infinity)) {distances.set(next,distance); previous.set(next,current.id); push({id:next,distance});}
    }
  }
  return null;
}
export function seaRouteDistance(start: string, route: readonly string[]): number {
  let total=0, prior=start;
  for(const id of route) {total+=seaEdgeByPair.get(edgeKey(prior,id))?.distance ?? Infinity; prior=id;} return total;
}
