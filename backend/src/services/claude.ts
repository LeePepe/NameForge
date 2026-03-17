import { query } from "@anthropic-ai/claude-agent-sdk";

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

export async function generateNames(
  params: GenerateNamesParams
): Promise<NameSuggestion[]> {
  const { stylePrompt, projectPrompt } = params;

  const styleSection = stylePrompt
    ? `**Naming style preferences (apply to all suggestions):**\n${stylePrompt}\n\n`
    : "";

  const prompt = `You are an expert brand naming consultant with 20 years of experience naming startups, products, and projects.

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

  let resultText = "";

  for await (const message of query({ prompt })) {
    if ("result" in message && typeof message.result === "string") {
      resultText = message.result;
    }
  }

  if (!resultText) {
    throw new Error("No response from Claude");
  }

  const jsonText = resultText
    .trim()
    .replace(/^```(?:json)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  const parsed = JSON.parse(jsonText) as { suggestions: NameSuggestion[] };

  if (!Array.isArray(parsed.suggestions)) {
    throw new Error("Invalid response format from Claude");
  }

  return parsed.suggestions;
}
