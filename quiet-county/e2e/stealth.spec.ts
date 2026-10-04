import { expect, test } from '@playwright/test';
import { installQcShim, snapshot, startMission } from './helpers';

test.beforeEach(async ({ page }) => installQcShim(page));

test('crouching in tall grass hides the player; standing in the open gets spotted', async ({ page }) => {
  await startMission(page);
  await page.evaluate(() => {
    qc().killAll();
    qc().god(true);
    qc().setTime(13);
    // Player crouched at the edge of the middle-field grass; infected 9 m away in the open,
    // staring straight at them (yaw PI faces +Z).
    qc().teleport(5, 13, 0);
    qc().game.input.tap('crouch', 'bot');
    qc().spawn('common', 5, 4, { rot: Math.PI, stay: true });
  });
  const faceAndWait = async (ms: number) => {
    for (let t = 0; t < ms; t += 500) {
      await page.evaluate(() => {
        const e = qc().game.session.enemies.enemies.find((x: { alive: boolean; id: string }) => x.alive && x.id.startsWith('debug_'));
        if (e && !e.brain.isHostile) e.yaw = Math.PI;
      });
      await page.waitForTimeout(500);
    }
  };
  await faceAndWait(4000);
  let s = await snapshot(page);
  expect(s.player.crouched).toBe(true);
  let e = s.enemies.find((x) => x.alive)!;
  expect(e.state).not.toBe('chase');
  expect(e.awareness).toBeLessThan(0.5);

  // Stand up and step out of the grass into plain view, 6.5 m away.
  await page.evaluate(() => {
    qc().game.input.tap('crouch', 'bot');
    qc().teleport(5, 10.5, 0);
  });
  await expect
    .poll(async () => {
      await faceAndWait(500);
      return (await snapshot(page)).enemies.find((x) => x.alive)?.state;
    }, { timeout: 20_000 })
    .toMatch(/chase|attack|investigate/);
});
