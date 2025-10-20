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

  let updated = 0;
  for (const f of files) {
    const rel = path.relative(ROOT, f);
    const r = await summarizeFile(rel);
    if (r.changed) updated++;
  }
  const ts = new Date().toLocaleTimeString();
  console.clear();
  console.log(
    `🧠 ${ts} | ${files.length} checked | ${updated} summaries updated`
  );
  busy = false;
}

chokidar
  .watch(GLOB, { ignored: IGNORE, ignoreInitial: false })
  .on("change", (f) => pending.add(f))
  .on("add", (f) => pending.add(f))
  .on("unlink", (f) => pending.add(f))
  .on("ready", () => console.log("👀 Watching for code changes..."));

setInterval(processQueue, 2000);
