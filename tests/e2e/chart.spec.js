import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const unparsed = JSON.parse(readFileSync(new URL('../fixtures/unparsed-rich.json', import.meta.url), 'utf8'));

test.beforeEach(async ({ page }) => {
  await page.route('**/api/constants/**', (route) => route.fulfill({ json: {} }));
});

test('demo chart exposes only observed Net worth, Gold and XP timelines', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /демо|demo/i }).click();
  await expect(page.getByRole('heading', { name: /timeline|временная шкала/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gold', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Net worth', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'XP', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Hero Damage', exact: true })).toBeDisabled();
  await page.getByRole('img', { name: /Observed match timeline|Наблюдаемая временная шкала/ }).hover({ position: { x: 180, y: 120 } });
  await expect(page.locator('.chart-tooltip')).toContainText(/мин|min/);
  await page.getByRole('button', { name: 'XP', exact: true }).click();
  await page.locator('.chart-data-disclosure summary').click();
  await expect(page.getByRole('table', { name: /chart data|данные графика/i })).toBeVisible();
});

test('unparsed match explains that no observed timeline exists and never draws an approximation', async ({ page }) => {
  await page.route('**/api/matches/9048925949', (route) => route.fulfill({ json: unparsed }));
  await page.goto('/');
  await page.getByLabel(/Match ID/i).fill('9048925949');
  await page.getByRole('button', { name: /разобрать|analyze/i }).click();

  await expect(page.getByText(/Временная шкала недоступна|Timeline unavailable/)).toBeVisible();
  await expect(page.locator('.match-chart')).toBeHidden();
  await expect(page.locator('.chart-source')).toBeHidden();
  await expect(page.locator('.chart-panel')).not.toContainText(/approx|аппрокс|gpm/i);
});
