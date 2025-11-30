import { resolve, basename } from 'path';
import { readdir, stat } from 'fs/promises';
import { TreeInput, TreeResult, DEFAULT_EXCLUDES } from '../types.js';
import { truncateTreeResult } from '../utils/truncate.js';
import { createSymlinkTracker } from '../utils/symlink.js';

interface TreeEntry {
  name: string;
  isDirectory: boolean;
  children?: TreeEntry[];
}

/**
 * Visualize directory structure at a glance
 * 
 * Instantly understand how a project is organized without running
 * multiple ls commands. Configurable depth prevents overwhelming
 * output in deep repos.
 */
export async function tree(input: TreeInput): Promise<TreeResult> {
  const {
    reasoning,
    path: searchPath = '.',
    depth = 3,
    include_hidden = false,
    dirs_only = false,
  } = input;

  const absolutePath = resolve(process.cwd(), searchPath);
  const symlinkTracker = createSymlinkTracker();

  let totalFiles = 0;
  let totalDirs = 0;

  // Build tree recursively
  async function buildTree(dirPath: string, currentDepth: number): Promise<TreeEntry[]> {
    if (currentDepth > depth) {
      return [];
    }

    // Check for symlink loops
    const isSafe = await symlinkTracker.checkAndMark(dirPath);
    if (!isSafe) {
      return [];
    }

    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const result: TreeEntry[] = [];

      // Sort: directories first, then files, alphabetically
      entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) {
          return a.isDirectory() ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });

      for (const entry of entries) {
        const name = entry.name;
        const fullPath = resolve(dirPath, name);

        // Skip hidden files if not requested
        if (!include_hidden && name.startsWith('.')) {
          continue;
        }

        // Skip common ignored directories
        if (entry.isDirectory() && DEFAULT_EXCLUDES.includes(name)) {
          continue;
        }

        // Skip files if dirs_only
        if (dirs_only && !entry.isDirectory()) {
          continue;
        }

        if (entry.isDirectory()) {
          totalDirs++;
          const children = await buildTree(fullPath, currentDepth + 1);
          result.push({
            name,
            isDirectory: true,
            children: children.length > 0 ? children : undefined,
          });
        } else {
          totalFiles++;
          result.push({
            name,
            isDirectory: false,
          });
        }
      }

      return result;
    } catch {
      // Permission denied or other error
      return [];
    }
  }

  const treeData = await buildTree(absolutePath, 1);

  // Format tree as string
  function formatTree(entries: TreeEntry[], prefix: string = ''): string {
    const lines: string[] = [];
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const icon = entry.isDirectory ? '📁' : '📄';
      
      lines.push(`${prefix}${connector}${icon} ${entry.name}`);

      if (entry.children && entry.children.length > 0) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        lines.push(formatTree(entry.children, newPrefix));
      }
    }

    return lines.join('\n');
  }

  const rootName = basename(absolutePath) || absolutePath;
  const treeString = `📁 ${rootName}\n${formatTree(treeData)}`;

  return truncateTreeResult(treeString, totalFiles, totalDirs, reasoning);
}
