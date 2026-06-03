import { useMemo, useState, useEffect } from "react";
import { PlayerAvatar } from "./PlayerAvatar";

export function MatchTicker({ rounds = [], playoffs = null, profiles = {}, liveScores = {} }) {
  // Rotating live note headline
  const [headlineIdx, setHeadlineIdx] = useState(0);

  const liveNotes = useMemo(() =>
    Object.values(liveScores).map(s => s.note).filter(Boolean),
  [liveScores]);

  useEffect(() => {
    if (liveNotes.length < 2) return;
    const id = setInterval(() => setHeadlineIdx(i => (i + 1) % liveNotes.length), 3000);
    return () => clearInterval(id);
  }, [liveNotes.length]);

  const currentHeadline = liveNotes[headlineIdx % Math.max(liveNotes.length, 1)];

  const { completedEvents, liveEvents } = useMemo(() => {
    const completed = [];
    const live = [];

    rounds.forEach((rnd, ri) => {
      rnd.forEach((m, mi) => {
        const key = `${ri}-${mi}`;
        if (m.played) {
          const w = m.scoreA > m.scoreB ? m.teamA : m.teamB;
          const l = m.scoreA > m.scoreB ? m.teamB : m.teamA;
          completed.push({
            id: `r-${ri}-${mi}`, label: `R${ri + 1}`,
            win: w, lose: l,
            wS: Math.max(m.scoreA, m.scoreB), lS: Math.min(m.scoreA, m.scoreB),
            isLive: false,
          });
        } else if (liveScores[key] && (liveScores[key].a > 0 || liveScores[key].b > 0)) {
          const ls = liveScores[key];
          live.push({
            id: `live-${ri}-${mi}`, label: `R${ri + 1}`,
            teamA: m.teamA, teamB: m.teamB,
            a: ls.a, b: ls.b, isLive: true,
            startedAt: ls.startedAt,
          });
        }
      });
    });

    if (playoffs) {
      Object.entries(playoffs).forEach(([stage, m]) => {
        if (m && typeof m === "object" && m.played && m.teamA && m.teamB) {
          const w = m.scoreA > m.scoreB ? m.teamA : m.teamB;
          const l = m.scoreA > m.scoreB ? m.teamB : m.teamA;
          completed.push({
            id: `p-${stage}`, label: m.label || stage.toUpperCase(),
            win: w, lose: l,
            wS: Math.max(m.scoreA, m.scoreB), lS: Math.min(m.scoreA, m.scoreB),
            isLive: false,
          });
        }
      });
    }

    return { completedEvents: completed.slice(-5).reverse(), liveEvents: live };
  }, [rounds, playoffs, liveScores]);

  const hasContent = completedEvents.length > 0 || liveEvents.length > 0;
  if (!hasContent && !currentHeadline) return null;

  return (
    <div>
      {/* Live note headline */}
      {currentHeadline && (
        <div style={{
          background: "rgba(16,212,142,0.12)", borderBottom: "1px solid rgba(16,212,142,0.25)",
          padding: "5px 16px", fontSize: 12, fontWeight: 600,
          color: "var(--accent)", display: "flex", alignItems: "center", gap: 8,
          animation: "fadeUp 0.3s ease",
        }}>
          <span className="live-dot" style={{ width: 6, height: 6, background: "var(--accent)", boxShadow: "0 0 6px var(--accent)" }} />
          {currentHeadline}
        </div>
      )}

      {/* Scrolling ticker */}
      {hasContent && (
        <div style={{ background: "rgba(0,0,0,0.35)", borderBottom: "1px solid var(--border)", overflow: "hidden", height: 32, display: "flex", alignItems: "center", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 32, background: "linear-gradient(to right, var(--bg), transparent)", zIndex: 1 }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 32, background: "linear-gradient(to left, var(--bg), transparent)", zIndex: 1 }} />

          <div style={{ display: "flex", whiteSpace: "nowrap", alignItems: "center", gap: 32, animation: "ticker 22s linear infinite" }}>
            {/* Live events */}
            {liveEvents.map(ev => (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--live)", fontWeight: 700 }}>{ev.label}</span>
                <Avatars players={ev.teamA} profiles={profiles} />
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{ev.teamA?.join(" & ")}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--accent)", letterSpacing: 1, margin: "0 2px" }}>{ev.a}-{ev.b}</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{ev.teamB?.join(" & ")}</span>
                <Avatars players={ev.teamB} profiles={profiles} />
              </div>
            ))}

            {/* Completed events */}
            {completedEvents.map(ev => (
              <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--gold)", fontWeight: 700 }}>{ev.label}</span>
                <Avatars players={ev.win} profiles={profiles} />
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{ev.win.join(" & ")}</span>
                <span style={{ color: "var(--accent)", fontSize: 10 }}>def.</span>
                <span style={{ fontWeight: 600 }}>{ev.lose.join(" & ")}</span>
                <Avatars players={ev.lose} profiles={profiles} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--accent)", letterSpacing: 1 }}>{ev.wS}-{ev.lS}</span>
              </div>
            ))}

            {/* Duplicate for seamless loop */}
            {liveEvents.map(ev => (
              <div key={ev.id + "-d"} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--live)", fontWeight: 700 }}>{ev.label}</span>
                <Avatars players={ev.teamA} profiles={profiles} />
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{ev.teamA?.join(" & ")}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--accent)", letterSpacing: 1, margin: "0 2px" }}>{ev.a}-{ev.b}</span>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{ev.teamB?.join(" & ")}</span>
                <Avatars players={ev.teamB} profiles={profiles} />
              </div>
            ))}
            {completedEvents.map(ev => (
              <div key={ev.id + "-d"} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                <span style={{ fontSize: 9, letterSpacing: 1, color: "var(--gold)", fontWeight: 700 }}>{ev.label}</span>
                <Avatars players={ev.win} profiles={profiles} />
                <span style={{ fontWeight: 600, color: "var(--text)" }}>{ev.win.join(" & ")}</span>
                <span style={{ color: "var(--accent)", fontSize: 10 }}>def.</span>
                <span style={{ fontWeight: 600 }}>{ev.lose.join(" & ")}</span>
                <Avatars players={ev.lose} profiles={profiles} />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 14, color: "var(--accent)", letterSpacing: 1 }}>{ev.wS}-{ev.lS}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Avatars({ players, profiles }) {
  if (!players?.length) return null;
  return (
    <div style={{ display: "flex" }}>
      {players.map((p, i) => (
        <div key={p} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: 10 - i }}>
          <PlayerAvatar name={p} profile={profiles?.[p]} size={16} />
        </div>
      ))}
    </div>
  );
}
