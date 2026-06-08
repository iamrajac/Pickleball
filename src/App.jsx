import { useState, useEffect, useRef, Component } from "react";
import { HashRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { ref, get } from "firebase/database";
import { db, firestore } from "./firebase";

import { computeStandings } from "./utils/schedule";
import { loadH } from "./utils/history";
import { useTournament } from "./hooks/useTournament";
import { useAuth } from "./hooks/useAuth";
import { requestPermission, notifyChampion, notifyAllMatchesDone } from "./utils/notifications";

import { HubScreen } from "./screens/HubScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { HistoryScreen, HistoryDetail } from "./screens/HistoryScreen";
import { CareerScreen } from "./screens/CareerScreen";
import { PlayerScreen } from "./screens/PlayerScreen";
import { AccountScreen } from "./screens/AccountScreen";
import { PublicTournamentScreen } from "./screens/PublicTournamentScreen";
import { ClubsScreen } from "./screens/ClubsScreen";
import { ClubDashboardScreen } from "./screens/ClubDashboardScreen";
import { ToastProvider, useToast } from "./components/Toast";
import { MatchCard } from "./components/MatchCard";
import { StandingsTable } from "./components/StandingsTable";
import { PlayoffCard } from "./components/PlayoffCard";
import { ShareModal } from "./components/ShareModal";
import { StandingsShareModal } from "./components/StandingsShare";
import { ReactionsOverlay } from "./components/Reactions";
import { MatchTicker } from "./components/MatchTicker";
import { TournamentAwards } from "./components/TournamentAwards";
import { ScorerPinModal, ScorerPinEntry } from "./components/ScorerModal";
import { AuthModal } from "./components/AuthModal";
import { BottomNav } from "./components/BottomNav";
import { playAudio } from "./utils/audio";
import { Share2, Users, AlertCircle, RefreshCw, ArrowLeft, Moon, Sun, Camera, Lock, WifiOff, Tv, MessageCircle } from "lucide-react";
import { InstallPrompt } from "./components/InstallPrompt";
import { Onboarding, useOnboarding } from "./components/Onboarding";
import { BracketTree } from "./components/BracketTree";
import { Announcements } from "./components/Announcements";
import { TVMode } from "./components/TVMode";
import { TournamentChat } from "./components/TournamentChat";
import { ClaimBanner } from "./components/ClaimBanner";

// ── Theme ──────────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("pkl_theme");
    if (saved) return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("pkl_theme", theme);
  }, [theme]);
  // Auto-follow OS changes when user hasn't manually picked
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e) => {
      if (!localStorage.getItem("pkl_theme_manual")) {
        setTheme(e.matches ? "light" : "dark");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const toggle = () => {
    localStorage.setItem("pkl_theme_manual", "1");
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };
  return { theme, toggle };
}

// ── Offline detection ──────────────────────────────────────────────────────
function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const { addToast } = useToast();
  useEffect(() => {
    const up = () => { setIsOffline(false); addToast("Back online — syncing...", "success", 2000); };
    const dn = () => { setIsOffline(true); addToast("Offline — scores saved locally", "info", 3000); };
    window.addEventListener("online", up);
    window.addEventListener("offline", dn);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", dn); };
  }, [addToast]);
  return isOffline;
}

// ── Eliminated banner ──────────────────────────────────────────────────────
function EliminatedBanner({ names }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", marginBottom: 16, borderRadius: "var(--radius-sm)", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}>
      <span style={{ fontSize: 16 }}>🚫</span>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-danger)", letterSpacing: 1 }}>ELIMINATED</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)" }}>{names.join(", ")} — did not advance to playoffs</div>
      </div>
    </div>
  );
}

