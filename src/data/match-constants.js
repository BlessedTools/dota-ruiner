import { fetchConstant } from '../api/opendota.js';

const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com';
const ALLOWED_ASSET_HOSTS = new Set(['cdn.cloudflare.steamstatic.com', 'steamcdn-a.akamaihd.net', 'api.opendota.com']);
const REQUESTS = Object.freeze({
  heroes: 'heroes', items: 'items', gameModes: 'game_mode', lobbies: 'lobby_type', regions: 'region', patches: 'patch',
});
let cachedPromise = null;

export function safeAssetUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  const candidate = value.startsWith('/') ? `${STEAM_CDN}${value}` : value;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && ALLOWED_ASSET_HOSTS.has(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

function values(payload) {
  return Array.isArray(payload) ? payload : Object.values(payload || {});
}

function normalizeHeroes(payload) {
  return new Map(values(payload).map((hero) => {
    const id = Number(hero?.id);
    if (!Number.isFinite(id)) return null;
    return [id, { id, name: hero.localized_name || `Hero ${id}`, roles: Array.isArray(hero.roles) ? [...hero.roles] : [], image: safeAssetUrl(hero.img) }];
  }).filter(Boolean));
}

function normalizeItems(payload) {
  return new Map(values(payload).map((item) => {
    const id = Number(item?.id);
    if (!Number.isFinite(id)) return null;
    return [id, { id, name: item.dname || item.name || `Item ${id}`, image: safeAssetUrl(item.img), cost: Number.isFinite(Number(item.cost)) ? Number(item.cost) : null }];
  }).filter(Boolean));
}

function normalizeLabels(payload) {
  return new Map(Object.entries(payload || {}).map(([key, entry]) => {
    const id = Number(entry?.id ?? key);
    const name = typeof entry === 'string' ? entry : entry?.name;
    return Number.isFinite(id) && name ? [id, String(name)] : null;
  }).filter(Boolean));
}

function normalizePatches(payload) {
  return new Map(values(payload).map((patch) => {
    const id = Number(patch?.id);
    return Number.isFinite(id) ? [id, String(patch.name || id)] : null;
  }).filter(Boolean));
}

function normalize(payloads) {
  return Object.freeze({
    heroes: normalizeHeroes(payloads.heroes),
    items: normalizeItems(payloads.items),
    gameModes: normalizeLabels(payloads.gameModes),
    lobbies: normalizeLabels(payloads.lobbies),
    regions: normalizeLabels(payloads.regions),
    patches: normalizePatches(payloads.patches),
  });
}

export function fetchConstants(options = {}) {
  if (cachedPromise && !options.force) return cachedPromise;
  cachedPromise = Promise.all(Object.entries(REQUESTS).map(async ([key, endpoint]) => {
    try {
      return [key, await fetchConstant(endpoint, options)];
    } catch {
      return [key, {}];
    }
  })).then((entries) => normalize(Object.fromEntries(entries)));
  return cachedPromise;
}

export function resetConstantsCache() {
  cachedPromise = null;
}

export function getConstantHero(constants, id) {
  const numeric = Number(id);
  return constants?.heroes?.get(numeric) || { id: numeric, name: `Hero ${id}`, roles: [], image: null };
}

export function getConstantItem(constants, id) {
  const numeric = Number(id);
  return constants?.items?.get(numeric) || { id: numeric, name: `Item ${id}`, image: null, cost: null };
}

export function getMatchLabel(constants, group, id) {
  return constants?.[group]?.get(Number(id)) || null;
}
