import { expect, type Page } from '@playwright/test';

/** Collects console errors so every test can assert a clean run. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** Boots to the main menu (tapping through the start screen). */
export async function bootToMenu(page: Page, query = 'debug=1'): Promise<void> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => !!(window as unknown as { __QC?: unknown }).__QC);
  await page.locator('#boot').dispatchEvent('pointerdown');
  await expect(page.locator('#main-menu')).toBeVisible();
}

/** Starts a fresh Mission 01 and waits until the player is in control. */
export async function startMission(page: Page): Promise<void> {
  await bootToMenu(page);
  await page.locator('#btn-new').click();
  await expect(page.locator('#briefing')).toBeVisible();
  await page.locator('#btn-begin').click();
  await page.waitForFunction(() => qc().state() === 'playing', null, { timeout: 90_000 });
}

export interface Snapshot {
  state: string;
  mission: string;
  objectives: Record<string, string>;
  player: { x: number; z: number; yaw: number; health: number; stamina: number; crouched: boolean; alive: boolean; weapon: string | null; ammo: number };
  inventory: string[];
  enemies: { id: string; state: string; alive: boolean; x: number; z: number; awareness: number }[];
  npcs: Record<string, { state: string; x: number; z: number }>;
  flags: Record<string, number>;
  prompt: { verb: string; label: string } | null;
  stats: Record<string, number>;
  render: { drawCalls: number; triangles: number; fps: number; simMs: number; simMsPeak: number };
  level: { colliders: number; batchedMeshes: number; triangles: number };
  bot: { status: string; done: boolean; history: string[] };
}

export async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => qc().snapshot()) as Promise<Snapshot>;
}

/** In-page accessor for the debug API (only used inside page.evaluate callbacks). */
declare global {
  function qc(): any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export async function installQcShim(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { qc: () => unknown }).qc = () => (window as unknown as { __QC: unknown }).__QC;
  });
}
