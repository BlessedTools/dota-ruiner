import { afterEach } from 'vitest';

afterEach(() => {
  if (typeof document !== 'undefined') {
    document.body.replaceChildren();
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});
