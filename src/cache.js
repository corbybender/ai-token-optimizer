import fs from "fs-extra";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "summaries");
const CACHE_FILE = path.join(OUT_DIR, "_cache.json");

export async function loadCache() {
  await fs.ensureDir(OUT_DIR); // <- ensures folder exists
  if (!(await fs.pathExists(CACHE_FILE))) {
    await fs.writeJson(CACHE_FILE, {}); // <- create empty cache if missing
  }
  return fs.readJson(CACHE_FILE);
}

export async function saveCache(cache) {
  await fs.ensureDir(OUT_DIR); // <- ensures folder exists
  await fs.writeJson(CACHE_FILE, cache, { spaces: 2 });
}
