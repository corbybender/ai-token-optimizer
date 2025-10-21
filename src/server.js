#!/usr/bin/env node
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import { summarizeFile } from "./summarizer.js";
import "./watcher.js"; // start watcher in the same process
import { optimizeText } from "./optimizeText.js";
import { getRepoSummary } from "./getRepoSummary.js";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Explicitly load .env from the user's current working directory
const envPath = path.join(process.cwd(), ".env");
console.log("🔍 Looking for .env at:", envPath);
console.log("🔍 File exists:", fs.existsSync(envPath));

const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.warn("\n⚠️  Warning: No .env file found in", process.cwd());
  console.warn(
    "⚠️  Create a .env file with your OPENROUTER_API_KEY to use AI features"
  );
  console.warn("⚠️  See .env.example for template\n");
} else {
  console.log("✅ Loaded .env from", envPath);
  console.log(
    "🔍 OPENROUTER_API_KEY found:",
    process.env.OPENROUTER_API_KEY
      ? "YES (length: " + process.env.OPENROUTER_API_KEY.length + ")"
      : "NO"
  );
  console.log(
    "🔍 All env vars loaded:",
    Object.keys(envResult.parsed || {}).join(", ")
  );
}

const execAsync = promisify(exec);
const PORT = process.env.PORT ? Number(process.env.PORT) : 4343;
const app = express();

// Kill any process using the port before starting
async function killPortProcess(port) {
  try {
    // On Windows, use netstat to find the PID and taskkill
    if (process.platform === "win32") {
      const { stdout } = await execAsync(
        `netstat -ano | findstr :${port} | findstr LISTENING`
      );
      const lines = stdout.trim().split("\n");
      const pids = new Set();

      for (const line of lines) {
        const match = line.trim().match(/\s+(\d+)\s*$/);
        if (match) pids.add(match[1]);
      }

      for (const pid of pids) {
        console.log(`Killing process ${pid} on port ${port}...`);
        await execAsync(`taskkill /PID ${pid} /F`).catch(() => {});
      }
    } else {
      // On Unix-like systems, use lsof
      const { stdout } = await execAsync(`lsof -ti:${port}`).catch(() => ({
        stdout: "",
      }));
      const pids = stdout.trim().split("\n").filter(Boolean);

      for (const pid of pids) {
        console.log(`Killing process ${pid} on port ${port}...`);
        await execAsync(`kill -9 ${pid}`).catch(() => {});
      }
    }
  } catch (err) {
    // No process using the port, which is fine
  }
}

await killPortProcess(PORT);

// Middleware for MCP authentication and security
const ALLOWED_CLIENTS = process.env.MCP_ALLOWED_CLIENTS
  ? process.env.MCP_ALLOWED_CLIENTS.split(",")
  : [];

const mcpAuthMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-mcp-api-key"];
  const clientIp = req.ip || req.connection.remoteAddress;

  console.log(
    `🔐 MCP Auth - IP: ${clientIp}, Key: ${apiKey ? "present" : "missing"}`
  );

  // If ALLOWED_CLIENTS is configured, validate client
  if (ALLOWED_CLIENTS.length > 0) {
    if (
      !ALLOWED_CLIENTS.includes(clientIp) &&
      !ALLOWED_CLIENTS.includes("all")
    ) {
      console.log(`❌ MCP Auth - Rejected client IP: ${clientIp}`);
      return res.status(403).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Access denied for this client",
        },
        id: req.body?.id || null,
      });
    }
  }

  // Validate API key if provided
  if (apiKey && ALLOWED_CLIENTS.length > 0) {
    const validKey = crypto
      .createHash("sha256")
      .update(apiKey + process.env.MCP_API_KEY_SALT || "")
      .digest("hex");
    // Basic validation - in production, use proper key storage/validation
    if (
      !ALLOWED_CLIENTS.includes(clientIp) &&
      !ALLOWED_CLIENTS.includes("all")
    ) {
      if (validKey !== process.env.MCP_VALID_API_KEY_HASH) {
        console.log(`❌ MCP Auth - Invalid API key`);
        return res.status(401).json({
          jsonrpc: "2.0",
          error: {
            code: -32001,
            message: "Invalid API key",
          },
          id: req.body?.id || null,
        });
      }
    }
  }

  next();
};

