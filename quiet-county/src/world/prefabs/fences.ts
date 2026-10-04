import { CF } from '../Physics';
import type { FenceDef } from '../LevelTypes';
import { PropBuilder, type BuildContext } from './PropBuilder';

/**
 * Fences and rails. All are low enough to vault, which infected cannot do, so they double as
 * escape routes. Chain-link and rails do not block sight or bullets.
 */
export function buildFence(ctx: BuildContext, def: FenceDef): void {
  const dx = def.x1 - def.x0;
  const dz = def.z1 - def.z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return;
  const ux = dx / len;
  const uz = dz / len;
  const rot = Math.atan2(-uz, ux);
  const gaps = (def.gaps ?? []).slice().sort((a, b) => a.at - b.at);
  const spans: [number, number][] = [];
  let cursor = 0;
  for (const g of gaps) {
    if (g.at > cursor) spans.push([cursor, Math.min(g.at, len)]);
    cursor = Math.max(cursor, g.at + g.width);
  }
  if (cursor < len) spans.push([cursor, len]);

  const height = def.kind === 'chainlink' ? 1.25 : def.kind === 'wood' ? 1.1 : 0.8;
  const postSpacing = def.kind === 'guardrail' ? 3.8 : 2.5;
  for (const [s0, s1] of spans) {
    const spanLen = s1 - s0;
    if (spanLen < 0.05) continue;
    const mid = (s0 + s1) / 2;
    const b = new PropBuilder(ctx, def.x0 + ux * mid, def.z0 + uz * mid, rot);
    const posts = Math.max(1, Math.round(spanLen / postSpacing));
    for (let i = 0; i <= posts; i++) {
      const px = -spanLen / 2 + (i / posts) * spanLen;
      if (def.kind === 'chainlink') b.cyl(px, height / 2, 0, 0.035, 0.035, height, 6, 'paint', 0x8a8c8a);
      else if (def.kind === 'wood') b.block(px, 0, 0, 0.12, height, 0.12, 'wood', 0x6a5236);
      else b.block(px, 0, 0.12, 0.1, 0.75, 0.1, 'rust', 0x6a6a68);
    }
    if (def.kind === 'chainlink') {
      b.box(0, height / 2 + 0.02, 0, spanLen, height - 0.04, 0.01, 'chainlink', 0xb0b2b0);
      b.cyl(0, height, 0, 0.025, 0.025, spanLen, 5, 'paint', 0x8a8c8a, { rotZ: Math.PI / 2 });
    } else if (def.kind === 'wood') {
      b.box(0, 0.45, 0, spanLen, 0.12, 0.05, 'wood', 0x7a6044);
      b.box(0, 0.9, 0, spanLen, 0.12, 0.05, 'wood', 0x7a6044);
    } else {
      b.box(0, 0.6, 0, spanLen, 0.32, 0.06, 'rust', 0xa8aaa6);
    }
    b.collider(0, 0, spanLen / 2, 0.12, CF.Move | CF.Vault, 0, height);
  }
}
