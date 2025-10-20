# ai-token-optimizer

A local server that watches your code repository, generates AI-powered summaries of large files, and exposes HTTP endpoints to return token-optimized context for LLMs. This dramatically reduces token usage when working with AI coding assistants while maintaining code context.

**NEW: Transparent Proxy Mode** - Use this as a drop-in replacement for OpenRouter in ANY AI tool (VS Code extensions, CLI tools, etc.) to automatically compress prompts and save tokens! See [PROXY_SETUP.md](PROXY_SETUP.md) for details.

## How It Works

1. **File Watching**: Monitors your repository for changes to JavaScript, TypeScript, HTML, CSS, and EJS files
2. **Smart Summarization**: Only summarizes files larger than 2000 tokens (~500 words)
3. **AI-Powered Compression**: Uses OpenRouter API to create concise, context-aware summaries
4. **Incremental Updates**: Only re-summarizes files when they change (uses SHA-1 hashing for change detection)
5. **HTTP API**: Provides endpoints to retrieve optimized text and file summaries
6. **Transparent Proxy**: Acts as OpenRouter-compatible proxy for automatic optimization in any tool

## Installation

### Global Installation (Recommended)

```bash
npm install -g ai-token-optimizer
```

### Local Development

```bash
git clone https://github.com/corbybender/ai-token-optimizer.git
cd ai-token-optimizer
npm install
```

## Configuration

**IMPORTANT**: Create a `.env` file in the root directory of **your project** where you run the command (NOT in the ai-token-optimizer package directory):

```bash
# Example: If you're in /home/user/my-project/, create:
# /home/user/my-project/.env

cd your-project-directory
touch .env
```

**Windows Users:** Use a text editor like VS Code or Notepad++ to create the `.env` file. Do NOT use Windows Notepad as it creates UTF-16 encoded files which won't work. If you must use the command line, use:

```bash
echo OPENROUTER_API_KEY=your-key-here > .env
```

Add the following to your `.env` file:

```env
OPENROUTER_API_KEY=sk-or-v1-yourkeyhere
OPENROUTER_MODEL=meta-llama/llama-4-maverick:free
PORT=4343
WATCH_PATTERNS=**/*.js,**/*.ts,**/*.py,**/*.go
WATCH_IGNORE=node_modules/**,dist/**,build/**,summaries/**
```

**Configuration Options:**

