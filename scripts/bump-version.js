#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read current package.json
const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

// Parse current version
const [major, minor, patch] = packageJson.version.split(".").map(Number);

// Increment patch version
const newVersion = `${major}.${minor}.${patch + 1}`;

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

console.log(`📦 Version bumped: ${packageJson.version} → ${newVersion}`);
console.log(`🔄 Run 'npm publish' to publish the new version`);

// Update server.js version if needed
const serverPath = path.join(__dirname, "..", "src", "server.js");
let serverContent = fs.readFileSync(serverPath, "utf8");

// Update version in server startup message
serverContent = serverContent.replace(
  /version: "[\d.]+"?/,
  `version: "${newVersion}"`
);

fs.writeFileSync(serverPath, serverContent);
console.log(`✅ Server version updated to ${newVersion}`);
