import { MAX_CHARS, FileMatch, SearchResult, TreeResult } from '../types.js';
import { 
  generateZeroResultSuggestions, 
  formatSuggestions,
  analyzeQueryComplexity,
} from './suggestions.js';

/**
 * Estimate character count for a result object
 */
function estimateChars(obj: any): number {
  return JSON.stringify(obj).length;
}

/**
 * Truncate search results to fit within token limit
 */
export function truncateSearchResults(
  files: FileMatch[],
  reasoning: string,
  searchTime: number
): SearchResult {
  const result: SearchResult = {
    files: [],
    totalMatches: 0,
    truncated: false,
    searchTime,
    reasoning,
  };

  let currentChars = estimateChars({
    files: [],
    totalMatches: 0,
    truncated: false,
    searchTime,
    reasoning,
  });

  const maxChars = MAX_CHARS - 1000; // Leave buffer for metadata

  for (const file of files) {
    const fileChars = estimateChars(file);
    
    if (currentChars + fileChars > maxChars) {
      result.truncated = true;
      break;
    }

    result.files.push(file);
    result.totalMatches += file.matches?.length || 1;
    currentChars += fileChars;
  }

  // If we still have too many chars, start trimming match content
  if (result.truncated && result.files.length > 0) {
    // Remove content previews from later files
    for (let i = Math.floor(result.files.length / 2); i < result.files.length; i++) {
      if (result.files[i].matches) {
        result.files[i].matches = result.files[i].matches!.slice(0, 3);
        for (const match of result.files[i].matches!) {
          if (match.content.length > 200) {
            match.content = match.content.slice(0, 200) + '...';
          }
          delete match.context;
        }
      }
      delete result.files[i].preview;
    }
  }

  return result;
}

/**
 * Truncate tree output to fit within token limit
 */
export function truncateTreeResult(
  tree: string,
  totalFiles: number,
  totalDirs: number,
  reasoning: string
): TreeResult {
  const result: TreeResult = {
    tree,
    totalFiles,
    totalDirs,
    truncated: false,
    reasoning,
  };

  const maxChars = MAX_CHARS - 1000;

  if (tree.length > maxChars) {
    const lines = tree.split('\n');
    let truncatedTree = '';
    let lineCount = 0;

    for (const line of lines) {
      if (truncatedTree.length + line.length + 1 > maxChars - 100) {
        truncatedTree += '\n... [truncated - too many entries]';
        result.truncated = true;
        break;
      }
      truncatedTree += (lineCount > 0 ? '\n' : '') + line;
      lineCount++;
    }

    result.tree = truncatedTree;
  }

  return result;
}

/**
 * Truncate a string to max length with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export interface FormatOptions {
  query?: string;
  tool?: 'search_content' | 'search_files' | 'fuzzy_find';
  showHints?: boolean;
}

/**
 * Format results for display with optional suggestions and hints
 */
export function formatSearchResultsText(
  result: SearchResult, 
  options: FormatOptions = {}
): string {
  const { query, tool, showHints = true } = options;
  const lines: string[] = [];
  
  lines.push(`Found ${result.totalMatches} match(es) in ${result.files.length} file(s)`);
  lines.push(`Search time: ${result.searchTime}ms`);
  
  if (result.truncated) {
    lines.push('⚠️  Results truncated to fit response size limit');
    lines.push('   Tip: Use detail_level="minimal" to see more results, or narrow your search');
  }
  
  // Zero-result suggestions
  if (result.files.length === 0 && query && tool && showHints) {
    const suggestions = generateZeroResultSuggestions(query, tool);
    if (suggestions.length > 0) {
      lines.push(formatSuggestions(suggestions));
    }
  }

  // Query complexity hints for slow searches
  if (query && showHints && result.searchTime > 300) {
    const { complexity, hints } = analyzeQueryComplexity(query);
    if (complexity === 'complex' && hints.length > 0) {
      lines.push('');
      lines.push('⏱️  Query Performance:');
      for (const hint of hints) {
        lines.push(`   • ${hint}`);
      }
    }
  }
  
  lines.push('');

  for (const file of result.files) {
    lines.push(`📄 ${file.path}`);
    
    if (file.sizeFormatted) {
      lines.push(`   Size: ${file.sizeFormatted} | Modified: ${file.modified}`);
    }

    if (file.matches && file.matches.length > 0) {
      for (const match of file.matches) {
        lines.push(`   L${match.line}: ${truncateString(match.content.trim(), 150)}`);
      }
    }

    if (file.preview) {
      lines.push('   Preview:');
      const previewLines = file.preview.split('\n').slice(0, 5);
      for (const pl of previewLines) {
        lines.push(`   | ${truncateString(pl, 100)}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
