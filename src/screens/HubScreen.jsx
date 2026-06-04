import { useState, useEffect } from "react";
import { TournamentCardSkeleton } from "../components/Skeleton";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { collection, query, where, limit, getDocs, onSnapshot } from "firebase/firestore";
import { firestore } from "../firebase";
import { loadH, saveH } from "../utils/history";
import { fetchUserTournaments, fromFirestoreDoc, saveFullTournament } from "../hooks/useTournament";
import { requestPermission, scheduleUpcomingNotifications, notify } from "../utils/notifications";
import { getPlayerByUid } from "../utils/playerProfile";

/* ── Time formatter ───────────────────────────────── */
function fmtDateTime(ts) {
  if (!ts) return null;
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d)) return null;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(ts) {
  if (!ts) return null;
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts);
  if (isNaN(d)) return null;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/* ── Tournament card ──────────────────────────────── */
function TournamentCard({ t, onClick }) {
  const isUpcoming = t.status === "upcoming";
  const isLive = t.status === "live" || t.status === "in-progress";
  const statusClass = isLive ? "live" : isUpcoming ? "upcoming" : "done";

  const Badge = () => {
    if (isLive)     return <span className="badge badge-live"><span style={{ fontSize: 8 }}>●</span> LIVE</span>;
    if (isUpcoming) return <span className="badge badge-upcoming">🕐 UPCOMING</span>;
    return <span className="badge badge-done">✓ DONE</span>;
  };

  return (
    <div className={`t-card ${statusClass} fu`} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 1.5, color: "var(--text)", lineHeight: 1, flex: 1, marginRight: 8 }}>
          {t.name || "Unnamed Tournament"}
        </div>
        <Badge />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", fontSize: 12, color: "var(--text-secondary)" }}>
        <span>👥 {t.playerCount || t.players?.length || 0} players</span>
        {isLive && t.roundInfo && <span>⚡ {t.roundInfo}</span>}
        {isUpcoming && t.scheduledAt && (
          <span style={{ color: "var(--upcoming, #f59e0b)", fontWeight: 600 }}>
            🗓 {fmtDateTime(t.scheduledAt)}
          </span>
        )}
        {!isUpcoming && !isLive && (t.date || t.updatedAt) && (
          <span style={{ opacity: 0.7 }}>
            📅 {fmtDate(t.date || t.updatedAt)}
          </span>
        )}
        {isLive && (t.date || t.updatedAt) && (
          <span style={{ opacity: 0.7 }}>📅 {fmtDate(t.date || t.updatedAt)}</span>
        )}
        {t.champion && <span>🏆 {t.champion}</span>}
        {!t.isPublic && <span className="badge badge-private" style={{ fontSize: 9 }}>🔒 PRIVATE</span>}
      </div>

      {t.code && (
        <div style={{ marginTop: 8, fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-muted)", letterSpacing: 1 }}>
          #{t.code}
        </div>
      )}
    </div>
  );
}

/* ── Section header ───────────────────────────────── */
function SectionHeader({ label, count, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 28 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, letterSpacing: 2, color: color || "var(--text)" }}>
        {label}
      </div>
      {count > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius-full)", padding: "2px 8px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
          {count}
        </div>
      )}
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

/* ── Empty state ──────────────────────────────────── */
function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: "center", padding: "28px 16px", color: "var(--text-muted)", fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>{icon}</div>
      {message}
    </div>
  );
}

/* ── Optimal rounds lookup ────────────────────────── */
const OPTIMAL_ROUNDS = { 4:3, 5:5, 6:9, 7:7, 8:7, 9:9, 10:9, 11:11, 12:9, 13:9, 14:11, 15:9, 16:9, 17:9, 18:9, 19:9, 20:7 };
export const suggestRounds = (n) => OPTIMAL_ROUNDS[n] || Math.max(5, Math.round(n * 0.75));

