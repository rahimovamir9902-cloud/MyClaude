import type { LevelDef, Rect } from '../world/LevelTypes';
import type { HudSnapshot } from '../game/GameSession';
import type { ObjectiveView } from '../systems/MissionSystem';

const PPM = 3; // static map pixels per meter

const GROUND_COLORS: Record<string, string> = {
  asphalt: '#3a3c3e', concrete: '#6a6864', gravel: '#56524a', dirt: '#5a4a36', grass: '#3e4a2e', floor: '#7a766c',
};

export interface Ping {
  x: number;
  z: number;
  age: number;
  color: string;
}

/**
 * Paints the level once into an offscreen canvas (roads, lots, buildings, fences, forests,
 * cover) and draws it as a rotating minimap and a full-screen map with objective markers.
 */
export class MapRenderer {
  readonly image: HTMLCanvasElement;
  private readonly b: Rect;

  constructor(private readonly level: LevelDef) {
    this.b = level.bounds;
    const w = Math.ceil((this.b.x1 - this.b.x0) * PPM);
    const h = Math.ceil((this.b.z1 - this.b.z0) * PPM);
    this.image = document.createElement('canvas');
    this.image.width = w;
    this.image.height = h;
    this.paint(this.image.getContext('2d')!);
  }

  private px(x: number): number {
    return (x - this.b.x0) * PPM;
  }

  private pz(z: number): number {
    return (z - this.b.z0) * PPM;
  }

  private rect(g: CanvasRenderingContext2D, r: Rect, fill: string): void {
    g.fillStyle = fill;
    g.fillRect(this.px(r.x0), this.pz(r.z0), (r.x1 - r.x0) * PPM, (r.z1 - r.z0) * PPM);
  }

  private paint(g: CanvasRenderingContext2D): void {
    const L = this.level;
    g.fillStyle = '#323a28';
    g.fillRect(0, 0, this.image.width, this.image.height);
    for (const f of L.forests) this.rect(g, f.rect, 'rgba(22,32,20,0.85)');
    for (const gr of L.grass) if (gr.tall) this.rect(g, gr.rect, 'rgba(110,128,70,0.55)');
    for (const p of L.ground) this.rect(g, p.rect, GROUND_COLORS[p.surface] ?? '#444');
    for (const r of L.roads) {
      this.rect(g, r.rect, '#2c2e30');
      g.strokeStyle = 'rgba(216,180,64,0.55)';
      g.setLineDash([6, 8]);
      g.lineWidth = 1;
      g.beginPath();
      if (r.axis === 'z') {
        const cx = this.px((r.rect.x0 + r.rect.x1) / 2);
        g.moveTo(cx, this.pz(r.rect.z0));
        g.lineTo(cx, this.pz(r.rect.z1));
      } else {
        const cz = this.pz((r.rect.z0 + r.rect.z1) / 2);
        g.moveTo(this.px(r.rect.x0), cz);
        g.lineTo(this.px(r.rect.x1), cz);
      }
      g.stroke();
      g.setLineDash([]);
    }
    for (const f of L.fences) {
      g.strokeStyle = f.kind === 'guardrail' ? 'rgba(170,170,165,0.6)' : f.kind === 'wood' ? 'rgba(150,115,80,0.8)' : 'rgba(190,190,190,0.7)';
      g.lineWidth = 1.2;
      g.setLineDash(f.kind === 'chainlink' ? [3, 2] : []);
      g.beginPath();
      g.moveTo(this.px(f.x0), this.pz(f.z0));
      g.lineTo(this.px(f.x1), this.pz(f.z1));
      g.stroke();
      g.setLineDash([]);
    }
    for (const v of [...L.vehicles, L.extraction.vehicle]) {
      const len = v.type === 'semiTrailer' ? 12.5 : v.type === 'semiCab' ? 5.6 : 4.8;
      const wid = v.type === 'semiTrailer' || v.type === 'semiCab' ? 2.6 : 1.9;
      g.save();
      g.translate(this.px(v.x), this.pz(v.z));
      g.rotate(-v.rot);
      g.fillStyle = v.id === L.extraction.vehicle.id ? '#86ad74' : 'rgba(150,150,150,0.75)';
      g.fillRect((-wid / 2) * PPM, (-len / 2) * PPM, wid * PPM, len * PPM);
      g.restore();
    }
    for (const bd of L.buildings) {
      this.rect(g, bd.rect, '#8a8678');
      g.strokeStyle = '#1a1a1a';
      g.lineWidth = 2;
      g.strokeRect(this.px(bd.rect.x0), this.pz(bd.rect.z0), (bd.rect.x1 - bd.rect.x0) * PPM, (bd.rect.z1 - bd.rect.z0) * PPM);
      g.strokeStyle = 'rgba(30,30,30,0.6)';
      g.lineWidth = 1;
      for (const w of bd.interiorWalls ?? []) {
        g.beginPath();
        g.moveTo(this.px(w.x0), this.pz(w.z0));
        g.lineTo(this.px(w.x1), this.pz(w.z1));
        g.stroke();
      }
      g.fillStyle = '#16181a';
      g.font = `bold ${Math.round(PPM * 2.6)}px Arial, sans-serif`;
      g.textAlign = 'center';
      g.fillText(bd.name.toUpperCase(), this.px((bd.rect.x0 + bd.rect.x1) / 2), this.pz((bd.rect.z0 + bd.rect.z1) / 2) + 3, (bd.rect.x1 - bd.rect.x0) * PPM - 4);
    }
    for (const p of L.props) {
      if (p.type === 'canopy') {
        g.strokeStyle = 'rgba(220,220,210,0.5)';
        g.lineWidth = 1;
        const w = p.w ?? 14;
        const d = p.d ?? 12;
        g.strokeRect(this.px(p.x - w / 2), this.pz(p.z - d / 2), w * PPM, d * PPM);
      }
    }
  }

