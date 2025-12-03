#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  SearchFilesSchema,
  SearchContentSchema,
  FuzzyFindSchema,
  TreeSchema,
  SearchResult,
} from './types.js';

import { searchFiles } from './tools/search-files.js';
import { searchContent } from './tools/search-content.js';
import { fuzzyFind } from './tools/fuzzy-find.js';
import { tree } from './tools/tree.js';
import { formatSearchResultsText } from './utils/truncate.js';
import { withMetrics } from './utils/metrics.js';
import { searchCache, QueryCache } from './utils/cache.js';
import { suggestContextLines } from './utils/suggestions.js';

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
  `USE INSTEAD OF GLOB/FIND. Find files by pattern with built-in previews - eliminates follow-up read calls.

Respects .gitignore, skips binary files, filters by size/date, handles symlinks safely. Perfect for exploring unfamiliar codebases or analyzing build infrastructure.

Set detail_level="full" to get content previews without separate read calls.

Examples: "*.yml" in .github/workflows/, "**/Jenkinsfile*", "*.config.js"`,
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
    
    // Check cache first
    const cacheKey = QueryCache.generateKey('search_files', input);
    const cached = searchCache.get(cacheKey) as SearchResult | undefined;
    
    if (cached) {
      return {
        content: [
          {
            type: 'text',
            text: `[cached] ` + formatSearchResultsText(cached, { 
              query: input.pattern, 
              tool: 'search_files' 
            }),
          },
        ],
      };
    }
    
    const result = await withMetrics('search_files', input, () => searchFiles(input));
    
    // Cache successful results
    if (result.files.length > 0) {
      searchCache.set(cacheKey, result);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: formatSearchResultsText(result, { 
            query: input.pattern, 
            tool: 'search_files' 
          }),
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
  `USE INSTEAD OF GREP. Search file contents with surrounding context - see matches in context without follow-up reads.

Respects .gitignore, skips binary files, smart case-sensitivity. Use for finding implementations, tracing function calls, or analyzing patterns across a codebase.

Use context_lines parameter to control how much surrounding code you see (default: 2 lines).

Examples: "slackSend|notification" in *.groovy, "webhook" across all files, "TODO" in src/

Requires ripgrep: brew install ripgrep (macOS) | apt install ripgrep (Ubuntu)`,
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
    
    // Apply smart context_lines if not explicitly set and using default
    if (input.context_lines === 2) {
      const suggested = suggestContextLines(input.query);
      if (suggested !== 2) {
        input.context_lines = suggested;
      }
    }
    
    // Check cache first
    const cacheKey = QueryCache.generateKey('search_content', input);
    const cached = searchCache.get(cacheKey) as SearchResult | undefined;
    
    if (cached) {
      return {
        content: [
          {
            type: 'text',
            text: `[cached] ` + formatSearchResultsText(cached, { 
              query: input.query, 
              tool: 'search_content' 
            }),
          },
        ],
      };
    }
    
    const result = await withMetrics('search_content', input, () => searchContent(input));
    
    // Cache successful results
    if (result.files.length > 0) {
      searchCache.set(cacheKey, result);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: formatSearchResultsText(result, { 
            query: input.query, 
            tool: 'search_content' 
          }),
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
  `USE WHEN YOU DON'T KNOW THE EXACT FILENAME. Fuzzy search that finds "UserController.ts" when you type "usrctl".

Ranked by match quality - best matches first. Perfect when you vaguely remember a filename or are exploring an unfamiliar codebase.

Much faster than glob with wildcards when you're guessing at names.

Examples: "userctrl" → UserController.ts, "jenkfile" → Jenkinsfile, "slacklib" → slackLib.groovy`,
  {
    reasoning: FuzzyFindSchema.shape.reasoning,
    query: FuzzyFindSchema.shape.query,
    path: FuzzyFindSchema.shape.path,
    include_hidden: FuzzyFindSchema.shape.include_hidden,
    detail_level: FuzzyFindSchema.shape.detail_level,
  },
  async (args) => {
    const input = FuzzyFindSchema.parse(args);
    
    // Check cache first
    const cacheKey = QueryCache.generateKey('fuzzy_find', input);
    const cached = searchCache.get(cacheKey) as SearchResult | undefined;
    
    if (cached) {
      return {
        content: [
          {
            type: 'text',
            text: `[cached] ` + formatSearchResultsText(cached, { 
              query: input.query, 
              tool: 'fuzzy_find' 
            }),
          },
        ],
      };
    }
    
    const result = await withMetrics('fuzzy_find', input, () => fuzzyFind(input));
    
    // Cache successful results
    if (result.files.length > 0) {
      searchCache.set(cacheKey, result);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: formatSearchResultsText(result, { 
            query: input.query, 
            tool: 'fuzzy_find' 
          }),
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
  `USE INSTEAD OF LS/FIND FOR STRUCTURE. Visualize directory layout without multiple commands.

Get instant overview of project organization. Configurable depth prevents overwhelming output in deep repos.

Use this first when exploring a new codebase - shows you where to look before you start searching.

Perfect for: "Show me the project structure", "What's in repos/jenkins/", "How is src/ organized?"`,
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
