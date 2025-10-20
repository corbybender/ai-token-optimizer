// src/summarizer.js
import fs from "fs-extra";
import path from "path";
import esprima from "esprima";
import crypto from "crypto";
import { loadCache, saveCache } from "./cache.js";
import { optimizeText } from "./optimizeText.js";
import { getRepoSummary } from "./getRepoSummary.js";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "summaries");
const TOKEN_LIMIT = 2000;

const estimateTokens = (txt) => Math.ceil(txt.length / 4);
const hash = (txt) => crypto.createHash("sha1").update(txt).digest("hex");

function analyzeJS(content) {
  try {
    const tree = esprima.parseModule(content, { tolerant: true });
    const imports = [];
    const exports = [];
    for (const n of tree.body) {
      if (n.type === "ImportDeclaration") imports.push(n.source.value);
      if (n.type === "ExportNamedDeclaration" && n.declaration) {
        const d = n.declaration;
        if (d.id) exports.push(d.id.name);
        if (d.declarations)
          d.declarations.forEach((x) => exports.push(x.id?.name));
      }
    }
    return { imports, exports };
  } catch (e) {
    return { imports: [], exports: [] };
  }
}

// Old local summarizeText for JS/HTML/CSS
function localSummarizeText(content, filePath) {
  const ext = path.extname(filePath);
  if ([".js", ".ts", ".mjs"].includes(ext)) {
    const { imports, exports } = analyzeJS(content);
    return {
      summary: `JS/TS module with ${exports.length} export(s) and ${imports.length} import(s).`,
      imports,
      exports,
    };
  }
  if (ext === ".ejs" || ext === ".html")
    return { summary: "HTML/EJS template (markup oriented)." };
  if (ext === ".css")
    return { summary: "CSS stylesheet defining visual layout." };
  return { summary: "Generic text/code file." };
}

// New AI-based summarizeText function
async function summarizeTextWithAI(
  content,
  filePath,
  includeRepoContext = false
) {
  try {
    const result = await optimizeText(content, includeRepoContext);
    return {
      ...result,
      file: filePath,
      timestamp: Date.now(),
    };
  } catch (err) {
    console.error(`Error summarizing file ${filePath} with AI:`, err);
    return {
      file: filePath,
      error: err.message,
    };
  }
}

export async function summarizeFile(file) {
  const cache = await loadCache();
  const full = path.join(ROOT, file);

  if (!(await fs.pathExists(full))) {
    // file removed: cleanup
    const outPath = path.join(OUT_DIR, `${file}.summary.json`);
    if (await fs.pathExists(outPath)) await fs.remove(outPath);
    delete cache[file];
    await saveCache(cache);
    return { changed: false, removed: true };
  }

  const text = await fs.readFile(full, "utf8");
  const h = hash(text);
  if (cache[file]?.hash === h) return { changed: false };

  const tokens = estimateTokens(text);
  if (tokens < TOKEN_LIMIT) {
    // small file -> ensure no stale summary
    const outPath = path.join(OUT_DIR, `${file}.summary.json`);
    if (await fs.pathExists(outPath)) await fs.remove(outPath);
    delete cache[file];
    await saveCache(cache);
    return { changed: false };
  }

  // Use AI-based summarization with repo context
  const info = await summarizeTextWithAI(text, file, true);

  const data = {
    file,
    size_tokens: tokens,
    ...info,
  };

  const outPath = path.join(OUT_DIR, `${file}.summary.json`);
  await fs.ensureDir(path.dirname(outPath));
  await fs.writeJson(outPath, data, { spaces: 2 });

  cache[file] = { hash: h, updated: Date.now() };
  await saveCache(cache);
  return { changed: true };
}
