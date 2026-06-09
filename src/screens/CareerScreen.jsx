import { useState, useMemo, useEffect } from "react";
import { getAuth } from "firebase/auth";
import { loadH } from "../utils/history";
import { fetchUserTournaments } from "../hooks/useTournament";
import { computeCareerStats, getH2HBetween } from "../utils/careerStats";
import { ACOLORS } from "../utils/theme";
import { ArrowLeft, Trophy, Zap, Users, Target, TrendingUp, Award } from "lucide-react";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { getGlobalProfiles } from "../utils/globalProfiles";
import { normalizePlayerName } from "../utils/players";

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
  const profile = getGlobalProfiles()[normalizePlayerName(name)];
  return <PlayerAvatar name={name} profile={profile} size={size} fallbackIndex={index} />;
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

// ── AI-style insight generator ────────────────────────────────────────────
function computeInsights(player) {
  const insights = [];
  if (!player) return insights;

  // Streak
  if (player.currentStreak >= 3 && player.streakType === "W")
    insights.push({ emoji: "🔥", text: `${player.currentStreak}-match winning streak — you're on fire!`, color: "#f97316" });
  else if (player.currentStreak >= 3 && player.streakType === "L")
    insights.push({ emoji: "😤", text: `${player.currentStreak}-match losing streak — time to bounce back`, color: "#ef4444" });

  // Nemesis
  if (player.nemesis && player.nemesis.matches >= 2)
    insights.push({ emoji: "😱", text: `${player.nemesis.name} beats you ${player.nemesis.theirWins}/${player.nemesis.matches} times — your kryptonite`, color: "#ef4444" });

  // Best partner
  if (player.bestPartner)
    insights.push({ emoji: "🤝", text: `Best with ${player.bestPartner.name} — ${player.bestPartner.winRate}% win rate together`, color: "var(--color-lime)" });

  // Win rate trend
  if (player.tournamentsPlayed?.length >= 4) {
    const recent = player.tournamentsPlayed.slice(-3);
    const older = player.tournamentsPlayed.slice(-6, -3);
    const recentAvg = recent.reduce((s, t) => s + t.winRate, 0) / recent.length;
    const olderAvg = older.reduce((s, t) => s + t.winRate, 0) / older.length;
    const delta = Math.round(recentAvg - olderAvg);
    if (delta >= 10) insights.push({ emoji: "📈", text: `Win rate up ${delta}% over last 3 tournaments — improving!`, color: "var(--color-lime)" });
    else if (delta <= -10) insights.push({ emoji: "📉", text: `Win rate down ${Math.abs(delta)}% recently — keep grinding`, color: "#eab308" });
  }

  // Best round
  const roundEntries = Object.entries(player.roundStats || {});
  if (roundEntries.length >= 2) {
    const best = roundEntries.reduce((b, r) => {
      const wr = r[1].wins / (r[1].wins + r[1].losses);
      return wr > (b[1].wins / (b[1].wins + b[1].losses)) ? r : b;
    });
    const wr = Math.round(best[1].wins / (best[1].wins + best[1].losses) * 100);
    if (wr >= 60) insights.push({ emoji: "🎯", text: `Strongest in Round ${Number(best[0]) + 1} — ${wr}% win rate`, color: "var(--color-cyan)" });
  }

  // Titles
  if (player.titles >= 2) insights.push({ emoji: "🏆", text: `${player.titles} tournament titles — champion mentality!`, color: "var(--color-gold)" });
  else if (player.titles === 1) insights.push({ emoji: "🥇", text: `Tournament champion! Now defend that title`, color: "var(--color-gold)" });

  // Best tournament
  if (player.tournamentsPlayed?.length > 0) {
    const best = [...player.tournamentsPlayed].sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)[0];
    if (best.winRate === 100 && best.wins >= 2) insights.push({ emoji: "💥", text: `Perfect tournament: ${best.name || "unnamed"} — ${best.wins}W 0L`, color: "var(--color-lime)" });
  }

  // Win rate label
  if (player.winRate >= 75) insights.push({ emoji: "👑", text: `${player.winRate}% overall win rate — elite level`, color: "var(--color-gold)" });
  else if (player.winRate >= 50) insights.push({ emoji: "💪", text: `${player.winRate}% win rate — more wins than losses, solid`, color: "var(--color-lime)" });
  else if (player.matches >= 5) insights.push({ emoji: "🏋️", text: `${player.winRate}% win rate — room to grow, keep competing`, color: "#eab308" });

  return insights;
}

