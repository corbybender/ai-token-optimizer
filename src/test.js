// src/test.js
import "dotenv/config"; // Load .env file first
import OpenAI from "openai";
import fs from "fs-extra";
import path from "path";
import { getRepoSummary } from "./getRepoSummary.js";

// Load OpenRouter API key
const apiKey =
  process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY_FREE_ONLY;

if (!apiKey) {
  console.error("ERROR: No API key found in environment variables!");
  console.error(
    "Please set OPENROUTER_API_KEY or OPENROUTER_API_KEY_FREE_ONLY in your .env file"
  );
}

const openai = new OpenAI({
  apiKey,
  baseURL: "https://openrouter.ai/api/v1",
});

/**
 * Optimize text by summarizing with AI
 * Automatically includes all repo summaries to reduce token usage
 * @param {string} input - text to summarize
 * @returns {Promise<Object>} - { summary, original_length }
 */
export async function optimizeText(input) {
  if (typeof input !== "string") return { error: "Unsupported input type" };

  try {
    // Load all current repo summaries
    const repoContext = await getRepoSummary();

    // Combine input with repo context
    const combinedText = `${input}\n\nRepo context:\n${repoContext}`;

    const completion = await openai.chat.completions.create({
      model: "meta-llama/llama-4-maverick:free",
      messages: [
        {
          role: "system",
          content:
            "Summarize this text concisely to minimize token usage while preserving intent. Incorporate relevant context from the repository.",
        },
        { role: "user", content: combinedText },
      ],
      max_tokens: 100,
    });

    return {
      summary: completion.choices[0].message.content,
      original_length: input.length,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// Run test when this file is executed directly (not imported)
// Check if argv[1] contains 'test.js'
const isMainModule = process.argv[1]?.includes("test.js");

if (isMainModule) {
  console.log("Testing optimizeText function...\n");
  console.log(
    "API Key loaded:",
    apiKey ? "Yes (length: " + apiKey.length + ")" : "No"
  );
  console.log("Base URL:", "https://openrouter.ai/api/v1");

  const testInput =
    "This is a test message to see if the API integration works correctly with the repository context.";

  console.log("\nCalling optimizeText...");
  optimizeText(testInput)
    .then((result) => {
      console.log("\nTest Result:");
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("\nTest failed:");
      console.error(err);
      process.exit(1);
    });
}
