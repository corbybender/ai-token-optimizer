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

export async function cleanup() {
  console.log("🧹 Starting cleanup of TokenShrinker configurations...");
  console.log("==================================================");

  // Check if config directory exists
  if (!fs.existsSync(CONFIG_DIR)) {
    console.log("✅ No configuration directory found - already clean!");
    return;
  }

  const config = loadConfig();
  let cleanedCount = 0;

  // Remove each configured tool's config file
  if (config.setups && Object.keys(config.setups).length > 0) {
    console.log("\n🔧 Removing tool configurations:");

    for (const [toolKey, setup] of Object.entries(config.setups)) {
      console.log(`\n📝 Processing ${setup.name}...`);

      try {
        if (fs.existsSync(setup.configPath)) {
          // For JSON files, we need to carefully remove our modifications
          if (setup.configPath.endsWith(".json")) {
            console.log(`   🔄 Reverting ${setup.configPath}...`);
            await revertJsonConfig(setup.configPath, toolKey, setup);
          } else {
            // For other files (like YAML), remove them completely
            console.log(`   🗑️  Removing ${setup.configPath}...`);
            fs.unlinkSync(setup.configPath);
          }
          console.log(`   ✅ Removed`);
          cleanedCount++;
        } else {
          console.log(`   ⚠️  Config file not found: ${setup.configPath}`);
        }
      } catch (err) {
        console.log(`   ❌ Error removing config: ${err.message}`);
      }
    }
  } else {
    console.log("✅ No tool configurations found");
  }

  // Remove our tracking config file
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE);
      console.log("\n🗑️  Removed tracking configuration");
      cleanedCount++;
    }
  } catch (err) {
    console.log(`\n❌ Error removing tracking config: ${err.message}`);
  }

  // Try to remove config directory if empty
  try {
    if (fs.existsSync(CONFIG_DIR) && fs.readdirSync(CONFIG_DIR).length === 0) {
      fs.rmdirSync(CONFIG_DIR);
      console.log("🗑️  Removed configuration directory");
    }
  } catch (err) {
    // Directory not empty or other error, ignore
  }

  console.log("\n" + "=".repeat(50));
  if (cleanedCount > 0) {
    console.log(
      `✅ Cleanup completed! Removed ${cleanedCount} configuration item(s)`
    );
  } else {
    console.log("✅ Cleanup completed! No configurations to remove");
  }

  console.log("\n💡 To set up tools again:");
  console.log("   ai-token-optimizer setup continue");
  console.log("   ai-token-optimizer setup cline");
  console.log("   ai-token-optimizer setup aider");
}

async function revertJsonConfig(configPath, toolKey, setup) {
  try {
    // Read the current config
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    }

    // Remove our modifications
    if (toolKey === "continue") {
      if (config.models && Array.isArray(config.models)) {
        // Remove the optimized model we added (check by title)
        config.models = config.models.filter(
          (model) => model.title !== "Optimized Local Proxy"
        );
      }
    } else if (toolKey === "cline") {
      // For Cline, we might have modified the api section
      // This is a simple revert - could be enhanced for more sophisticated reversion
      if (config.api) {
        delete config.api.provider;
        delete config.api.baseUrl;
        delete config.api.headers;
      }
    }

    // Write back the reverted config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (err) {
    console.warn(
      `Warning: Could not revert ${configPath}, removing file instead: ${err.message}`
    );
    fs.unlinkSync(configPath);
  }
}
