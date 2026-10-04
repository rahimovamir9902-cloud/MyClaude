import type { EnemyArchetype } from '../../config/enemies';
import type { NoiseEvent } from '../../core/GameEvents';
import { clamp01, dist2D, lerp } from '../../core/math';
import type { Random } from '../../core/Random';
import { StateMachine, type State } from '../../core/StateMachine';

export type EnemyStateId =
  | 'dormant'
  | 'idle'
  | 'wander'
  | 'investigate'
  | 'chase'
  | 'attack'
  | 'search'
  | 'loseTarget'
  | 'returnToPatrol'
  | 'stagger'
  | 'dead';

export type EnemyAnim = 'idle' | 'walk' | 'run' | 'attack' | 'stagger' | 'dead' | 'dormant' | 'look';
export type EnemyVocal = 'none' | 'groan' | 'alert' | 'search' | 'attack';

/** What the body perceived this tick. Computed by the entity (raycasts, distances). */
export interface EnemySenses {
  selfX: number;
  selfZ: number;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  playerAlive: boolean;
  /** 0 when not visible, otherwise 0..1 (stance, light, distance already applied). */
  playerVisibility: number;
  /** Player close enough to be sensed from any angle (with line of sight). */
  playerSensedClose: boolean;
  /** Locomotion arrived at the current move target. */
  reachedTarget: boolean;
  /** Locomotion could not find a route to the current target. */
  pathFailed: boolean;
  isNight: boolean;
}

/** What the brain wants the body to do this tick. */
export interface EnemyIntent {
  move: boolean;
  targetX: number;
  targetZ: number;
  speed: number;
  look: boolean;
  lookX: number;
  lookZ: number;
  /** Deliver the attack hit this tick (end of wind-up). */
  strike: boolean;
  vocal: EnemyVocal;
  anim: EnemyAnim;
}

interface Stimulus {
  x: number;
  z: number;
  priority: number;
  urgency: number;
  fromPlayer: boolean;
}

export interface EnemyBrainOptions {
  dormant?: boolean;
  wanderRadius?: number;
  /** Optional patrol route; wander picks the next point instead of random spots. */
  patrol?: { x: number; z: number }[];
}

const CHASE_START: ReadonlySet<EnemyStateId> = new Set(['idle', 'wander', 'investigate', 'search', 'loseTarget', 'returnToPatrol', 'dormant']);

/**
 * Infected decision making. Pure logic over {@link EnemySenses} -> {@link EnemyIntent} so it
 * can be unit-tested without rendering, physics or pathfinding.
 *
 * States: dormant, idle, wander, investigate (sound), chase (detected), attack, loseTarget,
 * search, returnToPatrol, stagger (hit reaction), dead.
 */
export class EnemyBrain {
  readonly fsm: StateMachine<EnemyBrain, EnemyStateId>;
  awareness = 0;
  lastKnown: { x: number; z: number } | null = null;
  timeSinceSeen = Infinity;
  home: { x: number; z: number };

  senses!: EnemySenses;
  readonly intent: EnemyIntent = {
    move: false, targetX: 0, targetZ: 0, speed: 0,
    look: false, lookX: 0, lookZ: 0, strike: false, vocal: 'none', anim: 'idle',
  };

  private stimulus: Stimulus | null = null;
  private pendingStagger = false;
  private moveTarget = { x: 0, z: 0 };
  private timer = 0;
  private struck = false;
  private currentPriority = 0;
  private investigateSpeed = 1;
  private patrolIndex = 0;
  private searchCenter = { x: 0, z: 0 };
  private searchPause = 0;
  private groanTimer: number;
  /** Seconds of stagger immunity left (prevents melee stun-locking). */
  private staggerImmunity = 0;

  constructor(
    readonly archetype: EnemyArchetype,
    home: { x: number; z: number },
    private readonly rng: Random,
    private readonly options: EnemyBrainOptions = {},
    private readonly onStateChange?: (from: EnemyStateId, to: EnemyStateId) => void,
  ) {
    this.home = { ...home };
    this.groanTimer = rng.range(3, 9);
    this.fsm = new StateMachine<EnemyBrain, EnemyStateId>(
      this,
      buildStates(),
      options.dormant ? 'dormant' : 'idle',
      (from, to) => this.onStateChange?.(from, to),
    );
  }

  get state(): EnemyStateId {
    return this.fsm.current;
  }

  get isDead(): boolean {
    return this.fsm.current === 'dead';
  }

  /** Aware and hunting the player (used for HUD threat and "safe to save" checks). */
  get isHostile(): boolean {
    const s = this.fsm.current;
    return s === 'chase' || s === 'attack' || s === 'stagger';
  }

