import { useState, useMemo } from "react";
import { loadH } from "../utils/history";
import { computeCareerStats, getH2HBetween } from "../utils/careerStats";
import { ACOLORS } from "../utils/theme";
import { ArrowLeft, Trophy, Zap, Users, Target, TrendingUp, Award } from "lucide-react";

// G is computed per render based on theme
const getG = (theme) => ({
  lime:   theme === 'light' ? "#1e3a5f" : "var(--color-lime)",
  accent: theme === 'light' ? "#c2410c" : "var(--color-lime)",
  cyan:   theme === 'light' ? "#0369a1" : "var(--color-cyan)",
  gold:   theme === 'light' ? "#b45309" : "var(--color-gold)",
  danger: theme === 'light' ? "#dc2626" : "var(--color-danger)",
  muted:  theme === 'light' ? "#64748b" : "var(--color-muted)",
  text:   theme === 'light' ? "#0f172a" : "var(--color-text)",
  border: theme === 'light' ? "#e2e8f0" : "var(--color-border)",
});

function StatCard({ icon, label, value, sub, color, G = {} }) {
  const muted = G.muted || "var(--color-muted)";
  return (
    <div className="glass-card fu" style={{ borderRadius: 14, padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, letterSpacing: 2, color: muted, fontWeight: 600 }}>
        {icon} {label}
      </div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: color || G.lime || "var(--color-lime)", lineHeight: 1, letterSpacing: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: muted }}>{sub}</div>}
    </div>
  );
}

