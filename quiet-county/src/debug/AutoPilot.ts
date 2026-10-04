import { createLogger } from '../core/Logger';
import { dist2D, wrapAngle, yawFromDir, type Vec2 } from '../core/math';
import type { Game } from '../game/Game';
import { CF } from '../world/Physics';

const log = createLogger('AutoPilot');

export type BotTask =
  | { kind: 'goto'; label: string; x: number; z: number; tol?: number }
  | { kind: 'interact'; label: string; verbs: string[]; timeout?: number }
  | { kind: 'wait'; label: string; seconds: number };

/** The QA bot's route through Mission 01 (all objectives, including secondaries). */
export const M01_ROUTE: BotTask[] = [
  { kind: 'goto', label: 'Walk to the service stop', x: -3, z: -16.3 },
  { kind: 'goto', label: 'Enter the store', x: 3.5, z: -16.3 },
  { kind: 'goto', label: 'Approach the cooler', x: 3.6, z: -20.1, tol: 0.35 },
  { kind: 'interact', label: 'Knock on the cooler', verbs: ['KNOCK', 'TALK'] },
  { kind: 'wait', label: 'Let Ines come out', seconds: 1 },
  { kind: 'goto', label: 'Go to the staff door', x: 11.6, z: -14.4, tol: 0.6 },
  { kind: 'goto', label: 'Reach the office door', x: 15.6, z: -16.2, tol: 0.4 },
  { kind: 'interact', label: 'Pry the office door', verbs: ['PRY', 'OPEN'] },
  { kind: 'goto', label: 'Walk to the desk', x: 15.1, z: -22.8, tol: 0.35 },
  { kind: 'interact', label: 'Take the clinic case', verbs: ['TAKE'] },
  { kind: 'goto', label: 'Walk to the back door', x: 16.1, z: -25.1, tol: 0.4 },
  { kind: 'interact', label: 'Unbar the back door', verbs: ['UNBAR', 'OPEN'] },
  { kind: 'goto', label: 'Go to the garage side door', x: 33.6, z: -28.6, tol: 0.6 },
  { kind: 'goto', label: "Reach Walt's locker", x: 36.4, z: -33.0, tol: 0.5 },
  { kind: 'interact', label: "Search Walt's locker", verbs: ['SEARCH', 'LOOT'] },
  { kind: 'goto', label: 'Find the fuel can', x: 24.9, z: -40.0, tol: 0.5 },
  { kind: 'interact', label: 'Take the fuel can', verbs: ['TAKE'] },
  { kind: 'goto', label: 'Head to the overpass', x: -31, z: -59.5, tol: 1.2 },
  { kind: 'interact', label: 'Leave with Teo', verbs: ['LEAVE'] },
];

/**
 * Plays the game through the same input and UI paths as a human: it steers the camera and
 * joystick along nav-mesh paths, opens doors it walks into, fights back at close range,
 * holds the interact button, and clicks dialogue/loot buttons in the DOM.
 */
export class AutoPilot {
  running = false;
  index = 0;
  readonly history: string[] = [];
  status = 'idle';
  private path: Vec2[] = [];
  private pathIndex = 0;
  private repath = 0;
  private stuck = 0;
  private lastPos = { x: 0, z: 0 };
  private taskTime = 0;
  private holding = false;
  private uiCooldown = 0;
  private interactDone = false;
  private offBus: (() => void) | null = null;
  private readonly ignored = new Map<string, number>();
  private defendTarget: { id: string; time: number } | null = null;

  constructor(
    private readonly game: Game,
    private tasks: BotTask[] = M01_ROUTE,
  ) {}

  start(tasks?: BotTask[]): void {
    if (tasks) this.tasks = tasks;
    this.running = true;
    this.index = 0;
    this.taskTime = 0;
    this.path = [];
    this.offBus?.();
    this.offBus = this.game.bus.on('interaction:completed', () => {
      this.interactDone = true;
    });
    this.note(`Started (${this.tasks.length} tasks)`);
  }

