import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateNames, NameApiError, resolveApiUrl } from "./nameApi";

// ── helpers ──────────────────────────────────────────────────────────────────

const MOCK_SUGGESTION = {
  name: "TeamForge",
  tagline: "Built for remote work",
  explanation: "Combines team and forge.",
  score: 88,
};

const VALID_PARAMS = {
  projectPrompt: "A task management app for remote teams",
  stylePrompt: "",
};

/**
 * Build a minimal ReadableStream that emits SSE text in one chunk.
 */
function makeSseStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function mockFetch(status: number, body: ReadableStream | string | object) {
  const isStream = body instanceof ReadableStream;
  const responseBody = isStream
    ? body
    : typeof body === "string"
      ? body
      : JSON.stringify(body);

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      body: isStream ? responseBody : null,
      json: async () =>
        typeof responseBody === "string"
          ? JSON.parse(responseBody)
          : responseBody,
    })
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("generateNames (nameApi)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws NameApiError on non-ok HTTP response", async () => {
    mockFetch(500, { error: "Internal Server Error" });
    await expect(generateNames(VALID_PARAMS)).rejects.toBeInstanceOf(
      NameApiError
    );
  });

  it("sends excludeNames in the request body when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: makeSseStream(
        `event: result\ndata: ${JSON.stringify({ suggestions: [MOCK_SUGGESTION] })}\n\n`
      ),
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await generateNames({
      ...VALID_PARAMS,
      excludeNames: ["Notiv", "Memox"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/generate-names-stream"),
      expect.objectContaining({
        body: JSON.stringify({
          ...VALID_PARAMS,
          excludeNames: ["Notiv", "Memox"],
        }),
      })
    );
  });

  it("defaults to backend localhost URL in dev when VITE_API_URL is unset", () => {
    expect(resolveApiUrl({ DEV: true })).toBe("http://localhost:3001");
  });

  it("uses same-origin in production when VITE_API_URL is unset", () => {
    expect(resolveApiUrl({ DEV: false })).toBe("");
  });

  it("prefers explicit VITE_API_URL over dev default", () => {
    expect(
      resolveApiUrl({
        DEV: true,
        VITE_API_URL: "https://example.test",
      })
    ).toBe("https://example.test");
  });

  it("includes HTTP status code in NameApiError", async () => {
    mockFetch(503, { error: "Service Unavailable" });
    try {
      await generateNames(VALID_PARAMS);
    } catch (err) {
      expect(err).toBeInstanceOf(NameApiError);
      expect((err as NameApiError).statusCode).toBe(503);
    }
  });

  it("resolves with suggestions on event: result", async () => {
    const sse =
      `event: result\ndata: ${JSON.stringify({ suggestions: [MOCK_SUGGESTION] })}\n\n`;
    mockFetch(200, makeSseStream(sse));
    const suggestions = await generateNames(VALID_PARAMS);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].name).toBe("TeamForge");
  });

  it("rejects with NameApiError on event: error", async () => {
    const sse =
      `event: error\ndata: ${JSON.stringify({ error: "Provider failed" })}\n\n`;
    mockFetch(200, makeSseStream(sse));
    await expect(generateNames(VALID_PARAMS)).rejects.toMatchObject({
      message: "Provider failed",
    });
  });

  it("rejects when stream closes without result event", async () => {
    const sse = `event: token\ndata: ${JSON.stringify({ text: "hello" })}\n\n`;
    mockFetch(200, makeSseStream(sse));
    await expect(generateNames(VALID_PARAMS)).rejects.toBeInstanceOf(
      NameApiError
    );
  });

  it("ignores heartbeat comments and resolves on result", async () => {
    const sse =
      `: heartbeat\n\nevent: result\ndata: ${JSON.stringify({ suggestions: [MOCK_SUGGESTION] })}\n\n`;
    mockFetch(200, makeSseStream(sse));
    const suggestions = await generateNames(VALID_PARAMS);
    expect(suggestions[0].name).toBe("TeamForge");
  });

  it("ignores token events and resolves on result", async () => {
    const sse =
      `event: token\ndata: ${JSON.stringify({ text: "Team" })}\n\n` +
      `event: result\ndata: ${JSON.stringify({ suggestions: [MOCK_SUGGESTION] })}\n\n`;
    mockFetch(200, makeSseStream(sse));
    const suggestions = await generateNames(VALID_PARAMS);
    expect(suggestions[0].name).toBe("TeamForge");
  });

  it("handles SSE data split across multiple stream chunks", async () => {
    const resultData = JSON.stringify({ suggestions: [MOCK_SUGGESTION] });
    // Split "event: result\ndata: <json>\n\n" across two chunks
    const full = `event: result\ndata: ${resultData}\n\n`;
    const half = Math.floor(full.length / 2);
    const chunk1 = full.slice(0, half);
    const chunk2 = full.slice(half);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(chunk1));
        controller.enqueue(encoder.encode(chunk2));
        controller.close();
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: stream,
        json: async () => ({}),
      })
    );

    const suggestions = await generateNames(VALID_PARAMS);
    expect(suggestions[0].name).toBe("TeamForge");
  });
});
