import { useMemo } from "react";
import { PlayerAvatar } from "./PlayerAvatar";

export function MatchTicker({ rounds = [], playoffs = null, profiles = {}, liveScores = {} }) {

  const { items, hasLive } = useMemo(() => {
    const live = [];
    const done = [];

    // Live in-progress scores
    rounds.forEach((rnd, ri) => {
      rnd.forEach((m, mi) => {
        const key = `${ri}-${mi}`;
        const ls = liveScores[key];
        if (m.played) {
          const w = m.scoreA > m.scoreB ? m.teamA : m.teamB;
          const l = m.scoreA > m.scoreB ? m.teamB : m.teamA;
          done.push({ id: `d-${ri}-${mi}`, type: "done", label: `R${ri+1}`, win: w, lose: l, wS: Math.max(m.scoreA, m.scoreB), lS: Math.min(m.scoreA, m.scoreB) });
        } else if (ls && (ls.a > 0 || ls.b > 0)) {
          // Active live note — show as headline item first
          if (ls.note) live.unshift({ id: `n-${key}`, type: "note", text: ls.note });
          live.push({ id: `l-${key}`, type: "live", label: `R${ri+1}`, teamA: m.teamA, teamB: m.teamB, a: ls.a, b: ls.b, startedAt: ls.startedAt });
        }
      });
    });

    if (playoffs) {
      Object.entries(playoffs).forEach(([stage, m]) => {
        if (m && typeof m === "object" && m.played && m.teamA && m.teamB) {
          const w = m.scoreA > m.scoreB ? m.teamA : m.teamB;
          const l = m.scoreA > m.scoreB ? m.teamB : m.teamA;
          done.push({ id: `p-${stage}`, type: "done", label: m.label || stage.toUpperCase(), win: w, lose: l, wS: Math.max(m.scoreA, m.scoreB), lS: Math.min(m.scoreA, m.scoreB) });
        }
      });
    }

    // Live items first, then completed (most recent last 5)
    const all = [...live, ...done.slice(-5).reverse()];
    return { items: all, hasLive: live.length > 0 };
  }, [rounds, playoffs, liveScores]);

  if (items.length === 0) return null;

  const renderItem = (item, suffix = "") => {
    if (item.type === "note") return (
      <div key={item.id + suffix} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)", fontWeight: 700, padding: "0 8px" }}>
        <span className="live-dot" style={{ width: 6, height: 6, flexShrink: 0 }} />
        {item.text}
      </div>
    );

    if (item.type === "live") return (
      <div key={item.id + suffix} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <span className="live-dot" style={{ width: 5, height: 5, background: "var(--live)", boxShadow: "0 0 4px var(--live)", flexShrink: 0 }} />
        <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--live)", fontWeight: 700 }}>{item.label}</span>
        <Avatars players={item.teamA} profiles={profiles} />
        <span style={{ fontWeight: 600, color: "var(--text)" }}>{item.teamA?.join(" & ")}</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--accent)", letterSpacing: 1, margin: "0 4px" }}>{item.a}–{item.b}</span>
        <span style={{ fontWeight: 600, color: "var(--text)" }}>{item.teamB?.join(" & ")}</span>
        <Avatars players={item.teamB} profiles={profiles} />
      </div>
    );

    return (
      <div key={item.id + suffix} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
        <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--gold)", fontWeight: 700 }}>{item.label}</span>
        <Avatars players={item.win} profiles={profiles} />
        <span style={{ fontWeight: 600, color: "var(--text)" }}>{item.win.join(" & ")}</span>
        <span style={{ color: "var(--accent)", fontSize: 10, margin: "0 2px" }}>def.</span>
        <span style={{ fontWeight: 600 }}>{item.lose.join(" & ")}</span>
        <Avatars players={item.lose} profiles={profiles} />
        <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--accent)", letterSpacing: 1 }}>{item.wS}–{item.lS}</span>
      </div>
    );
  };

  return (
    <div style={{
      background: hasLive ? "rgba(16,212,142,0.06)" : "rgba(0,0,0,0.3)",
      borderBottom: `1px solid ${hasLive ? "rgba(16,212,142,0.2)" : "var(--border)"}`,
      overflow: "hidden", height: 34, display: "flex", alignItems: "center",
      position: "relative", transition: "background 0.3s",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 28, background: `linear-gradient(to right, ${hasLive ? "rgba(16,212,142,0.06)" : "rgba(0,0,0,0.3)"}, transparent)`, zIndex: 1 }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 28, background: `linear-gradient(to left, ${hasLive ? "rgba(16,212,142,0.06)" : "rgba(0,0,0,0.3)"}, transparent)`, zIndex: 1 }} />
      <div style={{ display: "flex", whiteSpace: "nowrap", alignItems: "center", gap: 32, animation: `ticker ${Math.max(16, items.length * 6)}s linear infinite` }}>
        {items.map(item => renderItem(item))}
        {/* Duplicate for seamless loop */}
        {items.map(item => renderItem(item, "-dup"))}
      </div>
    </div>
  );
}

function Avatars({ players, profiles }) {
  if (!players?.length) return null;
  return (
    <div style={{ display: "flex" }}>
      {players.map((p, i) => (
        <div key={p} style={{ marginLeft: i > 0 ? -5 : 0, zIndex: 10 - i }}>
          <PlayerAvatar name={p} profile={profiles?.[p]} size={15} />
        </div>
      ))}
    </div>
  );
}
