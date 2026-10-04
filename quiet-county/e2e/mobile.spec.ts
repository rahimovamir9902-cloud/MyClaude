import { expect, test, type Page } from '@playwright/test';
import { installQcShim, snapshot, startMission } from './helpers';

test.beforeEach(async ({ page }) => installQcShim(page));

async function pointer(page: Page, type: string, x: number, y: number, id: number, target = '#touch') {
  await page.evaluate(
    ({ type, x, y, id, target }) => {
      const el = (target === '#touch' ? document.querySelector('#touch') : document.querySelector(target)) as HTMLElement;
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: id === 1 }));
    },
    { type, x, y, id, target },
  );
}

test('touch joystick, look drag and action buttons control the player', async ({ page }) => {
  await startMission(page);
  await expect(page.locator('#touch')).toBeVisible();
  await expect(page.locator('#touch [data-action="fire"]')).toBeVisible();
  await page.evaluate(() => qc().killAll());
  const before = await snapshot(page);

  // Joystick: press in the left zone, drag up = forward.
  await pointer(page, 'pointerdown', 150, 300, 1);
  await pointer(page, 'pointermove', 150, 240, 1);
  await page.waitForFunction((z0) => qc().snapshot().player.z < z0 - 2, before.player.z, { timeout: 15_000 });
  await pointer(page, 'pointerup', 150, 240, 1);

  // Look: drag on the right side turns the camera.
  const yaw0 = await page.evaluate(() => qc().game.session.camera.yaw);
  await pointer(page, 'pointerdown', 600, 150, 2);
  await pointer(page, 'pointermove', 680, 150, 2);
  await pointer(page, 'pointerup', 680, 150, 2);
  await expect.poll(async () => Math.abs((await page.evaluate(() => qc().game.session.camera.yaw)) - yaw0), { timeout: 10_000 }).toBeGreaterThan(0.1);

  // Crouch toggle button.
  const crouch = page.locator('#touch [data-action="crouch"]');
  const box = (await crouch.boundingBox())!;
  await pointer(page, 'pointerdown', box.x + box.width / 2, box.y + box.height / 2, 3, '#touch [data-action="crouch"]');
  await pointer(page, 'pointerup', box.x + box.width / 2, box.y + box.height / 2, 3, '#touch [data-action="crouch"]');
  await expect.poll(async () => (await snapshot(page)).player.crouched, { timeout: 10_000 }).toBe(true);
  await expect(crouch).toHaveClass(/on/);

  // Bag button opens the inventory overlay.
  await pointer(page, 'pointerdown', 0, 0, 4, '#touch [data-action="inventory"]');
  await pointer(page, 'pointerup', 0, 0, 4, '#touch [data-action="inventory"]');
  await expect(page.locator('#inventory')).toBeVisible();
});

test('every touch button is fully on screen at phone resolution', async ({ page }) => {
  await startMission(page);
  const vp = page.viewportSize()!;
  for (const b of await page.locator('#touch .tbtn').all()) {
    const r = (await b.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(vp.width);
    expect(r.y + r.height).toBeLessThanOrEqual(vp.height);
  }
  // Buttons must not cover the minimap.
  const mm = (await page.locator('#minimap').boundingBox())!;
  for (const b of await page.locator('#touch .tbtn').all()) {
    const r = (await b.boundingBox())!;
    const overlap = r.x < mm.x + mm.width && r.x + r.width > mm.x && r.y < mm.y + mm.height && r.y + r.height > mm.y;
    expect(overlap, `${await b.getAttribute('data-action')} overlaps minimap`).toBe(false);
  }
});

test('controls layout can be customized and persists', async ({ page }) => {
  await page.goto('/?debug=1');
  await page.waitForFunction(() => !!(window as unknown as { __QC?: unknown }).__QC);
  await page.locator('#boot').dispatchEvent('pointerdown');
  await page.getByText('Controls layout').click();
  await expect(page.locator('#controls-editor')).toBeVisible();
  const btn = page.locator('#touch [data-action="sprint"]');
  const r0 = (await btn.boundingBox())!;
  await pointer(page, 'pointerdown', r0.x + r0.width / 2, r0.y + r0.height / 2, 7, '#touch [data-action="sprint"]');
  await pointer(page, 'pointermove', r0.x + r0.width / 2 - 80, r0.y + r0.height / 2 - 60, 7);
  await pointer(page, 'pointerup', r0.x + r0.width / 2 - 80, r0.y + r0.height / 2 - 60, 7);
  const r1 = (await btn.boundingBox())!;
  expect(r1.x).toBeLessThan(r0.x - 40);
  await page.getByText('Save layout').click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('qc.settings') ?? '{}'));
  const sprint = saved.touchLayout.find((b: { id: string }) => b.id === 'sprint');
  expect(sprint.right).toBeGreaterThan(41.5);
});
