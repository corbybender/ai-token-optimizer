import express from "express";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs-extra";
import cors from "cors";
import { loadCache } from "./cache.js";
import { optimizeText } from "./optimizeText.js";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "summaries");

function readSummary(file) {
  const p = path.join(OUT_DIR, `${file}.summary.json`);
  if (fs.existsSync(p)) return fs.readJsonSync(p);
  return null;
}

export function createServer({ port = 4343 } = {}) {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: "1mb" }));

  app.get("/health", (req, res) => res.json({ ok: true, time: Date.now() }));

  // return a token-optimized context for a set of files or a query
  app.post(
    "/optimize",
    express.urlencoded({ extended: true }),
    async (req, res) => {
      const input = req.body.files || req.body.text;
      const optimized = await optimizeText(input);

      // Detect browser vs API JSON request
      if (req.headers["content-type"]?.includes("application/json")) {
        res.json(optimized);
      } else {
        res.send(`<pre>${JSON.stringify(optimized, null, 2)}</pre>`);
      }
    }
  );

  // Simple browser test route
  app.get("/test", (req, res) => {
    res.send(`
    <h2>AI Token Optimizer Test</h2>
    <form action="/optimize" method="post" style="margin-top:20px;">
      <textarea name="text" rows="6" cols="60" placeholder="Enter text to optimize"></textarea><br><br>
      <button type="submit">Optimize</button>
    </form>
  `);
  });

  app.get("/summaries/*", (req, res) => {
    const file = req.params[0];
    const p = path.join(OUT_DIR, `${file}.summary.json`);
    if (!fs.existsSync(p)) return res.status(404).send("not found");
    res.sendFile(p);
  });

  const server = app.listen(port, () =>
    console.log(`🚀 ai-token-optimizer listening on http://localhost:${port}`)
  );
  return { app, server };
}
