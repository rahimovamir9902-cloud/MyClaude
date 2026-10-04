import type { CampResource } from '../config/items';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, MissionStats, MissionSummary, ObjectiveStatus } from '../core/GameEvents';
import { createLogger } from '../core/Logger';
import type { ActionHandler, GameAction } from './Actions';
import { evaluateCondition, type Condition, type ConditionContext } from './Conditions';

const log = createLogger('MissionSystem');

export type ObjectiveKind = 'primary' | 'secondary' | 'optional' | 'extraction';

export interface MissionReward {
  id: CampResource | 'xp';
  label: string;
  amount: number;
}

export interface ObjectiveDef {
  id: string;
  text: string;
  kind: ObjectiveKind;
  /** If absent the objective is active from the start. */
  revealWhen?: Condition;
  completeWhen: Condition;
  failWhen?: Condition;
  marker?: { x: number; z: number; radius?: number };
  onComplete?: GameAction[];
  reward?: MissionReward[];
}

export interface MissionEventDef {
  id: string;
  when: Condition;
  actions: GameAction[];
}

export interface MissionDef {
  id: string;
  number: number;
  title: string;
  region: string;
  levelId: string;
  briefing: { speaker: string; lines: string[] };
  debriefing: string;
  startHour: number;
  objectives: ObjectiveDef[];
  events: MissionEventDef[];
  rewards: MissionReward[];
}

/** World queries the mission framework needs; implemented by the game layer. */
export interface MissionWorldQuery {
  getFlag(flag: string): number;
  countItem(itemId: string): number;
  isInZone(zoneId: string): boolean;
  npcState(npcId: string): string | null;
}

export interface MissionSaveState {
  missionId: string;
  objectives: Record<string, ObjectiveStatus>;
  firedEvents: string[];
  elapsed: number;
  stats: MissionStats;
}

export type MissionState = 'inactive' | 'active' | 'completed' | 'failed';

export interface ObjectiveView {
  id: string;
  text: string;
  kind: ObjectiveKind;
  status: ObjectiveStatus;
  marker?: { x: number; z: number; radius?: number };
}

const emptyStats = (): MissionStats => ({
  kills: 0,
  takedowns: 0,
  headshots: 0,
  shotsFired: 0,
  containersSearched: 0,
  timesDetected: 0,
  damageTaken: 0,
});

/**
 * Reusable, data-driven mission runtime: objectives with reveal/complete/fail conditions,
 * scripted events, extraction gating, completion/failure, stats and rewards.
 */
export class MissionSystem {
  private def: MissionDef | null = null;
  private readonly statuses = new Map<string, ObjectiveStatus>();
  private readonly fired = new Set<string>();
  private readonly killsByArchetype = new Map<string, number>();
  private stateValue: MissionState = 'inactive';
  private dirty = false;
  private evalTimer = 0;
  private silent = false;
  private readonly unsubscribers: (() => void)[] = [];
  private readonly ctx: ConditionContext;
  elapsed = 0;
  stats: MissionStats = emptyStats();

  constructor(
    private readonly bus: EventBus<GameEvents>,
    private readonly world: MissionWorldQuery,
    private readonly runAction: ActionHandler,
  ) {
    this.ctx = {
      getFlag: (f) => this.world.getFlag(f),
      countItem: (i) => this.world.countItem(i),
      isInZone: (z) => this.world.isInZone(z),
      npcState: (n) => this.world.npcState(n),
      objectiveStatus: (id) => this.statuses.get(id) ?? null,
      killCount: (archetype) =>
        archetype ? (this.killsByArchetype.get(archetype) ?? 0) : this.stats.kills,
    };
    const markDirty = () => {
      this.dirty = true;
    };
    this.unsubscribers.push(
      bus.on('flag:changed', markDirty),
      bus.on('inventory:changed', markDirty),
      bus.on('zone:entered', markDirty),
      bus.on('zone:exited', markDirty),
      bus.on('npc:changed', markDirty),
      bus.on('enemy:killed', (e) => {
        if (this.stateValue !== 'active') return;
        this.stats.kills++;
        if (e.takedown) this.stats.takedowns++;
        if (e.headshot) this.stats.headshots++;
        this.killsByArchetype.set(e.archetype, (this.killsByArchetype.get(e.archetype) ?? 0) + 1);
        this.dirty = true;
      }),
      bus.on('weapon:fired', () => {
        if (this.stateValue === 'active') this.stats.shotsFired++;
      }),
      bus.on('container:searched', () => {
        if (this.stateValue === 'active') this.stats.containersSearched++;
      }),
      bus.on('enemy:alerted', () => {
        if (this.stateValue === 'active') this.stats.timesDetected++;
      }),
      bus.on('player:damaged', (e) => {
        if (this.stateValue === 'active') this.stats.damageTaken += e.amount;
      }),
    );
  }