app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// MCP Tool Manifest endpoint
app.get("/.well-known/mcp-tool", (req, res) => {
  res.json({
    name: "TokenShrinker",
    description: "Token reduction and summarization service for AI context",
    version: "1.0.0",
    capabilities: {
      tools: {
        shrink: {
          description: "Compress text content to reduce token usage",
          parameters: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "Text content to compress",
              },
              maxLength: {
                type: "number",
                description: "Maximum length of compressed output (optional)",
              },
            },
            required: ["text"],
          },
        },
        summarize: {
          description: "Generate a summary of provided content",
          parameters: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "Content to summarize",
              },
              type: {
                type: "string",
                enum: ["text", "file", "repo"],
                description: "Type of content being summarized",
              },
            },
            required: ["content", "type"],
          },
        },
        "fetch-summary": {
          description: "Retrieve repository summaries from cache",
          parameters: {
            type: "object",
            properties: {
              repoPath: {
                type: "string",
                description:
                  "Path to repository (optional, uses current working directory)",
              },
            },
          },
        },
      },
    },
    auth: {
      type: "header",
      header: "x-mcp-api-key",
      description: "API key for authentication",
    },
    contact: {
      name: "TokenShrinker MCP Server",
      url: "http://localhost:" + PORT + "/test",
    },
  });
});

// MCP Tool Invocation endpoint
app.post("/mcp/invoke", mcpAuthMiddleware, async (req, res) => {
  try {
    const { jsonrpc, method, params, id } = req.body;

    // Validate JSON-RPC 2.0 format
    if (jsonrpc !== "2.0" || !method) {
      return res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32600,
          message: "Invalid Request - must be JSON-RPC 2.0 format",
        },
        id: id || null,
      });
    }

    console.log(`🔧 MCP Invoke - Method: ${method}, ID: ${id}`);

    let result;

    switch (method) {
      case "shrink":
        if (!params?.text) {
          return res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32602,
              message: "Invalid params - 'text' parameter required",
            },
            id,
          });
        }

        const shrinkResult = await optimizeText(params.text);
        result = {
          compressed: shrinkResult.summary || shrinkResult.error,
          originalLength: shrinkResult.original_length,
          compressedLength: shrinkResult.compressed_length,
          compressionRatio: shrinkResult.compression_ratio,
          success: !shrinkResult.error,
        };
        break;

      case "summarize":
        if (!params?.content || !params?.type) {
          return res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32602,
              message:
                "Invalid params - 'content' and 'type' parameters required",
            },
            id,
          });
        }

        if (params.type === "repo") {
          const repoSummary = await getRepoSummary();
          result = {
            summary: repoSummary,
            type: "repository",
            timestamp: new Date().toISOString(),
            cached: true,
          };
        } else if (params.type === "file") {
          const fileSummary = await summarizeFile(params.content);
          result = {
            summary: fileSummary.summary || fileSummary.error,
            filePath: params.content,
            method: fileSummary.method,
            timestamp: fileSummary.timestamp,
            success: !fileSummary.error,
          };
        } else {
          // Text summary
          const textSummary = await optimizeText(params.content);
          result = {
            summary: textSummary.summary || textSummary.error,
            originalLength: textSummary.original_length,
            compressedLength: textSummary.compressed_length,
            compressionRatio: textSummary.compression_ratio,
            success: !textSummary.error,
          };
        }
        break;

      case "fetch-summary":
        const repoPath = params?.repoPath || process.cwd();
        const summaryResult = await getRepoSummary();
        result = {
          summaries: summaryResult,
          repoPath: repoPath,
          timestamp: new Date().toISOString(),
          cacheStatus:
            summaryResult === "No repository summaries available yet."
              ? "empty"
              : "available",
        };
        break;

      default:
        return res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
          id,
        });
    }

    console.log(`✅ MCP Invoke - Method ${method} completed`);
    res.json({
      jsonrpc: "2.0",
      result: result,
      id,
    });
  } catch (error) {
    console.error(`❌ MCP Invoke error:`, error.message);
    res.status(500).json({
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: "Internal error",
        data: error.message,
      },
      id: req.body?.id || null,
    });
  }
});

