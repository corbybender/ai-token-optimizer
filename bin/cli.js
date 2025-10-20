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
  ai-token-optimizer --version, -v      Show version
  ai-token-optimizer --help, -h         Show this help

Setup Examples:
  ai-token-optimizer setup continue     Configure Continue.dev
  ai-token-optimizer setup cline        Configure Cline
  ai-token-optimizer setup aider        Configure Aider

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
