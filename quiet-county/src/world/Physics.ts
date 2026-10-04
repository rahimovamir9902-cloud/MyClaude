/**
 * Lightweight collision world for a mobile game: yaw-rotated boxes on a flat ground plane,
 * circle-vs-box character movement, and 3D raycasts for bullets, vision and the camera.
 * Static colliders live in a uniform grid so queries only touch nearby cells.
 */

export const CF = Object.freeze({
  Move: 1 << 0,
  Sight: 1 << 1,
  Bullet: 1 << 2,
  Camera: 1 << 3,
  Vault: 1 << 4,
  Door: 1 << 5,
  Boundary: 1 << 6,
  /** Muffles sound (walls, windows, closed doors). */
  Sound: 1 << 7,
  Solid: (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3),
});

export interface ColliderDef {
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  rot?: number;
  yMin?: number;
  yMax?: number;
  flags: number;
  tag?: string;
  ref?: unknown;
}

export class Collider {
  id = 0;
  cx = 0;
  cz = 0;
  hx = 0;
  hz = 0;
  rot = 0;
  cos = 1;
  sin = 0;
  yMin = 0;
  yMax = 3;
  flags = 0;
  enabled = true;
  tag = '';
  ref: unknown = null;
  minX = 0;
  minZ = 0;
  maxX = 0;
  maxZ = 0;
  stamp = 0;
  cells: number[] = [];

  configure(def: ColliderDef): this {
    this.cx = def.cx;
    this.cz = def.cz;
    this.hx = Math.max(0.001, def.hx);
    this.hz = Math.max(0.001, def.hz);
    this.rot = def.rot ?? 0;
    this.cos = Math.cos(this.rot);
    this.sin = Math.sin(this.rot);
    this.yMin = def.yMin ?? 0;
    this.yMax = def.yMax ?? 3;
    this.flags = def.flags;
    this.tag = def.tag ?? '';
    this.ref = def.ref ?? null;
    const ex = Math.abs(this.cos) * this.hx + Math.abs(this.sin) * this.hz;
    const ez = Math.abs(this.sin) * this.hx + Math.abs(this.cos) * this.hz;
    this.minX = this.cx - ex;
    this.maxX = this.cx + ex;
    this.minZ = this.cz - ez;
    this.maxZ = this.cz + ez;
    return this;
  }

  /** World XZ point to box-local coordinates. */
  toLocal(x: number, z: number, out: { x: number; z: number }): void {
    const dx = x - this.cx;
    const dz = z - this.cz;
    out.x = dx * this.cos - dz * this.sin;
    out.z = dx * this.sin + dz * this.cos;
  }

  /** Box-local direction to world XZ. */
  toWorldDir(lx: number, lz: number, out: { x: number; z: number }): void {
    out.x = lx * this.cos + lz * this.sin;
    out.z = -lx * this.sin + lz * this.cos;
  }

  containsPoint(x: number, z: number): boolean {
    const dx = x - this.cx;
    const dz = z - this.cz;
    const lx = dx * this.cos - dz * this.sin;
    const lz = dx * this.sin + dz * this.cos;
    return Math.abs(lx) <= this.hx && Math.abs(lz) <= this.hz;
  }
}

export interface RayHit {
  t: number;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  collider: Collider;
}

export interface CircleResult {
  x: number;
  z: number;
  hit: Collider | null;
}

const tmpLocal = { x: 0, z: 0 };
const tmpDir = { x: 0, z: 0 };

export class PhysicsWorld {
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: Collider[][];
  private readonly colliders: Collider[] = [];
  private nextId = 1;
  private stampCounter = 1;