  stop(): void {
    this.running = false;
    this.game.input.setMove('bot', 0, 0);
    this.game.input.release('interact');
    this.game.input.release('fire');
    this.offBus?.();
    this.offBus = null;
    this.status = 'stopped';
  }

  get done(): boolean {
    return this.index >= this.tasks.length;
  }

  private note(msg: string): void {
    this.history.push(msg);
    log.info(msg);
  }

  /** Called every frame before the session update. */
  update(dt: number): void {
    if (!this.running) return;
    const g = this.game;
    this.uiCooldown -= dt;
    if (g.state === 'overlay') {
      this.handleOverlay();
      return;
    }
    const s = g.session;
    if (!s || g.state !== 'playing' || !s.player.alive) return;
    if (this.done) {
      g.input.setMove('bot', 0, 0);
      this.status = 'route complete';
      return;
    }
    this.taskTime += dt;
    const task = this.tasks[this.index];
    this.status = `${this.index + 1}/${this.tasks.length} ${task.label}`;

    if (this.defend()) return;

    switch (task.kind) {
      case 'wait':
        g.input.setMove('bot', 0, 0);
        if (this.taskTime >= task.seconds) this.next();
        break;
      case 'goto':
        if (this.moveTo(task.x, task.z, task.tol ?? 0.8, dt)) this.next();
        else if (this.taskTime > 120) this.fail('goto timed out');
        break;
      case 'interact': {
        g.input.setMove('bot', 0, 0);
        const cur = s.interactions.current;
        if (this.interactDone) {
          this.interactDone = false;
          g.input.release('interact');
          this.holding = false;
          this.next();
          return;
        }
        // A door someone (or something) already opened counts as done.
        if (!this.holding && cur?.prompt.verb === 'CLOSE' && task.verbs.some((v) => v === 'OPEN' || v === 'PRY' || v === 'UNBAR')) {
          this.note(`${task.label}: already open`);
          this.next();
          return;
        }
        if (!this.holding && cur && task.verbs.includes(cur.prompt.verb) && cur.prompt.enabled) {
          g.input.press('interact', 'bot');
          this.holding = true;
        } else if (this.holding && !cur) {
          g.input.release('interact');
          this.holding = false;
        }
        if (this.taskTime > (task.timeout ?? 12)) this.fail(`no "${task.verbs.join('/')}" prompt (saw ${cur?.prompt.verb ?? 'none'})`);
        break;
      }
    }
  }

  private next(): void {
    const t = this.tasks[this.index];
    this.note(`Done: ${t.label} (${this.taskTime.toFixed(1)}s)`);
    this.index++;
    this.taskTime = 0;
    this.path = [];
    this.interactDone = false;
    this.game.input.release('interact');
    this.holding = false;
  }

  private fail(reason: string): void {
    const t = this.tasks[this.index];
    this.note(`FAILED: ${t.label} - ${reason}`);
    this.status = `failed: ${t.label} - ${reason}`;
    this.stop();
  }

  /** Swing at any infected hunting us at close range. */
  private defend(): boolean {
    const s = this.game.session!;
    const p = s.player;
    const now = performance.now();
    const threat = s.enemies.enemies.find(
      (e) =>
        e.alive && e.brain.isHostile && dist2D(e.x, e.z, p.x, p.z) < 2.2 && (this.ignored.get(e.id) ?? 0) < now &&
        s.level.physics.lineClear(p.x, 1.2, p.z, e.x, 1.2, e.z, CF.Move | CF.Sound),
    );
    if (!threat) {
      this.game.input.release('fire');
      this.defendTarget = null;
      return false;
    }
    // Never get stuck swinging at one target forever (e.g. it is wedged in a doorway).
    if (this.defendTarget?.id !== threat.id) this.defendTarget = { id: threat.id, time: 0 };
    this.defendTarget.time += 1 / 30;
    if (this.defendTarget.time > 6) {
      this.ignored.set(threat.id, now + 5000);
      this.defendTarget = null;
      return false;
    }
    s.camera.yaw = yawFromDir(threat.x - p.x, threat.z - p.z);
    s.camera.pitch = -0.15;
    this.game.input.setMove('bot', 0, 0);
    if (p.weapon?.isFirearm) {
      const melee = p.weaponSlots().find((i) => p.inventory.getSlot(i)?.itemId === 'w_crowbar');
      if (melee !== undefined) p.equip(melee);
    }
    this.game.input.press('fire', 'bot');
    this.game.input.release('fire');
    return true;
  }

