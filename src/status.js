import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".ai-token-optimizer");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch (err) {
    console.warn("Warning: Could not load config file");
  }
  return {};
}

export async function showStatus() {
  console.log("🔍 TokenShrinker Configuration Status");
  console.log("=====================================");

  // Check if config file exists
  if (!fs.existsSync(CONFIG_FILE)) {
    console.log("\n❌ No configuration found");
    console.log("💡 Use 'ai-token-optimizer setup <tool>' to configure tools");
    return;
  }

  const config = loadConfig();

  // Show configured tools
  if (config.setups && Object.keys(config.setups).length > 0) {
    console.log("\n✅ Configured Tools:");
    console.log("---------------------");

    for (const [toolKey, setup] of Object.entries(config.setups)) {
      console.log(`🔧 ${setup.name}`);
      console.log(`   📁 Config: ${setup.configPath}`);
      console.log(`   🌐 Proxy: ${setup.proxyUrl}`);
      console.log(`   📅 Added: ${new Date(setup.timestamp).toLocaleString()}`);

      // Check if config file still exists
      if (fs.existsSync(setup.configPath)) {
        console.log(`   ✅ Config file exists`);
      } else {
        console.log(`   ❌ Config file missing (run setup again)`);
      }
      console.log("");
    }
  } else {
    console.log("\n❌ No tools configured");
    console.log("💡 Use 'ai-token-optimizer setup <tool>' to configure tools");
  }

  // Show available tools
  console.log("🔧 Available Tools:");
  console.log("-------------------");
  console.log("• continue    - Continue.dev (VS Code extension)");
  console.log("• cline       - Cline (VS Code extension)");
  console.log("• aider       - Aider (command-line tool)");
  console.log("");

  // Show proxy server status
  console.log("🚀 Usage Modes:");
  console.log("----------------");
  console.log("1. Permanent Setup: Configure tools above, then start server:");
  console.log("   ai-token-optimizer start");
  console.log("   # Then use tools normally: code .");
  console.log("");
  console.log("2. Quick Wrapper: Run tools with proxy for single use:");
  console.log("   ai-token-optimizer run aider");
  console.log('   ai-token-optimizer run "npx some-ai-cli"');
  console.log("");

  // Show config location
  console.log("📁 Configuration Location:");
  console.log(`   ${CONFIG_FILE}`);

  // Usage tips
  console.log("\n💡 Tips:");
  console.log("• Make sure your .env file has API keys before starting server");
  console.log("• Proxy runs on http://localhost:4343");
  console.log(
    "• Use 'ai-token-optimizer cleanup' to remove all configurations"
  );
}