- `OPENROUTER_API_KEY` - **Required for AI features**. Your OpenRouter API key. Get one free at [openrouter.ai](https://openrouter.ai). Without this, you'll see "401 No auth credentials found" errors.
- `OPENROUTER_MODEL` - **Optional**. Defaults to `meta-llama/llama-4-maverick:free`
- `PORT` - **Optional**. Server port. Defaults to `4343`
- `WATCH_PATTERNS` - **Optional**. Comma-separated glob patterns for files to watch. Defaults to `**/*.js,**/*.ts,**/*.mjs,**/*.ejs,**/*.html,**/*.css`
- `WATCH_IGNORE` - **Optional**. Comma-separated glob patterns for files/directories to ignore. Defaults to `node_modules/**,dist/**,build/**,summaries/**`

## Usage

**ai-token-optimizer v0.3.0** now supports **two flexible modes** for using the optimization proxy:

### Mode 1: Manual Configuration (Permanent Setup)

Quickly configure popular AI tools to automatically use the optimizer:

```bash
# One-time setup for tools you use daily
ai-token-optimizer setup continue     # Configure Continue.dev
ai-token-optimizer setup cline        # Configure Cline
ai-token-optimizer setup aider        # Configure Aider

# Then use the tools normally - they'll automatically use the proxy
code .  # Continue.dev works automatically
cline   # Cline works automatically
```

**When to use:** Permanent setup for tools you use daily.

### Mode 2: CLI Wrapper (Quick/Temporary)

Run any command with the proxy temporarily enabled:

```bash
# Run tools on-demand without configuration
ai-token-optimizer run aider
ai-token-optimizer run "npm start"
ai-token-optimizer run "npx some-ai-cli"
```

**When to use:** Testing, one-off tasks, tools you rarely use.

### Combined Approach Benefits

- **Flexibility**: Choose permanent or temporary setup
- **Safety**: Easy to undo with `ai-token-optimizer cleanup`
- **Convenience**: Auto-setup for popular tools
- **Power**: Wrapper works with anything else

### Management Commands

```bash
ai-token-optimizer status             # Show current configuration
ai-token-optimizer cleanup            # Remove all configurations
ai-token-optimizer --version          # Show version
ai-token-optimizer --help             # Show help
```

### Starting the Server (Required for Both Modes)

Before using either mode, start the proxy server:

```bash
ai-token-optimizer  # Starts on http://localhost:4343
```

This will:

- Start the HTTP proxy server with compression
- Automatically watch your repository for file changes
- Generate summaries for files > 2000 tokens
- Store summaries in `./summaries/` directory

**Legacy Command**: You can also use `ai-token-optimizer start` - both work the same way.

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

## Watched File Types

By default, the following file types are monitored:

- `**/*.js` - JavaScript
- `**/*.ts` - TypeScript
- `**/*.mjs` - ES Modules
- `**/*.ejs` - Embedded JavaScript templates
- `**/*.html` - HTML
- `**/*.css` - CSS

**Default ignored directories:**

- `node_modules/`
- `dist/`
- `build/`
- `summaries/`

### Customizing File Types

You can customize which files are watched by setting environment variables in your `.env` file:

**Watch additional file types:**

```env
WATCH_PATTERNS=**/*.js,**/*.ts,**/*.py,**/*.go,**/*.rb,**/*.java
```

**Watch only specific types:**

```env
WATCH_PATTERNS=**/*.py,**/*.md
```

**Add more ignored directories:**

```env
WATCH_IGNORE=node_modules/**,dist/**,build/**,summaries/**,vendor/**,.git/**
```

**Common file type examples:**

- Python: `**/*.py`
- Go: `**/*.go`
- Ruby: `**/*.rb`
- Java: `**/*.java`
- C/C++: `**/*.c,**/*.cpp,**/*.h`
- Rust: `**/*.rs`
- PHP: `**/*.php`
- Markdown: `**/*.md`
- JSON: `**/*.json`
- YAML: `**/*.yml,**/*.yaml`

## API Endpoints

### `POST /summarize-text`

Compress arbitrary text using AI.

**Request:**

```json
{
  "text": "Your long text here..."
}
```

**Response:**

```json
{
  "summary": "Compressed version...",
  "original_length": 5000,
  "compressed_length": 1200,
  "compression_ratio": "76%"
}
```

### `POST /summarize-file`

Get the summary for a specific file.

**Request:**

```json
{
  "file": "src/app.js"
}
```

**Response:**

```json
{
  "changed": true,
  "file": "src/app.js",
  "size_tokens": 3500,
  "summary": "...",
  "timestamp": 1234567890
}
```

### `GET /test`

Browser-based test interface for trying out text compression.

### `GET /summaries/{filepath}`

Retrieve a saved summary file directly.

Example: `GET /summaries/src/app.js`

## Integration with AI Coding Assistants

This tool acts as a **middleware layer** between your AI coding assistant and the actual AI model. Instead of sending entire large files, you first compress them through this service.

### Integration Methods

#### Option 1: Manual API Calls

Use the optimization endpoints before sending context to your AI:

```bash
# Compress text before sending to your AI
curl -X POST http://localhost:4343/summarize-text \
  -H "Content-Type: application/json" \
  -d '{"text": "your large code file contents..."}'

# Get a pre-generated summary for a file
curl -X POST http://localhost:4343/summarize-file \
  -H "Content-Type: application/json" \
  -d '{"file": "src/large-component.js"}'
```

Then use the compressed response in your AI prompt instead of the original file.

#### Option 2: VS Code Extensions (Custom Configuration)

Some VS Code AI extensions allow custom preprocessing or API middleware:

**For Continue.dev:**
Add a custom context provider or modify requests to route through the optimizer first.

**For Cline/Claude Dev:**
Currently requires manual copy-paste of optimized summaries.

**For Copilot Chat:**
Use the `/test` endpoint to compress context, then paste into your chat.

#### Option 3: CLI Wrapper Script

Create a wrapper script that optimizes context before calling AI APIs:

```bash
#!/bin/bash
# optimize-and-ask.sh

# Get file content
CONTENT=$(cat $1)

# Optimize through local server
OPTIMIZED=$(curl -s -X POST http://localhost:4343/summarize-text \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$CONTENT\"}" | jq -r '.summary')

# Send optimized content to OpenRouter/OpenAI
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"anthropic/claude-3.5-sonnet\",
    \"messages\": [{\"role\": \"user\", \"content\": \"$OPTIMIZED\n\nQuestion: $2\"}]
  }"
```

Usage:

```bash
./optimize-and-ask.sh src/app.js "Explain this code"
```

#### Option 4: Browser Test Interface

Visit `http://localhost:4343/test` to manually compress text through a web UI, then copy the result into your AI tool.

### Workflow Example

**Without ai-token-optimizer:**

```
You → [5000 token file] → AI Extension → OpenAI API
Cost: ~$0.005 per request
```

**With ai-token-optimizer:**

```
You → [5000 token file] → ai-token-optimizer → [1200 token summary] → AI Extension → OpenAI API
Cost: ~$0.001 per request (76% savings)
```

### **NEW: Transparent Proxy Mode (Recommended)**

**This tool now works as a transparent proxy for ANY AI tool!**

Simply point your AI tool's API endpoint to `http://localhost:4343/v1` instead of `https://openrouter.ai/api/v1`, and ALL your prompts will be automatically optimized before being sent to OpenRouter.

**See [PROXY_SETUP.md](PROXY_SETUP.md) for complete setup instructions for:**

- Continue.dev
- Cline (Claude Dev)
- Cody
- Aider
- Custom scripts
- Any OpenRouter-compatible tool

**Benefits:**

- ✅ Works with ANY tool that supports custom API endpoints
- ✅ Zero code changes needed
- ✅ Automatic compression of all prompts >500 chars
- ✅ Real-time monitoring and compression stats
- ✅ Transparent operation - your tools work exactly as before

For now, this tool is best suited for:

- **Any AI tool with custom endpoint support** (Continue, Cline, Aider, etc.)
- CLI-based AI workflows where you control the prompts
- Custom scripts that programmatically interact with AI APIs
- Reducing costs when preparing context for AI manually

## Token Limit Threshold

Files under **2000 tokens** (~500 words, ~8KB) are not summarized. The original file content is used instead, and any existing summaries are cleaned up automatically.

## Cache Management

The tool maintains a `.cache.json` file in the `summaries/` directory to track:

- File content hashes (SHA-1)
- Last update timestamps
- Summary metadata

This ensures files are only re-summarized when their content actually changes.

--- FILE: LICENSE ---
MIT License

Check out my other awesome project at https://www.orbitalmcp.com
