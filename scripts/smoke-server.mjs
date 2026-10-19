import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

import { createServer, shutdown } from '../server.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const server = createServer({ rootDir: path.join(root, 'dist') });
await server.start({ port: 0 });
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
const failures = [];
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') failures.push(`console: ${message.text()}`); });
page.on('requestfailed', (request) => { if (request.url().startsWith(origin)) failures.push(`request: ${request.url()}`); });

try {
  await page.route('https://api.opendota.com/api/constants/heroes', (route) => route.fulfill({ json: {} }));
  const response = await page.goto(origin);
  if (!response?.headers()['content-security-policy']?.includes("form-action 'self'")) throw new Error('CSP header is missing');
  await page.getByRole('button', { name: /демо|demo/i }).click();
  await page.locator('[data-demo-label]').waitFor();
  if (failures.length) throw new Error(failures.join('\n'));
} finally {
  await browser.close();
  await shutdown(server);
}
