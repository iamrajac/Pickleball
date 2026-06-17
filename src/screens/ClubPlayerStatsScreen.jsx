import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useClubDetail, useClubMemberProfiles } from "../hooks/useClub";
import { PlayerAvatar } from "../components/PlayerAvatar";

export function ClubPlayerStatsScreen() {
  const { clubId, uid } = useParams();
  const navigate = useNavigate();
  const { club, members, tournaments, seasons, loading } = useClubDetail(clubId);
  const memberProfiles = useClubMemberProfiles(members);
  const [selectedSeason, setSelectedSeason] = useState("all");

  if (loading) return (
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

  const completedTournaments = tournaments.filter(t => t.status === "completed");
  const filteredTournaments = selectedSeason === "all"
    ? completedTournaments
    : (() => {
        const season = seasons.find(s => s.id === selectedSeason);
        const codes = new Set(season?.tournaments || []);
        return completedTournaments.filter(t => codes.has(t.code));
      })();

  function computeStats(tourns) {
    let wins = 0, losses = 0, matches = 0, titles = 0;
    const lname = playerName.toLowerCase();
    tourns.forEach(t => {
      if (t.champion) {
        t.champion.split(" & ").map(s => s.trim().toLowerCase()).forEach(p => {
          if (p === lname) titles++;
        });
      }
      if (t.playerStats) {
        const entry = Object.entries(t.playerStats).find(([n]) => n.toLowerCase() === lname);
        if (entry) {
          wins += entry[1].wins || 0;
          losses += entry[1].losses || 0;
          matches += entry[1].matches || 0;
        }
      }
    });
    return { wins, losses, matches, titles };
  }

  const stats = computeStats(filteredTournaments);
  const winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;

  const playerTournaments = filteredTournaments
    .filter(t => t.playerStats && Object.keys(t.playerStats).some(n => n.toLowerCase() === playerName.toLowerCase()))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-dark)", paddingBottom: "2rem" }}>
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ padding: "0 1rem", display: "flex", alignItems: "center", gap: 12, height: 60 }}>
          <button onClick={() => navigate(-1)} className="ni" style={{ background: "none", border: "none", color: "var(--color-muted)", display: "flex", alignItems: "center", cursor: "pointer" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: themeColor, letterSpacing: 2 }}>
            CLUB STATS
          </div>
        </div>
      </div>

      <div style={{ padding: "1.5rem 1rem", maxWidth: 600, margin: "0 auto" }}>
        {/* Player header */}
        <div className="glass-card" style={{ borderRadius: 16, padding: "1.5rem", marginBottom: 20, textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <PlayerAvatar name={playerName} profile={avatarProfile} size={72} expandable />
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "var(--color-text)", letterSpacing: 2 }}>{playerName}</div>
          <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{club?.name}</div>
        </div>

        {/* Season selector */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 20, paddingBottom: 4 }}>
          {[{ id: "all", name: "All Time" }, ...seasons].map(s => (
            <button key={s.id} onClick={() => setSelectedSeason(s.id)}
              style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "none", fontWeight: 700, fontSize: 12, cursor: "pointer",
                background: selectedSeason === s.id ? themeColor : "rgba(255,255,255,0.06)",
                color: selectedSeason === s.id ? "#0d0f0a" : "var(--color-muted)" }}>
              {s.name}
            </button>
          ))}
        </div>

        {/* Stats overview */}
        <div className="glass-card" style={{ borderRadius: 14, padding: "1.2rem", marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, textAlign: "center" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--color-gold)", lineHeight: 1 }}>{stats.titles}</div>
              <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1, marginTop: 4 }}>TITLES</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--color-lime)", lineHeight: 1 }}>{stats.wins}</div>
              <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1, marginTop: 4 }}>WINS</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--color-muted)", lineHeight: 1 }}>{stats.losses}</div>
              <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1, marginTop: 4 }}>LOSSES</div>
            </div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: stats.matches > 0 ? (winRate >= 50 ? "var(--color-lime)" : "var(--color-danger)") : "var(--color-muted)", lineHeight: 1 }}>{winRate}%</div>
              <div style={{ fontSize: 9, color: "var(--color-muted)", letterSpacing: 1, marginTop: 4 }}>WIN RATE</div>
            </div>
          </div>
        </div>

        {/* Tournament history */}
        <div style={{ fontSize: 11, color: "var(--color-muted)", letterSpacing: 1, fontWeight: 700, marginBottom: 10 }}>TOURNAMENTS</div>
        {playerTournaments.length === 0 ? (
          <div className="glass-card" style={{ borderRadius: 12, padding: "2rem", textAlign: "center", color: "var(--color-muted)", fontSize: 13 }}>
            No tournaments in this period
          </div>
        ) : playerTournaments.map(t => {
          const lname = playerName.toLowerCase();
          const pStats = Object.entries(t.playerStats || {}).find(([n]) => n.toLowerCase() === lname)?.[1];
          const isChamp = t.champion?.toLowerCase().split(" & ").some(p => p.trim() === lname);
          return (
            <div key={t.code} className="rh glass-card"
              style={{ borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer", border: isChamp ? "1px solid rgba(241,200,53,0.3)" : undefined, background: isChamp ? "rgba(241,200,53,0.04)" : undefined }}
              onClick={() => navigate("/history/detail", { state: { tournament: t } })}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "var(--color-text)" }}>
                    {isChamp ? "🏆 " : ""}{t.name || `#${t.code}`}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 2 }}>
                    {t.date ? new Date(t.date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : ""}
                    {" · "}{t.playerCount} players
                  </div>
                </div>
                {pStats && (
                  <div style={{ display: "flex", gap: 14, textAlign: "center" }}>
                    <div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--color-lime)", lineHeight: 1 }}>{pStats.wins}</div>
                      <div style={{ fontSize: 9, color: "var(--color-muted)" }}>W</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--color-muted)", lineHeight: 1 }}>{pStats.losses}</div>
                      <div style={{ fontSize: 9, color: "var(--color-muted)" }}>L</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
