#!/usr/bin/env node
import { optimizeText } from "./optimizeText.js";
import { getRepoSummary } from "./getRepoSummary.js";
import { summarizeFile } from "./summarizer.js";

// MCP server implementation that communicates over stdin/stdout

function getDefaultModelForProvider(provider) {
  switch (provider.toLowerCase()) {
    case "openrouter":
      return "meta-llama/llama-4-maverick:free";
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-haiku-20240307";
    case "ollama":
      return "llama2";
    default:
      return "meta-llama/llama-4-maverick:free";
  }
}

export async function startMCPServer() {
  const tools = {
    shrink: {
      name: "shrink",
      description: "Compress text content to reduce token usage",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "Text content to compress",
          },
        },
        required: ["text"],
      },
    },
    summarize: {
      name: "summarize",
      description: "Generate a summary of provided content",
      inputSchema: {
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
      name: "fetch-summary",
      description: "Retrieve repository summaries from cache",
      inputSchema: {
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
    "set-provider": {
      name: "set-provider",
      description:
        "Set your AI provider (openrouter, openai, anthropic, ollama)",
      inputSchema: {
        type: "object",
        properties: {
          provider: {
            type: "string",
            enum: ["openrouter", "openai", "anthropic", "ollama"],
            description: "AI provider to use for text compression",
          },
        },
        required: ["provider"],
      },
    },
    "set-api-key": {
      name: "set-api-key",
      description: "Set your API key for the current provider",
      inputSchema: {
        type: "object",
        properties: {
          apiKey: {
            type: "string",
            description: "API key for your AI provider",
          },
        },
        required: ["apiKey"],
      },
    },
    "set-model": {
      name: "set-model",
      description: "Set your preferred model for the current provider",
      inputSchema: {
        type: "object",
        properties: {
          model: {
            type: "string",
            description:
              "Model identifier for your provider (e.g., 'gpt-4o-mini', 'claude-3-haiku-20240307')",
          },
        },
        required: ["model"],
      },
    },
    "get-config": {
      name: "get-config",
      description:
        "Get current configuration including provider, API key status, and selected model",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  };

  async function handleRequest(request) {
    const { id, method, params } = request;

    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: Object.values(tools),
        },
      };
    }

    if (method === "tools/call") {
      const { name, arguments: args } = params;

      try {
        if (name === "shrink") {
          if (!args?.text) {
            throw new Error("Missing required parameter: text");
          }

          const result = await optimizeText(args.text);
          return {
            jsonrpc: "2.0",
            id,
            result: {
              compressedText: result.summary || result.error,
              originalLength: result.original_length,
              compressedLength: result.compressed_length,
              compressionRatio: result.compression_ratio,
              success: !result.error,
            },
          };
        }

        if (name === "summarize") {
          if (!args?.content || !args?.type) {
            throw new Error("Missing required parameters: content and type");
          }

          let summaryPromise;
          if (args.type === "repo") {
            summaryPromise = getRepoSummary();
          } else if (args.type === "file") {
            summaryPromise = summarizeFile(args.content);
          } else {
            summaryPromise = optimizeText(args.content);
          }

          const result = await summaryPromise;

          if (args.type === "repo") {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                summary: result,
                type: "repository",
                timestamp: new Date().toISOString(),
                cached: true,
              },
            };
          } else if (args.type === "file") {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                summary: result.summary || result.error,
                filePath: args.content,
                method: result.method,
                timestamp: result.timestamp,
                success: !result.error,
              },
            };
          } else {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                summary: result.summary || result.error,
                originalLength: result.original_length,
                compressedLength: result.compressed_length,
                compressionRatio: result.compression_ratio,
                success: !result.error,
              },
            };
          }
        }

        if (name === "fetch-summary") {
          const summaries = await getRepoSummary();
          return {
            jsonrpc: "2.0",
            id,
            result: {
              summaries,
              repoPath: args?.repoPath || process.cwd(),
              timestamp: new Date().toISOString(),
              cacheStatus:
                summaries === "No repository summaries available yet."
                  ? "empty"
                  : "available",
            },
          };
        }

        if (name === "set-provider") {
          if (!args?.provider) {
            throw new Error("Missing required parameter: provider");
          }

          const validProviders = [
            "openrouter",
            "openai",
            "anthropic",
            "ollama",
          ];
          if (!validProviders.includes(args.provider.toLowerCase())) {
            throw new Error(
              `Invalid provider. Must be one of: ${validProviders.join(", ")}`
            );
          }

          // Store the preferred provider
          process.env.USER_PREFERRED_PROVIDER = args.provider.toLowerCase();

          return {
            jsonrpc: "2.0",
            id,
            result: {
              message: `Provider set to: ${args.provider}`,
              provider: args.provider,
              note: "This setting persists for the current session. Set AI_PROVIDER environment variable for permanent configuration.",
            },
          };
        }

        if (name === "set-api-key") {
          if (!args?.apiKey) {
            throw new Error("Missing required parameter: apiKey");
          }

          // Store the API key (could be persisted in future)
          process.env.USER_API_KEY = args.apiKey;

          return {
            jsonrpc: "2.0",
            id,
            result: {
              message: "API key set successfully",
              note: "This setting persists for the current session. Set provider-specific environment variables for permanent configuration (e.g., OPENAI_API_KEY, ANTHROPIC_API_KEY).",
            },
          };
        }

        if (name === "set-model") {
          if (!args?.model) {
            throw new Error("Missing required parameter: model");
          }

          // Store the preferred model (could be persisted in future)
          process.env.USER_PREFERRED_MODEL = args.model;

          return {
            jsonrpc: "2.0",
            id,
            result: {
              message: `Model set to: ${args.model}`,
              model: args.model,
              note: "This setting persists for the current session. Set provider-specific model environment variables for permanent configuration.",
            },
          };
        }

        if (name === "get-config") {
          const provider =
            process.env.USER_PREFERRED_PROVIDER ||
            process.env.AI_PROVIDER ||
            "openrouter";

          const hasApiKey = !!(
            process.env.USER_API_KEY ||
            process.env.AI_API_KEY ||
            process.env.OPENROUTER_API_KEY ||
            process.env.OPENAI_API_KEY ||
            process.env.ANTHROPIC_API_KEY ||
            process.env.OLLAMA_BASE_URL
          );

          const currentModel =
            process.env.USER_PREFERRED_MODEL ||
            process.env.AI_MODEL ||
            getDefaultModelForProvider(provider);

          return {
            jsonrpc: "2.0",
            id,
            result: {
              provider,
              apiKeySet: hasApiKey,
              currentModel,
              userPreferredProvider:
                process.env.USER_PREFERRED_PROVIDER || null,
              userPreferredModel: process.env.USER_PREFERRED_MODEL || null,
              userApiKeySet: !!process.env.USER_API_KEY,
              availableProviders: ["openrouter", "openai", "anthropic"],
              supportedProviders: [
                "openrouter",
                "openai",
                "anthropic",
                "ollama",
              ],
            },
          };
        }

        return {
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: `Method not found: ${name}`,
          },
          id,
        };
      } catch (error) {
        return {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal error",
            data: error.message,
          },
          id,
        };
      }
    }

    return {
      jsonrpc: "2.0",
      error: {
        code: -32601,
        message: `Method not found: ${method}`,
      },
      id,
    };
  }

  // Handle stdin/stdout communication
  process.stdin.setEncoding("utf8");

  let buffer = "";

  process.stdin.on("data", async (chunk) => {
    buffer += chunk;

    // Process complete lines
    const lines = buffer.split("\n");
    buffer = lines.pop(); // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const request = JSON.parse(line.trim());
        const response = await handleRequest(request);
        process.stdout.write(JSON.stringify(response) + "\n");
      } catch (error) {
        // Send error response for malformed requests
        const errorResponse = {
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: "Parse error",
            data: error.message,
          },
          id: null,
        };
        process.stdout.write(JSON.stringify(errorResponse) + "\n");
      }
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });

  process.on("SIGINT", () => {
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    process.exit(0);
  });

  // Initialize - send server started message to stderr
  console.error(
    "TokenShrinker MCP Server started and listening for requests..."
  );
}
