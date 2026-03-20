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
import { jsonrepair } from "jsonrepair";

export interface NameSuggestion {
  name: string;
  tagline: string;
  explanation: string;
  score: number;
}

export interface GenerateNamesParams {
  stylePrompt: string;
  projectPrompt: string;
  excludeNames?: string[];
}

export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "done"; suggestions: NameSuggestion[] };

interface InternalGenerateNamesParams extends GenerateNamesParams {
  retryReason?: string;
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

/** @internal exported for unit testing */
export function buildPrompt(params: InternalGenerateNamesParams): string {
  const { stylePrompt, projectPrompt, excludeNames, retryReason } = params;
  const styleSection = stylePrompt
    ? `**Naming style preferences (apply to all suggestions):**\n${stylePrompt}\n\n`
    : "";
  const excludeSection =
    excludeNames && excludeNames.length > 0
      ? `**Previously shown names to avoid:**\n${excludeNames
          .map((name) => `- ${name}`)
          .join("\n")}\n\n`
      : "";
  const retrySection = retryReason
    ? `**Correction for this retry:**\n${retryReason}\n\n`
    : "";

  return `You are an expert brand naming consultant with 20 years of experience naming startups, products, and projects.

${styleSection}**Project to name:**
${projectPrompt}

${excludeSection}${retrySection}Generate exactly 6 unique, memorable name suggestions for this project.
Anchor every name to the project description itself: the user, workflow, problem, domain, or outcome should visibly influence the name.
Avoid generic AI/SaaS names that could fit a different product with no changes.
Do not reuse, remix, or closely imitate any previously shown names or their spelling variants.
${stylePrompt ? "Respect the naming style preferences above strictly." : ""}

Return ONLY a valid JSON object — no markdown, no explanation, no code fences:
{
  "suggestions": [
    {
      "name": "ExampleName",
      "tagline": "Short punchy tagline (max 6 words)",
      "explanation": "1-2 sentences on why this name fits this project description specifically.",
      "score": 92
    }
  ]
}

Score each name 1-100 based on how well it fits both the project description and the style preferences.`;
}

/** @internal exported for unit testing */
export function parseSuggestions(text: string): NameSuggestion[] {
  // Strip any <think>...</think> reasoning blocks (some models emit these)
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  const jsonText = stripped
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  let parsed: { suggestions: NameSuggestion[] };
  try {
    parsed = JSON.parse(jsonText) as { suggestions: NameSuggestion[] };
  } catch {
    parsed = JSON.parse(jsonrepair(jsonText)) as {
      suggestions: NameSuggestion[];
    };
  }

  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Invalid response format from AI provider");
  }

  return parsed.suggestions;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function removeCommonSuffixes(name: string): string {
  const stripped = name.replace(
    /(ings?|ers?|ors?|ly|ify|ive|io|ai|hq|labs?|app|x|e)$/g,
    ""
  );
  return stripped.length >= 4 ? stripped : name;
}

function buildSkeleton(name: string): string {
  if (!name) return "";
  return name[0] + name.slice(1).replace(/[aeiouy]/g, "");
}

export function areNamesTooSimilar(a: string, b: string): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);

  if (!left || !right) return false;
  if (left === right) return true;

  if (
    Math.abs(left.length - right.length) <= 2 &&
    (left.startsWith(right) || right.startsWith(left))
  ) {
    return true;
  }

  const leftBase = removeCommonSuffixes(left);
  const rightBase = removeCommonSuffixes(right);
  if (leftBase === rightBase && leftBase.length >= 4) {
    return true;
  }

  return (
    buildSkeleton(left) === buildSkeleton(right) &&
    Math.min(left.length, right.length) >= 5
  );
}

export function filterNameSuggestions(
  suggestions: NameSuggestion[],
  excludedNames: string[] = []
): NameSuggestion[] {
  const accepted: NameSuggestion[] = [];
  const seen = [...excludedNames];

  for (const suggestion of suggestions) {
    const name = suggestion.name?.trim();
    if (!name) continue;

    if (seen.some((existing) => areNamesTooSimilar(existing, name))) {
      continue;
    }

    accepted.push({ ...suggestion, name });
    seen.push(name);
  }

  return accepted;
}

async function generateNamesOnce(
  params: InternalGenerateNamesParams
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

// ─── Provider: claude-code ────────────────────────────────────────────────────

async function generateWithClaudeCode(
  params: InternalGenerateNamesParams
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
  params: InternalGenerateNamesParams
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
  params: InternalGenerateNamesParams
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
  params: InternalGenerateNamesParams
): Promise<NameSuggestion[]> {
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
  const deployment =
    process.env.AZURE_FOUNDRY_DEPLOYMENT || "Kimi-K2.5";
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
    max_tokens: 16000,
    messages: [{ role: "user", content: buildPrompt(params) }],
  });
  const choice = response.choices[0];
  console.log(`[azure-foundry] api call ms=${Date.now() - t0} finish_reason=${choice?.finish_reason} content_len=${choice?.message?.content?.length ?? 0}`);

  // DeepSeek-R1 puts reasoning in reasoning_content; final answer is in content
  const text = choice?.message?.content;
  if (!text) {
    const reasoning = (choice?.message as unknown as Record<string, unknown>)?.reasoning_content;
    throw new Error(
      `No content from Azure Foundry (finish_reason=${choice?.finish_reason}). ` +
      `reasoning_content length=${typeof reasoning === "string" ? reasoning.length : 0}. ` +
      `Increase max_tokens if reasoning is truncated.`
    );
  }
  return parseSuggestions(text);
}

