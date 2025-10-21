// src/optimizeText.js
import OpenAI from "openai";
import fs from "fs-extra";
import path from "path";
import { getRepoSummary } from "./getRepoSummary.js";

/**
 * Get AI client instance for the specified provider
 */
function getAIClient() {
  // Default to openrouter if not specified, but check user-preferred provider first
  const provider =
    (
      process.env.USER_PREFERRED_PROVIDER || process.env.AI_PROVIDER
    )?.toLowerCase() || "openrouter";

  console.log("🔍 [optimizeText] AI Provider:", provider);
  console.log("🔍 [optimizeText] process.cwd():", process.cwd());

  switch (provider) {
    case "openrouter":
      return getOpenRouterClient();
    case "openai":
      return getOpenAIClient();
    case "anthropic":
      return getAnthropicClient();
    case "ollama":
      return getOllamaClient();
    default:
      console.warn(
        `⚠️ Unknown provider '${provider}', falling back to openrouter`
      );
      return getOpenRouterClient();
  }
}

function getOpenRouterClient() {
  const apiKey =
    process.env.USER_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.AI_API_KEY;
  const model =
    process.env.OPENROUTER_MODEL ||
    process.env.AI_MODEL ||
    "meta-llama/llama-4-maverick:free";

  console.log("🔍 [openrouter] API key exists:", !!apiKey);
  console.log("🔍 [openrouter] Model:", model);

  if (!apiKey) {
    throw new Error(
      "No OpenRouter API key found. Set OPENROUTER_API_KEY or AI_API_KEY in your .env file"
    );
  }

  return {
    provider: "openrouter",
    client: new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" }),
    model,
    makeRequest: makeOpenAIRequest,
  };
}

function getOpenAIClient() {
  const apiKey =
    process.env.USER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.AI_API_KEY;
  const model =
    process.env.OPENAI_MODEL || process.env.AI_MODEL || "gpt-4o-mini";

  console.log("🔍 [openai] API key exists:", !!apiKey);
  console.log("🔍 [openai] Model:", model);

  if (!apiKey) {
    throw new Error(
      "No OpenAI API key found. Set OPENAI_API_KEY or AI_API_KEY in your .env file"
    );
  }

  return {
    provider: "openai",
    client: new OpenAI({ apiKey }),
    model,
    makeRequest: makeOpenAIRequest,
  };
}

function getAnthropicClient() {
  const apiKey =
    process.env.USER_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.AI_API_KEY;
  const model =
    process.env.ANTHROPIC_MODEL ||
    process.env.AI_MODEL ||
    "claude-3-haiku-20240307";

  console.log("🔍 [anthropic] API key exists:", !!apiKey);
  console.log("🔍 [anthropic] Model:", model);

  if (!apiKey) {
    throw new Error(
      "No Anthropic API key found. Set ANTHROPIC_API_KEY or AI_API_KEY in your .env file"
    );
  }

  return {
    provider: "anthropic",
    key: apiKey,
    model,
    makeRequest: makeAnthropicRequest,
  };
}

function getOllamaClient() {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || process.env.AI_MODEL || "llama2";

  console.log("🔍 [ollama] Base URL:", baseUrl);
  console.log("🔍 [ollama] Model:", model);

  return {
    provider: "ollama",
    baseUrl,
    model,
    makeRequest: makeOllamaRequest,
  };
}

async function makeOpenAIRequest(client, model, messages, maxTokens) {
  return await client.chat.completions.create({
    model: model,
    messages: messages,
    max_tokens: maxTokens,
    temperature: 0.3,
  });
}

async function makeAnthropicRequest(
  clientConfig,
  model,
  systemMessage,
  userMessage,
  maxTokens
) {
  // For now, we'll use OpenAI-compatible format since we're using OpenAI library
  // In a full implementation, this would use the official Anthropic SDK
  const { key } = clientConfig;
  const openaiCompatible = new OpenAI({
    apiKey: key,
    baseURL: "https://api.anthropic.com/v1/messages",
    // This is a simplified approximation - would need proper Anthropic SDK
  });

  return await openaiCompatible.chat.completions.create({
    model: model,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
    max_tokens: maxTokens,
    temperature: 0.3,
  });
}

async function makeOllamaRequest(clientConfig, model, messages) {
  // Simplified Ollama integration - would need proper Ollama API calls
  throw new Error(
    "Ollama integration not fully implemented yet. Please use openrouter, openai, or anthropic for now."
  );
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
    const aiClient = getAIClient();
    // Calculate appropriate max_tokens based on input length
    // Target: 50% compression for large text, minimum 20 tokens
    const inputTokens = Math.ceil(input.length / 4);
    const targetTokens = Math.max(20, Math.floor(inputTokens * 0.5));

    console.log("🔧 Making completion request...");
    console.log("🔧 Provider:", aiClient.provider);
    console.log("🔧 Target tokens:", targetTokens);
    console.log("🔧 Input length:", input.length, "chars");

    let completion;

    if (aiClient.provider === "anthropic") {
      // Anthropic has a different message format
      completion = await aiClient.makeRequest(
        aiClient,
        aiClient.model,
        "You are a text compression expert. Your ONLY job is to compress the text to be as SHORT as possible while keeping the core meaning. Rules: 1) Remove filler words 2) Use abbreviations 3) Be extremely concise 4) NO explanations 5) Output ONLY the compressed version, nothing else.",
        `Compress this to maximum ${targetTokens} tokens:\n\n${input}`,
        targetTokens
      );
    } else {
      // OpenRouter/OpenAI use standard message format
      completion = await aiClient.makeRequest(
        aiClient.client,
        aiClient.model,
        [
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
        targetTokens
      );
    }

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
      provider: aiClient.provider,
      model: aiClient.model,
    };
  } catch (err) {
    return { error: err.message };
  }
}
