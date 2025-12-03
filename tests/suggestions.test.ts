import { describe, it, expect } from 'vitest';
import {
  generateZeroResultSuggestions,
  formatSuggestions,
  analyzeQueryComplexity,
  suggestContextLines,
} from '../src/utils/suggestions.js';

describe('suggestions', () => {
  describe('generateZeroResultSuggestions', () => {
    describe('search_content', () => {
      it('should suggest simpler query for OR patterns', () => {
        const suggestions = generateZeroResultSuggestions(
          'foo|bar|baz',
          'search_content'
        );
        
        const simplified = suggestions.find(s => s.type === 'simplified');
        expect(simplified).toBeDefined();
        // Should suggest one of the shortest parts
        expect(['foo', 'bar', 'baz']).toContain(simplified?.suggestedQuery);
      });

      it('should suggest removing wildcards', () => {
        const suggestions = generateZeroResultSuggestions(
          'foo.*bar.*baz',
          'search_content'
        );
        
        const simplified = suggestions.find(s => s.type === 'simplified');
        expect(simplified).toBeDefined();
        expect(simplified?.message).toContain('without wildcards');
      });

      it('should suggest lowercase for mixed case queries', () => {
        const suggestions = generateZeroResultSuggestions(
          'UserController',
          'search_content'
        );
        
        const alternative = suggestions.find(s => 
          s.type === 'alternative' && s.message.includes('lowercase')
        );
        expect(alternative).toBeDefined();
        expect(alternative?.suggestedQuery).toBe('usercontroller');
      });

      it('should suggest fuzzy_find for file-like patterns', () => {
        const suggestions = generateZeroResultSuggestions(
          'UserController.ts',
          'search_content'
        );
        
        const hint = suggestions.find(s => 
          s.type === 'hint' && s.message.includes('fuzzy_find')
        );
        expect(hint).toBeDefined();
      });

      it('should suggest unescaping special characters', () => {
        const suggestions = generateZeroResultSuggestions(
          'foo\\.bar',
          'search_content'
        );
        
        const alternative = suggestions.find(s => 
          s.type === 'alternative' && s.suggestedQuery === 'foo.bar'
        );
        expect(alternative).toBeDefined();
      });
    });

    describe('search_files', () => {
      it('should provide hints for no results', () => {
        const suggestions = generateZeroResultSuggestions(
          '*.ts',
          'search_files'
        );
        
        expect(suggestions.length).toBeGreaterThan(0);
      });

      it('should suggest correcting extension typos', () => {
        const suggestions = generateZeroResultSuggestions(
          '*.typescript',
          'search_files'
        );
        
        const alternative = suggestions.find(s => s.type === 'alternative');
        expect(alternative?.suggestedQuery).toContain('.ts');
      });
    });
  });

  describe('formatSuggestions', () => {
    it('should format suggestions with icons', () => {
      const suggestions = [
        { type: 'simplified' as const, message: 'Try simpler query', suggestedQuery: 'foo' },
        { type: 'hint' as const, message: 'Check spelling' },
      ];
      
      const formatted = formatSuggestions(suggestions);
      expect(formatted).toContain('Suggestions');
      expect(formatted).toContain('Try simpler query');
      expect(formatted).toContain('Check spelling');
    });

    it('should return empty string for no suggestions', () => {
      const formatted = formatSuggestions([]);
      expect(formatted).toBe('');
    });
  });

  describe('analyzeQueryComplexity', () => {
    it('should identify simple queries', () => {
      const { complexity } = analyzeQueryComplexity('hello world');
      expect(complexity).toBe('simple');
    });

    it('should identify moderate complexity', () => {
      const { complexity } = analyzeQueryComplexity('foo|bar');
      expect(complexity).toBe('moderate');
    });

    it('should identify complex queries', () => {
      const { complexity, hints } = analyzeQueryComplexity(
        'foo|bar|baz|qux|quux|corge|.*grault'
      );
      expect(complexity).toBe('complex');
      expect(hints.length).toBeGreaterThan(0);
    });

    it('should warn about many OR alternatives', () => {
      const { hints } = analyzeQueryComplexity('a|b|c|d|e|f|g');
      const orHint = hints.find(h => h.includes('OR alternatives'));
      expect(orHint).toBeDefined();
    });
  });

  describe('suggestContextLines', () => {
    it('should suggest more context for function definitions', () => {
      expect(suggestContextLines('function handleClick')).toBe(5);
      expect(suggestContextLines('def process_data')).toBe(5);
      expect(suggestContextLines('class UserService')).toBe(5);
    });

    it('should suggest less context for imports', () => {
      expect(suggestContextLines('import { foo }')).toBe(1);
      expect(suggestContextLines('from typing import')).toBe(1);
      expect(suggestContextLines('require("express")')).toBe(1);
    });

    it('should suggest moderate context for errors', () => {
      expect(suggestContextLines('console.error')).toBe(3);
      expect(suggestContextLines('throw new Error')).toBe(3);
    });

    it('should suggest more context for config', () => {
      expect(suggestContextLines('config.database')).toBe(4);
      expect(suggestContextLines('process.env')).toBe(4);
    });

    it('should default to 2 for unknown patterns', () => {
      expect(suggestContextLines('someRandomThing')).toBe(2);
    });
  });
});
