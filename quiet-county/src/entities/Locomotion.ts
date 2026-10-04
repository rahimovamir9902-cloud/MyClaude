import type { Vec2 } from '../core/math';
import type { NavGrid } from '../world/NavGrid';
import { CF, type CircleResult, type Collider, type PhysicsWorld } from '../world/Physics';

export type PathResult = 'ok' | 'failed' | 'busy';

/**
 * Caps A* searches per frame so a crowd re-pathing at once cannot cause a frame spike on
 * mobile. Agents that hit the budget keep steering directly and retry next frame.
 */
export class PathService {
  private used = 0;
  searchesThisFrame = 0;

  constructor(
    readonly nav: NavGrid,
    private readonly budgetPerFrame = 3,
  ) {}

  beginFrame(): void {
    this.searchesThisFrame = this.used;
    this.used = 0;
  }

  find(sx: number, sz: number, gx: number, gz: number, out: Vec2[]): PathResult {
    if (this.nav.lineWalkable(sx, sz, gx, gz)) {
      out.length = 0;
      out.push({ x: gx, z: gz });
      return 'ok';
    }
    if (this.used >= this.budgetPerFrame) return 'busy';
    this.used++;
    return this.nav.findPath(sx, sz, gx, gz, out) ? 'ok' : 'failed';
  }
}

export interface MovingAgent {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface LocomotionHost {
  physics: PhysicsWorld;
  paths: PathService;
}

/** Path following with re-planning, arrival, stuck detection and collision resolution. */
export class Locomotion {
  path: Vec2[] = [];
  index = 0;
  goal: Vec2 | null = null;
  reached = false;
  failed = false;
  /** Collider that blocked movement this frame (e.g. a closed door). */
  blockedBy: Collider | null = null;
  private repathTimer = 0;
  private stuckTimer = 0;
  private readonly resolved: CircleResult = { x: 0, z: 0, hit: null };

  constructor(readonly radius: number) {}

  reset(): void {
    this.path.length = 0;
    this.index = 0;
    this.goal = null;
    this.reached = false;
    this.failed = false;
    this.blockedBy = null;
    this.repathTimer = 0;
    this.stuckTimer = 0;
  }

  /**
   * Moves the agent toward (tx, tz). `repathInterval` controls how often a moving target is
   * re-planned. Separation is an extra velocity (crowd spacing).
   */
  moveTo(
    agent: MovingAgent, tx: number, tz: number, speed: number, dt: number, host: LocomotionHost,
    repathInterval: number, arriveRadius = 0.6, sepX = 0, sepZ = 0,
  ): void {
    this.repathTimer -= dt;
    const goalMoved = !this.goal || Math.abs(this.goal.x - tx) + Math.abs(this.goal.z - tz) > 1.2;
    if (goalMoved || this.repathTimer <= 0) this.plan(agent, tx, tz, host, repathInterval);

    let desiredX = 0;
    let desiredZ = 0;
    this.reached = false;
    if (this.path.length > 0) {
      let wp = this.path[this.index];
      let dx = wp.x - agent.x;
      let dz = wp.z - agent.z;
      let d = Math.hypot(dx, dz);
      while (d < 0.45 && this.index < this.path.length - 1) {
        this.index++;
        wp = this.path[this.index];
        dx = wp.x - agent.x;
        dz = wp.z - agent.z;
        d = Math.hypot(dx, dz);
      }
      const last = this.index === this.path.length - 1;
      if (last && d < arriveRadius) {
        this.reached = true;
      } else if (d > 1e-4) {
        const slow = last ? Math.min(1, d / 1.2) : 1;
        desiredX = (dx / d) * speed * Math.max(0.35, slow);
        desiredZ = (dz / d) * speed * Math.max(0.35, slow);
      }
    }
    desiredX += sepX;
    desiredZ += sepZ;
    const k = Math.min(1, 9 * dt);
    agent.vx += (desiredX - agent.vx) * k;
    agent.vz += (desiredZ - agent.vz) * k;
    this.integrate(agent, dt, host, speed);
  }

  /** Decelerate to a stop (still resolving collisions so agents never overlap walls). */
  halt(agent: MovingAgent, dt: number, host: LocomotionHost, sepX = 0, sepZ = 0): void {
    const k = Math.min(1, 10 * dt);
    agent.vx += (sepX - agent.vx) * k;
    agent.vz += (sepZ - agent.vz) * k;
    this.integrate(agent, dt, host, 0);
  }

  private integrate(agent: MovingAgent, dt: number, host: LocomotionHost, speed: number): void {
    const ox = agent.x;
    const oz = agent.z;
    host.physics.resolveCircle(agent.x + agent.vx * dt, agent.z + agent.vz * dt, this.radius, CF.Move, this.resolved);
    agent.x = this.resolved.x;
    agent.z = this.resolved.z;
    this.blockedBy = this.resolved.hit;
    const moved = Math.hypot(agent.x - ox, agent.z - oz);
    if (speed > 0.3 && !this.reached && moved < speed * dt * 0.2) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.5) {
        this.stuckTimer = 0;
        this.repathTimer = 0;
        if (this.path.length <= 1) this.failed = true;
      }
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - dt);
    }
  }

  private plan(agent: MovingAgent, tx: number, tz: number, host: LocomotionHost, interval: number): void {
    const res = host.paths.find(agent.x, agent.z, tx, tz, this.path);
    if (res === 'busy') {
      this.repathTimer = 0.05;
      if (this.path.length === 0) this.path.push({ x: tx, z: tz });
      return;
    }
    this.goal = { x: tx, z: tz };
    this.index = 0;
    this.repathTimer = interval;
    this.failed = res === 'failed';
    if (this.failed) this.path.length = 0;
  }
}
