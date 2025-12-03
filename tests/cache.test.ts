import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QueryCache } from '../src/utils/cache.js';

describe('QueryCache', () => {
  let cache: QueryCache<string>;

  beforeEach(() => {
    cache = new QueryCache<string>({ ttlMs: 1000, maxSize: 5 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should check existence with has()', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');

      // Advance time past TTL
      vi.advanceTimersByTime(1100);

      expect(cache.get('key1')).toBeUndefined();
    });

    it('should not expire entries before TTL', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(500);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should clean up expired entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      vi.advanceTimersByTime(1100);

      const removed = cache.cleanup();
      expect(removed).toBe(2);
    });
  });

  describe('max size eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      cache.set('key1', 'value1');
      vi.advanceTimersByTime(10);
      cache.set('key2', 'value2');
      vi.advanceTimersByTime(10);
      cache.set('key3', 'value3');
      vi.advanceTimersByTime(10);
      cache.set('key4', 'value4');
      vi.advanceTimersByTime(10);
      cache.set('key5', 'value5');
      vi.advanceTimersByTime(10);

      // This should evict key1 (oldest)
      cache.set('key6', 'value6');

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key6')).toBe('value6');
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      // Hit
      cache.get('key1');
      // Miss
      cache.get('nonexistent');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('generateKey', () => {
    it('should generate consistent keys from params', () => {
      const key1 = QueryCache.generateKey('search_content', {
        query: 'test',
        path: '/foo',
        reasoning: 'different reasoning 1',
      });
      const key2 = QueryCache.generateKey('search_content', {
        query: 'test',
        path: '/foo',
        reasoning: 'different reasoning 2',
      });

      // Should be the same despite different reasoning
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different params', () => {
      const key1 = QueryCache.generateKey('search_content', {
        query: 'test1',
        path: '/foo',
      });
      const key2 = QueryCache.generateKey('search_content', {
        query: 'test2',
        path: '/foo',
      });

      expect(key1).not.toBe(key2);
    });

    it('should include tool name in key', () => {
      const key1 = QueryCache.generateKey('search_content', { query: 'test' });
      const key2 = QueryCache.generateKey('search_files', { query: 'test' });

      expect(key1).not.toBe(key2);
    });
  });
});
