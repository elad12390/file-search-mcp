#!/usr/bin/env npx tsx

/**
 * View Metrics CLI
 * 
 * Usage:
 *   npx tsx scripts/view-metrics.ts           # Show summary
 *   npx tsx scripts/view-metrics.ts --raw     # Show last 50 raw calls
 *   npx tsx scripts/view-metrics.ts --clear   # Clear all metrics
 */

import { getMetricsSummary, getRawMetrics, clearMetrics } from '../src/utils/metrics.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--clear')) {
    await clearMetrics();
    console.log('✅ Metrics cleared');
    return;
  }
  
  if (args.includes('--raw')) {
    const calls = await getRawMetrics(50);
    console.log('\n📊 Last 50 Tool Calls:\n');
    
    for (const call of calls) {
      console.log(`[${call.timestamp}] ${call.tool}`);
      console.log(`  Reasoning: ${call.reasoning.slice(0, 80)}${call.reasoning.length > 80 ? '...' : ''}`);
      console.log(`  Duration: ${call.durationMs}ms | Results: ${call.resultCount} | Truncated: ${call.truncated}`);
      if (call.error) console.log(`  ❌ Error: ${call.error}`);
      console.log('');
    }
    return;
  }
  
  // Default: show summary
  const summary = await getMetricsSummary();
  
  console.log('\n📊 File Search MCP - Metrics Summary\n');
  console.log('═'.repeat(50));
  
  if (summary.totalCalls === 0) {
    console.log('\nNo metrics recorded yet.');
    console.log('Use the MCP tools to start collecting data.\n');
    return;
  }
  
  console.log(`\n📈 Total Calls: ${summary.totalCalls}`);
  if (summary.firstCall) {
    console.log(`📅 First Call: ${summary.firstCall}`);
    console.log(`📅 Last Call: ${summary.lastCall}`);
  }
  
  console.log(`\n⚠️  Error Rate: ${(summary.errorRate * 100).toFixed(1)}%`);
  console.log(`📄 Truncation Rate: ${(summary.truncationRate * 100).toFixed(1)}%`);
  
  console.log('\n🔧 Calls by Tool:');
  for (const [tool, count] of Object.entries(summary.callsByTool)) {
    const avgMs = summary.avgDurationByTool[tool] || 0;
    console.log(`  ${tool}: ${count} calls (avg ${avgMs}ms)`);
  }
  
  if (summary.topPatterns.length > 0) {
    console.log('\n🔍 Top File Patterns (search_files):');
    for (const { pattern, count } of summary.topPatterns.slice(0, 5)) {
      console.log(`  "${pattern}": ${count} times`);
    }
  }
  
  if (summary.topQueries.length > 0) {
    console.log('\n🔎 Top Search Queries (search_content, fuzzy_find):');
    for (const { query, count } of summary.topQueries.slice(0, 5)) {
      console.log(`  "${query}": ${count} times`);
    }
  }
  
  if (summary.topReasonings.length > 0) {
    console.log('\n💭 Top Reasonings:');
    for (const { reasoning, count } of summary.topReasonings.slice(0, 5)) {
      console.log(`  "${reasoning.slice(0, 60)}${reasoning.length > 60 ? '...' : ''}": ${count} times`);
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('Metrics stored at: ~/.file-search-mcp/metrics.json\n');
}

main().catch(console.error);
