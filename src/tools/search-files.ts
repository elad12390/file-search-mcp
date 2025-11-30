import { resolve } from 'path';
import fastGlob from 'fast-glob';
import { SearchFilesInput, FileMatch, SearchResult, DEFAULT_EXCLUDES } from '../types.js';
import { getFileInfo, parseDuration, parseSize, wasModifiedWithin, isLargerThan, getFilePreview } from '../utils/file-utils.js';
import { truncateSearchResults } from '../utils/truncate.js';

/**
 * Search for files by name/glob pattern
 * 
 * This is the primary file discovery tool - blazingly fast even in massive monorepos.
 * Uses optimized glob matching that respects .gitignore by default.
 */
export async function searchFiles(input: SearchFilesInput): Promise<SearchResult> {
  const startTime = Date.now();
  
  const {
    reasoning,
    pattern,
    path: searchPath = '.',
    include_hidden = true,
    ignore_gitignore = true,
    exclude = [],
    detail_level = 'standard',
    modified_within,
    min_size,
  } = input;

  const absolutePath = resolve(process.cwd(), searchPath);
  
  // Build glob pattern
  let globPattern = pattern;
  
  // If pattern doesn't have directory separators, search recursively
  if (!pattern.includes('/') && !pattern.includes('**')) {
    globPattern = `**/${pattern}`;
  }

  // Build ignore patterns
  const ignorePatterns = [
    ...DEFAULT_EXCLUDES,
    ...exclude,
  ].map(p => p.startsWith('!') ? p : `**/${p}/**`);

  // Add .git to ignores if respecting gitignore
  if (ignore_gitignore) {
    ignorePatterns.push('**/.git/**');
  }

  // Execute glob search
  const files = await fastGlob(globPattern, {
    cwd: absolutePath,
    absolute: true,
    dot: include_hidden,
    ignore: ignorePatterns,
    onlyFiles: true,
    followSymbolicLinks: true,
    suppressErrors: true,
  });

  // Filter by modification time if specified
  let filteredFiles = files;
  
  if (modified_within) {
    const durationMs = parseDuration(modified_within);
    const checks = await Promise.all(
      filteredFiles.map(async (file) => ({
        file,
        matches: await wasModifiedWithin(file, durationMs),
      }))
    );
    filteredFiles = checks.filter(c => c.matches).map(c => c.file);
  }

  // Filter by size if specified
  if (min_size) {
    const sizeBytes = parseSize(min_size);
    const checks = await Promise.all(
      filteredFiles.map(async (file) => ({
        file,
        matches: await isLargerThan(file, sizeBytes),
      }))
    );
    filteredFiles = checks.filter(c => c.matches).map(c => c.file);
  }

  // Build results based on detail level
  const fileMatches: FileMatch[] = await Promise.all(
    filteredFiles.map(async (filePath): Promise<FileMatch> => {
      const relativePath = filePath.replace(absolutePath + '/', '');
      
      if (detail_level === 'minimal') {
        return { path: relativePath };
      }

      const info = await getFileInfo(filePath, true);
      const match: FileMatch = {
        path: relativePath,
        size: info.size,
        sizeFormatted: info.sizeFormatted,
        modified: info.modified,
      };

      if (detail_level === 'full') {
        const preview = await getFilePreview(filePath, 10);
        if (preview) {
          match.preview = preview;
        }
      }

      return match;
    })
  );

  const searchTime = Date.now() - startTime;
  
  return truncateSearchResults(fileMatches, reasoning, searchTime);
}
