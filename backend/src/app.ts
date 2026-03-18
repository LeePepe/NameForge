import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import namesRouter from "./routes/names";

const app = express();

// CORS is only needed in split-deployment mode (not Docker single-container,
// not Vercel where frontend and API share the same origin).
const SERVE_STATIC = process.env.SERVE_STATIC === "true";
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

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
