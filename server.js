import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TtlCache } from './server/cache.js';
import { BoundedTaskQueue, QueueFullError, RateLimiter } from './server/limiter.js';
import { createLogger } from './server/logger.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MATCH_PATH = /^\/api\/matches\/(\d{7,12})$/;
const LOCAL_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; connect-src 'self' https://api.opendota.com; img-src 'self' data: https://cdn.cloudflare.steamstatic.com; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'], ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.ico', 'image/x-icon'], ['.woff2', 'font/woff2'],
]);

class UpstreamError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function writeResponse(res, status, body = '', headers = {}, method = 'GET') {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers, 'Content-Length': Buffer.byteLength(payload) });
  res.end(method === 'HEAD' ? undefined : payload);
}

function writeJson(res, status, body, headers, method) {
  writeResponse(res, status, body, { 'Content-Type': 'application/json; charset=utf-8', ...headers }, method);
}

function corsHeaders(origin) {
  return origin && LOCAL_ORIGIN.test(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {};
}

async function readUpstreamJson(response, maxResponseBytes) {
  const announced = Number(response.headers.get('content-length'));
  if (Number.isFinite(announced) && announced > maxResponseBytes) throw new UpstreamError('Upstream response is too large');
  const chunks = [];
  let size = 0;
  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw new UpstreamError('Upstream response is too large');
      }
      chunks.push(Buffer.from(value));
    }
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw new UpstreamError('Upstream returned invalid JSON');
  }
}

export function createServer({
  rootDir = path.join(HERE, 'dist'),
  fetchImpl = globalThis.fetch,
  apiKey = process.env.OPENDOTA_API_KEY ?? '',
  cache = new TtlCache(),
  limiter = new RateLimiter(),
  queue = new BoundedTaskQueue(),
  logger = createLogger({ secrets: [apiKey] }),
  upstreamTimeoutMs = 8_000,
  maxResponseBytes = 5 * 1024 * 1024,
} = {}) {
  const resolvedRoot = path.resolve(rootDir);

  async function fetchMatch(matchId) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), upstreamTimeoutMs);
    const upstream = new URL(`https://api.opendota.com/api/matches/${matchId}`);
    if (apiKey) upstream.searchParams.set('api_key', apiKey);
    try {
      const response = await fetchImpl(upstream, {
        signal: controller.signal,
        headers: { Accept: 'application/json', 'User-Agent': 'DOTA-RUINER/2.0' },
      });
      if (response.status === 404) throw new UpstreamError('Match was not found', 404);
      if (response.status === 429) throw new UpstreamError('OpenDota rate limit reached', 503);
      if (!response.ok) throw new UpstreamError('OpenDota request failed');
      return await readUpstreamJson(response, maxResponseBytes);
    } catch (error) {
      if (error?.name === 'AbortError') throw new UpstreamError('OpenDota request timed out', 504);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function serveApi(req, res, url, matchId) {
    const origin = req.headers.origin;
    if (origin && !LOCAL_ORIGIN.test(origin)) {
      writeJson(res, 403, { error: 'Origin is not allowed' }, {}, req.method);
      return;
    }
    if (url.searchParams.has('api_key')) {
      writeJson(res, 400, { error: 'Browser API keys are not accepted' }, corsHeaders(origin), req.method);
      return;
    }
    const rate = limiter.consume(req.socket.remoteAddress ?? 'unknown');
    if (!rate.allowed) {
      writeJson(res, 429, { error: 'Too many requests' }, { ...corsHeaders(origin), 'Retry-After': String(Math.max(1, Math.ceil(rate.retryAfterMs / 1_000))) }, req.method);
      return;
    }

    const cached = cache.get(matchId);
    if (cached !== undefined) {
      writeJson(res, 200, cached, { ...corsHeaders(origin), 'Cache-Control': 'private, max-age=60', 'X-Cache': 'HIT' }, req.method);
      return;
    }

    try {
      const match = await cache.getOrLoad(matchId, () => queue.schedule(matchId, () => fetchMatch(matchId)));
      writeJson(res, 200, match, { ...corsHeaders(origin), 'Cache-Control': 'private, max-age=60', 'X-Cache': 'MISS' }, req.method);
      logger.info('match_proxy_success', { matchId });
    } catch (error) {
      const status = error instanceof QueueFullError ? 503 : error instanceof UpstreamError ? error.status : 502;
      logger.error('match_proxy_failure', { matchId, status, error: error?.name ?? 'Error' });
      writeJson(res, status, { error: status === 404 ? 'Match was not found' : status === 504 ? 'OpenDota request timed out' : 'OpenDota is temporarily unavailable' }, corsHeaders(origin), req.method);
    }
  }

  async function serveStatic(req, res, url) {
    const rawPath = (req.url ?? '/').split('?')[0];
    if (/%2e|%2f|%5c/i.test(rawPath)) {
      writeResponse(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' }, req.method);
      return;
    }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { pathname = ''; }
    if (!pathname || pathname.includes('\\') || pathname.split('/').some((part) => part.startsWith('.'))) {
      writeResponse(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' }, req.method);
      return;
    }
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.resolve(resolvedRoot, relative);
    if (filePath !== resolvedRoot && !filePath.startsWith(`${resolvedRoot}${path.sep}`)) {
      writeResponse(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' }, req.method);
      return;
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('not a file');
      const data = await readFile(filePath);
      const immutable = /[.-][A-Za-z0-9_-]{8,}\.(?:js|css|woff2)$/.test(path.basename(filePath));
      const cacheControl = path.extname(filePath) === '.html' || path.basename(filePath) === 'service-worker.js'
        ? 'no-cache'
        : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
      writeResponse(res, 200, data, { 'Content-Type': MIME.get(path.extname(filePath).toLowerCase()) ?? 'application/octet-stream', 'Cache-Control': cacheControl }, req.method);
    } catch {
      writeResponse(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' }, req.method);
    }
  }

  const server = http.createServer((req, res) => {
    Promise.resolve().then(async () => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        writeJson(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' }, req.method);
        return;
      }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const match = MATCH_PATH.exec(url.pathname);
      if (match) await serveApi(req, res, url, match[1]);
      else if (url.pathname.startsWith('/api/matches/')) writeJson(res, 400, { error: 'Invalid match ID' }, corsHeaders(req.headers.origin), req.method);
      else await serveStatic(req, res, url);
    }).catch((error) => {
      logger.error('request_failure', { error: error?.name ?? 'Error' });
      if (!res.headersSent) writeJson(res, 500, { error: 'Internal server error' }, {}, req.method);
      else res.destroy();
    });
  });
  server.start = ({ port = Number(process.env.PORT) || 4174, host = process.env.HOST || '127.0.0.1' } = {}) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(server); });
  });
  return server;
}

export function shutdown(server, signal = 'shutdown') {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve(signal)));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const apiKey = process.env.OPENDOTA_API_KEY ?? '';
  const logger = createLogger({ secrets: [apiKey] });
  const server = createServer({ apiKey, logger });
  await server.start();
  const address = server.address();
  logger.info('server_started', { host: address.address, port: address.port });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, async () => {
      logger.info('server_stopping', { signal });
      await shutdown(server, signal);
      process.exitCode = 0;
    });
  }
}
