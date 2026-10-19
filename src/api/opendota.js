const MATCH_ID = /^\d{7,12}$/;
const ALLOWED_HOSTS = new Set(['opendota.com', 'www.opendota.com', 'dotabuff.com', 'www.dotabuff.com']);
const ALLOWED_CONSTANTS = new Set(['heroes', 'items', 'game_mode', 'lobby_type', 'region', 'patch']);

export class ApiError extends Error {
  constructor(code, message = code, details = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export function parseMatchInput(value) {
  const input = String(value ?? '').trim();
  if (MATCH_ID.test(input)) return { ok: true, matchId: input, errorKey: null };
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) throw new Error('unsupported');
    const matches = url.pathname.match(/\d{7,12}/g) || [];
    if (matches.length === 1 && MATCH_ID.test(matches[0])) return { ok: true, matchId: matches[0], errorKey: null };
  } catch {
    // Fall through to the localized validation error.
  }
  return { ok: false, matchId: null, errorKey: 'errors.invalidMatchId' };
}

function errorForStatus(status) {
  if (status === 404) return new ApiError('not-found', 'Match not found', { status });
  if (status === 429) return new ApiError('rate-limited', 'OpenDota rate limit reached', { status });
  return new ApiError('upstream-error', `OpenDota HTTP ${status}`, { status });
}

async function requestJson(url, { fetchImpl, timeoutMs, signal, validate }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  const onAbort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw errorForStatus(response.status);
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('invalid-response', 'OpenDota returned invalid JSON');
    }
    if (!data || typeof data !== 'object' || (validate && !validate(data))) throw new ApiError('invalid-response', 'OpenDota response has an unexpected shape');
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      if (signal?.aborted) throw new ApiError('cancelled', 'Request cancelled');
      throw new ApiError('timeout', 'OpenDota request timed out');
    }
    throw new ApiError('network', error?.message || 'Network failure');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function fetchMatch(matchId, options = {}) {
  if (!MATCH_ID.test(String(matchId))) throw new ApiError('invalid-id', 'Invalid Match ID');
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const isLocal = options.isLocal ?? ['localhost', '127.0.0.1', ''].includes(globalThis.location?.hostname ?? '');
  const urls = isLocal
    ? [`/api/matches/${matchId}`, `https://api.opendota.com/api/matches/${matchId}`]
    : [`https://api.opendota.com/api/matches/${matchId}`];
  let lastError;
  for (const url of urls) {
    try {
      return await requestJson(url, { fetchImpl, timeoutMs: options.timeoutMs ?? 8000, signal: options.signal, validate: (data) => Array.isArray(data.players) });
    } catch (error) {
      lastError = error;
      if (error.code === 'cancelled' || error.code === 'invalid-response' || !isLocal) break;
    }
  }
  throw lastError || new ApiError('network');
}

export async function fetchConstant(name, options = {}) {
  if (!ALLOWED_CONSTANTS.has(name)) throw new ApiError('invalid-constant', 'Unsupported OpenDota constant');
  return requestJson(`https://api.opendota.com/api/constants/${name}`, {
    fetchImpl: options.fetchImpl || globalThis.fetch,
    timeoutMs: options.timeoutMs ?? 5000,
    signal: options.signal,
    validate: (data) => Array.isArray(data) || (data && typeof data === 'object'),
  });
}
