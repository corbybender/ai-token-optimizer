#!/usr/bin/env node
import chokidar from "chokidar";
import path from "path";
import { summarizeFile } from "./summarizer.js";

const ROOT = process.cwd();

// Default file patterns
const DEFAULT_PATTERNS = [
  "**/*.js",
  "**/*.ts",
  "**/*.mjs",
  "**/*.ejs",
  "**/*.html",
  "**/*.css",
];
const DEFAULT_IGNORE = [
  "node_modules/**",
  "dist/**",
  "build/**",
  "summaries/**",
];

// Allow user to customize via environment variables
const GLOB = process.env.WATCH_PATTERNS
  ? process.env.WATCH_PATTERNS.split(",").map((p) => p.trim())
  : DEFAULT_PATTERNS;

const IGNORE = process.env.WATCH_IGNORE
  ? process.env.WATCH_IGNORE.split(",").map((p) => p.trim())
  : DEFAULT_IGNORE;

console.log(`🎯 Watching files: ${GLOB.join(", ")}`);
console.log(`🚫 Ignoring patterns: ${IGNORE.join(", ")}`);

let pending = new Set();
let busy = false;

async function processQueue() {
  if (busy || pending.size === 0) return;
  busy = true;
  const files = Array.from(pending);
  pending.clear();

  // Filter out files we never want to process
  const filteredFiles = files.filter((f) => {
    const rel = path.relative(ROOT, f);
    const pathParts = rel.split(path.sep);

    // Skip files in directories we never want to summarize
    if (
      pathParts.some(
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
          rel.includes("__doc__doc__") // Weird nested paths
      )
    ) {
      return false; // Skip this file
    }

    return true; // Process this file
  });

  let updated = 0;
  for (const f of filteredFiles) {
    const rel = path.relative(ROOT, f);
    const r = await summarizeFile(rel);
    if (r.changed) updated++;
  }
  const ts = new Date().toLocaleTimeString();
  console.clear();
  let msg = `🧠 ${ts} | ${filteredFiles.length} checked | ${updated} summaries updated`;
  if (files.length > filteredFiles.length) {
    const skipped = files.length - filteredFiles.length;
    msg += ` | ${skipped} skipped`;
  }
  console.log(msg);
  busy = false;
}

chokidar
  .watch(GLOB, { ignored: IGNORE, ignoreInitial: false })
  .on("change", (f) => pending.add(f))
  .on("add", (f) => pending.add(f))
  .on("unlink", (f) => pending.add(f))
  .on("ready", () => console.log("👀 Watching for code changes..."));

setInterval(processQueue, 2000);
