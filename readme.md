# TokenShrinker - MCP Server

[![npm version](https://badge.fury.io/js/token-shrinker.svg)](https://badge.fury.io/js/token-shrinker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Model Context Protocol (MCP) Server** - Comresses AI context to reduce token usage.

TokenShrinker provides AI context compression tools via the Model Context Protocol (MCP). It reduces token usage by intelligently summarizing text, files, and repositories for MCP-compatible AI assistants.

## Architecture Overview

```
AI Agent (MCP host)  -->  MCP request  -->  TokenShrinker (MCP server)
       (chat text)                   (shrink / summarize / select)
                                          |
                                          V
                             compressed/context (returned)
                                          |
                                          V
                       Agent forwards compressed payload to model backend
```

## Installation

```bash
npm install -g token-shrinker
```

## Environment Variables

Create a `.env` file with your OpenRouter API key:

```bash
echo "OPENROUTER_API_KEY=your-openrouter-key-here" > .env
```

**Optional Configuration:**

- `OPENROUTER_MODEL` - Set your preferred OpenRouter model (e.g., `anthropic/claude-3.5-sonnet`)
- Default model when not specified: `meta-llama/llama-4-maverick:free` (free tier)

## MCP Client Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "token-shrinker": {
      "command": "npx",
      "args": ["token-shrinker"],
      "env": {
        "OPENROUTER_API_KEY": "your-key-here"
      }
    }
  }
}
```

### Cursor/VS Code

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "token-shrinker": {
      "command": "npx",
      "args": ["token-shrinker"],
      "env": {
        "OPENROUTER_API_KEY": "your-key-here"
      }
    }
  }
}
```

## Where Files Are Stored

All summaries are saved in a `summaries/` directory in your project root:

```
your-project/
├── src/
│   ├── app.js
│   └── utils.js
├── summaries/
│   ├── src/
│   │   ├── app.js.summary.json
│   │   └── utils.js.summary.json
│   └── .cache.json
├── .env
└── package.json
```

**File Structure:**

- `summaries/` - Mirror of your source tree with `.summary.json` files
- `summaries/.cache.json` - Cache metadata (file hashes and timestamps)
- Summary files contain: compressed text, token counts, compression ratios, and timestamps

## Available Tools

TokenShrinker provides 5 MCP tools for AI assistants:

### `shrink`

**Compress text content to reduce token usage**

```javascript
// Input
{
  "text": "Your large text content here..."
}

// Output
{
  "compressedText": "Shortened version...",
  "compressionRatio": "75%",
  "success": true
}
```

### `summarize`

**Generate summaries for text, files, or entire repositories**

```javascript
// Input
{
  "content": "your content or file path",
  "type": "text" // or "file" or "repo"
}
```

### `fetch-summary`

**Retrieve cached repository summaries**

```javascript
// Input
{
  "repoPath": "/path/to/repo" // optional, uses current dir
}
```

### `set-model`

**Set your preferred OpenRouter model for compression**

```javascript
// Input
{
  "model": "anthropic/claude-3.5-sonnet"
}

// Output
{
  "message": "Model set to: anthropic/claude-3.5-sonnet",
  "model": "anthropic/claude-3.5-sonnet",
  "note": "This setting persists for the current session..."
}
```

### `get-config`

**View current configuration and available models**

```javascript
// Input
{}

// Output
{
  "openRouterApiKey": "configured",
  "currentModel": "meta-llama/llama-4-maverick:free",
  "availableModels": ["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "..."]
}
```

## Usage Examples

When connected to Claude Desktop or Cursor, you can use natural language:

```
"Can you compress this long code snippet for me?"
"Show me a summary of this entire codebase"
"What's the cached summary of our current repository?"
```

The MCP server handles everything automatically!

## Repository

https://github.com/corbybender/token-shrinker
