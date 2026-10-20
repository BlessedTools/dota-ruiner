import { expect, test } from '@playwright/test';

test('PWA shell and explicitly labeled demo work offline', async ({ page, context }) => {
  const pageErrors = [];
  const requestFailures = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => requestFailures.push(`${request.url()} ${request.failure()?.errorText}`));
  await page.goto('/');
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifest).toBeTruthy();
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cachedUrls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (key) => (await caches.open(key)).keys()))).flat().map((request) => request.url));
  expect(cachedUrls.some((url) => /\/assets\/index-.*\.js$/.test(url))).toBe(true);
  await page.getByRole('button', { name: /демо|demo/i }).click();
  await expect(page.locator('[data-demo-label]')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'DOTA RUINER' })).toBeVisible();
  const offlineState = await page.evaluate(async () => {
    const script = document.querySelector('script[type="module"]')?.src;
    return { script, cached: script ? Boolean(await caches.match(script)) : false, controlled: Boolean(navigator.serviceWorker.controller), demoText: document.querySelector('#demo-button')?.textContent };
  });
  const sameOriginFailures = requestFailures.filter((failure) => failure.startsWith('http://127.0.0.1:5173/'));
  expect({ offlineState, pageErrors, sameOriginFailures }).toEqual({ offlineState: expect.objectContaining({ cached: true, controlled: true, demoText: 'Открыть демо' }), pageErrors: [], sameOriginFailures: [] });
  await page.getByRole('button', { name: /демо|demo/i }).click();
  await expect(page.locator('[data-demo-label]')).toContainText(/ДЕМО|DEMO/);
});

test('latest saved real analysis remains discoverable offline', async ({ page, context }) => {
  const fixture = { match_id: 9000000001, duration: 1800, radiant_win: true, game_mode: 22, lobby_type: 7, version: 21, players: [{ player_slot: 0, hero_id: 1, kills: 2, deaths: 1, assists: 2, gold_per_min: 500, hero_damage: 8000 }, { player_slot: 128, hero_id: 2, kills: 1, deaths: 2, assists: 1, gold_per_min: 350, hero_damage: 4000 }] };
  await page.route('**/api/matches/9000000001', (route) => route.fulfill({ json: fixture }));
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByLabel(/Match ID/i).fill('9000000001');
  await page.getByRole('button', { name: /разобрать|analyze/i }).click();
  await expect(page.getByText(/Матч #9000000001|Match #9000000001/)).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /история|history/i }).click();
  await expect(page.getByRole('button', { name: /9000000001/ })).toBeVisible();
  await page.getByRole('button', { name: /9000000001/ }).click();
  await expect(page.locator('[data-cache-label]')).toContainText(/СОХРАНЕНО|CACHED/);
  const privateCacheEntries = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (key) => (await caches.open(key)).keys()))).flat().filter((request) => new URL(request.url).searchParams.has('api_key')).length);
  expect(privateCacheEntries).toBe(0);
});
