/**
 * Metrics Tracking
 * 
 * Stores usage metrics locally for development analysis.
 * Data stored at ~/.file-search-mcp/metrics.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

// ============================================================================
// Types
// ============================================================================

export interface ToolCall {
  id: string;
  tool: string;
  reasoning: string;
  params: Record<string, unknown>;
  timestamp: string;
  durationMs: number;
  resultCount: number;
  truncated: boolean;
  error?: string;
}

export interface MetricsSummary {
  totalCalls: number;
  callsByTool: Record<string, number>;
  avgDurationByTool: Record<string, number>;
  topReasonings: { reasoning: string; count: number }[];
  topPatterns: { pattern: string; count: number }[];
  topQueries: { query: string; count: number }[];
  errorRate: number;
  truncationRate: number;
  firstCall?: string;
  lastCall?: string;
}

interface MetricsStore {
  version: number;
  calls: ToolCall[];
}

// ============================================================================
// Config
// ============================================================================

const METRICS_DIR = join(homedir(), '.file-search-mcp');
const METRICS_FILE = join(METRICS_DIR, 'metrics.json');
const MAX_CALLS_STORED = 10000; // Keep last 10k calls

// ============================================================================
// Storage
// ============================================================================

async function ensureMetricsDir(): Promise<void> {
  try {
    await mkdir(METRICS_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

async function loadMetrics(): Promise<MetricsStore> {
  try {
    const data = await readFile(METRICS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { version: 1, calls: [] };
  }
}

async function saveMetrics(store: MetricsStore): Promise<void> {
  await ensureMetricsDir();
  
  // Trim to max size
  if (store.calls.length > MAX_CALLS_STORED) {
    store.calls = store.calls.slice(-MAX_CALLS_STORED);
  }
  
  await writeFile(METRICS_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// ============================================================================
// Recording
// ============================================================================

/**
 * Record a tool call
 */
export async function recordToolCall(call: Omit<ToolCall, 'id' | 'timestamp'>): Promise<void> {
  try {
    const store = await loadMetrics();
    
    const fullCall: ToolCall = {
      ...call,
      id: generateId(),
      timestamp: new Date().toISOString(),
    };
    
    store.calls.push(fullCall);
    await saveMetrics(store);
  } catch (error) {
    // Silently fail - metrics should never break the tool
    console.error('[metrics] Failed to record:', error);
  }
}

/**
 * Helper to wrap a tool execution with metrics
 */
export async function withMetrics<T extends { reasoning: string }, R>(
  tool: string,
  params: T,
  execute: () => Promise<R>
): Promise<R> {
  const startTime = Date.now();
  let error: string | undefined;
  let resultCount = 0;
  let truncated = false;

  try {
    const result = await execute();
    
    // Extract counts from different result types
    if (result && typeof result === 'object') {
      const r = result as Record<string, unknown>;
      if (Array.isArray(r.files)) {
        resultCount = r.files.length;
      } else if (typeof r.totalMatches === 'number') {
        resultCount = r.totalMatches;
      } else if (typeof r.totalFiles === 'number') {
        resultCount = r.totalFiles + (typeof r.totalDirs === 'number' ? r.totalDirs : 0);
      }
      truncated = r.truncated === true;
    }
    
    return result;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    const durationMs = Date.now() - startTime;
    
    // Record asynchronously, don't block
    recordToolCall({
      tool,
      reasoning: params.reasoning,
      params: sanitizeParams(params),
      durationMs,
      resultCount,
      truncated,
      error,
    }).catch(() => {});
  }
}

// ============================================================================
// Analysis
// ============================================================================

/**
 * Get metrics summary for analysis
 */
export async function getMetricsSummary(): Promise<MetricsSummary> {
  const store = await loadMetrics();
  const calls = store.calls;
  
  if (calls.length === 0) {
    return {
      totalCalls: 0,
      callsByTool: {},
      avgDurationByTool: {},
      topReasonings: [],
      topPatterns: [],
      topQueries: [],
      errorRate: 0,
      truncationRate: 0,
    };
  }
  
  // Calls by tool
  const callsByTool: Record<string, number> = {};
  const durationsByTool: Record<string, number[]> = {};
  const reasoningCounts: Record<string, number> = {};
  const patternCounts: Record<string, number> = {};
  const queryCounts: Record<string, number> = {};
  let errorCount = 0;
  let truncatedCount = 0;
  
  for (const call of calls) {
    // Count by tool
    callsByTool[call.tool] = (callsByTool[call.tool] || 0) + 1;
    
    // Track durations
    if (!durationsByTool[call.tool]) {
      durationsByTool[call.tool] = [];
    }
    durationsByTool[call.tool].push(call.durationMs);
    
    // Count reasonings
    const reasoningKey = call.reasoning.slice(0, 100); // Truncate for grouping
    reasoningCounts[reasoningKey] = (reasoningCounts[reasoningKey] || 0) + 1;
    
    // Count patterns (for search_files)
    if (call.params.pattern) {
      const pattern = String(call.params.pattern);
      patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    }
    
    // Count queries (for search_content, fuzzy_find)
    if (call.params.query) {
      const query = String(call.params.query);
      queryCounts[query] = (queryCounts[query] || 0) + 1;
    }
    
    // Count errors and truncations
    if (call.error) errorCount++;
    if (call.truncated) truncatedCount++;
  }
  
  // Calculate averages
  const avgDurationByTool: Record<string, number> = {};
  for (const [tool, durations] of Object.entries(durationsByTool)) {
    avgDurationByTool[tool] = Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length
    );
  }
  
  // Top items
  const topReasonings = Object.entries(reasoningCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reasoning, count]) => ({ reasoning, count }));
  
  const topPatterns = Object.entries(patternCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([pattern, count]) => ({ pattern, count }));
  
  const topQueries = Object.entries(queryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));
  
  return {
    totalCalls: calls.length,
    callsByTool,
    avgDurationByTool,
    topReasonings,
    topPatterns,
    topQueries,
    errorRate: calls.length > 0 ? errorCount / calls.length : 0,
    truncationRate: calls.length > 0 ? truncatedCount / calls.length : 0,
    firstCall: calls[0]?.timestamp,
    lastCall: calls[calls.length - 1]?.timestamp,
  };
}

/**
 * Get raw calls for detailed analysis
 */
export async function getRawMetrics(limit: number = 100): Promise<ToolCall[]> {
  const store = await loadMetrics();
  return store.calls.slice(-limit);
}

/**
 * Clear all metrics
 */
export async function clearMetrics(): Promise<void> {
  await saveMetrics({ version: 1, calls: [] });
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Remove sensitive or verbose data from params for storage
 */
function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(params)) {
    // Skip reasoning (stored separately)
    if (key === 'reasoning') continue;
    
    // Truncate long strings
    if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.slice(0, 200) + '...';
    } else if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 10);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
