#!/usr/bin/env node
import { optimizeText } from "./optimizeText.js";
import { getRepoSummary } from "./getRepoSummary.js";
import { summarizeFile } from "./summarizer.js";

// MCP server implementation that communicates over stdin/stdout

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