async function* streamAzureFoundry(
  params: GenerateNamesParams
): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
  const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT;
  const deployment = process.env.AZURE_FOUNDRY_DEPLOYMENT || "Kimi-K2.5";
  const apiVersion = process.env.AZURE_FOUNDRY_API_VERSION || "2024-12-01-preview";

  if (!apiKey) throw new Error("LLM_PROVIDER=azure-foundry requires AZURE_FOUNDRY_API_KEY to be set");
  if (!endpoint) throw new Error("LLM_PROVIDER=azure-foundry requires AZURE_FOUNDRY_ENDPOINT to be set");

  console.log(`[azure-foundry-stream] endpoint=${endpoint} deployment=${deployment}`);

  const client = new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment });
  const t0 = Date.now();

  // Allow operators to tune token budget via env var; default raised to 8192 so
  // reasoning models have more headroom before producing output tokens.
  const maxTokens = parseInt(process.env.AZURE_FOUNDRY_STREAM_MAX_TOKENS ?? "8192", 10);

  const stream = await client.chat.completions.create({
    model: deployment,
    max_tokens: maxTokens,
    stream: true,
    messages: [{ role: "user", content: buildPrompt(params) }],
  });

  let fullText = "";
  let reasoningTokens = 0;
  let finishReason: string | null = null;
  let chunkCount = 0;
  let ttft: number | null = null; // time-to-first-token

  for await (const chunk of stream) {
    chunkCount++;
    if (ttft === null) {
      ttft = Date.now() - t0;
      console.log(`[azure-foundry-stream] first chunk ms=${ttft}`);
    }
    const choice = chunk.choices[0];
    const delta = choice?.delta?.content ?? "";
    // Reasoning models (DeepSeek-R1, Kimi-K2.5, etc.) stream thinking tokens
    // in reasoning_content; the final answer arrives in content.
    const reasoningDelta =
      (choice?.delta as unknown as Record<string, unknown>)
        ?.reasoning_content as string ?? "";

    if (finishReason === null && choice?.finish_reason) {
      finishReason = choice.finish_reason;
    }

    if (delta) {
      fullText += delta;
      yield { type: "token", text: delta };
    } else if (reasoningDelta) {
      // Still reasoning — yield an empty-text token so the route layer's
      // for-await loop keeps running and SSE heartbeats continue to flow.
      reasoningTokens += reasoningDelta.length;
      yield { type: "token", text: "" };
    }
  }

  console.log(
    `[azure-foundry-stream] done ms=${Date.now() - t0} ` +
    `ttft=${ttft ?? "never"} chunks=${chunkCount} finish_reason=${finishReason} ` +
    `content_len=${fullText.length} reasoning_chars=${reasoningTokens}`
  );

  if (!fullText) {
    // Streaming produced no content tokens. This can happen when the deployment
    // does not support streaming, when content filtering silently swallows the
    // response, or when all chunks contain only empty choices. Fall back to the
    // non-streaming call so the user still gets a result.
    console.warn(
      `[azure-foundry-stream] streaming produced no content ` +
      `(chunks=${chunkCount}, finish_reason=${finishReason}, ` +
      `reasoning_chars=${reasoningTokens}). Falling back to non-streaming call.`
    );
    const suggestions = await generateWithAzureFoundry(params);
    yield { type: "done", suggestions };
    return;
  }

  const suggestions = parseSuggestions(fullText);
  yield { type: "done", suggestions };
}

async function* streamAnthropicApi(
  params: GenerateNamesParams
): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("LLM_PROVIDER=anthropic-api requires ANTHROPIC_API_KEY to be set");

  const client = new Anthropic({ apiKey });
  const t0 = Date.now();

  const stream = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
    max_tokens: 2048,
    stream: true,
    messages: [{ role: "user", content: buildPrompt(params) }],
  });

  let fullText = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      const delta = event.delta.text;
      fullText += delta;
      yield { type: "token", text: delta };
    }
  }

  console.log(`[anthropic-stream] done ms=${Date.now() - t0} text_len=${fullText.length}`);
  const suggestions = parseSuggestions(fullText);
  yield { type: "done", suggestions };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateNames(
  params: GenerateNamesParams
): Promise<NameSuggestion[]> {
  let excludedNames = [...(params.excludeNames ?? [])];
  let accepted: NameSuggestion[] = [];
  let retryReason: string | undefined;

  for (let attempt = 0; attempt < 2 && accepted.length < 6; attempt++) {
    const batch = await generateNamesOnce({
      ...params,
      excludeNames: excludedNames,
      retryReason,
    });
    const filtered = filterNameSuggestions(batch, excludedNames);

    accepted = [...accepted, ...filtered].slice(0, 6);
    excludedNames = [...excludedNames, ...accepted.map((item) => item.name)];

    if (accepted.length < 6) {
      retryReason =
        "The previous response reused earlier names or near-duplicate variants. " +
        "Return only fresh replacements that connect more directly to the project description.";
    }
  }

  return accepted;
}

/**
 * Streaming variant of generateNames.
 *
 * Yields { type: "token", text } events for each streamed token (azure-foundry
 * and anthropic-api), then a final { type: "done", suggestions } event.
 * For providers that don't support native streaming (claude-code, ollama), it
 * falls through to the regular blocking call and only emits the "done" event.
 * The route layer injects periodic SSE heartbeats between events so the
 * platform never sees an idle connection.
 */
export async function* generateNamesStream(
  params: GenerateNamesParams
): AsyncGenerator<StreamEvent> {
  const provider = (process.env.LLM_PROVIDER || "claude-code").toLowerCase();

  switch (provider) {
    case "azure-foundry":
      yield* streamAzureFoundry(params);
      break;
    case "anthropic-api":
      yield* streamAnthropicApi(params);
      break;
    default: {
      // claude-code, ollama — no native streaming; run blocking and return done
      const suggestions = await generateNames(params);
      yield { type: "done", suggestions };
    }
  }
}
