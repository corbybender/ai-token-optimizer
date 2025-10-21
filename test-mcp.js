#!/usr/bin/env node
// Simple one-shot test using echo
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Testing MCP server with echo command...");

// Use echo to pipe JSON to the MCP server
const echoProcess = spawn(
  "echo",
  [`{"jsonrpc":"2.0","method":"tools/list","id":1}`],
  {
    stdio: ["inherit", "pipe", "inherit"],
  }
);

// Pipe echo output to MCP server
const mcpProcess = spawn("node", [path.join(__dirname, "bin", "cli.js")], {
  stdio: ["pipe", "inherit", "inherit"],
  cwd: process.cwd(),
});

echoProcess.stdout.pipe(mcpProcess.stdin);

// Wait for processes to finish
setTimeout(() => {
  echoProcess.kill();
  mcpProcess.kill();
}, 5000);
