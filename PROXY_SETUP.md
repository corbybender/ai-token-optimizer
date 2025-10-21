# Using TokenShrinker as a Transparent Proxy

TokenShrinker can act as a **transparent middleware proxy** that sits between your AI tools and OpenRouter. It automatically optimizes (compresses) large prompts before sending them to OpenRouter, saving you tokens and money.

## How It Works

### For OpenRouter-based tools:

```
Your AI Tool → http://localhost:4343/v1/chat/completions → [Optimize] → OpenRouter → Response
```

### For Anthropic API-based tools (Claude Code, etc.):

```
Your AI Tool → http://localhost:4343/v1/messages → [Optimize] → Anthropic API → Response
```

Instead of pointing your AI tool directly at the API provider, you point it at your local optimizer. The optimizer:

1. Receives the request
2. Compresses prompts >500 characters
3. Forwards the optimized request to the real API
4. Returns the response to your tool

**Result**: Transparent token savings with zero code changes!

---

## Setup

### 1. Start the Optimizer

```bash
cd your-project-directory
npx token-shrinker
```

The server will run at `http://localhost:4343`

### 2. Configure Your AI Tool

Change the API endpoint from `https://openrouter.ai/api` to `http://localhost:4343`

---

## VS Code Extension Configuration

### **Continue.dev**

Edit your `~/.continue/config.json`:

```json
{
  "models": [
    {
      "title": "Claude via Optimizer",
      "provider": "openai",
      "model": "anthropic/claude-3.5-sonnet",
      "apiKey": "sk-or-v1-YOUR-KEY-HERE",
      "apiBase": "http://localhost:4343/v1"
    }
  ]
}
```

### **Cline (formerly Claude Dev)**

1. Open Cline settings in VS Code
2. Set **API Provider**: OpenRouter
3. Set **Base URL**: `http://localhost:4343/v1`
4. Set **API Key**: Your OpenRouter key
5. Set **Model**: `anthropic/claude-3.5-sonnet`

### **Cody by Sourcegraph**

Edit VS Code settings (`Ctrl+,`):

```json
{
  "cody.serverEndpoint": "http://localhost:4343",
  "cody.customHeaders": {
    "Authorization": "Bearer sk-or-v1-YOUR-KEY-HERE"
  }
}
```

### **Claude Code** (Anthropic API)

Currently, Claude Code doesn't support custom API endpoints in its configuration. However, you can use environment variables or modify your system's proxy settings if supported.

**Alternative**: Use Continue.dev or Cline which support custom endpoints and work great with Claude!

### **GitHub Copilot Chat** (if using OpenRouter)

Copilot doesn't support custom endpoints, but if you use a wrapper that connects to OpenRouter, configure that wrapper to use `http://localhost:4343/v1`

---

## CLI Tool Configuration

### **Aider**

```bash
export OPENAI_API_BASE=http://localhost:4343/v1
export OPENAI_API_KEY=sk-or-v1-YOUR-KEY-HERE
aider
```

### **OpenAI CLI**

```bash
openai api chat.completions.create \
  --api-base http://localhost:4343/v1 \
  --api-key sk-or-v1-YOUR-KEY-HERE \
  --model anthropic/claude-3.5-sonnet \
  --message "Hello"
```

### **Custom Scripts**

Any script using the OpenAI SDK:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4343/v1",
    api_key="sk-or-v1-YOUR-KEY-HERE"
)

response = client.chat.completions.create(
    model="anthropic/claude-3.5-sonnet",
    messages=[{"role": "user", "content": "Your prompt here"}]
)
```

---

## Monitoring Compression

Watch the optimizer's terminal output to see compression stats in real-time:

```
🔄 Proxy request received
📝 Model: anthropic/claude-3.5-sonnet
💬 Messages: 1
📊 Original content length: 2500 chars
🔧 Optimizing content...
✅ Compressed: 68.4% reduction
🌐 Forwarding to OpenRouter...
✅ Response received from OpenRouter
```

You can also check HTTP response headers:

- `X-Token-Optimizer-Original-Length`: Original prompt size
- `X-Token-Optimizer-Optimized-Length`: Compressed size
- `X-Token-Optimizer-Compression`: Compression ratio

---

## Configuration

The optimizer only compresses prompts **larger than 500 characters** by default. Smaller prompts are passed through unchanged.

To change this threshold, edit `src/server.js` line 151:

```javascript
if (originalLength > 500) {  // Change this number
```

---

## Testing

Test the proxy with curl:

```bash
curl -X POST http://localhost:4343/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/llama-4-maverick:free",
    "messages": [
      {"role": "user", "content": "Write a long essay about artificial intelligence and its impact on society, covering historical development, current applications, ethical considerations, and future predictions. Include specific examples and detailed analysis."}
    ]
  }'
```

---

## Troubleshooting

### Port already in use

Change the port in your `.env` file:

```
PORT=4444
```

Then update your tools to use `http://localhost:4444/v1`

### API key not found

Make sure your `.env` file contains the appropriate API key:

For OpenRouter proxy:

```
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

For Anthropic proxy (Claude):

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### No compression happening

- Check that your prompts are >500 characters
- Watch the terminal output for "⏭️ Content too small, skipping optimization"
- Increase verbosity by checking the console logs

---

## Benefits

✅ **Transparent** - Works with any OpenRouter-compatible tool
✅ **Automatic** - No manual optimization needed
✅ **Real-time** - Compression happens on every request
✅ **Observable** - See compression stats in real-time
✅ **Universal** - One configuration works for all tools

---

## Limitations

- Only works when running locally
- Adds small latency for compression (~1-2 seconds for large prompts)
- Only optimizes the user message content (not system prompts)
- Requires tools to support custom API endpoints

---

## Need Help?

Create an issue at: https://github.com/corbybender/token-shrinker/issues
