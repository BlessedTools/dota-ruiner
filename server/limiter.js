export class RateLimiter {
  constructor({ capacity = 30, refillPerSecond = 0.5, now = Date.now } = {}) {
    if (capacity <= 0 || refillPerSecond <= 0) throw new TypeError('capacity and refillPerSecond must be positive');
    this.capacity = capacity;
    this.refillPerMs = refillPerSecond / 1_000;
    this.now = now;
    this.clients = new Map();
  }

  consume(client, cost = 1) {
    const time = this.now();
    const bucket = this.clients.get(client) ?? { tokens: this.capacity, updatedAt: time };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + Math.max(0, time - bucket.updatedAt) * this.refillPerMs);
    bucket.updatedAt = time;
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      this.clients.set(client, bucket);
      return { allowed: true, retryAfterMs: 0 };
    }
    this.clients.set(client, bucket);
    return { allowed: false, retryAfterMs: Math.ceil((cost - bucket.tokens) / this.refillPerMs) };
  }
}

export class QueueFullError extends Error {
  constructor() {
    super('Request queue is full');
    this.name = 'QueueFullError';
  }
}

export class BoundedTaskQueue {
  constructor({ concurrency = 2, maxQueued = 20 } = {}) {
    if (concurrency <= 0 || maxQueued < 0) throw new TypeError('invalid queue limits');
    this.concurrency = concurrency;
    this.maxQueued = maxQueued;
    this.running = 0;
    this.waiting = [];
    this.pending = new Map();
  }

  schedule(key, task) {
    if (this.pending.has(key)) return this.pending.get(key);
    if (this.running >= this.concurrency && this.waiting.length >= this.maxQueued) throw new QueueFullError();

    let resolve;
    let reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    const job = { key, task, resolve, reject };
    this.pending.set(key, promise);
    if (this.running < this.concurrency) this.#start(job);
    else this.waiting.push(job);
    return promise;
  }

  #start(job) {
    this.running += 1;
    let result;
    try {
      result = job.task();
    } catch (error) {
      result = Promise.reject(error);
    }
    Promise.resolve(result)
      .then(job.resolve, job.reject)
      .finally(() => {
        this.running -= 1;
        this.pending.delete(job.key);
        const next = this.waiting.shift();
        if (next) this.#start(next);
      });
  }
}
