import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup/dom.js'],
    restoreMocks: true,
    clearMocks: true,
  },
});
