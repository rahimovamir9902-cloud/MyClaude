import { expect, test } from '@playwright/test';
import { installQcShim, snapshot, startMission, trackErrors } from './helpers';

test.beforeEach(async ({ page }) => installQcShim(page));

test('boots to the menu, starts Mission 01 and shows the HUD', async ({ page }) => {
  const errors = trackErrors(page);
  await startMission(page);
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('.tracker-main')).toContainText('Calder Junction');
  const s = await snapshot(page);
  expect(s.mission).toBe('active');
  expect(s.objectives.reach_station).toBe('active');
  expect(s.player.weapon).toBe('crowbar');
  expect(s.inventory).toEqual(expect.arrayContaining(['w_c9x1', 'ammo_9mmx6', 'bandagex1']));
  expect(s.enemies.length).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('level passes automated reachability validation', async ({ page }) => {
  await startMission(page);
  const issues = await page.evaluate(() => qc().levelIssues());
  expect(issues).toEqual([]);
});

test('render budget fits mid-range mobile targets', async ({ page }) => {
  await startMission(page);
  const spots: [number, number, number][] = [[-31, 64, 0], [-8, -10, -1.4], [8, 18, 0.3], [30, -35, -1.6]];
  for (const [x, z, yaw] of spots) {
    await page.evaluate(([x, z, yaw]) => qc().teleport(x, z, yaw), [x, z, yaw]);
    await page.waitForTimeout(1200);
    const s = await snapshot(page);
    expect(s.render.drawCalls, `draw calls at ${x},${z}`).toBeLessThan(220);
    expect(s.render.triangles, `triangles at ${x},${z}`).toBeLessThan(160_000);
  }
  const s = await snapshot(page);
  expect(s.level.batchedMeshes).toBeLessThan(150);
  // Gameplay simulation CPU cost per frame (AI, physics, pathfinding), excluding rendering.
  expect(s.render.simMs).toBeLessThan(6);
});

test('keyboard movement, crouch and pause work', async ({ page }) => {
  await startMission(page);
  await page.evaluate(() => qc().killAll());
  const before = await snapshot(page);
  await page.keyboard.down('KeyW');
  await page.waitForFunction((z0) => qc().snapshot().player.z < z0 - 1.5, before.player.z, { timeout: 15_000 });
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyC');
  await expect.poll(async () => (await snapshot(page)).player.crouched, { timeout: 10_000 }).toBe(true);
  await page.keyboard.press('KeyP');
  await expect(page.locator('#pause')).toBeVisible();
  await page.locator('#btn-resume').click();
  await expect(page.locator('#pause')).toHaveCount(0);
  expect((await snapshot(page)).state).toBe('playing');
});

test('inventory, map and note overlays open and close', async ({ page }) => {
  await startMission(page);
  await page.keyboard.press('KeyI');
  await expect(page.locator('#inventory')).toBeVisible();
  await page.locator('#btn-inv-close').click();
  await page.keyboard.press('KeyM');
  await expect(page.locator('#map')).toBeVisible();
  await expect(page.locator('#fullmap')).toBeVisible();
  await page.locator('#btn-map-close').click();
  // The receipt note under the wagon's wiper near the start.
  await page.evaluate(() => qc().teleport(-34.6, 52.0, Math.PI));
  await expect.poll(async () => (await snapshot(page)).prompt?.verb, { timeout: 10_000 }).toBe('READ');
  await page.keyboard.press('KeyE');
  await expect(page.locator('#note')).toBeVisible();
  await expect(page.locator('#note')).toContainText('dinner bell');
  await page.locator('#btn-note-close').click();
  expect((await snapshot(page)).flags['note:note_start']).toBe(1);
});
