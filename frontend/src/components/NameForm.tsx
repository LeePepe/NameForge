import React, { useState, useEffect, useRef } from "react";
import type { GenerateNamesParams } from "../api/nameApi";

const STYLE_COOKIE = "nameforge_style";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const DEFAULT_STYLE =
  "Generate names inspired by precious and semi-precious gemstones. " +
  "Names should evoke rarity, clarity, brilliance, and lasting value. " +
  "Use gemstone names directly, combine them with a noun/verb, or draw " +
  "from their qualities (crystalline, lustrous, faceted, refractive). " +
  "Prefer single-word or compact two-part names. " +
  "Feel: premium, timeless, distinctive, and slightly mysterious.";

function readStyleCookie(): string {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(STYLE_COOKIE + "="));
  if (!match) return "";
  try {
    return decodeURIComponent(match.split("=").slice(1).join("="));
  } catch {
    return "";
  }
}

function writeStyleCookie(value: string) {
  document.cookie = `${STYLE_COOKIE}=${encodeURIComponent(value)}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

interface NameFormProps {
  onSubmit: (params: GenerateNamesParams) => void;
  isLoading: boolean;
}

const s = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.75rem",
  } as React.CSSProperties,

  section: {
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
  } as React.CSSProperties,

  labelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  } as React.CSSProperties,

  label: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#334155",
    letterSpacing: "0.01em",
  } as React.CSSProperties,

  sublabel: {
    fontSize: "0.8rem",
    color: "#64748B",
    marginTop: "-0.25rem",
  } as React.CSSProperties,

  savedBadge: {
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "#16A34A",
    display: "flex",
    alignItems: "center",
    gap: "0.25rem",
    transition: "opacity 400ms ease",
  } as React.CSSProperties,

  divider: {
    borderTop: "2px dashed #E2E8F0",
    margin: "0",
  } as React.CSSProperties,
};

function textareaStyle(focused: boolean, highlight: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "0.875rem 1rem",
    borderRadius: "10px",
    border: `2px solid ${focused ? "#4F46E5" : highlight ? "#C7D2FE" : "#E2E8F0"}`,
    fontSize: "0.95rem",
    color: "#1E293B",
    resize: "vertical",
    transition: "border-color 200ms ease",
    backgroundColor: highlight ? "#F5F3FF" : "#FAFBFC",
    lineHeight: "1.6",
    boxSizing: "border-box",
  };
}

function submitBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "0.95rem",
    borderRadius: "12px",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    background: disabled
      ? "#E2E8F0"
      : "linear-gradient(135deg, #4F46E5, #7C3AED)",
    color: disabled ? "#94A3B8" : "#FFFFFF",
    transition: "all 200ms ease",
    border: "none",
    letterSpacing: "0.02em",
    boxShadow: disabled ? "none" : "0 4px 14px rgba(79,70,229,0.35)",
  };
}

export default function NameForm({ onSubmit, isLoading }: NameFormProps) {
  const [stylePrompt, setStylePrompt] = useState(() => readStyleCookie() || DEFAULT_STYLE);
  const [projectPrompt, setProjectPrompt] = useState("");
  const [styleFocused, setStyleFocused] = useState(false);
  const [projectFocused, setProjectFocused] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save style to cookie with debounce
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      writeStyleCookie(stylePrompt);
      if (stylePrompt.trim()) {
        setSavedVisible(true);
        setTimeout(() => setSavedVisible(false), 2000);
      }
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [stylePrompt]);

  const canSubmit = projectPrompt.trim().length >= 10 && !isLoading;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      stylePrompt: stylePrompt.trim(),
      projectPrompt: projectPrompt.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} style={s.form}>
      {/* Style prompt – persisted in cookie */}
      <div style={s.section}>
        <div style={s.labelRow}>
          <label style={s.label}>Your naming style</label>
          <span
            style={{
              ...s.savedBadge,
              opacity: savedVisible ? 1 : 0,
            }}
          >
            ✓ Saved
          </span>
        </div>
        <p style={s.sublabel}>
          Describe your general preferences — tone, length, style, things you
          love or hate. Saved across sessions.
        </p>
        <textarea
          rows={4}
          style={textareaStyle(styleFocused, true)}
          value={stylePrompt}
          onChange={(e) => setStylePrompt(e.target.value)}
          onFocus={() => setStyleFocused(true)}
          onBlur={() => setStyleFocused(false)}
          placeholder="e.g. I prefer short, punchy names (1–2 syllables). No generic tech words like 'hub', 'sync', or 'flow'. I like names that feel alive — verbs, vivid nouns, or invented words. Avoid anything that sounds corporate."
          disabled={isLoading}
        />
      </div>

      <hr style={s.divider} />

      {/* Project prompt – per-request */}
      <div style={s.section}>
        <label style={s.label}>What does this project do?</label>
        <p style={s.sublabel}>
          Describe this specific project. The more context, the better the names.
        </p>
        <textarea
          rows={5}
          style={textareaStyle(projectFocused, false)}
          value={projectPrompt}
          onChange={(e) => setProjectPrompt(e.target.value)}
          onFocus={() => setProjectFocused(true)}
          onBlur={() => setProjectFocused(false)}
          placeholder="e.g. A mobile app that lets you scan any dish at a restaurant, instantly see its calories and macros, and log it to your food diary — no manual searching required."
          disabled={isLoading}
          maxLength={1500}
        />
        <span
          style={{
            fontSize: "0.75rem",
            color: projectPrompt.length > 1400 ? "#EF4444" : "#94A3B8",
            alignSelf: "flex-end",
          }}
        >
          {projectPrompt.length} / 1500
        </span>
      </div>

      <button
        type="submit"
        style={submitBtnStyle(!canSubmit)}
        disabled={!canSubmit}
        onMouseEnter={(e) => {
          if (canSubmit) {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 6px 20px rgba(79,70,229,0.45)";
          }
        }}
        onMouseLeave={(e) => {
          if (canSubmit) {
            (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 14px rgba(79,70,229,0.35)";
          }
        }}
      >
        {isLoading ? "Generating..." : "Generate Names"}
      </button>
    </form>
  );
}
