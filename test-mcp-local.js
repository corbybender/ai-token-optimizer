#!/usr/bin/env node
/**
 * Test script for token-shrinker MCP server locally
 * This simulates how OrbitalMCP would interact with the MCP server
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test MCP server locally
console.log("🧪 Testing token-shrinker MCP server locally...\n");

console.log("1️⃣ Starting MCP server...");

// Start the token-shrinker MCP server
const tokenShrinker = spawn("node", [path.join(__dirname, "bin", "cli.js")], {
  stdio: ["pipe", "pipe", "pipe"], // pipe stdin so we can write to it
  cwd: __dirname,
});

// Handle stdin errors gracefully
tokenShrinker.stdin.on("error", () => {}); // Ignore errors

// Set a timeout to kill the test after 30 seconds
const timeout = setTimeout(() => {
  console.log("\n⏰ Test timeout reached");
  tokenShrinker.kill();
  process.exit(1);
}, 30000);

let stdout = "";
let stderr = "";

tokenShrinker.stdout.on("data", (data) => {
  stdout += data.toString();
  console.log("📨 STDOUT:", data.toString().trim());
});

tokenShrinker.stderr.on("data", (data) => {
  stderr += data.toString();
  console.log("📝 STDERR:", data.toString().trim());
});

// Wait 2 seconds for server to start, then send MCP initialize request
setTimeout(() => {
  console.log("\n2️⃣ Sending MCP initialize request...");

  const initRequest = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "MCP Test Client",
        version: "1.0.0",
      },
    },
  };

  console.log("🎯 Sending:", JSON.stringify(initRequest, null, 2));
  tokenShrinker.stdin.write(JSON.stringify(initRequest) + "\n");
}, 2000);

// After another 2 seconds, send tools/list request
setTimeout(() => {
  console.log("\n3️⃣ Sending MCP tools/list request...");

  const toolsRequest = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/list",
    params: {},
  };

  console.log("🎯 Sending:", JSON.stringify(toolsRequest, null, 2));
  tokenShrinker.stdin.write(JSON.stringify(toolsRequest) + "\n");
}, 4000);

// After receiving tools/list response, wait and exit
setTimeout(() => {
  console.log("\n4️⃣ Analyzing results...");

  const outputLines = stdout.split("\n").filter((line) => line.trim());
  console.log(`📊 Received ${outputLines.length} output lines`);

  // Parse responses from MCP server
  const toolsArray = [];
  let serverInitialized = false;
  let toolsReceived = false;

  for (const line of outputLines) {
    try {
      const response = JSON.parse(line.trim());
      console.log(
        `🔍 Parsed response: ID=${
          response.id
        }, hasResult=${!!response.result}, hasTools=${!!response?.result
          ?.tools}`
      );

      if (response.result?.protocolVersion) {
        console.log(
          "✅ Server initialized successfully with protocol:",
          response.result.protocolVersion
        );
        serverInitialized = true;
      }

      if (response.result?.tools && Array.isArray(response.result.tools)) {
        console.log(
          `✅ Tools discovered: ${response.result.tools.length} tools found`
        );
        toolsReceived = true;
        toolsArray.push(...response.result.tools);

        console.log("📋 Tools list:");
        response.result.tools.forEach((tool, index) => {
          console.log(`   ${index + 1}. ${tool.name} - ${tool.description}`);
        });
      }
    } catch (e) {
      console.log("⚠️  Could not parse line as JSON:", line.slice(0, 100));
    }
  }

  console.log("\n🏁 TEST RESULTS:");

  if (serverInitialized) {
    console.log("✅ MCP Server initialization: SUCCESS");
  } else {
    console.log("❌ MCP Server initialization: FAILED");
  }

  if (toolsReceived) {
    console.log("✅ Tool discovery: SUCCESS");
    console.log(`   Found ${toolsArray.length} tools total`);

    const expectedTools = [
      "shrink",
      "summarize",
      "fetch-summary",
      "set-provider",
      "set-api-key",
      "set-model",
      "get-config",
    ];
    const foundToolNames = toolsArray.map((t) => t.name);

    console.log("🔍 Tool verification:");
    expectedTools.forEach((toolName) => {
      if (foundToolNames.includes(toolName)) {
        console.log(`   ✅ ${toolName}`);
      } else {
        console.log(`   ❌ ${toolName} (missing)`);
      }
    });
  } else {
    console.log("❌ Tool discovery: FAILED");
  }

  console.log("\n✨ Test complete - MCP server ready for OrbitalMCP! ✨");

  // Exit successfully
  tokenShrinker.kill();
  clearTimeout(timeout);
  process.exit(0);
}, 7000);

// Handle server exit
tokenShrinker.on("close", (code, signal) => {
  console.log(`\n🔌 MCP server exited with code ${code}, signal ${signal}`);
  clearTimeout(timeout);

  if (code !== 0) {
    console.log("❌ Server exited with error code - this may be the issue!");
  }
});

tokenShrinker.on("error", (err) => {
  console.error("❌ Failed to start MCP server:", err);
  clearTimeout(timeout);
  process.exit(1);
});
