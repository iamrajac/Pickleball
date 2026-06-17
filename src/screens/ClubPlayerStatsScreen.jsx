import { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useClubDetail, useClubMemberProfiles, useClubFullHistory } from "../hooks/useClub";
import { computeCareerStats, getH2HBetween } from "../utils/careerStats";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { normalizePlayerName } from "../utils/players";

const G = {
  lime: "var(--color-lime)", gold: "var(--color-gold)", danger: "var(--color-danger)",
  muted: "var(--color-muted)", text: "var(--color-text)", border: "var(--color-border)",
  cyan: "var(--color-cyan)",
};

function ClubAvatar({ name, members, memberProfiles, size = 36 }) {
  const lname = normalizePlayerName(name);
  const member = members.find(m => normalizePlayerName(memberProfiles?.[m.uid]?.displayName || m.playerName || m.name || "") === lname);
  const live = member ? memberProfiles?.[member.uid] : null;
  const profile = live?.avatar || member?.avatar || (member?.photoURL ? { type: "image", value: member.photoURL } : null);
  return <PlayerAvatar name={name} profile={profile} size={size} expandable />;
}

function computeInsights(player) {
  const insights = [];
  if (!player) return insights;
  if (player.currentStreak >= 3 && player.streakType === "W")
    insights.push({ emoji: "🔥", text: `${player.currentStreak}-match winning streak — on fire!`, color: "#f97316" });
  else if (player.currentStreak >= 3 && player.streakType === "L")
    insights.push({ emoji: "😤", text: `${player.currentStreak}-match losing streak — time to bounce back`, color: "#ef4444" });
  if (player.nemesis?.matches >= 2)
    insights.push({ emoji: "😱", text: `${player.nemesis.name} beats them ${player.nemesis.theirWins}/${player.nemesis.matches} times`, color: "#ef4444" });
  if (player.bestPartner)
    insights.push({ emoji: "🤝", text: `Best with ${player.bestPartner.name} — ${player.bestPartner.winRate}% win rate together`, color: G.lime });
  if (player.tournamentsPlayed?.length >= 4) {
    const recent = player.tournamentsPlayed.slice(-3);
    const older = player.tournamentsPlayed.slice(-6, -3);
    if (older.length > 0) {
      const delta = Math.round(recent.reduce((s, t) => s + t.winRate, 0) / recent.length - older.reduce((s, t) => s + t.winRate, 0) / older.length);
      if (delta >= 10) insights.push({ emoji: "📈", text: `Win rate up ${delta}% over last 3 — improving!`, color: G.lime });
      else if (delta <= -10) insights.push({ emoji: "📉", text: `Win rate down ${Math.abs(delta)}% recently — keep grinding`, color: "#eab308" });
    }
  }
  if (player.titles >= 2) insights.push({ emoji: "🏆", text: `${player.titles} tournament titles — champion!`, color: G.gold });
  else if (player.titles === 1) insights.push({ emoji: "🥇", text: `Tournament champion! Defend that title`, color: G.gold });
  if (player.winRate >= 75) insights.push({ emoji: "👑", text: `${player.winRate}% win rate — elite level`, color: G.gold });
  else if (player.winRate >= 50) insights.push({ emoji: "💪", text: `${player.winRate}% win rate — solid`, color: G.lime });
  return insights;
}

