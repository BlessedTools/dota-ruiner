import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    setupFiles: ['./tests/setup/dom.js'],
    restoreMocks: true,
    clearMocks: true,
  },
});