  private moveTo(x: number, z: number, tol: number, dt: number): boolean {
    const s = this.game.session!;
    const p = s.player;
    if (dist2D(p.x, p.z, x, z) <= tol) {
      this.game.input.setMove('bot', 0, 0);
      return true;
    }
    this.repath -= dt;
    if (this.path.length === 0 || this.repath <= 0) {
      this.repath = 2.5;
      if (!s.level.nav.findPath(p.x, p.z, x, z, this.path)) this.path = [{ x, z }];
      this.pathIndex = 0;
    }
    let wp = this.path[Math.min(this.pathIndex, this.path.length - 1)];
    while (dist2D(p.x, p.z, wp.x, wp.z) < 0.5 && this.pathIndex < this.path.length - 1) {
      this.pathIndex++;
      wp = this.path[this.pathIndex];
    }
    const desired = yawFromDir(wp.x - p.x, wp.z - p.z);
    s.camera.yaw += wrapAngle(desired - s.camera.yaw) * Math.min(1, dt * 10);
    s.camera.pitch = -0.2;
    const remaining = dist2D(p.x, p.z, x, z);
    this.game.input.setMove('bot', 0, remaining < 2 ? 0.5 : 1);

    // Open doors we walk into.
    const cur = s.interactions.current;
    if (cur && cur.target.kind === 'object' && cur.target.obj.kind === 'door' && (cur.prompt.verb === 'OPEN' || cur.prompt.verb === 'UNBAR')) {
      const d = cur.target.obj;
      if (dist2D(p.x, p.z, d.x, d.z) < 2.0) this.game.input.press('interact', 'bot');
    } else if (!this.holding) {
      this.game.input.release('interact');
    }

    // Unstick: if not progressing, re-plan and sidestep.
    const moved = dist2D(p.x, p.z, this.lastPos.x, this.lastPos.z);
    this.lastPos = { x: p.x, z: p.z };
    this.stuck = moved < 0.01 ? this.stuck + dt : Math.max(0, this.stuck - dt);
    if (this.stuck > 1.2) {
      this.stuck = 0;
      this.repath = 0;
      this.game.input.setMove('bot', Math.random() > 0.5 ? 1 : -1, 0.3);
    }
    return false;
  }

  /** Drives the real UI: dialogue choices, loot, notes. */
  private handleOverlay(): void {
    if (this.uiCooldown > 0) return;
    this.uiCooldown = 0.35;
    const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
    const choices = Array.from(document.querySelectorAll('#dialogue [data-choice]')) as HTMLElement[];
    if (choices.length) {
      const prefs = ['Not bitten', '[Use bandage]', '[Use medkit]', 'Keep moving', 'Follow me'];
      for (const pref of prefs) {
        const c = choices.find((b) => b.textContent?.includes(pref));
        if (c) {
          this.note(`Dialogue: ${c.textContent}`);
          c.click();
          return;
        }
      }
      const cont = choices.find((b) => b.dataset.choice === 'continue') ?? choices[choices.length - 1];
      cont.click();
      return;
    }
    const takeAll = q('#btn-take-all');
    if (takeAll && document.querySelector('#loot [data-loot]')) {
      takeAll.click();
      return;
    }
    for (const sel of ['#btn-loot-close', '#btn-note-close', '#btn-inv-close', '#btn-map-close']) {
      const b = q(sel);
      if (b) {
        b.click();
        return;
      }
    }
  }
}
