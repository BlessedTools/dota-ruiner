import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from '@playwright/test';

import { createServer, shutdown } from '../server.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'docs', 'screenshots');
await mkdir(output, { recursive: true });
const server = createServer({ rootDir: path.join(root, 'dist') });
await server.start({ port: 0 });
const { port } = server.address();
const browser = await chromium.launch();

try {
  for (const [name, use] of [['desktop', devices['Desktop Chrome']], ['mobile', devices['Pixel 7']]]) {
    const context = await browser.newContext({ ...use, colorScheme: 'dark' });
    const page = await context.newPage();
    await page.route('**/api/constants/**', (route) => route.fulfill({ json: {} }));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.getByRole('button', { name: /демо|demo/i }).click();
    await page.locator('[data-demo-label]').waitFor();
    await page.evaluate(async () => {
      for (let y = 0; y <= document.documentElement.scrollHeight; y += innerHeight) {
        scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      await Promise.all([...document.images].map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); })));
      scrollTo(0, 0);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.evaluate(() => document.body.classList.add('screenshot-mode'));
    await page.screenshot({ path: path.join(output, `analysis-${name}.png`), fullPage: true });
    await context.close();
  }
  const iconSvg = await readFile(path.join(root, 'public', 'icons', 'icon-512.svg'), 'utf8');
  const iconData = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;
  const iconPage = await browser.newPage();
  for (const [filename, size] of [['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    await iconPage.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${iconData}" alt="">`);
    await iconPage.locator('img').screenshot({ path: path.join(root, 'public', filename), omitBackground: true });
  }
  await iconPage.close();
} finally {
  await browser.close();
  await shutdown(server);
}
