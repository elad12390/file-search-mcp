import { resolve } from 'path';
import { SearchContentInput, FileMatch, SearchResult, DEFAULT_EXCLUDES } from '../types.js';
import { searchWithRipgrep } from '../utils/ripgrep.js';
import { getFileInfo } from '../utils/file-utils.js';
import { truncateSearchResults } from '../utils/truncate.js';

/**
 * Search for content inside files using ripgrep
 * 
 * 100x faster than grep on large codebases. Smart case-sensitivity means
 * case-insensitive unless your query has uppercase letters. Auto-skips
 * binary files and respects .gitignore.
 */
export async function searchContent(input: SearchContentInput): Promise<SearchResult> {
  const startTime = Date.now();
  
  const {
    reasoning,
    query,
    path: searchPath = '.',
    file_pattern,
    include_hidden = true,
    ignore_gitignore = true,
    exclude = [],
    detail_level = 'standard',
    context_lines = 2,
  } = input;

  const absolutePath = resolve(process.cwd(), searchPath);

  // Build exclude patterns
  const excludePatterns = [...DEFAULT_EXCLUDES, ...exclude];

  try {
    // Search with ripgrep
    const matches = await searchWithRipgrep({
      query,
      path: absolutePath,
      filePattern: file_pattern,
      ignoreGitignore: ignore_gitignore,
      includeHidden: include_hidden,
      exclude: excludePatterns,
      contextLines: detail_level === 'minimal' ? 0 : context_lines,
      smartCase: true,
    });

    // Enrich results based on detail level
    const fileMatches: FileMatch[] = await Promise.all(
      matches.map(async (match): Promise<FileMatch> => {
        const relativePath = match.path.replace(absolutePath + '/', '');
        
        if (detail_level === 'minimal') {
          return {
            path: relativePath,
            matches: match.matches?.map(m => ({
              line: m.line,
              content: m.content,
            })),
          };
        }

        const info = await getFileInfo(match.path, true);
        
        return {
          path: relativePath,
          size: info.size,
          sizeFormatted: info.sizeFormatted,
          modified: info.modified,
          matches: match.matches,
        };
      })
    );

    const searchTime = Date.now() - startTime;
    
    return truncateSearchResults(fileMatches, reasoning, searchTime);
    
  } catch (error: any) {
    // Return friendly error message
    const searchTime = Date.now() - startTime;
    
    return {
      files: [],
      totalMatches: 0,
      truncated: false,
      searchTime,
      reasoning: `${reasoning}\n\nError: ${error.message}`,
    };
  }
}
