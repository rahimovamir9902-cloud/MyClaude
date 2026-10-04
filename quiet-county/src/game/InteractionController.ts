import { getItem } from '../config/items';
import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { angleTo, dist2D } from '../core/math';
import type { Npc } from '../entities/Npc';
import type { Player, VaultOption } from '../entities/Player';
import type { InputState } from '../input/InputState';
import type { BuiltLevel } from '../world/LevelBuilder';
import { CF } from '../world/Physics';
import type { Door, ExtractionPoint, Interactable, LootContainer, NoteObject, Pickup, SavePoint } from '../world/WorldObjects';

export interface Prompt {
  verb: string;
  label: string;
  hold: number;
  enabled: boolean;
  reason?: string;
}

export interface InteractionHandler {
  searchContainer(c: LootContainer): void;
  useDoor(d: Door): void;
  talkThroughDoor(d: Door): void;
  collectPickup(p: Pickup): void;
  readNote(n: NoteObject): void;
  useSavePoint(s: SavePoint): void;
  talkTo(npc: Npc): void;
  extract(e: ExtractionPoint): void;
  onHoldStarted(target: Interactable | 'vault', prompt: Prompt): void;
  extractionUnlocked(): boolean;
  flag(name: string): number;
}

type Target = { kind: 'object'; obj: Interactable } | { kind: 'vault'; vault: VaultOption };

/**
 * Finds the best nearby interactable each frame, builds its contextual prompt, and runs
 * press or press-and-hold interactions (search, pry, unbar, take, read, talk, save, extract).
 */
export class InteractionController {
  current: { target: Target; prompt: Prompt } | null = null;
  holding = false;
  progress = 0;
  private scanTimer = 0;
  private holdTarget: Target | null = null;

  constructor(
    private readonly level: BuiltLevel,
    private readonly npcs: () => Iterable<Npc>,
    private readonly bus: EventBus<GameEvents>,
    private readonly handler: InteractionHandler,
  ) {}

  update(dt: number, input: InputState, player: Player): void {
    if (!player.alive || player.state !== 'normal') {
      this.cancel();
      this.current = null;
      return;
    }
    this.scanTimer -= dt;
    if (this.scanTimer <= 0 || this.holding) {
      this.scanTimer = 0.1;
      if (!this.holding) this.current = this.scan(player, input);
    }

    if (this.holding) {
      const same = this.current && this.holdTarget && sameTarget(this.current.target, this.holdTarget);
      if (!input.isHeld('interact') || !same || input.moveMagnitude > 0.35) {
        this.cancel();
        return;
      }
      this.progress += dt / Math.max(0.01, this.current!.prompt.hold);
      if (this.progress >= 1) {
        const t = this.current!.target;
        this.holding = false;
        this.progress = 0;
        this.perform(t, player);
      }
      return;
    }

    if (input.wasPressed('interact') && this.current) {
      const { target, prompt } = this.current;
      if (!prompt.enabled) {
        if (prompt.reason) this.bus.emit('message', { text: prompt.reason, kind: 'info', duration: 2.5 });
        return;
      }
      if (prompt.hold <= 0) {
        this.perform(target, player);
      } else {
        this.holding = true;
        this.progress = 0;
        this.holdTarget = target;
        this.handler.onHoldStarted(target.kind === 'vault' ? 'vault' : target.obj, prompt);
        this.bus.emit('interaction:started', { id: targetId(target), kind: targetKind(target) });
      }
    }
  }

  cancel(): void {
    if (this.holding && this.holdTarget) {
      this.bus.emit('interaction:cancelled', { id: targetId(this.holdTarget), kind: targetKind(this.holdTarget) });
    }
    this.holding = false;
    this.progress = 0;
    this.holdTarget = null;
  }

  private perform(t: Target, player: Player): void {
    if (t.kind === 'vault') {
      player.startVault(t.vault);
    } else {
      const o = t.obj;
      switch (o.kind) {
        case 'container':
          this.handler.searchContainer(o as LootContainer);
          break;
        case 'door': {
          const d = o as Door;
          if (d.locked && d.def.lock === 'scripted' && d.def.talkNpc) this.handler.talkThroughDoor(d);
          else this.handler.useDoor(d);
          break;
        }
        case 'pickup':
          this.handler.collectPickup(o as Pickup);
          break;
        case 'note':
          this.handler.readNote(o as NoteObject);
          break;
        case 'save':
          this.handler.useSavePoint(o as SavePoint);
          break;
        case 'npc':
          this.handler.talkTo(o as unknown as Npc);
          break;
        case 'extraction':
          this.handler.extract(o as ExtractionPoint);
          break;
      }
    }
    this.bus.emit('interaction:completed', { id: targetId(t), kind: targetKind(t) });
    this.scanTimer = 0;
  }

