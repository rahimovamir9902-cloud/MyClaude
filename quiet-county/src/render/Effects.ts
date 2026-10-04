import * as THREE from 'three';
import { ObjectPool } from '../core/ObjectPool';
import type { MaterialLibrary } from './Materials';

interface Timed {
  obj: THREE.Object3D;
  life: number;
  max: number;
  vy: number;
}

function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Pooled short-lived visuals: bullet tracers, muzzle flashes, dust/blood puffs, blood
 * decals and rain. All objects are preallocated; nothing is created during combat.
 */
export class Effects {
  readonly root = new THREE.Group();
  private readonly tracers: ObjectPool<THREE.Line>;
  private readonly puffs: ObjectPool<THREE.Sprite>;
  private readonly decals: ObjectPool<THREE.Mesh>;
  private readonly flash: THREE.Sprite;
  private flashLife = 0;
  readonly flashLight: THREE.PointLight | null;
  private readonly live: Timed[] = [];
  private decalOrder: THREE.Mesh[] = [];
  private readonly dustMat: THREE.SpriteMaterial;
  private readonly bloodMat: THREE.SpriteMaterial;
  private rain: THREE.LineSegments | null = null;
  private rainMat: THREE.ShaderMaterial | null = null;

  constructor(materials: MaterialLibrary, withFlashLight: boolean, rainCount: number) {
    this.root.name = 'effects';
    const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tracers = new ObjectPool<THREE.Line>(
      () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        const l = new THREE.Line(g, tracerMat);
        l.frustumCulled = false;
        l.visible = false;
        this.root.add(l);
        return l;
      },
      (l) => (l.visible = true),
      (l) => (l.visible = false),
      16,
    );
    this.dustMat = new THREE.SpriteMaterial({ map: radialTexture('rgba(190,180,160,0.8)', 'rgba(190,180,160,0)'), transparent: true, depthWrite: false });
    this.bloodMat = new THREE.SpriteMaterial({ map: radialTexture('rgba(110,14,10,0.95)', 'rgba(70,8,6,0)'), transparent: true, depthWrite: false });
    this.puffs = new ObjectPool<THREE.Sprite>(
      () => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.dustMat.map, transparent: true, depthWrite: false }));
        s.visible = false;
        this.root.add(s);
        return s;
      },
      (s) => (s.visible = true),
      (s) => (s.visible = false),
      40,
    );
    const decalGeo = new THREE.PlaneGeometry(1, 1);
    decalGeo.rotateX(-Math.PI / 2);
    this.decals = new ObjectPool<THREE.Mesh>(
      () => {
        const m = new THREE.Mesh(decalGeo, materials.splatter(1));
        m.visible = false;
        m.renderOrder = 1;
        this.root.add(m);
        return m;
      },
      (m) => (m.visible = true),
      (m) => (m.visible = false),
      24,
    );
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: radialTexture('rgba(255,240,200,1)', 'rgba(255,170,60,0)'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.flash.scale.setScalar(0.5);
    this.flash.visible = false;
    this.root.add(this.flash);
    this.flashLight = withFlashLight ? new THREE.PointLight(0xffc880, 0, 10, 1.6) : null;
    if (this.flashLight) this.root.add(this.flashLight);
    this.tracers.prewarm(6);
    this.puffs.prewarm(16);
    this.decals.prewarm(8);
    if (rainCount > 0) this.buildRain(rainCount);
  }

  muzzleFlash(pos: THREE.Vector3): void {
    this.flash.position.copy(pos);
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.visible = true;
    this.flashLife = 0.05;
    if (this.flashLight) {
      this.flashLight.position.copy(pos);
      this.flashLight.intensity = 70;
    }
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const l = this.tracers.acquire();
    if (!l) return;
    const a = l.geometry.getAttribute('position') as THREE.BufferAttribute;
    a.setXYZ(0, from.x, from.y, from.z);
    a.setXYZ(1, to.x, to.y, to.z);
    a.needsUpdate = true;
    this.live.push({ obj: l, life: 0.06, max: 0.06, vy: 0 });
  }

  puff(pos: THREE.Vector3, blood: boolean, count = 3): void {
    for (let i = 0; i < count; i++) {
      const s = this.puffs.acquire();
      if (!s) return;
      s.material.map = blood ? this.bloodMat.map : this.dustMat.map;
      s.material.opacity = 1;
      s.position.set(pos.x + (Math.random() - 0.5) * 0.15, pos.y + (Math.random() - 0.5) * 0.15, pos.z + (Math.random() - 0.5) * 0.15);
      s.scale.setScalar(blood ? 0.25 : 0.35);
      this.live.push({ obj: s, life: 0.45, max: 0.45, vy: blood ? -0.4 : 0.5 });
    }
  }

  bloodDecal(x: number, z: number): void {
    let m = this.decals.acquire();
    if (!m) {
      // Recycle the oldest splat.
      m = this.decalOrder.shift() ?? null;
      if (!m) return;
    }
    m.position.set(x + (Math.random() - 0.5) * 0.4, 0.035, z + (Math.random() - 0.5) * 0.4);
    m.rotation.y = Math.random() * Math.PI * 2;
    m.scale.setScalar(0.8 + Math.random() * 0.9);
    this.decalOrder.push(m);
  }

  private buildRain(count: number): void {
    const seeds = new Float32Array(count * 2 * 3);
    const ends = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const sx = Math.random();
      const sy = Math.random();
      const sz = Math.random();
      for (let k = 0; k < 2; k++) {
        seeds.set([sx, sy, sz], (i * 2 + k) * 3);
        ends[i * 2 + k] = k;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(seeds, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uOpacity: { value: 0 } },
      vertexShader: `
        uniform float uTime;
        uniform vec3 uCenter;
        attribute float aEnd;
        void main() {
          float size = 24.0;
          float h = 14.0;
          vec3 p;
          p.x = uCenter.x + (fract(position.x + uCenter.x / size) - 0.5) * size;
          p.z = uCenter.z + (fract(position.z + uCenter.z / size) - 0.5) * size;
          p.y = mod(position.y * h - uTime * 16.0, h) + uCenter.y - 3.0;
          p.y += aEnd * 0.45;
          p.x += aEnd * 0.05;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uOpacity;
        void main() { gl_FragColor = vec4(0.72, 0.76, 0.82, uOpacity); }`,
    });
    this.rain = new THREE.LineSegments(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.root.add(this.rain);
  }

  update(dt: number, camera: THREE.Camera, rain: number, time: number): void {
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      if (this.flashLife <= 0) this.flash.visible = false;
    }
    if (this.flashLight && this.flashLight.intensity > 0) this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 1400);
    for (let i = this.live.length - 1; i >= 0; i--) {
      const t = this.live[i];
      t.life -= dt;
      if (t.obj instanceof THREE.Sprite) {
        t.obj.position.y += t.vy * dt;
        t.obj.scale.multiplyScalar(1 + dt * 1.8);
        t.obj.material.opacity = Math.max(0, t.life / t.max);
      }
      if (t.life <= 0) {
        if (t.obj instanceof THREE.Line) this.tracers.release(t.obj);
        else if (t.obj instanceof THREE.Sprite) this.puffs.release(t.obj);
        this.live.splice(i, 1);
      }
    }
    if (this.rain && this.rainMat) {
      this.rain.visible = rain > 0.02;
      this.rainMat.uniforms.uTime.value = time;
      (this.rainMat.uniforms.uCenter.value as THREE.Vector3).copy(camera.position);
      this.rainMat.uniforms.uOpacity.value = rain * 0.35;
    }
  }
}
