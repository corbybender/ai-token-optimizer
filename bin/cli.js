#!/usr/bin/env node
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = path.join(__dirname, "..");

const cmd = process.argv[2];

// Handle different commands
if (cmd === "init") {
  console.log("Initializing ai-token-optimizer skeleton...");
  // nothing heavy for now — assume files are present
  process.exit(0);
} else if (cmd === "watch") {
  // Standalone watcher (not commonly needed since server includes it)
  const proc = spawn(process.execPath, [path.join(packageRoot, "src", "watcher.js")], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  proc.on("exit", (code) => process.exit(code));
} else {
  // Default: start the server (handles 'start' command or no command)
  const proc = spawn(process.execPath, [path.join(packageRoot, "src", "server.js")], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  proc.on("exit", (code) => process.exit(code));
}
