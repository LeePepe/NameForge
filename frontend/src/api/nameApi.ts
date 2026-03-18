// Empty string = same-origin (Vercel / Docker single-container).
// Override with VITE_API_URL for split-deployment local dev.
const API_URL = import.meta.env.VITE_API_URL ?? "";

export interface NameSuggestion {
  name: string;
  tagline: string;
  explanation: string;
  score: number;
}

export interface GenerateNamesParams {
  stylePrompt: string;
  projectPrompt: string;
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

export async function generateNames(
  params: GenerateNamesParams
): Promise<NameSuggestion[]> {
  const response = await fetch(`${API_URL}/api/generate-names`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errorMessage = "Failed to generate names";
    try {
      const errorBody = (await response.json()) as ApiError;
      errorMessage = errorBody.error || errorMessage;
    } catch {
      // Use default error message if body parsing fails
    }
    throw new NameApiError(errorMessage, response.status);
  }

  const data = (await response.json()) as GenerateNamesResponse;
  return data.suggestions;
}
