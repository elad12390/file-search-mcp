/**
 * Truncate Utility Tests
 * 
 * Tests the truncation and formatting behavior for search results.
 * Black-box testing: we test WHAT the functions produce, not HOW.
 */

import { describe, it, expect } from 'vitest';
import { 
  truncateSearchResults, 
  truncateTreeResult, 
  truncateString, 
  formatSearchResultsText 
} from '../src/utils/truncate.js';
import { FileMatch, SearchResult } from '../src/types.js';

describe('truncateSearchResults', () => {
  it('returns all files when under size limit', () => {
    const files: FileMatch[] = [
      { path: 'file1.ts' },
      { path: 'file2.ts' },
      { path: 'file3.ts' },
    ];
    
    const result = truncateSearchResults(files, 'test reasoning', 100);
    
    expect(result.files).toHaveLength(3);
    expect(result.truncated).toBe(false);
    expect(result.totalMatches).toBe(3);
  });

  it('counts matches correctly when files have multiple matches', () => {
    const files: FileMatch[] = [
      { 
        path: 'file1.ts',
        matches: [
          { line: 1, content: 'match 1' },
          { line: 2, content: 'match 2' },
        ]
      },
      { 
        path: 'file2.ts',
        matches: [
          { line: 5, content: 'match 3' },
        ]
      },
    ];
    
    const result = truncateSearchResults(files, 'test', 50);
    
    expect(result.totalMatches).toBe(3);
  });

  it('preserves search time and reasoning', () => {
    const result = truncateSearchResults([], 'my reasoning', 42);
    
    expect(result.searchTime).toBe(42);
    expect(result.reasoning).toBe('my reasoning');
  });
});

describe('truncateTreeResult', () => {
  it('returns tree unchanged when under size limit', () => {
    const tree = 'root/\n  file1.ts\n  file2.ts';
    
    const result = truncateTreeResult(tree, 2, 1, 'test');
    
    expect(result.tree).toBe(tree);
    expect(result.truncated).toBe(false);
    expect(result.totalFiles).toBe(2);
    expect(result.totalDirs).toBe(1);
  });

  it('preserves reasoning', () => {
    const result = truncateTreeResult('tree', 0, 0, 'my reasoning');
    
    expect(result.reasoning).toBe('my reasoning');
  });
});

describe('truncateString', () => {
  it('returns string unchanged when under max length', () => {
    expect(truncateString('hello', 10)).toBe('hello');
  });

  it('truncates and adds ellipsis when over max length', () => {
    expect(truncateString('hello world', 8)).toBe('hello...');
  });

  it('handles exact max length', () => {
    expect(truncateString('hello', 5)).toBe('hello');
  });

  it('handles very short max length', () => {
    expect(truncateString('hello world', 5)).toBe('he...');
  });
});

describe('formatSearchResultsText', () => {
  it('formats basic results correctly', () => {
    const result: SearchResult = {
      files: [{ path: 'src/test.ts' }],
      totalMatches: 1,
      truncated: false,
      searchTime: 50,
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result);
    
    expect(text).toContain('Found 1 match(es) in 1 file(s)');
    expect(text).toContain('Search time: 50ms');
    expect(text).toContain('src/test.ts');
  });

  it('shows truncation warning when results are truncated', () => {
    const result: SearchResult = {
      files: [],
      totalMatches: 0,
      truncated: true,
      searchTime: 100,
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result);
    
    expect(text).toContain('Results truncated');
    expect(text).toContain('detail_level="minimal"');
  });

  it('shows suggestions for zero-result searches when query and tool provided', () => {
    const result: SearchResult = {
      files: [],
      totalMatches: 0,
      truncated: false,
      searchTime: 50,
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result, {
      query: 'foo|bar|baz',
      tool: 'search_content',
      showHints: true,
    });
    
    expect(text).toContain('Suggestions');
  });

  it('does not show suggestions when showHints is false', () => {
    const result: SearchResult = {
      files: [],
      totalMatches: 0,
      truncated: false,
      searchTime: 50,
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result, {
      query: 'foo|bar',
      tool: 'search_content',
      showHints: false,
    });
    
    expect(text).not.toContain('Suggestions');
  });

  it('formats file with size and modified date', () => {
    const result: SearchResult = {
      files: [{
        path: 'src/app.ts',
        size: 1024,
        sizeFormatted: '1 KB',
        modified: '2024-01-15',
      }],
      totalMatches: 1,
      truncated: false,
      searchTime: 30,
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result);
    
    expect(text).toContain('Size: 1 KB');
    expect(text).toContain('Modified: 2024-01-15');
  });

  it('formats file with matches and line numbers', () => {
    const result: SearchResult = {
      files: [{
        path: 'src/app.ts',
        matches: [
          { line: 10, content: 'const foo = "bar"' },
          { line: 25, content: 'return foo' },
        ],
      }],
      totalMatches: 2,
      truncated: false,
      searchTime: 30,
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result);
    
    expect(text).toContain('L10:');
    expect(text).toContain('L25:');
    expect(text).toContain('const foo');
    expect(text).toContain('return foo');
  });

  it('formats file with preview', () => {
    const result: SearchResult = {
      files: [{
        path: 'config.json',
        preview: '{\n  "name": "app",\n  "version": "1.0.0"\n}',
      }],
      totalMatches: 1,
      truncated: false,
      searchTime: 20,
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result);
    
    expect(text).toContain('Preview:');
    expect(text).toContain('"name": "app"');
  });

  it('truncates long match content', () => {
    const longContent = 'x'.repeat(200);
    const result: SearchResult = {
      files: [{
        path: 'file.ts',
        matches: [{ line: 1, content: longContent }],
      }],
      totalMatches: 1,
      truncated: false,
      searchTime: 10,
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result);
    
    // Should be truncated to 150 chars
    expect(text).toContain('...');
    expect(text.length).toBeLessThan(longContent.length + 200);
  });

  it('shows performance hints for slow complex queries', () => {
    const result: SearchResult = {
      files: [{ path: 'file.ts' }],
      totalMatches: 1,
      truncated: false,
      searchTime: 500, // Slow search
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result, {
      query: 'a|b|c|d|e|f|g|h', // Complex query
      tool: 'search_content',
      showHints: true,
    });
    
    expect(text).toContain('Query Performance');
  });

  it('handles empty results gracefully', () => {
    const result: SearchResult = {
      files: [],
      totalMatches: 0,
      truncated: false,
      searchTime: 10,
      reasoning: 'test',
    };
    
    const text = formatSearchResultsText(result);
    
    expect(text).toContain('Found 0 match(es) in 0 file(s)');
  });
});
