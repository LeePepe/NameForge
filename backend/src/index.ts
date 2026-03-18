import "dotenv/config";
import path from "path";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import namesRouter from "./routes/names";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const SERVE_STATIC = process.env.SERVE_STATIC === "true";

// In Docker/single-container mode we serve the frontend from Express directly,
// so CORS is only needed in split-deployment mode.
if (!SERVE_STATIC) {
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
}

app.use(express.json({ limit: "10kb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api", namesRouter);

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

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  const provider = process.env.LLM_PROVIDER || "claude-code";
  console.log(`NameForge backend running on http://localhost:${PORT}`);
  console.log(`LLM provider: ${provider}`);
  if (SERVE_STATIC) console.log("Serving frontend from /public");
});

export default app;