function InsightStrip({ insights, G }) {
  if (!insights.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 8, fontWeight: 600 }}>💡 INSIGHTS</div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ flexShrink: 0, maxWidth: 220, background: "rgba(255,255,255,0.04)", border: `1px solid ${ins.color}33`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{ins.emoji}</span>
            <span style={{ fontSize: 12, color: G.text, lineHeight: 1.4 }}>{ins.text}</span>
          </div>
        ))}
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
  const insights = computeInsights(player);

  return (
    <div className="fu" style={{ minHeight: "100vh", background: "var(--bg)", overflowY: "auto", padding: "1rem 1rem 90px" }}>
      <div style={{ maxWidth: 500, margin: "0 auto" }}>
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
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: winRate == null ? G.muted : winRate >= 60 ? G.lime : winRate >= 40 ? G.gold : G.danger, lineHeight: 1 }}>{winRate == null ? "—" : `${winRate}%`}</div>
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

        {/* Insights */}
        <InsightStrip insights={insights} G={G} />

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

        {/* Nemesis */}
        {player.nemesis && (
          <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16, border: "1px solid rgba(239,68,68,0.25)" }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 10, fontWeight: 600 }}>😤 NEMESIS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar name={player.nemesis.name} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: G.danger }}>{player.nemesis.name}</div>
                <div style={{ fontSize: 12, color: G.muted }}>beats you {player.nemesis.theirWins}/{player.nemesis.matches} times</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: G.danger, lineHeight: 1 }}>
                  {Math.round((player.nemesis.theirWins / player.nemesis.matches) * 100)}%
                </div>
                <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1 }}>THEIR WIN RATE vs YOU</div>
              </div>
            </div>
          </div>
        )}

        {/* Partner Analytics */}
        {(player.bestPartner || player.worstPartner) && (
          <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 12, fontWeight: 600 }}>🤝 PARTNER ANALYTICS</div>
            <div style={{ display: "flex", gap: 10 }}>
              {player.bestPartner && (
                <div style={{ flex: 1, background: "rgba(16,212,142,0.08)", borderRadius: 10, padding: "12px", border: "1px solid rgba(16,212,142,0.2)" }}>
                  <div style={{ fontSize: 9, color: G.lime, letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>✅ BEST PARTNER</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Avatar name={player.bestPartner.name} size={28} />
                    <div style={{ fontWeight: 600, fontSize: 13, color: G.text }}>{player.bestPartner.name}</div>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: G.lime, lineHeight: 1 }}>{player.bestPartner.winRate}%</div>
                  <div style={{ fontSize: 10, color: G.muted }}>{player.bestPartner.matches} matches</div>
                </div>
              )}
              {player.worstPartner && (
                <div style={{ flex: 1, background: "rgba(239,68,68,0.06)", borderRadius: 10, padding: "12px", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div style={{ fontSize: 9, color: G.danger, letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>⚠️ AVOID WITH</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Avatar name={player.worstPartner.name} size={28} />
                    <div style={{ fontWeight: 600, fontSize: 13, color: G.text }}>{player.worstPartner.name}</div>
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: G.danger, lineHeight: 1 }}>{player.worstPartner.winRate}%</div>
                  <div style={{ fontSize: 10, color: G.muted }}>{player.worstPartner.matches} matches</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Win Rate Trend — per tournament */}
        {player.tournamentsPlayed?.length > 1 && (
          <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 12, fontWeight: 600 }}>📈 WIN RATE TREND</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60, marginBottom: 8 }}>
              {player.tournamentsPlayed.map((t, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ fontSize: 9, color: t.winRate >= 60 ? G.lime : t.winRate >= 40 ? G.gold : G.danger, fontWeight: 700 }}>{t.winRate}%</div>
                  <div style={{ width: "100%", background: t.winRate >= 60 ? "rgba(16,212,142,0.8)" : t.winRate >= 40 ? "rgba(241,200,53,0.8)" : "rgba(239,68,68,0.8)", borderRadius: "4px 4px 0 0", height: `${Math.max(t.winRate * 0.44, 4)}px`, transition: "height 0.4s" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {player.tournamentsPlayed.map((t, i) => (
                <div key={i} style={{ flex: 1, fontSize: 8, color: G.muted, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.name?.slice(0, 6) || `T${i + 1}`}
                </div>
              ))}
            </div>
            {(() => {
              const recent = player.tournamentsPlayed.slice(-3);
              if (recent.length < 2) return null;
              const avg = recent.reduce((s, t) => s + t.winRate, 0) / recent.length;
              const prev = player.tournamentsPlayed.slice(-6, -3);
              if (prev.length === 0) return null;
              const prevAvg = prev.reduce((s, t) => s + t.winRate, 0) / prev.length;
              const delta = Math.round(avg - prevAvg);
              if (delta === 0) return null;
              return (
                <div style={{ marginTop: 8, fontSize: 12, color: delta > 0 ? G.lime : G.danger, fontWeight: 600 }}>
                  {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}% vs previous 3 tournaments — {delta > 0 ? "improving" : "declining"}
                </div>
              );
            })()}
          </div>
        )}

        {/* Performance by Round */}
        {Object.keys(player.roundStats || {}).length > 0 && (
          <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 12, fontWeight: 600 }}>🎯 PERFORMANCE BY ROUND</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Object.entries(player.roundStats).sort((a, b) => Number(a[0]) - Number(b[0])).map(([ri, rs]) => {
                const total = rs.wins + rs.losses;
                const wr = total > 0 ? Math.round((rs.wins / total) * 100) : 0;
                return (
                  <div key={ri} style={{ flex: 1, minWidth: 60, background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 8px", textAlign: "center", border: `1px solid ${G.border}` }}>
                    <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1, marginBottom: 4 }}>R{Number(ri) + 1}</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: wr >= 60 ? G.lime : wr >= 40 ? G.gold : G.danger, lineHeight: 1 }}>{wr}%</div>
                    <div style={{ fontSize: 9, color: G.muted, marginTop: 2 }}>{rs.wins}W {rs.losses}L</div>
                  </div>
                );
              })}
            </div>
            {(() => {
              const rounds = Object.entries(player.roundStats).sort((a, b) => Number(a[0]) - Number(b[0]));
              if (rounds.length < 2) return null;
              const best = rounds.reduce((b, r) => { const wr = r[1].wins / (r[1].wins + r[1].losses); return wr > (b[1].wins / (b[1].wins + b[1].losses)) ? r : b; });
              return <div style={{ marginTop: 8, fontSize: 12, color: G.muted }}>Strongest in <span style={{ color: G.lime, fontWeight: 600 }}>Round {Number(best[0]) + 1}</span> — {Math.round(best[1].wins / (best[1].wins + best[1].losses) * 100)}% win rate</div>;
            })()}
          </div>
        )}

      </div>
    </div>
  );
}

