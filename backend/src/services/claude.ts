/**
 * AI Provider abstraction for NameForge.
 *
 * Controlled by the LLM_PROVIDER environment variable:
 *   claude-code   (default) — uses @anthropic-ai/claude-agent-sdk, runs inside
 *                             a Claude Code session (local dev)
 *   anthropic-api           — uses @anthropic-ai/sdk directly with ANTHROPIC_API_KEY
 *                             (cloud deployment)
 *   ollama                  — calls a local Ollama instance via its OpenAI-compatible
 *                             HTTP API (fully local, no API key required)
 *   azure-foundry           — calls Azure AI Foundry (Cognitive Services) via the
 *                             OpenAI-compatible API using AZURE_FOUNDRY_API_KEY,
 *                             AZURE_FOUNDRY_ENDPOINT, and AZURE_FOUNDRY_DEPLOYMENT
 */

import Anthropic from "@anthropic-ai/sdk";
import { AzureOpenAI } from "openai";

export interface NameSuggestion {
  name: string;
  tagline: string;
  explanation: string;
  score: number;
}

export interface GenerateNamesParams {
  stylePrompt: string;
  projectPrompt: string;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(params: GenerateNamesParams): string {
  const { stylePrompt, projectPrompt } = params;
  const styleSection = stylePrompt
    ? `**Naming style preferences (apply to all suggestions):**\n${stylePrompt}\n\n`
    : "";

  return `You are an expert brand naming consultant with 20 years of experience naming startups, products, and projects.

${styleSection}**Project to name:**
${projectPrompt}

Generate exactly 6 unique, memorable name suggestions for this project.
${stylePrompt ? "Respect the naming style preferences above strictly." : ""}

Return ONLY a valid JSON object — no markdown, no explanation, no code fences:
{
  "suggestions": [
    {
      "name": "ExampleName",
      "tagline": "Short punchy tagline (max 6 words)",
      "explanation": "1-2 sentences on why this name fits.",
      "score": 92
    }
  ]
}

Score each name 1-100 based on how well it fits both the project and the style preferences.`;
}

function parseSuggestions(text: string): NameSuggestion[] {
  // Strip DeepSeek-style <think>...</think> reasoning blocks
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  const jsonText = stripped
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const parsed = JSON.parse(jsonText) as { suggestions: NameSuggestion[] };

  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Invalid response format from AI provider");
  }

  return parsed.suggestions;
}

// ─── Provider: claude-code ────────────────────────────────────────────────────

async function generateWithClaudeCode(
  params: GenerateNamesParams
): Promise<NameSuggestion[]> {
  // Dynamically imported so the server still starts even if this SDK is not
  // installed (e.g. in a cloud deployment that only has @anthropic-ai/sdk).
  const { query } = await import("@anthropic-ai/claude-agent-sdk").catch(() => {
    throw new Error(
      "LLM_PROVIDER=claude-code requires @anthropic-ai/claude-agent-sdk. " +
        "Run: npm install @anthropic-ai/claude-agent-sdk --workspace=backend"
    );
  });

  let resultText = "";
  for await (const message of query({ prompt: buildPrompt(params) })) {
    if ("result" in message && typeof message.result === "string") {
      resultText = message.result;
    }
  }

  if (!resultText) throw new Error("No response from Claude Code");
  return parseSuggestions(resultText);
}

// ─── Provider: anthropic-api ──────────────────────────────────────────────────

async function generateWithAnthropicApi(
  params: GenerateNamesParams
): Promise<NameSuggestion[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "LLM_PROVIDER=anthropic-api requires ANTHROPIC_API_KEY to be set"
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: buildPrompt(params) }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return parseSuggestions(block.text);
}

// ─── Provider: ollama ─────────────────────────────────────────────────────────

async function generateWithOllama(
  params: GenerateNamesParams
): Promise<NameSuggestion[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2";

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "user", content: buildPrompt(params) }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    message?: { content?: string };
  };

  const text = data?.message?.content;
  if (!text) throw new Error("No response from Ollama");
  return parseSuggestions(text);
}

// ─── Provider: azure-foundry ──────────────────────────────────────────────────

async function generateWithAzureFoundry(
  params: GenerateNamesParams
): Promise<NameSuggestion[]> {
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
  const deployment =
    process.env.AZURE_FOUNDRY_DEPLOYMENT || "gpt-4.1-mini";
  const apiVersion =
    process.env.AZURE_FOUNDRY_API_VERSION || "2024-12-01-preview";

  if (!apiKey) {
    throw new Error(
      "LLM_PROVIDER=azure-foundry requires AZURE_FOUNDRY_API_KEY to be set"
    );
  }
  if (!endpoint) {
    throw new Error(
      "LLM_PROVIDER=azure-foundry requires AZURE_FOUNDRY_ENDPOINT to be set"
    );
  }

  console.log(`[azure-foundry] endpoint=${endpoint} deployment=${deployment} apiVersion=${apiVersion}`);

  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });

  const t0 = Date.now();
  const response = await client.chat.completions.create({
    model: deployment,
    max_tokens: 1024,
    messages: [{ role: "user", content: buildPrompt(params) }],
  });
  console.log(`[azure-foundry] api call ms=${Date.now() - t0} finish_reason=${response.choices[0]?.finish_reason}`);

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("No response from Azure Foundry");
  return parseSuggestions(text);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateNames(
  params: GenerateNamesParams
): Promise<NameSuggestion[]> {
  const provider = (process.env.LLM_PROVIDER || "claude-code").toLowerCase();

  switch (provider) {
    case "claude-code":
      return generateWithClaudeCode(params);
    case "anthropic-api":
      return generateWithAnthropicApi(params);
    case "ollama":
      return generateWithOllama(params);
    case "azure-foundry":
      return generateWithAzureFoundry(params);
    default:
      throw new Error(
        `Unknown LLM_PROVIDER: "${provider}". ` +
          `Valid values: claude-code, anthropic-api, ollama, azure-foundry`
      );
  }
}
