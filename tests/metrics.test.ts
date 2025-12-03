/**
 * Metrics Tests
 * 
 * Tests the metrics tracking behavior.
 * These test through the public API: withMetrics, getMetricsSummary, etc.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  withMetrics, 
  getMetricsSummary, 
  getRawMetrics, 
  clearMetrics,
  recordToolCall,
} from '../src/utils/metrics.js';

describe('metrics', () => {
  // Save original metrics before tests, restore after
  let originalMetrics: any[];
  
  beforeEach(async () => {
    // Store current metrics so we can restore them
    originalMetrics = await getRawMetrics(10000);
    await clearMetrics();
  });
  
  afterEach(async () => {
    // Restore original metrics by recording them back
    await clearMetrics();
    for (const call of originalMetrics) {
      await recordToolCall({
        tool: call.tool,
        reasoning: call.reasoning,
        params: call.params,
        durationMs: call.durationMs,
        resultCount: call.resultCount,
        truncated: call.truncated,
        error: call.error,
      });
    }
  });

  describe('withMetrics', () => {
    it('executes the wrapped function and returns result', async () => {
      const result = await withMetrics(
        'test_tool',
        { reasoning: 'test reason' },
        async () => ({ value: 42 })
      );
      
      expect(result).toEqual({ value: 42 });
    });

    it('tracks successful execution', async () => {
      await withMetrics(
        'test_tool',
        { reasoning: 'tracking test' },
        async () => ({ files: [1, 2, 3] })
      );
      
      // Allow time for async recording
      await new Promise(r => setTimeout(r, 100));
      
      const metrics = await getRawMetrics(10);
      const lastCall = metrics[metrics.length - 1];
      
      expect(lastCall.tool).toBe('test_tool');
      expect(lastCall.reasoning).toBe('tracking test');
      expect(lastCall.resultCount).toBe(3);
    });

    it('tracks errors but still throws', async () => {
      const error = new Error('test error');
      
      await expect(
        withMetrics(
          'error_tool',
          { reasoning: 'error test' },
          async () => { throw error; }
        )
      ).rejects.toThrow('test error');
      
      // Allow time for async recording
      await new Promise(r => setTimeout(r, 100));
      
      const metrics = await getRawMetrics(10);
      const lastCall = metrics[metrics.length - 1];
      
      expect(lastCall.tool).toBe('error_tool');
      expect(lastCall.error).toBe('test error');
    });

    it('extracts file count from result with files array', async () => {
      await withMetrics(
        'search_tool',
        { reasoning: 'files test' },
        async () => ({ files: [{}, {}, {}] }) // 3 files
      );
      
      await new Promise(r => setTimeout(r, 100));
      
      const metrics = await getRawMetrics(10);
      const lastCall = metrics[metrics.length - 1];
      
      // withMetrics checks files array first, then totalMatches
      expect(lastCall.resultCount).toBe(3);
    });

    it('extracts totalFiles and totalDirs from tree result', async () => {
      await withMetrics(
        'tree_tool',
        { reasoning: 'tree test' },
        async () => ({ totalFiles: 10, totalDirs: 5 })
      );
      
      await new Promise(r => setTimeout(r, 100));
      
      const metrics = await getRawMetrics(10);
      const lastCall = metrics[metrics.length - 1];
      
      expect(lastCall.resultCount).toBe(15);
    });

    it('tracks truncated flag', async () => {
      await withMetrics(
        'truncated_tool',
        { reasoning: 'truncate test' },
        async () => ({ files: [], truncated: true })
      );
      
      await new Promise(r => setTimeout(r, 100));
      
      const metrics = await getRawMetrics(10);
      const lastCall = metrics[metrics.length - 1];
      
      expect(lastCall.truncated).toBe(true);
    });

    it('sanitizes params by removing reasoning', async () => {
      await withMetrics(
        'sanitize_tool',
        { reasoning: 'should not be in params', query: 'test query' },
        async () => ({})
      );
      
      await new Promise(r => setTimeout(r, 100));
      
      const metrics = await getRawMetrics(10);
      const lastCall = metrics[metrics.length - 1];
      
      expect(lastCall.params.reasoning).toBeUndefined();
      expect(lastCall.params.query).toBe('test query');
    });
  });

  describe('getMetricsSummary', () => {
    it('returns empty summary for no metrics', async () => {
      const summary = await getMetricsSummary();
      
      expect(summary.totalCalls).toBe(0);
      expect(summary.callsByTool).toEqual({});
      expect(summary.topReasonings).toEqual([]);
    });

    it('aggregates metrics correctly', async () => {
      // Record some test calls
      await recordToolCall({
        tool: 'search_content',
        reasoning: 'test 1',
        params: { query: 'foo' },
        durationMs: 100,
        resultCount: 5,
        truncated: false,
      });
      
      await recordToolCall({
        tool: 'search_content',
        reasoning: 'test 2',
        params: { query: 'bar' },
        durationMs: 200,
        resultCount: 10,
        truncated: true,
      });
      
      await recordToolCall({
        tool: 'search_files',
        reasoning: 'test 3',
        params: { pattern: '*.ts' },
        durationMs: 50,
        resultCount: 20,
        truncated: false,
      });
      
      const summary = await getMetricsSummary();
      
      expect(summary.totalCalls).toBe(3);
      expect(summary.callsByTool['search_content']).toBe(2);
      expect(summary.callsByTool['search_files']).toBe(1);
      expect(summary.avgDurationByTool['search_content']).toBe(150);
      expect(summary.truncationRate).toBeCloseTo(1/3);
    });

    it('tracks top queries and patterns', async () => {
      await recordToolCall({
        tool: 'search_content',
        reasoning: 'test',
        params: { query: 'popular query' },
        durationMs: 100,
        resultCount: 5,
        truncated: false,
      });
      
      await recordToolCall({
        tool: 'search_content',
        reasoning: 'test',
        params: { query: 'popular query' },
        durationMs: 100,
        resultCount: 5,
        truncated: false,
      });
      
      await recordToolCall({
        tool: 'search_files',
        reasoning: 'test',
        params: { pattern: '*.ts' },
        durationMs: 100,
        resultCount: 5,
        truncated: false,
      });
      
      const summary = await getMetricsSummary();
      
      expect(summary.topQueries[0].query).toBe('popular query');
      expect(summary.topQueries[0].count).toBe(2);
      expect(summary.topPatterns[0].pattern).toBe('*.ts');
    });

    it('calculates error rate', async () => {
      await recordToolCall({
        tool: 'test',
        reasoning: 'success',
        params: {},
        durationMs: 100,
        resultCount: 0,
        truncated: false,
      });
      
      await recordToolCall({
        tool: 'test',
        reasoning: 'error',
        params: {},
        durationMs: 100,
        resultCount: 0,
        truncated: false,
        error: 'Something went wrong',
      });
      
      const summary = await getMetricsSummary();
      
      expect(summary.errorRate).toBe(0.5);
    });
  });

  describe('getRawMetrics', () => {
    it('returns limited number of calls', async () => {
      for (let i = 0; i < 10; i++) {
        await recordToolCall({
          tool: 'test',
          reasoning: `call ${i}`,
          params: {},
          durationMs: 100,
          resultCount: 0,
          truncated: false,
        });
      }
      
      const metrics = await getRawMetrics(5);
      
      expect(metrics.length).toBe(5);
      // Should return the LAST 5 calls
      expect(metrics[metrics.length - 1].reasoning).toBe('call 9');
    });
  });

  describe('clearMetrics', () => {
    it('removes all metrics', async () => {
      await recordToolCall({
        tool: 'test',
        reasoning: 'to be cleared',
        params: {},
        durationMs: 100,
        resultCount: 0,
        truncated: false,
      });
      
      await clearMetrics();
      
      const summary = await getMetricsSummary();
      expect(summary.totalCalls).toBe(0);
    });
  });

  describe('recordToolCall', () => {
    it('adds timestamp and id automatically', async () => {
      await recordToolCall({
        tool: 'auto_fields_test',
        reasoning: 'test auto fields',
        params: {},
        durationMs: 100,
        resultCount: 0,
        truncated: false,
      });
      
      const metrics = await getRawMetrics(1);
      const call = metrics[0];
      
      expect(call.id).toBeDefined();
      expect(call.timestamp).toBeDefined();
      expect(new Date(call.timestamp).getTime()).not.toBeNaN();
    });

    it('stores params as provided', async () => {
      // recordToolCall receives already-sanitized params from withMetrics
      // The sanitization happens in withMetrics, not recordToolCall
      await recordToolCall({
        tool: 'param_test',
        reasoning: 'test',
        params: { query: 'test query', path: '/some/path' },
        durationMs: 100,
        resultCount: 0,
        truncated: false,
      });
      
      const metrics = await getRawMetrics(1);
      
      expect(metrics[0].params.query).toBe('test query');
      expect(metrics[0].params.path).toBe('/some/path');
    });
  });
});
