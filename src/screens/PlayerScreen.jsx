import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { firestore } from "../firebase";
import { ArrowLeft, Trophy, Zap, Target, TrendingUp, Users } from "lucide-react";
import { getPlayerByUsername, computeBadges, BADGES } from "../utils/playerProfile";
import { computeCareerStats } from "../utils/careerStats";
import { fromFirestoreDoc } from "../hooks/useTournament";
import { PlayerAvatar } from "../components/PlayerAvatar";

// ── Stat pill ───────────────────────────────────────────────────────────────

function StatPill({ label, value, color }) {
  return (
    <div className="card" style={{ padding: "14px 12px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: color || "var(--accent)", letterSpacing: 1, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ── Badge chip ───────────────────────────────────────────────────────────────

function BadgeChip({ badge }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "6px 12px", borderRadius: "var(--radius-full)",
      background: "var(--accent-dim)", border: "1px solid var(--accent)",
      fontSize: 12, fontWeight: 600, color: "var(--accent)",
    }}>
      <span>{badge.emoji}</span> {badge.label}
    </div>
  );
}

// ── H2H row ──────────────────────────────────────────────────────────────────

function H2HRow({ name, wins, losses, total }) {
  const rate = total > 0 ? Math.round((wins / total) * 100) : 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 0", borderBottom: "1px solid var(--border)",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%",
        background: "var(--surface)", border: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", flexShrink: 0,
      }}>
        {name[0]?.toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{name}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{wins}W – {losses}L · {total} played</div>
      </div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 22,
        color: rate >= 50 ? "var(--accent)" : "var(--danger)", letterSpacing: 1,
      }}>
        {rate}%
      </div>
    </div>
  );
}

// ── Tournament row ───────────────────────────────────────────────────────────

function TournamentRow({ t, playerName }) {
  const isChampion = t.champion && t.champion.toLowerCase().includes(playerName.toLowerCase());
  const date = t.date ? new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 0", borderBottom: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 20 }}>{isChampion ? "🏆" : "🎯"}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
          {t.name || `#${t.code}`}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{date}</div>
      </div>
      {isChampion && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "var(--gold)", background: "var(--gold-dim)", padding: "3px 8px", borderRadius: "var(--radius-full)" }}>
          CHAMPION
        </span>
      )}
    </div>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export function PlayerScreen() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [h2hList, setH2hList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    loadProfile();
  }, [username]);

  async function loadProfile() {
    setLoading(true);
    const player = await getPlayerByUsername(username);
    if (!player) { setNotFound(true); setLoading(false); return; }
    setProfile(player);

    // Fetch their tournament history
    try {
      const snap = await getDocs(collection(firestore, "users", player.uid, "tournaments"));
      const history = snap.docs.map(d => fromFirestoreDoc(d.data()))
        .filter(t => t.rounds?.length > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      setTournaments(history.slice(0, 10));

      // Compute career stats
      const career = computeCareerStats(history);
      const playerName = player.displayName || player.username;
      const playerStats = career.players.find(p =>
        p.name.toLowerCase() === playerName.toLowerCase()
      );
      if (playerStats) {
        setStats(playerStats);
        // Build H2H list
        const h2hEntries = Object.values(career.h2h)
          .filter(r => r.players.some(p => p.toLowerCase() === playerName.toLowerCase()) && r.matches >= 1)
          .map(r => {
            const iFirst = r.players[0].toLowerCase() === playerName.toLowerCase();
            const opp = iFirst ? r.players[1] : r.players[0];
            const wins = iFirst ? r.aWins : r.bWins;
            const losses = iFirst ? r.bWins : r.aWins;
            return { name: opp, wins, losses, total: r.matches };
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        setH2hList(h2hEntries);
      }
    } catch (e) {
      console.warn("Could not load player tournaments:", e);
    }
    setLoading(false);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--accent)", letterSpacing: 3 }}>LOADING...</div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "2rem" }}>
      <div style={{ fontSize: 56 }}>🤷</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 28, letterSpacing: 2 }}>PLAYER NOT FOUND</div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>@{username} hasn't claimed a profile yet.</div>
      <button onClick={() => navigate(-1)} style={{ marginTop: 8, background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", padding: "10px 20px", cursor: "pointer", fontSize: 14 }}>
        Go back
      </button>
    </div>
  );

  const displayName = profile.displayName || profile.username;
  const badges = stats ? computeBadges(stats) : [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 90 }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 1rem" }}>

        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: "1.5rem", paddingBottom: "1rem" }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", padding: 4, display: "flex" }}>
            <ArrowLeft size={22} />
          </button>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 2, color: "var(--text)" }}>
            PLAYER PROFILE
          </div>
        </div>

        {/* Profile hero */}
        <div className="card" style={{ padding: "1.75rem", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: badges.length > 0 ? 18 : 0 }}>
            <div style={{ border: "3px solid var(--accent)", borderRadius: "50%", flexShrink: 0 }}>
              <PlayerAvatar name={displayName} profile={profile?.avatar} size={68} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 1.5, color: "var(--text)", lineHeight: 1.1, marginBottom: 3 }}>
                {displayName}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>@{profile.username}</div>
              {profile.bio && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: 1.5 }}>{profile.bio}</div>
              )}
            </div>
          </div>
          {/* Badges */}
          {badges.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {badges.map(b => <BadgeChip key={b.id} badge={b} />)}
            </div>
          )}
        </div>

        {/* Stats grid */}
        {stats ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <StatPill label="MATCHES" value={stats.matches} />
            <StatPill label="WINS" value={stats.wins} color="var(--accent)" />
            <StatPill label="WIN %" value={`${stats.winRate}%`} color={stats.winRate >= 60 ? "var(--accent)" : stats.winRate >= 40 ? "var(--gold)" : "var(--danger)"} />
            <StatPill label="TITLES" value={stats.titles} color="var(--gold)" />
          </div>
        ) : (
          <div className="card" style={{ padding: "2rem", textAlign: "center", marginBottom: 16, color: "var(--text-muted)", fontSize: 13 }}>
            No match data yet
          </div>
        )}

        {/* More stats row */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            <StatPill label="TOURNAMENTS" value={stats.tournaments} />
            <StatPill label="BEST STREAK" value={`${stats.bestStreak}${stats.streakType === "W" ? "W" : ""}`} color="var(--upcoming)" />
            <StatPill label="SCORE DIFF" value={stats.diff >= 0 ? `+${stats.diff}` : stats.diff} color={stats.diff >= 0 ? "var(--accent)" : "var(--danger)"} />
          </div>
        )}

        {/* H2H */}
        {h2hList.length > 0 && (
          <div className="card" style={{ padding: "1.25rem", marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 2, marginBottom: 12, color: "var(--text)" }}>
              HEAD-TO-HEAD
            </div>
            {h2hList.map((h, i) => (
              <H2HRow key={i} {...h} />
            ))}
          </div>
        )}

        {/* Tournament history */}
        {tournaments.length > 0 && (
          <div className="card" style={{ padding: "1.25rem", marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 2, marginBottom: 12, color: "var(--text)" }}>
              TOURNAMENT HISTORY
            </div>
            {tournaments.map((t, i) => (
              <TournamentRow key={t.code || i} t={t} playerName={displayName} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
