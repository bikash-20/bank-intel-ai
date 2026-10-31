import type { AIExplanationPayload } from './types.js';

interface LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
}

export class IsolateLRUCache<K, V> {
  private readonly capacity: number;
  private readonly map = new Map<K, LRUNode<K, V>>();
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;

  constructor(capacity = 500) {
    this.capacity = capacity;
  }

  public get(key: K): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.moveToHead(node);
    return node.value;
  }

  public set(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToHead(existing);
      return;
    }

    const newNode: LRUNode<K, V> = {
      key,
      value,
      prev: null,
      next: null,
    };

    if (this.map.size >= this.capacity) {
      this.evictTail();
    }

    this.attachHead(newNode);
    this.map.set(key, newNode);
  }

  private moveToHead(node: LRUNode<K, V>): void {
    if (node === this.head) return;
    this.detach(node);
    this.attachHead(node);
  }

  private detach(node: LRUNode<K, V>): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;
    node.prev = null;
    node.next = null;
  }

  private attachHead(node: LRUNode<K, V>): void {
    node.next = this.head;
    node.prev = null;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private evictTail(): void {
    if (!this.tail) return;
    const oldTail = this.tail;
    this.map.delete(oldTail.key);
    this.detach(oldTail);
  }

  public get size(): number {
    return this.map.size;
  }

  public clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }
}

// Global L3a Isolate Cache Singleton
export const isolateCache = new IsolateLRUCache<string, AIExplanationPayload>(500);

const KV_TTL_90_DAYS = 90 * 24 * 60 * 60; // 7,776,000 seconds
const KV_POP_EDGE_TTL = 86_400; // 1 day cacheTtl at PoP

export async function getCachedExplanation(
  hash: string,
  kv: KVNamespace
): Promise<{ payload?: AIExplanationPayload; source?: 'HIT_L3A' | 'HIT_KV' }> {
  const cacheKey = `explain:v1:${hash}`;

  // 1. Check L3a Isolate RAM
  const memoryHit = isolateCache.get(cacheKey);
  if (memoryHit) {
    return { payload: memoryHit, source: 'HIT_L3A' };
  }

  // 2. Check L3b Cloudflare KV
  try {
    const kvData = await kv.get(cacheKey, { type: 'json', cacheTtl: KV_POP_EDGE_TTL });
    if (kvData) {
      const payload = kvData as AIExplanationPayload;
      isolateCache.set(cacheKey, payload); // Populate L3a
      return { payload, source: 'HIT_KV' };
    }
  } catch (err: any) {
    console.error(`KV get error for ${cacheKey}:`, err?.message);
  }

  return {};
}

export async function setCachedExplanation(
  hash: string,
  payload: AIExplanationPayload,
  kv: KVNamespace
): Promise<void> {
  const cacheKey = `explain:v1:${hash}`;

  // 1. Populate L3a Isolate RAM
  isolateCache.set(cacheKey, payload);

  // 2. Populate L3b Cloudflare KV with 90-day TTL
  try {
    await kv.put(cacheKey, JSON.stringify(payload), {
      expirationTtl: KV_TTL_90_DAYS,
    });
  } catch (err: any) {
    console.error(`KV put error for ${cacheKey}:`, err?.message);
  }
}

