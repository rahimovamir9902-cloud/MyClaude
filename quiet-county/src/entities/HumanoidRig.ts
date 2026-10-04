import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, damp, lerp } from '../core/math';

export type Posture = 'upright' | 'shamble' | 'lean' | 'hulk' | 'crouch';

export interface RigAppearance {
  skin: number;
  shirt: number;
  pants: number;
  hair: number;
  shoes?: number;
  /** Overall height multiplier. */
  height?: number;
  /** Width multiplier (heavy builds). */
  bulk?: number;
  posture?: Posture;
  backpack?: number;
  /** Darkened, torn clothing patches for infected. */
  infected?: boolean;
  jacket?: number;
}

export type Gait = 'idle' | 'walk' | 'run' | 'sprint';

/** Per-frame animation inputs. Everything is procedural (no keyframed clips). */
export interface RigPose {
  /** Horizontal speed in m/s (drives stride). */
  speed: number;
  gait: Gait;
  /** 0..1 crouch blend. */
  crouch: number;
  /** 0..1 firearm aim blend. */
  aim: number;
  /** Aim pitch in radians (positive = up). */
  aimPitch: number;
  /** -1 when not attacking, else 0..1 progress. */
  attack: number;
  attackStyle: 'swing' | 'claw' | 'shove' | 'stab';
  /** 0..1 hit flinch amount (decays externally). */
  hit: number;
  /** 0 alive, 0..1 death fall progress. */
  dead: number;
  /** 0..1 lying on the ground (dormant infected). */
  lying: number;
  /** 0..1 reload progress, -1 when not reloading. */
  reload: number;
  limp: boolean;
  /** 0..1 holding a melee weapon pose. */
  meleeReady: number;
  /** Head turn relative to body (radians). */
  look: number;
}

export function defaultPose(): RigPose {
  return {
    speed: 0, gait: 'idle', crouch: 0, aim: 0, aimPitch: 0, attack: -1, attackStyle: 'swing', hit: 0, dead: 0,
    lying: 0, reload: -1, limp: false, meleeReady: 0, look: 0,
  };
}

interface Part {
  bone: number;
  w: number;
  h: number;
  d: number;
  /** Center position in bind (world-at-origin) space. */
  x: number;
  y: number;
  z: number;
  color: number;
}

const B = {
  hips: 0, spine: 1, chest: 2, neck: 3, head: 4,
  lUpper: 5, lFore: 6, rUpper: 7, rFore: 8,
  lThigh: 9, lShin: 10, rThigh: 11, rShin: 12,
} as const;

/** Bind-pose joint positions (parent-relative), standing 1.75 m tall facing -Z. */
const JOINTS: { parent: number; x: number; y: number; z: number }[] = [
  { parent: -1, x: 0, y: 0.95, z: 0 }, // hips
  { parent: B.hips, x: 0, y: 0.12, z: 0 }, // spine
  { parent: B.spine, x: 0, y: 0.25, z: 0 }, // chest (y 1.32)
  { parent: B.chest, x: 0, y: 0.2, z: 0 }, // neck (1.52)
  { parent: B.neck, x: 0, y: 0.06, z: 0 }, // head (1.58)
  { parent: B.chest, x: -0.21, y: 0.13, z: 0 }, // left upper arm (1.45)
  { parent: B.lUpper, x: 0, y: -0.29, z: 0 }, // left forearm
  { parent: B.chest, x: 0.21, y: 0.13, z: 0 }, // right upper arm
  { parent: B.rUpper, x: 0, y: -0.29, z: 0 }, // right forearm
  { parent: B.hips, x: -0.1, y: -0.04, z: 0 }, // left thigh (0.91)
  { parent: B.lThigh, x: 0, y: -0.44, z: 0 }, // left shin (0.47)
  { parent: B.hips, x: 0.1, y: -0.04, z: 0 }, // right thigh
  { parent: B.rThigh, x: 0, y: -0.44, z: 0 }, // right shin
];

const geometryCache = new Map<string, THREE.BufferGeometry>();
let sharedMaterial: THREE.MeshLambertMaterial | null = null;