  get canBeTakenDown(): boolean {
    return this.archetype.takedownable && !this.isHostile && !this.isDead;
  }

  hearNoise(e: NoiseEvent, perceived: number): void {
    if (this.isDead) return;
    const urgency = clamp01(perceived * 0.7 + e.priority / 12);
    if (e.fromPlayer && perceived > 0.55 && (e.kind === 'gunshot' || e.kind === 'melee')) {
      this.awareness = Math.min(0.95, this.awareness + 0.35);
    }
    if (!this.stimulus || e.priority >= this.stimulus.priority) {
      this.stimulus = { x: e.x, z: e.z, priority: e.priority, urgency, fromPlayer: e.fromPlayer };
    }
  }

  /** Another infected spotted the player nearby (group behavior). */
  alertTo(x: number, z: number): void {
    if (this.isDead) return;
    if (!this.stimulus || this.stimulus.priority <= 6) {
      this.stimulus = { x, z, priority: 6, urgency: 0.9, fromPlayer: true };
    }
    this.awareness = Math.max(this.awareness, 0.6);
  }

  /** Damage reveals the attacker and may interrupt with a stagger. */
  applyHit(damage: number, fromX: number, fromZ: number, staggerPower: number): void {
    if (this.isDead) return;
    this.awareness = 1;
    this.lastKnown = { x: fromX, z: fromZ };
    this.timeSinceSeen = 0;
    const staggers = damage >= this.archetype.staggerThreshold || staggerPower >= 1;
    if (staggers && this.staggerImmunity <= 0) this.pendingStagger = true;
    else if (CHASE_START.has(this.fsm.current)) this.fsm.change('chase');
  }

  kill(): void {
    if (!this.isDead) this.fsm.change('dead');
  }

  think(senses: EnemySenses, dt: number): EnemyIntent {
    this.senses = senses;
    const it = this.intent;
    it.move = false;
    it.look = false;
    it.strike = false;
    it.vocal = 'none';
    it.anim = 'idle';
    if (this.isDead) {
      it.anim = 'dead';
      return it;
    }
    this.updateAwareness(dt);
    if (this.staggerImmunity > 0) this.staggerImmunity -= dt;
    if (this.pendingStagger) {
      this.pendingStagger = false;
      this.fsm.change('stagger');
      // Re-enter so the timer restarts on repeated hits.
      this.timer = this.archetype.staggerDuration;
    }
    const before = this.fsm.current;
    this.fsm.update(dt);
    // A freshly entered state acts on the same tick, so reactions are not a frame late.
    if (this.fsm.current !== before && !this.isDead) this.fsm.update(0);
    this.groanTimer -= dt;
    if (this.groanTimer <= 0) {
      this.groanTimer = this.rng.range(5, 12);
      if (it.vocal === 'none' && !this.archetype.quiet && this.fsm.current !== 'dormant') it.vocal = 'groan';
    }
    return it;
  }

  // ---- helpers used by states -------------------------------------------------------

  /** Player visible or sensed right now. */
  canSeePlayer(): boolean {
    const s = this.senses;
    return s.playerAlive && (s.playerVisibility > 0 || s.playerSensedClose);
  }

  distanceToPlayer(): number {
    const s = this.senses;
    return dist2D(s.selfX, s.selfZ, s.playerX, s.playerZ);
  }

  private updateAwareness(dt: number): void {
    const s = this.senses;
    const a = this.archetype;
    const dormantFactor = this.fsm.current === 'dormant' ? 0.35 : 1;
    let seen = false;
    if (s.playerAlive && s.playerVisibility > 0) {
      this.awareness += a.awarenessGain * s.playerVisibility * dt * dormantFactor;
      seen = true;
    }
    if (s.playerAlive && s.playerSensedClose) {
      this.awareness += 2.5 * dt * dormantFactor;
      seen = true;
    }
    if (seen) {
      this.lastKnown = { x: s.playerX, z: s.playerZ };
      this.timeSinceSeen = 0;
    } else {
      this.timeSinceSeen += dt;
      const st = this.fsm.current;
      if (st !== 'chase' && st !== 'attack' && st !== 'stagger') this.awareness -= a.awarenessDecay * dt;
    }
    this.awareness = clamp01(this.awareness);
  }

  /** Shared reactions for calm states. Returns a state to switch to, if any. */
  perceive(): EnemyStateId | null {
    if (!this.senses.playerAlive) {
      this.stimulus = null;
      return null;
    }
    if (this.awareness >= 1) return 'chase';
    if (this.stimulus) return 'investigate';
    if (this.awareness >= 0.45 && this.lastKnown && this.timeSinceSeen < 0.5) {
      this.stimulus = { x: this.lastKnown.x, z: this.lastKnown.z, priority: 2, urgency: 0.3, fromPlayer: true };
      return 'investigate';
    }
    return null;
  }

