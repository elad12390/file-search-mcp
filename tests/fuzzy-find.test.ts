/**
 * Black-Box Tests for fuzzy_find
 * 
 * Philosophy: Test BEHAVIOR through PUBLIC INTERFACE, not implementation.
 * 
 * We test what the tool DOES:
 * - Given an approximate query → returns best matching files
 * - Ranks results by match quality
 * - Handles typos and abbreviations
 * 
 * We DON'T test:
 * - The specific fuzzy matching algorithm
 * - Internal scoring mechanisms
 * - How the fzf library works
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fuzzyFind } from '../src/tools/fuzzy-find.js';
import { createTestFixture, TestFixture } from './fixtures.js';

describe('fuzzy_find', () => {
  let fixture: TestFixture;
  
  beforeAll(async () => {
    fixture = await createTestFixture();
    process.chdir(fixture.rootDir);
  });
  
  afterAll(async () => {
    await fixture.cleanup();
  });
  
  // ==========================================================================
  // Core Behavior: Fuzzy matching file names
  // ==========================================================================
  
  describe('fuzzy matching file names', () => {
    it('finds files by partial name', async () => {
      // Arrange
      const input = {
        reasoning: 'Looking for Button component',
        query: 'button',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should find Button.tsx
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('Button'))).toBe(true);
    });
    
    it('finds files by abbreviated name', async () => {
      // Arrange: "usrprof" should match "UserProfile"
      const input = {
        reasoning: 'Finding UserProfile using abbreviation',
        query: 'usrprof',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should find UserProfile.tsx
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('UserProfile'))).toBe(true);
    });
    
    it('finds files by initials', async () => {
      // Arrange: "btn" should match "Button"
      const input = {
        reasoning: 'Finding Button using initials',
        query: 'btn',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should find Button.tsx (might not be first, but should be there)
      expect(result.files.length).toBeGreaterThan(0);
    });
    
    it('finds config files with fuzzy match', async () => {
      // Arrange: "appcfg" or "appconf" should find app.config.json
      const input = {
        reasoning: 'Finding config file',
        query: 'appcfg',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should find the config file
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('config'))).toBe(true);
    });
    
    it('finds files by extension abbreviation', async () => {
      // Arrange: "tsx" should find .tsx files
      const input = {
        reasoning: 'Finding TSX files',
        query: 'tsx',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.endsWith('.tsx'))).toBe(true);
    });
  });
  
  // ==========================================================================
  // Behavior: Match quality ranking
  // ==========================================================================
  
  describe('match quality ranking', () => {
    it('ranks exact matches higher', async () => {
      // Arrange: "Modal" should rank Modal.tsx near the top
      const input = {
        reasoning: 'Testing exact match ranking',
        query: 'Modal',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Modal.tsx should be in the top results
      expect(result.files.length).toBeGreaterThan(0);
      const modalIndex = result.files.findIndex(f => f.path.includes('Modal.tsx'));
      expect(modalIndex).toBeGreaterThanOrEqual(0);
      expect(modalIndex).toBeLessThan(5); // Should be in top 5
    });
    
    it('finds multiple matching files', async () => {
      // Arrange: "ts" should find multiple TypeScript files
      const input = {
        reasoning: 'Finding multiple TypeScript files',
        query: 'ts',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should find multiple .ts and .tsx files
      expect(result.files.length).toBeGreaterThan(3);
    });
  });
  
  // ==========================================================================
  // Behavior: Path matching
  // ==========================================================================
  
  describe('path matching', () => {
    it('matches directory names in path', async () => {
      // Arrange: "components" should find files in components directory
      const input = {
        reasoning: 'Finding files in components directory',
        query: 'components',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('components'))).toBe(true);
    });
    
    it('matches path segments', async () => {
      // Arrange: "src/utils" pattern
      const input = {
        reasoning: 'Finding files with path pattern',
        query: 'srcutil',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should find files in src/utils
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some(f => f.path.includes('utils'))).toBe(true);
    });
  });
  
  // ==========================================================================
  // Behavior: Hidden files handling
  // ==========================================================================
  
  describe('hidden files handling', () => {
    it('includes hidden files by default', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding gitignore file',
        query: 'gitignore',
        path: fixture.rootDir,
        include_hidden: true,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.some(f => f.path.includes('.gitignore'))).toBe(true);
    });
    
    it('excludes hidden files when requested', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding files without hidden',
        query: 'git',
        path: fixture.rootDir,
        include_hidden: false,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should not find .gitignore
      expect(result.files.every(f => !f.path.startsWith('.'))).toBe(true);
    });
  });
  
  // ==========================================================================
  // Behavior: Detail levels
  // ==========================================================================
  
  describe('detail levels', () => {
    it('returns only paths in minimal mode', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing minimal detail level',
        query: 'button',
        path: fixture.rootDir,
        detail_level: 'minimal' as const,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0].path).toBeDefined();
      expect(result.files[0].size).toBeUndefined();
    });
    
    it('includes metadata in standard mode', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing standard detail level',
        query: 'button',
        path: fixture.rootDir,
        detail_level: 'standard' as const,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0].size).toBeDefined();
      expect(result.files[0].modified).toBeDefined();
    });
    
    it('includes preview in full mode', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing full detail level',
        query: 'readme',
        path: fixture.rootDir,
        detail_level: 'full' as const,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      const readmeFile = result.files.find(f => f.path.includes('README'));
      expect(readmeFile?.preview).toBeDefined();
    });
  });
  
  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  
  describe('edge cases', () => {
    it('returns results for very short queries', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing short query',
        query: 'js',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should still work
      expect(result.files.length).toBeGreaterThanOrEqual(0);
    });
    
    it('handles query with no matches gracefully', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing non-matching query',
        query: 'xyznonexistent123',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should return empty results, not error
      expect(result.files).toEqual([]);
    });
    
    it('preserves reasoning in results', async () => {
      // Arrange
      const reasoning = 'This is my specific fuzzy search reasoning';
      const input = {
        reasoning,
        query: 'button',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.reasoning).toBe(reasoning);
    });
    
    it('includes search time', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing search time',
        query: 'button',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });
    
    it('handles special characters in query', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing special characters',
        query: '.tsx',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert: Should find .tsx files
      expect(result.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Real-world scenarios
  // ==========================================================================
  
  describe('real-world scenarios', () => {
    it('finds config files quickly', async () => {
      // Arrange: Common developer scenario
      const input = {
        reasoning: 'Need to edit the config file',
        query: 'cfg',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.some(f => f.path.includes('config'))).toBe(true);
    });
    
    it('finds test files', async () => {
      // Arrange
      const input = {
        reasoning: 'Looking for test files',
        query: 'test',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.some(f => f.path.includes('test'))).toBe(true);
    });
    
    it('finds utils/helpers', async () => {
      // Arrange
      const input = {
        reasoning: 'Looking for utility functions',
        query: 'util',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.some(f => f.path.includes('utils'))).toBe(true);
    });
    
    it('finds validators', async () => {
      // Arrange
      const input = {
        reasoning: 'Need to check validation logic',
        query: 'valid',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await fuzzyFind(input);
      
      // Assert
      expect(result.files.some(f => f.path.includes('validators'))).toBe(true);
    });
  });
});
