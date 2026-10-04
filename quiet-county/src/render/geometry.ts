import * as THREE from 'three';

/**
 * Geometry helpers whose UVs are in world meters, so a material's texture keeps the same
 * texel density on every object regardless of its size (required for batching).
 */

export function boxGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z (4 vertices each).
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  return g;
}

export function cylinderGeo(rTop: number, rBottom: number, h: number, segments = 8, open = false): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments, 1, open);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const index = g.index!;
  const circ = Math.PI * (rTop + rBottom);
  const capScale = 2 * Math.max(rTop, rBottom);
  const done = new Uint8Array(uv.count);
  // Group 0 is the side wall; later groups are the caps.
  g.groups.forEach((group, gi) => {
    for (let k = group.start; k < group.start + group.count; k++) {
      const i = index.getX(k);
      if (done[i]) continue;
      done[i] = 1;
      if (gi === 0) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
      else uv.setXY(i, uv.getX(i) * capScale, uv.getY(i) * capScale);
    }
  });
  return g;
}

export function coneGeo(r: number, h: number, segments = 8): THREE.BufferGeometry {
  return cylinderGeo(0.001, r, h, segments);
}

/** Horizontal plane (facing up) of size w x d. */
export function groundPlaneGeo(w: number, d: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d);
  return g;
}

/** Vertical plane facing +Z of size w x h, with 0..1 UVs (signs, decals). */
export function signPlaneGeo(w: number, h: number): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(w, h);
}

export function blobGeo(r: number, detail = 0): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 4, uv.getY(i) * r * 2);
  return g;
}

/** Ensures a geometry has an index so it can merge with indexed geometries. */
export function ensureIndexed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (g.index) return g;
  const n = g.getAttribute('position').count;
  const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Fills a per-vertex color attribute (optionally darker toward the bottom for fake AO). */
export function paintVertexColors(g: THREE.BufferGeometry, hex: number, bottomShade = 0): void {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const c = new THREE.Color(hex);
  let minY = Infinity;
  let maxY = -Infinity;
  if (bottomShade > 0) {
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  for (let i = 0; i < n; i++) {
    let k = 1;
    if (bottomShade > 0 && maxY > minY) k = 1 - bottomShade * (1 - (pos.getY(i) - minY) / (maxY - minY));
    colors[i * 3] = c.r * k;
    colors[i * 3 + 1] = c.g * k;
    colors[i * 3 + 2] = c.b * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
