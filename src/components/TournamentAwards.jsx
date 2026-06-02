import { useMemo } from "react";
import { PlayerAvatar } from "./PlayerAvatar";

function computeAwards(players, rounds) {
  if (!rounds || rounds.length === 0) return null;

  const stats = {};
  players.forEach(p => stats[p] = { name: p, wins: 0, losses: 0, scored: 0, conceded: 0, played: 0 });

  const partnerships = {};
  const getPair = (a, b) => {
    const key = [a, b].sort().join("|");
    if (!partnerships[key]) partnerships[key] = { players: [a, b].sort(), wins: 0, losses: 0, matches: 0 };
    return partnerships[key];
  };

  rounds.forEach(r => r.forEach(m => {
    if (!m.played) return;
    const sA = Number(m.scoreA), sB = Number(m.scoreB);
    m.teamA.forEach(p => {
      if (!stats[p]) return;
      stats[p].played++; stats[p].scored += sA; stats[p].conceded += sB;
      if (sA > sB) stats[p].wins++; else stats[p].losses++;
    });
    m.teamB.forEach(p => {
      if (!stats[p]) return;
      stats[p].played++; stats[p].scored += sB; stats[p].conceded += sA;
      if (sB > sA) stats[p].wins++; else stats[p].losses++;
    });
    if (m.teamA.length === 2) {
      const pair = getPair(m.teamA[0], m.teamA[1]);
      pair.matches++; if (sA > sB) pair.wins++; else pair.losses++;
    }
    if (m.teamB.length === 2) {
      const pair = getPair(m.teamB[0], m.teamB[1]);
      pair.matches++; if (sB > sA) pair.wins++; else pair.losses++;
    }
  }));

  const playerList = Object.values(stats).filter(p => p.played > 0);

  // MVP = most wins
  const mvp = [...playerList].sort((a, b) => b.wins - a.wins || b.scored - a.scored)[0];
  // Best win rate (min 2 matches)
  const bestRate = [...playerList].filter(p => p.played >= 2)
    .sort((a, b) => (b.wins / b.played) - (a.wins / a.played))[0];
  // Top scorer
  const topScorer = [...playerList].sort((a, b) => b.scored - a.scored)[0];
  // Best partnership (min 2 matches)
  const bestPair = Object.values(partnerships).filter(p => p.matches >= 2)
    .sort((a, b) => (b.wins / b.matches) - (a.wins / a.matches))[0];

  return { mvp, bestRate, topScorer, bestPair };
}

export function TournamentAwards({ players, rounds, champion, profiles = {} }) {
  const awards = useMemo(() => computeAwards(players, rounds), [players, rounds]);
  if (!awards) return null;

  const { mvp, bestRate, topScorer, bestPair } = awards;
  const completedMatches = rounds.flat().filter(m => m.played).length;
  if (completedMatches < 2) return null;

  const items = [
    { icon: "⚡", label: "MVP", sub: "Most wins today", name: mvp?.name, val: `${mvp?.wins}W ${mvp?.losses}L` },
    { icon: "🎯", label: "BEST WIN RATE", sub: "Min 2 matches", name: bestRate?.name, val: bestRate ? `${Math.round((bestRate.wins / bestRate.played) * 100)}%` : "—" },
    { icon: "💥", label: "TOP SCORER", sub: "Most points scored", name: topScorer?.name, val: `${topScorer?.scored} pts` },
    { icon: "🤝", label: "BEST DUO", sub: bestPair ? `${bestPair.wins}W ${bestPair.losses}L in ${bestPair.matches} matches` : "Min 2 matches", name: bestPair?.players.join(" & ") || "—", val: bestPair ? `${Math.round((bestPair.wins / bestPair.matches) * 100)}%` : "" },
  ];

  return (
    <div className="fu glass-card" style={{ borderRadius: 16, padding: "1.2rem", marginBottom: 20, border: "1px solid rgba(241, 200, 53, 0.2)" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--color-gold)", marginBottom: 12, fontWeight: 600 }}>🏅 TOURNAMENT AWARDS</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map(({ icon, label, sub, name, val }) => (
          <div key={label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 9, letterSpacing: 1.5, color: "var(--color-muted)", fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 9, color: "var(--color-border)" }}>{sub}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              {name && name !== "—" && (
                <div style={{ display: "flex", gap: 2 }}>
                  {name.split(" & ").map((p, i) => (
                    <div key={p} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i }}>
                      <PlayerAvatar name={p} profile={profiles[p]} size={18} />
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "—"}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-lime)", marginTop: 2 }}>{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
