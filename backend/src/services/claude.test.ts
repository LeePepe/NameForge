import { describe, it, expect } from "vitest";
import {
  parseSuggestions,
  buildPrompt,
  filterNameSuggestions,
} from "./claude";

// ── helpers ──────────────────────────────────────────────────────────────────

const VALID_SUGGESTION = {
  name: "TestName",
  tagline: "A short tagline",
  explanation: "Why this fits.",
  score: 85,
};

function makeJson(suggestions: unknown[] = [VALID_SUGGESTION]): string {
  return JSON.stringify({ suggestions });
}

// ── parseSuggestions ─────────────────────────────────────────────────────────

describe("parseSuggestions", () => {
  it("parses valid JSON", () => {
    const result = parseSuggestions(makeJson());
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("TestName");
  });

  it("strips single-line <think> block", () => {
    const input = `<think>some reasoning</think>${makeJson()}`;
    const result = parseSuggestions(input);
    expect(result[0].name).toBe("TestName");
  });

  it("strips multi-line <think> block", () => {
    const input = `<think>\nline one\nline two\n</think>\n${makeJson()}`;
    const result = parseSuggestions(input);
    expect(result[0].name).toBe("TestName");
  });

  it("strips ```json code fence", () => {
    const input = "```json\n" + makeJson() + "\n```";
    const result = parseSuggestions(input);
    expect(result[0].name).toBe("TestName");
  });

  it("strips plain ``` code fence", () => {
    const input = "```\n" + makeJson() + "\n```";
    const result = parseSuggestions(input);
    expect(result[0].name).toBe("TestName");
  });

  it("strips <think> block AND code fence together", () => {
    const input = "<think>reasoning</think>\n```json\n" + makeJson() + "\n```";
    const result = parseSuggestions(input);
    expect(result[0].name).toBe("TestName");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseSuggestions("not json")).toThrow();
  });

  it("repairs common LLM JSON with unescaped quotes inside strings", () => {
    const input =
      '{"suggestions":[{"name":"TestName","tagline":"A short tagline","explanation":"He said "hello" today.","score":85}]}';
    const result = parseSuggestions(input);
    expect(result[0].explanation).toBe('He said "hello" today.');
  });

  it("throws when suggestions is not an array", () => {
    const bad = JSON.stringify({ suggestions: "oops" });
    expect(() => parseSuggestions(bad)).toThrow("Invalid response format");
  });

  it("throws when suggestions key is missing", () => {
    const bad = JSON.stringify({ names: [] });
    expect(() => parseSuggestions(bad)).toThrow("Invalid response format");
  });

  it("handles multiple suggestions", () => {
    const two = [VALID_SUGGESTION, { ...VALID_SUGGESTION, name: "Two" }];
    const result = parseSuggestions(makeJson(two));
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe("Two");
  });
});

// ── buildPrompt ───────────────────────────────────────────────────────────────

describe("buildPrompt", () => {
  const base = { projectPrompt: "A task management app", stylePrompt: "" };

  it("contains the projectPrompt", () => {
    const prompt = buildPrompt(base);
    expect(prompt).toContain("A task management app");
  });

  it("includes style section when stylePrompt is provided", () => {
    const prompt = buildPrompt({ ...base, stylePrompt: "Short, punchy names" });
    expect(prompt).toContain("Short, punchy names");
    expect(prompt).toContain("Naming style preferences");
  });

  it("omits style section when stylePrompt is empty", () => {
    const prompt = buildPrompt(base);
    expect(prompt).not.toContain("Naming style preferences");
  });

  it("always asks for exactly 6 suggestions", () => {
    const prompt = buildPrompt(base);
    expect(prompt).toContain("6");
  });

  it("requests JSON output", () => {
    const prompt = buildPrompt(base);
    expect(prompt).toContain("JSON");
  });

  it("includes excluded names and project-grounding rules", () => {
    const prompt = buildPrompt({
      ...base,
      excludeNames: ["Notiv", "Memox"],
    });
    expect(prompt).toContain("Notiv");
    expect(prompt).toContain("Memox");
    expect(prompt).toContain("project description");
    expect(prompt).toContain("Do not reuse");
  });
});

describe("filterNameSuggestions", () => {
  it("filters exact and near-duplicate names against history and current batch", () => {
    const suggestions = [
      { ...VALID_SUGGESTION, name: "Notiv" },
      { ...VALID_SUGGESTION, name: "Notive" },
      { ...VALID_SUGGESTION, name: "MemoX" },
      { ...VALID_SUGGESTION, name: "ProjectMint" },
    ];

    const result = filterNameSuggestions(suggestions, ["Memox"]);

    expect(result.map((item) => item.name)).toEqual(["Notiv", "ProjectMint"]);
  });
});
