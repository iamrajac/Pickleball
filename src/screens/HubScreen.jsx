import { useState, useEffect } from "react";
import { TournamentCardSkeleton } from "../components/Skeleton";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { collection, query, where, limit, getDocs, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, get } from "firebase/database";
import { firestore, db } from "../firebase";
import { loadH, saveH } from "../utils/history";
import { fetchUserTournaments, fromFirestoreDoc, saveFullTournament } from "../hooks/useTournament";
import { requestPermission, scheduleUpcomingNotifications, notify } from "../utils/notifications";
import { getPlayerByUid } from "../utils/playerProfile";

function JoinBox({ onJoin }) {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState("");

  const handleJoin = async () => {
    const upper = code.trim().toUpperCase();
    if (!upper) return;
    setJoining(true); setErr("");
    try {
      const snap = await get(ref(db, `tournaments/${upper}`));
      if (snap.exists() && snap.val()) { onJoin(upper, snap.val()); return; }
      setErr("Tournament not found.");
    } catch (e) {
      const isPermission = e?.code === "PERMISSION_DENIED" || e?.message?.includes("permission");
      setErr(isPermission ? "Sign in with Google to join this tournament." : "Connection error. Try again.");
    }
    setJoining(false);
  };

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
      <input
        value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setErr(""); }}
        onKeyDown={e => e.key === "Enter" && handleJoin()}
        placeholder="Enter code to join"
        style={{ flex: 1, padding: "14px 16px", borderRadius: "var(--radius-md)", background: "var(--card)", border: err ? "1px solid var(--danger)" : "1px solid var(--border)", color: "var(--text)", fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 2, outline: "none" }}
      />
      <button onClick={handleJoin} disabled={joining || !code.trim()}
        style={{ padding: "14px 20px", borderRadius: "var(--radius-md)", background: "var(--accent)", border: "none", color: "#fff", fontFamily: "var(--font-display)", fontSize: 16, letterSpacing: 1, cursor: joining ? "wait" : "pointer", opacity: !code.trim() ? 0.5 : 1 }}>
        {joining ? "…" : "JOIN"}
      </button>
      {err && <div style={{ position: "absolute", marginTop: 52, fontSize: 12, color: "var(--danger)" }}>{err}</div>}
    </div>
  );
}

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
function TournamentCard({ t, onClick, onDelete, showClubBadge = false }) {
  const isUpcoming = t.status === "upcoming";
  const isLive = t.status === "live" || t.status === "in-progress";
  const statusClass = isLive ? "live" : isUpcoming ? "upcoming" : "done";
  const isClub = showClubBadge && t.code && !!localStorage.getItem(`pkl_club_${t.code}`);

  const Badge = () => {
    if (isLive)     return <span className="badge badge-live"><span style={{ fontSize: 8 }}>●</span> LIVE</span>;
    if (isUpcoming) return <span className="badge badge-upcoming">🕐 UPCOMING</span>;
    return <span className="badge badge-done">✓ DONE</span>;
  };

  return (
    <div className={`t-card ${statusClass} fu`} onClick={onClick}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, marginRight: 8, flexWrap: "wrap" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 1.5, color: "var(--text)", lineHeight: 1 }}>
            {t.name || "Unnamed Tournament"}
          </div>
          {isClub && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "2px 7px", borderRadius: 20, background: "rgba(168,85,247,0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)", flexShrink: 0 }}>
              🏘 CLUB
            </span>
          )}
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
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        {t.code && (
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, color: "var(--text-muted)", letterSpacing: 1 }}>
            #{t.code}
          </div>
        )}
        {onDelete && (
          <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{
            background: "none", border: "none", color: "var(--text-muted)",
            cursor: "pointer", padding: "4px 6px", borderRadius: 6, fontSize: 14,
            opacity: 0.6, transition: "opacity 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
          title="Delete tournament">
            🗑️
          </button>
        )}
      </div>
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
export function HubScreen({ user, isGuest, onCreateTournament, onOpenTournament, onJoin, theme, onToggleTheme }) {
  const [publicLive, setPublicLive] = useState([]);
  const [publicUpcoming, setPublicUpcoming] = useState([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [loadingMy, setLoadingMy] = useState(true);
  const [playerProfile, setPlayerProfile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [autoJoinErr, setAutoJoinErr] = useState("");
  const [tab, setTab] = useState("public"); // "public" | "private"

  useEffect(() => {
    if (user?.uid) getPlayerByUid(user.uid).then(p => { if (p) setPlayerProfile(p); });
  }, [user?.uid]);

  // Auto-join if navigated here with ?join=CODE (from public tournament JOIN button)
  useEffect(() => {
    if (!onJoin) return;
    const p = new URLSearchParams(window.location.hash.split("?")[1] || "");
    const code = p.get("join");
    if (!code) return;
    // Clear param from URL
    window.history.replaceState({}, "", window.location.pathname + window.location.hash.split("?")[0]);
    get(ref(db, `tournaments/${code.toUpperCase()}`))
      .then(snap => {
        if (snap.exists() && snap.val()) {
          onJoin(code.toUpperCase(), snap.val());
        } else {
          setAutoJoinErr("Tournament not found or has ended.");
        }
      })
      .catch(() => { setAutoJoinErr("Could not connect. Try joining manually."); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (t) => {
    const c = t.code;
    if (!c) return;
    // Remove from localStorage
    const { loadH, saveH } = await import("../utils/history");
    saveH(loadH().filter(x => x.code !== c));
    // Remove from Realtime DB
    const { ref: fbRef, set: fbSet } = await import("firebase/database");
    const { db: rtdb } = await import("../firebase");
    try { await fbSet(fbRef(rtdb, `tournaments/${c}`), null); } catch {}
    // Remove from Firestore
    if (user?.uid) {
      try { await deleteDoc(doc(firestore, "users", user.uid, "tournaments", c)); } catch {}
    }
    try { await deleteDoc(doc(firestore, "tournaments", c)); } catch {}
    setConfirmDelete(null);
  };

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
    const MIGRATION_KEY = `pkl_migrated_${user.uid}`;
    if (!localStorage.getItem(MIGRATION_KEY)) {
      const local = loadH().filter(t => t.code);
      if (local.length > 0) {
        local.forEach(t => saveFullTournament(user.uid, t));
      }
      localStorage.setItem(MIGRATION_KEY, '1');
    }

    // FIX: update any stuck "live" tournaments that actually have a champion
    // (spectators previously didn't get their Firestore status updated on champion)
    const STATUS_FIX_KEY = `pkl_status_fixed_${user.uid}`;
    if (!localStorage.getItem(STATUS_FIX_KEY)) {
      getDocs(collection(firestore, "users", user.uid, "tournaments")).then(snap => {
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.champion && data.status !== "completed" && data.status !== "done") {
            setDoc(doc(firestore, "users", user.uid, "tournaments", d.id), { status: "completed" }, { merge: true });
          }
        });
      }).catch(() => {});
      localStorage.setItem(STATUS_FIX_KEY, '1');
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

  const toMs = v => v ? (typeof v === 'number' ? v : new Date(v).getTime()) : 0;

  // Real-time public tournaments listener
  useEffect(() => {
    setLoadingPublic(true);
    const q = query(collection(firestore, "tournaments"), where("isPublic", "==", true), limit(30));
    const unsub = onSnapshot(q, snap => {
      const now = Date.now();
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPublicLive(
        all.filter(t => t.status === "live" || t.status === "in-progress")
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 10)
      );
      setPublicUpcoming(
        all.filter(t => t.status === "upcoming" && toMs(t.scheduledAt) > now)
          .sort((a, b) => toMs(a.scheduledAt) - toMs(b.scheduledAt)).slice(0, 10)
      );
      setLoadingPublic(false);
    }, e => { console.warn("fetchPublic failed:", e); setLoadingPublic(false); });
    return () => unsub();
  }, []);

  const now = Date.now();

  // Auto-transition: upcoming tournaments whose time has now passed → mark live
  useEffect(() => {
    if (!user?.uid) return;
    myTournaments.forEach(t => {
      const sAt = toMs(t.scheduledAt);
      if (t.status === "upcoming" && sAt > 0 && sAt <= now) {
        updateDoc(doc(firestore, "users", user.uid, "tournaments", t.code), { status: "live" }).catch(() => {});
        if (t.isPublic) updateDoc(doc(firestore, "tournaments", t.code), { status: "live" }).catch(() => {});
      }
    });
  }, [myTournaments, user?.uid]);

  // UPCOMING — scheduled time is in the future (time-based, works regardless of status field)
  const myUpcoming = myTournaments.filter(t => {
    const sAt = toMs(t.scheduledAt);
    return sAt > now && t.status !== "done" && t.status !== "completed";
  });

  // LIVE — time has passed (or no schedule) and not completed
  const myLive = myTournaments.filter(t => {
    if (t.status === "done" || t.status === "completed") return false;
    const sAt = toMs(t.scheduledAt);
    return sAt <= now && (t.status === "live" || t.status === "in-progress" || t.status === "upcoming");
  });

  // RECENT — completed
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

  const displayName = (playerProfile?.displayName || user?.displayName)?.split(" ")[0] || (isGuest ? "Guest" : "");

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
            style={{ width: "100%", padding: "18px", borderRadius: "var(--radius-lg)", background: "var(--accent)", border: "none", fontFamily: "var(--font-display)", fontSize: 20, letterSpacing: 3, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 20px var(--accent-dim)", marginBottom: 12 }}>
            + CREATE TOURNAMENT
          </button>

          {/* Join by code */}
          <JoinBox onJoin={onJoin} />
          {autoJoinErr && (
            <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)", fontSize: 13 }}>
              {autoJoinErr}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: "0 1rem" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>

          {/* PUBLIC / PRIVATE tab toggle */}
          <div style={{ display: "flex", gap: 8, marginTop: 24, marginBottom: 4 }}>
            {[["public", "🌐 PUBLIC"], ["private", "🔒 PRIVATE"]].map(([key, label]) => (
              <button key={key} className="pb" onClick={() => setTab(key)}
                style={{ flex: 1, padding: "10px", borderRadius: "var(--radius-md)", border: tab === key ? "none" : "1px solid var(--border)", background: tab === key ? (key === "public" ? "var(--accent)" : "var(--card-hover)") : "transparent", color: tab === key ? (key === "public" ? "#fff" : "var(--text)") : "var(--text-muted)", fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: 1, cursor: "pointer", fontWeight: tab === key ? 700 : 400 }}>
                {label}
              </button>
            ))}
          </div>

          {/* LIVE */}
          {(() => {
            const myCodes = new Set(myLive.map(t => t.code));
            const seen = new Set();
            const merged = [...myLive, ...publicLive.map(t => ({ ...t, code: t.code || t.id }))]
              .filter(t => { const k = t.code; if (seen.has(k)) return false; seen.add(k); return true; });
            const all = tab === "public"
              ? merged.filter(t => t.isPublic === true)
              : merged.filter(t => t.isPublic !== true);
            return all.length > 0 ? (
              <>
                <SectionHeader label="🔴 LIVE" count={all.length} color="var(--live)" />
                {all.map((t, i) => (
                  <TournamentCard key={t.code || i} t={{ ...t, status: "live" }}
                    onClick={() => onOpenTournament(t)}
                    onDelete={myCodes.has(t.code) || t.createdBy === user?.uid ? () => setConfirmDelete(t) : undefined}
                    showClubBadge />
                ))}
              </>
            ) : null;
          })()}

          {/* UPCOMING */}
          {(() => {
            const myCodes = new Set(myUpcoming.map(t => t.code));
            const seen = new Set();
            const merged = [...myUpcoming, ...publicUpcoming.map(t => ({ ...t, code: t.code || t.id }))]
              .filter(t => { const k = t.code; if (seen.has(k)) return false; seen.add(k); return true; })
              .sort((a, b) => toMs(a.scheduledAt) - toMs(b.scheduledAt));
            const all = tab === "public"
              ? merged.filter(t => t.isPublic === true)
              : merged.filter(t => t.isPublic !== true);
            return all.length > 0 ? (
              <>
                <SectionHeader label="🕐 UPCOMING" count={all.length} color="var(--upcoming)" />
                {all.map((t, i) => (
                  <TournamentCard key={t.code || i} t={{ ...t, status: "upcoming" }}
                    onClick={() => onOpenTournament(t)}
                    onDelete={myCodes.has(t.code) || t.createdBy === user?.uid ? () => setConfirmDelete(t) : undefined}
                    showClubBadge />
                ))}
              </>
            ) : null;
          })()}

          {/* RECENT */}
          {(() => {
            const all = tab === "public"
              ? myCompleted.filter(t => t.isPublic === true)
              : myCompleted.filter(t => t.isPublic !== true);
            return all.length > 0 ? (
              <>
                <SectionHeader label="✅ RECENT" count={all.length} color="var(--accent)" />
                {all.slice(0, 5).map((t, i) => (
                  <TournamentCard key={t.code || i} t={{ ...t, status: "done" }} onClick={() => onOpenTournament(t)} showClubBadge />
                ))}
              </>
            ) : null;
          })()}

          {/* Skeleton loading */}
          {(loadingMy || loadingPublic) && myLive.length === 0 && myCompleted.length === 0 && publicLive.length === 0 && (
            <div style={{ marginTop: 20 }}>
              {[...Array(3)].map((_, i) => <TournamentCardSkeleton key={i} />)}
            </div>
          )}

          {/* Empty state for current tab */}
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

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backdropFilter: "blur(4px)" }}>
          <div className="card fu" style={{ maxWidth: 360, width: "100%", padding: "2rem", textAlign: "center", borderRadius: "var(--radius-xl)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 2, marginBottom: 8, color: "var(--danger)" }}>DELETE TOURNAMENT?</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{confirmDelete.name || `#${confirmDelete.code}`}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
              Permanently removes all scores, stats, and history. <strong style={{ color: "var(--danger)" }}>Cannot be undone.</strong>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text)", fontWeight: 600, cursor: "pointer" }}>
                CANCEL
              </button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ flex: 1, padding: "12px", background: "var(--danger)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
