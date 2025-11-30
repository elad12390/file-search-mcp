import { resolve } from 'path';
import fastGlob from 'fast-glob';
import { Fzf } from 'fzf';
import { FuzzyFindInput, FileMatch, SearchResult, DEFAULT_EXCLUDES } from '../types.js';
import { getFileInfo, getFilePreview } from '../utils/file-utils.js';
import { truncateSearchResults } from '../utils/truncate.js';

/**
 * Fuzzy search for files when you don't remember the exact name
 * 
 * Type "usrctl" to find "UserController.ts". Ranked by match quality
 * so the best results come first. Great for navigating unfamiliar
 * codebases or finding files you vaguely remember.
 */
export async function fuzzyFind(input: FuzzyFindInput): Promise<SearchResult> {
  const startTime = Date.now();
  
  const {
    reasoning,
    query,
    path: searchPath = '.',
    include_hidden = true,
    detail_level = 'standard',
  } = input;

  const absolutePath = resolve(process.cwd(), searchPath);

  // Build ignore patterns
  const ignorePatterns = DEFAULT_EXCLUDES.map(p => `**/${p}/**`);

  // Get all files first
  const allFiles = await fastGlob('**/*', {
    cwd: absolutePath,
    absolute: true,
    dot: include_hidden,
    ignore: ignorePatterns,
    onlyFiles: true,
    followSymbolicLinks: true,
    suppressErrors: true,
  });

  // Convert to relative paths for better fuzzy matching
  const relativePaths = allFiles.map(f => ({
    absolute: f,
    relative: f.replace(absolutePath + '/', ''),
  }));

  // Fuzzy search using fzf algorithm
  const fzf = new Fzf(relativePaths, {
    selector: (item: { absolute: string; relative: string }) => item.relative,
    // Limit results for performance
    limit: 100,
  });

  const results = fzf.find(query);

  // Build results based on detail level
  const fileMatches: FileMatch[] = await Promise.all(
    results.map(async (result: { item: { absolute: string; relative: string } }): Promise<FileMatch> => {
      const { absolute, relative } = result.item;
      
      if (detail_level === 'minimal') {
        return { path: relative };
      }

      const info = await getFileInfo(absolute, true);
      const match: FileMatch = {
        path: relative,
        size: info.size,
        sizeFormatted: info.sizeFormatted,
        modified: info.modified,
      };

      if (detail_level === 'full') {
        const preview = await getFilePreview(absolute, 10);
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
