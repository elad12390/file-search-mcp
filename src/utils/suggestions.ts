/**
 * Query Suggestions
 * 
 * Provides helpful suggestions when searches return zero results.
 * Based on metrics analysis showing 13% of searches return nothing,
 * often due to overly complex regex patterns.
 */

export interface QuerySuggestion {
  type: 'simplified' | 'fuzzy' | 'alternative' | 'hint';
  message: string;
  suggestedQuery?: string;
}

/**
 * Analyze a query and generate suggestions for zero-result scenarios
 */
export function generateZeroResultSuggestions(
  query: string,
  tool: 'search_content' | 'search_files' | 'fuzzy_find'
): QuerySuggestion[] {
  const suggestions: QuerySuggestion[] = [];

  if (tool === 'search_content') {
    // Check for OR patterns (common source of zero results)
    if (query.includes('|')) {
      const parts = query.split('|').map(p => p.trim());
      const simplest = parts.reduce((a, b) => a.length < b.length ? a : b);
      suggestions.push({
        type: 'simplified',
        message: `Try searching for just "${simplest}" instead of the OR pattern`,
        suggestedQuery: simplest,
      });

      // Suggest searching for each part individually
      if (parts.length <= 3) {
        suggestions.push({
          type: 'hint',
          message: `Consider searching for each term separately: ${parts.map(p => `"${p}"`).join(', ')}`,
        });
      }
    }

    // Check for complex regex patterns
    if (/\.\*/.test(query)) {
      const simpler = query.replace(/\.\*/g, ' ').replace(/\s+/g, ' ').trim();
      if (simpler !== query && simpler.length > 2) {
        suggestions.push({
          type: 'simplified',
          message: `Try a simpler search without wildcards: "${simpler}"`,
          suggestedQuery: simpler,
        });
      }
    }

    // Check for escaped special chars that might not be needed
    if (/\\[.()[\]{}+*?^$|]/.test(query)) {
      const unescaped = query.replace(/\\([.()[\]{}+*?^$|])/g, '$1');
      suggestions.push({
        type: 'alternative',
        message: `If searching for literal text, try: "${unescaped}"`,
        suggestedQuery: unescaped,
      });
    }

    // Check for case sensitivity issues
    if (/[A-Z]/.test(query) && /[a-z]/.test(query)) {
      const lower = query.toLowerCase();
      suggestions.push({
        type: 'alternative',
        message: `Note: Search is case-sensitive when query has uppercase. Try lowercase: "${lower}"`,
        suggestedQuery: lower,
      });
    }

    // Suggest using fuzzy_find for file-like patterns
    if (/\w+\.\w+$/.test(query) || /\w+Controller|\w+Service|\w+Component/.test(query)) {
      suggestions.push({
        type: 'hint',
        message: 'If looking for a file by name, try fuzzy_find instead of search_content',
      });
    }
  }

  if (tool === 'search_files') {
    // Check if pattern might need recursive matching
    if (!query.includes('**') && !query.includes('/')) {
      suggestions.push({
        type: 'hint',
        message: 'Pattern automatically searches recursively. Make sure extension is correct (e.g., *.ts, *.py)',
      });
    }

    // Check for typos in common extensions
    const extensionTypos: Record<string, string> = {
      '.typescript': '.ts',
      '.javascript': '.js',
      '.python': '.py',
      '.yml': '.yaml',
      '.yaml': '.yml',
    };
    for (const [typo, correct] of Object.entries(extensionTypos)) {
      if (query.includes(typo)) {
        suggestions.push({
          type: 'alternative',
          message: `Did you mean "${correct}" instead of "${typo}"?`,
          suggestedQuery: query.replace(typo, correct),
        });
      }
    }
  }

  // Universal suggestions
  if (suggestions.length === 0) {
    suggestions.push({
      type: 'hint',
      message: 'No matches found. Try: 1) Broader search terms, 2) Different path, 3) Check spelling',
    });
  }

  return suggestions;
}

/**
 * Format suggestions for display
 */
export function formatSuggestions(suggestions: QuerySuggestion[]): string {
  if (suggestions.length === 0) return '';

  const lines = ['', '💡 Suggestions:'];
  
  for (const suggestion of suggestions) {
    const icon = suggestion.type === 'hint' ? '  •' : '  →';
    lines.push(`${icon} ${suggestion.message}`);
  }

  return lines.join('\n');
}

/**
 * Analyze query complexity and provide optimization hints
 */
export function analyzeQueryComplexity(query: string): {
  complexity: 'simple' | 'moderate' | 'complex';
  hints: string[];
} {
  const hints: string[] = [];
  let complexity: 'simple' | 'moderate' | 'complex' = 'simple';

  // Count complexity indicators
  const orCount = (query.match(/\|/g) || []).length;
  const wildcardCount = (query.match(/\.\*/g) || []).length;
  const groupCount = (query.match(/[()]/g) || []).length / 2;
  const charClassCount = (query.match(/\[[^\]]+\]/g) || []).length;

  const totalComplexity = orCount + wildcardCount + groupCount + charClassCount;

  if (totalComplexity === 0) {
    complexity = 'simple';
  } else if (totalComplexity <= 3) {
    complexity = 'moderate';
  } else {
    complexity = 'complex';
    hints.push('Complex regex may be slow. Consider breaking into multiple simpler searches.');
  }

  if (orCount > 5) {
    hints.push(`Query has ${orCount} OR alternatives. Consider searching for the most specific term first.`);
  }

  if (wildcardCount > 2) {
    hints.push('Multiple wildcards (.*) can match too broadly. Try more specific patterns.');
  }

  return { complexity, hints };
}

/**
 * Suggest optimal context_lines based on query type
 */
export function suggestContextLines(query: string): number {
  // Function/class definitions need more context
  if (/\b(def|function|class|interface|type|const|let|var)\s+\w+/.test(query)) {
    return 5;
  }

  // Import statements need less context
  if (/\b(import|require|from)\b/.test(query)) {
    return 1;
  }

  // Error messages / logging
  if (/\b(error|exception|throw|catch|log|console)\b/i.test(query)) {
    return 3;
  }

  // Configuration patterns
  if (/\b(config|settings|options|env)\b/i.test(query)) {
    return 4;
  }

  // Default
  return 2;
}
