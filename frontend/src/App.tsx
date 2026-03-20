import React, { useState } from "react";
import NameForm from "./components/NameForm";
import NameResults from "./components/NameResults";
import LoadingSpinner from "./components/LoadingSpinner";
import { generateNames, NameApiError } from "./api/nameApi";
import type { NameSuggestion, GenerateNamesParams } from "./api/nameApi";
import { mergeSeenNames } from "./lib/nameHistory";

type AppState = "form" | "loading" | "results" | "error";

const css: Record<string, React.CSSProperties> = {
  wrapper: {
    width: "100%",
    maxWidth: "640px",
    display: "flex",
    flexDirection: "column",
    gap: "1.5rem",
  },
  header: {
    textAlign: "center" as const,
    color: "#FFFFFF",
    padding: "0.5rem 0 0.75rem",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.6rem",
    marginBottom: "0.4rem",
  },
  logoIcon: {
    width: "40px",
    height: "40px",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.4rem",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.3)",
  },
  logoText: {
    fontSize: "1.9rem",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    color: "#FFFFFF",
    textShadow: "0 2px 8px rgba(0,0,0,0.2)",
  },
  tagline: {
    fontSize: "1rem",
    color: "rgba(255,255,255,0.85)",
    fontWeight: 400,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: "20px",
    padding: "2rem",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.1)",
    backdropFilter: "blur(12px)",
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: "12px",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  },
  errorTitle: {
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "#991B1B",
  },
  errorMessage: {
    fontSize: "0.875rem",
    color: "#B91C1C",
    lineHeight: 1.5,
  },
  retryBtn: {
    alignSelf: "flex-start" as const,
    padding: "0.5rem 1.25rem",
    borderRadius: "8px",
    fontSize: "0.875rem",
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: "#FFFFFF",
    color: "#991B1B",
    border: "1.5px solid #FECACA",
    transition: "all 200ms ease",
  },
  divider: {
    height: "1px",
    backgroundColor: "#F1F5F9",
    margin: "0.5rem 0",
  },
  backBtn: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    fontSize: "0.875rem",
    fontWeight: 500,
    color: "#64748B",
    cursor: "pointer",
    background: "none",
    border: "none",
    padding: "0.25rem 0",
    marginBottom: "-0.5rem",
    transition: "color 200ms ease",
  },
  footer: {
    textAlign: "center" as const,
    color: "rgba(255,255,255,0.6)",
    fontSize: "0.8rem",
  },
};

export default function App() {
  const [appState, setAppState] = useState<AppState>("form");
  const [suggestions, setSuggestions] = useState<NameSuggestion[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastParams, setLastParams] = useState<GenerateNamesParams | null>(
    null
  );
  const [seenNames, setSeenNames] = useState<string[]>([]);

  async function runGeneration(
    params: GenerateNamesParams,
    excludeNames: string[]
  ) {
    setLastParams(params);
    setAppState("loading");
    setErrorMessage("");

    try {
      const results = await generateNames({ ...params, excludeNames });
      setSuggestions(results);
      setSeenNames(mergeSeenNames(excludeNames, results.map((item) => item.name)));
      setAppState("results");
    } catch (err) {
      if (err instanceof NameApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred. Please try again.");
      }
      setAppState("error");
    }
  }

  async function handleGenerate(params: GenerateNamesParams) {
    await runGeneration(params, []);
  }

  function handleGenerateMore() {
    if (lastParams) {
      void runGeneration(lastParams, seenNames);
    }
  }

  function handleRetry() {
    setAppState("form");
    setErrorMessage("");
  }

  function handleBack() {
    setAppState("form");
  }

  return (
    <div style={css.wrapper}>
      <header style={css.header} className="fade-in">
        <div style={css.logoRow}>
          <div style={css.logoIcon}>N</div>
          <span style={css.logoText}>NameForge</span>
        </div>
        <p style={css.tagline}>
          AI-powered names for your next big project
        </p>
      </header>

      <main style={css.card} className="slide-up">
        {/* Keep form mounted so inputs survive error → retry */}
        <div style={{ display: appState === "form" || appState === "error" ? "block" : "none" }}>
          <NameForm onSubmit={handleGenerate} isLoading={appState === "loading"} />
        </div>

        {appState === "loading" && <LoadingSpinner />}

        {appState === "error" && (
          <div style={{ marginTop: "1.25rem" }}>
            <div style={css.errorBox}>
              <span style={css.errorTitle}>Something went wrong</span>
              <p style={css.errorMessage}>{errorMessage}</p>
              <button style={css.retryBtn} onClick={handleRetry}>
                Try again
              </button>
            </div>
          </div>
        )}

        {appState === "results" && (
          <div>
            <button
              style={css.backBtn}
              onClick={handleBack}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#4F46E5";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "#64748B";
              }}
            >
              Back to form
            </button>
            <div style={css.divider} />
            <NameResults
              suggestions={suggestions}
              onGenerateMore={handleGenerateMore}
              isLoading={false}
            />
          </div>
        )}
      </main>

      <footer style={css.footer} className="fade-in">
        Powered by Claude AI · v{__APP_VERSION__}
      </footer>
    </div>
  );
}
