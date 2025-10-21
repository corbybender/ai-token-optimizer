#!/usr/bin/env node
/**
 * Debug script to manually trace what happens in CLI
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.join(__dirname);

console.log("🔍 Checking what cmd value is when running test...");
console.log("process.argv:", process.argv);
const cmd = process.argv[2];
console.log("cmd =", cmd);
console.log("!cmd =", !!cmd);
console.log("cmd === '--stdio' =", cmd === "--stdio");

if (!cmd || cmd === "--stdio") {
  console.log("✅ Should enter MCP mode!");
  console.log("cmd is:", typeof cmd, "value:", cmd);
  console.log("!cmd evaluates to:", !cmd);
  console.log("cmd === '--stdio' evaluates to:", cmd === "--stdio");
  console.log(
    "Overall condition: (!cmd || cmd === '--stdio') =",
    !cmd || cmd === "--stdio"
  );
} else {
  console.log("❌ Would NOT enter MCP mode");
}

console.log("\n🎯 Let's try importing the MCP server...");
try {
  const { startMCPServer } = await import(
    pathToFileURL(path.join(packageRoot, "src", "mcp-server.js")).href
  );
  console.log("✅ MCP server imported successfully");

  console.log("🚀 Starting MCP server (this should hang)...");
  await startMCPServer();
} catch (error) {
  console.error("❌ MCP server failed:", error.message);
  console.error("Stack:", error.stack);
}
