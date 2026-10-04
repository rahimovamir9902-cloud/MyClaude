import { DEFAULT_TOUCH_LAYOUT, type TouchButtonId, type TouchButtonLayout } from '../config/controls';
import type { GameSettings } from '../config/settings';
import type { HudSnapshot } from '../game/GameSession';
import { el } from '../ui/dom';
import type { ActionId, InputState } from './InputState';

const LOOK_SCALE = 1.25;

interface Joystick {
  id: number;
  ox: number;
  oy: number;
}

/**
 * Mobile controls: a floating joystick on the left, drag-to-look anywhere on the right
 * (including while holding FIRE), and action buttons whose positions, size and opacity are
 * player-customizable (see the controls editor).
 */
export class TouchControls {
  readonly root: HTMLElement;
  private readonly buttons = new Map<TouchButtonId, HTMLElement>();
  private layout: TouchButtonLayout[] = DEFAULT_TOUCH_LAYOUT.map((b) => ({ ...b }));
  private joy: Joystick | null = null;
  private readonly joyBase: HTMLElement;
  private readonly joyKnob: HTMLElement;
  private readonly joyHint: HTMLElement;
  private readonly looks = new Map<number, { x: number; y: number }>();
  private readonly held = new Map<number, TouchButtonId>();
  private leftHanded = false;
  private editing: { onMove: () => void } | null = null;
  private drag: { id: number; button: TouchButtonId; startX: number; startY: number; right: number; bottom: number } | null = null;
  private lastLabels: Record<string, string> = {};

