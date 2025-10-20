import fs from "fs-extra";
import path from "path";
import { optimizeText } from "./optimizeText.js";

const ROOT_DIR = path.resolve(".."); // Adjust to your repo root
const SUMMARY_DIR = path.resolve("./summaries");

// Make sure the summaries folder exists
await fs.ensureDir(SUMMARY_DIR);

// File extensions to summarize
const EXTENSIONS = [".js", ".ts", ".css", ".ejs", ".json"];

async function summarizeFile(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  const result = await optimizeText(content);

  // Save summary to summaries folder
  const fileName = path.basename(filePath) + ".summary.json";
  const summaryPath = path.join(SUMMARY_DIR, fileName);
  await fs.writeJson(summaryPath, result, { spaces: 2 });

  console.log(`Summarized: ${filePath} -> ${summaryPath}`);
}

async function walkDir(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDir(fullPath);
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      await summarizeFile(fullPath);
    }
  }
}

async function summarizeRepo() {
  console.log("Starting repo summarization...");
  await walkDir(ROOT_DIR);
  console.log("All files summarized!");
}

summarizeRepo();