export function ClubPlayerStatsScreen() {
  const { clubId, uid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTab = location.state?.fromTab || "members";
  const { club, members, tournaments, seasons, loading } = useClubDetail(clubId);
  const memberProfiles = useClubMemberProfiles(members);
  const fullHistory = useClubFullHistory(tournaments);
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [h2hTarget, setH2hTarget] = useState(null);

  if (loading || fullHistory === null) return (
    <div style={{ minHeight: "100vh", background: "var(--color-dark)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-muted)" }}>
      Loading...
    </div>
  );

  const member = members.find(m => m.uid === uid);
  if (!member) return null;

  const live = memberProfiles?.[uid];
  const playerName = live?.displayName || member.playerName || member.name;
  const avatarProfile = live?.avatar || member.avatar || (member.photoURL ? { type: "image", value: member.photoURL } : null);
  const themeColor = club?.themeColor || "var(--color-lime)";

  // Filter history by selected season
  const filteredHistory = selectedSeason === "all"
    ? fullHistory
    : (() => {
        const season = seasons.find(s => s.id === selectedSeason);
        const codes = new Set(season?.tournaments || []);
        return fullHistory.filter(t => codes.has(t.code));
      })();

  const stats = computeCareerStats(filteredHistory);
  const player = stats.players?.find(p => normalizePlayerName(p.name) === normalizePlayerName(playerName));
  const allPlayers = stats.players || [];
  const otherPlayers = allPlayers.filter(p => normalizePlayerName(p.name) !== normalizePlayerName(playerName));

  const winRate = player?.winRate ?? null;
  const diff = player ? player.scored - player.conceded : 0;
  const insights = computeInsights(player);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-dark)", paddingBottom: "2rem" }}>
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ padding: "0 1rem", display: "flex", alignItems: "center", gap: 12, height: 60 }}>
          <button onClick={() => navigate(`/clubs/${clubId}`, { state: { tab: returnTab } })} className="ni" style={{ background: "none", border: "none", color: "var(--color-muted)", display: "flex", alignItems: "center", cursor: "pointer" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: themeColor, letterSpacing: 2 }}>PLAYER PROFILE</div>
        </div>
      </div>

      <div style={{ padding: "1rem 1rem 2rem", maxWidth: 600, margin: "0 auto" }}>
        {/* Hero */}
        <div className="glass-card" style={{ borderRadius: 20, padding: "2rem", textAlign: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <PlayerAvatar name={playerName} profile={avatarProfile} size={72} expandable />
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: "var(--color-text)", letterSpacing: 2, lineHeight: 1 }}>{playerName}</div>
          <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 16, marginTop: 4 }}>
            {player ? `${player.tournaments} tournaments · ${player.matches} matches played` : "No data for this period"} · {club?.name}
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: winRate == null ? G.muted : winRate >= 60 ? G.lime : winRate >= 40 ? G.gold : G.danger, lineHeight: 1 }}>
            {winRate == null ? "—" : `${winRate}%`}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-muted)", letterSpacing: 2, marginBottom: 12 }}>WIN RATE</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
            {player?.titles > 0 && Array(player.titles).fill(0).map((_, i) => <span key={i} style={{ fontSize: 20 }}>🏆</span>)}
          </div>
        </div>

        {/* Season selector */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16, paddingBottom: 4 }}>
          {[{ id: "all", name: "All Time" }, ...seasons].map(s => (
            <button key={s.id} onClick={() => { setSelectedSeason(s.id); setH2hTarget(null); }}
              style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer",
                background: selectedSeason === s.id ? themeColor : "rgba(255,255,255,0.06)",
                color: selectedSeason === s.id ? "#0d0f0a" : "var(--color-muted)" }}>
              {s.name}
            </button>
          ))}
        </div>

        {!player ? (
          <div className="glass-card" style={{ borderRadius: 12, padding: "2rem", textAlign: "center", color: "var(--color-muted)" }}>
            No matches in this period
          </div>
        ) : (
          <>
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
            {insights.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 8, fontWeight: 600 }}>💡 INSIGHTS</div>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none" }}>
                  {insights.map((ins, i) => (
                    <div key={i} style={{ flexShrink: 0, maxWidth: 220, background: "var(--surface)", border: `1px solid ${ins.color}33`, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{ins.emoji}</span>
                      <span style={{ fontSize: 12, color: G.text, lineHeight: 1.4 }}>{ins.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Streaks */}
            <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 10, fontWeight: 600 }}>STREAKS</div>
              <div style={{ display: "flex", gap: 20, marginBottom: 10 }}>
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
              <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                {player.lastResults.slice(-15).map((r, i) => (
                  <div key={i} style={{ width: 16, height: 16, borderRadius: 3, background: r === "W" ? "#1a5c12" : "#5c1212", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: r === "W" ? "#6aff50" : "#ff5050", fontWeight: 700 }}>{r}</div>
                ))}
              </div>
            </div>

            {/* Head to Head */}
            {otherPlayers.length > 0 && (
              <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 12, fontWeight: 600 }}>HEAD-TO-HEAD</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {otherPlayers.map(op => (
                    <button key={op.name} onClick={() => setH2hTarget(h2hTarget === op.name ? null : op.name)} className="pb"
                      style={{ padding: "6px 12px", borderRadius: 20, border: `1px solid ${h2hTarget === op.name ? G.cyan : G.border}`, background: h2hTarget === op.name ? "rgba(53,200,241,0.15)" : "transparent", color: h2hTarget === op.name ? G.cyan : G.muted, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                      {op.name}
                    </button>
                  ))}
                </div>
                {h2hTarget ? (() => {
                  const rec = getH2HBetween(stats.h2h || {}, playerName, h2hTarget);
                  const total = rec.aWins + rec.bWins;
                  const aBar = total > 0 ? Math.round((rec.aWins / total) * 100) : 50;
                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: G.text }}>{playerName}</span>
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
                })() : <div style={{ fontSize: 12, color: G.muted }}>Select a player to see head-to-head record</div>}
              </div>
            )}

            {/* Nemesis */}
            {player.nemesis && (
              <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16, border: "1px solid rgba(239,68,68,0.25)" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 10, fontWeight: 600 }}>😤 NEMESIS</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <ClubAvatar name={player.nemesis.name} members={members} memberProfiles={memberProfiles} size={40} />
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
                        <ClubAvatar name={player.bestPartner.name} members={members} memberProfiles={memberProfiles} size={28} />
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
                        <ClubAvatar name={player.worstPartner.name} members={members} memberProfiles={memberProfiles} size={28} />
                        <div style={{ fontWeight: 600, fontSize: 13, color: G.text }}>{player.worstPartner.name}</div>
                      </div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: G.danger, lineHeight: 1 }}>{player.worstPartner.winRate}%</div>
                      <div style={{ fontSize: 10, color: G.muted }}>{player.worstPartner.matches} matches</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Win Rate Trend */}
            {player.tournamentsPlayed?.length > 1 && (
              <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem", marginBottom: 16 }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: G.muted, marginBottom: 12, fontWeight: 600 }}>📈 WIN RATE TREND</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 60, marginBottom: 8 }}>
                  {player.tournamentsPlayed.map((t, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <div style={{ fontSize: 9, color: t.winRate >= 60 ? G.lime : t.winRate >= 40 ? G.gold : G.danger, fontWeight: 700 }}>{t.winRate}%</div>
                      <div style={{ width: "100%", background: t.winRate >= 60 ? "rgba(16,212,142,0.8)" : t.winRate >= 40 ? "rgba(241,200,53,0.8)" : "rgba(239,68,68,0.8)", borderRadius: "4px 4px 0 0", height: `${Math.max(t.winRate * 0.44, 4)}px` }} />
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
                  const prev = player.tournamentsPlayed.slice(-6, -3);
                  if (recent.length < 2 || prev.length === 0) return null;
                  const delta = Math.round(recent.reduce((s, t) => s + t.winRate, 0) / recent.length - prev.reduce((s, t) => s + t.winRate, 0) / prev.length);
                  if (delta === 0) return null;
                  return <div style={{ marginTop: 8, fontSize: 12, color: delta > 0 ? G.lime : G.danger, fontWeight: 600 }}>{delta > 0 ? "↑" : "↓"} {Math.abs(delta)}% vs previous 3 tournaments — {delta > 0 ? "improving" : "declining"}</div>;
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
                      <div key={ri} style={{ flex: 1, minWidth: 60, background: "var(--surface)", borderRadius: 10, padding: "10px 8px", textAlign: "center", border: `1px solid ${G.border}` }}>
                        <div style={{ fontSize: 9, color: G.muted, letterSpacing: 1, marginBottom: 4 }}>R{Number(ri) + 1}</div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: wr >= 60 ? G.lime : wr >= 40 ? G.gold : G.danger, lineHeight: 1 }}>{wr}%</div>
                        <div style={{ fontSize: 9, color: G.muted, marginTop: 2 }}>{rs.wins}W {rs.losses}L</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
