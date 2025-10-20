// src/optimizeText.js
import OpenAI from "openai";
import fs from "fs-extra";
import path from "path";
import { getRepoSummary } from "./getRepoSummary.js";

/**
 * Get OpenAI client instance (lazy initialization)
 */
function getOpenAIClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  console.log("🔍 [optimizeText] Checking for API key...");
  console.log("🔍 [optimizeText] API key exists:", !!apiKey);
  console.log("🔍 [optimizeText] API key length:", apiKey ? apiKey.length : 0);
  console.log(
    "🔍 [optimizeText] Current model:",
    process.env.OPENROUTER_MODEL || "meta-llama/llama-4-maverick:free"
  );
  console.log("🔍 [optimizeText] process.cwd():", process.cwd());

  if (!apiKey) {
    throw new Error(
      "No API key found. Please create a .env file in your project root with OPENROUTER_API_KEY=your-key-here"
    );
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

/**
 * Optimize text by summarizing with AI
 * Automatically includes all repo summaries to reduce token usage
 * @param {string} input - text to summarize
 * @returns {Promise<Object>} - { summary, original_length }
 */
export async function optimizeText(input) {
  if (typeof input !== "string") return { error: "Unsupported input type" };

  try {
    const openai = getOpenAIClient();
    // Calculate appropriate max_tokens based on input length
    // Target: 50% compression for large text, minimum 20 tokens
    const inputTokens = Math.ceil(input.length / 4);
    const targetTokens = Math.max(20, Math.floor(inputTokens * 0.5));

    console.log("🔧 Making completion request...");
    console.log("🔧 Target tokens:", targetTokens);
    console.log("🔧 Input length:", input.length, "chars");

    const completion = await openai.chat.completions.create({
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-4-maverick:free",
      messages: [
        {
          role: "system",
          content:
            "You are a text compression expert. Your ONLY job is to compress the text to be as SHORT as possible while keeping the core meaning. Rules: 1) Remove filler words 2) Use abbreviations 3) Be extremely concise 4) NO explanations 5) Output ONLY the compressed version, nothing else.",
        },
        {
          role: "user",
          content: `Compress this to maximum ${targetTokens} tokens:\n\n${input}`,
        },
      ],
      max_tokens: targetTokens,
      temperature: 0.3, // Lower temperature for more focused output
    });

    console.log("✅ Completion received");
    console.log("✅ Choices count:", completion.choices?.length);

    if (!completion.choices || completion.choices.length === 0) {
      console.error("❌ No choices in completion response");
      return { error: "No response choices from AI" };
    }

    const firstChoice = completion.choices[0];
    console.log("✅ First choice finish_reason:", firstChoice.finish_reason);

    if (!firstChoice.message) {
      console.error("❌ No message in first choice");
      console.log("❌ Choice structure:", JSON.stringify(firstChoice, null, 2));
      return { error: "No message in AI response" };
    }

    const summary = firstChoice.message.content?.trim();
    console.log("✅ Summary content:", summary ? "present" : "undefined/empty");
    console.log("✅ Summary length:", summary?.length || "undefined");

    if (!summary || summary.length === 0) {
      console.error("❌ Empty or undefined summary content");
      return { error: "AI returned empty summary" };
    }

    return {
      summary: summary,
      original_length: input.length,
      compressed_length: summary.length,
      compression_ratio:
        ((1 - summary.length / input.length) * 100).toFixed(1) + "%",
    };
  } catch (err) {
    return { error: err.message };
  }
}
