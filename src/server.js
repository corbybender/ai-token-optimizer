#!/usr/bin/env node
import dotenv from "dotenv";
import express from "express";
import bodyParser from "body-parser";
import { summarizeFile } from "./summarizer.js";
import "./watcher.js"; // start watcher in the same process
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

// Explicitly load .env from the user's current working directory
const envPath = path.join(process.cwd(), ".env");
console.log("🔍 Looking for .env at:", envPath);
console.log("🔍 File exists:", fs.existsSync(envPath));

const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.warn("\n⚠️  Warning: No .env file found in", process.cwd());
  console.warn("⚠️  Create a .env file with your OPENROUTER_API_KEY to use AI features");
  console.warn("⚠️  See .env.example for template\n");
} else {
  console.log("✅ Loaded .env from", envPath);
  console.log("🔍 OPENROUTER_API_KEY found:", process.env.OPENROUTER_API_KEY ? "YES (length: " + process.env.OPENROUTER_API_KEY.length + ")" : "NO");
  console.log("🔍 All env vars loaded:", Object.keys(envResult.parsed || {}).join(", "));
}

const execAsync = promisify(exec);
const PORT = process.env.PORT ? Number(process.env.PORT) : 4343;
const app = express();

// Kill any process using the port before starting
async function killPortProcess(port) {
  try {
    // On Windows, use netstat to find the PID and taskkill
    if (process.platform === "win32") {
      const { stdout } = await execAsync(
        `netstat -ano | findstr :${port} | findstr LISTENING`
      );
      const lines = stdout.trim().split("\n");
      const pids = new Set();

      for (const line of lines) {
        const match = line.trim().match(/\s+(\d+)\s*$/);
        if (match) pids.add(match[1]);
      }

      for (const pid of pids) {
        console.log(`Killing process ${pid} on port ${port}...`);
        await execAsync(`taskkill /PID ${pid} /F`).catch(() => {});
      }
    } else {
      // On Unix-like systems, use lsof
      const { stdout } = await execAsync(`lsof -ti:${port}`).catch(() => ({ stdout: "" }));
      const pids = stdout.trim().split("\n").filter(Boolean);

      for (const pid of pids) {
        console.log(`Killing process ${pid} on port ${port}...`);
        await execAsync(`kill -9 ${pid}`).catch(() => {});
      }
    }
  } catch (err) {
    // No process using the port, which is fine
  }
}

await killPortProcess(PORT);

app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// Browser test page
app.get("/test", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>TokenShrinker Test</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h2 { color: #333; }
        textarea { width: 100%; padding: 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin-top: 10px; }
        button:hover { background: #0056b3; }
        .result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <h2>🧠 TokenShrinker Test</h2>
      <p>Enter text below to compress it using AI:</p>

      <form method="POST" action="/summarize-text">
        <textarea name="text" rows="8" placeholder="Enter text to compress..."></textarea><br/>
        <button type="submit">Compress Text</button>
      </form>

      <p style="margin-top: 30px;"><strong>API Endpoints:</strong></p>
      <ul>
        <li>POST /summarize-text - { "text": "your text here" }</li>
        <li>POST /summarize-file - { "file": "path/to/file.js" }</li>
      </ul>
    </body>
    </html>
  `);
});

// Test endpoint: summarize a single file
app.post("/summarize-file", async (req, res) => {
  const { file } = req.body;
  if (!file) return res.status(400).json({ error: "Missing file parameter" });

  try {
    const result = await summarizeFile(file);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test endpoint: summarize arbitrary text
import { optimizeText } from "./optimizeText.js";
app.post("/summarize-text", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text parameter" });

  try {
    const result = await optimizeText(text);

    // If request is from browser form, return HTML
    if (req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Result - TokenShrinker</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            h2 { color: #333; }
            .result { background: #f8f9fa; padding: 20px; border-radius: 4px; margin: 20px 0; }
            .summary { background: white; padding: 15px; border-left: 4px solid #007bff; margin: 10px 0; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
            .meta { color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <h2>✅ Compression Result</h2>
          <div class="result">
            <h3>Compressed Text:</h3>
            <div class="summary">${result.summary || result.error || 'No summary generated'}</div>
            <p class="meta">
              <strong>Original:</strong> ${result.original_length || 0} characters<br/>
              <strong>Compressed:</strong> ${result.compressed_length || 0} characters<br/>
              <strong>Saved:</strong> ${result.compression_ratio || '0%'} reduction
            </p>
            ${result.error ? `<p style="color: red;">Error: ${result.error}</p>` : ''}
          </div>
          <a href="/test">← Back to Test Page</a>
        </body>
        </html>
      `);
    } else {
      // JSON request
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 TokenShrinker server running at http://localhost:${PORT}`)
);
