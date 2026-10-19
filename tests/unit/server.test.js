import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createServer, shutdown } from '../../server.js';
import { RateLimiter } from '../../server/limiter.js';
import { createLogger } from '../../server/logger.js';

const resources = [];

async function fixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'dota-ruiner-server-'));
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html><h1>DOTA RUINER</h1>');
  await writeFile(path.join(root, 'assets', 'app.js'), 'window.ready=true');
  resources.push(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function running(options = {}) {
  const rootDir = options.rootDir ?? await fixtureRoot();
  const server = createServer({ rootDir, logger: { info: vi.fn(), error: vi.fn() }, ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  resources.push(() => shutdown(server));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

function rawStatus(baseUrl, requestPath) {
  const target = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const req = request({ hostname: target.hostname, port: target.port, path: requestPath }, (res) => {
      res.resume();
      res.once('end', () => resolve(res.statusCode));
    });
    req.once('error', reject);
    req.end();
  });
}

afterEach(async () => {
  await Promise.all(resources.splice(0).reverse().map((dispose) => dispose()));
});

describe('secure static server', () => {
  it('serves only built files, supports HEAD, and rejects methods and sensitive paths', async () => {
    const { baseUrl } = await running();
    const shell = await fetch(`${baseUrl}/`);
    expect(await shell.text()).toContain('DOTA RUINER');
    expect(shell.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(shell.headers.get('content-security-policy')).toContain("form-action 'self'");

    const head = await fetch(`${baseUrl}/assets/app.js`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect(head.headers.get('content-type')).toContain('javascript');

    for (const pathname of ['/.env', '/.git/config', '/server.js']) {
      expect((await fetch(`${baseUrl}${pathname}`)).status, pathname).toBe(404);
    }
    expect(await rawStatus(baseUrl, '/%2e%2e/server.js')).toBe(404);
    expect(await rawStatus(baseUrl, '/assets/%2e%2e/index.html')).toBe(404);
    const post = await fetch(`${baseUrl}/`, { method: 'POST' });
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
  });

  it('binds to loopback by default when started through its helper', async () => {
    const rootDir = await fixtureRoot();
    const server = createServer({ rootDir, logger: { info: vi.fn(), error: vi.fn() } });
    await server.start({ port: 0 });
    resources.push(() => shutdown(server));
    expect(server.address().address).toBe('127.0.0.1');
  });
});

describe('OpenDota proxy', () => {
  it('redacts configured secrets and API-key query values from structured logs', () => {
    const output = [];
    const logger = createLogger({ write: (line) => output.push(line), secrets: ['top-secret'] });
    logger.error('upstream_failure', { url: 'https://api.opendota.com/api/matches/1?api_key=top-secret', detail: 'top-secret' });
    expect(output).toHaveLength(1);
    expect(output[0]).not.toContain('top-secret');
    expect(JSON.parse(output[0])).toMatchObject({ level: 'error', event: 'upstream_failure' });
  });

  it('validates the complete route and allows CORS only for loopback origins', async () => {
    const { baseUrl } = await running({ fetchImpl: vi.fn() });
    expect((await fetch(`${baseUrl}/api/matches/123456`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/matches/1234567890123`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/matches/1234567?api_key=browser-secret`)).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/matches/1234567`, { headers: { origin: 'https://evil.example' } })).status).toBe(403);

    const allowed = await fetch(`${baseUrl}/api/matches/1234567`, { headers: { origin: 'http://localhost:5173' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(allowed.headers.get('vary')).toContain('Origin');
  });

  it('keeps the credential server-side, coalesces and caches successful responses, and redacts logs', async () => {
    const calls = [];
    let release;
    const fetchImpl = vi.fn((url, options) => {
      calls.push({ url: String(url), options });
      return new Promise((resolve) => { release = () => resolve(new Response(JSON.stringify({ match_id: 1234567 }), { status: 200 })); });
    });
    const logger = { info: vi.fn(), error: vi.fn() };
    const { baseUrl } = await running({ fetchImpl, apiKey: 'top-secret', logger });

    const first = fetch(`${baseUrl}/api/matches/1234567`);
    const duplicate = fetch(`${baseUrl}/api/matches/1234567`);
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    release();
    expect((await first).status).toBe(200);
    expect((await duplicate).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/matches/1234567`)).headers.get('x-cache')).toBe('HIT');
    expect(calls[0].url).toContain('api_key=top-secret');
    expect(JSON.stringify(logger.info.mock.calls) + JSON.stringify(logger.error.mock.calls)).not.toContain('top-secret');
  });

  it('maps upstream failures, timeouts, oversized payloads, and local rate limits safely', async () => {
    const scenarios = [
      { fetchImpl: vi.fn(async () => new Response('{}', { status: 404 })), expected: 404 },
      { fetchImpl: vi.fn(async () => new Response('denied top-secret', { status: 401 })), expected: 502 },
      { fetchImpl: vi.fn(async () => new Response('x'.repeat(101))), expected: 502, maxResponseBytes: 100 },
      { fetchImpl: vi.fn((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))), expected: 504, upstreamTimeoutMs: 5 },
    ];

    for (const scenario of scenarios) {
      const { baseUrl } = await running({ apiKey: 'top-secret', ...scenario });
      const response = await fetch(`${baseUrl}/api/matches/7654321`);
      expect(response.status).toBe(scenario.expected);
      expect(await response.text()).not.toContain('top-secret');
    }

    const limiter = new RateLimiter({ capacity: 1, refillPerSecond: 0.001 });
    const { baseUrl } = await running({ limiter, fetchImpl: vi.fn(async () => Response.json({ match_id: 7654321 })) });
    expect((await fetch(`${baseUrl}/api/matches/7654321`)).status).toBe(200);
    const limited = await fetch(`${baseUrl}/api/matches/7654322`);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('stops accepting connections through graceful shutdown', async () => {
    const { server, baseUrl } = await running();
    expect((await fetch(baseUrl)).status).toBe(200);
    await shutdown(server, 'test');
    await expect(fetch(baseUrl)).rejects.toThrow();
  });
});
