import * as THREE from 'three';
import type { QualityPreset } from '../config/quality';
import { createLogger } from '../core/Logger';
import { clamp, lerp } from '../core/math';
import type { SkySample } from '../systems/TimeOfDay';
import { Sky } from './Sky';

const log = createLogger('Renderer');

/** three.js uses physical light units (Lambert divides by PI); sky samples are authored 0..1.5. */
const LIGHT_SCALE = Math.PI * 0.85;

/**
 * Adjusts the render resolution to hold the frame-rate target on mid-range devices.
 * Drops quickly when frames are slow, recovers slowly when there is headroom.
 */
export class DynamicResolution {
  ratio: number;
  private ema = 16.7;
  private goodTime = 0;
  private badTime = 0;

  constructor(
    public min: number,
    public max: number,
    public targetMs: number,
  ) {
    this.ratio = max;
  }

  /** Returns true when the ratio changed. */
  sample(frameMs: number, dt: number): boolean {
    this.ema += (Math.min(frameMs, 100) - this.ema) * 0.08;
    if (this.ema > this.targetMs * 1.18) {
      this.badTime += dt;
      this.goodTime = 0;
    } else if (this.ema < this.targetMs * 1.04) {
      this.goodTime += dt;
      this.badTime = 0;
    } else {
      this.badTime = this.goodTime = 0;
    }
    if (this.badTime > 0.75 && this.ratio > this.min) {
      this.ratio = Math.max(this.min, this.ratio - 0.1);
      this.badTime = 0;
      return true;
    }
    if (this.goodTime > 4 && this.ratio < this.max) {
      this.ratio = Math.min(this.max, this.ratio + 0.1);
      this.goodTime = 0;
      return true;
    }
    return false;
  }

  get averageMs(): number {
    return this.ema;
  }
}

export interface RenderStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
  geometries: number;
  textures: number;
}

/** Owns the WebGL renderer, scene, camera, lights, fog, sky and resolution scaling. */
export class RenderManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  readonly sky = new Sky();
  readonly dynRes: DynamicResolution;
  readonly stats: RenderStats = { fps: 0, frameMs: 0, drawCalls: 0, triangles: 0, pixelRatio: 1, geometries: 0, textures: 0 };
  dynamicResolution = true;
  private readonly fog: THREE.Fog;
  private readonly sunDir = new THREE.Vector3();
  private fpsFrames = 0;
  private fpsTime = 0;
  private readonly fogColor = new THREE.Color();
  private width = 1;
  private height = 1;

  constructor(
    readonly canvasParent: HTMLElement,
    public quality: QualityPreset,
    targetFps: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: quality.antialias,
      powerPreference: 'high-performance',
      stencil: false,
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.id = 'game-canvas';
    canvasParent.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, quality.viewDistance + 40);
    this.fog = new THREE.Fog(0x888888, 20, quality.viewDistance);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x10141a);

    this.hemi = new THREE.HemisphereLight(0xb0bcc8, 0x403a30, 0.8);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffeedd, 1.2);
    this.sun.castShadow = quality.shadows;
    this.sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    const sc = this.sun.shadow.camera;
    sc.left = -28;
    sc.right = 28;
    sc.top = 28;
    sc.bottom = -28;
    sc.near = 1;
    sc.far = 140;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.scene.add(this.sky.group);

    this.dynRes = new DynamicResolution(quality.minPixelRatio, this.maxRatio(), 1000 / targetFps);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', () => setTimeout(this.resize, 200));
    log.info(`Renderer ready: ${this.renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1'}, maxAniso=${this.renderer.capabilities.getMaxAnisotropy()}`);
  }

  get maxAnisotropy(): number {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  private maxRatio(): number {
    return Math.min(this.quality.maxPixelRatio, window.devicePixelRatio || 1);
  }

  setTargetFps(fps: number): void {
    this.dynRes.targetMs = 1000 / fps;
  }

  readonly resize = (): void => {
    const w = Math.max(1, this.canvasParent.clientWidth || window.innerWidth);
    const h = Math.max(1, this.canvasParent.clientHeight || window.innerHeight);
    this.width = w;
    this.height = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.dynamicResolution ? this.dynRes.ratio : this.maxRatio());
    this.renderer.setSize(w, h, true);
  };

  /** Applies time-of-day lighting, fog and sky around the focus point. */
  applyEnvironment(sample: SkySample, focusX: number, focusZ: number, weather: { fog: number; rain: number }): void {
    this.hemi.color.setHex(sample.hemiSky);
    this.hemi.groundColor.setHex(sample.hemiGround);
    this.hemi.intensity = sample.hemiIntensity * LIGHT_SCALE * (1 - weather.rain * 0.2);
    const overcast = Math.max(weather.rain, weather.fog * 0.6);
    this.sun.color.setHex(sample.sunColor);
    this.sun.intensity = sample.sunIntensity * LIGHT_SCALE * (1 - overcast * 0.55);

    // Sun by day, moon by night: always from a fixed, readable azimuth.
    const elev = sample.darkness > 0.75 ? 0.9 : Math.max(0.12, sample.sunElevation);
    this.sunDir.set(Math.cos(elev) * 0.6, Math.sin(elev), Math.cos(elev) * 0.8).normalize();
    this.sun.position.set(focusX + this.sunDir.x * 60, this.sunDir.y * 60, focusZ + this.sunDir.z * 60);
    this.sun.target.position.set(focusX, 0, focusZ);

    this.fogColor.setHex(sample.fog);
    if (weather.rain > 0) this.fogColor.lerp(new THREE.Color(0x4a5058), weather.rain * 0.4 * (1 - sample.darkness));
    this.fog.color.copy(this.fogColor);
    (this.scene.background as THREE.Color).copy(this.fogColor);
    const vd = this.quality.viewDistance;
    const far = vd * lerp(1, 0.5, sample.darkness) * (1 - weather.fog * 0.45);
    this.fog.far = far;
    this.fog.near = far * lerp(0.25, 0.08, Math.max(sample.darkness, weather.fog));
    this.camera.far = Math.max(far + 20, 60);
    this.sky.apply(sample, this.sunDir, overcast);
  }

  render(dt: number): void {
    const frameMs = dt * 1000;
    if (this.dynamicResolution && this.dynRes.sample(frameMs, dt)) {
      this.renderer.setPixelRatio(this.dynRes.ratio);
      this.renderer.setSize(this.width, this.height, true);
    }
    this.sky.follow(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    const info = this.renderer.info;
    this.stats.drawCalls = info.render.calls;
    this.stats.triangles = info.render.triangles;
    this.stats.geometries = info.memory.geometries;
    this.stats.textures = info.memory.textures;
    this.stats.pixelRatio = this.renderer.getPixelRatio();
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.stats.fps = Math.round(this.fpsFrames / this.fpsTime);
      this.stats.frameMs = clamp((this.fpsTime / this.fpsFrames) * 1000, 0, 999);
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
