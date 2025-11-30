# Contributing to file-search-mcp

Thanks for your interest in contributing! This document outlines how to get started.

## Development Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/elad12390/file-search-mcp.git
   cd file-search-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install ripgrep** (required for content search)
   ```bash
   brew install ripgrep    # macOS
   apt install ripgrep     # Ubuntu
   choco install ripgrep   # Windows
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Making Changes

1. Create a new branch for your feature/fix
2. Make your changes
3. Ensure all tests pass: `npm test`
4. Ensure code builds: `npm run build`
5. Submit a pull request

## Code Style

- TypeScript with strict mode
- Use Zod for schema validation
- Follow existing patterns in the codebase
- Add tests for new functionality

## Testing Philosophy

We follow black-box testing principles:
- Test **behavior**, not implementation
- Use the AAA pattern (Arrange-Act-Assert)
- Test through public interfaces only
- Tests should enable refactoring

## Project Structure

```
src/
├── index.ts          # MCP server entry point
├── types.ts          # Schemas and types
├── tools/            # Tool implementations
│   ├── search-files.ts
│   ├── search-content.ts
│   ├── fuzzy-find.ts
│   └── tree.ts
└── utils/            # Shared utilities
    ├── file-utils.ts
    ├── metrics.ts
    ├── ripgrep.ts
    ├── symlink.ts
    └── truncate.ts
```

## Questions?

Open an issue if you have questions or need help getting started.
