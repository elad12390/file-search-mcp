/**
 * Integration Tests
 * 
 * These tests verify that tools work correctly together in real-world scenarios.
 * 
 * Philosophy: Test workflows that developers actually perform.
 * These are still black-box tests - we test behavior, not implementation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { searchFiles } from '../src/tools/search-files.js';
import { searchContent } from '../src/tools/search-content.js';
import { fuzzyFind } from '../src/tools/fuzzy-find.js';
import { tree } from '../src/tools/tree.js';
import { createTestFixture, TestFixture } from './fixtures.js';

describe('Integration Tests', () => {
  let fixture: TestFixture;
  
  beforeAll(async () => {
    fixture = await createTestFixture();
    process.chdir(fixture.rootDir);
  });
  
  afterAll(async () => {
    await fixture.cleanup();
  });
  
  // ==========================================================================
  // Scenario: Exploring an unfamiliar codebase
  // ==========================================================================
  
  describe('Scenario: Exploring an unfamiliar codebase', () => {
    it('first see the structure, then find specific files', async () => {
      // Step 1: Get overview with tree
      const treeResult = await tree({
        reasoning: 'Step 1: Understanding the project layout',
        path: fixture.rootDir,
        depth: 2,
      });
      
      // Assert: We can see the main directories
      expect(treeResult.tree).toContain('src');
      expect(treeResult.tree).toContain('components');
      
      // Step 2: Find all component files
      const componentsResult = await searchFiles({
        reasoning: 'Step 2: Finding all React components',
        pattern: '*.tsx',
        path: fixture.rootDir,
      });
      
      // Assert: Found the components (may find more than 3 if there are other .tsx files or symlinks)
      expect(componentsResult.files.length).toBeGreaterThanOrEqual(3);
      // Check that at least one file contains Button.tsx
      expect(componentsResult.files.some(f => f.path.includes('Button.tsx'))).toBe(true);
    });
    
    it('fuzzy find then verify content', async () => {
      // Step 1: Fuzzy find a file we vaguely remember
      const fuzzyResult = await fuzzyFind({
        reasoning: 'Step 1: Looking for user-related component',
        query: 'usrprof',
        path: fixture.rootDir,
      });
      
      // Assert: Found UserProfile
      expect(fuzzyResult.files.some(f => f.path.includes('UserProfile'))).toBe(true);
      
      // Step 2: Search for imports in that file
      const contentResult = await searchContent({
        reasoning: 'Step 2: Finding what this component imports',
        query: 'import',
        path: fixture.rootDir,
        file_pattern: '**/UserProfile.tsx',
      });
      
      // Assert: Found the imports
      expect(contentResult.files.length).toBeGreaterThan(0);
      expect(contentResult.files[0].matches?.some(m => 
        m.content.includes('import')
      )).toBe(true);
    });
  });
  
  // ==========================================================================
  // Scenario: Code review / audit
  // ==========================================================================
  
  describe('Scenario: Code review / audit', () => {
    it('find TODOs across the codebase', async () => {
      // Find all TODO comments
      const todoResult = await searchContent({
        reasoning: 'Audit: Finding all TODO comments for review',
        query: 'TODO',
        path: fixture.rootDir,
      });
      
      // Assert: Found TODOs
      expect(todoResult.files.length).toBeGreaterThan(0);
      expect(todoResult.totalMatches).toBeGreaterThan(0);
      
      // Get detailed file list to know which files need attention
      const filesWithTodos = todoResult.files.map(f => f.path);
      expect(filesWithTodos.length).toBeGreaterThan(0);
    });
    
    it('find potential security issues', async () => {
      // Search for potential secrets
      const secretsResult = await searchContent({
        reasoning: 'Security audit: Finding potential hardcoded secrets',
        query: 'API_KEY|SECRET_KEY|password',
        path: fixture.rootDir,
      });
      
      // Assert: Found potential issues
      expect(secretsResult.files.length).toBeGreaterThan(0);
    });
    
    it('find console.log statements for cleanup', async () => {
      // Find console.log statements
      const consoleResult = await searchContent({
        reasoning: 'Cleanup: Finding console.log statements to remove',
        query: 'console.log',
        path: fixture.rootDir,
      });
      
      // Assert: Found some
      expect(consoleResult.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Scenario: Finding where something is used
  // ==========================================================================
  
  describe('Scenario: Finding where something is used', () => {
    it('find all uses of a function', async () => {
      // Find where formatDate is used
      const usageResult = await searchContent({
        reasoning: 'Finding all usages of formatDate function',
        query: 'formatDate',
        path: fixture.rootDir,
      });
      
      // Assert: Found definition and usage
      expect(usageResult.files.length).toBeGreaterThan(0);
      
      // Should find in formatters.ts (definition) and UserProfile.tsx (usage)
      const filePaths = usageResult.files.map(f => f.path);
      expect(filePaths.some(p => p.includes('formatters'))).toBe(true);
      expect(filePaths.some(p => p.includes('UserProfile'))).toBe(true);
    });
    
    it('find all imports of a module', async () => {
      // Find where utils is imported
      const importResult = await searchContent({
        reasoning: 'Finding all imports from utils',
        query: 'from.*utils',
        path: fixture.rootDir,
      });
      
      // Assert: Found imports
      expect(importResult.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Scenario: Working with tests
  // ==========================================================================
  
  describe('Scenario: Working with tests', () => {
    it('find test files for a component', async () => {
      // Step 1: Find all test files
      const testFilesResult = await searchFiles({
        reasoning: 'Finding all test files',
        pattern: '*.test.ts',
        path: fixture.rootDir,
      });
      
      // Assert: Found test files
      expect(testFilesResult.files.length).toBeGreaterThan(0);
      
      // Step 2: Search for specific test content
      const describeResult = await searchContent({
        reasoning: 'Finding describe blocks in tests',
        query: 'describe\\(',
        path: fixture.rootDir,
        file_pattern: '*.test.ts',
      });
      
      // Assert: Found describe blocks
      expect(describeResult.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Scenario: Configuration management
  // ==========================================================================
  
  describe('Scenario: Configuration management', () => {
    it('find all config files', async () => {
      // Find JSON config files
      const configResult = await searchFiles({
        reasoning: 'Finding all configuration files',
        pattern: '*.config.{json,js,ts}',
        path: fixture.rootDir,
      });
      
      // Assert: Found config files
      expect(configResult.files.length).toBeGreaterThan(0);
      expect(configResult.files.some(f => f.path.includes('app.config.json'))).toBe(true);
    });
    
    it('find environment files', async () => {
      // Find env files (including hidden ones)
      const envResult = await searchFiles({
        reasoning: 'Finding environment configuration files',
        pattern: '.env*',
        path: fixture.rootDir,
        include_hidden: true,
      });
      
      // Assert: Found env files
      expect(envResult.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Scenario: Refactoring preparation
  // ==========================================================================
  
  describe('Scenario: Refactoring preparation', () => {
    it('find all files that need to be updated when renaming', async () => {
      // Imagine we're renaming "isValidEmail" to "validateEmail"
      // Find all usages first
      const usageResult = await searchContent({
        reasoning: 'Preparing to refactor: finding all isValidEmail usages',
        query: 'isValidEmail',
        path: fixture.rootDir,
      });
      
      // Assert: Found the function
      expect(usageResult.files.length).toBeGreaterThan(0);
      
      // Get the file list for the refactor
      const filesToUpdate = usageResult.files.map(f => f.path);
      expect(filesToUpdate.length).toBeGreaterThan(0);
    });
    
    it('find interface definitions before modifying', async () => {
      // Find all interface definitions (use simpler pattern)
      const interfaceResult = await searchContent({
        reasoning: 'Finding interface definitions before making changes',
        query: 'interface',
        path: fixture.rootDir,
        file_pattern: '*.tsx',  // Interfaces are in TSX files
      });
      
      // Assert: Found interfaces
      expect(interfaceResult.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Scenario: Documentation review
  // ==========================================================================
  
  describe('Scenario: Documentation review', () => {
    it('find all markdown documentation', async () => {
      // Find all markdown files
      const docsResult = await searchFiles({
        reasoning: 'Finding all documentation files',
        pattern: '*.md',
        path: fixture.rootDir,
      });
      
      // Assert: Found docs
      expect(docsResult.files.length).toBeGreaterThan(0);
      expect(docsResult.files.some(f => f.path.includes('README'))).toBe(true);
    });
    
    it('find code comments for documentation', async () => {
      // Find JSDoc style comments
      const commentResult = await searchContent({
        reasoning: 'Finding JSDoc comments for API documentation',
        query: '/\\*\\*',
        path: fixture.rootDir,
        file_pattern: '*.ts',
      });
      
      // Assert: Found comments
      expect(commentResult.files.length).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Performance expectations
  // ==========================================================================
  
  describe('Performance expectations', () => {
    it('completes searches in reasonable time', async () => {
      const startTime = Date.now();
      
      // Run multiple operations
      await Promise.all([
        searchFiles({
          reasoning: 'Performance test 1',
          pattern: '*.ts',
          path: fixture.rootDir,
        }),
        searchContent({
          reasoning: 'Performance test 2',
          query: 'function',
          path: fixture.rootDir,
        }),
        fuzzyFind({
          reasoning: 'Performance test 3',
          query: 'button',
          path: fixture.rootDir,
        }),
        tree({
          reasoning: 'Performance test 4',
          path: fixture.rootDir,
        }),
      ]);
      
      const totalTime = Date.now() - startTime;
      
      // All operations should complete in under 5 seconds
      expect(totalTime).toBeLessThan(5000);
    });
  });
  
  // ==========================================================================
  // Consistency checks
  // ==========================================================================
  
  describe('Consistency checks', () => {
    it('search_files and fuzzy_find find same file', async () => {
      // Search for Button.tsx with both methods
      const globResult = await searchFiles({
        reasoning: 'Finding Button.tsx with glob',
        pattern: 'Button.tsx',
        path: fixture.rootDir,
      });
      
      const fuzzyResult = await fuzzyFind({
        reasoning: 'Finding Button.tsx with fuzzy',
        query: 'Button.tsx',
        path: fixture.rootDir,
      });
      
      // Both should find it
      expect(globResult.files.some(f => f.path.includes('Button.tsx'))).toBe(true);
      expect(fuzzyResult.files.some(f => f.path.includes('Button.tsx'))).toBe(true);
    });
    
    it('tree and search_files show consistent files', async () => {
      // Get tree of src
      const treeResult = await tree({
        reasoning: 'Getting src tree',
        path: `${fixture.rootDir}/src`,
        depth: 5,
      });
      
      // Get all files in src
      const filesResult = await searchFiles({
        reasoning: 'Getting all src files',
        pattern: '*',
        path: `${fixture.rootDir}/src`,
      });
      
      // Tree should contain all files found by search
      for (const file of filesResult.files) {
        const fileName = file.path.split('/').pop()!;
        expect(treeResult.tree).toContain(fileName);
      }
    });
  });
});
