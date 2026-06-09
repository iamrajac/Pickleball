import { useState, useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import { ref as fbRef, get } from "firebase/database";
import { doc, deleteDoc, collection, getDocs, onSnapshot } from "firebase/firestore";
import { db, firestore } from "../firebase";
import { loadH, saveH, isCreator } from "../utils/history";
import { computeStandings } from "../utils/schedule";
import { fetchUserTournaments, safePlayoffs, fromFirestoreDoc, saveFullTournament } from "../hooks/useTournament";
import { StandingsTable } from "../components/StandingsTable";
import { MatchCard } from "../components/MatchCard";
import { PlayoffCard } from "../components/PlayoffCard";
import { Trophy, ArrowLeft, Calendar, Users, Trash2, ChevronRight, Share2, RotateCcw } from "lucide-react";
import { StandingsShareModal } from "../components/StandingsShare";

// Delete a single tournament from Firestore for a user + club if applicable
async function deleteFromFirestore(uid, code) {
  try {
    await deleteDoc(doc(firestore, "users", uid, "tournaments", code));
  } catch (e) { console.warn("Firestore delete failed", e); }
  // Also remove from club if this tournament was created from one
  try {
    const clubId = localStorage.getItem(`pkl_club_${code}`);
    if (clubId) {
      await deleteDoc(doc(firestore, "clubs", clubId, "tournaments", code));
      localStorage.removeItem(`pkl_club_${code}`);
    }
  } catch (e) { console.warn("Club tournament delete failed", e); }
}

// Delete all tournaments from Firestore for a user + any linked clubs
async function deleteAllFromFirestore(uid) {
  try {
    const snap = await getDocs(collection(firestore, "users", uid, "tournaments"));
    await Promise.all(snap.docs.map(async d => {
      const code = d.id;
      await deleteDoc(d.ref);
      // Also remove from club if linked
      try {
        const clubId = localStorage.getItem(`pkl_club_${code}`);
        if (clubId) {
          await deleteDoc(doc(firestore, "clubs", clubId, "tournaments", code));
          localStorage.removeItem(`pkl_club_${code}`);
        }
      } catch {}
    }));
  } catch (e) { console.warn("Firestore clear failed", e); }
}

export function HistoryScreen({ onBack, onOpen, theme = 'dark' }) {
  const lime = theme === 'light' ? '#1e3a5f' : 'var(--color-lime)';
  const muted = theme === 'light' ? '#64748b' : 'var(--color-muted)';
  const text = theme === 'light' ? '#0f172a' : 'var(--color-text)';
  const border = theme === 'light' ? '#e2e8f0' : 'var(--color-border)';

  const onlyCompleted = (list) => list
    .filter(t => t.code && t.status !== "upcoming" && t.status !== "live" && t.status !== "in-progress")
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // Always load from localStorage first so data shows immediately
  const [hist, setHist] = useState(() => onlyCompleted(loadH()));
  const [histLoading, setHistLoading] = useState(() => {
    return onlyCompleted(loadH()).length === 0 && !!getAuth().currentUser?.uid;
  });
  const clearingRef = useRef(false); // ignore Firestore snapshots while clearing

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) { setHistLoading(false); return; }

    const MIGRATION_KEY = `pkl_migrated_${uid}`;
    if (!localStorage.getItem(MIGRATION_KEY)) {
      const local = loadH().filter(t => t.code);
      if (local.length > 0) local.forEach(t => saveFullTournament(uid, t));
      localStorage.setItem(MIGRATION_KEY, '1');
    }

    const unsub = onSnapshot(
      collection(firestore, "users", uid, "tournaments"),
      (snap) => {
        setHistLoading(false);
        if (clearingRef.current) return; // ignore intermediate snapshots during Clear All
        if (snap.empty) return; // no cloud data yet — keep local
        const docs = snap.docs.map(d => fromFirestoreDoc(d.data()));
        setHist(onlyCompleted(docs));
        saveH(docs);
      },
      (err) => { console.warn("Firestore history listener error:", err); }
    );
    return () => unsub();
  }, []);

  const [deleteCode, setDeleteCode] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const open = !!(deleteCode || confirmClear);
    document.body.classList.toggle('modal-open', open);
    return () => document.body.classList.remove('modal-open');
  }, [deleteCode, confirmClear]);

  const deleteOne = (code) => {
    const updated = hist.filter(t => t.code !== code);
    saveH(updated);
    setHist(updated);
    setDeleteCode(null);
    const uid = getAuth().currentUser?.uid;
    if (uid) deleteFromFirestore(uid, code);
  };

  const clearAll = () => {
    clearingRef.current = true;
    saveH([]);
    setHist([]);
    setConfirmClear(false);
    const uid = getAuth().currentUser?.uid;
    if (uid) deleteAllFromFirestore(uid).finally(() => { clearingRef.current = false; });
  };

  return (
    <div style={{ padding: "0 1rem 4rem" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* Header */}
        <div className="fu" style={{ paddingTop: "2.5rem", paddingBottom: "2rem", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: lime, letterSpacing: 2, lineHeight: 1 }}>TOURNAMENT HISTORY</div>
            <div style={{ fontSize: 12, color: muted }}>{hist.length} saved tournament{hist.length !== 1 ? "s" : ""}</div>
          </div>
          {hist.length > 0 && (
            <button className="pb" onClick={() => setConfirmClear(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: "8px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 'var(--radius-sm)', color: "#ef4444", fontSize: 12, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>
              <Trash2 size={13} /> CLEAR ALL
            </button>
          )}
        </div>

        {/* Search bar */}
        {hist.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Search by tournament or player name..."
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: text, fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
        )}

        {/* Loading state — only shown on new device with no local data */}
        {histLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card" style={{ borderRadius: 12, padding: "1.2rem 1.4rem", opacity: 0.5 }}>
                <div style={{ height: 16, width: "60%", borderRadius: 6, background: "var(--color-border)", marginBottom: 10, animation: "shimmer 1.5s infinite" }} />
                <div style={{ height: 12, width: "40%", borderRadius: 6, background: "var(--color-border)", animation: "shimmer 1.5s infinite" }} />
              </div>
            ))}
          </div>
        ) : hist.length === 0 ? (
          <div className="fu glass-card" style={{ padding: "4rem 2rem", textAlign: "center", borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🏆</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: border, letterSpacing: 2 }}>NO HISTORY YET</div>
            <div style={{ fontSize: 14, color: muted, marginTop: 8 }}>Complete a tournament to see it here.</div>
          </div>
        ) : (() => {
          const filtered = search.trim()
            ? hist.filter(t => {
                const q = search.toLowerCase();
                return (t.name || "").toLowerCase().includes(q) ||
                  (t.players || []).some(p => p.toLowerCase().includes(q)) ||
                  (t.champion || "").toLowerCase().includes(q);
              })
            : hist;
          if (filtered.length === 0) return (
            <div className="glass-card" style={{ padding: "3rem", textAlign: "center", borderRadius: 12 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, color: muted }}>No tournaments match "{search}"</div>
            </div>
          );
          return filtered.map((t, i) => (
            <div key={t.code || i} style={{ position: "relative", marginBottom: 12 }}>

              {/* Card */}
              <div className="fu rh glass-card" onClick={() => onOpen(t)}
                style={{ animationDelay: `${i * .05}s`, borderRadius: 'var(--radius-md)', padding: "1.2rem 1.4rem", paddingRight: "4rem", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: text, letterSpacing: 1 }}>
                      {t.name || (t.date ? new Date(t.date).toLocaleDateString() : "Tournament")}
                    </span>
                    {t.status === "in-progress" || t.status === "live"
                      ? <span className="badge badge-live" style={{ fontSize: 9 }}>LIVE</span>
                      : <span className="badge badge-done" style={{ fontSize: 9 }}>DONE</span>
                    }
                  </div>
                  {t.name && t.date && (
                    <div style={{ fontSize: 11, color: muted, marginBottom: 6 }}>
                      {new Date(t.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13, color: muted }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={14} /> {(t.players?.length || 0)} players</span>
                    {t.code && <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>#{t.code} {isCreator(t.code) ? "(Host)" : ""}</span>}
                  </div>
                  {t.champion && (
                    <div style={{ fontSize: 13, color: 'var(--color-gold)', marginTop: 8, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Trophy size={14} /> {t.champion}
                    </div>
                  )}
                </div>
                <div style={{ color: muted, flexShrink: 0 }}><ChevronRight size={20} /></div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteCode(t.code); }}
                className="pb"
                title="Delete tournament"
                style={{
                  position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)",
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8, width: 34, height: 34,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#ef4444", zIndex: 1
                }}>
                <Trash2 size={14} />
              </button>
            </div>
          ));
        })()}
      </div>

      {/* Confirm Delete One */}
      {deleteCode && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
          <div className="glass-card fu" style={{ borderRadius: 16, padding: "2rem", maxWidth: 320, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, marginBottom: 8, color: text }}>DELETE TOURNAMENT?</div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 24 }}>
              This will permanently remove it from your history on this device.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteCode(null)} className="pb"
                style={{ flex: 1, padding: "11px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, color: text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                CANCEL
              </button>
              <button onClick={() => deleteOne(deleteCode)} className="pb"
                style={{ flex: 1, padding: "11px", background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: 10, color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Clear All */}
      {confirmClear && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)" }}>
          <div className="glass-card fu" style={{ borderRadius: 16, padding: "2rem", maxWidth: 320, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 2, marginBottom: 8, color: text }}>CLEAR ALL HISTORY?</div>
            <div style={{ fontSize: 13, color: muted, marginBottom: 24 }}>
              All <strong style={{ color: "#ef4444" }}>{hist.length}</strong> tournament{hist.length !== 1 ? "s" : ""} will be permanently deleted from this device.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmClear(false)} className="pb"
                style={{ flex: 1, padding: "11px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, color: text, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                CANCEL
              </button>
              <button onClick={clearAll} className="pb"
                style={{ flex: 1, padding: "11px", background: "rgba(239,68,68,0.15)", border: "1px solid #ef4444", borderRadius: 10, color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                CLEAR ALL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoryDetail({ tournament, onBack, onRematch, theme = 'dark' }) {
  const lime = theme === 'light' ? '#1e3a5f' : 'var(--color-lime)';
  const muted = theme === 'light' ? '#64748b' : 'var(--color-muted)';
  const text = theme === 'light' ? '#0f172a' : 'var(--color-text)';
  const border = theme === 'light' ? '#e2e8f0' : 'var(--color-border)';

  // Always start null so we show loading — prevents flash of 0 players
  const [fullData, setFullData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("rounds");
  const [showShare, setShowShare] = useState(false);

  // Always fetch full data from Realtime DB — it has rounds, players, profiles
  useEffect(() => {
    if (!tournament?.code) { setFullData(tournament); setLoading(false); return; }
    setLoading(true);

    get(fbRef(db, `tournaments/${tournament.code}`)).then(snap => {
      let merged;
      if (snap.exists() && snap.val()) {
        const fbData = snap.val();
        const rounds = fbData.rounds ? fbData.rounds.map(r => r ? Object.values(r) : []) : (tournament.rounds || []);
        const players = fbData.players || tournament.players || [];
        merged = {
          ...tournament,
          ...fbData,
          rounds,
          players,
          profiles: fbData.profiles || tournament.profiles || {},
          playoffs: fbData.playoffs ? safePlayoffs(fbData.playoffs) : (tournament.playoffs || null),
          champion: fbData.champion || tournament.champion || null,
          name: fbData.name || tournament.name || "",
          date: tournament.date || new Date().toISOString(),
        };
      } else {
        merged = { ...tournament, rounds: tournament.rounds || [], players: tournament.players || [] };
      }

      merged.finalStandings = computeStandings(merged.players, merged.rounds);
      setFullData(merged);
      setLoading(false);

      // Save full data to localStorage so career stats update on this device
      if (!merged.rounds?.length) return;
      const all = loadH();
      const seen = new Map();
      all.forEach(t => seen.set(t.code, t));
      const existing = seen.get(merged.code);
      if (!existing?.rounds?.length || existing.rounds.length < merged.rounds.length) {
        seen.set(merged.code, { ...merged, status: merged.champion ? "completed" : "in-progress" });
        saveH(Array.from(seen.values()).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
      }
    }).catch(() => {
      setFullData({ ...tournament, rounds: tournament.rounds || [], players: tournament.players || [] });
      setLoading(false);
    });
  }, [tournament?.code]);

  if (loading || !fullData) {
    return (
      <div style={{ minHeight: "100vh", background: 'var(--color-dark)', display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: lime, letterSpacing: 3, marginBottom: 8 }}>LOADING...</div>
          <div style={{ fontSize: 12, color: muted }}>Fetching tournament data</div>
        </div>
      </div>
    );
  }

  const t = fullData;
  const standings = t.finalStandings || [];
  const rounds = t.rounds || [];
  const playoffs = t.playoffs ? (typeof t.playoffs === 'object' && !Array.isArray(t.playoffs) ? t.playoffs : null) : null;
  const profiles = t.profiles || {};

  return (
    <div style={{ minHeight: "100vh", background: 'var(--color-dark)', color: text, fontFamily: "'DM Sans', sans-serif" }}>
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ padding: "0 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, height: 60 }}>
            <button onClick={onBack} className="ni" style={{ background: "none", border: "none", color: muted, padding: 0, display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={24} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: lime, letterSpacing: 2, lineHeight: 1 }}>TOURNAMENT RECAP</div>
              <div style={{ fontSize: 11, color: muted, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Calendar size={12} /> {t.date ? new Date(t.date).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Unknown"}
                <span>·</span> <Users size={12} /> {(t.players?.length || 0)} players
                {t.code && <><span>·</span> <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1 }}>#{t.code}</span></>}
              </div>
            </div>
            {onRematch && (
              <button className="pb" onClick={() => onRematch(t.players || [])}
                title="Rematch — same players, new schedule"
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "none", color: muted, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: 1 }}>
                <RotateCcw size={13} /> REMATCH
              </button>
            )}
            <button className="pb" onClick={() => setShowShare(true)}
              title="Share standings"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 8, border: "1px solid var(--color-border)", background: "none", color: muted, cursor: "pointer" }}>
              <Share2 size={16} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 4, paddingBottom: 8 }}>
            {[{ id: "rounds", label: "⚡ ROUNDS" }, { id: "standings", label: "📊 TABLE" }, { id: "playoffs", label: "🏆 PLAYOFFS" }, { id: "analytics", label: "📈 ANALYTICS" }].map(tb => (
              <button key={tb.id} className={`tab-btn ${tab === tb.id ? "on" : "off"}`} onClick={() => setTab(tb.id)} style={{ flex: 1 }}>{tb.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "1.5rem 1rem 4rem", maxWidth: 1000, margin: "0 auto" }}>
        {tab === "rounds" && (
          <div className="desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 24, alignItems: "start" }}>
            {rounds.length === 0 && <div className="fu" style={{ color: muted }}>No rounds data available for this tournament.</div>}
            {rounds.map((round, ri) => (
              <div key={ri} className="fu" style={{ animationDelay: `${ri * .03}s` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: round.every(m => m.played) ? 'var(--color-lime)' : 'var(--color-text)', letterSpacing: 2 }}>ROUND {ri + 1}</div>
                  <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                  <div style={{ fontSize: 11, color: round.every(m => m.played) ? 'var(--color-lime)' : 'var(--color-muted)', letterSpacing: 1, fontWeight: 600 }}>{round.filter(m => m.played).length}/{round.length}</div>
                </div>
                {round.map((m, mi) => <MatchCard key={mi} match={m} delay={mi * .04} readOnly={true} onSave={() => {}} profiles={profiles} />)}
              </div>
            ))}
          </div>
        )}

        {tab === "standings" && (
          <div className="fu">
            <StandingsTable standings={standings} rounds={rounds} />
          </div>
        )}

        {tab === "playoffs" && (
          <div className="fu">
            {!playoffs ? (
              <div className="glass-card" style={{ textAlign: "center", padding: "4rem 1rem", borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: border, letterSpacing: 2 }}>NO PLAYOFFS</div>
                <div style={{ fontSize: 13, color: muted, marginTop: 8 }}>This tournament ended before playoffs.</div>
              </div>
            ) : (
              <div style={{ maxWidth: 800, margin: "0 auto" }}>
                {(t.champion || playoffs.champion) && (
                  <div className="fu glass-card" style={{ border: `1px solid var(--color-lime)`, borderRadius: 'var(--radius-lg)', padding: "2rem", textAlign: "center", marginBottom: 24, background: 'rgba(200,241,53,0.05)', boxShadow: '0 8px 32px rgba(200,241,53,0.1)' }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
                    <div style={{ fontSize: 11, letterSpacing: 4, color: lime, marginBottom: 8, fontWeight: 600 }}>TOURNAMENT CHAMPIONS</div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: lime, letterSpacing: 3 }}>{t.champion || playoffs.champion}</div>
                  </div>
                )}
                {/* final_only mode */}
                {playoffs.mode === "final_only" && playoffs.final && (
                  <PlayoffCard match={playoffs.final} onSave={() => {}} accent="var(--color-gold)" readOnly={true} />
                )}
                {/* elim_to_sf mode */}
                {playoffs.mode === "elim_to_sf" && (
                  <>
                    {playoffs.sf1 && <div style={{ marginBottom: 16 }}><PlayoffCard match={playoffs.sf1} onSave={() => {}} accent="var(--color-lime)" readOnly={true} /></div>}
                    {playoffs.final && <PlayoffCard match={playoffs.final} onSave={() => {}} accent="var(--color-gold)" readOnly={true} />}
                  </>
                )}
                {/* ipl8 / default mode */}
                {(playoffs.mode === "ipl8" || (!playoffs.mode && playoffs.q1)) && (
                  <>
                    <div className="playoff-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                      {playoffs.q1 && <PlayoffCard match={playoffs.q1} onSave={() => {}} accent="var(--color-lime)" readOnly={true} />}
                      {playoffs.elim && <PlayoffCard match={playoffs.elim} onSave={() => {}} accent="var(--color-cyan)" readOnly={true} />}
                    </div>
                    {playoffs.q2 && <div style={{ marginBottom: 16 }}><PlayoffCard match={playoffs.q2} onSave={() => {}} accent="var(--color-gold)" readOnly={true} /></div>}
                    {playoffs.final && <PlayoffCard match={playoffs.final} onSave={() => {}} accent="var(--color-lime)" readOnly={true} />}
                  </>
                )}
                {/* ipl6 mode */}
                {playoffs.mode === "ipl6" && (
                  <>
                    <div className="playoff-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                      {playoffs.q1 && <PlayoffCard match={playoffs.q1} onSave={() => {}} accent="var(--color-lime)" readOnly={true} />}
                      {playoffs.elim && <PlayoffCard match={playoffs.elim} onSave={() => {}} accent="var(--color-cyan)" readOnly={true} />}
                    </div>
                    {playoffs.final && <PlayoffCard match={playoffs.final} onSave={() => {}} accent="var(--color-gold)" readOnly={true} />}
                  </>
                )}
                <div style={{ marginTop: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: text }}>FINAL STANDINGS</div>
                    <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                  </div>
                  <StandingsTable standings={standings} rounds={rounds} />
                </div>
              </div>
            )}
          </div>
        )}
        {tab === "analytics" && (() => {
          const allMatches = rounds.flatMap(r => r.filter(m => m.played));
          const totalMatches = allMatches.length;

          // ── Match Duration Stats ──────────────────────────────────────────
          const withDuration = allMatches.filter(m => m.duration > 0);
          const avgDuration = withDuration.length > 0
            ? Math.round(withDuration.reduce((s, m) => s + m.duration, 0) / withDuration.length)
            : null;
          const longest = withDuration.length > 0 ? withDuration.reduce((b, m) => m.duration > b.duration ? m : b) : null;
          const shortest = withDuration.length > 0 ? withDuration.reduce((b, m) => m.duration < b.duration ? m : b) : null;
          const fmtD = s => s ? `${Math.floor(s/60)}m ${s%60}s` : "—";

          // ── Score Distribution ────────────────────────────────────────────
          const scoreBuckets = { "11-0 to 11-3": 0, "11-4 to 11-7": 0, "11-8 to 11-9": 0, "12-10+": 0 };
          allMatches.forEach(m => {
            const hi = Math.max(Number(m.scoreA), Number(m.scoreB));
            const lo = Math.min(Number(m.scoreA), Number(m.scoreB));
            if (hi === 11 && lo <= 3) scoreBuckets["11-0 to 11-3"]++;
            else if (hi === 11 && lo <= 7) scoreBuckets["11-4 to 11-7"]++;
            else if (hi === 11 && lo <= 9) scoreBuckets["11-8 to 11-9"]++;
            else scoreBuckets["12-10+"]++;
          });
          const maxBucket = Math.max(...Object.values(scoreBuckets));

          // ── Attendance ───────────────────────────────────────────────────
          const allHistory = loadH().filter(ht => ht.rounds?.length > 0);
          const playerTournamentCount = {};
          allHistory.forEach(ht => {
            (ht.players || []).forEach(p => {
              playerTournamentCount[p] = (playerTournamentCount[p] || 0) + 1;
            });
          });
          const tournamentPlayers = t.players || [];
          const attendance = tournamentPlayers.map(p => ({
            name: p, count: playerTournamentCount[p] || 1, total: allHistory.length
          })).sort((a, b) => b.count - a.count);

          // ── Heatmap: day of week ─────────────────────────────────────────
          const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          const dayCount = Array(7).fill(0);
          allHistory.forEach(ht => {
            if (ht.date) dayCount[new Date(ht.date).getDay()]++;
          });
          const maxDay = Math.max(...dayCount);

          return (
            <div className="fu" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Match Duration */}
              <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: muted, marginBottom: 12, fontWeight: 600 }}>⏱ MATCH DURATION</div>
                {withDuration.length === 0 ? (
                  <div style={{ fontSize: 13, color: muted }}>No duration data — timers weren't used in this tournament.</div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                      {[
                        { l: "AVG DURATION", v: fmtD(avgDuration) },
                        { l: "LONGEST", v: fmtD(longest?.duration) },
                        { l: "SHORTEST", v: fmtD(shortest?.duration) },
                      ].map(({ l, v }) => (
                        <div key={l} style={{ textAlign: "center", background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 6px" }}>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: lime, lineHeight: 1 }}>{v}</div>
                          <div style={{ fontSize: 8, color: muted, letterSpacing: 1, marginTop: 4 }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    {longest && <div style={{ fontSize: 11, color: muted }}>Longest: {longest.teamA?.join(" & ")} vs {longest.teamB?.join(" & ")}</div>}
                  </>
                )}
              </div>

              {/* Score Distribution */}
              <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: muted, marginBottom: 12, fontWeight: 600 }}>🎯 SCORE DISTRIBUTION</div>
                {totalMatches === 0 ? <div style={{ fontSize: 13, color: muted }}>No matches played.</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(scoreBuckets).map(([label, count]) => {
                      const pct = maxBucket > 0 ? Math.round((count / maxBucket) * 100) : 0;
                      const colorMap = { "11-0 to 11-3": "#ef4444", "11-4 to 11-7": "#f97316", "11-8 to 11-9": "#eab308", "12-10+": "#10d48e" };
                      return (
                        <div key={label}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, color: text }}>{label}</span>
                            <span style={{ fontSize: 12, color: muted }}>{count} match{count !== 1 ? "es" : ""} · {totalMatches > 0 ? Math.round((count/totalMatches)*100) : 0}%</span>
                          </div>
                          <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: colorMap[label], borderRadius: 4, transition: "width 0.5s" }} />
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
                      {scoreBuckets["11-8 to 11-9"] + scoreBuckets["12-10+"] > totalMatches / 2
                        ? "🔥 Very competitive tournament — most matches were close"
                        : scoreBuckets["11-0 to 11-3"] > totalMatches / 3
                        ? "⚡ Dominant performances — several blowouts"
                        : "⚖️ Balanced tournament — good mix of scores"}
                    </div>
                  </div>
                )}
              </div>

              {/* Attendance */}
              <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: muted, marginBottom: 12, fontWeight: 600 }}>👥 PLAYER ATTENDANCE</div>
                <div style={{ fontSize: 11, color: muted, marginBottom: 10 }}>How many of your {allHistory.length} recorded tournaments each player has appeared in</div>
                {attendance.map(({ name, count, total }) => {
                  const pct = total > 0 ? Math.round((count / total) * 100) : 100;
                  return (
                    <div key={name} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 13, color: text, fontWeight: 500 }}>{name}</span>
                        <span style={{ fontSize: 11, color: muted }}>{count}/{total} tournaments</span>
                      </div>
                      <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? lime : pct >= 50 ? "var(--color-gold)" : "var(--color-danger)", borderRadius: 3, transition: "width 0.5s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tournament Heatmap */}
              <div className="glass-card" style={{ borderRadius: 14, padding: "1rem 1.2rem" }}>
                <div style={{ fontSize: 10, letterSpacing: 2, color: muted, marginBottom: 12, fontWeight: 600 }}>📅 TOURNAMENT DAY HEATMAP</div>
                <div style={{ fontSize: 11, color: muted, marginBottom: 10 }}>Which days you host tournaments most</div>
                <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                  {days.map((day, i) => {
                    const count = dayCount[i];
                    const h = maxDay > 0 ? Math.max(Math.round((count / maxDay) * 60), count > 0 ? 8 : 4) : 4;
                    return (
                      <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 10, color: count > 0 ? lime : muted, fontWeight: count > 0 ? 700 : 400 }}>{count || ""}</div>
                        <div style={{ width: "100%", height: `${h}px`, background: count > 0 ? (count === maxDay ? lime : "rgba(16,212,142,0.4)") : "rgba(255,255,255,0.06)", borderRadius: "3px 3px 0 0", transition: "height 0.4s" }} />
                        <div style={{ fontSize: 10, color: muted }}>{day}</div>
                      </div>
                    );
                  })}
                </div>
                {maxDay > 0 && (() => {
                  const peakDay = days[dayCount.indexOf(maxDay)];
                  return <div style={{ marginTop: 10, fontSize: 12, color: muted }}>Most active day: <span style={{ color: lime, fontWeight: 600 }}>{peakDay}</span></div>;
                })()}
              </div>

            </div>
          );
        })()}
      </div>

      {/* Share standings modal */}
      {showShare && (
        <StandingsShareModal
          standings={standings}
          champion={t.champion || null}
          playoffs={t.playoffs || null}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}