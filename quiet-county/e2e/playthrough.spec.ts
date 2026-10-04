import { expect, test } from '@playwright/test';
import { installQcShim, snapshot, startMission, trackErrors } from './helpers';

test.beforeEach(async ({ page }) => installQcShim(page));

/**
 * The QA autopilot plays Mission 01 start to finish through the real input and UI paths:
 * walking, opening/prying/unbarring doors, dialogue, treating Ines, looting, picking up
 * quest items and extracting. The vertical slice must be completable end to end.
 */
test('Mission 01 is completable from start to extraction (all secondaries)', async ({ page }) => {
  test.setTimeout(420_000);
  const errors = trackErrors(page);
  await startMission(page);
  await page.evaluate(() => qc().startBot());
  await page.waitForFunction(() => {
    const s = qc().snapshot();
    return s.state === 'results' || s.bot.status.startsWith('failed') || s.bot.status === 'stopped';
  }, null, { timeout: 400_000, polling: 1000 });
  const s = await snapshot(page);
  expect(s.bot.history.join('\n')).not.toContain('FAILED');
  expect(s.state).toBe('results');
  await expect(page.locator('#results')).toBeVisible();
  expect(s.objectives).toMatchObject({
    reach_station: 'completed',
    find_supplies: 'completed',
    find_fuel: 'completed',
    search_garage: 'completed',
    rescue_survivor: 'completed',
    extract: 'completed',
  });
  // Rewards persisted to the camp profile; mission saves cleared.
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('qc.profile') ?? '{}'));
  expect(profile.completedMissions).toContain('m01_silent_road');
  expect(profile.campResources.medicine).toBeGreaterThanOrEqual(10);
  expect(profile.recruitedNpcs).toContain('ines');
  expect(await page.evaluate(() => localStorage.getItem('qc.save.auto'))).toBeNull();
  expect(errors).toEqual([]);
});