  get state(): MissionState {
    return this.stateValue;
  }

  get mission(): MissionDef | null {
    return this.def;
  }

  get conditionContext(): ConditionContext {
    return this.ctx;
  }

  start(def: MissionDef, saved?: MissionSaveState): void {
    this.def = def;
    this.statuses.clear();
    this.fired.clear();
    this.killsByArchetype.clear();
    this.stats = emptyStats();
    this.elapsed = 0;
    for (const o of def.objectives) this.statuses.set(o.id, 'hidden');

    if (saved && saved.missionId === def.id) {
      for (const [id, status] of Object.entries(saved.objectives)) {
        if (this.statuses.has(id)) this.statuses.set(id, status);
      }
      saved.firedEvents.forEach((id) => this.fired.add(id));
      this.elapsed = saved.elapsed;
      this.stats = { ...emptyStats(), ...saved.stats };
    }
    this.stateValue = 'active';
    log.info(`Mission started: ${def.id}${saved ? ' (restored)' : ''}`);
    this.bus.emit('mission:started', { missionId: def.id });
    // Initial reveal pass without "new objective" notifications.
    this.silent = true;
    this.evaluate();
    this.silent = false;
  }

  update(dt: number): void {
    if (this.stateValue !== 'active') return;
    this.elapsed += dt;
    this.evalTimer += dt;
    if (this.dirty || this.evalTimer >= 0.5) {
      this.evalTimer = 0;
      this.dirty = false;
      this.evaluate();
    }
  }

  /** Re-checks events and objectives until nothing changes. */
  evaluate(): void {
    if (!this.def || this.stateValue !== 'active') return;
    for (let pass = 0; pass < 8; pass++) {
      let changed = false;
      for (const ev of this.def.events) {
        if (this.fired.has(ev.id) || !evaluateCondition(ev.when, this.ctx)) continue;
        this.fired.add(ev.id);
        changed = true;
        log.info(`Mission event: ${ev.id}`);
        this.bus.emit('mission:eventTriggered', { missionId: this.def.id, eventId: ev.id });
        ev.actions.forEach((a) => this.safeRun(a));
        if (this.stateValue !== 'active') return;
      }
      for (const o of this.def.objectives) {
        const status = this.statuses.get(o.id)!;
        if (status === 'hidden') {
          if (!o.revealWhen || evaluateCondition(o.revealWhen, this.ctx)) {
            this.setStatus(o, 'active');
            changed = true;
          }
        } else if (status === 'active') {
          if (o.failWhen && evaluateCondition(o.failWhen, this.ctx)) {
            this.setStatus(o, 'failed');
            changed = true;
          } else if (evaluateCondition(o.completeWhen, this.ctx)) {
            this.setStatus(o, 'completed');
            o.onComplete?.forEach((a) => this.safeRun(a));
            changed = true;
            if (o.kind === 'extraction') {
              this.complete();
              return;
            }
          }
        }
      }
      if (!changed) return;
    }
    log.warn('Mission evaluation did not settle after 8 passes');
  }

