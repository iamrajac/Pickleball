import { useState } from "react";
import { X, ChevronRight } from "lucide-react";

const STEPS = [
  {
    emoji: "🏆",
    title: "CREATE A TOURNAMENT",
    body: "Set up a round-robin or playoff tournament in seconds. Add players, pick rounds, and go.",
  },
  {
    emoji: "📱",
    title: "SHARE THE CODE",
    body: "Every tournament gets a 4-letter code. Share it so players and spectators can join on their phones — no account needed.",
  },
  {
    emoji: "⚡",
    title: "LIVE SCORES",
    body: "Tap +/− to update scores. Everyone watching sees it update in real time. Playoffs auto-generate when group stage is done.",
  },
];

export function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.88)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "1.5rem",
    }}>
      <div className="card fu" style={{
        maxWidth: 380, width: "100%", padding: "2.5rem 2rem",
        textAlign: "center", borderRadius: "var(--radius-xl)",
        position: "relative",
      }}>
        {/* Close */}
        <button onClick={onDone} style={{
          position: "absolute", top: 14, right: 14,
          background: "none", border: "none", color: "var(--text-muted)",
          cursor: "pointer", padding: 4,
        }}>
          <X size={18} />
        </button>

        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 6, height: 6,
              borderRadius: 3,
              background: i === step ? "var(--accent)" : "var(--border)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        <div style={{ fontSize: 56, marginBottom: 20 }}>{s.emoji}</div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: 24,
          letterSpacing: 2, marginBottom: 12, color: "var(--text)",
        }}>
          {s.title}
        </div>
        <div style={{
          fontSize: 14, color: "var(--text-secondary)",
          lineHeight: 1.65, marginBottom: 32,
        }}>
          {s.body}
        </div>

        <button onClick={() => isLast ? onDone() : setStep(s => s + 1)} style={{
          width: "100%", padding: "14px",
          background: "var(--accent)", border: "none",
          borderRadius: "var(--radius-md)", color: "#fff",
          fontFamily: "var(--font-display)", fontSize: 18,
          letterSpacing: 2, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          {isLast ? "LET'S GO" : "NEXT"} <ChevronRight size={18} />
        </button>

        {!isLast && (
          <button onClick={onDone} style={{
            marginTop: 12, background: "none", border: "none",
            color: "var(--text-muted)", fontSize: 12, cursor: "pointer",
          }}>
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}

export function useOnboarding() {
  const key = "pkl_onboarded_v1";
  const [show, setShow] = useState(() => !localStorage.getItem(key));
  const markDone = () => { localStorage.setItem(key, "1"); setShow(false); };
  return { showOnboarding: show, markDone };
}