export function CareerScreen({ onBack, theme = 'dark' }) {
  const [history, setHistory] = useState(() => loadH());
  const [currentUserName, setCurrentUserName] = useState(null);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    fetchUserTournaments(uid).then(list => {
      if (list && list.length > 0) setHistory(list);
    });
    // Load display name for current user
    import("firebase/firestore").then(({ doc, getDoc }) => {
      import("../firebase").then(({ firestore }) => {
        // Read from players/{uid} first (in-app saved name), fall back to users/{uid}
        getDoc(doc(firestore, "players", uid)).then(snap => {
          if (snap.exists() && snap.data().displayName) {
            setCurrentUserName(snap.data().displayName);
          } else {
            getDoc(doc(firestore, "users", uid)).then(s => {
              if (s.exists()) setCurrentUserName(s.data().name || null);
            });
          }
        });
      });
    });
  }, []);

  const stats = useMemo(() => computeCareerStats(history), [history]);
  const [tab, setTab] = useState("players");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const G = getG(theme);

  if (selectedPlayer) {
    return <PlayerDetail player={selectedPlayer} allPlayers={stats.players || []} h2h={stats.h2h || {}} onClose={() => setSelectedPlayer(null)} theme={theme} />;
  }

  const { players = [], partnerships = [], records = {}, totalTournaments = 0, totalMatches = 0 } = stats;
  const mvp = players[0];
  const topScorer = [...players].sort((a, b) => b.scored - a.scored)[0];
  const mostTitles = [...players].sort((a, b) => b.titles - a.titles)[0];
  const longestStreak = [...players].sort((a, b) => b.bestStreak - a.bestStreak)[0];
  const bestPartner = partnerships[0];

  return (
    <div style={{ padding: "0 1rem 4rem" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Header */}
        <div className="fu" style={{ paddingTop: "2.5rem", paddingBottom: "1.5rem" }}>
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

            {/* Personal insight strip for current user */}
            {(() => {
              const me = currentUserName && stats.players?.find(p => normalizePlayerName(p.name) === normalizePlayerName(currentUserName));
              if (!me) return null;
              const ins = computeInsights(me);
              if (!ins.length) return null;
              return (
                <div className="fu" style={{ animationDelay: ".06s", marginBottom: 20 }}>
                  <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 8, fontWeight: 600 }}>💡 YOUR INSIGHTS</div>
                  <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
                    {ins.map((insight, i) => (
                      <div key={i} style={{ flexShrink: 0, maxWidth: 200, background: "rgba(255,255,255,0.04)", border: `1px solid ${insight.color}33`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{insight.emoji}</span>
                        <span style={{ fontSize: 12, color: G.text, lineHeight: 1.4 }}>{insight.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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
