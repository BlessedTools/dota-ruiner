import { describe, expect, it, vi } from 'vitest';

import { BoundedTaskQueue, QueueFullError, RateLimiter } from '../../server/limiter.js';

describe('RateLimiter', () => {
  it('limits each client independently and reports deterministic retry metadata', () => {
    let now = 0;
    const limiter = new RateLimiter({ capacity: 2, refillPerSecond: 1, now: () => now });

    expect(limiter.consume('alice').allowed).toBe(true);
    expect(limiter.consume('alice').allowed).toBe(true);
    expect(limiter.consume('alice')).toEqual({ allowed: false, retryAfterMs: 1_000 });
    expect(limiter.consume('bob').allowed).toBe(true);
    now = 500;
    expect(limiter.consume('alice')).toEqual({ allowed: false, retryAfterMs: 500 });
    now = 1_000;
    expect(limiter.consume('alice').allowed).toBe(true);
  });
});

describe('BoundedTaskQueue', () => {
  it('coalesces work with the same key', async () => {
    let release;
    const task = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const queue = new BoundedTaskQueue({ concurrency: 1, maxQueued: 1 });

    const first = queue.schedule('match:42', task);
    const duplicate = queue.schedule('match:42', task);
    expect(duplicate).toBe(first);
    expect(task).toHaveBeenCalledTimes(1);
    release('ok');
    await expect(first).resolves.toBe('ok');
  });

  it('bounds queued work while allowing the active request to finish', async () => {
    let release;
    const queue = new BoundedTaskQueue({ concurrency: 1, maxQueued: 1 });
    const active = queue.schedule('active', () => new Promise((resolve) => { release = resolve; }));
    const queued = queue.schedule('queued', () => 'queued');

    expect(() => queue.schedule('overflow', () => 'overflow')).toThrow(QueueFullError);
    release('active');
    await expect(active).resolves.toBe('active');
    await expect(queued).resolves.toBe('queued');
  });
});
