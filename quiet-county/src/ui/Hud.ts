import type * as THREE from 'three';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, MessageKind } from '../core/GameEvents';
import type { HudSnapshot } from '../game/GameSession';
import { wrapAngle, yawFromDir } from '../core/math';
import { EYE_SVG } from './icons';
import { el, svg } from './dom';
import { MapRenderer, type Ping } from './MapRenderer';

interface Toast {
  node: HTMLElement;
  life: number;
}

/**
 * The in-game HUD: vitals, weapon/ammo, objective tracker, toasts, minimap with noise ring,
 * crosshair and hit markers, stealth indicators (noise meter + detection eye), interaction
 * prompt, world-space objective marker and damage direction.
 */
export class Hud {
  readonly root: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly healFill: HTMLElement;
  private readonly staminaBar: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly chips: Record<string, HTMLElement> = {};
  private readonly weaponName: HTMLElement;
  private readonly ammo: HTMLElement;
  private readonly durFill: HTMLElement;
  private readonly reloadText: HTMLElement;
  private readonly trackerMain: HTMLElement;
  private readonly trackerSub: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly toasts: HTMLElement;
  private readonly toastList: Toast[] = [];
  private readonly minimap: HTMLCanvasElement;
  private readonly crosshair: HTMLElement;
  private readonly cross: Record<'t' | 'b' | 'l' | 'r', HTMLElement>;
  private readonly hitmarker: HTMLElement;
  private readonly noiseBars: HTMLElement[] = [];
  private readonly eye: HTMLElement;
  private readonly detectLabel: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly promptVerb: HTMLElement;
  private readonly promptLabel: HTMLElement;
  private readonly promptRing: SVGCircleElement;
  private readonly useBox: HTMLElement;
  private readonly useFill: HTMLElement;
  private readonly useName: HTMLElement;
  private readonly marker: HTMLElement;
  private readonly markerDist: HTMLElement;
  private readonly damageDir: HTMLElement;
  private readonly takedown: HTMLElement;
  private readonly pings: Ping[] = [];
  private map: MapRenderer | null = null;
  private miniTimer = 0;
  private last: Record<string, string | number | boolean> = {};
  private damageFlash: HTMLElement;
  private lowHealth: HTMLElement;
  private lastHealth = -1;
  private damageFrom = { x: 0, z: 0 };
  private damageTimer = 0;

