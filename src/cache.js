import fs from 'fs-extra';
import path from 'path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'summaries');
const CACHE_PATH = path.join(OUT_DIR, '_cache.json');

export async function loadCache() {
  if (await fs.pathExists(CACHE_PATH)) return fs.readJson(CACHE_PATH);
  return {};
}

export async function saveCache(cache) {
  await fs.ensureDir(path.dirname(CACHE_PATH));
  await fs.writeJson(CACHE_PATH, cache, { spaces: 2 });
}
