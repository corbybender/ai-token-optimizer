#!/usr/bin/env node
import { spawn } from "child_process";
import path from "path";
import fs from "fs-extra";

const cmd = process.argv[2] || "start";
const root = process.cwd();

if (cmd === "init") {
  console.log("Initializing ai-token-optimizer skeleton...");
  // nothing heavy for now — assume files are present
  process.exit(0);
}

if (cmd === "start") {
  const proc = spawn(process.execPath, [path.join(root, "src", "server.js")], {
    stdio: "inherit",
  });
  proc.on("exit", (code) => process.exit(code));
}

if (cmd === "watch") {
  const proc = spawn(process.execPath, [path.join(root, "src", "watcher.js")], {
    stdio: "inherit",
  });
  proc.on("exit", (code) => process.exit(code));
}
