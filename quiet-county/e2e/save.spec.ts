import { expect, test } from '@playwright/test';
import { installQcShim, snapshot, startMission } from './helpers';

test.beforeEach(async ({ page }) => installQcShim(page));

test('manual save at a safe radio restores position, inventory and world state', async ({ page }) => {
  await startMission(page);
  await page.evaluate(() => {
    qc().killAll();
    qc().give('battery', 2);
    const s = qc().game.session;
    s.world.setFlag('test_marker', 7);
    qc().teleport(14.9, -19.0, 2.63);
  });
  await expect.poll(async () => (await snapshot(page)).prompt?.verb, { timeout: 10_000 }).toBe('SAVE');
  // Hold "use" until the save completes (hold time is in game time, independent of FPS).
  await page.keyboard.down('KeyE');
  await expect(page.locator('.toast', { hasText: 'Game saved' })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.up('KeyE');

  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as { __QC?: unknown }).__QC);
  await page.locator('#boot').dispatchEvent('pointerdown');
  await expect(page.locator('#btn-continue')).toBeVisible();
  await page.locator('#btn-continue').click();
  await page.waitForFunction(() => qc().state() === 'playing', null, { timeout: 90_000 });
  const s = await snapshot(page);
  expect(Math.hypot(s.player.x - 14.9, s.player.z + 19.0)).toBeLessThan(1);
  expect(s.inventory).toContain('batteryx2');
  expect(s.flags.test_marker).toBe(7);
  expect(s.objectives.reach_station).toBe('completed');
  // Killed infected stay dead.
  expect(s.enemies.filter((e) => e.alive).length).toBe(0);
});

test('saving is refused while infected are hunting the player', async ({ page }) => {
  await startMission(page);
  await page.evaluate(() => {
    qc().killAll();
    qc().god(true);
    qc().teleport(14.9, -19.0, 2.63);
    qc().spawn('common', 17, -20);
    const e = qc().game.session.enemies.enemies.find((x: { alive: boolean }) => x.alive);
    e.brain.applyHit(1, 14.9, -19.0, 0);
  });
  await expect.poll(async () => (await snapshot(page)).prompt?.verb, { timeout: 10_000 }).toBe('SAVE');
  await page.keyboard.down('KeyE');
  await expect(page.locator('.toast', { hasText: 'cannot rest' })).toBeVisible({ timeout: 20_000 });
  await page.keyboard.up('KeyE');
  expect(await page.evaluate(() => localStorage.getItem('qc.save.manual'))).toBeNull();
});

test('death shows the failure screen and retry restores the checkpoint', async ({ page }) => {
  await startMission(page);
  await page.waitForFunction(() => !!localStorage.getItem('qc.save.auto'), null, { timeout: 20_000 });
  await page.evaluate(() => qc().damagePlayer(500));
  await expect(page.locator('#death')).toBeVisible({ timeout: 10_000 });
  expect((await snapshot(page)).mission).toBe('failed');
  await page.locator('#btn-retry').click();
  await page.waitForFunction(() => qc().state() === 'playing', null, { timeout: 90_000 });
  const s = await snapshot(page);
  expect(s.player.alive).toBe(true);
  expect(s.player.health).toBe(100);
  expect(s.mission).toBe('active');
});
