import { z } from 'zod';

// ============================================================================
// Detail Levels
// ============================================================================

export const DetailLevel = z.enum(['minimal', 'standard', 'full']);
export type DetailLevel = z.infer<typeof DetailLevel>;

// ============================================================================
// Common Schemas (shared across tools)
// ============================================================================

export const BaseSearchSchema = z.object({
  reasoning: z
    .string()
    .describe('Explain why you are using this tool - helps track search patterns and improve results'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in. Defaults to current working directory'),
  include_hidden: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include hidden files and directories (dotfiles). Default: true'),
  ignore_gitignore: z
    .boolean()
    .optional()
    .default(true)
    .describe('Respect .gitignore rules and skip ignored files. Default: true'),
  exclude: z
    .array(z.string())
    .optional()
    .describe('Additional patterns to exclude, e.g. ["node_modules", "dist", "*.log"]'),
  detail_level: DetailLevel
    .optional()
    .default('standard')
    .describe('How much info to return: "minimal" (paths only), "standard" (+ size/date), "full" (+ content preview)'),
});

// ============================================================================
// Search Files Schema
// ============================================================================

export const SearchFilesSchema = BaseSearchSchema.extend({
  pattern: z
    .string()
    .describe('File name or glob pattern to match, e.g. "*.ts", "test_*", "src/**/*.config.js"'),
  modified_within: z
    .string()
    .optional()
    .describe('Only find files modified within this time, e.g. "24h", "7d", "30m"'),
  min_size: z
    .string()
    .optional()
    .describe('Only find files larger than this size, e.g. "1MB", "500KB", "1GB"'),
});

export type SearchFilesInput = z.infer<typeof SearchFilesSchema>;

// ============================================================================
// Search Content Schema
// ============================================================================

export const SearchContentSchema = BaseSearchSchema.extend({
  query: z
    .string()
    .describe('Text or regex pattern to search for inside files, e.g. "TODO", "function.*export", "apiKey"'),
  file_pattern: z
    .string()
    .optional()
    .describe('Only search in files matching this pattern, e.g. "*.ts", "*.{js,jsx}"'),
  context_lines: z
    .number()
    .int()
    .min(0)
    .max(10)
    .optional()
    .default(2)
    .describe('Number of lines to show before and after each match. Default: 2'),
});

export type SearchContentInput = z.infer<typeof SearchContentSchema>;

// ============================================================================
// Fuzzy Find Schema
// ============================================================================

export const FuzzyFindSchema = z.object({
  reasoning: z
    .string()
    .describe('Explain why you are using this tool - helps track search patterns and improve results'),
  query: z
    .string()
    .describe('Fuzzy search query - type approximate file name, e.g. "usrctrl" finds "UserController.ts"'),
  path: z
    .string()
    .optional()
    .describe('Directory to search in. Defaults to current working directory'),
  include_hidden: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include hidden files and directories (dotfiles). Default: true'),
  detail_level: DetailLevel
    .optional()
    .default('standard')
    .describe('How much info to return: "minimal" (paths only), "standard" (+ size/date), "full" (+ content preview)'),
});

export type FuzzyFindInput = z.infer<typeof FuzzyFindSchema>;

// ============================================================================
// Tree Schema
// ============================================================================

export const TreeSchema = z.object({
  reasoning: z
    .string()
    .describe('Explain why you need to see the directory structure'),
  path: z
    .string()
    .optional()
    .describe('Directory to show. Defaults to current working directory'),
  depth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(3)
    .describe('Maximum depth to traverse. Default: 3'),
  include_hidden: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include hidden files and directories (dotfiles). Default: false'),
  dirs_only: z
    .boolean()
    .optional()
    .default(false)
    .describe('Only show directories, not files. Default: false'),
});

export type TreeInput = z.infer<typeof TreeSchema>;

// ============================================================================
// Result Types
// ============================================================================

export interface FileInfo {
  path: string;
  size?: number;
  sizeFormatted?: string;
  modified?: string;
  isDirectory?: boolean;
}

export interface FileMatch extends FileInfo {
  matches?: ContentMatch[];
  preview?: string;
}

export interface ContentMatch {
  line: number;
  content: string;
  context?: {
    before: string[];
    after: string[];
  };
}

export interface SearchResult {
  files: FileMatch[];
  totalMatches: number;
  truncated: boolean;
  searchTime: number;
  reasoning: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: TreeNode[];
}

export interface TreeResult {
  tree: string;
  totalFiles: number;
  totalDirs: number;
  truncated: boolean;
  reasoning: string;
}

// ============================================================================
// Constants
// ============================================================================

export const MAX_TOKENS = 100_000;
export const CHARS_PER_TOKEN = 4; // Rough estimate
export const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;

export const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.svg', '.tiff',
  // Audio/Video
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.webm', '.flac', '.ogg',
  // Archives
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz',
  // Executables/Binaries
  '.exe', '.dll', '.so', '.dylib', '.bin', '.o', '.a',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Fonts
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  // Other
  '.pyc', '.pyo', '.class', '.lock', '.wasm',
]);

export const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'target', // Rust
  'vendor', // Go
];