// ── Tournament view (shown over routes when code is active) ────────────────
function TournamentView({ t, theme, toggleTheme, user, playerDisplayName }) {
  const navigate = useNavigate();
  const {
    players, rounds, playoffs, champion, code, tab, setTab,
    readOnly, syncing, onlineCount, animatingScore, scorerPin, profiles,
    saveResult, savePlayoff, executeEnd, deleteTournament, handleScorerPinEntered,
    copyStandingsText, startPlayoffs, declareAsFinal, h2hMatrix,
    liveScores, pushLiveScore, scheduledAt, tournamentName, isPublic, claims, initialElos,
  } = t;

  const leaveAndGoHome = () => { executeEnd(); navigate("/"); };

  // Countdown for scheduled tournaments
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!scheduledAt) return;
    const ms = typeof scheduledAt === 'number' ? scheduledAt : new Date(scheduledAt).getTime();
    const tick = () => {
      const diff = ms - Date.now();
      if (diff <= 0) { setCountdown(""); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  const isOffline = useOffline();
  const [showShare, setShowShare] = useState(false);
  const [showStandingsShare, setShowStandingsShare] = useState(false);
  const [showPlayoffShare, setShowPlayoffShare] = useState(false);
  const [showScorerPin, setShowScorerPin] = useState(false);
  const [showScorerEntry, setShowScorerEntry] = useState(false);
  const [showConfirmEnd, setShowConfirmEnd] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showTVMode, setShowTVMode] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showOverflow, setShowOverflow] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const swipeTargetRef = useRef(null);

  const anyModalOpen = showShare || showStandingsShare || showPlayoffShare || showScorerPin || showScorerEntry || showConfirmEnd || showConfirmDelete;
  useEffect(() => {
    document.body.classList.toggle("modal-open", anyModalOpen);
    return () => document.body.classList.remove("modal-open");
  }, [anyModalOpen]);

  const standings = computeStandings(players, rounds);
  const allM = rounds.flat();
  const totalPlayed = allM.filter((m) => m.played).length;
  const pct = allM.length ? Math.round((totalPlayed / allM.length) * 100) : 0;
  const allDone = allM.length > 0 && totalPlayed === allM.length;

  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); swipeTargetRef.current = e.target; };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    let el = swipeTargetRef.current;
    while (el && el !== document.body) {
      const s = window.getComputedStyle(el);
      if ((s.overflowX === "auto" || s.overflowX === "scroll") && el.scrollWidth > el.clientWidth) return;
      el = el.parentElement;
    }
    const d = touchStart - touchEnd;
    if (Math.abs(d) < 60) return;
    if (d > 0) {
      if (tab === "rounds") setTab("standings");
      else if (tab === "standings") setTab("playoffs");
    } else {
      if (tab === "playoffs") setTab("standings");
      else if (tab === "standings") setTab("rounds");
    }
    playAudio("tick");
  };

  const PC = ({ stage, match, accent }) => match ? (
    <PlayoffCard match={match} onSave={(a, b, d, n) => savePlayoff(stage, a, b, d, n)} accent={accent || "var(--color-lime)"} readOnly={readOnly} h2hMatrix={h2hMatrix} profiles={profiles} onLiveScore={(a, b, note, startedAt) => pushLiveScore(`playoff-${stage}`, a, b, note, startedAt)} />
  ) : null;

  return (
    <>
      {/* Topbar */}
      <div className="glass" style={{ position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid var(--color-border)" }}>
        <div style={{ padding: "0 0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 52 }}>
            <button onClick={() => setShowConfirmEnd(true)} className="ni topbar-btn" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", padding: "6px", display: "flex", alignItems: "center", flexShrink: 0 }}>
              <ArrowLeft size={20} />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: theme === "dark" ? "var(--color-lime)" : "#f97316", letterSpacing: 1.5, lineHeight: 1, whiteSpace: "nowrap" }}>
                  {readOnly ? "👁 SPECTATING" : "LIVE"}
                </div>
                <span className="live-dot" style={{ width: 6, height: 6 }} />
                {syncing && <RefreshCw size={10} className="spin" style={{ color: "rgba(255,255,255,0.6)" }} />}
                {isOffline && <WifiOff size={12} color="#fca5a5" />}
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", display: "flex", gap: 6, alignItems: "center", marginTop: 1 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={9} /> {onlineCount}</span>
                <span style={{ color: "#93c5fd", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 11 }}>{code}</span>
                <span>· {totalPlayed}/{allM.length}</span>
                <span className="topbar-mobile-only" style={{ color: "var(--color-lime)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 11 }}>{pct}%</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
              {readOnly ? (
                <button className="pb" onClick={() => setShowScorerEntry(true)}
                  style={{ background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.5)", borderRadius: 8, padding: "6px", display: "flex", alignItems: "center", gap: 4, color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  <Lock size={13} /><span className="topbar-desktop-only">SCORER</span>
                </button>
              ) : scorerPin ? (
                <button className="pb" onClick={() => setShowScorerPin(true)}
                  style={{ background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.5)", borderRadius: 8, padding: "6px", display: "flex", alignItems: "center", gap: 4, color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                  <Lock size={13} /><span className="topbar-desktop-only">PIN</span>
                </button>
              ) : null}
              {/* Share button — always visible */}
              <button className="pb topbar-btn" onClick={() => setShowShare(true)}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#93c5fd", cursor: "pointer" }}>
                <Share2 size={16} />
              </button>
              {/* Desktop: show TV, Chat, Theme inline. Mobile: collapse into ⋯ */}
              <div className="topbar-desktop-only" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <button className="pb topbar-btn" onClick={() => setShowTVMode(true)}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", cursor: "pointer" }}>
                  <Tv size={16} />
                </button>
                <button className="pb topbar-btn" onClick={() => setShowChat(true)}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399", cursor: "pointer" }}>
                  <MessageCircle size={16} />
                </button>
                <button className="pb topbar-btn" onClick={toggleTheme}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}>
                  {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
              {/* Mobile overflow menu */}
              <div className="topbar-mobile-only" style={{ position: "relative" }}>
                <button className="pb topbar-btn" onClick={() => setShowOverflow(v => !v)}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
                  ⋯
                </button>
                {showOverflow && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, padding: "6px 0", zIndex: 200, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
                    onClick={() => setShowOverflow(false)}>
                    <button className="pb" onClick={() => setShowTVMode(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "none", border: "none", color: "#a78bfa", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                      <Tv size={15} /> TV MODE
                    </button>
                    <button className="pb" onClick={() => setShowChat(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "none", border: "none", color: "#34d399", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                      <MessageCircle size={15} /> CHAT
                    </button>
                    <button className="pb" onClick={toggleTheme} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                      {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />} {theme === "dark" ? "LIGHT" : "DARK"} MODE
                    </button>
                  </div>
                )}
              </div>
              <div className="topbar-desktop-only" style={{ flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: 40, height: 3, background: "var(--color-border)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "var(--color-lime)", width: `${pct}%`, transition: "width 0.5s" }} />
                </div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.9)" }}>{pct}%</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, paddingBottom: 8 }}>
            {[{ id: "rounds", label: "⚡ ROUNDS" }, { id: "standings", label: "📊 TABLE" }, { id: "playoffs", label: "🏆 PLAYOFFS" }].map((tb) => (
              <button key={tb.id} className={`tab-btn ${tab === tb.id ? "on" : "off"}`}
                onClick={() => { setTab(tb.id); playAudio("tick"); window.scrollTo(0, 0); }} style={{ flex: 1 }}>
                {tb.label}
              </button>
            ))}
          </div>
        </div>
        <MatchTicker rounds={rounds} playoffs={playoffs} profiles={profiles} liveScores={liveScores} />
      </div>

      {/* Modals */}
      {showShare && <ShareModal code={code} isPublic={isPublic} onClose={() => setShowShare(false)} tournamentName={tournamentName} playerCount={players.length} standings={standings} currentRound={rounds.filter(r => r.some(m => m.played)).length || 1} totalRounds={rounds.length} />}
      {showStandingsShare && <StandingsShareModal standings={standings} onClose={() => setShowStandingsShare(false)} />}
      {showPlayoffShare && <StandingsShareModal standings={standings} onClose={() => setShowPlayoffShare(false)} playoffs={playoffs} champion={champion} />}
      {showScorerPin && scorerPin && <ScorerPinModal code={code} pin={scorerPin} onClose={() => setShowScorerPin(false)} />}
      {showScorerEntry && <ScorerPinEntry code={code} onGranted={async (pin) => { await handleScorerPinEntered(pin); setShowScorerEntry(false); }} onClose={() => setShowScorerEntry(false)} />}

      {/* Confirm end / delete */}
      {showConfirmEnd && (
        <div className="fu" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div className="glass-card" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", maxWidth: 360, width: "90%", textAlign: "center" }}>
            <AlertCircle size={44} color="var(--color-danger)" style={{ margin: "0 auto 16px" }} />
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, marginBottom: 8 }}>LEAVE TOURNAMENT?</div>
            <div style={{ fontSize: 14, color: "var(--color-muted)", marginBottom: 24 }}>Choose what to do with this tournament.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="pb" onClick={() => setShowConfirmEnd(false)}
                style={{ padding: "12px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", fontWeight: 600, cursor: "pointer" }}>
                CANCEL — STAY
              </button>
              {!readOnly && (
                <button className="pb" onClick={leaveAndGoHome}
                  style={{ padding: "12px", background: "rgba(245,158,11,0.15)", border: "1px solid var(--color-gold)", borderRadius: "var(--radius-sm)", color: "var(--color-gold)", fontWeight: 600, cursor: "pointer" }}>
                  END & SAVE TO HISTORY
                </button>
              )}
              {readOnly && (
                <button className="pb" onClick={leaveAndGoHome}
                  style={{ padding: "12px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", fontWeight: 600, cursor: "pointer" }}>
                  LEAVE
                </button>
              )}
              {!readOnly && (
                <button className="pb" onClick={() => { setShowConfirmEnd(false); setShowConfirmDelete(true); }}
                  style={{ padding: "12px", background: "rgba(239,68,68,0.1)", border: "1px solid var(--color-danger)", borderRadius: "var(--radius-sm)", color: "var(--color-danger)", fontWeight: 600, cursor: "pointer" }}>
                  DELETE TOURNAMENT ENTIRELY
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {showConfirmDelete && (
        <div className="fu" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
          <div className="glass-card" style={{ padding: "2rem", borderRadius: "var(--radius-lg)", maxWidth: 360, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🗑️</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, marginBottom: 8, color: "var(--color-danger)" }}>DELETE TOURNAMENT?</div>
            <div style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 24, lineHeight: 1.6 }}>
              This will permanently remove all scores, stats, and history for this tournament. <strong style={{ color: "var(--color-danger)" }}>This cannot be undone.</strong>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="pb" onClick={() => setShowConfirmDelete(false)}
                style={{ flex: 1, padding: "12px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", fontWeight: 600, cursor: "pointer" }}>
                CANCEL
              </button>
              <button className="pb" onClick={() => { setShowConfirmDelete(false); deleteTournament(); navigate("/"); }}
                style={{ flex: 1, padding: "12px", background: "var(--color-danger)", border: "none", borderRadius: "var(--radius-sm)", color: "white", fontWeight: 600, cursor: "pointer" }}>
                YES, DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TVMode overlay */}
      {showTVMode && <TVMode code={code} rounds={rounds} liveScores={liveScores} profiles={profiles} tournamentName={tournamentName} playoffs={playoffs} onClose={() => setShowTVMode(false)} />}

      {/* Chat bottom sheet */}
      {showChat && <TournamentChat code={code} readOnly={false} currentUserName={readOnly ? "Spectator" : "Organizer"} isOrganizer={!readOnly} onClose={() => setShowChat(false)} />}

      {/* Announcements panel */}
      <div style={{ padding: "8px 1rem 0" }}>
        <Announcements code={code} readOnly={readOnly} scorerName="Organizer" />
        {readOnly && <ClaimBanner code={code} players={players} currentUser={user} existingClaims={claims} profiles={profiles} readOnly={readOnly} onClaimed={() => {}} displayNameOverride={playerDisplayName} />}
      </div>

      {/* Scheduled lock banner */}
      {countdown && (
        <div style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 0, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🕐</span>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#f59e0b", letterSpacing: 2 }}>TOURNAMENT STARTS IN</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#f59e0b", letterSpacing: 3, lineHeight: 1 }}>{countdown}</div>
          </div>
          <span style={{ fontSize: 16 }}>🔒</span>
        </div>
      )}

      {/* Main content */}
      <div style={{ padding: "1.5rem 1rem 120px", maxWidth: 1000, margin: "0 auto" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEndHandler}>

        {/* ROUNDS */}
        {tab === "rounds" && (
          <div>
            <div className="desktop-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: 24, alignItems: "start" }}>
              {rounds.map((round, ri) => {
                const done = round.every((m) => m.played);
                return (
                  <div key={ri} className="fu" style={{ animationDelay: `${ri * 0.03}s` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: done ? "var(--color-lime)" : "var(--color-text)", letterSpacing: 2 }}>ROUND {ri + 1}</div>
                      <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
                      <div style={{ fontSize: 11, letterSpacing: 1, color: done ? "var(--color-lime)" : "var(--color-muted)", fontWeight: 600 }}>{done ? "✓ DONE" : `${round.filter((m) => m.played).length}/${round.length}`}</div>
                    </div>
                    {round[0]?.bye?.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", marginBottom: 8, borderRadius: 8, background: "rgba(241,200,53,0.08)", border: "1px solid rgba(241,200,53,0.2)" }}>
                        <span style={{ fontSize: 13 }}>☕</span>
                        <span style={{ fontSize: 12, color: "var(--color-gold)" }}>Sitting out: <strong>{round[0].bye.join(", ")}</strong></span>
                      </div>
                    )}
                    {round.map((m, mi) => {
                      const tk = `${ri}-${mi}`;
                      return (
                        <div key={mi} className={animatingScore === tk ? "score-flash" : ""}>
                          <MatchCard match={m} delay={mi * 0.04} readOnly={readOnly}
                            onSave={(a, b, dur, notes) => saveResult(ri, mi, a, b, dur, notes)}
                            h2hMatrix={h2hMatrix} profiles={profiles}
                            timerState={t.getMatchTimer(tk)}
                            onTimerStart={() => t.startMatchTimer(tk)}
                            onTimerStop={() => t.stopMatchTimer(tk)}
                            onTimerReset={() => t.resetMatchTimer(tk)}
                            onLiveScore={(a, b, note, startedAt) => pushLiveScore(tk, a, b, note, startedAt)}
                            tournamentName={tournamentName} roundIndex={ri}
                            liveScore={liveScores[tk]} />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            {allDone && !playoffs && !readOnly && (
              <div className="fu" style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap", animationDelay: "0.2s" }}>
                <button className="pb" style={{ flex: 1, minWidth: 200, padding: 18, background: "var(--color-lime)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: "var(--color-dark)" }} onClick={startPlayoffs}>🏆 FULL PLAYOFFS</button>
                <button className="pb" style={{ flex: 1, minWidth: 200, padding: 18, background: "transparent", border: "2px solid var(--color-gold)", borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: "var(--color-gold)" }} onClick={declareAsFinal}>⚡ QUICK FINAL</button>
              </div>
            )}
          </div>
        )}

        {/* STANDINGS */}
        {tab === "standings" && (
          <div className="fu">
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              <button className="pb" onClick={copyStandingsText} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: "var(--radius-sm)", color: "#25d366", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📋 COPY FOR WHATSAPP</button>
              <button className="pb" onClick={() => setShowStandingsShare(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}><Camera size={14} /> SHARE IMAGE</button>
            </div>
            <TournamentAwards players={players} rounds={rounds} champion={champion} profiles={profiles} />
            <StandingsTable standings={standings} rounds={rounds} profiles={profiles} initialElos={initialElos} />
            {allDone && !playoffs && !readOnly && (
              <div className="fu" style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap", animationDelay: "0.2s" }}>
                <button className="pb" style={{ flex: 1, minWidth: 200, padding: 18, background: "var(--color-lime)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: "var(--color-dark)" }} onClick={startPlayoffs}>🏆 FULL PLAYOFFS</button>
                <button className="pb" style={{ flex: 1, minWidth: 200, padding: 18, background: "transparent", border: "2px solid var(--color-gold)", borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: "var(--color-gold)" }} onClick={declareAsFinal}>⚡ QUICK FINAL</button>
              </div>
            )}
          </div>
        )}

        {/* PLAYOFFS */}
        {tab === "playoffs" && (
          <div className="fu">
            {!playoffs ? (
              <div className="glass-card" style={{ textAlign: "center", padding: "5rem 1rem", borderRadius: "var(--radius-lg)" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, color: "var(--color-border)", letterSpacing: 4, lineHeight: 1 }}>LOCKED</div>
                <div style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 12 }}>Complete all group matches first</div>
                {allDone && !readOnly && (
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}>
                    <button className="pb" style={{ padding: "16px 32px", background: "var(--color-lime)", border: "none", borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 2, color: "var(--color-dark)", cursor: "pointer" }} onClick={startPlayoffs}>FULL PLAYOFFS</button>
                    <button className="pb" style={{ padding: "16px 32px", background: "transparent", border: "2px solid var(--color-gold)", borderRadius: "var(--radius-md)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: "var(--color-gold)", cursor: "pointer" }} onClick={declareAsFinal}>QUICK FINAL</button>
                  </div>
                )}
              </div>
            ) : (playoffs.q1 || playoffs.final || playoffs.sf1) ? (
              <PlayoffBoundary>
                <PlayoffSection key={playoffs ? Object.keys(playoffs).filter(k => playoffs[k]?.teamA).sort().join(",") : "empty"}
                  playoffs={playoffs} champion={champion} players={players} profiles={profiles}
                  savePlayoff={savePlayoff} readOnly={readOnly} h2hMatrix={h2hMatrix} showStandingsShare={() => setShowPlayoffShare(true)}
                  copyStandingsText={copyStandingsText} standings={standings} rounds={rounds} pushLiveScore={pushLiveScore} liveScores={liveScores} />
              </PlayoffBoundary>
            ) : (
              <div className="glass-card" style={{ textAlign: "center", padding: "4rem", borderRadius: "var(--radius-lg)" }}>
                <RefreshCw className="spin text-muted" size={32} style={{ margin: "0 auto 16px" }} />
                <div style={{ fontSize: 14, color: "var(--color-muted)" }}>Loading playoffs...</div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// Auto-recovering error boundary for playoffs — catches React hook reconciliation crashes
// when new stages appear (Q2/Final) and re-renders cleanly after a brief delay
class PlayoffBoundary extends Component {
  constructor(props) { super(props); this.state = { crashed: false, resetKey: 0 }; }
  static getDerivedStateFromError() { return { crashed: true }; }
  componentDidCatch() {
    setTimeout(() => this.setState(s => ({ crashed: false, resetKey: s.resetKey + 1 })), 100);
  }
  render() {
    if (this.state.crashed) return (
      <div style={{ textAlign: "center", padding: "2rem", color: "var(--color-muted)", fontSize: 13 }}>
        <RefreshCw className="spin" size={24} style={{ margin: "0 auto 12px", display: "block" }} />
        Loading playoffs...
      </div>
    );
    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}

function PlayoffGrid({ children }) {
  return <div className="playoff-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>{children}</div>;
}

// ── Playoff section with bracket/scores toggle ────────────────────────────────
function PlayoffSection({ playoffs, champion, players, profiles, savePlayoff, readOnly, h2hMatrix, copyStandingsText, standings, rounds, pushLiveScore, liveScores }) {
  const [view, setView] = useState("bracket");
  const mode = playoffs.mode || "ipl8";
  const labels = { final_only: "GRAND FINAL", elim_to_sf: "TOP 4 BRACKET", ipl6: "6-TEAM IPL BRACKET", ipl8: "IPL PLAYOFF BRACKET", top8: "TOP 8 BRACKET", top8_ipl: "TOP 8 IPL BRACKET" };
  const desc = { final_only: "Single match final", elim_to_sf: "Semi Final + Final", ipl6: "Q1 · Eliminator · Final", ipl8: "Q1 · Eliminator · Q2 · Final", top8: "QF · SF · Final", top8_ipl: "Q1 · Q2 · Elim · SF · Final" };
  const elim = playoffs.eliminated || [];
  const pc = (stage, match, accent) => match ? <PlayoffCard key={stage} match={match} onSave={(a, b, d, n) => savePlayoff(stage, a, b, d, n)} accent={accent || "var(--color-lime)"} readOnly={readOnly} h2hMatrix={h2hMatrix} profiles={profiles} onLiveScore={pushLiveScore ? (a, b, note, startedAt) => pushLiveScore(`playoff-${stage}`, a, b, note, startedAt) : undefined} liveScore={liveScores?.[`playoff-${stage}`]} /> : null;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      {/* Header */}
      {!champion && !playoffs.champion && (
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--color-lime)", letterSpacing: 3 }}>{labels[mode]}</div>
          <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 12 }}>{desc[mode]} · {players.length} players</div>
          <div style={{ display: "inline-flex", gap: 4, background: "var(--surface)", borderRadius: "var(--radius-md)", padding: 4 }}>
            {[["bracket","🌳 BRACKET"],["scores","📋 SCORES"]].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "6px 14px", borderRadius: "var(--radius-sm)", border: "none", background: view === v ? "var(--accent)" : "transparent", color: view === v ? "#fff" : "var(--text-muted)", fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      {/* Champion */}
      {(champion || playoffs.champion) && (
        <div className="fu glass-card" style={{ border: "1px solid var(--color-lime)", borderRadius: "var(--radius-lg)", padding: "2rem", textAlign: "center", marginBottom: 24, background: "rgba(200,241,53,0.05)" }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "var(--color-lime)", marginBottom: 8, fontWeight: 600 }}>TOURNAMENT CHAMPIONS</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 42, color: "var(--color-lime)", letterSpacing: 3 }}>{champion || playoffs.champion}</div>
        </div>
      )}

      {/* Bracket tree view */}
      {view === "bracket" && <BracketTree playoffs={playoffs} profiles={profiles} />}

      {/* Scores view */}
      {view === "scores" && (() => {
        if (mode === "final_only") return <><>{elim.length > 0 && <EliminatedBanner names={elim} />}</>{pc("final", playoffs.final, "var(--color-gold)")}</>;
        if (mode === "elim_to_sf") return <>{pc("sf1", playoffs.sf1, "var(--color-lime)")}{playoffs.final?.teamA && <div style={{marginTop:16}}>{pc("final", playoffs.final, "var(--color-gold)")}</div>}</>;
        if (mode === "ipl6") return <>{pc("q1", playoffs.q1, "var(--color-lime)")}{playoffs.elim && <div style={{marginTop:16}}>{pc("elim", playoffs.elim, "var(--color-cyan)")}</div>}{playoffs.final?.teamA && <div style={{marginTop:16}}>{pc("final", playoffs.final, "var(--color-gold)")}</div>}</>;
        if (mode === "ipl8") return <><PlayoffGrid>{pc("q1", playoffs.q1, "var(--color-lime)")}{pc("elim", playoffs.elim, "var(--color-cyan)")}</PlayoffGrid>{playoffs.q2 && <div style={{marginBottom:16}}>{pc("q2", playoffs.q2, "var(--color-gold)")}</div>}{playoffs.final && pc("final", playoffs.final, "var(--color-lime)")}</>;
        if (mode === "top8") return <><PlayoffGrid>{pc("qf1", playoffs.qf1, "var(--color-lime)")}{pc("qf2", playoffs.qf2, "var(--color-cyan)")}</PlayoffGrid><PlayoffGrid>{pc("sf1", playoffs.sf1, "var(--color-gold)")}{pc("sf2", playoffs.sf2, "var(--color-gold)")}</PlayoffGrid>{playoffs.final && pc("final", playoffs.final, "var(--color-lime)")}</>;
        if (mode === "top8_ipl") return <><PlayoffGrid>{pc("q1", playoffs.q1, "var(--color-lime)")}{pc("q2_b", playoffs.q2_b, "var(--color-cyan)")}</PlayoffGrid><PlayoffGrid>{pc("elim", playoffs.elim, "var(--color-gold)")}{pc("sf", playoffs.sf, "var(--color-gold)")}</PlayoffGrid>{playoffs.final && pc("final", playoffs.final, "var(--color-lime)")}</>;
        return null;
      })()}

      {/* Final standings */}
      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2 }}>FINAL STANDINGS</div>
          <div style={{ flex: 1, height: 1, background: "var(--color-border)" }} />
        </div>
        <TournamentAwards players={players} rounds={rounds} champion={champion} profiles={profiles} />
        {(champion || playoffs?.champion) && (
          <div className="fu" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <button className="pb" onClick={copyStandingsText} style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px 14px", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", borderRadius: "var(--radius-sm)", color: "#25d366", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📋 COPY FOR WHATSAPP</button>
          </div>
        )}
        <StandingsTable standings={standings} rounds={rounds} playoffs={playoffs} champion={champion} initialElos={initialElos} />
      </div>
    </div>
  );
}

// ── Setup route ────────────────────────────────────────────────────────────
function SetupRoute({ t, theme, toggleTheme }) {
  const navigate = useNavigate();
  const { addToast } = useToast();

  // Auto-join from URL ?join=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (joinCode) {
      window.history.replaceState({}, "", window.location.pathname);
      const upper = joinCode.trim().toUpperCase();
      get(ref(db, `tournaments/${upper}`))
        .then((snap) => { if (snap.exists() && snap.val()) t.handleJoin(upper, snap.val()); })
        .catch((e) => console.error("Auto-join error:", e));
    }
  }, []);

  return (
    <SetupScreen
      onStart={t.handleStart}
      onJoin={t.handleJoin}
      onHistory={() => navigate("/history")}
      onCareer={() => navigate("/career")}
      onToggleTheme={toggleTheme}
      theme={theme}
    />
  );
}


// ── History detail route ───────────────────────────────────────────────────
function HistoryDetailRoute({ theme }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tournament = location.state?.tournament;
  if (!tournament) { navigate("/history", { replace: true }); return null; }
  return <HistoryDetail tournament={tournament} onBack={() => navigate("/history")} theme={theme} />;
}

// ── HistoryScreen with navigation ─────────────────────────────────────────
function HistoryRoute({ theme }) {
  const navigate = useNavigate();
  return (
    <HistoryScreen
      onBack={() => navigate("/")}
      onOpen={(tournament) => navigate("/history/detail", { state: { tournament } })}
      theme={theme}
    />
  );
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </HashRouter>
  );
}

function AppInner() {
  const { theme, toggle: toggleTheme } = useTheme();
  const t = useTournament();
  const { user, loading, isGuest, isAuthenticated, signInWithGoogle, continueAsGuest } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSyncPrompt, setShowSyncPrompt] = useState(false);
  const [localCount, setLocalCount] = useState(0);
  const [playerDisplayName, setPlayerDisplayName] = useState("");
  const { showOnboarding, markDone } = useOnboarding();
  const { addToast } = useToast();

  // Load Firestore display name (may differ from Firebase Auth name)
  useEffect(() => {
    if (!user?.uid) return;
    import("./utils/playerProfile").then(({ getPlayerByUid }) => {
      getPlayerByUid(user.uid).then(p => { if (p?.displayName) setPlayerDisplayName(p.displayName); });
    });
  }, [user?.uid]);

  // Show toast when Firebase Realtime DB write is blocked (rules issue)
  useEffect(() => {
    const handler = (e) => {
      addToast("Firebase write blocked — check Realtime DB rules in Firebase Console.", "error", 8000);
    };
    window.addEventListener("pkl_fb_error", handler);
    return () => window.removeEventListener("pkl_fb_error", handler);
  }, [addToast]);

  // Request notification permission once after login
  useEffect(() => {
    if (!isAuthenticated) return;
    const NOTIF_KEY = 'pkl_notif_asked';
    if (localStorage.getItem(NOTIF_KEY)) return;
    // Ask after a short delay so it doesn't feel intrusive
    const timer = setTimeout(async () => {
      localStorage.setItem(NOTIF_KEY, '1');
      await requestPermission();
    }, 3000);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);

  // Fire game event notifications
  const prevChampion = useRef(null);
  const prevAllDone = useRef(false);
  useEffect(() => {
    const allM = t.rounds?.flat() || [];
    const allDone = allM.length > 0 && allM.every(m => m.played);
    // Notify when all group matches complete
    if (allDone && !prevAllDone.current && !t.champion && !t.playoffs) {
      notifyAllMatchesDone(t.tournamentName || `#${t.code}`);
    }
    prevAllDone.current = allDone;
  }, [t.rounds, t.champion, t.playoffs]);

  useEffect(() => {
    if (t.champion && t.champion !== prevChampion.current) {
      notifyChampion(t.tournamentName || `#${t.code}`, t.champion);
      prevChampion.current = t.champion;
    }
    if (!t.champion) prevChampion.current = null;
  }, [t.champion]);

  // After Google sign-in, check for existing local data to offer sync (runs once per uid)
  const syncCheckedRef = useRef(false);
  useEffect(() => {
    if (!user?.uid || syncCheckedRef.current) return;
    syncCheckedRef.current = true;
    const SYNCED_KEY = `pkl_synced_${user.uid}`;
    if (localStorage.getItem(SYNCED_KEY)) return;
    const local = (JSON.parse(localStorage.getItem("pkl_hist_v2") || "[]")).filter(t => t.code);
    if (local.length > 0) { setLocalCount(local.length); setShowSyncPrompt(true); }
  }, [user?.uid]);

  const handleSync = async (doSync) => {
    setShowSyncPrompt(false);
    const local = (JSON.parse(localStorage.getItem("pkl_hist_v2") || "[]")).filter(t => t.code);
    if (doSync && user?.uid) {
      // Import to Firestore
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      await Promise.all(local.map(entry =>
        setDoc(doc(firestore, "users", user.uid, "tournaments", entry.code), {
          code: entry.code, name: entry.name || "", status: entry.status || (entry.champion ? "done" : "live"),
          playerCount: entry.players?.length || 0, isPublic: true,
          createdAt: serverTimestamp(), champion: entry.champion || null,
        }, { merge: true }).catch(() => {})
      ));
    } else {
      // "No Thanks" — archive old local data and clear it so it doesn't show in the Google account
      // Data is preserved in the archive key and never deleted
      localStorage.setItem(`pkl_hist_archived_${user.uid}`, JSON.stringify(local));
      localStorage.setItem("pkl_hist_v2", JSON.stringify([]));
    }
    localStorage.setItem(`pkl_synced_${user.uid}`, "1");
  };

  // After auth completes, check if there's a pending join link
  useEffect(() => {
    if (!isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get("join");
    if (!joinCode) return;
    window.history.replaceState({}, "", window.location.pathname);
    const upper = joinCode.trim().toUpperCase();
    get(ref(db, `tournaments/${upper}`))
      .then(snap => { if (snap.exists() && snap.val()) t.handleJoin(upper, snap.val()); })
      .catch(e => console.error("Auto-join error:", e));
  }, [isAuthenticated]);

  // Show loading spinner
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 32, color: "var(--accent)", letterSpacing: 4 }}>🏓</div>
    </div>
  );

  // Public tournament page — accessible without login
  if (!isAuthenticated) {
    const hash = window.location.hash;
    if (hash.startsWith("#/tournament/")) {
      return <PublicTournamentScreen />;
    }
    return <AuthModal onGoogle={signInWithGoogle} onGuest={continueAsGuest} />;
  }

  // Local data sync prompt — shown once after first Google sign-in if local data exists
  if (showSyncPrompt) return (
    <div style={{ position: "fixed", inset: 0, background: "var(--overlay)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div className="card fu" style={{ maxWidth: 360, width: "100%", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: 2, marginBottom: 8 }}>LOCAL DATA FOUND</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
          You have <strong style={{ color: "var(--text)" }}>{localCount} tournament{localCount !== 1 ? "s" : ""}</strong> saved on this device.<br />
          Import them to your Google account so they appear on all your devices?
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="pb" onClick={() => handleSync(false)}
            style={{ flex: 1, padding: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-secondary)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            NO THANKS
          </button>
          <button className="pb" onClick={() => handleSync(true)}
            style={{ flex: 1, padding: "12px", background: "var(--accent)", border: "none", borderRadius: "var(--radius-md)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            YES, IMPORT
          </button>
        </div>
      </div>
    </div>
  );

  // Active tournament overrides all routes
  if (t.code) return <TournamentView t={t} theme={theme} toggleTheme={toggleTheme} user={user} playerDisplayName={playerDisplayName} />;

  return (
    <>
      {showOnboarding && <Onboarding onDone={markDone} />}
      <InstallPrompt />
      <div key={location.pathname} className="page-in">
      <Routes>
        <Route path="/" element={
          <HubScreen
            user={user} isGuest={isGuest}
            theme={theme} onToggleTheme={toggleTheme}
            onCreateTournament={() => navigate("/create")}
            onJoin={t.handleJoin}
            onOpenTournament={async (tournament) => {
              if (!tournament.code) return;

              // Upcoming tournaments are fully accessible — scoring is locked inside until time arrives

              const isLive = tournament.status === "live" || tournament.status === "in-progress" || tournament.status === "upcoming";

              // Always try Realtime DB first — has full data for live AND recently completed
              try {
                const snap = await get(ref(db, `tournaments/${tournament.code}`));
                if (snap.exists() && snap.val()) {
                  const fbData = snap.val();
                  if (isLive) {
                    t.handleJoin(tournament.code, fbData);
                    return;
                  } else {
                    // Completed — merge FB data with local (local has rounds structure)
                    const local = loadH().find(h => h.code === tournament.code);
                    const full = local?.rounds?.length
                      ? { ...local, name: local.name || fbData.name || tournament.name || "", champion: local.champion || fbData.champion }
                      : { ...fbData, name: fbData.name || tournament.name || "", date: tournament.date || new Date().toISOString() };
                    navigate("/history/detail", { state: { tournament: full } });
                    return;
                  }
                }
              } catch (e) { /* offline or not found — fall through */ }

              // Fallback: use local data
              const local = loadH().find(h => h.code === tournament.code);
              if (isLive) {
                t.handleJoin(tournament.code, local || tournament);
              } else {
                navigate("/history/detail", { state: { tournament: local || tournament } });
              }
            }}
          />
        } />
        <Route path="/create" element={
          <SetupScreen
            onStart={t.handleStart}
            onJoin={t.handleJoin}
            onBack={() => navigate("/")}
            theme={theme}
          />
        } />
        <Route path="/history" element={<HistoryRoute theme={theme} />} />
        <Route path="/history/detail" element={<HistoryDetailRoute theme={theme} />} />
        <Route path="/career" element={<CareerScreen onBack={() => navigate("/")} theme={theme} />} />
        <Route path="/account" element={<AccountScreen />} />
        <Route path="/player/:username" element={<PlayerScreen />} />
        <Route path="/tournament/:code" element={<PublicTournamentScreen />} />
        <Route path="/clubs" element={<ClubsScreen />} />
        <Route path="/clubs/:clubId" element={<ClubDashboardScreen />} />
        <Route path="*" element={<HubScreen user={user} isGuest={isGuest} theme={theme} onToggleTheme={toggleTheme} onCreateTournament={() => navigate("/create")} onOpenTournament={() => {}} />} />
      </Routes>
      </div>
      <BottomNav />
    </>
  );
}
