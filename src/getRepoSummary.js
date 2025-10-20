import fs from "fs-extra";
import path from "path";

export async function getRepoSummary() {
  const summaryDir = path.resolve("./summaries"); // folder where summaries are stored

  // Check if directory exists
  if (!(await fs.pathExists(summaryDir))) {
    return "No repository summaries available yet.";
  }

  const files = await fs.readdir(summaryDir);
  const allSummaries = [];

  for (const f of files) {
    // Skip non-JSON files and cache file
    if (!f.endsWith('.json') || f === '_cache.json') continue;

    try {
      const data = await fs.readJson(path.join(summaryDir, f));
      if (data.summary) {
        allSummaries.push(`${f}: ${data.summary}`);
      }
    } catch (err) {
      console.warn(`Could not read summary file ${f}:`, err.message);
    }
  }

  return allSummaries.length > 0
    ? allSummaries.join("\n\n")
    : "No repository summaries available yet.";
}
