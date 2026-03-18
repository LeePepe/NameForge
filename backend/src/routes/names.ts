import { Router, Request, Response } from "express";
import { generateNames, GenerateNamesParams } from "../services/claude";

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

export default router;