  moveTo(x: number, z: number, speed: number, anim: EnemyAnim): void {
    const it = this.intent;
    it.move = true;
    it.targetX = x;
    it.targetZ = z;
    it.speed = speed * (this.senses.isNight ? 1.12 : 1);
    it.anim = anim;
  }

  lookAt(x: number, z: number): void {
    this.intent.look = true;
    this.intent.lookX = x;
    this.intent.lookZ = z;
  }

  // ---- state bodies (kept here so states can use private fields) -----------------------

  enterIdle(): void {
    this.timer = this.rng.range(2, 6);
  }

  updateIdle(dt: number): EnemyStateId | void {
    const next = this.perceive();
    if (next) return next;
    this.intent.anim = 'idle';
    this.timer -= dt;
    if (this.timer <= 0) return 'wander';
  }

  enterWander(): void {
    const patrol = this.options.patrol;
    if (patrol && patrol.length > 0) {
      const p = patrol[this.patrolIndex % patrol.length];
      this.patrolIndex++;
      this.moveTarget = { ...p };
    } else {
      const r = (this.options.wanderRadius ?? this.archetype.wanderRadius) * Math.sqrt(this.rng.next());
      const a = this.rng.next() * Math.PI * 2;
      this.moveTarget = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
    }
  }

  updateWander(): EnemyStateId | void {
    const next = this.perceive();
    if (next) return next;
    if (this.senses.reachedTarget || this.senses.pathFailed || this.fsm.timeInState > 15) return 'idle';
    this.moveTo(this.moveTarget.x, this.moveTarget.z, this.archetype.walkSpeed, 'walk');
  }

  enterInvestigate(): void {
    this.consumeStimulus();
  }

  private consumeStimulus(): void {
    const s = this.stimulus;
    if (!s) return;
    this.stimulus = null;
    this.moveTarget = { x: s.x, z: s.z };
    this.currentPriority = s.priority;
    const a = this.archetype;
    this.investigateSpeed = lerp(a.walkSpeed * 1.1, a.chaseSpeed * 0.8, s.urgency);
  }

  updateInvestigate(): EnemyStateId | void {
    if (this.awareness >= 1 && this.senses.playerAlive) return 'chase';
    if (this.stimulus && this.stimulus.priority >= this.currentPriority) this.consumeStimulus();
    if (this.senses.reachedTarget || this.senses.pathFailed || this.fsm.timeInState > 25) {
      this.searchCenter = { ...this.moveTarget };
      return 'search';
    }
    this.moveTo(this.moveTarget.x, this.moveTarget.z, this.investigateSpeed, this.investigateSpeed > 1.6 ? 'run' : 'walk');
  }

  enterChase(): void {
    this.awareness = 1;
    this.intent.vocal = 'alert';
    this.stimulus = null;
  }

  updateChase(): EnemyStateId | void {
    const s = this.senses;
    if (!s.playerAlive) return 'returnToPatrol';
    const sees = this.canSeePlayer();
    if (sees) this.lastKnown = { x: s.playerX, z: s.playerZ };
    if (sees && this.distanceToPlayer() <= this.archetype.attackRange) return 'attack';
    if (this.timeSinceSeen > this.archetype.loseSightTime) return 'loseTarget';
    const target = this.lastKnown ?? { x: s.playerX, z: s.playerZ };
    if (!sees && dist2D(s.selfX, s.selfZ, target.x, target.z) < 1.0) return 'loseTarget';
    let tx = target.x;
    let tz = target.z;
    if (this.archetype.flanks && sees && this.distanceToPlayer() > 5) {
      // Circle around to approach from behind the player.
      tx = s.playerX + Math.sin(s.playerYaw) * 2.5;
      tz = s.playerZ + Math.cos(s.playerYaw) * 2.5;
    }
    // Close in with a lunge: up close they match a running player, so escaping costs sprint.
    const lunge = sees && this.distanceToPlayer() < 4 ? 1.3 : 1;
    this.moveTo(tx, tz, this.archetype.chaseSpeed * lunge, 'run');
    if (sees) this.lookAt(s.playerX, s.playerZ);
  }

  enterAttack(): void {
    this.struck = false;
    this.intent.vocal = 'attack';
  }

