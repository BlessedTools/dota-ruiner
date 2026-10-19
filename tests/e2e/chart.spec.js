import { expect, test } from '@playwright/test';

test('demo chart exposes only observed Gold and XP timelines', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /демо|demo/i }).click();
  await expect(page.getByRole('heading', { name: /timeline|временная шкала/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gold' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'XP' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Hero Damage' })).toBeDisabled();
  await page.getByRole('img', { name: /Observed match timeline|Наблюдаемая временная шкала/ }).hover({ position: { x: 180, y: 120 } });
  await expect(page.locator('.chart-tooltip')).toContainText(/мин|min/);
  await page.getByRole('button', { name: 'XP' }).click();
  await expect(page.getByRole('table', { name: /chart data|данные графика/i })).toBeVisible();
});