/* ── Main HubScreen ───────────────────────────────── */
export function HubScreen({ user, isGuest, onCreateTournament, onOpenTournament, theme, onToggleTheme }) {
  const [publicLive, setPublicLive] = useState([]);
  const [publicUpcoming, setPublicUpcoming] = useState([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingMy, setLoadingMy] = useState(true);
  const [playerProfile, setPlayerProfile] = useState(null);

  useEffect(() => {
    if (user?.uid) getPlayerByUid(user.uid).then(p => { if (p) setPlayerProfile(p); });
  }, [user?.uid]);

  const normalize = (t) => ({
    ...t,
    status: t.status || (t.champion ? "done" : "live"),
    playerCount: t.playerCount || t.players?.length || 0,
    roundInfo: t.rounds ? `Round ${Math.ceil(t.rounds.flat().filter(m => m.played).length / Math.max(t.rounds[0]?.length || 1, 1))}/${t.rounds.length}` : "",
  });

  // Always start from localStorage immediately so data shows without waiting for network
  const [myTournaments, setMyTournaments] = useState(() => {
    const hist = loadH().filter(t => t.code)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return hist.map(normalize);
  });

  // Load tournaments — show local immediately, then keep in sync via Firestore listener
  useEffect(() => {
    if (!user?.uid) { setLoadingMy(false); return; }

    // ONE-TIME MIGRATION: push all localStorage tournaments to Firestore
    // This runs once per device per account to sync historical data.
    // After the first run, Firestore stays up-to-date via saveFullTournament() on every write.
    const MIGRATION_KEY = `pkl_migrated_${user.uid}`;
    if (!localStorage.getItem(MIGRATION_KEY)) {
      const local = loadH().filter(t => t.code);
      if (local.length > 0) {
        local.forEach(t => saveFullTournament(user.uid, t));
      }
      localStorage.setItem(MIGRATION_KEY, '1');
    }

    // Real-time listener — fires immediately with current data, then on every change
    const unsub = onSnapshot(
      collection(firestore, "users", user.uid, "tournaments"),
      (snap) => {
        setLoadingMy(false);
        if (snap.empty) return; // Firestore empty — keep showing localStorage
        const docs = snap.docs.map(d => fromFirestoreDoc(d.data()));
        docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        setMyTournaments(docs.map(normalize));
        saveH(docs); // keep local cache in sync with Firestore
      },
      (err) => { console.warn("Firestore listener error:", err); setLoadingMy(false); }
    );
    return () => unsub();
  }, [user?.uid]);

  // Load public tournaments — single where clause to avoid composite index requirement
  useEffect(() => {
    const fetchPublic = async () => {
      setLoadingPublic(true);
      try {
        const q = query(
          collection(firestore, "tournaments"),
          where("isPublic", "==", true),
          limit(30)
        );
        const snap = await getDocs(q);
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const now = Date.now();
        setPublicLive(
          all
            .filter(t => t.status === "live" || t.status === "in-progress")
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 10)
        );
        setPublicUpcoming(
          all
            .filter(t => t.status === "upcoming" && (typeof t.scheduledAt === "number" ? t.scheduledAt : new Date(t.scheduledAt).getTime()) > now)
            .sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0))
            .slice(0, 10)
        );
      } catch (e) {
        console.warn("fetchPublic failed:", e);
      }
      setLoadingPublic(false);
    };
    fetchPublic();
  }, []);

  const now = Date.now();
  const toMs = v => v ? (typeof v === 'number' ? v : new Date(v).getTime()) : 0;

  // UPCOMING — scheduled for the future (time hasn't arrived yet)
  const myUpcoming = myTournaments.filter(t =>
    t.status === "upcoming" && toMs(t.scheduledAt) > now
  );

  // LIVE — actively running (status is live/in-progress AND scheduled time has passed or no schedule)
  const myLive = myTournaments.filter(t =>
    (t.status === "live" || t.status === "in-progress") && toMs(t.scheduledAt) <= now
  );

  // RECENT — completed tournaments
  const myCompleted = myTournaments.filter(t =>
    t.status === "done" || t.status === "completed"
  );

  // Schedule notifications for all upcoming tournaments
  useEffect(() => {
    if (Notification?.permission === 'granted') {
      myUpcoming.forEach(t => scheduleUpcomingNotifications(t));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myUpcoming.length]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const displayName = user?.displayName?.split(" ")[0] || (isGuest ? "Guest" : "");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 90 }}>

      {/* Header */}
      <div style={{ padding: "0 1rem" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "2.5rem", paddingBottom: "1.5rem" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: 1, marginBottom: 4 }}>
                {greeting()}{displayName ? `, ${displayName}` : ""}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 38, color: "var(--accent)", letterSpacing: 3, lineHeight: 1 }}>
                PICKLEBALL
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="pb" onClick={onToggleTheme}
                style={{ width: 38, height: 38, borderRadius: "var(--radius-md)", background: "var(--card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", cursor: "pointer", fontSize: 16 }}>
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              {user && (
                <div style={{ cursor: "pointer" }} onClick={() => window.location.hash = "#/account"}>
                  <PlayerAvatar
                    name={playerProfile?.displayName || user?.displayName || "U"}
                    profile={playerProfile?.avatar}
                    size={38}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Create button */}
          <button className="pb" onClick={onCreateTournament}
            style={{ width: "100%", padding: "18px", borderRadius: "var(--radius-lg)", background: "var(--accent)", border: "none", fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 3, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 20px var(--accent-dim)", marginBottom: 8 }}>
            + CREATE TOURNAMENT
          </button>
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginBottom: 4 }}>
            or join an existing one below
          </div>
        </div>
      </div>

      <div style={{ padding: "0 1rem" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* Live tournaments */}
          {myLive.length > 0 && (
            <>
              <SectionHeader label="🔴 LIVE" count={myLive.length} color="var(--live)" />
              {myLive.map((t, i) => (
                <TournamentCard key={t.code || i} t={t} onClick={() => onOpenTournament(t)} />
              ))}
            </>
          )}

          {/* Upcoming tournaments */}
          {myUpcoming.length > 0 && (
            <>
              <SectionHeader label="🕐 UPCOMING" count={myUpcoming.length} color="var(--upcoming)" />
              {myUpcoming.sort((a, b) => toMs(a.scheduledAt) - toMs(b.scheduledAt)).map((t, i) => (
                <TournamentCard key={t.code || i} t={{ ...t, status: "upcoming" }} onClick={() => onOpenTournament(t)} />
              ))}
            </>
          )}

          {/* Public live */}
          {publicLive.length > 0 && (
            <>
              <SectionHeader label="⚡ LIVE NOW" count={publicLive.length} color="var(--live)" />
              {publicLive.map(t => (
                <TournamentCard key={t.id} t={{ ...t, status: "live" }} onClick={() => onOpenTournament(t)} />
              ))}
            </>
          )}

          {/* Public upcoming */}
          {publicUpcoming.length > 0 && (
            <>
              <SectionHeader label="🕐 PUBLIC UPCOMING" count={publicUpcoming.length} color="var(--upcoming, #f59e0b)" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {publicUpcoming.map(t => (
                  <TournamentCard key={t.id} t={{ ...t, status: "upcoming" }} onClick={() => onOpenTournament(t)} />
                ))}
              </div>
            </>
          )}

          {/* My history */}
          {myCompleted.length > 0 && (
            <>
              <SectionHeader label="✅ RECENT" count={myCompleted.length} color="var(--accent)" />
              {myCompleted.slice(0, 5).map((t, i) => (
                <TournamentCard key={t.code || i} t={{ ...t, status: "done" }} onClick={() => onOpenTournament(t)} />
              ))}
            </>
          )}

          {/* Skeleton loading */}
          {(loadingMy || loadingPublic) && myLive.length === 0 && myCompleted.length === 0 && publicLive.length === 0 && (
            <div style={{ marginTop: 20 }}>
              {[...Array(3)].map((_, i) => <TournamentCardSkeleton key={i} />)}
            </div>
          )}

          {/* Empty state */}
          {!loadingMy && !loadingPublic && myLive.length === 0 && myCompleted.length === 0 && myUpcoming.length === 0 && publicLive.length === 0 && (
            <div className="card fu" style={{ marginTop: 32, padding: "3rem 2rem", textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🏓</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 2, color: "var(--text)", marginBottom: 8 }}>
                NO TOURNAMENTS YET
              </div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>
                Create your first tournament or join one with a code.
              </div>
              <button onClick={onCreateTournament} style={{
                padding: "14px 32px", background: "var(--accent)", border: "none",
                borderRadius: "var(--radius-md)", color: "#fff",
                fontFamily: "var(--font-display)", fontSize: 18,
                letterSpacing: 2, cursor: "pointer",
              }}>
                + CREATE NOW
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