function buildGeometry(a: RigAppearance): THREE.BufferGeometry {
  const key = JSON.stringify(a);
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const bulk = a.bulk ?? 1;
  const shoes = a.shoes ?? 0x2a2622;
  const torso = a.jacket ?? a.shirt;
  const parts: Part[] = [
    { bone: B.hips, w: 0.34 * bulk, h: 0.2, d: 0.21 * bulk, x: 0, y: 0.95, z: 0, color: a.pants },
    { bone: B.spine, w: 0.32 * bulk, h: 0.24, d: 0.2 * bulk, x: 0, y: 1.16, z: 0, color: a.shirt },
    { bone: B.chest, w: 0.42 * bulk, h: 0.3, d: 0.23 * bulk, x: 0, y: 1.37, z: 0, color: torso },
    { bone: B.neck, w: 0.1, h: 0.1, d: 0.1, x: 0, y: 1.54, z: 0, color: a.skin },
    { bone: B.head, w: 0.2, h: 0.24, d: 0.22, x: 0, y: 1.68, z: -0.01, color: a.skin },
    { bone: B.head, w: 0.215, h: 0.08, d: 0.235, x: 0, y: 1.79, z: 0.005, color: a.hair },
    { bone: B.head, w: 0.21, h: 0.12, d: 0.05, x: 0, y: 1.72, z: 0.11, color: a.hair },
    { bone: B.lUpper, w: 0.11 * bulk, h: 0.3, d: 0.11 * bulk, x: -0.21, y: 1.31, z: 0, color: torso },
    { bone: B.lFore, w: 0.09, h: 0.27, d: 0.09, x: -0.21, y: 1.02, z: 0, color: a.jacket ? a.jacket : a.skin },
    { bone: B.lFore, w: 0.08, h: 0.1, d: 0.06, x: -0.21, y: 0.84, z: 0, color: a.skin },
    { bone: B.rUpper, w: 0.11 * bulk, h: 0.3, d: 0.11 * bulk, x: 0.21, y: 1.31, z: 0, color: torso },
    { bone: B.rFore, w: 0.09, h: 0.27, d: 0.09, x: 0.21, y: 1.02, z: 0, color: a.jacket ? a.jacket : a.skin },
    { bone: B.rFore, w: 0.08, h: 0.1, d: 0.06, x: 0.21, y: 0.84, z: 0, color: a.skin },
    { bone: B.lThigh, w: 0.15 * bulk, h: 0.44, d: 0.16 * bulk, x: -0.1, y: 0.69, z: 0, color: a.pants },
    { bone: B.lShin, w: 0.12, h: 0.42, d: 0.13, x: -0.1, y: 0.27, z: 0, color: a.pants },
    { bone: B.lShin, w: 0.12, h: 0.08, d: 0.25, x: -0.1, y: 0.04, z: -0.05, color: shoes },
    { bone: B.rThigh, w: 0.15 * bulk, h: 0.44, d: 0.16 * bulk, x: 0.1, y: 0.69, z: 0, color: a.pants },
    { bone: B.rShin, w: 0.12, h: 0.42, d: 0.13, x: 0.1, y: 0.27, z: 0, color: a.pants },
    { bone: B.rShin, w: 0.12, h: 0.08, d: 0.25, x: 0.1, y: 0.04, z: -0.05, color: shoes },
  ];
  if (a.backpack !== undefined) parts.push({ bone: B.chest, w: 0.34, h: 0.4, d: 0.16, x: 0, y: 1.3, z: 0.19, color: a.backpack });
  if (a.infected) {
    // Torn, stained patches.
    parts.push({ bone: B.chest, w: 0.2, h: 0.14, d: 0.235 * bulk + 0.004, x: 0.08, y: 1.33, z: 0, color: 0x3a2a24 });
    parts.push({ bone: B.spine, w: 0.12, h: 0.1, d: 0.205 * bulk + 0.004, x: -0.08, y: 1.12, z: 0, color: a.skin });
    parts.push({ bone: B.head, w: 0.08, h: 0.04, d: 0.226, x: 0.03, y: 1.66, z: -0.01, color: 0x2a1410 });
  } else {
    // Eyes (a hint of a face).
    parts.push({ bone: B.head, w: 0.15, h: 0.025, d: 0.01, x: 0, y: 1.7, z: -0.122, color: 0x2a2420 });
  }

  const geos: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const g = new THREE.BoxGeometry(p.w, p.h, p.d);
    g.deleteAttribute('uv');
    g.translate(p.x, p.y, p.z);
    const n = g.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    const c = new THREE.Color(p.color);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      // Slightly darker undersides for shape definition.
      const k = pos.getY(i) < p.y ? 0.82 : 1;
      colors[i * 3] = c.r * k;
      colors[i * 3 + 1] = c.g * k;
      colors[i * 3 + 2] = c.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      skinIndex[i * 4] = p.bone;
      skinWeight[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  const h = a.height ?? 1;
  merged.scale(h, h, h);
  merged.computeBoundingSphere();
  merged.boundingSphere!.radius = 2.2 * h;
  geometryCache.set(key, merged);
  return merged;
}

function material(): THREE.MeshLambertMaterial {
  if (!sharedMaterial) sharedMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  return sharedMaterial;
}

/**
 * A skinned, procedurally animated humanoid built from boxes: one geometry and one draw
 * call per character. Infected, survivors and the protagonist all share this rig.
 */
export class HumanoidRig {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  readonly bones: THREE.Bone[];
  readonly rightHand = new THREE.Object3D();
  readonly pose: RigPose = defaultPose();
  private phase = 0;
  private readonly heightScale: number;
  private readonly posture: Posture;
  private readonly seed: number;
  private smoothedCrouch = 0;
  private smoothedAim = 0;
  private breath = 0;

  constructor(appearance: RigAppearance, seed = Math.random() * 1000) {
    this.seed = seed;
    this.heightScale = appearance.height ?? 1;
    this.posture = appearance.posture ?? 'upright';
    this.bones = JOINTS.map(() => new THREE.Bone());
    JOINTS.forEach((j, i) => {
      const bone = this.bones[i];
      bone.position.set(j.x * this.heightScale, j.y * this.heightScale, j.z * this.heightScale);
      bone.userData.rest = bone.position.clone();
      if (j.parent >= 0) this.bones[j.parent].add(bone);
    });
    const geo = buildGeometry(appearance);
    this.mesh = new THREE.SkinnedMesh(geo, material());
    this.mesh.add(this.bones[0]);
    this.mesh.bind(new THREE.Skeleton(this.bones));
    this.mesh.frustumCulled = true;
    this.body.add(this.mesh);
    this.root.add(this.body);
    this.rightHand.position.set(0, -0.3 * this.heightScale, 0);
    this.bones[B.rFore].add(this.rightHand);
  }

  get height(): number {
    return 1.75 * this.heightScale;
  }

  bone(name: keyof typeof B): THREE.Bone {
    return this.bones[B[name]];
  }

  setShadows(cast: boolean): void {
    this.mesh.castShadow = cast;
  }

  /** Procedural animation: gait cycles, posture, aiming, attacks, hit reactions, death. */
  animate(dt: number): void {
    const p = this.pose;
    const bones = this.bones;
    const hips = bones[B.hips];
    const spine = bones[B.spine];
    const chest = bones[B.chest];
    const neck = bones[B.neck];
    const head = bones[B.head];
    const lU = bones[B.lUpper];
    const lF = bones[B.lFore];
    const rU = bones[B.rUpper];
    const rF = bones[B.rFore];
    const lT = bones[B.lThigh];
    const lS = bones[B.lShin];
    const rT = bones[B.rThigh];
    const rS = bones[B.rShin];

    this.smoothedCrouch = damp(this.smoothedCrouch, p.crouch, 10, dt);
    this.smoothedAim = damp(this.smoothedAim, p.aim, 14, dt);
    const crouch = this.smoothedCrouch;
    const aim = this.smoothedAim;
    this.breath += dt;

    // Stride: advance the gait phase by distance travelled.
    const stride = p.gait === 'sprint' ? 1.5 : p.gait === 'run' ? 1.2 : 0.8;
    if (p.speed > 0.05) this.phase += (p.speed / stride) * Math.PI * dt;
    const moving = clamp01(p.speed / 1.2);
    const runAmt = p.gait === 'run' || p.gait === 'sprint' ? 1 : 0;
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const legAmp = lerp(0.45, 0.85, runAmt) * moving * (1 - crouch * 0.45);
    const limpL = p.limp ? 0.45 : 1;

    // Reset rotations.
    for (const b of bones) b.rotation.set(0, 0, 0);
    hips.position.copy(hips.userData.rest as THREE.Vector3);

    // Legs.
    lT.rotation.x = s * legAmp * limpL;
    rT.rotation.x = -s * legAmp;
    lS.rotation.x = -Math.max(0, -c) * legAmp * 1.3 * limpL;
    rS.rotation.x = -Math.max(0, c) * legAmp * 1.3;
    const bob = Math.abs(c) * 0.04 * moving * (1 + runAmt);
    hips.position.y += bob - 0.02 * moving;

    // Arms swing opposite to legs.
    const armAmp = lerp(0.35, 0.9, runAmt) * moving;
    lU.rotation.x = -s * armAmp;
    rU.rotation.x = s * armAmp;
    lF.rotation.x = 0.25 + runAmt * 0.9 * moving;
    rF.rotation.x = 0.25 + runAmt * 0.9 * moving;
    lU.rotation.z = -0.08;
    rU.rotation.z = 0.08;

    // Torso lean with speed, idle breathing.
    spine.rotation.x = -0.12 * runAmt * moving - (p.gait === 'sprint' ? 0.12 : 0);
    chest.rotation.x = Math.sin(this.breath * 1.6 + this.seed) * 0.02;
    chest.rotation.y = -s * 0.12 * moving;
    head.rotation.y = p.look;

    // Posture variants (infected).
    switch (this.posture) {
      case 'shamble':
        spine.rotation.x -= 0.32;
        neck.rotation.x += 0.35;
        head.rotation.z = Math.sin(this.seed) * 0.35 + Math.sin(this.breath * 0.7 + this.seed) * 0.08;
        lU.rotation.x += 0.35 + Math.sin(this.seed * 3) * 0.2;
        rU.rotation.x += 0.15;
        lU.rotation.z -= 0.1;
        hips.rotation.z = Math.sin(this.phase) * 0.06 * moving;
        break;
      case 'lean':
        spine.rotation.x -= 0.45;
        neck.rotation.x += 0.4;
        lU.rotation.x += 0.4;
        rU.rotation.x += 0.4;
        break;
      case 'hulk':
        spine.rotation.x -= 0.25;
        lU.rotation.z -= 0.35;
        rU.rotation.z += 0.35;
        neck.rotation.x += 0.2;
        break;
      case 'crouch':
        spine.rotation.x -= 0.6;
        neck.rotation.x += 0.55;
        lT.rotation.x += 0.5;
        rT.rotation.x += 0.5;
        lS.rotation.x -= 0.8;
        rS.rotation.x -= 0.8;
        hips.position.y -= 0.18 * this.heightScale;
        break;
      default:
        break;
    }

    // Crouch.
    if (crouch > 0.01) {
      hips.position.y -= 0.36 * crouch * this.heightScale;
      lT.rotation.x += 1.05 * crouch;
      rT.rotation.x += 1.05 * crouch;
      lS.rotation.x -= 1.7 * crouch;
      rS.rotation.x -= 1.7 * crouch;
      spine.rotation.x -= 0.25 * crouch;
    }

    // Melee-ready: weapon held low and forward.
    if (p.meleeReady > 0 && aim < 0.5) {
      rU.rotation.x += 0.35 * p.meleeReady;
      rF.rotation.x += 0.7 * p.meleeReady;
    }

    // Firearm aim: right arm forward with the gun, left arm supporting.
    if (aim > 0.01) {
      const pitch = p.aimPitch;
      rU.rotation.x = lerp(rU.rotation.x, Math.PI / 2 + pitch, aim);
      rU.rotation.z = lerp(rU.rotation.z, -0.05, aim);
      rF.rotation.x = lerp(rF.rotation.x, 0.05, aim);
      lU.rotation.x = lerp(lU.rotation.x, Math.PI / 2 + pitch - 0.15, aim);
      lU.rotation.z = lerp(lU.rotation.z, -0.55, aim);
      lF.rotation.x = lerp(lF.rotation.x, 0.35, aim);
      chest.rotation.y = lerp(chest.rotation.y, 0.2, aim);
      head.rotation.y = lerp(head.rotation.y, -0.2, aim);
      head.rotation.x = -pitch * 0.5 * aim;
    }

    // Reload: support hand comes to the gun.
    if (p.reload >= 0) {
      const k = Math.sin(clamp01(p.reload) * Math.PI);
      lU.rotation.x = lerp(lU.rotation.x, 0.9, k);
      lF.rotation.x = lerp(lF.rotation.x, 1.6, k);
      lU.rotation.z = lerp(lU.rotation.z, -0.6, k);
      rU.rotation.x = lerp(rU.rotation.x, 0.8, k);
      rF.rotation.x = lerp(rF.rotation.x, 0.9, k);
    }

    // Attacks.
    if (p.attack >= 0) {
      const t = clamp01(p.attack);
      if (p.attackStyle === 'swing') {
        // Wind up overhead, strike down and across, recover.
        const wind = t < 0.35 ? t / 0.35 : 1;
        const strike = t < 0.35 ? 0 : t < 0.6 ? (t - 0.35) / 0.25 : 1;
        const recover = t < 0.6 ? 0 : (t - 0.6) / 0.4;
        const arm = lerp(lerp(0.3, 2.7, wind), 0.4, strike);
        rU.rotation.x = lerp(arm, rU.rotation.x, recover);
        rU.rotation.z = lerp(0.4 * wind - 0.6 * strike, rU.rotation.z, recover);
        rF.rotation.x = lerp(0.6 * (1 - strike), rF.rotation.x, recover);
        chest.rotation.y += lerp(0.5 * wind - 0.7 * strike, 0, recover);
        spine.rotation.x -= 0.25 * strike * (1 - recover);
      } else if (p.attackStyle === 'stab' || p.attackStyle === 'shove') {
        const thrust = Math.sin(t * Math.PI);
        rU.rotation.x = lerp(rU.rotation.x, 1.45, thrust);
        rF.rotation.x = lerp(rF.rotation.x, 0.1, thrust);
        lU.rotation.x = lerp(lU.rotation.x, 1.2, thrust * (p.attackStyle === 'shove' ? 1 : 0.4));
        spine.rotation.x -= 0.3 * thrust;
      } else {
        // Infected claw / lunge with both arms.
        const reach = t < 0.6 ? t / 0.6 : 1 - (t - 0.6) / 0.4;
        lU.rotation.x = lerp(lU.rotation.x, 1.7, reach);
        rU.rotation.x = lerp(rU.rotation.x, 1.9, reach);
        lF.rotation.x = 0.2;
        rF.rotation.x = 0.2;
        spine.rotation.x -= 0.4 * reach;
        hips.position.z -= 0.15 * reach;
      }
    }

    // Hit flinch.
    if (p.hit > 0) {
      spine.rotation.x += 0.35 * p.hit;
      head.rotation.x += 0.4 * p.hit;
      lU.rotation.x -= 0.4 * p.hit;
      rU.rotation.x -= 0.3 * p.hit;
    }

    // Lying (dormant) or dying: rotate the whole body to the ground.
    const fall = Math.max(p.dead, p.lying);
    if (fall > 0) {
      const e = fall * fall * (3 - 2 * fall);
      this.body.rotation.x = (Math.PI / 2) * 0.97 * e;
      this.body.position.y = 0.14 * e;
      this.body.position.z = -0.1 * e;
      lU.rotation.x = lerp(lU.rotation.x, -0.4, e);
      rU.rotation.x = lerp(rU.rotation.x, 0.9, e);
      lU.rotation.z = lerp(lU.rotation.z, -0.9, e);
      rU.rotation.z = lerp(rU.rotation.z, 0.6, e);
      lT.rotation.x = lerp(lT.rotation.x, 0.15, e);
      rT.rotation.x = lerp(rT.rotation.x, -0.1, e);
      lS.rotation.x = lerp(lS.rotation.x, -0.2, e);
      rS.rotation.x = 0;
      hips.position.y = lerp(hips.position.y, (hips.userData.rest as THREE.Vector3).y, e);
      if (p.lying > 0 && p.dead <= 0) chest.rotation.x += Math.sin(this.breath * 1.2) * 0.03;
    } else {
      this.body.rotation.x = 0;
      this.body.position.set(0, 0, 0);
    }
  }
}

/** Distinct infected looks from archetype palettes and a seed. */
export function infectedAppearance(skinTones: number[], clothTones: number[], posture: Posture, seed: number, scale = 1): RigAppearance {
  const pick = (arr: number[], k: number) => arr[Math.abs(Math.floor(seed * 7.31 + k * 3.7)) % arr.length];
  return {
    skin: pick(skinTones, 1),
    shirt: pick(clothTones, 2),
    pants: pick(clothTones, 5),
    hair: [0x2a2420, 0x4a3a2a, 0x6a6258, 0x1a1816][Math.abs(Math.floor(seed * 13.7)) % 4],
    height: scale * (0.94 + ((seed * 9.13) % 1) * 0.1),
    bulk: posture === 'hulk' ? 1.45 : 1,
    posture,
    infected: true,
  };
}
