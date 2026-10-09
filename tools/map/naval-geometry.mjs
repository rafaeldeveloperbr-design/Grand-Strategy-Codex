// Offline geometry only. Runtime consumes the generated explicit graph.
export function ringsOf(path) {
  return path.split('M').slice(1).map(ring => ring.replaceAll('Z', '').trim().split(/\s*L\s*/).map(p => p.split(',').map(Number)));
}
export function geometryIndex(provinces) {
  const bins = new Map(), shapes = provinces.map(p => {
    const rings = ringsOf(p.path), points = rings.flat();
    return { id: p.id, rings, minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) };
  });
  for (const s of shapes) for (let x = Math.floor(s.minX / 100); x <= Math.floor(s.maxX / 100); x++) for (let y = Math.floor(s.minY / 100); y <= Math.floor(s.maxY / 100); y++) {
    const key = `${x},${y}`, list = bins.get(key) ?? []; list.push(s); bins.set(key, list);
  }
  function contains(s, x, y) {
    let inside = false;
    for (const ring of s.rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[j];
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    }
    return inside;
  }
  const land = (x, y) => (bins.get(`${Math.floor(x / 100)},${Math.floor(y / 100)}`) ?? []).some(s => contains(s, x, y));
  const cross = (a, b, c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function waterLine(a, b) {
    if (land(...a) || land(...b)) return false;
    const candidates = new Set();
    for (let x = Math.floor(Math.min(a[0], b[0]) / 100); x <= Math.floor(Math.max(a[0], b[0]) / 100); x++) for (let y = Math.floor(Math.min(a[1], b[1]) / 100); y <= Math.floor(Math.max(a[1], b[1]) / 100); y++) for (const s of bins.get(`${x},${y}`) ?? []) candidates.add(s);
    for (const s of candidates) for (const ring of s.rings) for (let i = 0; i < ring.length; i++) {
      const c = ring[i], d = ring[(i+1)%ring.length];
      if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.min(a[0], b[0]) > Math.max(c[0], d[0]) || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.min(a[1], b[1]) > Math.max(c[1], d[1])) continue;
      if (cross(a,b,c)*cross(a,b,d) <= 0 && cross(c,d,a)*cross(c,d,b) <= 0) return false;
    }
    return true;
  }
  return { shapes, land, waterLine };
}