  /** Forces an objective state (debug / scripted use). */
  forceObjective(objectiveId: string, status: ObjectiveStatus): void {
    const o = this.def?.objectives.find((x) => x.id === objectiveId);
    if (!o) return;
    this.setStatus(o, status);
    this.evaluate();
  }

  revealObjective(objectiveId: string): void {
    const o = this.def?.objectives.find((x) => x.id === objectiveId);
    if (o && this.statuses.get(o.id) === 'hidden') this.setStatus(o, 'active');
  }

  objectiveStatus(id: string): ObjectiveStatus | null {
    return this.statuses.get(id) ?? null;
  }

  isExtractionUnlocked(): boolean {
    const ex = this.def?.objectives.find((o) => o.kind === 'extraction');
    return !!ex && this.statuses.get(ex.id) === 'active';
  }

  objectives(): ObjectiveView[] {
    if (!this.def) return [];
    return this.def.objectives.map((o) => ({
      id: o.id,
      text: o.text,
      kind: o.kind,
      status: this.statuses.get(o.id) ?? 'hidden',
      marker: o.marker,
    }));
  }

  fail(reason: string): void {
    if (this.stateValue !== 'active' || !this.def) return;
    this.stateValue = 'failed';
    log.info(`Mission failed: ${reason}`);
    this.bus.emit('mission:failed', { missionId: this.def.id, reason });
  }

  serialize(): MissionSaveState | null {
    if (!this.def) return null;
    return {
      missionId: this.def.id,
      objectives: Object.fromEntries(this.statuses),
      firedEvents: Array.from(this.fired),
      elapsed: this.elapsed,
      stats: { ...this.stats },
    };
  }

  stop(): void {
    this.stateValue = 'inactive';
    this.def = null;
  }

  dispose(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers.length = 0;
  }

  private complete(): void {
    if (!this.def) return;
    // Anything still open at extraction is missed.
    for (const o of this.def.objectives) {
      if (this.statuses.get(o.id) === 'active') this.statuses.set(o.id, 'failed');
    }
    this.stateValue = 'completed';
    const rewards = [...this.def.rewards];
    for (const o of this.def.objectives) {
      if (this.statuses.get(o.id) === 'completed' && o.reward) rewards.push(...o.reward);
    }
    const summary: MissionSummary = {
      missionId: this.def.id,
      title: this.def.title,
      elapsedSeconds: Math.round(this.elapsed),
      objectives: this.def.objectives
        .filter((o) => this.statuses.get(o.id) !== 'hidden')
        .map((o) => ({ id: o.id, text: o.text, kind: o.kind, status: this.statuses.get(o.id)! })),
      rewards: rewards.map((r) => ({ id: r.id, label: r.label, amount: r.amount })),
      stats: { ...this.stats },
    };
    log.info(`Mission completed: ${this.def.id}`);
    this.bus.emit('mission:completed', { summary });
  }

  private setStatus(o: ObjectiveDef, status: ObjectiveStatus): void {
    if (!this.def) return;
    const previous = this.statuses.get(o.id);
    if (previous === status) return;
    this.statuses.set(o.id, status);
    this.bus.emit('mission:objectiveChanged', {
      missionId: this.def.id,
      objectiveId: o.id,
      status,
      text: o.text,
      kind: o.kind,
    });
    if (status === 'active' && o.kind === 'extraction') {
      this.bus.emit('mission:extractionUnlocked', { missionId: this.def.id });
    }
    if (!this.silent) {
      if (status === 'active') this.bus.emit('message', { text: `New objective: ${o.text}`, kind: 'objective' });
      if (status === 'completed') this.bus.emit('message', { text: `Completed: ${o.text}`, kind: 'objective' });
      if (status === 'failed') this.bus.emit('message', { text: `Failed: ${o.text}`, kind: 'warning' });
    }
  }

  private safeRun(action: GameAction): void {
    try {
      this.runAction(action);
    } catch (err) {
      log.error(`Action ${action.type} failed`, err);
    }
  }
}
