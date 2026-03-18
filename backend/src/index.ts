import path from "path";
import express, { Request, Response } from "express";
import app from "./app";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const SERVE_STATIC = process.env.SERVE_STATIC === "true";

// Serve built React frontend (Docker single-container mode)
if (SERVE_STATIC) {
  const staticPath = path.join(__dirname, "../public");
  app.use(express.static(staticPath));
  app.get("*", (_req: Request, res: Response) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
} else {
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Route not found" });
  });
}

app.listen(PORT, () => {
  const provider = process.env.LLM_PROVIDER || "claude-code";
  console.log(`NameForge backend running on http://localhost:${PORT}`);
  console.log(`LLM provider: ${provider}`);
  if (SERVE_STATIC) console.log("Serving frontend from /public");
});
