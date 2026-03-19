import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Mock the claude service before importing the router ───────────────────────
vi.mock("../services/claude", () => ({
  generateNames: vi.fn(),
  generateNamesStream: vi.fn(),
}));

import { generateNames, generateNamesStream } from "../services/claude";
import namesRouter from "./names";

const app = express();
app.use(express.json());
app.use("/api", namesRouter);

const VALID_BODY = {
  projectPrompt: "A project management tool for remote teams",
  stylePrompt: "",
};

const MOCK_SUGGESTION = {
  name: "TeamForge",
  tagline: "Built for remote work",
  explanation: "Combines team and forge.",
  score: 88,
};

// ── POST /api/generate-names ──────────────────────────────────────────────────

describe("POST /api/generate-names", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 when projectPrompt is missing", async () => {
    const res = await request(app).post("/api/generate-names").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("projectPrompt");
  });

  it("returns 400 when projectPrompt is too short (< 10 chars)", async () => {
    const res = await request(app)
      .post("/api/generate-names")
      .send({ projectPrompt: "Short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("10");
  });

  it("returns 400 when projectPrompt is too long (> 1500 chars)", async () => {
    const res = await request(app)
      .post("/api/generate-names")
      .send({ projectPrompt: "a".repeat(1501) });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("1500");
  });

  it("returns 400 when stylePrompt is too long (> 2000 chars)", async () => {
    const res = await request(app)
      .post("/api/generate-names")
      .send({ ...VALID_BODY, stylePrompt: "b".repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("2000");
  });

  it("returns 200 with suggestions on success", async () => {
    vi.mocked(generateNames).mockResolvedValueOnce([MOCK_SUGGESTION]);
    const res = await request(app).post("/api/generate-names").send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(1);
    expect(res.body.suggestions[0].name).toBe("TeamForge");
  });

  it("returns 500 when provider throws", async () => {
    vi.mocked(generateNames).mockRejectedValueOnce(new Error("API down"));
    const res = await request(app).post("/api/generate-names").send(VALID_BODY);
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("API down");
  });
});

// ── POST /api/generate-names-stream ──────────────────────────────────────────

/**
 * Parse SSE text into an array of { event, data } objects.
 */
function parseSseText(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = text.split("\n\n").filter((b) => b.trim());
  for (const block of blocks) {
    if (block.startsWith(":")) continue; // heartbeat comment
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event: ")) event = line.slice(7).trim();
      else if (line.startsWith("data: ")) data = line.slice(6);
    }
    events.push({ event, data });
  }
  return events;
}

describe("POST /api/generate-names-stream", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sets SSE headers", async () => {
    vi.mocked(generateNamesStream).mockImplementationOnce(async function* () {
      yield { type: "done", suggestions: [MOCK_SUGGESTION] };
    });
    const res = await request(app)
      .post("/api/generate-names-stream")
      .send(VALID_BODY);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.headers["cache-control"]).toContain("no-cache");
  });

  it("sends error event on validation failure", async () => {
    const res = await request(app)
      .post("/api/generate-names-stream")
      .send({ projectPrompt: "tiny" });
    const events = parseSseText(res.text);
    const errEvent = events.find((e) => e.event === "error");
    expect(errEvent).toBeDefined();
    const parsed = JSON.parse(errEvent!.data) as { error: string };
    expect(parsed.error).toBeTruthy();
  });

  it("sends result event with suggestions", async () => {
    vi.mocked(generateNamesStream).mockImplementationOnce(async function* () {
      yield { type: "done", suggestions: [MOCK_SUGGESTION] };
    });
    const res = await request(app)
      .post("/api/generate-names-stream")
      .send(VALID_BODY);
    const events = parseSseText(res.text);
    const resultEvent = events.find((e) => e.event === "result");
    expect(resultEvent).toBeDefined();
    const parsed = JSON.parse(resultEvent!.data) as {
      suggestions: typeof MOCK_SUGGESTION[];
    };
    expect(parsed.suggestions[0].name).toBe("TeamForge");
  });

  it("forwards token events", async () => {
    vi.mocked(generateNamesStream).mockImplementationOnce(async function* () {
      yield { type: "token", text: "Team" };
      yield { type: "token", text: "Forge" };
      yield { type: "done", suggestions: [MOCK_SUGGESTION] };
    });
    const res = await request(app)
      .post("/api/generate-names-stream")
      .send(VALID_BODY);
    const events = parseSseText(res.text);
    const tokenEvents = events.filter((e) => e.event === "token");
    expect(tokenEvents.length).toBeGreaterThanOrEqual(2);
  });

  it("sends error event when generator throws", async () => {
    vi.mocked(generateNamesStream).mockImplementationOnce(async function* () {
      throw new Error("Provider exploded");
      // eslint-disable-next-line no-unreachable
      yield { type: "done" as const, suggestions: [] };
    });
    const res = await request(app)
      .post("/api/generate-names-stream")
      .send(VALID_BODY);
    const events = parseSseText(res.text);
    const errEvent = events.find((e) => e.event === "error");
    expect(errEvent).toBeDefined();
    const parsed = JSON.parse(errEvent!.data) as { error: string };
    expect(parsed.error).toContain("Provider exploded");
  });
});
