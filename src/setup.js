import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".ai-token-optimizer");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Load current configuration
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch (err) {
    console.warn("Warning: Could not load config file, starting fresh");
  }
  return {};
}

// Save configuration
function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Tool configurations mapping - ALL use OpenRouter via OpenAI-compatible API for FREE models
const TOOL_CONFIGS = {
  continue: {
    name: "Continue.dev",
    configPath: path.join(os.homedir(), ".continue", "config.json"),
    proxyUrl: "http://localhost:4343/v1/chat/completions",
    setupInstructions:
      "Point Continue.dev to use OpenAI-compatible API through OpenRouter for free models",
    config: {
      models: [
        {
          title: "OpenRouter Free Models (Optimized)",
          provider: "openai",
          model: "gpt-4o",
          apiKey: "placeholder", // Real API key will be forwarded by proxy
          apiBase: "http://localhost:4343/v1/chat/completions",
        },
      ],
    },
  },
  cline: {
    name: "Cline",
    configPath: path.join(os.homedir(), ".cline", "config.json"),
    proxyUrl: "http://localhost:4343/v1/chat/completions",
    setupInstructions:
      "Configure Cline to use OpenAI-compatible API instead of Anthropic for free models",
    config: {
      api: {
        provider: "openai",
        baseUrl: "http://localhost:4343/v1/chat/completions",
        apiKey: "placeholder",
      },
    },
  },
  aider: {
    name: "Aider",
    configPath: path.join(os.homedir(), ".aider.conf.yml"),
    proxyUrl: "http://localhost:4343/v1/chat/completions",
    setupInstructions:
      "Aider uses OpenAI-compatible API for token optimization",
    config: `# Aider configuration optimized for token reduction (FREE OpenRouter models)
model: gpt-4-turbo-preview
api-base: http://localhost:4343/v1/chat/completions
# Your actual OpenAI API key will be forwarded through the proxy
api-key: placeholder
`,
  },
};

export async function setup(tool) {
  if (!tool) {
    console.log("Error: Please specify a tool to setup");
    console.log("Available tools: continue, cline, aider");
    console.log("Example: ai-token-optimizer setup continue");
    return;
  }

  const toolConfig = TOOL_CONFIGS[tool.toLowerCase()];
  if (!toolConfig) {
    console.log(`Error: Unknown tool '${tool}'`);
    console.log("Available tools: continue, cline, aider");
    return;
  }

  const config = loadConfig();

  try {
    console.log(
      `🔧 Setting up ${toolConfig.name} to use TokenShrinker proxy...`
    );

    // Check if config file exists
    if (!fs.existsSync(toolConfig.configPath)) {
      console.log(`📝 Creating new config file: ${toolConfig.configPath}`);
      const parentDir = path.dirname(toolConfig.configPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
    } else {
      console.log(`📝 Updating existing config file: ${toolConfig.configPath}`);
    }

    // Write the configuration
    if (toolConfig.configPath.endsWith(".json")) {
      // JSON configuration
      let existingConfig = {};
      try {
        if (fs.existsSync(toolConfig.configPath)) {
          existingConfig = JSON.parse(
            fs.readFileSync(toolConfig.configPath, "utf8")
          );
        }
      } catch (err) {
        console.warn(
          `Warning: Could not parse existing config, creating new one`
        );
      }

      // Merge configurations based on tool type
      let finalConfig = existingConfig;
      if (tool === "continue") {
        finalConfig.models = finalConfig.models || [];
        // Add optimized model at the beginning
        finalConfig.models.unshift(toolConfig.config.models[0]);
      } else if (tool === "cline") {
        // REPLACE entire api config (not merge) to ensure we use OpenRouter
        finalConfig.api = toolConfig.config.api;
      }

      fs.writeFileSync(
        toolConfig.configPath,
        JSON.stringify(finalConfig, null, 2)
      );
    } else if (
      toolConfig.configPath.endsWith(".yml") ||
      toolConfig.configPath.endsWith(".yaml")
    ) {
      // YAML configuration
      fs.writeFileSync(toolConfig.configPath, toolConfig.config);
    }

    // Update our tracking config
    config.setups = config.setups || {};
    config.setups[tool.toLowerCase()] = {
      name: toolConfig.name,
      configPath: toolConfig.configPath,
      proxyUrl: toolConfig.proxyUrl,
      timestamp: new Date().toISOString(),
    };
    saveConfig(config);

    console.log(`✅ ${toolConfig.name} configured successfully!`);
    console.log(`📍 Configuration saved to: ${toolConfig.configPath}`);
    console.log(`🌐 Proxy URL: ${toolConfig.proxyUrl}`);
    console.log(
      `\n🚀 You can now use ${toolConfig.name} normally - it will automatically use TokenShrinker`
    );
    console.log(
      `💡 Note: Make sure to start the TokenShrinker server with 'ai-token-optimizer' or 'ai-token-optimizer start'`
    );
  } catch (err) {
    console.error(`❌ Error setting up ${toolConfig.name}:`, err.message);
    console.log(`\n🔧 Manual setup instructions:`);
    console.log(`1. Edit ${toolConfig.configPath}`);
    console.log(`2. Configure it to use: ${toolConfig.proxyUrl}`);
    console.log(`3. Start TokenShrinker server`);
  }
}

export { TOOL_CONFIGS };
