#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  SearchFilesSchema,
  SearchContentSchema,
  FuzzyFindSchema,
  TreeSchema,
} from './types.js';

import { searchFiles } from './tools/search-files.js';
import { searchContent } from './tools/search-content.js';
import { fuzzyFind } from './tools/fuzzy-find.js';
import { tree } from './tools/tree.js';
import { formatSearchResultsText } from './utils/truncate.js';
import { withMetrics } from './utils/metrics.js';

// ============================================================================
// Server Setup
// ============================================================================

const server = new McpServer(
  {
    name: 'file-search-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// Tool: search_files
// ============================================================================

server.tool(
  'search_files',
  `Find files by name or pattern - blazingly fast even in massive monorepos.

Uses optimized filesystem traversal that respects .gitignore by default, skips binary files, and handles symlinks safely. Unlike \`find\`, it won't hang on huge directories or follow infinite loops.

Examples: "*.ts", "test_*", "src/**/*.config.js"`,
  {
    reasoning: SearchFilesSchema.shape.reasoning,
    pattern: SearchFilesSchema.shape.pattern,
    path: SearchFilesSchema.shape.path,
    include_hidden: SearchFilesSchema.shape.include_hidden,
    ignore_gitignore: SearchFilesSchema.shape.ignore_gitignore,
    exclude: SearchFilesSchema.shape.exclude,
    detail_level: SearchFilesSchema.shape.detail_level,
    modified_within: SearchFilesSchema.shape.modified_within,
    min_size: SearchFilesSchema.shape.min_size,
  },
  async (args) => {
    const input = SearchFilesSchema.parse(args);
    const result = await withMetrics('search_files', input, () => searchFiles(input));
    
    return {
      content: [
        {
          type: 'text',
          text: formatSearchResultsText(result),
        },
      ],
    };
  }
);

// ============================================================================
// Tool: search_content
// ============================================================================

server.tool(
  'search_content',
  `Find text or patterns inside files - powered by ripgrep (rg).

100x faster than grep on large codebases. Smart case-sensitivity (case-insensitive unless your query has capitals). Auto-skips binary files and respects .gitignore. Returns matches with surrounding context so you understand the code.

Examples: "TODO", "function.*export", "apiKey"

Requires ripgrep to be installed:
  macOS: brew install ripgrep
  Ubuntu: apt install ripgrep
  Windows: choco install ripgrep`,
  {
    reasoning: SearchContentSchema.shape.reasoning,
    query: SearchContentSchema.shape.query,
    path: SearchContentSchema.shape.path,
    file_pattern: SearchContentSchema.shape.file_pattern,
    include_hidden: SearchContentSchema.shape.include_hidden,
    ignore_gitignore: SearchContentSchema.shape.ignore_gitignore,
    exclude: SearchContentSchema.shape.exclude,
    detail_level: SearchContentSchema.shape.detail_level,
    context_lines: SearchContentSchema.shape.context_lines,
  },
  async (args) => {
    const input = SearchContentSchema.parse(args);
    const result = await withMetrics('search_content', input, () => searchContent(input));
    
    return {
      content: [
        {
          type: 'text',
          text: formatSearchResultsText(result),
        },
      ],
    };
  }
);

// ============================================================================
// Tool: fuzzy_find
// ============================================================================

server.tool(
  'fuzzy_find',
  `Fuzzy search for files when you don't remember the exact name.

Type "usrctl" to find "UserController.ts". Ranked by match quality so the best results come first. Great for navigating unfamiliar codebases or finding files you vaguely remember.

Examples: "userctrl", "apirts", "cfgjson"`,
  {
    reasoning: FuzzyFindSchema.shape.reasoning,
    query: FuzzyFindSchema.shape.query,
    path: FuzzyFindSchema.shape.path,
    include_hidden: FuzzyFindSchema.shape.include_hidden,
    detail_level: FuzzyFindSchema.shape.detail_level,
  },
  async (args) => {
    const input = FuzzyFindSchema.parse(args);
    const result = await withMetrics('fuzzy_find', input, () => fuzzyFind(input));
    
    return {
      content: [
        {
          type: 'text',
          text: formatSearchResultsText(result),
        },
      ],
    };
  }
);

// ============================================================================
// Tool: tree
// ============================================================================

server.tool(
  'tree',
  `Visualize directory structure at a glance.

Instantly understand how a project is organized without running multiple ls commands. Configurable depth prevents overwhelming output in deep repos.

Perfect for: "Show me the project structure", "What's in the src folder?"`,
  {
    reasoning: TreeSchema.shape.reasoning,
    path: TreeSchema.shape.path,
    depth: TreeSchema.shape.depth,
    include_hidden: TreeSchema.shape.include_hidden,
    dirs_only: TreeSchema.shape.dirs_only,
  },
  async (args) => {
    const input = TreeSchema.parse(args);
    const result = await withMetrics('tree', input, () => tree(input));
    
    const summary = [
      result.tree,
      '',
      `📊 ${result.totalDirs} directories, ${result.totalFiles} files`,
    ];
    
    if (result.truncated) {
      summary.push('⚠️  Output truncated to fit response size limit');
    }
    
    return {
      content: [
        {
          type: 'text',
          text: summary.join('\n'),
        },
      ],
    };
  }
);

// ============================================================================
// Error Handling
// ============================================================================

process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('[file-search-mcp] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[file-search-mcp] Unhandled rejection:', reason);
});

// ============================================================================
// Start Server
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[file-search-mcp] Server started');
}

main().catch((error) => {
  console.error('[file-search-mcp] Fatal error:', error);
  process.exit(1);
});
