import type { Vec2 } from '../core/math';
import { CF, type Collider, type PhysicsWorld } from './Physics';

const SQRT2 = Math.SQRT2;
const NEIGHBORS: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/** Binary min-heap over (node, priority) pairs using typed arrays. */
class NodeHeap {
  private nodes = new Int32Array(1024);
  private keys = new Float32Array(1024);
  size = 0;

  clear(): void {
    this.size = 0;
  }

  push(node: number, key: number): void {
    if (this.size >= this.nodes.length) {
      const n = new Int32Array(this.nodes.length * 2);
      n.set(this.nodes);
      this.nodes = n;
      const k = new Float32Array(this.keys.length * 2);
      k.set(this.keys);
      this.keys = k;
    }
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= key) break;
      this.nodes[i] = this.nodes[parent];
      this.keys[i] = this.keys[parent];
      i = parent;
    }
    this.nodes[i] = node;
    this.keys[i] = key;
  }

  pop(): number {
    const top = this.nodes[0];
    const lastNode = this.nodes[--this.size];
    const lastKey = this.keys[this.size];
    let i = 0;
    for (;;) {
      let child = i * 2 + 1;
      if (child >= this.size) break;
      if (child + 1 < this.size && this.keys[child + 1] < this.keys[child]) child++;
      if (this.keys[child] >= lastKey) break;
      this.nodes[i] = this.nodes[child];
      this.keys[i] = this.keys[child];
      i = child;
    }
    this.nodes[i] = lastNode;
    this.keys[i] = lastKey;
    return top;
  }
}

export interface NavStats {
  searches: number;
  expanded: number;
  failures: number;
}

