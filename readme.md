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

TokenShrinker supports multiple AI providers! Create a `.env` file in your project directory:

```bash
# Choose your provider (default: openrouter)
echo "AI_PROVIDER=openrouter" >> .env  # Options: openrouter, openai, anthropic

# Provider-specific API keys (choose one based on your AI_PROVIDER)
echo "OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key-here" >> .env
# OR
echo "OPENAI_API_KEY=sk-your-openai-key-here" >> .env
# OR
echo "ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here" >> .env

# Optional: Set your preferred model for your provider
echo "AI_MODEL=anthropic/claude-3.5-sonnet" >> .env
```

**Environment Variables:**

**Provider Selection:**

- `AI_PROVIDER` - Choose your AI provider (`openrouter`, `openai`, `anthropic`)
  - Default: `openrouter` (free tier model)

**API Keys (choose based on your provider):**

- `OPENROUTER_API_KEY` - Get from [openrouter.ai](https://openrouter.ai)
- `OPENAI_API_KEY` - Get from [platform.openai.com](https://platform.openai.com)
- `ANTHROPIC_API_KEY` - Get from [console.anthropic.com](https://console.anthropic.com)

**Model Selection:**

- `AI_MODEL` - Generic model name that works across providers
- **or** provider-specific: `OPENROUTER_MODEL`, `OPENAI_MODEL`, `ANTHROPIC_MODEL`

**Examples by Provider:**

**OpenRouter (Recommended for Free Tier):**

```
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
AI_MODEL=meta-llama/llama-4-maverick:free
```

**OpenAI:**

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

**Anthropic:**

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-3-haiku-20240307
```

## MCP Client Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

**For OpenRouter (default):**

```json
{
  "mcpServers": {
    "token-shrinker": {
      "command": "npx",
      "args": ["token-shrinker"],
      "env": {
        "AI_PROVIDER": "openrouter",
        "OPENROUTER_API_KEY": "sk-or-v1-your-openrouter-key-here",
        "AI_MODEL": "meta-llama/llama-4-maverick:free"
      }
    }
  }
}
```

**For OpenAI:**

```json
{
  "mcpServers": {
    "token-shrinker": {
      "command": "npx",
      "args": ["token-shrinker"],
      "env": {
        "AI_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-your-openai-key-here",
        "AI_MODEL": "gpt-4o-mini"
      }
    }
  }
}
```

**For Anthropic:**

```json
{
  "mcpServers": {
    "token-shrinker": {
      "command": "npx",
      "args": ["token-shrinker"],
      "env": {
        "AI_PROVIDER": "anthropic",
        "ANTHROPIC_API_KEY": "sk-ant-your-anthropic-key-here",
        "AI_MODEL": "claude-3-haiku-20240307"
      }
    }
  }
}
```

### Cursor/VS Code

Add similar configurations to your MCP settings. You can switch between providers by changing the `AI_PROVIDER` and corresponding API key environment variables.

## Dynamic Provider Switching

Once connected, you can switch providers on-the-fly using MCP tools:

```bash
# Ask Claude/Cursor to switch providers
"I want to use OpenAI instead of OpenRouter for compression"

# Or switch models
"Use Claude 3.5 Sonnet for better compression quality"
```

The `set-provider`, `set-api-key`, and `set-model` tools allow you to configure TokenShrinker dynamically through natural language!

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

**Set your preferred model for the current provider**

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
