import React from "react";

interface LoadingSpinnerProps {
  message?: string;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1.5rem",
    padding: "3rem 2rem",
  },
  spinnerWrapper: {
    position: "relative",
    width: "64px",
    height: "64px",
  },
  spinnerOuter: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    border: "4px solid #EEF2FF",
    borderTopColor: "#4F46E5",
    animation: "spin 0.9s linear infinite",
    position: "absolute",
    top: 0,
    left: 0,
  },
  spinnerInner: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "3px solid #EEF2FF",
    borderTopColor: "#818CF8",
    animation: "spin 1.4s linear infinite reverse",
    position: "absolute",
    top: "10px",
    left: "10px",
  },
  textContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.5rem",
  },
  mainText: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#334155",
  },
  subText: {
    fontSize: "0.875rem",
    color: "#64748B",
    animation: "pulse 2s ease infinite",
  },
  dots: {
    display: "flex",
    gap: "6px",
    marginTop: "0.5rem",
  },
};

const DotStyle = (delay: string): React.CSSProperties => ({
  width: "8px",
  height: "8px",
  borderRadius: "50%",
  backgroundColor: "#4F46E5",
  animation: `pulse 1.4s ease ${delay} infinite`,
});

export default function LoadingSpinner({
  message = "Crafting your perfect names...",
}: LoadingSpinnerProps) {
  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.spinnerWrapper}>
        <div style={styles.spinnerOuter} />
        <div style={styles.spinnerInner} />
      </div>
      <div style={styles.textContainer}>
        <span style={styles.mainText}>{message}</span>
        <span style={styles.subText}>Our AI is thinking creatively</span>
        <div style={styles.dots}>
          <div style={DotStyle("0s")} />
          <div style={DotStyle("0.2s")} />
          <div style={DotStyle("0.4s")} />
        </div>
      </div>
    </div>
  );
}
