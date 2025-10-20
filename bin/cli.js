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
  console.log(`ai-token-optimizer v${packageJson.version}`);
  process.exit(0);
}

// Help command
if (cmd === "--help" || cmd === "-h" || cmd === "help" || cmd === "-help") {
  console.log(`
ai-token-optimizer v${packageJson.version}

Usage:
  ai-token-optimizer                    Start the proxy server
  ai-token-optimizer start              Start the proxy server (alias)
  ai-token-optimizer setup <tool>       Auto-configure a tool to use the proxy
  ai-token-optimizer run <command>      Run a command with proxy enabled
  ai-token-optimizer status             Show current configuration status
  ai-token-optimizer cleanup            Remove all configurations
  ai-token-optimizer cleanup-summaries  Remove unwanted summary files
  ai-token-optimizer --version, -v      Show version
  ai-token-optimizer --help, -h         Show this help

Setup Examples:
  ai-token-optimizer setup continue     Configure Continue.dev (OpenRouter free models)
  ai-token-optimizer setup cline        Configure Cline (OpenRouter free models)
  ai-token-optimizer setup aider        Configure Aider (OpenRouter free models)

Run Examples:
  ai-token-optimizer run aider          Run Aider with proxy
  ai-token-optimizer run "npm start"    Run npm start with proxy

Documentation: https://github.com/corbybender/ai-token-optimizer
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

// Legacy commands
if (cmd === "init") {
  console.log("Initializing ai-token-optimizer skeleton...");
  process.exit(0);
}

if (cmd === "watch") {
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
  // Default: start the server (handles 'start' command or no command)
  const proc = spawn(
    process.execPath,
    [path.join(packageRoot, "src", "server.js")],
    {
      stdio: "inherit",
      cwd: process.cwd(),
    }
  );
  proc.on("exit", (code) => process.exit(code));
}