  constructor(parent: HTMLElement, bus: EventBus<GameEvents>, private readonly project: (x: number, y: number, z: number, out: THREE.Vector3) => boolean) {
    this.root = el('div', 'layer', { id: 'hud' });
    this.damageFlash = document.getElementById('damage-flash')!;
    this.lowHealth = document.getElementById('lowhealth')!;

    const vitals = el('div', 'vitals');
    const health = el('div', 'bar health');
    this.healFill = el('div', 'heal');
    this.healthFill = el('div', 'fill');
    health.append(this.healFill, this.healthFill);
    this.staminaBar = el('div', 'bar stamina');
    this.staminaFill = el('div', 'fill');
    this.staminaBar.append(this.staminaFill);
    const status = el('div', 'status-row');
    for (const [k, label] of [['stance', 'Standing'], ['cover', 'Cover'], ['light', 'Light'], ['heal', 'Healing']] as const) {
      this.chips[k] = el('span', 'chip', {}, label);
      status.append(this.chips[k]);
    }
    const wp = el('div', 'weapon-panel');
    this.weaponName = el('div', '', {}, '-');
    this.ammo = el('div', 'ammo');
    const dur = el('div', 'dur');
    this.durFill = el('div');
    dur.append(this.durFill);
    this.reloadText = el('div', 'reload');
    wp.append(this.weaponName, this.ammo, dur, this.reloadText);
    vitals.append(health, this.staminaBar, status, wp);

    const tracker = el('div', 'objective-tracker');
    this.trackerMain = el('div', 'tracker-main');
    this.trackerSub = el('div', 'tracker-sub');
    this.clock = el('div', 'clock');
    tracker.append(this.trackerMain, this.trackerSub, this.clock);

    this.toasts = el('div', '', { id: 'toasts' });
    const mmWrap = el('div', '', { id: 'minimap-wrap' });
    this.minimap = el('canvas', '', { id: 'minimap' });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.minimap.width = Math.round(116 * dpr);
    this.minimap.height = Math.round(116 * dpr);
    mmWrap.append(this.minimap);

    this.crosshair = el('div', 'crosshair');
    this.cross = { t: el('i', 't'), b: el('i', 'b'), l: el('i', 'l'), r: el('i', 'r') };
    this.crosshair.append(el('i', 'dot'), this.cross.t, this.cross.b, this.cross.l, this.cross.r);
    this.hitmarker = el('div', 'hitmarker');

    const stealth = el('div', 'stealth-meter');
    const bars = el('div', 'noise-bars');
    for (let i = 0; i < 6; i++) {
      const s = el('span');
      s.style.height = `${5 + i * 2}px`;
      this.noiseBars.push(s);
      bars.append(s);
    }
    this.eye = el('div', 'eye');
    this.eye.append(svg(EYE_SVG));
    this.detectLabel = el('span', 'detect-label', {}, 'Hidden');
    stealth.append(el('span', '', {}, 'Noise'), bars, this.eye, this.detectLabel);

    this.prompt = el('div', 'prompt hidden');
    const ring = svg('<svg class="ring" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="3"/><circle class="p" cx="12" cy="12" r="9" fill="none" stroke="#e8a33d" stroke-width="3" stroke-dasharray="56.5" stroke-dashoffset="56.5" transform="rotate(-90 12 12)"/></svg>');
    this.promptRing = ring.querySelector('circle.p') as SVGCircleElement;
    this.promptVerb = el('span', 'verb');
    this.promptLabel = el('span', 'label');
    this.prompt.append(ring, this.promptVerb, this.promptLabel);

    this.useBox = el('div', 'use-progress hidden');
    this.useName = el('div');
    const ub = el('div', 'bar');
    this.useFill = el('div', 'fill');
    ub.append(this.useFill);
    this.useBox.append(this.useName, ub);

    this.marker = el('div', 'world-marker hidden');
    this.markerDist = el('div');
    this.marker.append(el('div', 'diamond'), this.markerDist);
    this.damageDir = el('div', 'damage-dir');
    this.takedown = el('div', 'takedown-hint hidden', {}, 'TAKEDOWN READY');

    this.root.append(vitals, tracker, mmWrap, this.crosshair, this.hitmarker, stealth, this.prompt, this.useBox, this.marker, this.damageDir, this.takedown);
    parent.append(this.root, this.toasts);

    bus.on('message', (m) => this.toast(m.text, m.kind, m.duration));
    bus.on('weapon:hit', (h) => this.hit(h.killed));
    bus.on('enemy:alerted', (e) => this.pings.push({ x: e.x, z: e.z, age: 0, color: 'rgba(207,74,51,ALPHA)' }));
    bus.on('noise', (n) => {
      if (!n.fromPlayer && (n.kind === 'alarm' || n.kind === 'breakable')) this.pings.push({ x: n.x, z: n.z, age: 0, color: 'rgba(232,163,61,ALPHA)' });
    });
    bus.on('player:damaged', (d) => {
      this.damageFlash.style.transition = 'none';
      this.damageFlash.style.opacity = '1';
      requestAnimationFrame(() => {
        this.damageFlash.style.transition = 'opacity 0.5s ease-out';
        this.damageFlash.style.opacity = '0';
      });
      if (d.from) {
        this.damageFrom = { ...d.from };
        this.damageTimer = 1.2;
      }
    });
  }

  setLevel(map: MapRenderer): void {
    this.map = map;
  }