// Browser test page
app.get("/test", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>TokenShrinker Test</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h2 { color: #333; }
        textarea { width: 100%; padding: 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin-top: 10px; }
        button:hover { background: #0056b3; }
        .result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <h2>🧠 TokenShrinker Test</h2>
      <p>Enter text below to compress it using AI:</p>

      <form method="POST" action="/summarize-text">
        <textarea name="text" rows="8" placeholder="Enter text to compress..."></textarea><br/>
        <button type="submit">Compress Text</button>
      </form>

      <p style="margin-top: 30px;"><strong>API Endpoints:</strong></p>
      <ul>
        <li>POST /summarize-text - { "text": "your text here" }</li>
        <li>POST /summarize-file - { "file": "path/to/file.js" }</li>
      </ul>
    </body>
    </html>
  `);
});

// Test endpoint: summarize a single file
app.post("/summarize-file", async (req, res) => {
  const { file } = req.body;
  if (!file) return res.status(400).json({ error: "Missing file parameter" });

  try {
    const result = await summarizeFile(file);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OpenRouter-compatible proxy endpoint
// This allows ANY tool to use this as a drop-in OpenRouter replacement
import OpenAI from "openai";
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const { messages, model, max_tokens, temperature, ...otherParams } =
      req.body;

    if (!messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ error: "Missing or invalid 'messages' parameter" });
    }

    console.log(
      "\n🚀 ─────────────────────────────────────────────────────────────────"
    );
    console.log("🔄 OpenAI-Compatible Request Received");
    console.log(`📝 Model: ${model || "default"}`);
    console.log(`💬 Messages: ${messages.length}`);

    // Extract the user's content from messages
    const userMessage = messages.find((m) => m.role === "user");
    if (!userMessage) {
      return res.status(400).json({ error: "No user message found" });
    }

    const originalContent = userMessage.content;
    const originalLength = originalContent.length;

    console.log("📊 Original content length:", originalLength, "chars");

    // Optimize the content if it's large enough (>500 chars)
    let optimizedContent = originalContent;
    let compressionRatio = "0%";

    if (originalLength > 500) {
      console.log("🔧 Optimizing content...");
      const optimizeText = (await import("./optimizeText.js")).optimizeText;
      const result = await optimizeText(originalContent);

      if (!result.error && result.summary) {
        optimizedContent = result.summary;
        compressionRatio = result.compression_ratio;
        console.log("✅ Compressed:", result.compression_ratio, "reduction");
      } else {
        console.log("⚠️  Optimization failed, using original");
      }
    } else {
      console.log("⏭️  Content too small, skipping optimization");
    }

    // Create new messages array with optimized content
    const optimizedMessages = messages.map((msg) =>
      msg.role === "user" ? { ...msg, content: optimizedContent } : msg
    );

    // Forward to real OpenRouter
    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    console.log("🌐 Forwarding to OpenRouter...");
    const completion = await openai.chat.completions.create({
      model:
        model ||
        process.env.OPENROUTER_MODEL ||
        "meta-llama/llama-4-maverick:free",
      messages: optimizedMessages,
      max_tokens,
      temperature,
      ...otherParams,
    });

    console.log("✅ Response received from OpenRouter\n");

    // Add custom header to show compression stats
    res.setHeader("X-Token-Optimizer-Original-Length", originalLength);
    res.setHeader(
      "X-Token-Optimizer-Optimized-Length",
      optimizedContent.length
    );
    res.setHeader("X-Token-Optimizer-Compression", compressionRatio);

    res.json(completion);
  } catch (err) {
    console.error("❌ Proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Anthropic API-compatible proxy endpoint
// This allows tools using Anthropic's API (like Claude Code) to use the optimizer
import Anthropic from "@anthropic-ai/sdk";
app.post("/v1/messages", async (req, res) => {
  try {
    const { messages, model, max_tokens, temperature, system, ...otherParams } =
      req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        type: "error",
        error: {
          type: "invalid_request_error",
          message: "Missing or invalid 'messages' parameter",
        },
      });
    }

    console.log(
      "\n🚀 ─────────────────────────────────────────────────────────────────"
    );
    console.log("🔄 Anthropic-Compatible Request Received");
    console.log(`📝 Model: ${model || "claude-3-5-sonnet-20241022"}`);
    console.log(`💬 Messages: ${messages.length}`);

    // Find user message with text content to optimize
    let totalOriginalLength = 0;
    let totalOptimizedLength = 0;

    // Optimize each message's content if it's large enough
    const optimizedMessages = await Promise.all(
      messages.map(async (msg) => {
        if (msg.role !== "user" || !msg.content) return msg;

        // Handle both string content and array content
        if (typeof msg.content === "string") {
          const originalLength = msg.content.length;
          totalOriginalLength += originalLength;

          if (originalLength > 500) {
            console.log("🔧 Optimizing user message...");
            const { optimizeText } = await import("./optimizeText.js");
            const result = await optimizeText(msg.content);

            if (!result.error && result.summary) {
              totalOptimizedLength += result.summary.length;
              console.log(
                "✅ Compressed:",
                result.compression_ratio,
                "reduction"
              );
              return { ...msg, content: result.summary };
            }
          }

          totalOptimizedLength += originalLength;
          return msg;
        }

        // Handle array content (text blocks, images, etc.)
        if (Array.isArray(msg.content)) {
          const optimizedContent = await Promise.all(
            msg.content.map(async (block) => {
              if (
                block.type === "text" &&
                block.text &&
                block.text.length > 500
              ) {
                const originalLength = block.text.length;
                totalOriginalLength += originalLength;

                console.log("🔧 Optimizing text block...");
                const { optimizeText } = await import("./optimizeText.js");
                const result = await optimizeText(block.text);

                if (!result.error && result.summary) {
                  totalOptimizedLength += result.summary.length;
                  console.log(
                    "✅ Compressed:",
                    result.compression_ratio,
                    "reduction"
                  );
                  return { ...block, text: result.summary };
                }

                totalOptimizedLength += originalLength;
              } else if (block.type === "text") {
                totalOriginalLength += (block.text || "").length;
                totalOptimizedLength += (block.text || "").length;
              }
              return block;
            })
          );

          return { ...msg, content: optimizedContent };
        }

        return msg;
      })
    );

    const compressionRatio =
      totalOriginalLength > 0
        ? ((1 - totalOptimizedLength / totalOriginalLength) * 100).toFixed(1) +
          "%"
        : "0%";

    console.log("📊 Total original:", totalOriginalLength, "chars");
    console.log("📊 Total optimized:", totalOptimizedLength, "chars");

    // Check for Anthropic API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(401).json({
        type: "error",
        error: {
          type: "authentication_error",
          message:
            "ANTHROPIC_API_KEY not found in .env file. Add it to use Anthropic proxy mode.",
        },
      });
    }

    // Forward to real Anthropic API
    const anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    console.log("🌐 Forwarding to Anthropic API...");
    const response = await anthropic.messages.create({
      model: model || "claude-3-5-sonnet-20241022",
      messages: optimizedMessages,
      max_tokens: max_tokens || 4096,
      temperature,
      system,
      ...otherParams,
    });

    console.log("✅ Response received from Anthropic\n");

    // Add custom headers to show compression stats
    res.setHeader("X-Token-Optimizer-Original-Length", totalOriginalLength);
    res.setHeader("X-Token-Optimizer-Optimized-Length", totalOptimizedLength);
    res.setHeader("X-Token-Optimizer-Compression", compressionRatio);

    res.json(response);
  } catch (err) {
    console.error("❌ Anthropic proxy error:", err.message);
    res.status(500).json({
      type: "error",
      error: { type: "api_error", message: err.message },
    });
  }
});

// Test endpoint: summarize arbitrary text
app.post("/summarize-text", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text parameter" });

  try {
    const result = await optimizeText(text);

    // If request is from browser form, return HTML
    if (
      req.headers["content-type"]?.includes("application/x-www-form-urlencoded")
    ) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Result - TokenShrinker</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h2 { color: #333; }
            .result { background: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
            .summary { background: white; padding: 15px; border-left: 4px solid #007bff; margin: 10px 0; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .meta { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <h2>✅ Compression Result</h2>
          <div class="result">
            <h3>Compressed Text:</h3>
            <div class="summary">${
              result.summary || result.error || "No summary generated"
            }</div>
            <p class="meta">
              <strong>Original:</strong> ${
                result.original_length || 0
              } characters<br/>
              <strong>Compressed:</strong> ${
                result.compressed_length || 0
              } characters<br/>
              <strong>Saved:</strong> ${
                result.compression_ratio || "0%"
              } reduction
            </p>
            ${
              result.error
                ? `<p style="color: red;">Error: ${result.error}</p>`
                : ""
            }
          </div>
          <a href="/test">← Back to Test Page</a>
        </body>
        </html>
      `);
    } else {
      // JSON request
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `🚀 TokenShrinker MCP Server running at http://localhost:${PORT}`
  );
  console.log(
    `🔧 MCP Tool Manifest: http://localhost:${PORT}/.well-known/mcp-tool`
  );
  console.log(
    `🔧 MCP Tool Invocation: POST http://localhost:${PORT}/mcp/invoke`
  );
});
