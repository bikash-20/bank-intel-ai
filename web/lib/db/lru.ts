import type { AIExplanationPayload } from '../types';

interface LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
}

export class ClientMemoryLRU<K, V> {
  private readonly capacity: number;
  private readonly map = new Map<K, LRUNode<K, V>>();
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;

  constructor(capacity = 250) {
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

// Client Singleton (L1 Memory Cache, max 250 explanations)
export const clientExplanationLRU = new ClientMemoryLRU<string, AIExplanationPayload>(250);
