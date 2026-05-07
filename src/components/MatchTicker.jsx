import React, { useMemo } from "react";
import { PlayerAvatar } from "./PlayerAvatar";

export function MatchTicker({ rounds = [], playoffs = null, profiles = {} }) {
  const latestEvents = useMemo(() => {
    const events = [];

    // Gather rounds matches
    rounds.forEach((rnd, ri) => {
      rnd.forEach((m, mi) => {
        if (m.played) {
          const w = m.scoreA > m.scoreB ? m.teamA : m.teamB;
          const l = m.scoreA > m.scoreB ? m.teamB : m.teamA;
          const wS = Math.max(m.scoreA, m.scoreB);
          const lS = Math.min(m.scoreA, m.scoreB);
          events.push({
            id: `r-${ri}-${mi}`,
            type: 'round',
            label: `R${ri + 1}`,
            win: w, lose: l, wS, lS
          });
        }
      });
    });

    // Gather playoff matches
    if (playoffs) {
      Object.entries(playoffs).forEach(([stage, m]) => {
        if (m && typeof m === 'object' && m.played && m.teamA && m.teamB) {
          const w = m.scoreA > m.scoreB ? m.teamA : m.teamB;
          const l = m.scoreA > m.scoreB ? m.teamB : m.teamA;
          const wS = Math.max(m.scoreA, m.scoreB);
          const lS = Math.min(m.scoreA, m.scoreB);
          events.push({
            id: `p-${stage}`,
            type: 'playoff',
            label: m.label || stage.toUpperCase(),
            win: w, lose: l, wS, lS
          });
        }
      });
    }

    // Since we don't have exact timestamps per match, we take the last 5
    // played matches from the sequence (which roughly represents chronological order)
    return events.slice(-5).reverse();
  }, [rounds, playoffs]);

  if (latestEvents.length === 0) return null;

  return (
    <div style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid var(--color-border)", overflow: "hidden", position: "relative", height: 32, display: "flex", alignItems: "center" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 40, background: "linear-gradient(to right, var(--color-bg), transparent)", zIndex: 1 }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 40, background: "linear-gradient(to left, var(--color-bg), transparent)", zIndex: 1 }} />
      
      <div className="ticker-scroll" style={{ display: "flex", whiteSpace: "nowrap", alignItems: "center", gap: 40, animation: "ticker 20s linear infinite" }}>
        {latestEvents.map((ev, i) => (
          <div key={ev.id + i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-muted)" }}>
            <span style={{ fontSize: 10, letterSpacing: 1, color: "var(--color-gold)", fontWeight: 600 }}>{ev.label}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {ev.win.map((p, i) => <div key={p} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 10 - i }}><PlayerAvatar name={p} profile={profiles[p]} size={16} /></div>)}
            </div>
            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{ev.win.join(" & ")}</span>
            <span style={{ color: "var(--color-lime)" }}>def.</span>
            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{ev.lose.join(" & ")}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {ev.lose.map((p, i) => <div key={p} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 10 - i }}><PlayerAvatar name={p} profile={profiles[p]} size={16} /></div>)}
            </div>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: "var(--color-lime)", letterSpacing: 1 }}>{ev.wS}-{ev.lS}</span>
          </div>
        ))}
        {/* Duplicate for seamless scrolling */}
        {latestEvents.map((ev, i) => (
          <div key={ev.id + i + "-dup"} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--color-muted)" }}>
            <span style={{ fontSize: 10, letterSpacing: 1, color: "var(--color-gold)", fontWeight: 600 }}>{ev.label}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {ev.win.map((p, i) => <div key={p} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 10 - i }}><PlayerAvatar name={p} profile={profiles[p]} size={16} /></div>)}
            </div>
            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{ev.win.join(" & ")}</span>
            <span style={{ color: "var(--color-lime)" }}>def.</span>
            <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{ev.lose.join(" & ")}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {ev.lose.map((p, i) => <div key={p} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 10 - i }}><PlayerAvatar name={p} profile={profiles[p]} size={16} /></div>)}
            </div>
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: "var(--color-lime)", letterSpacing: 1 }}>{ev.wS}-{ev.lS}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
