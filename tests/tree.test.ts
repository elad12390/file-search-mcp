/**
 * Black-Box Tests for tree
 * 
 * Philosophy: Test BEHAVIOR through PUBLIC INTERFACE, not implementation.
 * 
 * We test what the tool DOES:
 * - Given a directory → returns visual tree structure
 * - Given depth limit → respects it
 * - Correctly counts files and directories
 * 
 * We DON'T test:
 * - How the tree is traversed internally
 * - String formatting implementation details
 * - Internal recursion logic
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tree } from '../src/tools/tree.js';
import { createTestFixture, TestFixture } from './fixtures.js';

describe('tree', () => {
  let fixture: TestFixture;
  
  beforeAll(async () => {
    fixture = await createTestFixture();
    process.chdir(fixture.rootDir);
  });
  
  afterAll(async () => {
    await fixture.cleanup();
  });
  
  // ==========================================================================
  // Core Behavior: Directory visualization
  // ==========================================================================
  
  describe('directory visualization', () => {
    it('shows directory structure', async () => {
      // Arrange
      const input = {
        reasoning: 'Understanding project structure',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should contain visual tree structure
      expect(result.tree).toContain('src');
      expect(result.tree).toContain('├──');
      expect(result.tree).toContain('└──');
    });
    
    it('shows nested directories', async () => {
      // Arrange
      const input = {
        reasoning: 'Viewing nested structure',
        path: fixture.rootDir,
        depth: 3,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should show src/components
      expect(result.tree).toContain('components');
      expect(result.tree).toContain('utils');
    });
    
    it('shows files in directories', async () => {
      // Arrange
      const input = {
        reasoning: 'Viewing files in tree',
        path: fixture.rootDir,
        depth: 4,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should show actual files
      expect(result.tree).toContain('Button.tsx');
      expect(result.tree).toContain('package.json');
    });
    
    it('uses folder and file icons', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing icons in tree',
        path: fixture.rootDir,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should have emoji icons
      expect(result.tree).toContain('📁'); // Folder icon
      expect(result.tree).toContain('📄'); // File icon
    });
  });
  
  // ==========================================================================
  // Behavior: Depth limiting
  // ==========================================================================
  
  describe('depth limiting', () => {
    it('respects depth limit of 1', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing depth limit of 1',
        path: fixture.rootDir,
        depth: 1,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should only show top-level items
      expect(result.tree).toContain('src');
      expect(result.tree).toContain('config');
      // Should NOT show nested files
      expect(result.tree).not.toContain('Button.tsx');
    });
    
    it('respects depth limit of 2', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing depth limit of 2',
        path: fixture.rootDir,
        depth: 2,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should show second level
      expect(result.tree).toContain('components');
      expect(result.tree).toContain('utils');
    });
    
    it('shows full structure with high depth', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing high depth',
        path: fixture.rootDir,
        depth: 10,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should show all files
      expect(result.tree).toContain('Button.tsx');
      expect(result.tree).toContain('validators.ts');
    });
  });
  
  // ==========================================================================
  // Behavior: Hidden files handling
  // ==========================================================================
  
  describe('hidden files handling', () => {
    it('excludes hidden files by default', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing hidden files exclusion',
        path: fixture.rootDir,
        include_hidden: false,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should not show .gitignore
      expect(result.tree).not.toContain('.gitignore');
    });
    
    it('includes hidden files when requested', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing hidden files inclusion',
        path: fixture.rootDir,
        include_hidden: true,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should show .gitignore
      expect(result.tree).toContain('.gitignore');
    });
  });
  
  // ==========================================================================
  // Behavior: Directories only mode
  // ==========================================================================
  
  describe('directories only mode', () => {
    it('shows only directories when dirs_only is true', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing dirs_only mode',
        path: fixture.rootDir,
        dirs_only: true,
        depth: 5,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should show directories
      expect(result.tree).toContain('src');
      expect(result.tree).toContain('components');
      // Should NOT show files
      expect(result.tree).not.toContain('Button.tsx');
      expect(result.tree).not.toContain('package.json');
    });
    
    it('counts only directories when dirs_only is true', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing dirs_only counts',
        path: fixture.rootDir,
        dirs_only: true,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: File count should be 0
      expect(result.totalFiles).toBe(0);
      expect(result.totalDirs).toBeGreaterThan(0);
    });
  });
  
  // ==========================================================================
  // Behavior: Counting files and directories
  // ==========================================================================
  
  describe('counting', () => {
    it('counts files correctly', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing file counting',
        path: fixture.rootDir,
        depth: 10,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should have files counted
      expect(result.totalFiles).toBeGreaterThan(0);
    });
    
    it('counts directories correctly', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing directory counting',
        path: fixture.rootDir,
        depth: 10,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should have directories counted
      expect(result.totalDirs).toBeGreaterThan(0);
    });
    
    it('excludes node_modules from counts', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing node_modules exclusion in counts',
        path: fixture.rootDir,
        depth: 10,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: node_modules content should not be counted
      expect(result.tree).not.toContain('some-package');
    });
  });
  
  // ==========================================================================
  // Behavior: Subdirectory tree
  // ==========================================================================
  
  describe('subdirectory tree', () => {
    it('shows tree for subdirectory', async () => {
      // Arrange
      const input = {
        reasoning: 'Viewing only src directory',
        path: `${fixture.rootDir}/src`,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should show src contents, not full project
      expect(result.tree).toContain('components');
      expect(result.tree).toContain('utils');
      expect(result.tree).not.toContain('package.json');
    });
    
    it('shows tree for deeply nested directory', async () => {
      // Arrange
      const input = {
        reasoning: 'Viewing only components directory',
        path: `${fixture.rootDir}/src/components`,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert
      expect(result.tree).toContain('Button.tsx');
      expect(result.tree).toContain('Modal.tsx');
      expect(result.tree).not.toContain('utils');
    });
  });
  
  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  
  describe('edge cases', () => {
    it('handles empty directory', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing empty directory',
        path: `${fixture.rootDir}/empty-dir`,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should not error, just show empty tree
      expect(result.tree).toBeDefined();
      expect(result.totalFiles).toBe(0);
      expect(result.totalDirs).toBe(0);
    });
    
    it('preserves reasoning in results', async () => {
      // Arrange
      const reasoning = 'My specific tree reasoning';
      const input = {
        reasoning,
        path: fixture.rootDir,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert
      expect(result.reasoning).toBe(reasoning);
    });
    
    it('indicates truncation when needed', async () => {
      // Arrange: Use full depth on our fixture
      const input = {
        reasoning: 'Testing truncation indicator',
        path: fixture.rootDir,
        depth: 10,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: truncated should be boolean
      expect(typeof result.truncated).toBe('boolean');
    });
    
    it('sorts directories before files', async () => {
      // Arrange
      const input = {
        reasoning: 'Testing sort order',
        path: `${fixture.rootDir}/src`,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Directories (components, utils) should appear before files (index.ts)
      const lines = result.tree.split('\n');
      const componentsLine = lines.findIndex(l => l.includes('components'));
      const indexLine = lines.findIndex(l => l.includes('index.ts'));
      
      expect(componentsLine).toBeLessThan(indexLine);
    });
  });
  
  // ==========================================================================
  // Real-world scenarios
  // ==========================================================================
  
  describe('real-world scenarios', () => {
    it('helps understand unfamiliar codebase structure', async () => {
      // Arrange: New developer wants to understand the project
      const input = {
        reasoning: 'New to this project, need to understand structure',
        path: fixture.rootDir,
        depth: 2,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert: Should provide useful overview
      expect(result.tree).toContain('src');
      expect(result.tree).toContain('tests');
      expect(result.tree).toContain('config');
      expect(result.totalDirs).toBeGreaterThan(0);
    });
    
    it('shows component library structure', async () => {
      // Arrange: Want to see what components are available
      const input = {
        reasoning: 'Looking at available React components',
        path: `${fixture.rootDir}/src/components`,
        depth: 1,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert
      expect(result.tree).toContain('Button.tsx');
      expect(result.tree).toContain('Modal.tsx');
      expect(result.tree).toContain('UserProfile.tsx');
    });
    
    it('shows config directory structure', async () => {
      // Arrange
      const input = {
        reasoning: 'Checking what config files exist',
        path: `${fixture.rootDir}/config`,
        include_hidden: true,
      };
      
      // Act
      const result = await tree(input);
      
      // Assert
      expect(result.tree).toContain('app.config.json');
      expect(result.tree).toContain('.env.local');
    });
  });
});
