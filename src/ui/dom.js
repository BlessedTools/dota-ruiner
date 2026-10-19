export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attrs || {})) {
    if (value !== null && value !== undefined) node.setAttribute(name, String(value));
  }
  for (const child of (Array.isArray(children) ? children : [children])) if (child) node.append(child);
  return node;
}

export function heroPortrait(player, className = 'hero-portrait', { eager = false } = {}) {
  if (player?.heroImage) {
    return el('img', { className, attrs: { src: player.heroImage, alt: '', width: 320, height: 180, loading: eager ? 'eager' : 'lazy', decoding: 'async' } });
  }
  return el('span', { className: `${className} hero-portrait--fallback`, text: player?.heroName?.slice(0, 2) || '?' });
}

export function formatNumber(value, locale = 'ru') {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US').format(value)
    : '—';
}
