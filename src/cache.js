import fs from "fs-extra";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "summaries");
const CACHE_FILE = path.join(OUT_DIR, "_cache.json");

let cacheInitialized = false;
let initPromise = null;

// Initialize cache directory and file once
async function initCache() {
  if (cacheInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await fs.ensureDir(OUT_DIR);

      // Check if cache file exists
      const exists = await fs.pathExists(CACHE_FILE);
      if (!exists) {
        // Create with outputJson which is more reliable on Windows
        await fs.outputJson(CACHE_FILE, {}, { spaces: 2 });
        // Small delay to ensure filesystem sync on Windows
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      cacheInitialized = true;
    } catch (err) {
      console.error("Failed to initialize cache:", err);
      throw err;
    }
  })();

  return initPromise;
}

// Load cache safely
export async function loadCache() {
  await initCache();

  try {
    const data = await fs.readJson(CACHE_FILE);
    return data || {};
  } catch (err) {
    console.error("Failed to read cache, resetting:", err);
    try {
      await fs.outputJson(CACHE_FILE, {}, { spaces: 2 });
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (writeErr) {
      console.error("Failed to reset cache:", writeErr);
    }
    return {};
  }
}

// Save cache safely
export async function saveCache(cache) {
  await initCache();

  try {
    await fs.outputJson(CACHE_FILE, cache || {}, { spaces: 2 });
  } catch (err) {
    console.error("Failed to save cache:", err);
    // Don't throw, just log - cache is not critical
  }
}

// Convert file paths to Windows-safe summary file names
export function safeFileName(filePath) {
  return filePath.replace(/[/\\:]/g, "__");
}
