import { Random } from '../core/Random';

/**
 * Original procedural textures painted on canvases at load time. Every surface in the game
 * comes from these functions: no external image assets are used anywhere.
 * All patterns tile seamlessly (noise lattices and strokes wrap around the edges).
 */

type RGB = [number, number, number];

/** Tileable value noise with smooth interpolation. */
function makeNoise(period: number, rng: Random): (u: number, v: number) => number {
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
  return (u: number, v: number) => {
    const x = (((u % 1) + 1) % 1) * period;
    const y = (((v % 1) + 1) % 1) * period;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = grid[y0 * period + x0];
    const b = grid[y0 * period + x1];
    const c = grid[y1 * period + x0];
    const d = grid[y1 * period + x1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function makeFbm(rng: Random, basePeriod: number, octaves: number): (u: number, v: number) => number {
  const layers = Array.from({ length: octaves }, (_, i) => makeNoise(basePeriod << i, rng));
  return (u, v) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (const n of layers) {
      sum += n(u, v) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

class Painter {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly size: number;

  constructor(size: number) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** Per-pixel shader; u,v in [0,1). */
  shade(fn: (u: number, v: number, x: number, y: number) => RGB | [number, number, number, number]): void {
    const s = this.size;
    const img = this.ctx.createImageData(s, s);
    const d = img.data;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const c = fn(x / s, y / s, x, y);
        const i = (y * s + x) * 4;
        d[i] = clampByte(c[0]);
        d[i + 1] = clampByte(c[1]);
        d[i + 2] = clampByte(c[2]);
        d[i + 3] = c.length > 3 ? clampByte((c as number[])[3]) : 255;
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }

  /** Draw with wrap-around so strokes near edges tile. */
  wrapped(draw: (ctx: CanvasRenderingContext2D) => void): void {
    const s = this.size;
    for (const ox of [-s, 0, s]) {
      for (const oy of [-s, 0, s]) {
        this.ctx.save();
        this.ctx.translate(ox, oy);
        draw(this.ctx);
        this.ctx.restore();
      }
    }
  }

  cracks(rng: Random, count: number, color: string, width: number, length: number): void {
    const s = this.size;
    const paths: { x: number; y: number }[][] = [];
    for (let i = 0; i < count; i++) {
      let x = rng.next() * s;
      let y = rng.next() * s;
      let a = rng.next() * Math.PI * 2;
      const pts = [{ x, y }];
      const steps = 6 + rng.int(0, 10);
      for (let j = 0; j < steps; j++) {
        a += rng.range(-0.8, 0.8);
        x += Math.cos(a) * (length / steps) * s;
        y += Math.sin(a) * (length / steps) * s;
        pts.push({ x, y });
      }
      paths.push(pts);
    }
    this.wrapped((ctx) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      for (const pts of paths) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts) ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    });
  }

  stains(rng: Random, count: number, rgba: string, minR: number, maxR: number): void {
    const s = this.size;
    const spots = Array.from({ length: count }, () => ({ x: rng.next() * s, y: rng.next() * s, r: rng.range(minR, maxR) * s }));
    this.wrapped((ctx) => {
      for (const p of spots) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, rgba);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    });
  }
}

export type TextureId =
  | 'asphalt'
  | 'concrete'
  | 'siding'
  | 'brick'
  | 'wood'
  | 'rust'
  | 'corrugated'
  | 'tile'
  | 'grass'
  | 'dirt'
  | 'gravel'
  | 'paint'
  | 'shingle'
  | 'foliage'
  | 'glass'
  | 'fabric'
  | 'grassBlade'
  | 'chainlink'
  | 'roadLine'
  | 'mottle';

export function paintTexture(id: TextureId, size: number, seed = 1): HTMLCanvasElement {
  const rng = new Random(seed * 7919 + id.length * 104729 + id.charCodeAt(0));
  const p = new Painter(size);
  switch (id) {
    case 'asphalt': {
      const n = makeFbm(rng, 4, 5);
      const speck = makeNoise(Math.max(8, size >> 1), rng);
      p.shade((u, v) => {
        const k = n(u, v) * 34 - 17;
        const s = speck(u, v) > 0.86 ? 26 : 0;
        const base = 58 + k + s;
        return [base, base + 1, base + 3];
      });
      p.stains(rng, 4, 'rgba(10,10,12,0.35)', 0.05, 0.16);
      p.cracks(rng, 5, 'rgba(18,18,20,0.9)', Math.max(1, size / 200), 0.45);
      break;
    }
    case 'concrete': {
      const n = makeFbm(rng, 3, 5);
      const blot = makeNoise(4, rng);
      p.shade((u, v) => {
        const k = n(u, v) * 36 - 18 + (blot(u, v) - 0.5) * 22;
        return [150 + k, 147 + k, 140 + k];
      });
      p.cracks(rng, 3, 'rgba(70,68,64,0.8)', Math.max(1, size / 256), 0.3);
      p.ctx.strokeStyle = 'rgba(90,88,84,0.6)';
      p.ctx.lineWidth = Math.max(1, size / 128);
      p.ctx.strokeRect(0, 0, size, size);
      break;
    }
    case 'siding': {
      const n = makeFbm(rng, 4, 4);
      const planks = 8;
      const shades = Array.from({ length: planks }, () => rng.range(-10, 10));
      p.shade((u, v) => {
        const row = Math.floor(v * planks);
        const f = v * planks - row;
        const edge = f > 0.88 ? -46 : f < 0.06 ? 14 : 0;
        const k = n(u * 2, v) * 26 - 13 + shades[row] + edge;
        return [212 + k, 208 + k, 198 + k];
      });
      p.stains(rng, 5, 'rgba(60,55,40,0.18)', 0.08, 0.25);
      break;
    }
    case 'brick': {
      const n = makeFbm(rng, 6, 3);
      const rows = 8;
      const cols = 4;
      const tint = Array.from({ length: rows * cols * 2 }, () => rng.range(-18, 18));
      p.shade((u, v) => {
        const r = Math.floor(v * rows);
        const off = r % 2 ? 0.5 / cols : 0;
        const cu = ((u + off) % 1) * cols;
        const c = Math.floor(cu);
        const fu = cu - c;
        const fv = v * rows - r;
        const mortar = fu < 0.05 || fv < 0.1;
        const k = n(u, v) * 20 - 10;
        if (mortar) return [168 + k, 162 + k, 150 + k];
        const t = tint[r * cols + c];
        return [138 + t + k, 70 + t * 0.5 + k, 54 + k];
      });
      break;
    }
    case 'wood': {
      const grain = makeFbm(rng, 4, 4);
      const planks = 5;
      const tint = Array.from({ length: planks }, () => rng.range(-16, 16));
      p.shade((u, v) => {
        const c = Math.floor(u * planks);
        const fu = u * planks - c;
        const g = grain(u * 3 + c * 0.37, v * 0.5) * 40 - 20;
        const ring = Math.sin((v * 20 + grain(u, v) * 8) * Math.PI) * 6;
        const edge = fu < 0.04 || fu > 0.96 ? -40 : 0;
        // Light, warm base so per-object vertex tints read correctly.
        const t = tint[c] + g + ring + edge;
        return [206 + t, 184 + t * 0.9, 156 + t * 0.8];
      });
      break;
    }
    case 'rust': {
      const n = makeFbm(rng, 4, 5);
      const r = makeFbm(rng, 3, 4);
      p.shade((u, v) => {
        const k = n(u, v) * 30 - 15;
        // Rust blooms plus faint vertical run-off streaks.
        const rust = Math.max(0, r(u, v) - 0.48) * 4 + Math.max(0, r(u * 0.2, v * 3) - 0.6) * 1.5;
        return [176 + k + rust * 60, 172 + k + rust * 6, 166 + k - rust * 50];
      });
      break;
    }
    case 'corrugated': {
      const n = makeFbm(rng, 4, 4);
      const r = makeFbm(rng, 3, 4);
      p.shade((u, v) => {
        const wave = Math.sin(u * Math.PI * 2 * 10) * 26;
        const rust = Math.max(0, r(u, v * 0.3) - 0.5) * 3;
        const k = n(u, v) * 20 - 10 + wave;
        return [150 + k + rust * 60, 152 + k + rust * 8, 150 + k - rust * 30];
      });
      break;
    }
    case 'tile': {
      const n = makeFbm(rng, 4, 4);
      const tiles = 4;
      const tint = Array.from({ length: tiles * tiles }, () => rng.range(-8, 8));
      p.shade((u, v) => {
        const cx = Math.floor(u * tiles);
        const cy = Math.floor(v * tiles);
        const fu = u * tiles - cx;
        const fv = v * tiles - cy;
        const grout = fu < 0.04 || fv < 0.04;
        const k = n(u, v) * 30 - 15;
        if (grout) return [96 + k, 92 + k, 86 + k];
        const t = tint[cy * tiles + cx] + k;
        const check = (cx + cy) % 2 ? -14 : 0;
        return [196 + t + check, 190 + t + check, 176 + t + check];
      });
      p.stains(rng, 6, 'rgba(70,60,40,0.2)', 0.06, 0.2);
      break;
    }
    case 'grass': {
      const n = makeFbm(rng, 4, 5);
      const dry = makeFbm(rng, 3, 3);
      const speck = makeNoise(Math.max(16, size >> 2), rng);
      p.shade((u, v) => {
        const k = n(u, v) * 40 - 20;
        const d = Math.max(0, dry(u, v) - 0.52) * 3;
        const s = (speck(u, v) - 0.5) * 24;
        return [72 + k + d * 50 + s, 84 + k + d * 26 + s, 46 + k + d * 18];
      });
      break;
    }
    case 'dirt': {
      const n = makeFbm(rng, 4, 5);
      const speck = makeNoise(Math.max(16, size >> 1), rng);
      p.shade((u, v) => {
        const k = n(u, v) * 36 - 18;
        const s = speck(u, v) > 0.8 ? 22 : speck(u, v) < 0.15 ? -16 : 0;
        return [104 + k + s, 86 + k + s, 64 + k + s * 0.8];
      });
      break;
    }
    case 'gravel': {
      const n = makeFbm(rng, 6, 3);
      const speck = makeNoise(Math.max(16, size >> 1), rng);
      const speck2 = makeNoise(Math.max(16, size >> 2), rng);
      p.shade((u, v) => {
        const k = n(u, v) * 22 - 11 + (speck(u, v) - 0.5) * 50 + (speck2(u, v) - 0.5) * 30;
        return [122 + k, 118 + k, 110 + k];
      });
      break;
    }
    case 'paint': {
      const n = makeFbm(rng, 4, 4);
      p.shade((u, v) => {
        const k = n(u, v) * 18 - 9;
        return [226 + k, 226 + k, 224 + k];
      });
      p.stains(rng, 4, 'rgba(70,60,45,0.1)', 0.05, 0.18);
      p.cracks(rng, 3, 'rgba(120,115,110,0.35)', Math.max(1, size / 300), 0.1);
      break;
    }
    case 'shingle': {
      const n = makeFbm(rng, 6, 3);
      const rows = 10;
      const cols = 6;
      const tint = Array.from({ length: rows * cols * 2 }, () => rng.range(-12, 12));
      p.shade((u, v) => {
        const r = Math.floor(v * rows);
        const off = r % 2 ? 0.5 / cols : 0;
        const cu = ((u + off) % 1) * cols;
        const c = Math.floor(cu);
        const fv = v * rows - r;
        const gap = cu - c < 0.04;
        const k = n(u, v) * 16 - 8 + tint[r * cols + c] + (fv > 0.85 ? -18 : 0);
        if (gap) return [40, 38, 36];
        return [78 + k, 74 + k, 72 + k];
      });
      break;
    }
    case 'foliage': {
      const n = makeFbm(rng, 4, 5);
      const speck = makeNoise(Math.max(16, size >> 1), rng);
      p.shade((u, v) => {
        const k = n(u, v) * 50 - 25;
        const s = speck(u, v) > 0.7 ? 18 : 0;
        return [58 + k * 0.6 + s, 78 + k + s, 46 + k * 0.5];
      });
      break;
    }
    case 'glass': {
      const n = makeFbm(rng, 3, 4);
      p.shade((u, v) => {
        const streak = Math.max(0, Math.sin((u + v * 0.6) * Math.PI * 3)) * 22;
        const k = n(u, v) * 18 + streak;
        return [42 + k, 52 + k, 60 + k];
      });
      p.stains(rng, 5, 'rgba(120,110,90,0.25)', 0.08, 0.2);
      break;
    }
    case 'fabric': {
      const n = makeFbm(rng, 4, 4);
      p.shade((u, v, x, y) => {
        const weave = ((x + y) % 4 < 2 ? 6 : -6) + n(u, v) * 24 - 12;
        return [190 + weave, 190 + weave, 188 + weave];
      });
      break;
    }
    case 'grassBlade': {
      const ctx = p.ctx;
      ctx.clearRect(0, 0, size, size);
      const blades = 26;
      for (let i = 0; i < blades; i++) {
        const x = rng.range(0.08, 0.92) * size;
        const h = rng.range(0.55, 1) * size;
        const lean = rng.range(-0.25, 0.25) * size;
        const w = rng.range(0.025, 0.05) * size;
        const g = ctx.createLinearGradient(0, size, 0, size - h);
        const tone = rng.range(-20, 20);
        g.addColorStop(0, `rgb(${60 + tone},${72 + tone},${36})`);
        g.addColorStop(1, `rgb(${150 + tone},${150 + tone},${86 + tone})`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - w, size);
        ctx.quadraticCurveTo(x + lean * 0.3, size - h * 0.5, x + lean, size - h);
        ctx.quadraticCurveTo(x + lean * 0.3 + w * 0.3, size - h * 0.5, x + w, size);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'chainlink': {
      const ctx = p.ctx;
      ctx.clearRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(170,172,170,1)';
      ctx.lineWidth = Math.max(1, size / 64);
      const cells = 4;
      const step = size / cells;
      for (let i = -cells; i <= cells * 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * step, 0);
        ctx.lineTo(i * step + size, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(i * step + size, 0);
        ctx.lineTo(i * step, size);
        ctx.stroke();
      }
      break;
    }
    case 'mottle': {
      // Neutral light luminance pattern; hue comes from vertex/instance colors.
      const n = makeFbm(rng, 4, 5);
      const speck = makeNoise(Math.max(16, size >> 1), rng);
      p.shade((u, v) => {
        const k = 196 + (n(u, v) - 0.5) * 90 + (speck(u, v) > 0.72 ? 22 : 0);
        return [k, k, k];
      });
      break;
    }
    case 'roadLine': {
      const n = makeFbm(rng, 4, 3);
      p.shade((u, v) => {
        const k = n(u, v);
        const worn = k < 0.42 ? 0 : 255;
        return [235, 232, 220, worn];
      });
      break;
    }
  }
  return p.canvas;
}

export interface TextTextureOptions {
  width: number;
  height: number;
  background: string;
  color: string;
  font: string;
  lines: string[];
  border?: string;
  grime?: number;
  align?: 'center' | 'left';
}

/** Painted signage (store names, road signs, notes). */
export function paintText(opts: TextTextureOptions, seed = 3): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, opts.width, opts.height);
  if (opts.border) {
    ctx.strokeStyle = opts.border;
    ctx.lineWidth = Math.max(2, opts.height * 0.05);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, opts.width - ctx.lineWidth * 2, opts.height - ctx.lineWidth * 2);
  }
  ctx.fillStyle = opts.color;
  ctx.font = opts.font;
  ctx.textAlign = opts.align ?? 'center';
  ctx.textBaseline = 'middle';
  const lh = opts.height / (opts.lines.length + 1);
  opts.lines.forEach((line, i) => {
    const x = opts.align === 'left' ? opts.width * 0.06 : opts.width / 2;
    ctx.fillText(line, x, lh * (i + 1));
  });
  if (opts.grime) {
    const rng = new Random(seed);
    for (let i = 0; i < 40 * opts.grime; i++) {
      const x = rng.next() * opts.width;
      const y = rng.next() * opts.height;
      const r = rng.range(4, 30);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(40,32,20,${0.25 * opts.grime})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  return canvas;
}

/** Spray-painted wall text with drips (environmental storytelling). */
export function paintGraffiti(text: string, color: string, seed = 5): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 192);
  ctx.font = 'bold 92px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.save();
  ctx.translate(256, 92);
  ctx.rotate(-0.04);
  ctx.fillText(text, 0, 0, 480);
  ctx.restore();
  const rng = new Random(seed);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  for (let i = 0; i < 14; i++) {
    const x = rng.range(40, 470);
    const y = rng.range(110, 130);
    ctx.lineWidth = rng.range(2, 5);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rng.range(-2, 2), y + rng.range(10, 55));
    ctx.stroke();
  }
  return canvas;
}

/** Dark splatter decal with alpha. */
export function paintSplatter(seed = 9, rgb: RGB = [70, 12, 10]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rng = new Random(seed);
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 22; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.next() * 80 * rng.next();
    const x = 128 + Math.cos(a) * d;
    const y = 128 + Math.sin(a) * d;
    const r = rng.range(6, 38) * (1 - d / 110);
    ctx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${rng.range(0.55, 0.9)})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, r), 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}
