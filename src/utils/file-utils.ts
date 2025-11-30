import { stat, readFile } from 'fs/promises';
import { extname } from 'path';
import { BINARY_EXTENSIONS, FileInfo } from '../types.js';

/**
 * Check if a file is likely binary based on extension
 */
export function isBinaryFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Check if content appears to be binary (contains null bytes)
 */
export function isBinaryContent(buffer: Buffer): boolean {
  // Check first 8000 bytes for null bytes (common indicator of binary)
  const checkLength = Math.min(buffer.length, 8000);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Get file info with optional stats
 */
export async function getFileInfo(filePath: string, includeStats: boolean = true): Promise<FileInfo> {
  const info: FileInfo = { path: filePath };
  
  if (includeStats) {
    try {
      const stats = await stat(filePath);
      info.size = stats.size;
      info.sizeFormatted = formatSize(stats.size);
      info.modified = stats.mtime.toISOString();
      info.isDirectory = stats.isDirectory();
    } catch {
      // File might have been deleted, ignore
    }
  }
  
  return info;
}

/**
 * Format file size in human-readable format
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Parse size string to bytes (e.g., "1MB" -> 1048576)
 */
export function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/i);
  if (!match) {
    throw new Error(`Invalid size format: ${sizeStr}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  
  const multipliers: Record<string, number> = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'TB': 1024 * 1024 * 1024 * 1024,
  };
  
  return Math.floor(value * multipliers[unit]);
}

/**
 * Parse time duration string to milliseconds (e.g., "24h" -> 86400000)
 */
export function parseDuration(durationStr: string): number {
  const match = durationStr.match(/^(\d+(?:\.\d+)?)\s*(m|h|d|w)?$/i);
  if (!match) {
    throw new Error(`Invalid duration format: ${durationStr}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'h').toLowerCase();
  
  const multipliers: Record<string, number> = {
    'm': 60 * 1000,           // minutes
    'h': 60 * 60 * 1000,      // hours
    'd': 24 * 60 * 60 * 1000, // days
    'w': 7 * 24 * 60 * 60 * 1000, // weeks
  };
  
  return Math.floor(value * multipliers[unit]);
}

/**
 * Read file content safely, handling binary files
 */
export async function readFileSafe(filePath: string, maxBytes: number = 50000): Promise<string | null> {
  if (isBinaryFile(filePath)) {
    return null;
  }
  
  try {
    const buffer = await readFile(filePath);
    
    if (isBinaryContent(buffer)) {
      return null;
    }
    
    const content = buffer.toString('utf-8');
    if (content.length > maxBytes) {
      return content.slice(0, maxBytes) + '\n... [truncated]';
    }
    
    return content;
  } catch {
    return null;
  }
}

/**
 * Get file preview (first N lines)
 */
export async function getFilePreview(filePath: string, maxLines: number = 10): Promise<string | null> {
  const content = await readFileSafe(filePath, 10000);
  if (!content) return null;
  
  const lines = content.split('\n').slice(0, maxLines);
  return lines.join('\n');
}

/**
 * Check if file was modified within a time duration
 */
export async function wasModifiedWithin(filePath: string, durationMs: number): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    const now = Date.now();
    return (now - stats.mtime.getTime()) <= durationMs;
  } catch {
    return false;
  }
}

/**
 * Check if file is larger than a given size
 */
export async function isLargerThan(filePath: string, sizeBytes: number): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.size >= sizeBytes;
  } catch {
    return false;
  }
}
