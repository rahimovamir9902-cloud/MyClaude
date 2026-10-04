import * as THREE from 'three';
import { DLG_INES, DLG_TEO } from '../config/dialogue/ines';
import { SILENT_ROAD_LEVEL } from '../config/levels/silentRoad';
import { M01_SILENT_ROAD } from '../config/missions/m01_silentRoad';
import { QUALITY_PRESETS, type QualityPreset } from '../config/quality';
import type { GameSettings } from '../config/settings';
import { AudioSystem } from '../audio/AudioSystem';
import { EventBus } from '../core/EventBus';
import type { GameEvents, MissionSummary } from '../core/GameEvents';
import { createLogger } from '../core/Logger';
import { InputState } from '../input/InputState';
import { KeyboardMouse } from '../input/KeyboardMouse';
import { TouchControls } from '../input/TouchControls';
import { createStorage, enterGameDisplayMode, haptic, isTouchDevice } from '../platform/Platform';
import { MaterialLibrary } from '../render/Materials';
import { RenderManager } from '../render/RenderManager';
import type { DialogueRunner } from '../systems/DialogueSystem';
import { SaveSystem, emptyProfile, type ProfileState, type SaveGame } from '../systems/SaveSystem';
import { spreadDegrees } from '../systems/WeaponLogic';
import { el } from '../ui/dom';
import { Hud } from '../ui/Hud';
import { ROTATE_SVG } from '../ui/icons';
import { MapRenderer } from '../ui/MapRenderer';
import { dialogueOverlay, inventoryOverlay, lootOverlay, mapOverlay, noteOverlay } from '../ui/Overlays';
import {
  CREDITS, HOW_TO_SURVIVE, bootScreen, briefingScreen, deathScreen, infoScreen, loadingScreen, mainMenu, pauseScreen,
  resultsScreen, settingsScreen, type ScreenHost,
} from '../ui/Screens';
import type { LootContainer, NoteObject } from '../world/WorldObjects';
import { GameSession } from './GameSession';
import { SettingsStore } from './SettingsStore';

const log = createLogger('Game');

export type GameState = 'boot' | 'menu' | 'briefing' | 'loading' | 'playing' | 'paused' | 'overlay' | 'results' | 'dead' | 'editing';

/**
 * Application root: owns the renderer, audio, input devices, UI and save system, and runs
 * the frame loop. Creates a {@link GameSession} per mission attempt.
 */
export class Game {
  readonly bus = new EventBus<GameEvents>();
  readonly input = new InputState();
  readonly audio = new AudioSystem();
  readonly settingsStore = new SettingsStore();
  readonly saves = new SaveSystem(createStorage(), this.bus);
  readonly mission = M01_SILENT_ROAD;
  readonly levelDef = SILENT_ROAD_LEVEL;
  renderer!: RenderManager;
  materials!: MaterialLibrary;
  quality!: QualityPreset;
  profile: ProfileState = emptyProfile();
  session: GameSession | null = null;
  hud!: Hud;
  touch!: TouchControls;
  kbm!: KeyboardMouse;
  state: GameState = 'boot';
  lastSummary: MissionSummary | null = null;
  activeDialogue: DialogueRunner | null = null;
  activeLoot: LootContainer | null = null;
  private screensLayer!: HTMLElement;
  private overlayRefresh: (() => void) | null = null;
  private fpsNode!: HTMLElement;
  private lastTime = 0;
  private frozenAccum = 0;
  private readonly tmpV = new THREE.Vector3();
  private map: MapRenderer | null = null;
  private lastSaveLabel: string | null = null;
  private readonly hostApi: ScreenHost;
  private afterEdit: (() => void) | null = null;
  frameCount = 0;
  /** Optional QA driver (debug builds) that feeds input before each update. */
  autopilot: { update(dt: number): void } | null = null;

  constructor(private readonly appRoot: HTMLElement) {
    this.hostApi = {
      mount: (node) => this.mount(node),
      close: () => this.closeScreen(),
      click: () => this.audio.play('click'),
    };
  }

  get settings(): GameSettings {
    return this.settingsStore.get();
  }

