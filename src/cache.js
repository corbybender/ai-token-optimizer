import fs from "fs-extra";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "summaries");
const CACHE_FILE = path.join(OUT_DIR, "_cache.json");

// Load cache safely
export async function loadCache() {
  await fs.ensureDir(OUT_DIR);

  if (!(await fs.pathExists(CACHE_FILE))) {
    await fs.writeJson(CACHE_FILE, {});
  }

  try {
    return await fs.readJson(CACHE_FILE);
  } catch (err) {
    console.error("Failed to read cache, resetting:", err);
    await fs.writeJson(CACHE_FILE, {});
    return {};
  }
}

// Save cache safely
export async function saveCache(cache) {
  await fs.ensureDir(OUT_DIR);
  await fs.writeJson(CACHE_FILE, cache, { spaces: 2 });
}

// Convert file paths to Windows-safe summary file names
export function safeFileName(filePath) {
  return filePath.replace(/[/\\:]/g, "__");
}