  private scan(player: Player, input: InputState): { target: Target; prompt: Prompt } | null {
    let best: { target: Target; prompt: Prompt; score: number } | null = null;
    const consider = (obj: Interactable) => {
      if (!obj.enabled) return;
      const d = dist2D(player.x, player.z, obj.x, obj.z);
      if (d > obj.radius) return;
      const ang = d < 0.5 ? 0 : angleTo(player.yaw, player.x, player.z, obj.x, obj.z);
      if (ang > 2.0) return;
      // Never interact through walls or closed doors.
      if (d > 0.6) {
        const len = d - 0.55;
        const dx = (obj.x - player.x) / d;
        const dz = (obj.z - player.z) / d;
        const hit = this.level.physics.raycast(player.x, 1.0, player.z, dx, 0, dz, len, CF.Sound);
        if (hit && hit.collider.ref !== obj) return;
      }
      const prompt = this.promptFor(obj, player);
      if (!prompt) return;
      // Quest pickups win ties so the objective item is never hidden behind a container.
      const questBonus = obj.kind === 'pickup' && getItem((obj as Pickup).def.itemId).quest ? -0.8 : 0;
      const score = d + ang * 0.9 + (prompt.enabled ? 0 : 0.6) + questBonus;
      if (!best || score < best.score) best = { target: { kind: 'object', obj }, prompt, score };
    };
    for (const c of this.level.containers.values()) consider(c);
    for (const d of this.level.doors.values()) consider(d);
    for (const p of this.level.pickups.values()) consider(p);
    for (const n of this.level.notes.values()) consider(n);
    for (const s of this.level.savePoints) consider(s);
    for (const n of this.npcs()) consider(n);
    consider(this.level.extraction);

    // Vaulting: offered for a low obstacle straight ahead (preferring the move direction).
    const mx = input.moveMagnitude > 0.2;
    const v = player.findVault(this.level.physics);
    if (v && (!best || (best as { score: number }).score > 0.9 || mx)) {
      return { target: { kind: 'vault', vault: v }, prompt: { verb: 'VAULT', label: 'Vault over', hold: 0, enabled: true } };
    }
    if (!best) return null;
    const b = best as { target: Target; prompt: Prompt };
    return { target: b.target, prompt: b.prompt };
  }

  private promptFor(obj: Interactable, player: Player): Prompt | null {
    switch (obj.kind) {
      case 'container': {
        const c = obj as LootContainer;
        if (c.searched && c.contents.length === 0) return { verb: 'EMPTY', label: `${c.spec.label.replace(/^Search /, '')} (empty)`, hold: 0, enabled: false, reason: 'Nothing left here.' };
        if (c.searched) return { verb: 'LOOT', label: c.spec.label.replace(/^Search/, 'Check').replace(/^Open/, 'Check'), hold: 0, enabled: true };
        return { verb: 'SEARCH', label: c.spec.label, hold: c.searchTime, enabled: true };
      }
      case 'door': {
        const d = obj as Door;
        const name = d.def.label;
        if (d.open) return { verb: 'CLOSE', label: `Close ${name.toLowerCase()}`, hold: 0, enabled: true };
        if (!d.locked) return { verb: 'OPEN', label: `Open ${name.toLowerCase()}`, hold: 0, enabled: true };
        switch (d.def.lock) {
          case 'pry': {
            const hasBar = player.inventory.has('w_crowbar');
            return hasBar
              ? { verb: 'PRY', label: `Pry open ${name.toLowerCase()} (loud)`, hold: 1.8, enabled: true }
              : { verb: 'LOCKED', label: name, hold: 0, enabled: false, reason: d.def.lockedText ?? 'Locked.' };
          }
          case 'barred':
            return d.isInsideSide(player.x, player.z)
              ? { verb: 'UNBAR', label: `Unbar ${name.toLowerCase()}`, hold: 1.0, enabled: true }
              : { verb: 'LOCKED', label: name, hold: 0, enabled: false, reason: d.def.lockedText ?? 'Barred.' };
          case 'scripted':
            if (d.def.unlockFlag && this.handler.flag(d.def.unlockFlag)) return { verb: 'OPEN', label: `Open ${name.toLowerCase()}`, hold: 0, enabled: true };
            if (d.def.talkNpc) return { verb: 'KNOCK', label: `Knock on the ${name.toLowerCase()}`, hold: 0, enabled: true };
            return { verb: 'LOCKED', label: name, hold: 0, enabled: false, reason: d.def.lockedText ?? 'It will not budge.' };
          default:
            return { verb: 'LOCKED', label: name, hold: 0, enabled: false, reason: d.def.lockedText ?? 'Locked.' };
        }
      }
      case 'pickup': {
        const p = obj as Pickup;
        const def = getItem(p.def.itemId);
        const qty = p.def.quantity > 1 ? ` x${p.def.quantity}` : '';
        return { verb: 'TAKE', label: `Take ${def.name}${qty}`, hold: def.quest ? 0.6 : 0.3, enabled: true };
      }
      case 'note':
        return { verb: 'READ', label: `Read: ${(obj as NoteObject).def.title}`, hold: 0, enabled: true };
      case 'save':
        return { verb: 'SAVE', label: `Rest and save - ${(obj as SavePoint).def.label}`, hold: 0.8, enabled: true };
      case 'npc': {
        const n = obj as unknown as Npc;
        if (n.state === 'hiding' || n.id === 'teo') return null;
        return { verb: 'TALK', label: `Talk to ${n.name}`, hold: 0, enabled: true };
      }
      case 'extraction': {
        const e = obj as ExtractionPoint;
        return this.handler.extractionUnlocked()
          ? { verb: 'LEAVE', label: `Leave with Teo (${e.label})`, hold: 1.5, enabled: true }
          : { verb: 'TALK', label: 'Talk to Teo', hold: 0, enabled: true };
      }
    }
  }
}

function targetId(t: Target): string {
  return t.kind === 'vault' ? 'vault' : t.obj.id;
}

function targetKind(t: Target): string {
  return t.kind === 'vault' ? 'vault' : t.obj.kind;
}

function sameTarget(a: Target, b: Target): boolean {
  if (a.kind === 'vault' && b.kind === 'vault') return true;
  return a.kind === 'object' && b.kind === 'object' && a.obj === b.obj;
}