  /** Rotating minimap centred on the player; north rotates with the camera. */
  drawMini(canvas: HTMLCanvasElement, hud: HudSnapshot, pings: Ping[]): void {
    const g = canvas.getContext('2d')!;
    const size = canvas.width;
    const r = size / 2;
    const zoom = size / 116 * 2.0; // ~2 CSS px per meter
    const s = zoom / PPM;
    g.clearRect(0, 0, size, size);
    g.save();
    g.beginPath();
    g.arc(r, r, r - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#1a1e16';
    g.fillRect(0, 0, size, size);
    g.translate(r, r);
    g.rotate(hud.camYaw);
    g.save();
    g.scale(s, s);
    g.globalAlpha = 0.95;
    g.drawImage(this.image, -this.px(hud.playerX), -this.pz(hud.playerZ));
    g.restore();
    const toLocal = (x: number, z: number) => ({ x: (x - hud.playerX) * zoom, y: (z - hud.playerZ) * zoom });

    // Player noise radius: how far your last sound carried.
    if (hud.noiseRadius > 0.5) {
      g.strokeStyle = hud.noiseRadius > 25 ? 'rgba(207,74,51,0.85)' : 'rgba(232,226,212,0.55)';
      g.lineWidth = 1.5 * (size / 116);
      g.beginPath();
      g.arc(0, 0, hud.noiseRadius * zoom, 0, Math.PI * 2);
      g.stroke();
    }
    for (const p of pings) {
      const l = toLocal(p.x, p.z);
      g.strokeStyle = p.color.replace('ALPHA', String(Math.max(0, 1 - p.age / 3)));
      g.lineWidth = 2 * (size / 116);
      g.beginPath();
      g.arc(l.x, l.y, (4 + p.age * 6) * (size / 116), 0, Math.PI * 2);
      g.stroke();
    }
    for (const o of hud.objectives) this.marker(g, o, toLocal, r - 7 * (size / 116), size / 116);
    // Player arrow.
    g.rotate(-hud.playerYaw);
    g.fillStyle = '#e8e2d4';
    g.beginPath();
    const a = 6 * (size / 116);
    g.moveTo(0, -a * 1.3);
    g.lineTo(a * 0.8, a);
    g.lineTo(0, a * 0.45);
    g.lineTo(-a * 0.8, a);
    g.closePath();
    g.fill();
    g.restore();
    // North tick.
    g.save();
    g.translate(r, r);
    g.rotate(hud.camYaw);
    g.fillStyle = 'rgba(232,163,61,0.9)';
    g.font = `bold ${Math.round(10 * (size / 116))}px Arial`;
    g.textAlign = 'center';
    g.fillText('N', 0, -r + 12 * (size / 116));
    g.restore();
  }

  private marker(g: CanvasRenderingContext2D, o: ObjectiveView, toLocal: (x: number, z: number) => { x: number; y: number }, clampR: number, k: number): void {
    if (o.status !== 'active' || !o.marker) return;
    let { x, y } = toLocal(o.marker.x, o.marker.z);
    const d = Math.hypot(x, y);
    if (d > clampR) {
      x = (x / d) * clampR;
      y = (y / d) * clampR;
    }
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI / 4);
    const s = (o.kind === 'primary' || o.kind === 'extraction' ? 6 : 4.5) * k;
    g.fillStyle = o.kind === 'extraction' ? '#86ad74' : o.kind === 'primary' ? '#e8a33d' : 'rgba(232,226,212,0.8)';
    g.strokeStyle = '#000';
    g.lineWidth = 1;
    g.fillRect(-s / 2, -s / 2, s, s);
    g.strokeRect(-s / 2, -s / 2, s, s);
    g.restore();
  }

  /** Full map, north up, fitted to the canvas. */
  drawFull(canvas: HTMLCanvasElement, hud: HudSnapshot): void {
    const g = canvas.getContext('2d')!;
    const k = Math.min(canvas.width / this.image.width, canvas.height / this.image.height);
    const ox = (canvas.width - this.image.width * k) / 2;
    const oy = (canvas.height - this.image.height * k) / 2;
    g.fillStyle = '#15181a';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(this.image, ox, oy, this.image.width * k, this.image.height * k);
    const toMap = (x: number, z: number) => ({ x: ox + this.px(x) * k, y: oy + this.pz(z) * k });
    for (const o of hud.objectives) {
      if (o.status !== 'active' || !o.marker) continue;
      const p = toMap(o.marker.x, o.marker.z);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(Math.PI / 4);
      const s = 10;
      g.fillStyle = o.kind === 'extraction' ? '#86ad74' : o.kind === 'primary' ? '#e8a33d' : '#d8d2c4';
      g.strokeStyle = '#000';
      g.fillRect(-s / 2, -s / 2, s, s);
      g.strokeRect(-s / 2, -s / 2, s, s);
      g.restore();
    }
    const p = toMap(hud.playerX, hud.playerZ);
    g.save();
    g.translate(p.x, p.y);
    g.rotate(-hud.playerYaw);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#000';
    g.beginPath();
    g.moveTo(0, -11);
    g.lineTo(7, 8);
    g.lineTo(0, 4);
    g.lineTo(-7, 8);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    g.fillStyle = 'rgba(232,163,61,0.95)';
    g.font = 'bold 16px Arial';
    g.fillText('N', ox + 8, oy + 20);
  }
}
