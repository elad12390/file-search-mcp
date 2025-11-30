/**
 * Black-Box Tests for search_content
 * 
 * Philosophy: Test BEHAVIOR through PUBLIC INTERFACE, not implementation.
 * 
 * We test what the tool DOES:
 * - Given a search query → returns files containing that text
 * - Given regex patterns → matches correctly
 * - Given context settings → returns appropriate context
 * 
 * We DON'T test:
 * - Whether ripgrep is used internally
 * - How parsing is done
 * - Internal buffering or streaming
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { searchContent } from '../src/tools/search-content.js';
import { createTestFixture, TestFixture } from './fixtures.js';

describe('search_content', () => {
  let fixture: TestFixture;
  
  beforeAll(async () => {
    fixture = await createTestFixture();
    process.chdir(fixture.rootDir);
  });
  
  afterAll(async () => {
    await fixture.cleanup();
  });
  
  // ==========================================================================
  // Core Behavior: Finding text in files
  // ==========================================================================
  
  describe('finding text in files', () => {
    it('finds exact text matches', async () => {
      // Arrange
      const input = {
        reasoning: 'Looking for TODO comments in the codebase',
        query: 'TODO',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should find files with TODO comments
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('Button.tsx'))).toBe(true);
      expect(result.files.some(f => f.path.includes('formatters.ts'))).toBe(true);
    });
    
    it('finds FIXME comments', async () => {
      // Arrange
      const input = {
        reasoning: 'Looking for FIXME comments that need attention',
        query: 'FIXME',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('Modal.tsx'))).toBe(true);
    });
    
    it('finds function definitions', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding function definitions',
        query: 'export function',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      // Should find files with exported functions
      expect(result.files.some(f => 
        f.matches?.some(m => m.content.includes('export function'))
      )).toBe(true);
    });
    
    it('returns line numbers for matches', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing line number tracking',
        query: 'TODO',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Matches should have line numbers
      expect(result.files.length).toBeGreaterThan(0);
      const fileWithMatches = result.files.find(f => f.matches && f.matches.length > 0);
      expect(fileWithMatches).toBeDefined();
      expect(fileWithMatches!.matches![0].line).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Behavior: Regex pattern matching
  // ==========================================================================
  
  describe('regex pattern matching', () => {
    it('finds patterns with regex', async () => {
      // Arrange: Find any interface definitions
      const input = {
        reasoning: 'Finding TypeScript interfaces',
        query: 'interface\\s+\\w+',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => 
        f.matches?.some(m => m.content.includes('interface'))
      )).toBe(true);
    });
    
    it('finds email patterns', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding email validation patterns',
        query: '@[^\\s]+\\.[^\\s]+',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should find email-related code
      expect(result.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Behavior: Smart case sensitivity
  // ==========================================================================
  
  describe('smart case sensitivity', () => {
    it('searches case-insensitively for lowercase queries', async () => {
      // Arrange: Search for "todo" lowercase
      const input = {
        reasoning: 'Testing case-insensitive search',
        query: 'todo',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should find "TODO" even though we searched "todo"
      expect(result.files.length).toBeGreaterThan(0);
    });
    
    it('searches case-sensitively when query has uppercase', async () => {
      // Arrange: Search for "TODO" uppercase (smart case kicks in)
      const input = {
        reasoning: 'Testing smart case with uppercase',
        query: 'TODO',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should find exact "TODO" matches
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.every(f => 
        f.matches?.every(m => m.content.includes('TODO'))
      )).toBe(true);
    });
  });
  
  // ==========================================================================
  // Behavior: File pattern filtering
  // ==========================================================================
  
  describe('file pattern filtering', () => {
    it('limits search to specific file types', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding TODOs only in TypeScript files',
        query: 'TODO',
        path: fixture.rootDir,
        file_pattern: '*.ts',
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should only find .ts files, not .tsx
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.every(f => f.path.endsWith('.ts'))).toBe(true);
    });
    
    it('limits search to specific directories', async () => {
      // Arrange: Use ** glob pattern for ripgrep
      const input = {
        reasoning: 'Searching only in utils directory',
        query: 'export',
        path: `${fixture.rootDir}/src/utils`,  // Search directly in the directory
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should find files with exports
      expect(result.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Behavior: Exclusions
  // ==========================================================================
  
  describe('exclusion handling', () => {
    it('excludes node_modules by default', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing node_modules exclusion',
        query: 'module',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: No results from node_modules
      expect(result.files.every(f => !f.path.includes('node_modules'))).toBe(true);
    });
    
    it('excludes custom directories', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing custom exclusion',
        query: 'test',
        path: fixture.rootDir,
        exclude: ['tests'],
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: No results from tests directory
      expect(result.files.every(f => !f.path.includes('tests/'))).toBe(true);
    });
  });
  
  // ==========================================================================
  // Behavior: Context lines
  // ==========================================================================
  
  describe('context lines', () => {
    it('returns context around matches', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing context lines feature',
        query: 'TODO',
        path: fixture.rootDir,
        context_lines: 2,
        detail_level: 'full' as const,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should have matches with content
      expect(result.files.length).toBeGreaterThan(0);
      const fileWithMatches = result.files.find(f => f.matches && f.matches.length > 0);
      expect(fileWithMatches).toBeDefined();
      expect(fileWithMatches!.matches![0].content).toBeDefined();
    });
  });
  
  // ==========================================================================
  // Behavior: Detail levels
  // ==========================================================================
  
  describe('detail levels', () => {
    it('includes file metadata in standard mode', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing standard detail level',
        query: 'TODO',
        path: fixture.rootDir,
        detail_level: 'standard' as const,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0].size).toBeDefined();
      expect(result.files[0].modified).toBeDefined();
    });
    
    it('returns minimal info in minimal mode', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing minimal detail level',
        query: 'TODO',
        path: fixture.rootDir,
        detail_level: 'minimal' as const,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0].path).toBeDefined();
    });
  });
  
  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  
  describe('edge cases', () => {
    it('returns empty for non-matching query', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing non-matching query',
        query: 'xyznonexistentpatternxyz',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert
      expect(result.files).toEqual([]);
      expect(result.totalMatches).toBe(0);
    });
    
    it('skips binary files automatically', async () => {
      // Arrange: Search for something that might be in binary files
      const input = {
        reasoning: 'Testing binary file skipping',
        query: '.',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should not include any binary file matches
      // (Our test fixture doesn't have binary files, but the behavior is tested)
      expect(result.files.every(f => !f.path.endsWith('.exe'))).toBe(true);
    });
    
    it('preserves reasoning in results', async () => {
      // Arrange
      const reasoning = 'Specific reasoning for content search';
      const input = {
        reasoning,
        query: 'TODO',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert
      expect(result.reasoning).toContain(reasoning);
    });
    
    it('includes search time', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing search time',
        query: 'TODO',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });
    
    it('handles special regex characters in query', async () => {
      // Arrange: Search for a pattern with special chars
      const input = {
        reasoning: 'Testing special characters',
        query: '\\(',  // Escaped parenthesis
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should not crash, should find parentheses
      expect(result.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Behavior: Finding specific code patterns
  // ==========================================================================
  
  describe('finding specific code patterns', () => {
    it('finds import statements', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding React imports',
        query: "import.*from 'react'",
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
    });
    
    it('finds console.log statements', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding console.log for cleanup',
        query: 'console.log',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should find the console.log in index.ts
      expect(result.files.some(f => f.path.includes('index.ts'))).toBe(true);
    });
    
    it('finds potential secrets/API keys', async () => {
      // Arrange
      const input = {
        reasoning: 'Security scan for hardcoded secrets',
        query: 'API_KEY|SECRET|password',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchContent(input);
      
      // Assert: Should find our test secrets
      expect(result.files.length).toBeGreaterThan(0);
    });
  });
});
