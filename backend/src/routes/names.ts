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
  const validation = validateRequest(req.body);

  if (!validation.valid || !validation.params) {
    res.status(400).json({ error: validation.error ?? "Invalid request" });
    return;
  }

  try {
    const suggestions = await generateNames(validation.params);
    res.json({ suggestions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Error generating names:", msg);
    res.status(500).json({ error: "Failed to generate names. Please try again." });
  }
});

export default router;
