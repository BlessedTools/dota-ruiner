import { expect, test } from '@playwright/test';

test('real analyses enter history while demo stays separate', async ({ page }) => {
  const fixture = { match_id: 9000000001, duration: 1800, radiant_win: true, radiant_score: 5, dire_score: 3, game_mode: 22, lobby_type: 7, version: 21, players: [{ player_slot: 0, hero_id: 1, kills: 3, deaths: 1, assists: 2, gold_per_min: 500, hero_damage: 8000 }, { player_slot: 128, hero_id: 2, kills: 1, deaths: 3, assists: 1, gold_per_min: 350, hero_damage: 4000 }] };
  await page.route('**/api/matches/9000000001', (route) => route.fulfill({ json: fixture }));
  await page.goto('/');
  await page.getByLabel(/Match ID/i).fill('9000000001');
  await page.getByRole('button', { name: /разобрать|analyze/i }).click();
  await expect(page.getByText('#9000000001', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /история|history/i }).click();
  await expect(page.getByRole('button', { name: /9000000001/ })).toBeVisible();
  await page.getByRole('button', { name: /демо|demo/i }).click();
  await expect(page.getByText(/ДЕМО|DEMO/)).toBeVisible();
  await expect(page.getByRole('button', { name: /7890123456/ })).toHaveCount(0);
});