  constructor(parent: HTMLElement, private readonly input: InputState) {
    this.root = el('div', '', { id: 'touch' });
    this.joyHint = el('div', 'joy-hint');
    this.joyBase = el('div', 'joy-base hidden');
    this.joyKnob = el('div', 'joy-knob hidden');
    this.root.append(this.joyHint, this.joyBase, this.joyKnob);
    for (const b of this.layout) {
      const node = el('div', `tbtn ${b.id === 'fire' ? 'fire' : ''}`, { 'data-action': b.id }, b.label);
      this.buttons.set(b.id, node);
      this.root.append(node);
    }
    parent.append(this.root);
    this.applyLayout();
    this.root.addEventListener('pointerdown', this.onDown);
    this.root.addEventListener('pointermove', this.onMove);
    this.root.addEventListener('pointerup', this.onUp);
    this.root.addEventListener('pointercancel', this.onUp);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setVisible(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
    if (!v) this.reset();
  }

  applySettings(s: GameSettings): void {
    document.documentElement.style.setProperty('--btn-scale', String(s.buttonScale));
    document.documentElement.style.setProperty('--btn-opacity', String(s.buttonOpacity));
    this.leftHanded = s.leftHanded;
    this.layout = (s.touchLayout ?? DEFAULT_TOUCH_LAYOUT).map((b) => ({ ...b }));
    // Fill in buttons added after the player saved a custom layout.
    for (const d of DEFAULT_TOUCH_LAYOUT) if (!this.layout.some((b) => b.id === d.id)) this.layout.push({ ...d });
    this.applyLayout();
  }

  get currentLayout(): TouchButtonLayout[] {
    return this.layout.map((b) => ({ ...b }));
  }

  private applyLayout(): void {
    for (const b of this.layout) {
      const node = this.buttons.get(b.id);
      if (!node) continue;
      node.style.width = `${b.size}px`;
      node.style.height = `${b.size}px`;
      node.style.bottom = `calc(${b.bottom}% + var(--safe-b))`;
      if (this.leftHanded) {
        node.style.left = `calc(${b.right}% + var(--safe-l))`;
        node.style.right = '';
        node.style.transform = 'translate(-50%, 50%) scale(var(--btn-scale))';
      } else {
        node.style.right = `calc(${b.right}% + var(--safe-r))`;
        node.style.left = '';
        node.style.transform = 'translate(50%, 50%) scale(var(--btn-scale))';
      }
    }
    this.joyHint.style.left = this.leftHanded ? '' : `calc(9% + var(--safe-l))`;
    this.joyHint.style.right = this.leftHanded ? `calc(9% + var(--safe-r))` : '';
  }

  /** Context-sensitive labels and highlights from the HUD state. */
  update(h: HudSnapshot): void {
    const setLabel = (id: TouchButtonId, text: string) => {
      if (this.lastLabels[id] === text) return;
      this.lastLabels[id] = text;
      const n = this.buttons.get(id);
      if (n) n.textContent = text;
    };
    const interact = this.buttons.get('interact')!;
    setLabel('interact', h.prompt ? h.prompt.verb : 'USE');
    interact.classList.toggle('dim', !h.prompt);
    interact.classList.toggle('highlight', !!h.prompt && h.prompt.enabled);
    setLabel('melee', h.takedown ? 'TAKE\nDOWN' : 'MELEE');
    this.buttons.get('melee')!.classList.toggle('highlight', h.takedown);
    setLabel('fire', h.firearm ? 'FIRE' : 'SWING');
    this.buttons.get('aim')!.classList.toggle('dim', !h.firearm);
    this.buttons.get('reload')!.classList.toggle('dim', !h.firearm);
    this.buttons.get('crouch')!.classList.toggle('on', h.crouched);
    this.buttons.get('sprint')!.classList.toggle('on', h.sprinting);
    this.buttons.get('flashlight')!.classList.toggle('on', h.flashlightOn);
    setLabel('throw', `THROW\n${h.bottles}`);
    this.buttons.get('throw')!.classList.toggle('dim', h.bottles === 0);
  }

  private reset(): void {
    for (const id of this.held.values()) this.input.release(id as ActionId);
    this.held.clear();
    this.looks.clear();
    this.joy = null;
    this.input.setMove('touch', 0, 0);
    this.joyBase.classList.add('hidden');
    this.joyKnob.classList.add('hidden');
  }

  private readonly onDown = (e: PointerEvent): void => {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest('.tbtn') as HTMLElement | null;
    const w = window.innerWidth;
    const h = window.innerHeight;
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events may not support capture */
    }
    if (this.editing) {
      if (target) {
        const id = target.dataset.action as TouchButtonId;
        const b = this.layout.find((x) => x.id === id)!;
        this.drag = { id: e.pointerId, button: id, startX: e.clientX, startY: e.clientY, right: b.right, bottom: b.bottom };
      }
      return;
    }
    if (target) {
      const id = target.dataset.action as TouchButtonId;
      this.held.set(e.pointerId, id);
      this.input.press(id as ActionId, 'touch');
      target.classList.add('active');
      // FIRE doubles as a look pad so players can aim while shooting.
      if (id === 'fire' || id === 'aim') this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      return;
    }
    const inJoyZone = this.leftHanded ? e.clientX > w * 0.58 : e.clientX < w * 0.42;
    if (inJoyZone && e.clientY > h * 0.22 && !this.joy) {
      this.joy = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
      this.joyBase.style.left = `${e.clientX}px`;
      this.joyBase.style.top = `${e.clientY}px`;
      this.joyKnob.style.left = `${e.clientX}px`;
      this.joyKnob.style.top = `${e.clientY}px`;
      this.joyBase.classList.remove('hidden');
      this.joyKnob.classList.remove('hidden');
      this.joyHint.classList.add('hidden');
      return;
    }
    this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (this.drag && e.pointerId === this.drag.id) {
      const d = this.drag;
      const b = this.layout.find((x) => x.id === d.button)!;
      const dxPct = ((e.clientX - d.startX) / window.innerWidth) * 100;
      const dyPct = ((e.clientY - d.startY) / window.innerHeight) * 100;
      b.right = Math.min(96, Math.max(1, d.right + (this.leftHanded ? dxPct : -dxPct)));
      b.bottom = Math.min(94, Math.max(1, d.bottom - dyPct));
      this.applyLayout();
      this.editing?.onMove();
      return;
    }
    if (this.joy && e.pointerId === this.joy.id) {
      const scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--btn-scale')) || 1;
      const r = 56 * scale;
      let dx = (e.clientX - this.joy.ox) / r;
      let dy = (e.clientY - this.joy.oy) / r;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.joyKnob.style.left = `${this.joy.ox + dx * r}px`;
      this.joyKnob.style.top = `${this.joy.oy + dy * r}px`;
      const dead = 0.12;
      const m = Math.min(1, len);
      if (m < dead) this.input.setMove('touch', 0, 0);
      else {
        // Rescale magnitude past the dead zone while keeping direction.
        const k = (m - dead) / (1 - dead) / Math.max(Math.hypot(dx, dy), 1e-4);
        this.input.setMove('touch', dx * k, -dy * k);
      }
      return;
    }
    const last = this.looks.get(e.pointerId);
    if (last) {
      this.input.addLook((e.clientX - last.x) * LOOK_SCALE, (e.clientY - last.y) * LOOK_SCALE, 'touch');
      last.x = e.clientX;
      last.y = e.clientY;
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (this.drag && e.pointerId === this.drag.id) {
      this.drag = null;
      return;
    }
    const id = this.held.get(e.pointerId);
    if (id) {
      this.held.delete(e.pointerId);
      this.input.release(id as ActionId);
      this.buttons.get(id)?.classList.remove('active');
    }
    if (this.joy && e.pointerId === this.joy.id) {
      this.joy = null;
      this.input.setMove('touch', 0, 0);
      this.joyBase.classList.add('hidden');
      this.joyKnob.classList.add('hidden');
      this.joyHint.classList.remove('hidden');
    }
    this.looks.delete(e.pointerId);
  };

  /** Lets the player drag buttons around. */
  beginEdit(onMove: () => void): void {
    this.reset();
    this.editing = { onMove };
    this.root.classList.add('editing');
    this.setVisible(true);
  }

  endEdit(): void {
    this.editing = null;
    this.drag = null;
    this.root.classList.remove('editing');
  }

  resetLayout(): void {
    this.layout = DEFAULT_TOUCH_LAYOUT.map((b) => ({ ...b }));
    this.applyLayout();
  }
}
