import * as THREE from 'three';
import { clamp, damp, dampAngle, DEG2RAD } from '../core/math';
import { CF, type PhysicsWorld } from '../world/Physics';

export interface CameraTarget {
  x: number;
  y: number;
  z: number;
  crouched: boolean;
  aiming: boolean;
  alive: boolean;
}

/**
 * Over-the-shoulder orbit camera: yaw/pitch from look input, shoulder offset that tightens
 * when aiming, collision against walls so it never clips, recoil kick and trauma shake.
 */
export class ThirdPersonCamera {
  yaw = 0;
  pitch = -0.12;
  readonly camera: THREE.PerspectiveCamera;
  private distance = 3.4;
  private shoulder = 0.42;
  private pivotY = 1.55;
  private recoil = 0;
  private trauma = 0;
  private time = 0;
  private readonly pivot = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  readonly forward = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private baseFov = 62;
  /** Distance from the pivot after collision (small = pressed against a wall). */
  actualDistance = 3.4;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  setBaseFov(fov: number): void {
    this.baseFov = fov;
  }

  /** Adds look input in radians. */
  look(dYaw: number, dPitch: number): void {
    this.yaw -= dYaw;
    this.pitch = clamp(this.pitch - dPitch, -1.05, 0.75);
  }

  kick(degrees: number): void {
    this.recoil += degrees * DEG2RAD;
  }

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  snapBehind(yaw: number): void {
    this.yaw = yaw;
    this.pitch = -0.12;
  }

  update(dt: number, target: CameraTarget, physics: PhysicsWorld): void {
    this.time += dt;
    const aim = target.aiming && target.alive;
    this.distance = damp(this.distance, aim ? 1.65 : target.alive ? 3.4 : 4.5, 9, dt);
    this.shoulder = damp(this.shoulder, aim ? 0.55 : 0.42, 9, dt);
    this.pivotY = damp(this.pivotY, target.crouched ? 1.05 : target.alive ? 1.55 : 0.6, 8, dt);
    this.camera.fov = damp(this.camera.fov, aim ? this.baseFov - 14 : this.baseFov, 10, dt);
    this.camera.updateProjectionMatrix();

    // Recoil kicks pitch up, then recovers.
    const kick = this.recoil;
    this.recoil = damp(this.recoil, 0, 9, dt);
    const pitch = clamp(this.pitch + kick, -1.1, 0.85);

    const cp = Math.cos(pitch);
    this.forward.set(-Math.sin(this.yaw) * cp, Math.sin(pitch), -Math.cos(this.yaw) * cp);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);

    this.pivot.set(target.x + rightX * this.shoulder, target.y + this.pivotY, target.z + rightZ * this.shoulder);
    this.desired.copy(this.pivot).addScaledVector(this.forward, -this.distance);

    // Pull in when a wall is between the pivot and the camera.
    const dx = this.desired.x - this.pivot.x;
    const dy = this.desired.y - this.pivot.y;
    const dz = this.desired.z - this.pivot.z;
    const len = Math.hypot(dx, dy, dz);
    const hit = physics.raycast(this.pivot.x, this.pivot.y, this.pivot.z, dx / len, dy / len, dz / len, len + 0.2, CF.Camera);
    let dist = len;
    if (hit) dist = Math.max(0.35, hit.t - 0.25);
    this.actualDistance = dist;
    this.camera.position.copy(this.pivot).addScaledVector(this.forward, -dist);
    if (this.camera.position.y < 0.25) this.camera.position.y = 0.25;

    // Trauma shake (squared falloff feels natural).
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    const shakeYaw = s * 0.04 * Math.sin(this.time * 47.3);
    const shakePitch = s * 0.04 * Math.sin(this.time * 39.7 + 1.3);
    const look = this.lookTarget.copy(this.camera.position).addScaledVector(this.forward, 10);
    look.x += shakeYaw * 10;
    look.y += shakePitch * 10;
    this.camera.lookAt(look);
  }

  /** Smoothly turns the camera to face a yaw (used after vaulting, etc.). */
  steerTowards(yaw: number, dt: number, rate = 3): void {
    this.yaw = dampAngle(this.yaw, yaw, rate, dt);
  }

  /** Ray from the camera through the crosshair. */
  aimRay(origin: THREE.Vector3, dir: THREE.Vector3): void {
    origin.copy(this.camera.position);
    this.camera.getWorldDirection(dir);
  }
}
