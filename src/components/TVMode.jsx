import { useState, useEffect } from "react";
import { X } from "lucide-react";

export function TVMode({ code, rounds, liveScores, profiles, tournamentName, onClose }) {
  const [focusIdx, setFocusIdx] = useState(0);
  const [tick, setTick] = useState(0);

  // Flatten all matches with round info
  const allMatches = rounds.flatMap((round, ri) =>
    round.map((m, mi) => ({ ...m, ri, mi, tk: `${ri}-${mi}` }))
  );
  const totalMatches = allMatches.length;
  const completedMatches = allMatches.filter(m => m.played).length;

  // Active (in-progress with live score or not played)
  const activeMatches = allMatches.filter(m => !m.played);

  // Auto-rotate focus every 5 seconds
  useEffect(() => {
    if (activeMatches.length <= 1) return;
    const id = setInterval(() => {
      setFocusIdx(f => (f + 1) % activeMatches.length);
    }, 5000);
    return () => clearInterval(id);
  }, [activeMatches.length]);

  // Tick for live timers
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#070c11", color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#c8f135", letterSpacing: 4, lineHeight: 1 }}>{tournamentName || "PICKLEBALL"}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            {completedMatches}/{totalMatches} matches complete · {activeMatches.length} remaining
          </div>
        </div>
        <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", padding: "10px 16px", cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2 }}>
          <X size={16} /> EXIT TV MODE
        </button>
      </div>

      {/* Match grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20, alignContent: "start" }}>
        {activeMatches.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "4rem 0" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: "#c8f135", letterSpacing: 4 }}>ALL DONE!</div>
            <div style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>All {totalMatches} matches completed</div>
          </div>
        ) : activeMatches.map((m, idx) => {
          const ls = liveScores?.[m.tk];
          const isFocused = idx === (focusIdx % activeMatches.length);
          const teamA = m.teamA?.join(" & ") || "TBD";
          const teamB = m.teamB?.join(" & ") || "TBD";
          const scoreA = ls?.a ?? 0;
          const scoreB = ls?.b ?? 0;
          const liveElapsed = ls?.startedAt ? Math.floor((Date.now() - ls.startedAt) / 1000) : null;

          return (
            <div key={m.tk} style={{
              background: isFocused ? "rgba(200,241,53,0.06)" : "rgba(255,255,255,0.03)",
              border: `2px solid ${isFocused ? "#c8f135" : "rgba(255,255,255,0.08)"}`,
              borderRadius: 16,
              padding: "20px",
              transition: "all 0.4s ease",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: isFocused ? "#c8f135" : "rgba(255,255,255,0.4)", letterSpacing: 2 }}>
                  ROUND {m.ri + 1}
                </span>
                {liveElapsed !== null && (
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "#38bdf8", letterSpacing: 2 }}>
                    ⏱ {fmtTime(liveElapsed)}
                  </span>
                )}
                {ls && (ls.a > 0 || ls.b > 0) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#c8f135", fontWeight: 700, letterSpacing: 1 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c8f135", animation: "tvPulse 1.5s infinite" }} />
                    LIVE
                  </div>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, lineHeight: 1.2 }}>{teamA}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: (ls && (ls.a > 0 || ls.b > 0)) ? "#c8f135" : "rgba(255,255,255,0.2)", letterSpacing: 4, lineHeight: 1 }}>
                    {scoreA}–{scoreB}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, lineHeight: 1.2 }}>{teamB}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes tvPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
