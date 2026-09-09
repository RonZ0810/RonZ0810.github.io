// Ground-plane navigation is independent of rendering and model load order.
export const EYE_HEIGHT = 1.65;
export const PLAYER_RADIUS = 0.25;
export const GRID_SIZE = 0.2;
export const WALK_SPEED = 1.5;
export const OFFICE_OBSTACLES = [
  { id: 'front-left', minX: -3.4, maxX: 0.75, minZ: 2.32, maxZ: 2.5 },
  { id: 'front-right', minX: 2.05, maxX: 3.4, minZ: 2.32, maxZ: 2.5 },
  { id: 'desk', minX: -1.81, maxX: 1.11, minZ: -1.02, maxZ: 0.22 },
  { id: 'chair', minX: -0.95, maxX: 0.15, minZ: 0.48, maxZ: 1.48 },
  { id: 'shelves', minX: -2.99, maxX: -1.31, minZ: -2.25, maxZ: -1.59 },
  { id: 'console', minX: 1.97, maxX: 3.33, minZ: -0.13, maxZ: 0.61 },
  { id: 'plant', minX: 2.19, maxX: 2.89, minZ: -2.01, maxZ: -1.31 },
  { id: 'open-door', minX: 2.03, maxX: 2.14, minZ: 2.52, maxZ: 3.64 },
];
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export class WalkMap {
  constructor(obstacles = OFFICE_OBSTACLES, radius = PLAYER_RADIUS) {
    this.radius = radius;
    this.obstacles = obstacles.map(o => ({ ...o, minX: o.minX - radius, maxX: o.maxX + radius, minZ: o.minZ - radius, maxZ: o.maxZ + radius }));
    this.nodes = new Map();
    for (let i = 0; i <= 31; i++) for (let j = 0; j <= 31; j++) {
      const point = { x: -3.1 + i * GRID_SIZE, z: -2.1 + j * GRID_SIZE, i, j, key: `${i},${j}` };
      if (this.isWalkable(point)) this.nodes.set(point.key, point);
    }
  }
  isWalkable({ x, z }) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < -3.35 + this.radius || x > 3.35 - this.radius || z < -2.35 + this.radius || z > 4.35 - this.radius) return false;
    return !this.obstacles.some(o => x > o.minX - 1e-6 && x < o.maxX + 1e-6 && z > o.minZ - 1e-6 && z < o.maxZ + 1e-6);
  }
  clearSegment(a, b) {
    const steps = Math.max(1, Math.ceil(distance(a, b) / 0.04));
    for (let i = 0; i <= steps; i++) if (!this.isWalkable({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps })) return false;
    return true;
  }
  slide(position, dx, dz) {
    const next = { ...position }, steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.06));
    for (let i = 0; i < steps; i++) {
      const x = { x: next.x + dx / steps, z: next.z };
      if (this.isWalkable(x)) next.x = x.x;
      const z = { x: next.x, z: next.z + dz / steps };
      if (this.isWalkable(z)) next.z = z.z;
    }
    return next;
  }
  nearestNode(point) {
    return [...this.nodes.values()].sort((a, b) => distance(a, point) - distance(b, point)).find(node => this.clearSegment(point, node));
  }
  path(start, goal) {
    if (!this.isWalkable(start) || !this.isWalkable(goal)) return null;
    if (this.clearSegment(start, goal)) return [{ ...goal }];
    const first = this.nearestNode(start), last = this.nearestNode(goal);
    if (!first || !last) return null;
    const open = new Set([first.key]), costs = new Map([[first.key, 0]]), previous = new Map();
    while (open.size) {
      const key = [...open].reduce((best, k) => costs.get(k) + distance(this.nodes.get(k), last) < costs.get(best) + distance(this.nodes.get(best), last) ? k : best);
      if (key === last.key) {
        const raw = [goal]; let cursor = key;
        while (cursor) { raw.unshift(this.nodes.get(cursor)); cursor = previous.get(cursor); }
        raw.unshift(start);
        const result = []; let index = 0;
        while (index < raw.length - 1) {
          let farthest = raw.length - 1;
          while (farthest > index + 1 && !this.clearSegment(raw[index], raw[farthest])) farthest--;
          result.push({ x: raw[farthest].x, z: raw[farthest].z }); index = farthest;
        }
        return result;
      }
      open.delete(key); const node = this.nodes.get(key);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const neighbor = this.nodes.get(`${node.i + di},${node.j + dj}`);
        if (!neighbor || !this.clearSegment(node, neighbor)) continue;
        const cost = costs.get(key) + distance(node, neighbor);
        if (cost < (costs.get(neighbor.key) ?? Infinity)) { costs.set(neighbor.key, cost); previous.set(neighbor.key, key); open.add(neighbor.key); }
      }
    }
    return null;
  }
}
