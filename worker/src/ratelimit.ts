interface WindowState {
  prevCount: number;
  currCount: number;
  windowStart: number;
}

export class SlidingWindowRateLimiter {
  private readonly windowSizeMs: number;
  private readonly maxLimit: number; // e.g. 60 req/min + 20 burst = 80 max
  private readonly maxTrackedIps: number;
  private readonly state = new Map<string, WindowState>();

  constructor(
    windowSizeMs = 60_000,
    maxLimit = 80, // 60 regular + 20 burst
    maxTrackedIps = 10_000
  ) {
    this.windowSizeMs = windowSizeMs;
    this.maxLimit = maxLimit;
    this.maxTrackedIps = maxTrackedIps;
  }

  /**
   * Evaluates if the IP is permitted under the sliding window counter.
   * Returns { allowed: boolean, remaining: number, resetMs: number }
   */
  public check(ip: string, now = Date.now()): { allowed: boolean; remaining: number; resetMs: number } {
    let entry = this.state.get(ip);

    if (!entry) {
      if (this.state.size >= this.maxTrackedIps) {
        // Evict oldest IP in O(1) time
        const oldestKey = this.state.keys().next().value;
        if (oldestKey !== undefined) {
          this.state.delete(oldestKey);
        }
      }
      entry = { prevCount: 0, currCount: 1, windowStart: now };
      this.state.set(ip, entry);
      return {
        allowed: true,
        remaining: this.maxLimit - 1,
        resetMs: this.windowSizeMs,
      };
    }

    const elapsed = now - entry.windowStart;

    if (elapsed >= this.windowSizeMs * 2) {
      // Both previous and current windows have fully expired
      entry.prevCount = 0;
      entry.currCount = 1;
      entry.windowStart = now;
    } else if (elapsed >= this.windowSizeMs) {
      // Shift window
      entry.prevCount = entry.currCount;
      entry.currCount = 1;
      entry.windowStart += this.windowSizeMs;
    } else {
      entry.currCount += 1;
    }

    // Sliding window calculation
    const windowElapsed = now - entry.windowStart;
    const weight = Math.max(0, (this.windowSizeMs - windowElapsed) / this.windowSizeMs);
    const estimatedCount = Math.floor(entry.prevCount * weight) + entry.currCount;

    const allowed = estimatedCount <= this.maxLimit;
    const remaining = Math.max(0, this.maxLimit - estimatedCount);
    const resetMs = Math.max(0, this.windowSizeMs - windowElapsed);

    return { allowed, remaining, resetMs };
  }

  public getTrackedCount(): number {
    return this.state.size;
  }

  public clear(): void {
    this.state.clear();
  }
}

// Global isolate-level singleton instance
export const rateLimiter = new SlidingWindowRateLimiter(60_000, 80, 10_000);

