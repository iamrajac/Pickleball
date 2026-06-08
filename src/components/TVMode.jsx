import { useState, useEffect, useMemo } from "react";
import { X } from "lucide-react";

export function TVMode({ code, rounds, liveScores, profiles, tournamentName, playoffs, onClose }) {
  const [focusIdx, setFocusIdx] = useState(0);
  const [tick, setTick] = useState(0);

  // Flatten all matches with round info
  const allMatches = useMemo(() => rounds.flatMap((round, ri) =>
    round.map((m, mi) => ({ ...m, ri, mi, tk: `${ri}-${mi}` }))
  ), [rounds]);

  const totalMatches = allMatches.length;
  const completedMatches = useMemo(() => allMatches.filter(m => m.played), [allMatches]);
  const activeMatches = useMemo(() => allMatches.filter(m => !m.played), [allMatches]);

  // Playoff matches list for display
  const playoffMatches = useMemo(() => {
    if (!playoffs) return [];
    const stageOrder = ["q1", "elim", "sf1", "q2", "qf1", "qf2", "sf2", "q2_b", "sf", "final"];
    return stageOrder
      .filter(s => playoffs[s])
      .map(s => ({ ...playoffs[s], stage: s, label: playoffs[s].label || s.toUpperCase() }));
  }, [playoffs]);

  // Auto-rotate focus every 5 seconds
  useEffect(() => {
    if (activeMatches.length <= 1) return;
    const id = setInterval(() => {
      setFocusIdx(f => (f + 1) % activeMatches.length);
    }, 5000);
    return () => clearInterval(id);
  }, [activeMatches.length]);

  // Single tick for all timers — no per-match re-render storms
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fmtTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // Compute elapsed time from startedAt snapshot (stable, updated by tick)
  const getElapsed = (ls) => {
    if (!ls?.startedAt) return null;
    return Math.floor((Date.now() - ls.startedAt) / 1000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "#070c11", color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#c8f135", letterSpacing: 4, lineHeight: 1 }}>{tournamentName || "PICKLEBALL"}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            {completedMatches.length}/{totalMatches} matches complete · {activeMatches.length} remaining
          </div>
        </div>
        <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", padding: "10px 16px", cursor: "pointer", fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, letterSpacing: 2 }}>
          <X size={16} /> EXIT TV MODE
        </button>
      </div>

      {/* Main scrollable area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>

        {/* Active matches */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20, alignContent: "start", marginBottom: activeMatches.length > 0 ? 32 : 0 }}>
          {activeMatches.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem 0" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: "#c8f135", letterSpacing: 4 }}>ALL DONE!</div>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.4)", marginTop: 8 }}>All {totalMatches} matches completed</div>
            </div>
          ) : activeMatches.map((m, idx) => {
            const ls = liveScores?.[m.tk];
            const isFocused = idx === (focusIdx % activeMatches.length);
            const teamA = m.teamA?.join(" & ") || "TBD";
            const teamB = m.teamB?.join(" & ") || "TBD";
            const hasScore = ls && (ls.a !== undefined || ls.b !== undefined);
            const scoreA = ls?.a ?? 0;
            const scoreB = ls?.b ?? 0;
            const liveElapsed = getElapsed(ls);

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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, lineHeight: 1.2 }}>{teamA}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: hasScore ? "#c8f135" : "rgba(255,255,255,0.2)", letterSpacing: 4, lineHeight: 1 }}>
                      {hasScore ? `${scoreA}–${scoreB}` : "VS"}
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

        {/* Playoffs section */}
        {playoffMatches.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#f59e0b", letterSpacing: 3, marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid rgba(245,158,11,0.2)" }}>
              🏆 PLAYOFFS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {playoffMatches.map((m) => {
                const teamA = m.teamA?.join(" & ") || "TBD";
                const teamB = m.teamB?.join(" & ") || "TBD";
                const lsKey = `playoff-${m.stage}`;
                const ls = liveScores?.[lsKey];
                const liveA = m.scoreA ?? ls?.a ?? null;
                const liveB = m.scoreB ?? ls?.b ?? null;
                const hasLive = (liveA !== null && liveB !== null);
                const winA = m.played && Number(m.scoreA) > Number(m.scoreB);
                const winB = m.played && Number(m.scoreB) > Number(m.scoreA);
                const liveElapsed = getElapsed(ls);
                return (
                  <div key={m.stage} style={{
                    background: m.played ? "rgba(245,158,11,0.06)" : hasLive ? "rgba(200,241,53,0.04)" : "rgba(255,255,255,0.03)",
                    border: `2px solid ${m.played ? "#f59e0b" : hasLive ? "#c8f135" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: 16, padding: "16px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: "#f59e0b", letterSpacing: 2 }}>
                        {m.label} {m.played && "· DONE"}
                      </div>
                      {liveElapsed !== null && !m.played && (
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: "#38bdf8" }}>⏱ {fmtTime(liveElapsed)}</span>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: winA ? "#c8f135" : "#fff", letterSpacing: 1, lineHeight: 1.3 }}>{teamA}</div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: (m.played || hasLive) ? "#c8f135" : "rgba(255,255,255,0.2)", letterSpacing: 3, textAlign: "center" }}>
                        {(liveA !== null && liveB !== null) ? `${liveA}–${liveB}` : "–"}
                      </div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: winB ? "#c8f135" : "#fff", letterSpacing: 1, lineHeight: 1.3, textAlign: "right" }}>{teamB}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed group matches */}
        {completedMatches.length > 0 && (
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "rgba(255,255,255,0.4)", letterSpacing: 3, marginBottom: 16, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              ✓ COMPLETED ({completedMatches.length})
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {completedMatches.map((m) => {
                const winA = Number(m.scoreA) > Number(m.scoreB);
                const dur = m.duration ? `${Math.floor(m.duration / 60)}m ${m.duration % 60}s` : null;
                return (
                  <div key={m.tk} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 1, fontFamily: "'Bebas Neue', sans-serif" }}>ROUND {m.ri + 1}</div>
                      {dur && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'Bebas Neue', sans-serif" }}>⏱ {dur}</div>}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 6, alignItems: "center" }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: winA ? "#c8f135" : "rgba(255,255,255,0.5)", letterSpacing: 0.5 }}>{m.teamA?.join(" & ")}</div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "rgba(200,241,53,0.7)", letterSpacing: 3, textAlign: "center" }}>{m.scoreA}–{m.scoreB}</div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: !winA ? "#c8f135" : "rgba(255,255,255,0.5)", letterSpacing: 0.5, textAlign: "right" }}>{m.teamB?.join(" & ")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes tvPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  );
}
