// Empty string = same-origin (Vercel / Docker single-container).
// Override with VITE_API_URL for split-deployment local dev.
type ApiEnv = {
  DEV?: boolean;
  VITE_API_URL?: string;
};

export function resolveApiUrl(env: ApiEnv = import.meta.env): string {
  if (env.VITE_API_URL) return env.VITE_API_URL;
  return env.DEV ? "http://localhost:3001" : "";
}

const API_URL = resolveApiUrl();

export interface NameSuggestion {
  name: string;
  tagline: string;
  explanation: string;
  score: number;
}

export interface GenerateNamesParams {
  stylePrompt: string;
  projectPrompt: string;
  excludeNames?: string[];
}

export interface GenerateNamesResponse {
  suggestions: NameSuggestion[];
}

export interface ApiError {
  error: string;
}

export class NameApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "NameApiError";
  }
}

/**
 * Generate name suggestions via the SSE streaming endpoint.
 *
 * The server sends:
 *   ": heartbeat"            — keep-alive comment (ignored here)
 *   "event: token\ndata: …"  — intermediate token chunk (ignored here)
 *   "event: result\ndata: …" — final { suggestions } payload → resolves
 *   "event: error\ndata: …"  — error { error: string } payload → rejects
 *
 * Using fetch + ReadableStream instead of EventSource because EventSource
 * only supports GET, but we need POST to send the request body.
 */
export async function generateNames(
  params: GenerateNamesParams
): Promise<NameSuggestion[]> {
  const response = await fetch(`${API_URL}/api/generate-names-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok || !response.body) {
    let errorMessage = "Failed to generate names";
    try {
      const errorBody = (await response.json()) as ApiError;
      errorMessage = errorBody.error || errorMessage;
    } catch {
      // Use default error message if body parsing fails
    }
    throw new NameApiError(errorMessage, response.status);
  }

  return new Promise<NameSuggestion[]>((resolve, reject) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let settled = false;

    function settle(fn: () => void) {
      if (!settled) {
        settled = true;
        reader.cancel().catch(() => {});
        fn();
      }
    }

    /**
     * Parse accumulated SSE buffer into discrete event blocks and handle them.
     * SSE blocks are separated by blank lines ("\n\n").
     */
    function processBuffer() {
      const blocks = buffer.split("\n\n");
      // Last entry may be an incomplete block — keep it in the buffer
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        if (!block.trim()) continue;

        let eventType = "message";
        let data = "";

        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            data = line.slice(6);
          }
          // SSE comments (": …") are intentionally ignored
        }

        if (!data) continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;

          if (eventType === "result") {
            settle(() => resolve(parsed.suggestions as NameSuggestion[]));
            return;
          }

          if (eventType === "error") {
            settle(() =>
              reject(
                new NameApiError(
                  (parsed.error as string) || "Unknown error from server"
                )
              )
            );
            return;
          }

          // "token" events are informational — ignore for now
        } catch {
          // Ignore JSON parse errors on intermediate/malformed events
        }
      }
    }

    async function read() {
      try {
        while (!settled) {
          const { done, value } = await reader.read();
          if (done) {
            // Flush any remaining buffer content
            processBuffer();
            if (!settled) {
              settle(() =>
                reject(
                  new NameApiError(
                    "Connection closed before receiving a result"
                  )
                )
              );
            }
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          processBuffer();
        }
      } catch (err) {
        if (!settled) {
          settle(() =>
            reject(
              new NameApiError(
                err instanceof Error ? err.message : "Stream read error"
              )
            )
          );
        }
      }
    }

    void read();
  });
}
