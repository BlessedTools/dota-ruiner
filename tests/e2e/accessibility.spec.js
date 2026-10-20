import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ranked = JSON.parse(readFileSync(new URL('../fixtures/ranked.json', import.meta.url), 'utf8'));

async function expectNoSeriousViolations(page, state) {
  const result = await new AxeBuilder({ page }).analyze();
  const violations = result.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(violations, `${state}: ${violations.map(({ id, help }) => `${id} — ${help}`).join('; ')}`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/constants/**', (route) => route.fulfill({ json: {} }));
});

test('idle, loading, error, demo, chart, and real-analysis states have no serious axe violations', async ({ page }) => {
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/matches/9000000001', async (route) => { await delayed; await route.fulfill({ json: ranked }); });
  await page.route('**/api/matches/9000000099', (route) => route.fulfill({ status: 502, json: { error: 'unavailable' } }));
  await page.goto('/');
  await expectNoSeriousViolations(page, 'idle');

  await page.getByLabel(/Match ID/i).fill('9000000001');
  await page.getByRole('button', { name: /разобрать|analyze/i }).click();
  await expect(page.locator('#status')).toHaveAttribute('data-kind', 'loading');
  await expectNoSeriousViolations(page, 'loading');
  release();
  await expect(page.getByText(/Матч #9000000001|Match #9000000001/)).toBeVisible();
  await expectNoSeriousViolations(page, 'real analysis and chart');
  for (const team of ['radiant', 'dire']) {
    await page.locator(`.scoreboard-team--${team} .scoreboard-row`).first().click();
    for (const tab of await page.getByRole('tab').all()) {
      await tab.click();
      await expectNoSeriousViolations(page, `${team} inspector ${await tab.textContent()}`);
    }
  }

  await page.getByLabel(/Match ID/i).fill('9000000099');
  await page.getByRole('button', { name: /разобрать|analyze/i }).click();
  await expect(page.locator('#status')).toHaveAttribute('data-kind', 'error');
  await expectNoSeriousViolations(page, 'error');

  await page.getByRole('button', { name: /демо|demo/i }).click();
  await expect(page.locator('[data-demo-label]')).toBeVisible();
  await expectNoSeriousViolations(page, 'demo');
});

test('history and comparison states remain accessible', async ({ page }) => {
  const second = structuredClone(ranked);
  second.match_id = 9000000002;
  await page.route('**/api/matches/9000000001', (route) => route.fulfill({ json: ranked }));
  await page.route('**/api/matches/9000000002', (route) => route.fulfill({ json: second }));
  await page.goto('/');
  for (const id of [9000000001, 9000000002]) {
    await page.getByLabel(/Match ID/i).fill(String(id));
    await page.getByRole('button', { name: /разобрать|analyze/i }).click();
    await expect(page.getByText(new RegExp(`Матч #${id}|Match #${id}`))).toBeVisible();
  }
  await page.getByRole('button', { name: /история|history/i }).click();
  await expect(page.locator('#history-panel')).toBeVisible();
  await expectNoSeriousViolations(page, 'history');
  await page.getByRole('button', { name: /сравнить|compare/i }).click();
  await expect(page.locator('#comparison-panel')).toBeVisible();
  await expectNoSeriousViolations(page, 'comparison');
});

test('keyboard focus, activation, target sizes, and reduced motion are preserved', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  const focusStyle = await page.locator('.skip-link').evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle).toEqual({ outlineStyle: 'solid', outlineWidth: '3px' });
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#main');

  await page.getByRole('button', { name: /Switch language/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Analyze match' })).toBeVisible();
  await page.getByRole('button', { name: /open demo/i }).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-demo-label]')).toBeVisible();

  const undersized = await page.locator('button:visible:not(:disabled)').evaluateAll((buttons) => buttons
    .map((button) => ({ text: button.textContent, rect: button.getBoundingClientRect().toJSON() }))
    .filter(({ rect }) => rect.width < 44 || rect.height < 44));
  expect(undersized).toEqual([]);

  let release;
  await page.route('**/api/matches/9000000001', async (route) => { await new Promise((resolve) => { release = resolve; }); await route.fulfill({ json: ranked }); });
  await page.getByLabel(/Match ID/i).fill('9000000001');
  await page.getByRole('button', { name: 'Analyze match' }).click();
  const animationDuration = await page.locator('#status').evaluate((element) => getComputedStyle(element).animationDuration);
  expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.01);
  release();
});

test('layout reflows at a 200%-zoom-equivalent viewport and remains legible in forced colors', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 640, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: /демо|demo/i }).click();
  await expect(page.locator('[data-demo-label]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.emulateMedia({ forcedColors: 'active' });
  const goldButton = page.getByRole('button', { name: /Gold/ });
  await expect(goldButton).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
  const borderStyle = await goldButton.evaluate((element) => {
    const style = getComputedStyle(element);
    return style.borderStyle || style.borderTopStyle;
  });
  if (testInfo.project.name === 'desktop') expect(borderStyle).toBe('solid');
});

test('mobile war room has no horizontal overflow at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: /демо|demo/i }).click();
  await expect(page.locator('[data-demo-label]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
