import React, { useState } from "react";
import type { NameSuggestion } from "../api/nameApi";

interface NameResultsProps {
  suggestions: NameSuggestion[];
  onGenerateMore: () => void;
  isLoading: boolean;
}

type CopiedKey = number | string;
type CopiedState = Record<CopiedKey, boolean>;

function cardStyle(highlighted: boolean): React.CSSProperties {
  return {
    backgroundColor: highlighted ? "#FAFBFF" : "#FFFFFF",
    borderRadius: "14px",
    border: highlighted ? "2px solid #C7D2FE" : "2px solid #F1F5F9",
    padding: "1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
    transition: "all 200ms ease",
    boxShadow: highlighted
      ? "0 4px 16px rgba(79,70,229,0.12)"
      : "0 2px 8px rgba(0,0,0,0.04)",
    animation: "slideUp 0.4s ease both",
    cursor: "default",
  };
}

function scoreBadgeStyle(score: number): React.CSSProperties {
  return {
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.85rem",
    fontWeight: 700,
    backgroundColor:
      score >= 90 ? "#ECFDF5" : score >= 75 ? "#EEF2FF" : "#F8FAFC",
    color: score >= 90 ? "#059669" : score >= 75 ? "#4F46E5" : "#64748B",
    border: `2px solid ${score >= 90 ? "#A7F3D0" : score >= 75 ? "#C7D2FE" : "#E2E8F0"}`,
    flexShrink: 0,
  };
}

function copyBtnStyle(copied: boolean): React.CSSProperties {
  return {
    padding: "0.4rem 0.9rem",
    borderRadius: "8px",
    fontSize: "0.8rem",
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    backgroundColor: copied ? "#ECFDF5" : "#F1F5F9",
    color: copied ? "#059669" : "#475569",
    transition: "all 200ms ease",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  };
}

function generateMoreBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "0.85rem",
    borderRadius: "12px",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled ? "#F1F5F9" : "transparent",
    color: disabled ? "#94A3B8" : "#4F46E5",
    border: disabled ? "2px solid #E2E8F0" : "2px solid #4F46E5",
    transition: "all 200ms ease",
    marginTop: "0.5rem",
  };
}

const staticStyles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "0.75rem",
  } as React.CSSProperties,
  title: {
    fontSize: "1.1rem",
    fontWeight: 700,
    color: "#1E293B",
  } as React.CSSProperties,
  badge: {
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    padding: "0.3rem 0.75rem",
    borderRadius: "999px",
  } as React.CSSProperties,
  grid: {
    display: "grid",
    gap: "1rem",
    gridTemplateColumns: "1fr",
  } as React.CSSProperties,
  cardTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1rem",
  } as React.CSSProperties,
  nameArea: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flex: 1,
  } as React.CSSProperties,
  name: {
    fontSize: "1.4rem",
    fontWeight: 800,
    color: "#1E293B",
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  } as React.CSSProperties,
  tagline: {
    fontSize: "0.9rem",
    color: "#4F46E5",
    fontWeight: 500,
    fontStyle: "italic",
  } as React.CSSProperties,
  scoreArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    flexShrink: 0,
  } as React.CSSProperties,
  scoreLabel: {
    fontSize: "0.65rem",
    color: "#94A3B8",
    fontWeight: 500,
  } as React.CSSProperties,
  explanation: {
    fontSize: "0.875rem",
    color: "#475569",
    lineHeight: 1.6,
    borderTop: "1px solid #F1F5F9",
    paddingTop: "0.6rem",
  } as React.CSSProperties,
  cardActions: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "0.25rem",
    flexWrap: "wrap",
  } as React.CSSProperties,
};

export default function NameResults({
  suggestions,
  onGenerateMore,
  isLoading,
}: NameResultsProps) {
  const [copiedStates, setCopiedStates] = useState<CopiedState>({});

  async function handleCopy(key: CopiedKey, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    } catch {
      // Clipboard API not available — silent fail
    }
  }

  const topScore = Math.max(...suggestions.map((s) => s.score));

  return (
    <div style={staticStyles.container} className="fade-in">
      <div style={staticStyles.header}>
        <span style={staticStyles.title}>Generated Names</span>
        <span style={staticStyles.badge}>{suggestions.length} suggestions</span>
      </div>

      <div style={staticStyles.grid}>
        {suggestions.map((suggestion, index) => {
          const isTop = suggestion.score === topScore;
          const taglineKey = `tagline-${index}`;

          return (
            <div
              key={`${suggestion.name}-${index}`}
              style={{
                ...cardStyle(isTop),
                animationDelay: `${index * 0.07}s`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform =
                  "translateY(-2px)";
                (e.currentTarget as HTMLDivElement).style.boxShadow =
                  "0 8px 24px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform =
                  "translateY(0)";
                (e.currentTarget as HTMLDivElement).style.boxShadow = isTop
                  ? "0 4px 16px rgba(79,70,229,0.12)"
                  : "0 2px 8px rgba(0,0,0,0.04)";
              }}
            >
              <div style={staticStyles.cardTop}>
                <div style={staticStyles.nameArea}>
                  <span style={staticStyles.name}>{suggestion.name}</span>
                  <span style={staticStyles.tagline}>
                    "{suggestion.tagline}"
                  </span>
                </div>
                <div style={staticStyles.scoreArea}>
                  <div style={scoreBadgeStyle(suggestion.score)}>
                    {suggestion.score}
                  </div>
                  <span style={staticStyles.scoreLabel}>score</span>
                </div>
              </div>

              <p style={staticStyles.explanation}>{suggestion.explanation}</p>

              <div style={staticStyles.cardActions}>
                <button
                  style={copyBtnStyle(!!copiedStates[index])}
                  onClick={() => void handleCopy(index, suggestion.name)}
                >
                  {copiedStates[index] ? "Copied!" : "Copy name"}
                </button>
                <button
                  style={copyBtnStyle(!!copiedStates[taglineKey])}
                  onClick={() =>
                    void handleCopy(
                      taglineKey,
                      `${suggestion.name} — ${suggestion.tagline}`
                    )
                  }
                >
                  {copiedStates[taglineKey]
                    ? "Copied!"
                    : "Copy with tagline"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        style={generateMoreBtnStyle(isLoading)}
        onClick={onGenerateMore}
        disabled={isLoading}
        onMouseEnter={(e) => {
          if (!isLoading) {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor =
              "#EEF2FF";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
            "transparent";
        }}
      >
        {isLoading ? "Generating..." : "Generate More Names"}
      </button>
    </div>
  );
}