  async init(): Promise<void> {
    const s = this.settings;
    this.quality = QUALITY_PRESETS[s.quality];
    const canvasParent = el('div', '', { id: 'canvas-parent', style: 'position:absolute;inset:0' });
    this.appRoot.append(canvasParent, el('div', '', { id: 'vignette' }), el('div', '', { id: 'damage-flash' }), el('div', '', { id: 'lowhealth' }));
    this.renderer = new RenderManager(canvasParent, this.quality, s.targetFps);
    this.renderer.dynamicResolution = s.dynamicResolution;
    this.materials = new MaterialLibrary(this.quality, this.renderer.maxAnisotropy);

    const uiRoot = el('div', 'layer', { id: 'ui' });
    this.appRoot.append(uiRoot);
    this.hud = new Hud(uiRoot, this.bus, (x, y, z, out) => this.project(x, y, z, out));
    this.hud.show(false);
    this.touch = new TouchControls(uiRoot, this.input);
    this.touch.applySettings(s);
    this.touch.setVisible(false);
    this.screensLayer = el('div', 'layer', { id: 'screens', style: 'z-index:30' });
    uiRoot.append(this.screensLayer);
    this.fpsNode = el('div', 'hidden', { id: 'fps' });
    const rotate = el('div', '', { id: 'rotate' });
    rotate.innerHTML = `${ROTATE_SVG}<div class="kicker">Rotate your device</div><div class="muted">Quiet County is played in landscape.</div>`;
    this.appRoot.append(this.fpsNode, rotate);
    this.kbm = new KeyboardMouse(this.renderer.renderer.domElement, this.input, () => this.state === 'playing');
    this.applySettings(s);

    this.profile = await this.saves.loadProfile();
    this.bus.on('save:completed', (e) => {
      this.lastSaveLabel = `${e.manual ? 'Manual' : 'Autosave'} at ${new Date().toLocaleTimeString()}`;
    });
    this.bus.on('inventory:changed', () => {
      if (this.state === 'overlay') this.overlayRefresh?.();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'playing') this.pause();
        this.audio.suspend();
      } else this.audio.resume();
    });
    bootScreen(this.hostApi, () => void this.onBootTap());
    requestAnimationFrame(this.frame);
    log.info(`Game initialized (quality=${this.quality.id}, touch=${isTouchDevice})`);
  }

  // ---- frame loop ----------------------------------------------------------------------

  private readonly frame = (t: number): void => {
    requestAnimationFrame(this.frame);
    const raw = this.lastTime ? (t - this.lastTime) / 1000 : 1 / 60;
    this.lastTime = t;
    const dt = Math.min(raw, 0.1);
    this.frameCount++;
    try {
      this.tick(dt, raw);
    } catch (err) {
      log.error('Frame error', err);
    }
    this.input.endFrame();
  };

  private tick(dt: number, rawDt: number): void {
    const session = this.session;
    if (this.autopilot && (this.state === 'playing' || this.state === 'overlay')) this.autopilot.update(dt);
    if (this.state === 'playing' && session) {
      if (this.input.wasPressed('pause')) {
        this.pause();
        return;
      }
      if (this.input.wasPressed('inventory')) {
        this.openInventory();
        return;
      }
      if (this.input.wasPressed('map')) {
        this.openMap();
        return;
      }
      // Big frame hitches are split so physics never tunnels.
      if (dt > 1 / 30) {
        session.update(dt / 2, this.input);
        this.input.consumeEdges();
        session.update(dt / 2, this.input);
      } else session.update(dt, this.input);
      this.renderer.render(rawDt);
      const hud = session.hud();
      const w = session.player.weapon;
      const spread = w?.isFirearm ? spreadDegrees(w.def, { aiming: session.player.aiming, moving: session.player.speed > 0.6, crouched: session.player.crouched }) : 0;
      this.hud.update(dt, hud, spread);
      this.touch.update(hud);
    } else if (session && (this.state === 'paused' || this.state === 'overlay' || this.state === 'dead' || this.state === 'editing')) {
      // Frozen world: render at ~20 fps to save battery.
      this.frozenAccum += dt;
      if (this.frozenAccum >= 0.05) {
        session.updateFrozen(0);
        this.renderer.render(this.frozenAccum);
        this.frozenAccum = 0;
      }
      if (this.state === 'overlay' && (this.input.wasPressed('inventory') || this.input.wasPressed('map') || this.input.wasPressed('pause'))) {
        if (!this.activeDialogue) this.closeOverlay();
      }
    }
    if (this.settings.showFps) {
      const st = this.renderer.stats;
      const extra = session ? `  AI ${session.enemies.aliveCount}  paths ${session.paths.searchesThisFrame}` : '';
      this.fpsNode.textContent = `${st.fps} fps  ${st.frameMs.toFixed(1)}ms  dc ${st.drawCalls}  tri ${(st.triangles / 1000).toFixed(0)}k  px ${st.pixelRatio.toFixed(2)}${extra}`;
    }
  }

  private project(x: number, y: number, z: number, out: THREE.Vector3): boolean {
    const v = this.tmpV.set(x, y, z).project(this.renderer.camera);
    if (v.z > 1 || v.z < -1) return false;
    const w = window.innerWidth;
    const h = window.innerHeight;
    out.x = Math.min(w - 30, Math.max(30, ((v.x + 1) / 2) * w));
    out.y = Math.min(h - 30, Math.max(60, ((1 - v.y) / 2) * h));
    return Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
  }

  // ---- screens ---------------------------------------------------------------------------

  private mount(node: HTMLElement): void {
    this.closeScreen();
    this.screensLayer.append(node);
  }

  private closeScreen(): void {
    this.screensLayer.innerHTML = '';
    this.overlayRefresh = null;
  }

  private setState(next: GameState): void {
    if (this.state === next) return;
    const from = this.state;
    this.state = next;
    const playing = next === 'playing';
    this.hud.show(!!this.session && (playing || next === 'overlay' || next === 'paused' || next === 'editing'));
    this.touch.setVisible((playing && isTouchDevice) || next === 'editing');
    if (!playing) {
      this.input.clear();
      this.kbm.exitPointerLock();
    }
    this.bus.emit('game:stateChanged', { from, to: next });
  }

  private async onBootTap(): Promise<void> {
    await this.audio.unlock();
    this.applySettings(this.settings);
    void enterGameDisplayMode();
    await this.showMainMenu();
  }

  async showMainMenu(): Promise<void> {
    this.setState('menu');
    const latest = await this.saves.latest();
    mainMenu(this.hostApi, this.profile, latest && latest.data.mission?.missionId === this.mission.id ? latest : null, {
      continueGame: () => void this.continueGame(),
      newGame: () => this.showBriefing(),
      settings: () => this.showSettings(() => void this.showMainMenu()),
      controls: () => this.editControls(() => void this.showMainMenu()),
      howTo: () => infoScreen(this.hostApi, 'How to survive', 'Field notes', HOW_TO_SURVIVE, () => void this.showMainMenu()),
      credits: () => infoScreen(this.hostApi, 'Credits', 'Quiet County', CREDITS, () => void this.showMainMenu()),
    });
  }

  showBriefing(): void {
    this.setState('briefing');
    briefingScreen(this.hostApi, this.mission, () => void this.startMission(null), () => void this.showMainMenu());
  }

  async continueGame(): Promise<void> {
    const save = await this.saves.latest();
    await this.startMission(save);
  }

  /** Builds a new session (fresh or from a save) behind a loading screen. */
  async startMission(save: SaveGame | null): Promise<void> {
    this.closeScreen();
    this.setState('loading');
    const loading = loadingScreen(save ? 'Loading save...' : `Travelling to ${this.levelDef.name}...`);
    this.appRoot.append(loading);
    await new Promise((r) => setTimeout(r, 30));
    try {
      this.disposeSession();
      if (!save) await this.saves.deleteAll();
      this.quality = QUALITY_PRESETS[this.settings.quality];
      if (this.renderer.quality.id !== this.quality.id) {
        // Quality changed: rebuild materials at the new texture size.
        this.materials.dispose();
        this.materials = new MaterialLibrary(this.quality, this.renderer.maxAnisotropy);
        this.renderer.quality = this.quality;
        this.renderer.renderer.shadowMap.enabled = this.quality.shadows;
        this.renderer.sun.castShadow = this.quality.shadows;
        this.renderer.dynRes.min = this.quality.minPixelRatio;
        this.renderer.dynRes.max = Math.min(this.quality.maxPixelRatio, window.devicePixelRatio || 1);
      }
      this.session = new GameSession(
        {
          bus: this.bus,
          renderer: this.renderer,
          materials: this.materials,
          audio: this.audio,
          saves: this.saves,
          quality: this.quality,
          settings: () => this.settings,
          profile: this.profile,
          dialogues: { [DLG_INES.id]: DLG_INES, [DLG_TEO.id]: DLG_TEO },
          haptic: (s) => {
            if (this.settings.haptics) void haptic(s);
          },
          callbacks: {
            openLoot: (c) => this.openLoot(c),
            openDialogue: (r, speaker) => this.openDialogue(r, speaker),
            openNote: (n) => this.openNote(n),
            onMissionComplete: (s) => void this.onMissionComplete(s),
            onPlayerDied: () => this.onPlayerDied(),
          },
        },
        this.mission,
        this.levelDef,
        save,
      );
      this.renderer.scene.add(this.session.root);
      if (!this.map) this.map = new MapRenderer(this.levelDef);
      this.hud.setLevel(this.map);
      this.hud.clearToasts();
      this.audio.startAmbience();
      // Warm up shader compilation before the first visible frame.
      this.renderer.renderer.compile(this.renderer.scene, this.renderer.camera);
      this.setState('playing');
      if (!isTouchDevice) this.hud.toast('WASD move - mouse look (click to capture) - E use - Shift sprint - C crouch - V melee - Q swap - Tab bag - M map', 'info', 8);
    } catch (err) {
      log.error('Failed to start mission', err);
      this.hud.toast('Failed to load the mission. See log.', 'danger', 6);
      await this.showMainMenu();
    } finally {
      loading.remove();
    }
  }

  private disposeSession(): void {
    if (!this.session) return;
    this.session.dispose();
    this.session = null;
  }

  pause(): void {
    if (this.state !== 'playing' || !this.session) return;
    this.setState('paused');
    this.audio.play('uiOpen');
    pauseScreen(this.hostApi, { lastSave: this.lastSaveLabel, clock: this.session.time.clock }, {
      resume: () => this.resume(),
      settings: () => this.showSettings(() => {
        this.setState('playing');
        this.pause();
      }),
      controls: () => this.editControls(() => {
        this.setState('playing');
        this.pause();
      }),
      howTo: () => infoScreen(this.hostApi, 'How to survive', 'Field notes', HOW_TO_SURVIVE, () => {
        this.setState('playing');
        this.pause();
      }),
      quit: () => this.quitToMenu(),
    });
  }

  resume(): void {
    this.closeScreen();
    if (this.session) this.setState('playing');
  }

  quitToMenu(): void {
    this.closeScreen();
    this.disposeSession();
    this.audio.stopAllLoops();
    void this.showMainMenu();
  }

  // ---- overlays (world paused while open) --------------------------------------------------

  openInventory(): void {
    const s = this.session;
    if (!s) return;
    this.setState('overlay');
    this.audio.play('uiOpen');
    const ov = inventoryOverlay(
      this.hostApi,
      s.inventory,
      () => s.player.equippedSlot,
      () => `HP ${Math.round(s.player.health.current)}  Light ${Math.round(s.player.battery)}%`,
      {
        use: (slot) => {
          if (s.player.beginUse(slot)) this.closeOverlay();
        },
        equip: (slot) => s.player.equip(slot),
        drop: (slot) => {
          s.inventory.takeFromSlot(slot, undefined, 'discarded');
        },
        close: () => this.closeOverlay(),
      },
    );
    this.overlayRefresh = ov.refresh;
  }

  openMap(): void {
    const s = this.session;
    if (!s || !this.map) return;
    this.setState('overlay');
    this.audio.play('uiOpen');
    mapOverlay(this.hostApi, this.map, s.hud(), () => this.closeOverlay());
  }

  openLoot(c: LootContainer): void {
    const s = this.session;
    if (!s) return;
    this.activeLoot = c;
    this.setState('overlay');
    const ov = lootOverlay(this.hostApi, c, s.inventory, {
      take: (i) => {
        s.takeFromContainer(c, i);
        ov.refresh();
      },
      takeAll: () => {
        s.takeFromContainer(c, -1);
        ov.refresh();
        if (c.contents.length === 0) this.closeOverlay();
      },
      stash: (slot) => {
        if (s.stashInContainer(c, slot)) ov.refresh();
      },
      close: () => this.closeOverlay(),
    });
    this.overlayRefresh = ov.refresh;
  }

  openDialogue(runner: DialogueRunner, speaker: string): void {
    this.activeDialogue = runner;
    this.setState('overlay');
    dialogueOverlay(this.hostApi, runner, speaker, () => {
      this.activeDialogue = null;
      this.bus.emit('dialogue:ended', { dialogueId: runner.def.id, npcId: runner.def.npcId });
      this.closeOverlay();
    });
  }

  openNote(n: NoteObject): void {
    this.setState('overlay');
    noteOverlay(this.hostApi, n, () => this.closeOverlay());
  }

  closeOverlay(): void {
    this.activeLoot = null;
    this.activeDialogue = null;
    this.closeScreen();
    if (this.session && this.state === 'overlay') this.setState('playing');
  }

  // ---- mission end -------------------------------------------------------------------------

  private async onMissionComplete(summary: MissionSummary): Promise<void> {
    this.lastSummary = summary;
    const p = this.profile;
    if (!p.completedMissions.includes(summary.missionId)) p.completedMissions.push(summary.missionId);
    for (const r of summary.rewards) if (r.id !== 'xp') p.campResources[r.id] = (p.campResources[r.id] ?? 0) + r.amount;
    if (this.session?.world.getFlag('ines_rescued') && !p.recruitedNpcs.includes('ines')) p.recruitedNpcs.push('ines');
    p.playTimeSeconds += this.session?.playTime ?? 0;
    await this.saves.saveProfile(p);
    await this.saves.deleteAll();
    this.setState('results');
    resultsScreen(this.hostApi, summary, this.mission.debriefing, {
      menu: () => this.quitToMenu(),
      replay: () => void this.startMission(null),
    });
  }

  private onPlayerDied(): void {
    this.setState('dead');
    void this.saves.latest().then((latest) => {
      deathScreen(this.hostApi, !!latest, {
        retry: () => void this.startMission(latest),
        restart: () => void this.startMission(null),
        menu: () => this.quitToMenu(),
      });
    });
  }

  // ---- settings & controls -------------------------------------------------------------------

  private showSettings(onBack: () => void): void {
    const prev = this.state;
    settingsScreen(this.hostApi, this.settings, (s) => {
      this.settingsStore.set(s);
      this.applySettings(s);
    }, () => {
      this.state = prev;
      onBack();
    }, () => {
      const s = this.settingsStore.reset();
      this.applySettings(s);
      return s;
    });
  }

  applySettings(s: GameSettings): void {
    this.audio.setVolumes(s.masterVolume, s.sfxVolume, s.ambienceVolume);
    this.touch.applySettings(s);
    this.renderer.dynamicResolution = s.dynamicResolution;
    this.renderer.setTargetFps(s.targetFps);
    this.fpsNode.classList.toggle('hidden', !s.showFps);
  }

  /** Drag-to-rearrange touch buttons. */
  editControls(onDone: () => void): void {
    this.closeScreen();
    const prev = this.state;
    this.setState('editing');
    this.afterEdit = onDone;
    const bar = el('div', 'editor-bar', { id: 'controls-editor' },
      el('span', 'kicker', {}, 'Drag buttons to rearrange'),
    );
    const done = (save: boolean) => {
      if (save) {
        const next = { ...this.settings, touchLayout: this.touch.currentLayout };
        this.settingsStore.set(next);
      } else this.touch.applySettings(this.settings);
      this.touch.endEdit();
      bar.remove();
      this.state = prev;
      this.setState(prev === 'editing' ? 'menu' : prev);
      this.afterEdit?.();
    };
    const mk = (label: string, fn: () => void, cls = 'btn small') => {
      const b = el('button', cls, { type: 'button' }, label);
      b.addEventListener('click', fn);
      return b;
    };
    bar.append(
      mk('Reset', () => this.touch.resetLayout()),
      mk('Cancel', () => done(false)),
      mk('Save layout', () => done(true), 'btn small primary'),
    );
    this.appRoot.append(bar);
    this.touch.beginEdit(() => {});
  }
}
