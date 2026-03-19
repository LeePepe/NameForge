import { Router, Request, Response } from "express";
import { generateNames, generateNamesStream, GenerateNamesParams } from "../services/claude";

const router = Router();

function validateRequest(body: unknown): {
  valid: boolean;
  error?: string;
  params?: GenerateNamesParams;
} {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const b = body as Record<string, unknown>;

  if (!b.projectPrompt || typeof b.projectPrompt !== "string") {
    return { valid: false, error: "projectPrompt is required" };
  }

  const projectPrompt = b.projectPrompt.trim();
  if (projectPrompt.length < 10) {
    return { valid: false, error: "projectPrompt must be at least 10 characters" };
  }
  if (projectPrompt.length > 1500) {
    return { valid: false, error: "projectPrompt must be at most 1500 characters" };
  }

  const stylePrompt =
    typeof b.stylePrompt === "string" ? b.stylePrompt.trim() : "";
  if (stylePrompt.length > 2000) {
    return { valid: false, error: "stylePrompt must be at most 2000 characters" };
  }

  return { valid: true, params: { stylePrompt, projectPrompt } };
}

router.post("/generate-names", async (req: Request, res: Response) => {
  const start = Date.now();
  const provider = process.env.LLM_PROVIDER || "claude-code";

  const validation = validateRequest(req.body);

  if (!validation.valid || !validation.params) {
    res.status(400).json({ error: validation.error ?? "Invalid request" });
    return;
  }

  try {
    console.log(`[generate-names] provider=${provider} start`);
    const suggestions = await generateNames(validation.params);
    const ms = Date.now() - start;
    console.log(`[generate-names] provider=${provider} success ms=${ms}`);
    res.json({ suggestions });
  } catch (err: unknown) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[generate-names] provider=${provider} error ms=${ms} message="${msg}"`);
    if (stack) console.error(stack);
    res.status(500).json({ error: `Failed to generate names: ${msg}` });
  }
});

/**
 * SSE streaming endpoint — avoids platform HTTP timeouts by keeping the
 * connection alive with either token events (azure-foundry, anthropic-api) or
 * periodic SSE comment heartbeats (all other providers).
 *
 * Protocol:
 *   ": heartbeat"           — keep-alive comment, sent every 15 s
 *   "event: token\ndata: …" — streamed token chunk (informational, can ignore)
 *   "event: result\ndata: …"— final JSON with { suggestions }
 *   "event: error\ndata: …" — error with { error: string }
 */
router.post("/generate-names-stream", async (req: Request, res: Response) => {
  const start = Date.now();
  const provider = process.env.LLM_PROVIDER || "claude-code";

  // ── SSE headers ──────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx / Azure proxy buffering
  res.flushHeaders();

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // ── Validation ───────────────────────────────────────────────────────────
  const validation = validateRequest(req.body);
  if (!validation.valid || !validation.params) {
    sendEvent("error", { error: validation.error ?? "Invalid request" });
    res.end();
    return;
  }

  // ── Heartbeat — keeps connection alive for non-streaming providers ────────
  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 8000);

  const cleanup = () => clearInterval(heartbeat);
  req.on("close", cleanup);

  // ── Stream ────────────────────────────────────────────────────────────────
  try {
    console.log(`[generate-names-stream] provider=${provider} start`);

    for await (const event of generateNamesStream(validation.params)) {
      if (event.type === "token") {
        sendEvent("token", { text: event.text });
      } else {
        // type === "done"
        const ms = Date.now() - start;
        console.log(`[generate-names-stream] provider=${provider} success ms=${ms}`);
        sendEvent("result", { suggestions: event.suggestions });
      }
    }
  } catch (err: unknown) {
    const ms = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[generate-names-stream] provider=${provider} error ms=${ms} message="${msg}"`);
    if (stack) console.error(stack);
    sendEvent("error", { error: `Failed to generate names: ${msg}` });
  } finally {
    cleanup();
    res.end();
  }
});

export default router;
