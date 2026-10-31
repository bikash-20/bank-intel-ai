import { SlidingWindowRateLimiter } from '../src/ratelimit.js';
import { IsolateLRUCache } from '../src/cache.js';

console.log('--- Testing SlidingWindowRateLimiter ---');

const limiter = new SlidingWindowRateLimiter(1000, 5, 10); // 1000ms window, limit 5
const ip = '192.168.1.1';
const now = 10000;

// First 5 requests should pass
for (let i = 1; i <= 5; i++) {
  const res = limiter.check(ip, now);
  if (!res.allowed) throw new Error(`Expected request ${i} to be allowed`);
}

// 6th request within window should fail
const blocked = limiter.check(ip, now + 100);
if (blocked.allowed) throw new Error('Expected 6th request to be blocked');
console.log('✅ Rate limiter blocked burst successfully (6th request blocked).');

// After window expiry (now + 1500ms), weight shifts and allows new requests
const nextWindow = limiter.check(ip, now + 1500);
console.log('Next window check:', nextWindow);
if (!nextWindow.allowed) throw new Error('Expected request in next window to be allowed');
console.log('✅ Sliding window advancement verified.');

// Test IP eviction limit
console.log('--- Testing LRU Eviction on Max Tracked IPs ---');
const tightLimiter = new SlidingWindowRateLimiter(60000, 10, 3);
tightLimiter.check('ip1', now);
tightLimiter.check('ip2', now);
tightLimiter.check('ip3', now);
if (tightLimiter.getTrackedCount() !== 3) throw new Error('Expected 3 tracked IPs');

tightLimiter.check('ip4', now); // Should evict ip1 in O(1)
if (tightLimiter.getTrackedCount() !== 3) throw new Error('Expected bounded 3 tracked IPs');
console.log('✅ In-Memory IP capacity bounding verified (no memory leaks).');

console.log('\n--- Testing IsolateLRUCache ---');
const cache = new IsolateLRUCache<string, string>(3);
cache.set('k1', 'v1');
cache.set('k2', 'v2');
cache.set('k3', 'v3');

if (cache.get('k1') !== 'v1') throw new Error('Expected k1 hit');
cache.set('k4', 'v4'); // Should evict k2 (since k1 was accessed)
if (cache.get('k2') !== undefined) throw new Error('Expected k2 to be evicted');
if (cache.get('k1') !== 'v1') throw new Error('Expected k1 to remain');
if (cache.get('k3') !== 'v3') throw new Error('Expected k3 to remain');
if (cache.get('k4') !== 'v4') throw new Error('Expected k4 to remain');
console.log('✅ IsolateLRUCache LRU eviction verified.');

console.log('\n🎉 ALL WORKER TESTS PASSED!');