  constructor(
    readonly minX: number,
    readonly minZ: number,
    readonly maxX: number,
    readonly maxZ: number,
    readonly cellSize = 8,
  ) {
    this.cols = Math.max(1, Math.ceil((maxX - minX) / cellSize));
    this.rows = Math.max(1, Math.ceil((maxZ - minZ) / cellSize));
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  get count(): number {
    return this.colliders.length;
  }

  all(): readonly Collider[] {
    return this.colliders;
  }

  add(def: ColliderDef): Collider {
    const c = new Collider().configure(def);
    c.id = this.nextId++;
    this.colliders.push(c);
    this.insert(c);
    return c;
  }

  remove(c: Collider): void {
    this.unlink(c);
    const i = this.colliders.indexOf(c);
    if (i >= 0) this.colliders.splice(i, 1);
  }

  /** Re-index after changing a collider's transform. */
  reconfigure(c: Collider, def: ColliderDef): void {
    this.unlink(c);
    const id = c.id;
    const enabled = c.enabled;
    c.configure(def);
    c.id = id;
    c.enabled = enabled;
    this.insert(c);
  }

  clear(): void {
    this.colliders.length = 0;
    for (const cell of this.cells) cell.length = 0;
  }

  private cellX(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.minX) / this.cellSize)));
  }

  private cellZ(z: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.minZ) / this.cellSize)));
  }

  private insert(c: Collider): void {
    c.cells.length = 0;
    const x0 = this.cellX(c.minX);
    const x1 = this.cellX(c.maxX);
    const z0 = this.cellZ(c.minZ);
    const z1 = this.cellZ(c.maxZ);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const key = iz * this.cols + ix;
        this.cells[key].push(c);
        c.cells.push(key);
      }
    }
  }

  private unlink(c: Collider): void {
    for (const key of c.cells) {
      const cell = this.cells[key];
      const i = cell.indexOf(c);
      if (i >= 0) cell.splice(i, 1);
    }
    c.cells.length = 0;
  }

  /** Colliders whose bounds touch the rectangle and match the mask. */
  queryRect(minX: number, minZ: number, maxX: number, maxZ: number, mask: number, out: Collider[], includeDisabled = false): Collider[] {
    out.length = 0;
    const stamp = ++this.stampCounter;
    const x0 = this.cellX(minX);
    const x1 = this.cellX(maxX);
    const z0 = this.cellZ(minZ);
    const z1 = this.cellZ(maxZ);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        for (const c of this.cells[iz * this.cols + ix]) {
          if (c.stamp === stamp) continue;
          c.stamp = stamp;
          if ((!c.enabled && !includeDisabled) || (c.flags & mask) === 0) continue;
          if (c.maxX < minX || c.minX > maxX || c.maxZ < minZ || c.minZ > maxZ) continue;
          out.push(c);
        }
      }
    }
    return out;
  }

  private readonly scratch: Collider[] = [];

  /** Colliders overlapping a circle (exact OBB test). */
  overlapCircle(x: number, z: number, r: number, mask: number, out: Collider[], includeDisabled = false): Collider[] {
    const candidates = this.queryRect(x - r, z - r, x + r, z + r, mask, this.scratch, includeDisabled);
    out.length = 0;
    for (const c of candidates) {
      if (circleBoxPenetration(c, x, z, r) !== null) out.push(c);
    }
    return out;
  }

  /** True if a circle at (x,z) overlaps any matching collider. */
  circleBlocked(x: number, z: number, r: number, mask: number, yLow = 0.25, yHigh = 1.8): boolean {
    const candidates = this.queryRect(x - r, z - r, x + r, z + r, mask, this.scratch);
    for (const c of candidates) {
      if (c.yMax <= yLow || c.yMin >= yHigh) continue;
      if (circleBoxPenetration(c, x, z, r) !== null) return true;
    }
    return false;
  }

  /**
   * Pushes a circle out of overlapping colliders (characters walking). Colliders entirely
   * below `yLow` (curbs) or above `yHigh` (canopies) are ignored.
   */
  resolveCircle(x: number, z: number, r: number, mask: number, out: CircleResult, yLow = 0.25, yHigh = 1.8): CircleResult {
    out.x = x;
    out.z = z;
    out.hit = null;
    for (let iter = 0; iter < 4; iter++) {
      const candidates = this.queryRect(out.x - r, out.z - r, out.x + r, out.z + r, mask, this.scratch);
      let moved = false;
      for (const c of candidates) {
        if (c.yMax <= yLow || c.yMin >= yHigh) continue;
        const push = circleBoxPenetration(c, out.x, out.z, r);
        if (!push) continue;
        out.x += push.x;
        out.z += push.z;
        out.hit = c;
        moved = true;
      }
      if (!moved) break;
    }
    return out;
  }

  /**
   * Raycast against matching colliders. Direction must be normalized.
   * Walks the grid cells along the ray (Amanatides-Woo) and stops at the nearest hit.
   */
  raycast(
    ox: number, oy: number, oz: number,
    dx: number, dy: number, dz: number,
    maxDist: number, mask: number, ignore: Collider | null = null,
  ): RayHit | null {
    const stamp = ++this.stampCounter;
    let best: RayHit | null = null;
    let bestT = maxDist;
    const cs = this.cellSize;
    let ix = this.cellX(ox);
    let iz = this.cellZ(oz);
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(cs / dx) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(cs / dz) : Infinity;
    let tMaxX = dx !== 0 ? (this.minX + (ix + (stepX > 0 ? 1 : 0)) * cs - ox) / dx : Infinity;
    let tMaxZ = dz !== 0 ? (this.minZ + (iz + (stepZ > 0 ? 1 : 0)) * cs - oz) / dz : Infinity;
    let tCell = 0;
    for (let guard = 0; guard < 4096; guard++) {
      for (const c of this.cells[iz * this.cols + ix]) {
        if (c.stamp === stamp) continue;
        c.stamp = stamp;
        if (!c.enabled || (c.flags & mask) === 0 || c === ignore) continue;
        const hit = rayBox(c, ox, oy, oz, dx, dy, dz, bestT);
        if (hit) {
          bestT = hit.t;
          best = hit;
        }
      }
      if (tMaxX < tMaxZ) {
        tCell = tMaxX;
        tMaxX += tDeltaX;
        ix += stepX;
      } else {
        tCell = tMaxZ;
        tMaxZ += tDeltaZ;
        iz += stepZ;
      }
      if (tCell > bestT || ix < 0 || iz < 0 || ix >= this.cols || iz >= this.rows) break;
    }
    return best;
  }

  /** True if nothing matching the mask blocks the straight line between two points. */
  lineClear(ax: number, ay: number, az: number, bx: number, by: number, bz: number, mask: number): boolean {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6) return true;
    return this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len, mask) === null;
  }
}

