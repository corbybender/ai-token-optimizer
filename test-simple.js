#!/usr/bin/env node
/**
 * Simple test: just run the MCP server and see if it stays running
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🎯 Simple MCP server test - should stay running");

// Start the token-shrinker MCP server
const tokenShrinker = spawn("node", [path.join(__dirname, "bin", "cli.js")], {
  stdio: ["inherit", "inherit", "inherit"],
  cwd: __dirname,
});

tokenShrinker.on("close", (code, signal) => {
  console.log(`🔌 MCP server exited with code ${code}, signal ${signal}`);
});

console.log("📝 MCP server is running... (press Ctrl+C to stop)");
console.log(
  "💡 If it prints debug messages and stays running, MCP server works!"
);
