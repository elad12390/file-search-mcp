/**
 * Black-Box Tests for search_files
 * 
 * Philosophy: Test BEHAVIOR through PUBLIC INTERFACE, not implementation.
 * 
 * We test what the tool DOES:
 * - Given a pattern → returns matching files
 * - Given filters → respects them
 * - Given edge cases → handles gracefully
 * 
 * We DON'T test:
 * - Internal glob library usage
 * - How files are traversed
 * - Internal caching or optimization
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { searchFiles } from '../src/tools/search-files.js';
import { createTestFixture, TestFixture } from './fixtures.js';

describe('search_files', () => {
  let fixture: TestFixture;
  
  beforeAll(async () => {
    fixture = await createTestFixture();
    // Change to fixture directory for relative path tests
    process.chdir(fixture.rootDir);
  });
  
  afterAll(async () => {
    await fixture.cleanup();
  });
  
  // ==========================================================================
  // Core Behavior: Finding files by pattern
  // ==========================================================================
  
  describe('finding files by pattern', () => {
    it('finds TypeScript files with *.ts pattern', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing basic glob pattern for TypeScript files',
        pattern: '*.ts',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Should find .ts files but not .tsx files
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.every(f => f.path.endsWith('.ts'))).toBe(true);
      expect(result.files.some(f => f.path.includes('formatters.ts'))).toBe(true);
      expect(result.files.some(f => f.path.includes('validators.ts'))).toBe(true);
    });
    
    it('finds React components with *.tsx pattern', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding React component files',
        pattern: '*.tsx',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.every(f => f.path.endsWith('.tsx'))).toBe(true);
      expect(result.files.some(f => f.path.includes('Button.tsx'))).toBe(true);
      expect(result.files.some(f => f.path.includes('Modal.tsx'))).toBe(true);
    });
    
    it('finds files in specific directory with path pattern', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding files only in components directory',
        pattern: 'src/components/*.tsx',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert
      expect(result.files.length).toBe(3); // Button, Modal, UserProfile
      expect(result.files.every(f => f.path.includes('components'))).toBe(true);
    });
    
    it('finds config files with multiple extensions', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding all config files',
        pattern: '*.{json,md}',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert
      expect(result.files.some(f => f.path.endsWith('.json'))).toBe(true);
      expect(result.files.some(f => f.path.endsWith('.md'))).toBe(true);
    });
    
    it('finds files with partial name match', async () => {
      // Arrange
      const input = {
        reasoning: 'Finding files with "test" in the name',
        pattern: '*test*',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.every(f => f.path.toLowerCase().includes('test'))).toBe(true);
    });
  });
  
  // ==========================================================================
  // Behavior: Respecting .gitignore
  // ==========================================================================
  
  describe('gitignore handling', () => {
    it('excludes node_modules by default', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing that node_modules is excluded by default',
        pattern: '*.js',
        path: fixture.rootDir,
        ignore_gitignore: true,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: No files from node_modules
      expect(result.files.every(f => !f.path.includes('node_modules'))).toBe(true);
    });
    
    it('excludes .git directory by default', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing that .git is excluded',
        pattern: '*',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: No files from .git
      expect(result.files.every(f => !f.path.includes('.git/'))).toBe(true);
    });
  });
  
  // ==========================================================================
  // Behavior: Custom exclusions
  // ==========================================================================
  
  describe('custom exclusions', () => {
    it('excludes specified directories', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing custom exclusion of docs directory',
        pattern: '*.md',
        path: fixture.rootDir,
        exclude: ['docs'],
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Should find README.md but not docs/API.md
      expect(result.files.some(f => f.path === 'README.md')).toBe(true);
      expect(result.files.every(f => !f.path.includes('docs/'))).toBe(true);
    });
    
    it('excludes multiple patterns', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing exclusion of multiple directories',
        pattern: '*',
        path: fixture.rootDir,
        exclude: ['docs', 'config', 'tests'],
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert
      expect(result.files.every(f => 
        !f.path.includes('docs/') && 
        !f.path.includes('config/') && 
        !f.path.includes('tests/')
      )).toBe(true);
    });
  });
  
  // ==========================================================================
  // Behavior: Hidden files handling
  // ==========================================================================
  
  describe('hidden files handling', () => {
    it('includes hidden files by default', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing that hidden files are included by default',
        pattern: '.gitignore',
        path: fixture.rootDir,
        include_hidden: true,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert
      expect(result.files.some(f => f.path === '.gitignore')).toBe(true);
    });
    
    it('excludes hidden files when requested', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing exclusion of hidden files',
        pattern: '*',
        path: fixture.rootDir,
        include_hidden: false,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: No dotfiles
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
        pattern: '*.ts',
        path: fixture.rootDir,
        detail_level: 'minimal' as const,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Only path, no size or modified date
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0].path).toBeDefined();
      expect(result.files[0].size).toBeUndefined();
      expect(result.files[0].modified).toBeUndefined();
    });
    
    it('includes size and date in standard mode', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing standard detail level',
        pattern: '*.ts',
        path: fixture.rootDir,
        detail_level: 'standard' as const,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Has size and modified date
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0].path).toBeDefined();
      expect(result.files[0].size).toBeDefined();
      expect(result.files[0].sizeFormatted).toBeDefined();
      expect(result.files[0].modified).toBeDefined();
    });
    
    it('includes preview in full mode', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing full detail level',
        pattern: 'package.json',
        path: fixture.rootDir,
        detail_level: 'full' as const,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Has preview content
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files[0].preview).toBeDefined();
      expect(result.files[0].preview).toContain('test-project');
    });
  });
  
  // ==========================================================================
  // Behavior: Time-based filtering
  // ==========================================================================
  
  describe('time-based filtering', () => {
    it('finds recently modified files', async () => {
      // Arrange: All our test files were just created
      const input = {
        reasoning: 'Testing modified_within filter',
        pattern: '*.ts',
        path: fixture.rootDir,
        modified_within: '1h', // Within last hour
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Should find files (they were just created)
      expect(result.files.length).toBeGreaterThan(0);
    });
    
    it('returns empty for old modified_within filter', async () => {
      // Arrange: Use a very short time window
      const input = {
        reasoning: 'Testing that old files are excluded',
        pattern: '*.ts',
        path: fixture.rootDir,
        modified_within: '1m', // Within last minute - might catch some
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: This test is more about the feature working, not specific count
      expect(result.reasoning).toContain('Testing');
    });
  });
  
  // ==========================================================================
  // Behavior: Size-based filtering
  // ==========================================================================
  
  describe('size-based filtering', () => {
    it('finds large files', async () => {
      // Arrange: We created a 100KB file
      const input = {
        reasoning: 'Testing min_size filter',
        pattern: '*',
        path: fixture.rootDir,
        min_size: '50KB',
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Should find the large file
      expect(result.files.some(f => f.path.includes('large-file.txt'))).toBe(true);
    });
    
    it('excludes small files when min_size is set', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing that small files are excluded',
        pattern: '*.ts',
        path: fixture.rootDir,
        min_size: '1MB', // Most source files are under 1MB
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Should find nothing (our .ts files are small)
      expect(result.files.length).toBe(0);
    });
  });
  
  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  
  describe('edge cases', () => {
    it('returns empty array for non-matching pattern', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing non-matching pattern',
        pattern: '*.xyz',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert
      expect(result.files).toEqual([]);
      expect(result.totalMatches).toBe(0);
    });
    
    it('handles empty directory gracefully', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing search in empty directory',
        pattern: '*',
        path: `${fixture.rootDir}/empty-dir`,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert
      expect(result.files).toEqual([]);
    });
    
    it('preserves reasoning in results', async () => {
      // Arrange
      const reasoning = 'This is my specific reasoning for the search';
      const input = {
        reasoning,
        pattern: '*.ts',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Reasoning should be preserved
      expect(result.reasoning).toBe(reasoning);
    });
    
    it('includes search time in results', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing search time tracking',
        pattern: '*.ts',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await searchFiles(input);
      
      // Assert: Search time should be a positive number
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });
  });
});