  updateAttack(): EnemyStateId | void {
    const s = this.senses;
    const a = this.archetype;
    this.intent.anim = 'attack';
    this.lookAt(s.playerX, s.playerZ);
    const t = this.fsm.timeInState;
    if (!this.struck && t >= a.attackWindup) {
      this.struck = true;
      if (s.playerAlive) this.intent.strike = true;
    }
    if (t >= Math.max(a.attackWindup + 0.3, a.attackCooldown)) {
      if (!s.playerAlive) return 'returnToPatrol';
      return 'chase';
    }
  }

  enterStagger(): void {
    this.timer = this.archetype.staggerDuration;
  }

  updateStagger(dt: number): EnemyStateId | void {
    this.intent.anim = 'stagger';
    this.timer -= dt;
    if (this.timer <= 0) {
      this.staggerImmunity = 1.6;
      return this.senses.playerAlive ? 'chase' : 'returnToPatrol';
    }
  }

  enterLoseTarget(): void {
    this.intent.vocal = 'search';
  }

  updateLoseTarget(): EnemyStateId | void {
    if (this.canSeePlayer()) {
      this.awareness = 1;
      return 'chase';
    }
    this.intent.anim = 'look';
    if (this.fsm.timeInState > 1.5) {
      this.searchCenter = this.lastKnown ? { ...this.lastKnown } : { x: this.senses.selfX, z: this.senses.selfZ };
      return 'search';
    }
  }

  enterSearch(): void {
    this.pickSearchPoint();
    this.searchPause = 0;
  }

  private pickSearchPoint(): void {
    const r = 1.5 + this.rng.next() * 4;
    const a = this.rng.next() * Math.PI * 2;
    this.moveTarget = { x: this.searchCenter.x + Math.cos(a) * r, z: this.searchCenter.z + Math.sin(a) * r };
  }

  updateSearch(dt: number): EnemyStateId | void {
    if (this.awareness >= 1 && this.senses.playerAlive) return 'chase';
    if (this.stimulus) return 'investigate';
    if (this.fsm.timeInState > this.archetype.searchDuration) return 'returnToPatrol';
    if (this.searchPause > 0) {
      this.searchPause -= dt;
      this.intent.anim = 'look';
      return;
    }
    if (this.senses.reachedTarget || this.senses.pathFailed) {
      this.searchPause = 0.8 + this.rng.next();
      this.pickSearchPoint();
      return;
    }
    this.moveTo(this.moveTarget.x, this.moveTarget.z, this.archetype.walkSpeed * 1.25, 'walk');
  }

  updateReturn(): EnemyStateId | void {
    const next = this.perceive();
    if (next) return next;
    const s = this.senses;
    if (dist2D(s.selfX, s.selfZ, this.home.x, this.home.z) < 1.2 || s.reachedTarget) return 'idle';
    if (s.pathFailed) {
      this.home = { x: s.selfX, z: s.selfZ };
      return 'idle';
    }
    this.moveTo(this.home.x, this.home.z, this.archetype.walkSpeed, 'walk');
  }

  updateDormant(): EnemyStateId | void {
    this.intent.anim = 'dormant';
    if (this.awareness >= 1 && this.senses.playerAlive) return 'chase';
    if (this.stimulus && this.stimulus.urgency > 0.25) return 'investigate';
    if (this.awareness >= 0.5 && this.lastKnown) {
      this.stimulus = { x: this.lastKnown.x, z: this.lastKnown.z, priority: 2, urgency: 0.4, fromPlayer: true };
      return 'investigate';
    }
    this.stimulus = null;
  }
}

function buildStates(): State<EnemyBrain, EnemyStateId>[] {
  return [
    { id: 'dormant', update: (b) => b.updateDormant() },
    { id: 'idle', enter: (b) => b.enterIdle(), update: (b, dt) => b.updateIdle(dt) },
    { id: 'wander', enter: (b) => b.enterWander(), update: (b) => b.updateWander() },
    { id: 'investigate', enter: (b) => b.enterInvestigate(), update: (b) => b.updateInvestigate() },
    { id: 'chase', enter: (b) => b.enterChase(), update: (b) => b.updateChase() },
    { id: 'attack', enter: (b) => b.enterAttack(), update: (b) => b.updateAttack() },
    { id: 'stagger', enter: (b) => b.enterStagger(), update: (b, dt) => b.updateStagger(dt) },
    { id: 'loseTarget', enter: (b) => b.enterLoseTarget(), update: (b) => b.updateLoseTarget() },
    { id: 'search', enter: (b) => b.enterSearch(), update: (b, dt) => b.updateSearch(dt) },
    { id: 'returnToPatrol', update: (b) => b.updateReturn() },
    { id: 'dead' },
  ];
}
