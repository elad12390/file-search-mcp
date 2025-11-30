import { lstat, readlink, realpath } from 'fs/promises';
import { resolve, dirname } from 'path';

/**
 * Track visited directories to prevent symlink loops
 */
export class SymlinkTracker {
  private visitedInodes: Set<string> = new Set();
  private visitedPaths: Set<string> = new Set();

  /**
   * Check if a path has been visited (potential loop)
   * Returns true if safe to visit, false if loop detected
   */
  async checkAndMark(filePath: string): Promise<boolean> {
    try {
      const stats = await lstat(filePath);
      
      // Create unique identifier from device + inode
      const inodeKey = `${stats.dev}:${stats.ino}`;
      
      if (this.visitedInodes.has(inodeKey)) {
        return false; // Loop detected
      }
      
      this.visitedInodes.add(inodeKey);
      
      // Also track by resolved path for extra safety
      if (stats.isSymbolicLink()) {
        try {
          const realPath = await realpath(filePath);
          if (this.visitedPaths.has(realPath)) {
            return false; // Loop detected
          }
          this.visitedPaths.add(realPath);
        } catch {
          // Can't resolve symlink, skip it
          return false;
        }
      }
      
      return true;
    } catch {
      // Can't stat file, skip it
      return false;
    }
  }

  /**
   * Check if a path is a symlink
   */
  async isSymlink(filePath: string): Promise<boolean> {
    try {
      const stats = await lstat(filePath);
      return stats.isSymbolicLink();
    } catch {
      return false;
    }
  }

  /**
   * Resolve a symlink to its target
   */
  async resolveSymlink(filePath: string): Promise<string | null> {
    try {
      const linkTarget = await readlink(filePath);
      // Resolve relative symlinks
      const absoluteTarget = resolve(dirname(filePath), linkTarget);
      return absoluteTarget;
    } catch {
      return null;
    }
  }

  /**
   * Reset the tracker (for new search)
   */
  reset(): void {
    this.visitedInodes.clear();
    this.visitedPaths.clear();
  }
}

/**
 * Create a new symlink tracker instance
 */
export function createSymlinkTracker(): SymlinkTracker {
  return new SymlinkTracker();
}
