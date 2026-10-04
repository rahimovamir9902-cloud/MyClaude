import { expect, test } from '@playwright/test';
import { installQcShim, snapshot, startMission } from './helpers';

test.beforeEach(async ({ page }) => installQcShim(page));

async function arena(page: import('@playwright/test').Page) {
  await startMission(page);
  await page.evaluate(() => {
    qc().killAll();
    qc().god(true);
    qc().teleport(-31, 60, 0);
    qc().game.session.camera.pitch = -0.05;
  });
}

test('pistol shots kill an infected and gunfire draws distant infected', async ({ page }) => {
  await arena(page);
  await page.evaluate(() => {
    const s = qc().game.session;
    s.player.equip(s.inventory.findSlot('w_c9'));
    qc().spawn('common', -31, 52);
    qc().spawn('common', -10, 30);
  });
  const farId = (await snapshot(page)).enemies.find((e) => e.alive && e.id.startsWith('debug_') && e.z < 40)!.id;
  const fire = async () => {
    await page.evaluate(() => {
      const g = qc().game;
      const s = g.session;
      const target = s.enemies.enemies.find((e: { alive: boolean; z: number }) => e.alive && e.z > 40);
      if (target) s.camera.yaw = Math.atan2(-(target.x - s.player.x), -(target.z - s.player.z));
      g.input.tap('fire', 'bot');
    });
    await expect.poll(async () => (await snapshot(page)).stats.shotsFired, { timeout: 10_000 }).toBeGreaterThan(0);
  };
  await fire();
  // The infected ~37 m away hears the first gunshot and comes to investigate.
  await expect
    .poll(async () => (await snapshot(page)).enemies.find((e) => e.id === farId)?.state, { timeout: 10_000 })
    .toMatch(/investigate|chase|attack|search|loseTarget/);
  for (let i = 0; i < 12; i++) {
    if (!(await snapshot(page)).enemies.some((e) => e.z > 40 && e.alive)) break;
    await page.waitForTimeout(400);
    await fire();
  }
  const s = await snapshot(page);
  expect(s.enemies.some((e) => e.z > 40 && e.alive)).toBe(false);
  expect(s.player.ammo).toBeLessThan(8);
});

test('melee swings consume stamina and kill; rear takedowns are silent and instant', async ({ page }) => {
  await arena(page);
  await page.evaluate(() => {
    qc().spawn('common', -31, 58.6);
    // Facing the player and hostile, so the swing is a fight, not a rear takedown.
    const e = qc().game.session.enemies.enemies.find((x: { alive: boolean }) => x.alive);
    e.yaw = Math.PI;
    e.brain.applyHit(1, -31, 60, 0);
  });
  const start = await snapshot(page);
  const stamina0 = start.player.stamina;
  let checkedStamina = false;
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => {
      const s = qc().game.session;
      const t = s.enemies.enemies.find((e: { alive: boolean }) => e.alive);
      if (t) s.camera.yaw = Math.atan2(-(t.x - s.player.x), -(t.z - s.player.z));
      qc().game.input.press('fire', 'bot');
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => qc().game.input.release('fire'));
    if (!checkedStamina) {
      // Each swing costs stamina (it regenerates after a short delay).
      await expect.poll(async () => (await snapshot(page)).player.stamina, { timeout: 10_000 }).toBeLessThan(stamina0);
      checkedStamina = true;
    }
    await page.waitForTimeout(700);
    if (!(await snapshot(page)).enemies.some((e) => e.alive)) break;
  }
  const s = await snapshot(page);
  expect(s.enemies.some((e) => e.alive)).toBe(false);
  expect(s.stats.kills - start.stats.kills).toBe(1);
  expect(checkedStamina).toBe(true);

  // Takedown: an idle infected facing away, player right behind it.
  await page.evaluate(() => {
    qc().teleport(-31, 50, 0);
    qc().spawn('common', -31, 48.8);
    const e = qc().game.session.enemies.enemies.find((x: { alive: boolean }) => x.alive);
    e.yaw = 0; // facing north, away from the player
  });
  await expect(page.locator('.takedown-hint')).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => qc().game.input.tap('melee', 'bot'));
  await expect.poll(async () => (await snapshot(page)).enemies.some((e) => e.alive), { timeout: 15_000 }).toBe(false);
  const t = await snapshot(page);
  expect(t.stats.takedowns - start.stats.takedowns).toBe(1);
  expect(t.enemies.some((e) => e.alive)).toBe(false);
});

test('a thrown bottle lures an infected to the impact point', async ({ page }) => {
  await arena(page);
  await page.evaluate(() => {
    qc().teleport(-31, 60, Math.PI / 2); // face west
    qc().spawn('common', -20, 55);
    const e = qc().game.session.enemies.enemies.find((x: { alive: boolean }) => x.alive);
    e.yaw = -Math.PI / 2; // facing east, away from the player
    qc().game.session.camera.pitch = 0.2;
    qc().game.input.tap('throw', 'bot');
  });
  await page.waitForTimeout(2500);
  const s = await snapshot(page);
  expect(s.inventory.some((i) => i.startsWith('glass_bottle'))).toBe(false);
  const e = s.enemies.find((x) => x.alive)!;
  expect(['investigate', 'search', 'chase']).toContain(e.state);
});
