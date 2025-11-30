# file-search-mcp

A blazingly fast MCP server for searching files in large codebases and monorepos.

## Why This Exists

Standard tools like `grep` and `find` are painfully slow on large codebases. They don't respect `.gitignore`, they follow symlink loops, and they flood your terminal with irrelevant results from `node_modules`.

**file-search-mcp** fixes all that:

| Problem | Solution |
|---------|----------|
| `grep` is slow on big repos | Uses ripgrep (100x faster) |
| `find` follows symlink loops | Built-in loop detection |
| Results flood the terminal | Smart token-based truncation |
| Binary files pollute results | Auto-detected and skipped |
| Need to remember complex flags | Simple, intuitive parameters |
| No context for matches | Configurable context lines |
| Case sensitivity confusion | Smart case by default |

## Installation

### Prerequisites

- Node.js 18+
- ripgrep (for content search)

```bash
# Install ripgrep
brew install ripgrep    # macOS
apt install ripgrep     # Ubuntu
choco install ripgrep   # Windows
```

### Quick Start (npx)

No installation required! Just add to your MCP client config:

```json
{
  "mcpServers": {
    "file-search": {
      "command": "npx",
      "args": ["-y", "file-search-mcp"]
    }
  }
}
```

### Global Install

```bash
npm install -g file-search-mcp
```

Then use in your config:

```json
{
  "mcpServers": {
    "file-search": {
      "command": "file-search-mcp"
    }
  }
}
```

## Usage with Claude Desktop

Add to your Claude Desktop config:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "file-search": {
      "command": "npx",
      "args": ["-y", "file-search-mcp"]
    }
  }
}
```

## Usage with OpenCode

Add to your OpenCode config (`~/.config/opencode/config.json`):

```json
{
  "mcp": {
    "file-search": {
      "type": "local",
      "command": ["npx", "-y", "file-search-mcp"]
    }
  }
}
```

## Tools

### `search_files`

Find files by name or glob pattern.

```
"Find all TypeScript files"
→ search_files(pattern: "*.ts")

"Find config files modified today"
→ search_files(pattern: "*.config.*", modified_within: "24h")

"Find large log files"
→ search_files(pattern: "*.log", min_size: "10MB")
```

**Parameters:**
- `reasoning` (required) - Why you're searching
- `pattern` (required) - Glob pattern like `*.ts`, `src/**/*.js`
- `path` - Directory to search (default: current dir)
- `include_hidden` - Include dotfiles (default: true)
- `ignore_gitignore` - Respect .gitignore (default: true)
- `exclude` - Extra patterns to skip
- `detail_level` - `minimal` | `standard` | `full`
- `modified_within` - Only recent files, e.g., `24h`, `7d`
- `min_size` - Only large files, e.g., `1MB`

### `search_content`

Find text or regex patterns inside files.

```
"Find all TODO comments"
→ search_content(query: "TODO")

"Find API endpoints"
→ search_content(query: "app\.(get|post|put|delete)", file_pattern: "*.ts")

"Find hardcoded secrets"
→ search_content(query: "apiKey|secret|password")
```

**Parameters:**
- `reasoning` (required) - Why you're searching
- `query` (required) - Text or regex to find
- `path` - Directory to search (default: current dir)
- `file_pattern` - Only search matching files
- `include_hidden` - Include dotfiles (default: true)
- `ignore_gitignore` - Respect .gitignore (default: true)
- `exclude` - Extra patterns to skip
- `detail_level` - `minimal` | `standard` | `full`
- `context_lines` - Lines around matches (default: 2)

### `fuzzy_find`

Fuzzy search when you don't remember exact names.

```
"Find the user controller"
→ fuzzy_find(query: "usrctrl")

"Find that API routes file"
→ fuzzy_find(query: "apirts")
```

**Parameters:**
- `reasoning` (required) - Why you're searching
- `query` (required) - Fuzzy search terms
- `path` - Directory to search (default: current dir)
- `include_hidden` - Include dotfiles (default: true)
- `detail_level` - `minimal` | `standard` | `full`

### `tree`

Visualize directory structure.

```
"Show me the project structure"
→ tree(depth: 3)

"What's in the src folder?"
→ tree(path: "src", depth: 2)
```

**Parameters:**
- `reasoning` (required) - Why you need this view
- `path` - Directory to show (default: current dir)
- `depth` - How deep to traverse (default: 3)
- `include_hidden` - Show dotfiles (default: false)
- `dirs_only` - Only show directories (default: false)

## Detail Levels

| Level | What You Get |
|-------|--------------|
| `minimal` | Just paths - fast, low tokens |
| `standard` | Paths + size + modified date |
| `full` | Everything + content preview/matches |

## Smart Features

### Smart Case

Searches are case-insensitive by default, but become case-sensitive if your query contains uppercase letters. This matches how VS Code, ripgrep, and most modern tools work.

### Token Limiting

Results are automatically truncated to ~100k tokens to prevent overwhelming responses. You'll see a warning if truncation occurred.

### Binary Detection

Binary files (images, executables, archives, etc.) are automatically skipped to keep results clean and relevant.

### Symlink Safety

Symlinks are followed, but loops are detected and prevented. No more infinite traversal!

### Default Excludes

These directories are always skipped unless you override:
- `node_modules`
- `.git`
- `dist`, `build`
- `coverage`
- `.next`, `.nuxt`
- `__pycache__`, `.pytest_cache`
- `venv`, `.venv`
- `target` (Rust)
- `vendor` (Go)

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
npm run test:watch    # Watch mode
```

### Metrics

All tool calls are tracked locally for development analysis. Metrics include:
- Tool usage counts
- Search patterns and queries
- Response times
- Error and truncation rates
- Reasoning text for understanding use cases

```bash
# View metrics summary
npm run metrics

# View last 50 raw calls
npm run metrics:raw

# Clear all metrics
npm run metrics:clear
```

Metrics are stored at `~/.file-search-mcp/metrics.json`

## License

MIT