/** Penetration push vector for a circle against a box, or null when not overlapping. */
export function circleBoxPenetration(c: Collider, x: number, z: number, r: number): { x: number; z: number } | null {
  c.toLocal(x, z, tmpLocal);
  const lx = tmpLocal.x;
  const lz = tmpLocal.z;
  const qx = Math.max(-c.hx, Math.min(c.hx, lx));
  const qz = Math.max(-c.hz, Math.min(c.hz, lz));
  const ddx = lx - qx;
  const ddz = lz - qz;
  const d2 = ddx * ddx + ddz * ddz;
  if (d2 >= r * r) return null;
  let px: number;
  let pz: number;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    const k = (r - d) / d;
    px = ddx * k;
    pz = ddz * k;
  } else {
    // Center inside the box: push out along the axis of least penetration.
    const penX = c.hx - Math.abs(lx);
    const penZ = c.hz - Math.abs(lz);
    if (penX < penZ) {
      px = (lx >= 0 ? 1 : -1) * (penX + r);
      pz = 0;
    } else {
      px = 0;
      pz = (lz >= 0 ? 1 : -1) * (penZ + r);
    }
  }
  c.toWorldDir(px, pz, tmpDir);
  return { x: tmpDir.x, z: tmpDir.z };
}

/** Slab test of a ray against a yaw-rotated box. Allocation-free except for the hit. */
export function rayBox(
  c: Collider,
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  maxT: number,
): RayHit | null {
  const rx = ox - c.cx;
  const rz = oz - c.cz;
  const lox = rx * c.cos - rz * c.sin;
  const loz = rx * c.sin + rz * c.cos;
  const ldx = dx * c.cos - dz * c.sin;
  const ldz = dx * c.sin + dz * c.cos;
  slab.tMin = -Infinity;
  slab.tMax = Infinity;
  slab.axis = -1;
  slab.sign = 0;
  if (!slabAxis(0, lox, ldx, -c.hx, c.hx)) return null;
  if (!slabAxis(1, oy, dy, c.yMin, c.yMax)) return null;
  if (!slabAxis(2, loz, ldz, -c.hz, c.hz)) return null;
  if (slab.tMax < 0) return null;
  const t = slab.tMin >= 0 ? slab.tMin : 0;
  if (t > maxT) return null;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const sign = slab.sign;
  if (slab.axis === 1) ny = sign;
  else if (slab.axis === 0) {
    nx = sign * c.cos;
    nz = -sign * c.sin;
  } else if (slab.axis === 2) {
    nx = sign * c.sin;
    nz = sign * c.cos;
  }
  return { t, x: ox + dx * t, y: oy + dy * t, z: oz + dz * t, nx, ny, nz, collider: c };
}

const slab = { tMin: 0, tMax: 0, axis: -1, sign: 0 };

function slabAxis(axis: number, o: number, d: number, min: number, max: number): boolean {
  if (Math.abs(d) < 1e-9) return o >= min && o <= max;
  let t1 = (min - o) / d;
  let t2 = (max - o) / d;
  let s = -1;
  if (t1 > t2) {
    const tmp = t1;
    t1 = t2;
    t2 = tmp;
    s = 1;
  }
  if (t1 > slab.tMin) {
    slab.tMin = t1;
    slab.axis = axis;
    slab.sign = s;
  }
  if (t2 < slab.tMax) slab.tMax = t2;
  return slab.tMin <= slab.tMax;
}
