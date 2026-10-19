import { describe, expect, it } from 'vitest';
import { createRequestCoordinator } from '../../src/api/client.js';

describe('request coordinator', () => {
  it('allows only the latest request to update consumers', async () => {
    const pending = [];
    const updates = [];
    const coordinator = createRequestCoordinator();
    const task = () => new Promise((resolve) => pending.push(resolve));
    const first = coordinator.run(task, { onSuccess: (value) => updates.push(`first:${value}`) });
    const second = coordinator.run(task, { onSuccess: (value) => updates.push(`second:${value}`) });
    pending[1]('new');
    await second;
    pending[0]('old');
    await first;
    expect(updates).toEqual(['second:new']);
  });

  it('cancels the active signal without surfacing a stale error', async () => {
    const coordinator = createRequestCoordinator();
    let observedSignal;
    const run = coordinator.run((signal) => new Promise((_, reject) => {
      observedSignal = signal;
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));
    coordinator.cancel();
    await expect(run).resolves.toBeUndefined();
    expect(observedSignal.aborted).toBe(true);
  });
});
