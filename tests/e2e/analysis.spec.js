import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const ranked = JSON.parse(readFileSync(new URL('../fixtures/ranked.json', import.meta.url), 'utf8'));
const partial = JSON.parse(readFileSync(new URL('../fixtures/partial.json', import.meta.url), 'utf8'));

async function prepare(page) {
  await page.route('https://api.opendota.com/api/constants/heroes', (route) => route.fulfill({ json: {} }));
}

async function analyze(page, id) {
  await page.getByLabel(/Match ID/i).fill(String(id));
  await page.getByRole('button', { name: /разобрать|analyze/i }).click();
}

test.beforeEach(async ({ page }) => {
  await prepare(page);
});

test('successful fixture analysis uses only the requested OpenDota response', async ({ page }) => {
  await page.route('**/api/matches/9000000001', (route) => route.fulfill({ json: ranked }));
  await page.goto('/');
  await analyze(page, 9000000001);

  await expect(page.getByText('#9000000001', { exact: true })).toBeVisible();
  await expect(page.getByText('Carry', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.verdict-card .score').first()).not.toHaveText('—');
  await expect(page.locator('[data-demo-label]')).toHaveCount(0);
  await expect(page).toHaveURL(/#9000000001$/);
});

test('API failure is explicit and never substitutes demo data', async ({ page }) => {
  await page.route('**/api/matches/9000000099', (route) => route.fulfill({ status: 502, json: { error: 'upstream unavailable' } }));
  await page.goto('/');
  await analyze(page, 9000000099);

  await expect(page.locator('#status')).toHaveAttribute('data-kind', 'error');
  await expect(page.locator('#status')).toContainText(/Не удалось|Could not/);
  await expect(page.locator('[data-demo-label]')).toHaveCount(0);
  await expect(page.getByText('#7890123456', { exact: true })).toHaveCount(0);
});

test('partial data suppresses verdicts and labels unknown heroes and limitations', async ({ page }) => {
  await page.route('**/api/matches/9000000003', (route) => route.fulfill({ json: partial }));
  await page.goto('/');
  await analyze(page, 9000000003);

  await expect(page.getByText(/Недостаточно данных|Insufficient data/).first()).toBeVisible();
  await expect(page.getByText('Hero 999', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Неизвестный герой|Unknown hero/)).toBeVisible();
  await expect(page.getByText(/Часть метрик|Some player metrics/)).toBeVisible();
  await expect(page.locator('.verdict-card .score')).toHaveCount(0);
});

test('the latest of two rapid searches wins even when the first response arrives last', async ({ page }) => {
  await page.route('**/api/matches/9000000001', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ json: ranked });
  });
  const second = structuredClone(ranked);
  second.match_id = 9000000002;
  second.players[0].personaname = 'Latest Result';
  await page.route('**/api/matches/9000000002', (route) => route.fulfill({ json: second }));
  await page.goto('/');

  await analyze(page, 9000000001);
  await page.getByLabel(/Match ID/i).fill('9000000002');
  await page.getByRole('button', { name: /разобрать|analyze/i }).click();

  await expect(page.getByText('#9000000002', { exact: true })).toBeVisible();
  await expect(page.getByText('Latest Result', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('#9000000001', { exact: true })).toHaveCount(0);
});

test('loading, language switching, anonymous players, and no-timeline fallback stay usable', async ({ page }) => {
  let release;
  const responseReady = new Promise((resolve) => { release = resolve; });
  const withoutTimeline = structuredClone(ranked);
  withoutTimeline.match_id = 9000000004;
  withoutTimeline.players.forEach((player) => { delete player.gold_t; delete player.xp_t; delete player.personaname; });
  await page.route('**/api/matches/9000000004', async (route) => {
    await responseReady;
    await route.fulfill({ json: withoutTimeline });
  });
  await page.goto('/');
  await analyze(page, 9000000004);
  await expect(page.locator('#status')).toHaveAttribute('data-kind', 'loading');
  await expect(page.locator('#status')).toHaveAttribute('aria-busy', 'true');
  release();

  await expect(page.getByText('#9000000004', { exact: true })).toBeVisible();
  await expect(page.getByText('Anti-Mage', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Временная шкала недоступна|Timeline unavailable/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gold' })).toBeDisabled();
  await page.getByRole('button', { name: 'Switch language' }).click();
  await expect(page.getByRole('button', { name: 'Analyze match' })).toBeVisible();
  await expect(page.locator('#disclaimer')).toContainText('explainable heuristics');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Analyze match' })).toBeVisible();
});

test('unusual 9-player and 11-player matches remain analyzable with a warning', async ({ page }) => {
  for (const count of [9, 11]) {
    const fixture = structuredClone(ranked);
    fixture.match_id = 9000000100 + count;
    if (count === 9) fixture.players.pop();
    else fixture.players.push({ ...fixture.players[4], player_slot: 5, hero_id: 145, personaname: 'Extra player' });
    await page.route(`**/api/matches/${fixture.match_id}`, (route) => route.fulfill({ json: fixture }));
    await page.goto('/');
    await analyze(page, fixture.match_id);
    await expect(page.getByText(`#${fixture.match_id}`, { exact: true })).toBeVisible();
    await expect(page.getByText(/Нестандартное число игроков|Unusual player count/)).toBeVisible();
    await expect(page.locator('.player-row')).toHaveCount(count);
  }
});
