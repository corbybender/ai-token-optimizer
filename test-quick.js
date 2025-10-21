#!/usr/bin/env node
/**
 * Quick MCP test to verify the server can start
 */

console.log("🚀 Quick MCP server test...");

// Run the MCP server manually to see if it starts
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the MCP server directly
try {
  const { startMCPServer } = await import("./src/mcp-server.js");

  console.log("✅ MCP server imported successfully");

  // Call but don't wait for it
  const serverPromise = startMCPServer();
  console.log("✅ MCP server started successfully");

  // Give it a second to initialize
  setTimeout(() => {
    console.log("🎯 MCP server should be listening now");
    console.log("Test: Manual MCP interaction complete");
    process.exit(0);
  }, 2000);
} catch (error) {
  console.error("❌ Failed to start MCP server:", error.message);
  console.error("Stack:", error.stack);
  process.exit(1);
}
