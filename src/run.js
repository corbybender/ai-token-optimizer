import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.join(__dirname, "..");

export async function run(commandString) {
  if (!commandString) {
    console.log("Error: Please provide a command to run");
    console.log("Example: ai-token-optimizer run aider");
    console.log('Example: ai-token-optimizer run "npm start"');
    return;
  }

  let proxyProcess = null;

  try {
    console.log("🚀 Starting TokenShrinker proxy server...");
    console.log(`📝 Command to run: ${commandString}`);

    // Start the proxy server in background
    proxyProcess = spawn(
      process.execPath,
      [path.join(packageRoot, "src", "server.js")],
      {
        stdio: ["pipe", "pipe", "pipe"],
        detached: true,
        env: {
          ...process.env,
          // Add any additional environment setup here if needed
        },
      }
    );

    // Wait for server to start (give it a moment)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if server is actually running by trying to connect
    // For now, we'll assume it started successfully if no immediate error

    console.log("✅ Proxy server started on http://localhost:4343");

    // Set environment variables for the command to use proxy
    const envWithProxy = {
      ...process.env,
      // Set proxy environment variables (these are commonly used by tools)
      HTTP_PROXY: "http://localhost:4343",
      HTTPS_PROXY: "http://localhost:4343",
      OPENAI_API_BASE: "http://localhost:4343/v1/chat/completions", // For OpenAI-compatible tools
      ANTHROPIC_API_BASE: "http://localhost:4343", // For Anthropic tools
      // Also set specific ones that might be used
      OPENROUTER_API_BASE: "http://localhost:4343",
    };

    console.log(`🎯 Running command with proxy enabled: ${commandString}`);
    console.log(`🌐 Proxy endpoints available at:`);
    console.log(
      `   - OpenAI-compatible: http://localhost:4343/v1/chat/completions`
    );
    console.log(`   - Anthropic-compatible: http://localhost:4343/v1/messages`);

    // Split command string into command and args
    // Simple parsing - can be enhanced for complex commands
    let cmd, args;
    if (process.platform === "win32") {
      // On Windows, use cmd to parse complex commands
      cmd = "cmd";
      args = ["/c", commandString];
    } else {
      // On Unix-like systems, split on spaces for simple commands
      // More complex parsing could be added here
      const tokens = commandString.split(/\s+/);
      cmd = tokens[0];
      args = tokens.slice(1);
    }

    // Execute the command with proxy environment
    const childProcess = spawn(cmd, args, {
      stdio: "inherit",
      cwd: process.cwd(),
      env: envWithProxy,
    });

    // Handle process termination
    const cleanup = () => {
      if (proxyProcess) {
        console.log("\n🛑 Stopping proxy server...");
        try {
          if (process.platform === "win32") {
            spawn("taskkill", ["/PID", proxyProcess.pid.toString(), "/F"], {
              stdio: "ignore",
            });
          } else {
            proxyProcess.kill("SIGTERM");
          }
        } catch (err) {
          console.warn("Warning: Could not stop proxy server gracefully");
        }
      }
    };

    // Set up cleanup handlers
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Wait for the command to finish
    await new Promise((resolve, reject) => {
      childProcess.on("close", (code) => {
        if (code === 0) {
          console.log(`✅ Command completed successfully`);
          resolve();
        } else {
          console.log(`❌ Command exited with code ${code}`);
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      childProcess.on("error", (err) => {
        console.error(`❌ Error running command: ${err.message}`);
        reject(err);
      });
    });
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    // Always clean up proxy server
    if (proxyProcess) {
      try {
        console.log("🛑 Cleaning up...");
        if (process.platform === "win32") {
          spawn("taskkill", ["/PID", proxyProcess.pid.toString(), "/F"], {
            stdio: "ignore",
          });
        } else {
          process.kill(-proxyProcess.pid, "SIGTERM");
        }
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  }
}
