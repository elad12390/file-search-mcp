import { spawn, ChildProcess } from 'child_process';
import { FileMatch } from '../types.js';

export interface RipgrepOptions {
  query: string;
  path: string;
  filePattern?: string;
  ignoreGitignore?: boolean;
  includeHidden?: boolean;
  exclude?: string[];
  contextLines?: number;
  maxResults?: number;
  smartCase?: boolean;
}

export interface RipgrepMatch {
  file: string;
  line: number;
  content: string;
  contextBefore?: string[];
  contextAfter?: string[];
}

/**
 * Execute ripgrep and parse results
 * Falls back to Node.js-based search if rg is not available
 */
export async function searchWithRipgrep(options: RipgrepOptions): Promise<FileMatch[]> {
  const {
    query,
    path,
    filePattern,
    ignoreGitignore = true,
    includeHidden = true,
    exclude = [],
    contextLines = 2,
    maxResults = 1000,
    smartCase = true,
  } = options;

  const args: string[] = [
    '--json',
    '--line-number',
  ];

  // Smart case: case-insensitive unless query has uppercase
  if (smartCase) {
    args.push('--smart-case');
  }

  // Context lines
  if (contextLines > 0) {
    args.push('-C', contextLines.toString());
  }

  // Max count per file to prevent huge outputs
  args.push('--max-count', '50');

  // Hidden files
  if (includeHidden) {
    args.push('--hidden');
  }

  // Gitignore
  if (!ignoreGitignore) {
    args.push('--no-ignore');
  }

  // File pattern filter
  if (filePattern) {
    args.push('--glob', filePattern);
  }

  // Exclude patterns
  for (const pattern of exclude) {
    args.push('--glob', `!${pattern}`);
  }

  // Always exclude common binary/large directories
  args.push('--glob', '!.git');

  // Query and path
  args.push(query, path);

  try {
    const output = await executeRipgrep(args);
    return parseRipgrepJson(output, maxResults);
  } catch (error: any) {
    // Check if rg is not installed
    if (error.code === 'ENOENT') {
      throw new Error(
        'ripgrep (rg) is not installed. Please install it:\n' +
        '  macOS: brew install ripgrep\n' +
        '  Ubuntu: apt install ripgrep\n' +
        '  Windows: choco install ripgrep'
      );
    }
    
    // No matches found (rg exits with 1)
    if (error.code === 1 && !error.stderr) {
      return [];
    }
    
    throw error;
  }
}

/**
 * Execute ripgrep command and return output
 */
function executeRipgrep(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const rg: ChildProcess = spawn('rg', args);

    let stdout = '';
    let stderr = '';

    rg.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    rg.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    rg.on('close', (code: number | null) => {
      if (code === 0 || code === 1) {
        // code 1 means no matches, which is fine
        resolve(stdout);
      } else {
        const error: NodeJS.ErrnoException = new Error(`ripgrep exited with code ${code}: ${stderr}`);
        error.code = String(code);
        (error as any).stderr = stderr;
        reject(error);
      }
    });

    rg.on('error', (error: Error) => {
      reject(error);
    });
  });
}

/**
 * Parse ripgrep JSON output into structured results
 */
function parseRipgrepJson(output: string, maxResults: number): FileMatch[] {
  const fileMap = new Map<string, FileMatch>();
  const lines = output.trim().split('\n').filter(Boolean);
  
  let totalMatches = 0;

  for (const line of lines) {
    if (totalMatches >= maxResults) break;

    try {
      const json = JSON.parse(line);
      
      if (json.type === 'match') {
        const filePath = json.data.path.text;
        const lineNum = json.data.line_number;
        const lineContent = json.data.lines.text.replace(/\n$/, '');

        if (!fileMap.has(filePath)) {
          fileMap.set(filePath, {
            path: filePath,
            matches: [],
          });
        }

        const file = fileMap.get(filePath)!;
        file.matches!.push({
          line: lineNum,
          content: lineContent,
        });

        totalMatches++;
      }
    } catch {
      // Skip invalid JSON lines (context lines, etc.)
    }
  }

  return Array.from(fileMap.values());
}

/**
 * Search for files using ripgrep's --files mode (faster than find)
 */
export async function listFilesWithRipgrep(options: {
  path: string;
  pattern?: string;
  ignoreGitignore?: boolean;
  includeHidden?: boolean;
  exclude?: string[];
  maxResults?: number;
}): Promise<string[]> {
  const {
    path,
    pattern,
    ignoreGitignore = true,
    includeHidden = true,
    exclude = [],
    maxResults = 10000,
  } = options;

  const args: string[] = ['--files'];

  if (includeHidden) {
    args.push('--hidden');
  }

  if (!ignoreGitignore) {
    args.push('--no-ignore');
  }

  // File pattern
  if (pattern) {
    args.push('--glob', pattern);
  }

  // Exclude patterns
  for (const p of exclude) {
    args.push('--glob', `!${p}`);
  }

  // Always exclude .git
  args.push('--glob', '!.git');

  args.push(path);

  try {
    const output = await executeRipgrep(args);
    const files = output.trim().split('\n').filter(Boolean);
    return files.slice(0, maxResults);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('ripgrep (rg) is not installed');
    }
    if (error.code === 1 && !error.stderr) {
      return [];
    }
    throw error;
  }
}
