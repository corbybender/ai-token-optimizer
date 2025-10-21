#!/usr/bin/env node
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = path.join(__dirname, "..");

// Read package.json for version
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")
);

const cmd = process.argv[2];
const args = process.argv.slice(3);

// Version command
if (cmd === "--version" || cmd === "-v") {
  console.log(`token-shrinker v${packageJson.version}`);
  process.exit(0);
}

// Help command
if (cmd === "--help" || cmd === "-h" || cmd === "help" || cmd === "-help") {
  console.log(`
token-shrinker v${packageJson.version}

Usage:
  token-shrinker                           Start MCP server (default)
  token-shrinker server                    Start HTTP proxy server
  token-shrinker start                     Alias for server
  token-shrinker setup <tool>              Auto-configure tool to use proxy
  token-shrinker run <command>             Run command with proxy enabled
  token-shrinker status                    Show current configuration status
  token-shrinker cleanup                   Remove all configurations
  token-shrinker cleanup-summaries         Remove unwanted summary files
  token-shrinker --version, -v             Show version
  token-shrinker --help, -h                Show this help

MCP Server (Recommended):
  # Run MCP server - auto-detected by MCP clients
  npx token-shrinker

Proxy Setup Examples:
  token-shrinker setup continue            Configure Continue.dev
  token-shrinker setup cline               Configure Cline
  token-shrinker setup aider               Configure Aider

Run Examples:
  token-shrinker run aider                 Run Aider with proxy
  token-shrinker run "npm start"           Run npm start with proxy

Documentation: https://github.com/corbybender/token-shrinker
  `);
  process.exit(0);
}

// Setup command
if (cmd === "setup") {
  const setupModule = await import(
    pathToFileURL(path.join(packageRoot, "src", "setup.js")).href
  );
  await setupModule.setup(args[0]);
  process.exit(0);
}

// Run command (wrapper mode)
if (cmd === "run") {
  const runModule = await import(
    pathToFileURL(path.join(packageRoot, "src", "run.js")).href
  );
  await runModule.run(args.join(" "));
  process.exit(0);
}

// Status command
if (cmd === "status") {
  const statusModule = await import(
    pathToFileURL(path.join(packageRoot, "src", "status.js")).href
  );
  await statusModule.showStatus();
  process.exit(0);
}

// Cleanup command
if (cmd === "cleanup") {
  const cleanupModule = await import(
    pathToFileURL(path.join(packageRoot, "src", "cleanup.js")).href
  );
  await cleanupModule.cleanup();
  process.exit(0);
}

// Cleanup-summaries command
if (cmd === "cleanup-summaries") {
  console.log("🧹 Cleaning up unwanted summary files...");
  console.log("=========================================");

  const fs = await import("fs");
  const path = await import("path");
  const summariesDir = path.join(process.cwd(), "summaries");

  if (!fs.existsSync(summariesDir)) {
    console.log("✅ No summaries directory found");
    process.exit(0);
  }

  function shouldRemove(filePath) {
    // Remove summaries for files in these directories
    const pathParts = filePath.split(path.sep);
    return pathParts.some(
      (part) =>
        [
          "node_modules",
          "dist",
          "build",
          "vendor",
          ".git",
          "cache",
          "logs",
        ].includes(part) ||
        part.startsWith(".") ||
        filePath.includes("__doc__doc__") // Your weird nested paths
    );
  }

  let removed = 0;
  function cleanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        cleanDir(fullPath);
        // Remove empty directories
        try {
          if (fs.readdirSync(fullPath).length === 0) {
            fs.rmdirSync(fullPath);
          }
        } catch (err) {
          // Directory might not be empty anymore
        }
      } else if (entry.isFile() && entry.name.endsWith(".summary.json")) {
        if (shouldRemove(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
            removed++;
          } catch (err) {
            console.warn(`Could not remove ${fullPath}: ${err.message}`);
          }
        }
      }
    }
  }

  cleanDir(summariesDir);

  // Also clean up _cache.json file which tracks these files
  const cacheFile = path.join(summariesDir, "_cache.json");
  if (fs.existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      // Remove entries that match our removal criteria
      let cacheChanged = false;
      for (const [filePath, data] of Object.entries(cache)) {
        if (shouldRemove(filePath)) {
          delete cache[filePath];
          cacheChanged = true;
        }
      }
      if (cacheChanged) {
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
        console.log("✅ Updated cache file to remove deleted summaries");
      }
    } catch (err) {
      console.warn(`Could not update cache file: ${err.message}`);
    }
  }

  console.log(
    `✅ Summary cleanup complete! Removed ${removed} unwanted summary files.`
  );
  console.log("\n💡 To prevent future unwanted summaries:");
  console.log("   Add to your .env file:");
  console.log(
    "   WATCH_IGNORE=node_modules/**,dist/**,build/**,summaries/**,.git/**,vendor/**,logs/**"
  );

  process.exit(0);
}

// MCP server mode (when run with --stdio or no args)
if (!cmd || cmd === "--stdio") {
  const mcpServer = await import(
    pathToFileURL(path.join(packageRoot, "src", "mcp-server.js")).href
  );
  await mcpServer.startMCPServer();
  // MCP server will run indefinitely, so we never return from here
  process.exit(0);
}

// Legacy commands
if (cmd === "init") {
  console.log("Initializing token-shrinker MCP server...");
  process.exit(0);
}

if (cmd === "server" || cmd === "start") {
  // Run the traditional HTTP server
  const proc = spawn(
    process.execPath,
    [path.join(packageRoot, "src", "server.js")],
    {
      stdio: "inherit",
      cwd: process.cwd(),
    }
  );
  proc.on("exit", (code) => process.exit(code));
} else if (cmd === "watch") {
  const proc = spawn(
    process.execPath,
    [path.join(packageRoot, "src", "watcher.js")],
    {
      stdio: "inherit",
      cwd: process.cwd(),
    }
  );
  proc.on("exit", (code) => process.exit(code));
} else {
  // Show help if command not recognized
  console.log(`Unknown command: ${cmd}`);
  console.log(`Run 'token-shrinker --help' for usage information`);
  process.exit(1);
}