function Avatar({ name, size = 36, index = 0 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: ACOLORS[index % ACOLORS.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "#0d0f0a", flexShrink: 0 }}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

function PlayerCard({ player, rank, onClick, isSelected, G }) {
  const winPct = player.winRate;
  const diff = player.scored - player.conceded;
  return (
    <div className="rh glass-card fu" onClick={onClick}
      style={{ borderRadius: 14, padding: "1rem 1.2rem", cursor: "pointer", border: `1px solid ${isSelected ? G.lime : G.border}`, transition: "all 0.2s", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: rank <= 3 ? G.lime : G.muted, width: 28, textAlign: "center" }}>
          {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
        </div>
        <Avatar name={player.name} index={rank - 1} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: G.text }}>{player.name}</div>
          <div style={{ fontSize: 11, color: G.muted }}>{player.tournaments} tournaments · {player.matches} matches</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: winPct >= 60 ? G.lime : winPct >= 40 ? G.gold : G.danger, lineHeight: 1 }}>{winPct}%</div>
          <div style={{ fontSize: 10, color: G.muted }}>WIN RATE</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${G.border}` }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "#6aaa50" }}>{player.wins}</div>
          <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1 }}>WINS</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: G.danger }}>{player.losses}</div>
          <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1 }}>LOSSES</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: diff >= 0 ? G.lime : G.danger }}>{diff > 0 ? "+" : ""}{diff}</div>
          <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1 }}>+/-</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: G.gold }}>{player.titles}</div>
          <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1 }}>TITLES</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: player.streakType === "W" ? G.lime : G.danger }}>
            {player.currentStreak}{player.streakType}
          </div>
          <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1 }}>STREAK</div>
        </div>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div style={{ display: "flex", gap: 2, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {player.lastResults.slice(-8).map((r, i) => (
              <div key={i} style={{ width: 13, height: 13, borderRadius: 3, background: r === "W" ? "#1a5c12" : "#5c1212", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: r === "W" ? "#6aff50" : "#ff5050", fontWeight: 700 }}>{r}</div>
            ))}
          </div>
          <div style={{ fontSize: 9, color: G.muted, marginTop: 2, letterSpacing: 1 }}>RECENT FORM</div>
        </div>
      </div>
    </div>
  );
}

function PlayerDetail({ player, allPlayers, h2h, onClose, theme = 'dark' }) {
  const G = getG(theme);
  const [h2hTarget, setH2hTarget] = useState(null);
  const otherPlayers = allPlayers.filter(p => p.name !== player.name);
  const winRate = player.winRate;
  const diff = player.scored - player.conceded;

  return (
    <div className="fu" style={{ position: "fixed", inset: 0, background: "var(--color-dark)", zIndex: 100, overflowY: "auto", padding: "1rem" }}>
      <div style={{ maxWidth: 500, margin: "0 auto", paddingBottom: "3rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingTop: "1rem" }}>
          <button onClick={onClose} className="ni" style={{ background: "none", border: "none", color: G.muted, display: "flex", alignItems: "center" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: G.lime, letterSpacing: 2 }}>PLAYER PROFILE</div>
        </div>

        {/* Hero */}
        <div className="glass-card" style={{ borderRadius: 20, padding: "2rem", textAlign: "center", marginBottom: 16, border: `1px solid ${G.border}` }}>
          <Avatar name={player.name} size={72} index={allPlayers.indexOf(player)} />
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, color: G.text, letterSpacing: 2, marginTop: 12, lineHeight: 1 }}>{player.name}</div>
          <div style={{ fontSize: 12, color: G.muted, marginBottom: 16 }}>{player.tournaments} tournaments · {player.matches} matches played</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: winRate >= 60 ? G.lime : winRate >= 40 ? G.gold : G.danger, lineHeight: 1 }}>{winRate}%</div>
          <div style={{ fontSize: 11, color: G.muted, letterSpacing: 2, marginBottom: 16 }}>WIN RATE</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
            {player.titles > 0 && Array(player.titles).fill(0).map((_, i) => <span key={i} style={{ fontSize: 20 }}>🏆</span>)}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { l: "WINS", v: player.wins, c: "#6aaa50" },
            { l: "LOSSES", v: player.losses, c: G.danger },
            { l: "TITLES", v: player.titles, c: G.gold },
            { l: "PTS SCORED", v: player.scored, c: G.lime },
            { l: "PTS/MATCH", v: player.avgScore, c: G.cyan },
            { l: "+/-", v: (diff > 0 ? "+" : "") + diff, c: diff >= 0 ? G.lime : G.danger },
          ].map(({ l, v, c }) => (
            <div key={l} className="glass-card" style={{ borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: c, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Streak */}
        <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 10, fontWeight: 600 }}>STREAKS</div>
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: player.streakType === "W" ? G.lime : G.danger, lineHeight: 1 }}>
                {player.currentStreak}{player.streakType}
              </div>
              <div style={{ fontSize: 10, color: G.muted }}>CURRENT STREAK</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: G.gold, lineHeight: 1 }}>{player.bestStreak}W</div>
              <div style={{ fontSize: 10, color: G.muted }}>BEST WIN STREAK</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 2, marginTop: 10, flexWrap: "wrap" }}>
            {player.lastResults.slice(-15).map((r, i) => (
              <div key={i} style={{ width: 16, height: 16, borderRadius: 3, background: r === "W" ? "#1a5c12" : "#5c1212", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: r === "W" ? "#6aff50" : "#ff5050", fontWeight: 700 }}>{r}</div>
            ))}
          </div>
        </div>

        {/* Head to head */}
        <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 12, fontWeight: 600 }}>HEAD-TO-HEAD</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {otherPlayers.map(op => (
              <button key={op.name} onClick={() => setH2hTarget(h2hTarget === op.name ? null : op.name)}
                className="pb"
                onMouseEnter={e => { if(h2hTarget !== op.name) { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.borderColor = 'var(--color-cyan)'; }}}
                onMouseLeave={e => { if(h2hTarget !== op.name) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}}
                style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${h2hTarget === op.name ? G.cyan : G.border}`, background: h2hTarget === op.name ? "rgba(53,200,241,0.15)" : "transparent", color: h2hTarget === op.name ? G.cyan : G.muted, fontSize: 12, cursor: "pointer", fontWeight: 500, transition: "all 0.15s" }}>
                {op.name}
              </button>
            ))}
          </div>
          {h2hTarget && (() => {
            const rec = getH2HBetween(h2h, player.name, h2hTarget);
            const total = rec.aWins + rec.bWins;
            const aBar = total > 0 ? Math.round((rec.aWins / total) * 100) : 50;
            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, color: G.text }}>{player.name}</span>
                  <span style={{ fontWeight: 600, color: G.text }}>{h2hTarget}</span>
                </div>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${aBar}%`, background: G.lime, transition: "width 0.5s" }} />
                  <div style={{ flex: 1, background: G.danger }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: G.lime }}>{rec.aWins}W</span>
                  <span style={{ fontSize: 12, color: G.muted }}>{total} matches</span>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: G.danger }}>{rec.bWins}W</span>
                </div>
              </div>
            );
          })()}
          {!h2hTarget && <div style={{ fontSize: 12, color: G.muted }}>Select a player to see head-to-head record</div>}
        </div>
      </div>
    </div>
  );
}

export function CareerScreen({ onBack, theme = 'dark' }) {
  const history = loadH();
  const stats = useMemo(() => computeCareerStats(history), []);
  const [tab, setTab] = useState("players");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const G = getG(theme);

  if (selectedPlayer) {
    return <PlayerDetail player={selectedPlayer} allPlayers={stats.players} h2h={stats.h2h} onClose={() => setSelectedPlayer(null)} theme={theme} />;
  }

  const { players, partnerships, records, totalTournaments, totalMatches } = stats;
  const mvp = players[0];
  const topScorer = [...players].sort((a, b) => b.scored - a.scored)[0];
  const mostTitles = [...players].sort((a, b) => b.titles - a.titles)[0];
  const longestStreak = [...players].sort((a, b) => b.bestStreak - a.bestStreak)[0];
  const bestPartner = partnerships[0];

  return (
    <div style={{ padding: "0 1rem 4rem" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div className="fu" style={{ paddingTop: "2.5rem", paddingBottom: "1.5rem", display: "flex", alignItems: "center", gap: 16 }}>
          <button className="pb glass" onClick={onBack} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "var(--radius-sm)", border: `1px solid ${G.border}`, color: G.text }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: G.lime, letterSpacing: 2, lineHeight: 1 }}>CAREER STATS</div>
            <div style={{ fontSize: 12, color: G.muted }}>{totalTournaments} tournaments · {totalMatches} total matches</div>
          </div>
        </div>

        {players.length === 0 ? (
          <div className="fu glass-card" style={{ padding: "4rem 2rem", textAlign: "center", borderRadius: "var(--radius-lg)" }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📊</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: G.border, letterSpacing: 2 }}>NO DATA YET</div>
            <div style={{ fontSize: 14, color: G.muted, marginTop: 8 }}>Complete tournaments to see career stats.</div>
          </div>
        ) : (
          <>
            {/* Hall of fame */}
            <div className="fu" style={{ animationDelay: ".05s", marginBottom: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 10, fontWeight: 600 }}>🏅 HALL OF FAME</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { icon: "🏆", label: "MOST TITLES", name: mostTitles?.name, val: `${mostTitles?.titles || 0} titles` },
                  { icon: "🎯", label: "BEST WIN RATE", name: mvp?.name, val: `${mvp?.winRate || 0}%` },
                  { icon: "⚡", label: "LONGEST STREAK", name: longestStreak?.name, val: `${longestStreak?.bestStreak || 0}W streak` },
                  { icon: "💥", label: "TOP SCORER", name: topScorer?.name, val: `${topScorer?.scored || 0} pts` },
                ].map(({ icon, label, name, val }) => (
                  <div key={label} className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.1rem", display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 28 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 1.5, color: G.muted, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginTop: 2 }}>{name || "—"}</div>
                      <div style={{ fontSize: 11, color: G.lime }}>{val}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Records */}
            {records.highestScoringMatch && (
              <div className="fu glass-card" style={{ animationDelay: ".08s", borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 20 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 10, fontWeight: 600 }}>🔥 ALL-TIME RECORDS</div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: G.muted }}>Highest Scoring Match</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: G.text, marginTop: 2 }}>
                      {records.highestScoringMatch.teamA.join(" & ")} vs {records.highestScoringMatch.teamB.join(" & ")}
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: G.lime }}>
                      {records.highestScoringMatch.scoreA}–{records.highestScoringMatch.scoreB}
                    </div>
                  </div>
                  {records.biggestComeback && (
                    <div>
                      <div style={{ fontSize: 11, color: G.muted }}>Biggest Margin</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: G.text, marginTop: 2 }}>
                        {records.biggestComeback.scoreA > records.biggestComeback.scoreB
                          ? records.biggestComeback.teamA.join(" & ")
                          : records.biggestComeback.teamB.join(" & ")} won by {records.biggestComeback.diff}
                      </div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: G.gold }}>
                        {records.biggestComeback.scoreA}–{records.biggestComeback.scoreB}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--color-surface)", borderRadius: "var(--radius-sm)", padding: 4 }}>
              {[{ id: "players", label: "👤 PLAYERS" }, { id: "partnerships", label: "🤝 PARTNERSHIPS" }].map(t => (
                <button key={t.id} className={`tab-btn ${tab === t.id ? "on" : "off"}`} onClick={() => setTab(t.id)} style={{ flex: 1 }}>{t.label}</button>
              ))}
            </div>

            {tab === "players" && (
              <div>
                {players.map((p, i) => (
                  <PlayerCard key={p.name} player={p} rank={i + 1} onClick={() => setSelectedPlayer(p)} isSelected={false} G={G} />
                ))}
              </div>
            )}

            {tab === "partnerships" && (
              <div>
                {partnerships.length === 0 ? (
                  <div className="glass-card" style={{ textAlign: "center", padding: "3rem", borderRadius: "var(--radius-lg)", color: G.muted }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
                    <div>Need at least 2 matches as partners to show stats</div>
                  </div>
                ) : partnerships.map((pair, i) => {
                  if (!G) return null;
                  const wr = Math.round((pair.wins / pair.matches) * 100);
                  const diff = pair.scored - pair.conceded;
                  return (
                    <div key={i} className="glass-card fu" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: i < 3 ? G.lime : G.muted, width: 24 }}>{i + 1}</div>
                        <div style={{ display: "flex", gap: -8 }}>
                          <Avatar name={pair.players[0]} size={32} index={i * 2} />
                          <Avatar name={pair.players[1]} size={32} index={i * 2 + 1} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: G.text }}>{pair.players.join(" & ")}</div>
                          <div style={{ fontSize: 11, color: G.muted }}>{pair.matches} matches together</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: wr >= 60 ? G.lime : wr >= 40 ? G.gold : G.danger, lineHeight: 1 }}>{wr}%</div>
                          <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1 }}>WIN RATE</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${G.border}` }}>
                        <div><div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#6aaa50" }}>{pair.wins}W</div><div style={{ fontSize: 9, color: G.muted }}>WINS</div></div>
                        <div><div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: G.danger }}>{pair.losses}L</div><div style={{ fontSize: 9, color: G.muted }}>LOSSES</div></div>
                        <div><div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: diff >= 0 ? G.lime : G.danger }}>{diff > 0 ? "+" : ""}{diff}</div><div style={{ fontSize: 9, color: G.muted }}>+/-</div></div>
                        <div><div style={{ fontSize: 12, color: G.text }}>{pair.scored}</div><div style={{ fontSize: 9, color: G.muted }}>SCORED</div></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