/**
 * Uniform navigation grid baked from the physics world with obstacles inflated by the agent
 * radius. Doors stay walkable (with extra cost) so infected route through and bash them.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly walkable: Uint8Array;
  private readonly cost: Float32Array;
  private readonly g: Float32Array;
  private readonly parent: Int32Array;
  private readonly openGen: Uint32Array;
  private readonly closedGen: Uint32Array;
  private gen = 0;
  private readonly heap = new NodeHeap();
  readonly stats: NavStats = { searches: 0, expanded: 0, failures: 0 };

  constructor(
    readonly originX: number,
    readonly originZ: number,
    width: number,
    depth: number,
    readonly cellSize = 0.5,
  ) {
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(depth / cellSize);
    const n = this.cols * this.rows;
    this.walkable = new Uint8Array(n).fill(1);
    this.cost = new Float32Array(n).fill(1);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.openGen = new Uint32Array(n);
    this.closedGen = new Uint32Array(n);
  }

  get cellCount(): number {
    return this.cols * this.rows;
  }

  /** Marks cells blocked where an agent of `radius` would overlap a movement blocker. */
  bake(physics: PhysicsWorld, radius: number, blockMask = CF.Move, doorCost = 3): void {
    const hits: Collider[] = [];
    let blocked = 0;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        const x = this.originX + (c + 0.5) * this.cellSize;
        const z = this.originZ + (r + 0.5) * this.cellSize;
        physics.overlapCircle(x, z, radius, blockMask, hits, true);
        let isBlocked = false;
        let isDoor = false;
        for (const h of hits) {
          if (h.yMax <= 0.25 || h.yMin >= 1.8) continue;
          if (h.flags & CF.Door) isDoor = true;
          else isBlocked = true;
        }
        this.walkable[i] = isBlocked ? 0 : 1;
        this.cost[i] = isDoor && !isBlocked ? doorCost : 1;
        if (isBlocked) blocked++;
      }
    }
    void blocked;
  }

  setBlocked(x: number, z: number, blocked: boolean): void {
    const i = this.indexAt(x, z);
    if (i >= 0) this.walkable[i] = blocked ? 0 : 1;
  }

  indexAt(x: number, z: number): number {
    const c = Math.floor((x - this.originX) / this.cellSize);
    const r = Math.floor((z - this.originZ) / this.cellSize);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  cellCenter(index: number, out: Vec2 = { x: 0, z: 0 }): Vec2 {
    const c = index % this.cols;
    const r = (index - c) / this.cols;
    out.x = this.originX + (c + 0.5) * this.cellSize;
    out.z = this.originZ + (r + 0.5) * this.cellSize;
    return out;
  }

  isWalkableIndex(i: number): boolean {
    return i >= 0 && this.walkable[i] === 1;
  }

  isWalkable(x: number, z: number): boolean {
    return this.isWalkableIndex(this.indexAt(x, z));
  }

  /** Nearest walkable cell center within `maxRings` cells, searching outward in rings. */
  nearestWalkable(x: number, z: number, maxRings = 8): Vec2 | null {
    const i0 = this.indexAt(x, z);
    if (this.isWalkableIndex(i0)) return { x, z };
    const c0 = Math.floor((x - this.originX) / this.cellSize);
    const r0 = Math.floor((z - this.originZ) / this.cellSize);
    let best = -1;
    let bestD = Infinity;
    for (let ring = 1; ring <= maxRings; ring++) {
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const i = r * this.cols + c;
          if (this.walkable[i] !== 1) continue;
          const d = dr * dr + dc * dc;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      if (best >= 0) return this.cellCenter(best);
    }
    return null;
  }

  /**
   * A* (8-connected, no corner cutting, octile heuristic). On success fills `out` with a
   * smoothed list of waypoints ending at the goal and returns true.
   */
  findPath(sx: number, sz: number, gx: number, gz: number, out: Vec2[], maxExpanded = 9000): boolean {
    out.length = 0;
    this.stats.searches++;
    const startPos = this.nearestWalkable(sx, sz, 4);
    const goalPos = this.nearestWalkable(gx, gz, 6);
    if (!startPos || !goalPos) {
      this.stats.failures++;
      return false;
    }
    const start = this.indexAt(startPos.x, startPos.z);
    const goal = this.indexAt(goalPos.x, goalPos.z);
    if (start === goal) {
      out.push({ x: goalPos.x, z: goalPos.z });
      return true;
    }

    if (++this.gen >= 0xffffffff) {
      this.openGen.fill(0);
      this.closedGen.fill(0);
      this.gen = 1;
    }
    const gen = this.gen;
    const cols = this.cols;
    const goalC = goal % cols;
    const goalR = (goal - goalC) / cols;
    const heuristic = (i: number) => {
      const c = i % cols;
      const r = (i - c) / cols;
      const dx = Math.abs(c - goalC);
      const dz = Math.abs(r - goalR);
      return dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
    };

    this.heap.clear();
    this.g[start] = 0;
    this.parent[start] = -1;
    this.openGen[start] = gen;
    this.heap.push(start, heuristic(start));
    let expanded = 0;
    let found = false;

    while (this.heap.size > 0) {
      const cur = this.heap.pop();
      if (this.closedGen[cur] === gen) continue;
      this.closedGen[cur] = gen;
      if (cur === goal) {
        found = true;
        break;
      }
      if (++expanded > maxExpanded) break;
      const cc = cur % cols;
      const cr = (cur - cc) / cols;
      for (const [dc, dr, stepCost] of NEIGHBORS) {
        const nc = cc + dc;
        const nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
        const n = nr * cols + nc;
        if (this.walkable[n] !== 1 || this.closedGen[n] === gen) continue;
        if (dc !== 0 && dr !== 0) {
          // No cutting corners past blocked cells.
          if (this.walkable[cr * cols + nc] !== 1 || this.walkable[nr * cols + cc] !== 1) continue;
        }
        const ng = this.g[cur] + stepCost * this.cost[n];
        if (this.openGen[n] !== gen || ng < this.g[n]) {
          this.openGen[n] = gen;
          this.g[n] = ng;
          this.parent[n] = cur;
          this.heap.push(n, ng + heuristic(n));
        }
      }
    }
    this.stats.expanded += expanded;
    if (!found) {
      this.stats.failures++;
      return false;
    }

    const cellsPath: number[] = [];
    for (let i = goal; i !== -1; i = this.parent[i]) cellsPath.push(i);
    cellsPath.reverse();
    const raw: Vec2[] = cellsPath.map((i) => this.cellCenter(i));
    raw[0] = { x: startPos.x, z: startPos.z };
    raw[raw.length - 1] = { x: goalPos.x, z: goalPos.z };
    this.smooth(raw, out);
    return true;
  }

  /** String-pulling: keep only waypoints needed to stay on walkable cells. */
  smooth(path: Vec2[], out: Vec2[]): void {
    out.length = 0;
    if (path.length === 0) return;
    let anchor = 0;
    while (anchor < path.length - 1) {
      // Forward scan: extend while the straight line stays walkable.
      let furthest = anchor + 1;
      for (let j = anchor + 2; j < path.length; j++) {
        if (!this.lineWalkable(path[anchor].x, path[anchor].z, path[j].x, path[j].z)) break;
        furthest = j;
      }
      out.push(path[furthest]);
      anchor = furthest;
    }
  }

  /** True if every cell the segment passes through is walkable. */
  lineWalkable(ax: number, az: number, bx: number, bz: number): boolean {
    const cs = this.cellSize;
    let c = Math.floor((ax - this.originX) / cs);
    let r = Math.floor((az - this.originZ) / cs);
    const ce = Math.floor((bx - this.originX) / cs);
    const re = Math.floor((bz - this.originZ) / cs);
    const dx = bx - ax;
    const dz = bz - az;
    const stepC = dx > 0 ? 1 : -1;
    const stepR = dz > 0 ? 1 : -1;
    const tDeltaC = dx !== 0 ? Math.abs(cs / dx) : Infinity;
    const tDeltaR = dz !== 0 ? Math.abs(cs / dz) : Infinity;
    let tMaxC = dx !== 0 ? (this.originX + (c + (stepC > 0 ? 1 : 0)) * cs - ax) / dx : Infinity;
    let tMaxR = dz !== 0 ? (this.originZ + (r + (stepR > 0 ? 1 : 0)) * cs - az) / dz : Infinity;
    const maxSteps = Math.abs(ce - c) + Math.abs(re - r) + 2;
    for (let s = 0; s <= maxSteps; s++) {
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
      if (this.walkable[r * this.cols + c] !== 1) return false;
      if (c === ce && r === re) return true;
      if (Math.abs(tMaxC - tMaxR) < 1e-9) {
        // Passing exactly through a corner: both neighbors must be open.
        if (!this.isWalkableIndex(r * this.cols + c + stepC) || !this.isWalkableIndex((r + stepR) * this.cols + c)) return false;
        c += stepC;
        r += stepR;
        tMaxC += tDeltaC;
        tMaxR += tDeltaR;
      } else if (tMaxC < tMaxR) {
        c += stepC;
        tMaxC += tDeltaC;
      } else {
        r += stepR;
        tMaxR += tDeltaR;
      }
    }
    return true;
  }

  /** Walkability snapshot for the minimap / debug view. */
  walkableData(): Readonly<Uint8Array> {
    return this.walkable;
  }
}
