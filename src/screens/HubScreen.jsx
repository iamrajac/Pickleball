import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { firestore } from "../firebase";
import { loadH } from "../utils/history";
import { fetchUserTournaments } from "../hooks/useTournament";

/* ── Tournament card ──────────────────────────────── */
function TournamentCard({ t, onClick }) {
  const statusClass = t.status === "live" ? "live" : t.status === "upcoming" ? "upcoming" : "done";

  const Badge = () => {
    if (t.status === "live")     return <span className="badge badge-live"><span style={{ fontSize: 8 }}>●</span> LIVE</span>;
    if (t.status === "upcoming") return <span className="badge badge-upcoming">🕐 UPCOMING</span>;
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

      <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 12, color: "var(--text-secondary)" }}>
        <span>👥 {t.playerCount || t.players?.length || 0} players</span>
        {t.status === "live" && t.roundInfo && (
          <span>⚡ {t.roundInfo}</span>
        )}
        {t.status === "upcoming" && t.scheduledAt && (
          <span>📅 {new Date(t.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
        )}
        {t.status === "done" && t.champion && (
          <span>🏆 {t.champion}</span>
        )}
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
  const [myTournaments, setMyTournaments] = useState([]);
  const [loadingPublic, setLoadingPublic] = useState(true);

  // Load tournaments — Firestore for Google users, localStorage for guests
  useEffect(() => {
    const normalize = (t) => ({
      ...t,
      status: t.status || (t.champion ? "done" : "live"),
      playerCount: t.playerCount || t.players?.length || 0,
      roundInfo: t.rounds ? `Round ${Math.ceil(t.rounds.flat().filter(m => m.played).length / Math.max(t.rounds[0]?.length || 1, 1))}/${t.rounds.length}` : "",
      // Ensure createdAt is a plain value, not a Firestore Timestamp object
      createdAt: t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt,
    });

    if (user?.uid) {
      // Google user — Firestore is the single source of truth
      // Track if this user has ever synced to Firestore
      const syncedKey = `pkl_fs_synced_${user.uid}`;
      const hasSynced = !!localStorage.getItem(syncedKey);

      fetchUserTournaments(user.uid).then(async (firestoreList) => {
        const localHist = loadH().filter(t => t.code);

        const toMs = (v) => {
          if (!v) return 0;
          if (typeof v === 'number') return v;
          if (v.toDate) return v.toDate().getTime();
          if (v instanceof Date) return v.getTime();
          return new Date(v).getTime() || 0;
        };

        if (firestoreList.length > 0) {
          // Firestore has data — it's the source of truth
          // Mark that this user has synced to Firestore
          localStorage.setItem(syncedKey, '1');

          const seen = new Map();
          const fsKeys = new Set(firestoreList.map(t => t.code));

          // Start with local data (has rounds), Firestore overwrites metadata
          localHist.forEach(t => seen.set(t.code, t));
          firestoreList.forEach(t => seen.set(t.code, t));

          // Sync any local-only tournaments to Firestore (first time or new device)
          localHist.forEach(async (t) => {
            if (!fsKeys.has(t.code)) {
              const { setDoc, doc, serverTimestamp } = await import("firebase/firestore");
              try {
                await setDoc(doc(firestore, "users", user.uid, "tournaments", t.code), {
                  code: t.code, name: t.name || "",
                  status: t.status || (t.champion ? "done" : "live"),
                  playerCount: t.players?.length || 0, players: t.players || [],
                  isPublic: t.isPublic !== false, champion: t.champion || null,
                  createdAt: t.date ? new Date(t.date) : serverTimestamp(),
                  updatedAt: Date.now(),
                }, { merge: true }).catch(() => {});
              } catch (e) {}
            }
          });

          const merged = Array.from(seen.values())
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0) || toMs(b.createdAt) - toMs(a.createdAt));
          setMyTournaments(merged.map(normalize));

        } else if (hasSynced) {
          // User has synced before but Firestore is empty = they deleted everything
          // Respect the deletion: clear local storage too and show empty
          saveH([]);
          setMyTournaments([]);

        } else {
          // First time for this user — no Firestore data yet, show local only
          const seen = new Map();
          localHist.forEach(t => seen.set(t.code, t));
          const merged = Array.from(seen.values())
            .sort((a, b) => toMs(b.createdAt || b.date) - toMs(a.createdAt || a.date));
          setMyTournaments(merged.map(normalize));
        }
      });
    } else {
      // Guest — localStorage only
      const hist = loadH().filter(t => t.code);
      const seen = new Map();
      hist.forEach(t => seen.set(t.code, t));
      setMyTournaments(Array.from(seen.values()).reverse().map(normalize));
    }
  }, [user?.uid]);

  // Load public tournaments from Firestore
  useEffect(() => {
    const fetchPublic = async () => {
      setLoadingPublic(true);
      try {
        const liveQ = query(
          collection(firestore, "tournaments"),
          where("isPublic", "==", true),
          where("status", "==", "live"),
          orderBy("createdAt", "desc"),
          limit(10)
        );
        const upcomingQ = query(
          collection(firestore, "tournaments"),
          where("isPublic", "==", true),
          where("status", "==", "upcoming"),
          orderBy("scheduledAt", "asc"),
          limit(10)
        );
        const [liveSnap, upcomingSnap] = await Promise.all([getDocs(liveQ), getDocs(upcomingQ)]);
        setPublicLive(liveSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPublicUpcoming(upcomingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        // Firestore not set up yet or offline — silently skip
      }
      setLoadingPublic(false);
    };
    fetchPublic();
  }, []);

  const myLive      = myTournaments.filter(t => t.status === "live" || t.status === "in-progress");
  const myCompleted = myTournaments.filter(t => t.status === "done" || t.status === "completed");

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
            <div style={{ display: "flex", gap: 8 }}>
              <button className="pb" onClick={onToggleTheme}
                style={{ width: 40, height: 40, borderRadius: "var(--radius-md)", background: "var(--card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", cursor: "pointer" }}>
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
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

          {/* My live tournaments */}
          {myLive.length > 0 && (
            <>
              <SectionHeader label="🔴 RESUME" count={myLive.length} color="var(--live)" />
              {myLive.map((t, i) => (
                <TournamentCard key={t.code || i} t={t} onClick={() => onOpenTournament(t)} />
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

          {/* Upcoming */}
          {publicUpcoming.length > 0 && (
            <>
              <SectionHeader label="🕐 UPCOMING" count={publicUpcoming.length} color="var(--upcoming)" />
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

          {/* Empty state */}
          {myLive.length === 0 && myCompleted.length === 0 && publicLive.length === 0 && !loadingPublic && (
            <div className="card fu" style={{ marginTop: 32, padding: "3rem 2rem", textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🏓</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: 2, color: "var(--text)", marginBottom: 8 }}>NO TOURNAMENTS YET</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Create your first tournament or join one with a code.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
