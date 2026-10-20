import { afterEach, describe, expect, it } from 'vitest';

const originalRepository = process.env.GITHUB_REPOSITORY;
const originalBasePath = process.env.VITE_BASE_PATH;

afterEach(() => {
  if (originalRepository === undefined) delete process.env.GITHUB_REPOSITORY;
  else process.env.GITHUB_REPOSITORY = originalRepository;

  if (originalBasePath === undefined) delete process.env.VITE_BASE_PATH;
  else process.env.VITE_BASE_PATH = originalBasePath;
});

describe('Vite base path', () => {
  it('keeps ordinary CI builds at the root when GitHub exposes repository metadata', async () => {
    process.env.GITHUB_REPOSITORY = 'BlessedTools/dota-ruiner';
    delete process.env.VITE_BASE_PATH;

    const { default: config } = await import('../../vite.config.js?ci-test');

    expect(config.base).toBe('/');
  });
});