  get mapRenderer(): MapRenderer | null {
    return this.map;
  }

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
    this.toasts.classList.toggle('hidden', !visible);
  }

  clearToasts(): void {
    this.toastList.forEach((t) => t.node.remove());
    this.toastList.length = 0;
  }

  toast(text: string, kind: MessageKind = 'info', duration = 3.5): void {
    const node = el('div', `toast ${kind}`, {}, text);
    this.toasts.append(node);
    this.toastList.push({ node, life: duration });
    const max = window.innerHeight < 500 ? 3 : 4;
    while (this.toastList.length > max) this.toastList.shift()!.node.remove();
  }

  private hit(killed: boolean): void {
    this.hitmarker.classList.remove('show', 'kill');
    void this.hitmarker.offsetWidth;
    this.hitmarker.classList.add('show');
    if (killed) this.hitmarker.classList.add('kill');
  }

  private set(key: string, value: string | number | boolean, apply: () => void): void {
    if (this.last[key] === value) return;
    this.last[key] = value;
    apply();
  }

  update(dt: number, h: HudSnapshot, spread: number): void {
    for (let i = this.toastList.length - 1; i >= 0; i--) {
      const t = this.toastList[i];
      t.life -= dt;
      if (t.life < 0.4) t.node.classList.add('out');
      if (t.life <= 0) {
        t.node.remove();
        this.toastList.splice(i, 1);
      }
    }
    const hf = h.health / h.maxHealth;
    this.set('hp', Math.round(hf * 200), () => (this.healthFill.style.transform = `scaleX(${hf})`));
    this.set('heal', h.healing, () => (this.healFill.style.transform = `scaleX(${h.healing ? Math.min(1, hf + 0.15) : 0})`));
    const sf = h.stamina / h.maxStamina;
    this.set('st', Math.round(sf * 100), () => (this.staminaFill.style.transform = `scaleX(${sf})`));
    this.set('ex', h.exhausted, () => this.staminaBar.classList.toggle('exhausted', h.exhausted));
    if (this.lastHealth !== h.health) {
      this.lastHealth = h.health;
      this.lowHealth.style.opacity = hf < 0.35 ? String((0.35 - hf) * 2.4) : '0';
    }
    this.set('stance', `${h.crouched}${h.sprinting}`, () => {
      this.chips.stance.textContent = h.crouched ? 'Crouched' : h.sprinting ? 'Sprinting' : 'Standing';
      this.chips.stance.classList.toggle('on', h.crouched);
    });
    this.set('cover', h.inGrass, () => this.chips.cover.classList.toggle('on', h.inGrass));
    this.set('light', `${h.flashlightOn}${Math.round(h.battery)}`, () => {
      this.chips.light.textContent = `Light ${Math.round(h.battery)}%`;
      this.chips.light.classList.toggle('on', h.flashlightOn);
    });
    this.set('healchip', h.healing, () => this.chips.heal.classList.toggle('hidden', !h.healing));

    this.set('wn', h.weaponName ?? '', () => (this.weaponName.textContent = h.weaponName ?? 'Unarmed'));
    this.set('ammo', `${h.firearm}${h.ammo}/${h.reserve}`, () => {
      this.ammo.innerHTML = h.firearm ? `${h.ammo}<small> / ${h.reserve}</small>` : '<small>MELEE</small>';
    });
    this.set('dur', Math.round(h.durability * 50), () => {
      this.durFill.style.transform = `scaleX(${h.durability})`;
      this.durFill.style.background = h.durability < 0.25 ? 'var(--red)' : 'var(--muted)';
    });
    this.set('reload', Math.round(h.reload * 10), () => (this.reloadText.textContent = h.reload >= 0 ? `Reloading ${Math.round(h.reload * 100)}%` : h.firearm && h.ammo === 0 ? (h.reserve > 0 ? 'Reload' : 'No ammo') : ''));

    const tracked = h.objectives.find((o) => o.status === 'active' && (o.kind === 'extraction' || o.kind === 'primary')) ?? h.objectives.find((o) => o.status === 'active');
    const others = h.objectives.filter((o) => o.status === 'active' && o !== tracked).length;
    this.set('obj', `${tracked?.id}${others}`, () => {
      this.trackerMain.textContent = tracked ? tracked.text : 'All objectives complete';
      this.trackerSub.textContent = others > 0 ? `+${others} more objective${others > 1 ? 's' : ''} (open map)` : '';
    });
    this.set('clock', `${h.clock}${h.phase}`, () => (this.clock.textContent = `${h.clock}  ${h.phase.toUpperCase()}${h.rain > 0.2 ? '  RAIN' : ''}`));

    // Crosshair: only meaningful with a firearm; gap shows spread.
    this.set('xh', `${h.firearm}${Math.round(spread)}`, () => {
      this.crosshair.classList.toggle('hidden', !h.firearm);
      const gap = 4 + spread * 2.2;
      this.cross.t.style.top = `${-gap - 7}px`;
      this.cross.b.style.top = `${gap}px`;
      this.cross.l.style.left = `${-gap - 7}px`;
      this.cross.r.style.left = `${gap}px`;
    });

    const level = Math.round(h.noise * 6);
    this.set('noise', level, () => this.noiseBars.forEach((b, i) => {
      b.classList.toggle('on', i < level);
      b.classList.toggle('loud', i < level && level >= 5);
    }));
    const det = h.hostile > 0 ? 'hunted' : h.awareness > 0.25 ? 'suspicious' : 'hidden';
    this.set('det', det, () => {
      this.detectLabel.textContent = det === 'hunted' ? 'Hunted' : det === 'suspicious' ? 'Suspicious' : 'Hidden';
      this.detectLabel.className = `detect-label ${det}`;
      this.eye.style.color = det === 'hunted' ? 'var(--red)' : det === 'suspicious' ? 'var(--amber)' : 'var(--muted)';
    });
    this.set('eyeop', Math.round(h.awareness * 10), () => (this.eye.style.opacity = String(0.45 + h.awareness * 0.55)));

    const pr = h.prompt;
    this.set('prompt', pr ? `${pr.verb}|${pr.label}|${pr.enabled}` : '', () => {
      this.prompt.classList.toggle('hidden', !pr);
      if (pr) {
        this.promptVerb.textContent = pr.verb;
        this.promptLabel.textContent = pr.enabled ? pr.label : `${pr.label}`;
        this.prompt.classList.toggle('disabled', !pr.enabled);
      }
    });
    this.set('prog', pr ? Math.round(pr.progress * 40) : 0, () => (this.promptRing.style.strokeDashoffset = String(56.5 * (1 - (pr?.progress ?? 0)))));
    this.set('use', h.usingItem ? `${h.usingItem.name}${Math.round(h.usingItem.progress * 30)}` : '', () => {
      this.useBox.classList.toggle('hidden', !h.usingItem);
      if (h.usingItem) {
        this.useName.textContent = `Using ${h.usingItem.name}`;
        this.useFill.style.transform = `scaleX(${h.usingItem.progress})`;
      }
    });
    this.set('td', h.takedown, () => this.takedown.classList.toggle('hidden', !h.takedown));

    // World-space objective marker.
    const tmp = { x: 0, y: 0, z: 0 } as THREE.Vector3;
    if (h.marker && this.project(h.marker.x, 1.8, h.marker.z, tmp)) {
      this.marker.classList.remove('hidden');
      this.marker.classList.toggle('extraction', h.extraction && h.objectives.some((o) => o.kind === 'extraction' && o.status === 'active'));
      this.marker.style.transform = `translate(${tmp.x}px, ${tmp.y}px) translate(-50%, -100%)`;
      this.set('md', Math.round(h.marker.distance), () => (this.markerDist.textContent = `${Math.round(h.marker!.distance)}m`));
    } else this.marker.classList.add('hidden');

    // Damage direction relative to the camera.
    if (this.damageTimer > 0) {
      this.damageTimer -= dt;
      // Positive relative yaw = attacker to the left; CSS rotation is clockwise.
      const rel = wrapAngle(yawFromDir(this.damageFrom.x - h.playerX, this.damageFrom.z - h.playerZ) - h.camYaw);
      this.damageDir.style.transform = `rotate(${-rel}rad)`;
      this.damageDir.style.opacity = String(Math.min(1, Math.max(0, this.damageTimer)));
    } else this.damageDir.style.opacity = '0';

    for (let i = this.pings.length - 1; i >= 0; i--) {
      this.pings[i].age += dt;
      if (this.pings[i].age > 3) this.pings.splice(i, 1);
    }
    this.miniTimer -= dt;
    if (this.map && this.miniTimer <= 0) {
      this.miniTimer = 1 / 15;
      this.map.drawMini(this.minimap, h, this.pings);
    }
  }
}
